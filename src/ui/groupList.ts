/**
 * La lista de grupos de eventos, sin DOM: sus filas en el orden guardado con
 * «Sin grupo» entre ellas, cuáles están elegidas, a dónde va una fila que se
 * mueve, y los eventos de un grupo por tiempo con los pasados aparte.
 *
 * El orden es de presentación (`calendarOrder`); aquí sólo se lee y se calcula.
 */

import type { AppState, CalendarEvent, Day, EventGroup, EventId } from "#core/index"
import { compareDays, eventsWithoutGroup } from "#core/index"
import type { CalendarOrder } from "./calendarOrder.js"
import { reconcileOrder, SIN_GRUPO } from "./calendarOrder.js"

export const SIN_GRUPO_NAME: string = "Sin grupo"

export interface GroupRow {
  /** `SIN_GRUPO` o el id del grupo. */
  readonly id: string
  readonly name: string
  readonly archived: boolean
  /** Cuántos eventos tiene. */
  readonly count: number
}

export interface GroupList {
  /** Los que se ven, en su orden; «Sin grupo» siempre está. */
  readonly visible: ReadonlyArray<GroupRow>
  /** Los archivados, en su orden, para la vista de archivados. */
  readonly archived: ReadonlyArray<GroupRow>
}

/** Antes de lo más tarde: por día, luego por hora (sin hora, primero) y por motivo. */
const porTiempo = (a: CalendarEvent, b: CalendarEvent): number => {
  const dias: number = compareDays(a.day, b.day)
  if (dias !== 0) return dias
  const horas: number = (a.time ?? "").localeCompare(b.time ?? "")
  return horas !== 0 ? horas : a.title.localeCompare(b.title)
}

/** Los eventos de un grupo, o los de «Sin grupo», por tiempo. */
export const eventsOfGroup = (state: AppState, id: string): ReadonlyArray<CalendarEvent> => {
  const eventos: ReadonlyArray<CalendarEvent> =
    id === SIN_GRUPO
      ? eventsWithoutGroup(state)
      : (state.eventGroups[id as EventGroup["id"]]?.events ?? []).flatMap(
          (e: EventId): ReadonlyArray<CalendarEvent> => {
            const evento: CalendarEvent | undefined = state.events[e]
            return evento === undefined ? [] : [evento]
          },
        )
  return [...eventos].sort(porTiempo)
}

export const groupList = (state: AppState, order: CalendarOrder): GroupList => {
  const grupos: ReadonlyArray<EventGroup> = Object.values<EventGroup>(state.eventGroups)
  const ids: ReadonlyArray<string> = reconcileOrder(order.groups, [
    SIN_GRUPO,
    ...grupos.map((g: EventGroup): string => g.id).sort(),
  ])
  const filas: ReadonlyArray<GroupRow> = ids.map((id: string): GroupRow => {
    if (id === SIN_GRUPO) {
      return { id, name: SIN_GRUPO_NAME, archived: false, count: eventsWithoutGroup(state).length }
    }
    const g: EventGroup | undefined = state.eventGroups[id as EventGroup["id"]]
    return { id, name: g?.name ?? "", archived: g?.archived === true, count: g?.events.length ?? 0 }
  })
  return {
    visible: filas.filter((f: GroupRow): boolean => !f.archived),
    archived: filas.filter((f: GroupRow): boolean => f.archived),
  }
}

/** Los grupos que pintan el mes: los visibles que no se han apagado. Los archivados nunca. */
export const chosenIds = (lista: GroupList, apagados: ReadonlySet<string>): ReadonlySet<string> =>
  new Set<string>(
    lista.visible.map((f: GroupRow): string => f.id).filter((id: string): boolean => !apagados.has(id)),
  )

/** Enciende o apaga uno: un conjunto nuevo. */
export const toggleId = (ids: ReadonlySet<string>, id: string): ReadonlySet<string> => {
  const otro: Set<string> = new Set<string>(ids)
  if (otro.has(id)) otro.delete(id)
  else otro.add(id)
  return otro
}

/**
 * El orden que se guarda al mover una fila visible de `de` a `a`: las visibles
 * como quedan, y detrás las archivadas como estaban.
 */
export const movedOrder = (
  visibles: ReadonlyArray<string>,
  archivados: ReadonlyArray<string>,
  de: number,
  a: number,
): ReadonlyArray<string> => {
  const movido: string | undefined = visibles[de]
  if (movido === undefined) return [...visibles, ...archivados]
  const resto: ReadonlyArray<string> = visibles.filter((_: string, i: number): boolean => i !== de)
  return [...resto.slice(0, a), movido, ...resto.slice(a), ...archivados]
}

/** Los de hoy en adelante y los pasados. Sin «hoy» (fuera de rango), todo es futuro. */
export const splitPast = (
  eventos: ReadonlyArray<CalendarEvent>,
  hoy: Day | null,
): { readonly upcoming: ReadonlyArray<CalendarEvent>; readonly past: ReadonlyArray<CalendarEvent> } => {
  if (hoy === null) return { upcoming: eventos, past: [] }
  return {
    upcoming: eventos.filter((e: CalendarEvent): boolean => compareDays(e.day, hoy) >= 0),
    past: eventos.filter((e: CalendarEvent): boolean => compareDays(e.day, hoy) < 0),
  }
}
