/**
 * La lista de eventos, sin DOM: todos por tiempo, y los de hoy en adelante
 * aparte de los pasados.
 */

import type { AppState, CalendarEvent, Day } from "#core/index"
import { compareDays } from "#core/index"

/** Antes de lo más tarde: por día, luego por hora (sin hora, primero) y por motivo. */
const porTiempo = (a: CalendarEvent, b: CalendarEvent): number => {
  const dias: number = compareDays(a.day, b.day)
  if (dias !== 0) return dias
  const horas: number = (a.time ?? "").localeCompare(b.time ?? "")
  return horas !== 0 ? horas : a.title.localeCompare(b.title)
}

/** Todos los eventos, por tiempo. */
export const eventsByTime = (state: AppState): ReadonlyArray<CalendarEvent> =>
  Object.values<CalendarEvent>(state.events).sort(porTiempo)

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
