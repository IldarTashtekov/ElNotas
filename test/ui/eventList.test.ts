/**
 * La lista de eventos, sin DOM: todos por tiempo, y los pasados aparte.
 */

import { test } from "node:test"
import assert from "node:assert/strict"

import type { AppState, CalendarEvent, Day, Time } from "#core/index"
import { parseDay, parseTime } from "#core/index"
import { emptyAppState } from "#core/domain/AppState"
import { eventId, revision } from "#core/domain/Ids"
import { eventsByTime, splitPast } from "#ui/eventList"

const dia = (texto: string): Day => {
  const d: Day | null = parseDay(texto)
  if (d === null) throw new Error(`día inválido: ${texto}`)
  return d
}

const hora = (texto: string): Time => {
  const t: Time | null = parseTime(texto)
  if (t === null) throw new Error(`hora inválida: ${texto}`)
  return t
}

const evento = (id: string, day: string, title: string, time?: string): CalendarEvent => ({
  id: eventId(id),
  day: dia(day),
  ...(time === undefined ? {} : { time: hora(time) }),
  title,
  done: false,
  updatedAt: 0,
  revision: revision(`rev-${id}`),
})

test("eventsByTime: por día y hora, con el de todo el día antes", (): void => {
  const eventos: ReadonlyArray<CalendarEvent> = [
    evento("a", "2026-10-06", "Tarde", "18:00"),
    evento("b", "2026-10-06", "Mañana", "09:00"),
    evento("c", "2026-10-06", "Todo el día"),
    evento("d", "2026-10-05", "Antes", "23:00"),
    evento("e", "2026-10-09", "Suelto"),
  ]
  const s: AppState = {
    ...emptyAppState(),
    events: Object.fromEntries(eventos.map((e: CalendarEvent): [string, CalendarEvent] => [e.id, e])),
  }
  assert.deepEqual(
    eventsByTime(s).map((e: CalendarEvent): string => e.title),
    ["Antes", "Todo el día", "Mañana", "Tarde", "Suelto"],
  )
})

test("splitPast: hoy cuenta como futuro; sin «hoy», todo es futuro", (): void => {
  const eventos: ReadonlyArray<CalendarEvent> = [
    evento("a", "2026-10-27", "Ayer"),
    evento("b", "2026-10-28", "Hoy"),
    evento("c", "2026-10-29", "Mañana"),
  ]
  const partido: ReturnType<typeof splitPast> = splitPast(eventos, dia("2026-10-28"))
  assert.deepEqual(partido.past.map((e: CalendarEvent): string => e.title), ["Ayer"])
  assert.deepEqual(partido.upcoming.map((e: CalendarEvent): string => e.title), ["Hoy", "Mañana"])
  assert.equal(splitPast(eventos, null).upcoming, eventos)
  assert.equal(splitPast(eventos, null).past.length, 0)
})
