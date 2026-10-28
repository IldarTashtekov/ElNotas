/**
 * La lista de grupos de eventos bajo el mes: una redonda para elegir cuáles
 * pintan el mes, «Sin grupo» como un grupo más, el menú ⋮ de cada grupo, los
 * eventos de cada uno por tiempo con los pasados plegados, y los archivados
 * en una vista aparte. Mantener pulsada una fila la mueve.
 *
 * Qué filas hay y en qué orden lo calcula `groupList`; aquí sólo se pinta, se
 * escucha y se guarda el orden.
 */

import type { AppState, CalendarEvent, Day, EventGroupId, Logger, Store, UseCases } from "#core/index"
import type { BackStack } from "./backStack.js"
import type { CalendarOrder, CalendarOrderPersistence } from "./calendarOrder.js"
import { NO_ORDER, parseCalendarOrder, SIN_GRUPO } from "./calendarOrder.js"
import { attachDragReorder } from "./dragReorder.js"
import { elemento } from "./dom.js"
import type { GroupList, GroupRow } from "./groupList.js"
import { chosenIds, eventsOfGroup, groupList, movedOrder, splitPast, toggleId } from "./groupList.js"
import type { Confirm, Sheet } from "./sheet.js"
import { createSheet } from "./sheet.js"

export interface GroupsPanelDeps {
  readonly store: Store
  readonly useCases: UseCases
  readonly back: BackStack
  readonly confirm: Confirm
  readonly today: () => Day | null
  readonly calendarOrder: CalendarOrderPersistence
  readonly logger: Logger
  /** Cambió qué grupos están elegidos: el mes se vuelve a pintar. */
  readonly onChosen: () => void
  /** Se pulsó un evento de la lista de un grupo: se abre para editarlo. */
  readonly onOpenEvent: (evento: CalendarEvent) => void
}

