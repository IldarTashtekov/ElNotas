import type { Day, Time } from "./calendar.js"
import type { EventId } from "./Ids.js"
import type { Versioned } from "./Versioned.js"

/**
 * Algo que pasa un día, con una hora opcional.
 *
 * El día y la hora son textos del calendario, no instantes (`calendar.ts`). El
 * motivo puede ser cualquier texto, también vacío: lo que se exige al escribirlo
 * lo decide la pantalla. A qué grupos pertenece no se guarda aquí sino en cada
 * `EventGroup`, como un contexto guarda sus elementos.
 */
export interface CalendarEvent extends Versioned {
  readonly id: EventId
  readonly day: Day
  /** Sin hora, el evento es de todo el día. */
  readonly time?: Time
  readonly title: string
  readonly done: boolean
}
