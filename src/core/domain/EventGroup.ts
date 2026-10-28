import type { AppState } from "./AppState.js"
import type { CalendarEvent } from "./CalendarEvent.js"
import type { EventGroupId, EventId } from "./Ids.js"
import type { Versioned } from "./Versioned.js"

/**
 * Agrupa eventos. Un evento puede estar en varios grupos, o en ninguno.
 *
 * La pertenencia va aquí, como `Context.items`: `events` son referencias, y un
 * grupo nunca referencia un evento que no existe (lo mantienen el reducer y el
 * arranque). Borrar un grupo no borra sus eventos.
 */
export interface EventGroup extends Versioned {
  readonly id: EventGroupId
  readonly name: string
  readonly events: ReadonlyArray<EventId>
  /**
   * Apartado de la lista, sin dejar de existir. Ausente es «no archivado», y el
   * campo sólo existe cuando vale `true`: así lo guardado antes no se migra.
   */
  readonly archived?: true
}

/**
 * Los eventos que no están en ningún grupo: lo que la pantalla enseña como
 * «Sin grupo». No es una entidad, es esto: una vista derivada.
 */
export const eventsWithoutGroup = (state: AppState): ReadonlyArray<CalendarEvent> => {
  const agrupados: Set<EventId> = new Set<EventId>(
    Object.values<EventGroup>(state.eventGroups).flatMap(
      (g: EventGroup): ReadonlyArray<EventId> => g.events,
    ),
  )
  return Object.values<CalendarEvent>(state.events).filter(
    (e: CalendarEvent): boolean => !agrupados.has(e.id),
  )
}

/** Los grupos a los que pertenece un evento. */
export const groupsOfEvent = (state: AppState, id: EventId): ReadonlyArray<EventGroup> =>
  Object.values<EventGroup>(state.eventGroups).filter((g: EventGroup): boolean =>
    g.events.includes(id),
  )
