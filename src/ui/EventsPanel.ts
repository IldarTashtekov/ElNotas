/**
 * La lista de eventos bajo el mes: los de hoy en adelante por tiempo, los
 * pasados plegados aparte, y un botón para crear uno. Pulsar un evento lo abre
 * para editarlo.
 *
 * Qué eventos hay y en qué orden lo calcula `eventList`; aquí sólo se pinta.
 */

import type { CalendarEvent, Day, Store } from "#core/index"
import { elemento } from "./dom.js"
import { eventsByTime, splitPast } from "./eventList.js"

export interface EventsPanelDeps {
  readonly store: Store
  readonly today: () => Day | null
  /** Se pulsó un evento: se abre para editarlo. */
  readonly onOpenEvent: (evento: CalendarEvent) => void
  /** Se pulsó «+ Evento». */
  readonly onNewEvent: () => void
}

export interface EventsPanel {
  readonly element: HTMLElement
  /** Repinta con lo que haya en el almacén. */
  readonly update: () => void
}

const boton = (texto: string, alPulsar: () => void, clase: string): HTMLButtonElement => {
  const b: HTMLButtonElement = elemento("button", texto)
  b.type = "button"
  b.className = clase
  b.addEventListener("click", alPulsar)
  return b
}

export const createEventsPanel = ({ store, today, onOpenEvent, onNewEvent }: EventsPanelDeps): EventsPanel => {
  /* Estado de pantalla: nada de esto se guarda. */
  let pasadosAbiertos: boolean = false

  const raiz: HTMLElement = elemento("section")
  raiz.className = "grupos"
  const contenido: HTMLElement = elemento("div")
  contenido.className = "grupo-eventos"
  const pie: HTMLElement = elemento("div")
  pie.className = "grupos-pie"
  pie.append(boton("+ Evento", onNewEvent, "secundario grupo-nuevo"))
  raiz.append(contenido, pie)

  const pintar = (): void => {
    const { upcoming, past } = splitPast(eventsByTime(store.getState()), today())
    const linea = (e: CalendarEvent): HTMLButtonElement =>
      boton(
        `${e.done ? "☑ " : ""}${e.day}${e.time === undefined ? "" : ` ${e.time}`} ${e.title}`,
        (): void => onOpenEvent(e),
        "grupo-evento",
      )
    contenido.replaceChildren()
    if (upcoming.length === 0 && past.length === 0) contenido.append(elemento("p", "Sin eventos."))
    contenido.append(...upcoming.map(linea))
    if (past.length > 0) {
      contenido.append(
        boton(
          `${pasadosAbiertos ? "▾" : "▸"} Pasados (${past.length})`,
          (): void => {
            pasadosAbiertos = !pasadosAbiertos
            pintar()
          },
          "grupo-pasados",
        ),
      )
      if (pasadosAbiertos) contenido.append(...past.map(linea))
    }
  }

  pintar()

  return { element: raiz, update: pintar }
}
