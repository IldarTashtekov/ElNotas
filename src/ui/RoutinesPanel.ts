/**
 * La lista de rutinas bajo el mes, como una tabla: una fila por rutina con los
 * siete días de la semana de hoy, que se marcan pulsándolos. Tocar una fila la
 * deja «tocada» y sólo ella pinta sus días en el mes. Pulsar el nombre abre la
 * hoja con renombrar, meta, archivar y borrar; las archivadas van en una vista
 * aparte. Mantener pulsada una fila la mueve.
 *
 * Qué filas hay y cómo va la semana lo calcula `routineList`; aquí sólo se
 * pinta, se escucha y se guarda el orden.
 */

import type { Day, Logger, Routine, RoutineId, Store, UseCases } from "#core/index"
import type { BackStack } from "./backStack.js"
import type { CalendarOrder, CalendarOrderPersistence } from "./calendarOrder.js"
import { NO_ORDER, parseCalendarOrder } from "./calendarOrder.js"
import { attachDragReorder } from "./dragReorder.js"
import { elemento } from "./dom.js"
import type { RoutineList, RoutineRow, WeekCell, WeekHeading, WeekRow } from "./routineList.js"
import { currentWeek, movedOrder, routineList, touchedRoutineIds, weekHeadings, weekSummary } from "./routineList.js"
import type { Confirm, Sheet } from "./sheet.js"
import { createSheet } from "./sheet.js"

export interface RoutinesPanelDeps {
  readonly store: Store
  readonly useCases: UseCases
  readonly back: BackStack
  readonly confirm: Confirm
  readonly today: () => Day | null
  readonly calendarOrder: CalendarOrderPersistence
  readonly logger: Logger
  /** Cambió la rutina tocada: el mes se vuelve a pintar. */
  readonly onTouched: () => void
}

export interface RoutinesPanel {
  readonly element: HTMLElement
  /** La rutina que pinta el mes ahora (vacío si ninguna está tocada). */
  readonly touched: () => ReadonlySet<string>
  /** Repinta con lo que haya en el almacén. */
  readonly update: () => void
  /** Deja esa rutina «tocada», como si se pulsara su fila, y la trae a la vista. */
  readonly touch: (id: RoutineId) => void
  readonly destroy: () => void
}

const boton = (texto: string, alPulsar: () => void, clase: string): HTMLButtonElement => {
  const b: HTMLButtonElement = elemento("button", texto)
  b.type = "button"
  b.className = clase
  b.addEventListener("click", alPulsar)
  return b
}

