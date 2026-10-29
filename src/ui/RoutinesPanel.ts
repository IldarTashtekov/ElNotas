/**
 * La lista de rutinas bajo el mes: una redonda para elegir cuáles pintan sus
 * días marcados en el mes, y al abrir una, los siete días de la semana de hoy,
 * que se marcan pulsándolos. El menú ⋮ renombra, cambia la meta, archiva y
 * borra; las archivadas van en una vista aparte. Mantener pulsada una fila la
 * mueve.
 *
 * Qué filas hay y cómo va la semana lo calcula `routineList`; aquí sólo se
 * pinta, se escucha y se guarda el orden.
 */

import type { Day, Logger, Routine, RoutineId, Store, UseCases } from "#core/index"
import type { BackStack } from "./backStack.js"
import type { CalendarOrder, CalendarOrderPersistence } from "./calendarOrder.js"
import { NO_ORDER, parseCalendarOrder } from "./calendarOrder.js"
import { WEEKDAYS } from "./calendarMonth.js"
import { attachDragReorder } from "./dragReorder.js"
import { elemento } from "./dom.js"
import type { RoutineList, RoutineRow, WeekCell, WeekRow } from "./routineList.js"
import { chosenRoutineIds, currentWeek, movedOrder, routineList, toggleId, weekSummary } from "./routineList.js"
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
  /** Cambió qué rutinas están elegidas: el mes se vuelve a pintar. */
  readonly onChosen: () => void
}

export interface RoutinesPanel {
  readonly element: HTMLElement
  /** Las rutinas que pintan el mes ahora. */
  readonly chosen: () => ReadonlySet<string>
  /** Repinta con lo que haya en el almacén. */
  readonly update: () => void
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
  onChosen,
}: RoutinesPanelDeps): RoutinesPanel => {
  /* Estado de pantalla: nada de esto se guarda. Al empezar ninguna pinta el mes. */
  let encendidas: ReadonlySet<string> = new Set<string>()
  const abiertas: Set<string> = new Set<string>()
  let verArchivadas: boolean = false

  const raiz: HTMLElement = elemento("section")
  raiz.className = "grupos rutinas"
  const lista: HTMLUListElement = elemento("ul")
  lista.className = "grupos-lista"
  const archivadas: HTMLUListElement = elemento("ul")
  archivadas.className = "grupos-lista grupos-archivados"
  const pie: HTMLElement = elemento("div")
  pie.className = "grupos-pie"
  const hoja: Sheet = createSheet(back)
  const caja: HTMLElement = elemento("div")
  caja.className = "grupo-hoja"
  raiz.append(lista, archivadas, pie, hoja.element)

  const leerOrden = (): CalendarOrder => {
    const leido: ReturnType<CalendarOrderPersistence["load"]> = calendarOrder.load()
    return leido.ok ? parseCalendarOrder(leido.value) : NO_ORDER
  }
  const filas = (): RoutineList => routineList(store.getState(), leerOrden(), today())

  /* ── Las semanas de una rutina ── */

  const semana = (r: Routine, s: WeekRow, hoy: Day): HTMLElement => {
    const fila: HTMLElement = elemento("div")
    fila.className = "rutina-semana"
    fila.classList.toggle("cumplida", s.met)
    fila.append(elemento("span", "Esta semana"))
    fila.lastElementChild?.classList.add("rutina-rotulo")
    const dias: HTMLElement = elemento("div")
    dias.className = "rutina-dias"
    dias.append(
      ...s.cells.map((c: WeekCell, i: number): HTMLButtonElement => {
        const b: HTMLButtonElement = boton(
          `${WEEKDAYS[i] ?? ""}${c.marked ? "●" : "○"}`,
          (): void => void useCases.setRoutineDay(r.id, c.day, !c.marked, hoy),
          "rutina-dia",
        )
        b.disabled = c.future && !c.marked
        b.classList.toggle("marcado", c.marked)
        b.setAttribute("aria-pressed", c.marked ? "true" : "false")
        b.setAttribute("aria-label", `${r.name}, ${c.day}`)
        return b
      }),
    )
    fila.append(dias, elemento("span", weekSummary(s.done, s.goal, s.met)))
    fila.lastElementChild?.classList.add("rutina-cuenta")
    return fila
  }

  /* Cada rutina enseña sólo los siete días de la semana de hoy; el resto, en el mes. */
  const semanaDe = (r: Routine): HTMLElement => {
    const hoy: Day | null = today()
    const contenido: HTMLElement = elemento("div")
    contenido.className = "grupo-eventos rutina-semanas"
    const actual: WeekRow | null = hoy === null ? null : currentWeek(r, hoy)
    if (hoy !== null && actual !== null) contenido.append(semana(r, actual, hoy))
    return contenido
  }

  /* ── Las filas ── */

  const fila = (f: RoutineRow, elegible: boolean): HTMLLIElement => {
    const li: HTMLLIElement = elemento("li")
    li.className = "grupo"
    li.classList.toggle("archivado", f.archived)
    li.dataset["id"] = f.id
    const cabeza: HTMLElement = elemento("div")
    cabeza.className = "grupo-cabeza"
    if (elegible) {
      const elegida: boolean = encendidas.has(f.id)
      const redonda: HTMLButtonElement = boton(
        elegida ? "●" : "○",
        (): void => {
          encendidas = toggleId(encendidas, f.id)
          pintar()
          onChosen()
        },
        "grupo-redonda",
      )
      redonda.setAttribute("aria-pressed", elegida ? "true" : "false")
      redonda.setAttribute("aria-label", `Mostrar ${f.name} en el mes`)
      cabeza.append(redonda)
    }
    const abierta: boolean = abiertas.has(f.id)
    const nombre: HTMLButtonElement = boton(
      `${f.name} · ${weekSummary(f.done, f.goal, f.met)}`,
      (): void => {
        if (abierta) abiertas.delete(f.id)
        else abiertas.add(f.id)
        pintar()
      },
      "grupo-nombre",
    )
    nombre.setAttribute("aria-expanded", abierta ? "true" : "false")
    const menu: HTMLButtonElement = boton("⋮", (): void => abrirMenu(f), "grupo-menu")
    menu.setAttribute("aria-label", `Opciones de ${f.name}`)
    cabeza.append(nombre, menu)
    li.append(cabeza)
    const rutina: Routine | undefined = store.getState().routines[f.id as RoutineId]
    if (abierta && rutina !== undefined) li.append(semanaDe(rutina))
    return li
  }

  const pintar = (): void => {
    const todas: RoutineList = filas()
    lista.replaceChildren(...todas.visible.map((f: RoutineRow): HTMLLIElement => fila(f, true)))
    archivadas.replaceChildren(...todas.archived.map((f: RoutineRow): HTMLLIElement => fila(f, false)))
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
    ignorar: "button:not(.grupo-nombre)",
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
        useCases.setRoutineArchived(id, !f.archived)
        hoja.close()
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
    chosen: (): ReadonlySet<string> => chosenRoutineIds(filas(), encendidas),
    update: pintar,
    destroy: soltarArrastre,
  }
}