export interface GroupsPanel {
  readonly element: HTMLElement
  /** Los grupos que pintan el mes ahora. */
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

export const createGroupsPanel = ({
  store,
  useCases,
  back,
  confirm,
  today,
  calendarOrder,
  logger,
  onChosen,
  onOpenEvent,
}: GroupsPanelDeps): GroupsPanel => {
  /* Estado de pantalla: nada de esto se guarda. */
  let apagados: ReadonlySet<string> = new Set<string>()
  const abiertos: Set<string> = new Set<string>()
  const pasadosAbiertos: Set<string> = new Set<string>()
  let verArchivados: boolean = false

  const raiz: HTMLElement = elemento("section")
  raiz.className = "grupos"
  const lista: HTMLUListElement = elemento("ul")
  lista.className = "grupos-lista"
  const archivados: HTMLUListElement = elemento("ul")
  archivados.className = "grupos-lista grupos-archivados"
  const pie: HTMLElement = elemento("div")
  pie.className = "grupos-pie"
  const hoja: Sheet = createSheet(back)
  const caja: HTMLElement = elemento("div")
  caja.className = "grupo-hoja"
  raiz.append(lista, archivados, pie, hoja.element)

  const leerOrden = (): CalendarOrder => {
    const leido: ReturnType<CalendarOrderPersistence["load"]> = calendarOrder.load()
    return leido.ok ? parseCalendarOrder(leido.value) : NO_ORDER
  }
  const filas = (): GroupList => groupList(store.getState(), leerOrden())

  /* ── Las filas ── */

  const eventosDe = (fila: GroupRow): HTMLElement => {
    const estado: AppState = store.getState()
    const { upcoming, past } = splitPast(eventsOfGroup(estado, fila.id), today())
    const linea = (e: CalendarEvent): HTMLButtonElement =>
      boton(
        `${e.done ? "☑ " : ""}${e.day}${e.time === undefined ? "" : ` ${e.time}`} ${e.title}`,
        (): void => onOpenEvent(e),
        "grupo-evento",
      )
    const contenido: HTMLElement = elemento("div")
    contenido.className = "grupo-eventos"
    if (upcoming.length === 0 && past.length === 0) contenido.append(elemento("p", "Sin eventos."))
    contenido.append(...upcoming.map(linea))
    if (past.length > 0) {
      const abierto: boolean = pasadosAbiertos.has(fila.id)
      contenido.append(
        boton(
          `${abierto ? "▾" : "▸"} Pasados (${past.length})`,
          (): void => {
            if (abierto) pasadosAbiertos.delete(fila.id)
            else pasadosAbiertos.add(fila.id)
            pintar()
          },
          "grupo-pasados",
        ),
      )
      if (abierto) contenido.append(...past.map(linea))
    }
    return contenido
  }

  const fila = (f: GroupRow, elegible: boolean): HTMLLIElement => {
    const li: HTMLLIElement = elemento("li")
    li.className = "grupo"
    li.classList.toggle("archivado", f.archived)
    li.dataset["id"] = f.id
    const cabeza: HTMLElement = elemento("div")
    cabeza.className = "grupo-cabeza"
    if (elegible) {
      const elegido: boolean = !apagados.has(f.id)
      const redonda: HTMLButtonElement = boton(
        elegido ? "●" : "○",
        (): void => {
          apagados = toggleId(apagados, f.id)
          pintar()
          onChosen()
        },
        "grupo-redonda",
      )
      redonda.setAttribute("aria-pressed", elegido ? "true" : "false")
      redonda.setAttribute("aria-label", `Mostrar ${f.name} en el mes`)
      cabeza.append(redonda)
    }
    const abierto: boolean = abiertos.has(f.id)
    const nombre: HTMLButtonElement = boton(
      `${f.name} · ${f.count}`,
      (): void => {
        if (abierto) abiertos.delete(f.id)
        else abiertos.add(f.id)
        pintar()
      },
      "grupo-nombre",
    )
    nombre.setAttribute("aria-expanded", abierto ? "true" : "false")
    cabeza.append(nombre)
    if (f.id !== SIN_GRUPO) {
      const menu: HTMLButtonElement = boton("⋮", (): void => abrirMenu(f), "grupo-menu")
      menu.setAttribute("aria-label", `Opciones de ${f.name}`)
      cabeza.append(menu)
    }
    li.append(cabeza)
    if (abierto) li.append(eventosDe(f))
    return li
  }

  const pintar = (): void => {
    const todos: GroupList = filas()
    lista.replaceChildren(...todos.visible.map((f: GroupRow): HTMLLIElement => fila(f, true)))
    archivados.replaceChildren(...todos.archived.map((f: GroupRow): HTMLLIElement => fila(f, false)))
    archivados.hidden = !verArchivados || todos.archived.length === 0
    const botones: HTMLButtonElement[] = [boton("+ Grupo", abrirNuevo, "secundario grupo-nuevo")]
    if (todos.archived.length > 0) {
      botones.push(
        boton(
          `${verArchivados ? "▾" : "▸"} Archivados (${todos.archived.length})`,
          (): void => {
            verArchivados = !verArchivados
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
      const todos: GroupList = filas()
      const nuevo: ReadonlyArray<string> = movedOrder(
        todos.visible.map((f: GroupRow): string => f.id),
        todos.archived.map((f: GroupRow): string => f.id),
        de,
        a,
      )
      const guardado: ReturnType<CalendarOrderPersistence["save"]> = calendarOrder.save({
        ...leerOrden(),
        groups: nuevo,
      })
      if (!guardado.ok) logger.failure("no se guardó el orden de los grupos", guardado.error)
      pintar()
    },
  })

  /* ── La hoja: nuevo grupo, y el menú de uno ── */

  const campoNombre = (valor: string, alGuardar: (nombre: string) => void, texto: string): HTMLElement[] => {
    const entrada: HTMLInputElement = elemento("input")
    entrada.placeholder = "Nombre"
    entrada.value = valor
    const guardar = (): void => {
      const nombre: string = entrada.value.trim()
      if (nombre === "") return
      alGuardar(nombre)
      hoja.close()
    }
    entrada.addEventListener("keydown", (e: KeyboardEvent): void => {
      if (e.key === "Enter") guardar()
    })
    return [entrada, boton(texto, guardar, "hoja-nuevo")]
  }

  const abrirNuevo = (): void => {
    caja.replaceChildren(
      elemento("h2", "Grupo nuevo"),
      ...campoNombre("", (nombre: string): void => void useCases.createEventGroup(nombre), "Crear"),
    )
    hoja.open("", [caja])
  }

  const abrirMenu = (f: GroupRow): void => {
    const id: EventGroupId = f.id as EventGroupId
    const renombrar: HTMLButtonElement = boton(
      "Renombrar",
      (): void => {
        caja.replaceChildren(
          elemento("h2", f.name),
          ...campoNombre(f.name, (nombre: string): void => void useCases.renameEventGroup(id, nombre), "Guardar"),
        )
      },
      "hoja-nuevo",
    )
    const archivar: HTMLButtonElement = boton(
      f.archived ? "Desarchivar" : "Archivar",
      (): void => {
        useCases.setEventGroupArchived(id, !f.archived)
        hoja.close()
      },
      "hoja-nuevo",
    )
    const borrar: HTMLButtonElement = boton(
      "Borrar",
      (): void => {
        confirm(`¿Borrar el grupo «${f.name}»? Sus eventos no se borran.`, "Borrar", (): void => {
          useCases.deleteEventGroup(id)
          hoja.close()
        })
      },
      "hoja-peligro",
    )
    const opciones: HTMLElement = elemento("div")
    opciones.className = "hoja-nuevos"
    opciones.append(renombrar, archivar, borrar)
    caja.replaceChildren(elemento("h2", f.name), opciones)
    hoja.open("", [caja])
  }

  pintar()

  return {
    element: raiz,
    chosen: (): ReadonlySet<string> => chosenIds(filas(), apagados),
    update: pintar,
    destroy: soltarArrastre,
  }
}