export const createRoutinesPanel = ({
  store,
  useCases,
  back,
  confirm,
  today,
  calendarOrder,
  logger,
  onTouched,
}: RoutinesPanelDeps): RoutinesPanel => {
  /* Estado de pantalla: nada de esto se guarda. Al empezar ninguna está tocada y el mes no pinta rutinas. */
  let tocada: string | null = null
  let verArchivadas: boolean = false

  const raiz: HTMLElement = elemento("section")
  raiz.className = "grupos rutinas"
  const cabeza: HTMLElement = elemento("div")
  const lista: HTMLUListElement = elemento("ul")
  lista.className = "grupos-lista"
  const archivadas: HTMLUListElement = elemento("ul")
  archivadas.className = "grupos-lista grupos-archivados"
  const pie: HTMLElement = elemento("div")
  pie.className = "grupos-pie"
  const hoja: Sheet = createSheet(back)
  const caja: HTMLElement = elemento("div")
  caja.className = "grupo-hoja"
  raiz.append(cabeza, lista, archivadas, pie, hoja.element)

  const leerOrden = (): CalendarOrder => {
    const leido: ReturnType<CalendarOrderPersistence["load"]> = calendarOrder.load()
    return leido.ok ? parseCalendarOrder(leido.value) : NO_ORDER
  }
  const filas = (): RoutineList => routineList(store.getState(), leerOrden(), today())

  /* ── La tabla: una fila por rutina, con los siete días de esta semana ── */

  const cabecera = (semanaDeEjemplo: WeekRow, hoy: Day): HTMLElement => {
    const fila: HTMLElement = elemento("div")
    fila.className = "rutinas-cabecera"
    fila.append(elemento("span"))
    fila.append(
      ...weekHeadings(semanaDeEjemplo, hoy).map((h: WeekHeading): HTMLElement => {
        const col: HTMLElement = elemento("span", `${h.initial}\n${h.number}`)
        col.classList.toggle("hoy", h.today)
        return col
      }),
    )
    fila.append(elemento("span"))
    return fila
  }

  const celdas = (r: Routine, s: WeekRow, hoy: Day): ReadonlyArray<HTMLButtonElement> =>
    s.cells.map((c: WeekCell): HTMLButtonElement => {
      const b: HTMLButtonElement = boton(
        c.marked ? "X" : "·",
        (): void => {
          /* Marcar un día también toca la rutina: el mes pasa a enseñar la suya. */
          tocada = r.id
          void useCases.setRoutineDay(r.id, c.day, !c.marked, hoy)
          pintar()
          onTouched()
        },
        "rutina-dia",
      )
      b.disabled = c.future && !c.marked
      b.classList.toggle("marcado", c.marked)
      b.setAttribute("aria-pressed", c.marked ? "true" : "false")
      b.setAttribute("aria-label", `${r.name}, ${c.day}`)
      return b
    })

  const fila = (f: RoutineRow, hoy: Day | null): HTMLLIElement => {
    const li: HTMLLIElement = elemento("li")
    li.className = "grupo rutina-fila"
    li.classList.toggle("archivado", f.archived)
    li.dataset["id"] = f.id
    const nombre: HTMLButtonElement = boton(f.name, (): void => abrirMenu(f), "rutina-nombre")
    nombre.setAttribute("aria-label", `Opciones de ${f.name}`)
    li.append(nombre)
    const rutina: Routine | undefined = store.getState().routines[f.id as RoutineId]
    /* Las archivadas llegan sin «hoy»: sólo el nombre. */
    const semana: WeekRow | null = hoy === null || rutina === undefined ? null : currentWeek(rutina, hoy)
    if (rutina !== undefined && hoy !== null && semana !== null) {
      li.append(...celdas(rutina, semana, hoy))
      const cuenta: HTMLElement = elemento("span", weekSummary(f.done, f.goal, f.met))
      cuenta.className = "rutina-cuenta"
      cuenta.classList.toggle("cumplida", f.met)
      li.append(cuenta)
      const tocadaAhora: boolean = tocada === f.id
      li.classList.toggle("tocada", tocadaAhora)
      li.setAttribute("aria-current", tocadaAhora ? "true" : "false")
      /* Tocar la fila, donde no haya un botón, la toca o la suelta. */
      li.addEventListener("click", (e: MouseEvent): void => {
        if (e.target instanceof Element && e.target.closest("button") !== null) return
        tocada = tocada === f.id ? null : f.id
        pintar()
        onTouched()
      })
    }
    return li
  }

  const pintar = (): void => {
    const todas: RoutineList = filas()
    const hoy: Day | null = today()
    const primera: RoutineRow | undefined = todas.visible[0]
    const rutina: Routine | undefined =
      primera === undefined ? undefined : store.getState().routines[primera.id as RoutineId]
    const semana: WeekRow | null = hoy === null || rutina === undefined ? null : currentWeek(rutina, hoy)
    lista.replaceChildren(...todas.visible.map((f: RoutineRow): HTMLLIElement => fila(f, hoy)))
    cabeza.replaceChildren(...(hoy === null || semana === null ? [] : [cabecera(semana, hoy)]))
    archivadas.replaceChildren(...todas.archived.map((f: RoutineRow): HTMLLIElement => fila(f, null)))
    archivadas.hidden = !verArchivadas || todas.archived.length === 0
    const botones: HTMLButtonElement[] = [boton("+ Rutina", abrirNueva, "secundario grupo-nuevo")]
    if (todas.archived.length > 0) {
      botones.push(
        boton(
          `${verArchivadas ? "▾" : "▸"} Archivadas (${todas.archived.length})`,
          (): void => {
            verArchivadas = !verArchivadas
            pintar()
          },
          "secundario grupo-ver-archivados",
        ),
      )
    }
    pie.replaceChildren(...botones)
  }

  /* ── Mover una fila ── */

  const soltarArrastre: () => void = attachDragReorder(lista, {
    fichas: "li.grupo",
    ignorar: "button:not(.rutina-nombre)",
    eje: "y",
    onMove: (de: number, a: number): void => {
      const todas: RoutineList = filas()
      const nuevo: ReadonlyArray<string> = movedOrder(
        todas.visible.map((f: RoutineRow): string => f.id),
        todas.archived.map((f: RoutineRow): string => f.id),
        de,
        a,
      )
      const guardado: ReturnType<CalendarOrderPersistence["save"]> = calendarOrder.save({
        ...leerOrden(),
        routines: nuevo,
      })
      if (!guardado.ok) logger.failure("no se guardó el orden de las rutinas", guardado.error)
      pintar()
    },
  })

  /* ── La hoja: nueva rutina y el menú de una ── */

  /** Las metas posibles: «Sin meta» y de 1 a 7 días a la semana. */
  const campoMeta = (actual: number | null, alElegir: (meta: number | null) => void): HTMLElement => {
    const opciones: HTMLElement = elemento("div")
    opciones.className = "rutina-metas"
    const metas: ReadonlyArray<number | null> = [null, 1, 2, 3, 4, 5, 6, 7]
    const botones: ReadonlyArray<HTMLButtonElement> = metas.map(
      (m: number | null): HTMLButtonElement =>
        boton(
          m === null ? "Sin meta" : String(m),
          (): void => {
            alElegir(m)
            marcar(m)
          },
          "rutina-meta",
        ),
    )
    const marcar = (elegida: number | null): void => {
      botones.forEach((b: HTMLButtonElement, i: number): void => {
        b.setAttribute("aria-pressed", metas[i] === elegida ? "true" : "false")
      })
    }
    marcar(actual)
    opciones.append(...botones)
    return opciones
  }

  const abrirNueva = (): void => {
    let meta: number | null = null
    const entrada: HTMLInputElement = elemento("input")
    entrada.placeholder = "Nombre"
    const crear = (): void => {
      const nombre: string = entrada.value.trim()
      if (nombre === "") return
      useCases.createRoutine(nombre, meta)
      hoja.close()
    }
    entrada.addEventListener("keydown", (e: KeyboardEvent): void => {
      if (e.key === "Enter") crear()
    })
    caja.replaceChildren(
      elemento("h2", "Rutina nueva"),
      entrada,
      elemento("p", "Días a la semana"),
      campoMeta(null, (m: number | null): void => {
        meta = m
      }),
      boton("Crear", crear, "hoja-nuevo"),
    )
    hoja.open("", [caja])
  }

  const abrirMenu = (f: RoutineRow): void => {
    const id: RoutineId = f.id as RoutineId
    const renombrar: HTMLButtonElement = boton(
      "Renombrar",
      (): void => {
        const entrada: HTMLInputElement = elemento("input")
        entrada.placeholder = "Nombre"
        entrada.value = f.name
        const guardar = (): void => {
          const nombre: string = entrada.value.trim()
          if (nombre === "") return
          useCases.renameRoutine(id, nombre)
          hoja.close()
        }
        entrada.addEventListener("keydown", (e: KeyboardEvent): void => {
          if (e.key === "Enter") guardar()
        })
        caja.replaceChildren(elemento("h2", f.name), entrada, boton("Guardar", guardar, "hoja-nuevo"))
      },
      "hoja-nuevo",
    )
    const meta: HTMLButtonElement = boton(
      "Cambiar meta",
      (): void => {
        caja.replaceChildren(
          elemento("h2", f.name),
          elemento("p", "Días a la semana"),
          campoMeta(f.goal, (m: number | null): void => void useCases.setRoutineGoal(id, m)),
        )
      },
      "hoja-nuevo",
    )
    const archivar: HTMLButtonElement = boton(
      f.archived ? "Desarchivar" : "Archivar",
      (): void => {
        const orden: CalendarOrder = leerOrden()
        /* Las que ya no existen se podan al guardar. */
        const archivadas: ReadonlyArray<string> = (f.archived ? orden.archived.filter((x: string): boolean => x !== id) : [...orden.archived, id])
          .filter((x: string): boolean => store.getState().routines[x as RoutineId] !== undefined)
        const guardado: ReturnType<CalendarOrderPersistence["save"]> = calendarOrder.save({ ...orden, archived: archivadas })
        if (!guardado.ok) logger.failure("no se guardó lo archivado", guardado.error)
        hoja.close()
        pintar()
        onTouched()
      },
      "hoja-nuevo",
    )
    const borrar: HTMLButtonElement = boton(
      "Borrar",
      (): void => {
        const dias: number = store.getState().routines[id]?.days.length ?? 0
        confirm(
          `¿Borrar la rutina «${f.name}»? Se pierden sus ${dias} días marcados y no se puede deshacer. Para apartarla sin perderlos, archívala.`,
          "Borrar",
          (): void => {
            useCases.deleteRoutine(id)
            hoja.close()
          },
        )
      },
      "hoja-peligro",
    )
    const opciones: HTMLElement = elemento("div")
    opciones.className = "hoja-nuevos"
    opciones.append(renombrar, meta, archivar, borrar)
    caja.replaceChildren(elemento("h2", f.name), opciones)
    hoja.open("", [caja])
  }

  pintar()

  return {
    element: raiz,
    touched: (): ReadonlySet<string> => touchedRoutineIds(filas(), tocada),
    update: pintar,
    touch: (id: RoutineId): void => {
      tocada = id
      pintar()
      onTouched()
      raiz.querySelector(`[data-id="${CSS.escape(id)}"]`)?.scrollIntoView({ block: "nearest" })
    },
    destroy: soltarArrastre,
  }
}
