/**
 * Lo que enseña el calendario, sin DOM: la rejilla del mes con sus días marcados,
 * el cambio de mes y los eventos de un día en su orden.
 */

import { test } from "node:test"
import assert from "node:assert/strict"

import type { AppState, CalendarEvent, Day, EventGroup, Time } from "#core/index"
import { parseDay, parseTime } from "#core/index"
import { emptyAppState } from "#core/domain/AppState"
import { eventGroupId, eventId } from "#core/domain/Ids"
import { revision } from "#core/domain/Ids"
import type { DayCell, MonthRef, MonthView } from "#ui/calendarMonth"
import { SIN_GRUPO } from "#ui/calendarOrder"
import {
  dayTitle,
  eventsOfDay,
  isChosen,
  monthOf,
  monthTitle,
  monthView,
  sameMonth,
  shiftMonth,
} from "#ui/calendarMonth"

const dia = (texto: string): Day => {
  const d: Day | null = parseDay(texto)
  if (d === null) throw new Error(`día inválido: ${texto}`)
  return d
}

const horaDe = (texto: string): Time => {
  const t: Time | null = parseTime(texto)
  if (t === null) throw new Error(`hora inválida: ${texto}`)
  return t
}

const evento = (id: string, day: string, title: string, time?: string, done: boolean = false): CalendarEvent => ({
  id: eventId(id),
  day: dia(day),
  ...(time === undefined ? {} : { time: horaDe(time) }),
  title,
  done,
  updatedAt: 0,
  revision: revision(`rev-${id}`),
})

const grupo = (id: string, name: string, events: ReadonlyArray<string>): EventGroup => ({
  id: eventGroupId(id),
  name,
  events: events.map(eventId),
  updatedAt: 0,
  revision: revision(`rev-${id}`),
})

const estado = (eventos: ReadonlyArray<CalendarEvent>, grupos: ReadonlyArray<EventGroup> = []): AppState => ({
  ...emptyAppState(),
  events: Object.fromEntries(eventos.map((e: CalendarEvent): [string, CalendarEvent] => [e.id, e])),
  eventGroups: Object.fromEntries(grupos.map((g: EventGroup): [string, EventGroup] => [g.id, g])),
})

const celdas = (vista: MonthView): ReadonlyArray<DayCell> => vista.weeks.flat()

const OCTUBRE: MonthRef = { year: 2026, month: 10 }

test("monthView: título, semanas de siete y los días vecinos apagados", (): void => {
  const vista: MonthView | null = monthView(estado([]), OCTUBRE, null, null)
  assert.ok(vista !== null)
  assert.equal(vista.title, "octubre de 2026")
  assert.ok(vista.weeks.every((s: ReadonlyArray<DayCell>): boolean => s.length === 7))
  /* El 1 de octubre de 2026 es jueves: la primera fila empieza el lunes 28 de septiembre. */
  assert.equal(vista.weeks[0]?.[0]?.day, dia("2026-09-28"))
  assert.equal(vista.weeks[0]?.[0]?.inMonth, false)
  assert.equal(vista.weeks[0]?.[3]?.inMonth, true)
  assert.equal(celdas(vista).filter((c: DayCell): boolean => c.inMonth).length, 31)
})

test("monthView: marca los días con eventos y señala hoy", (): void => {
  const s: AppState = estado([evento("a", "2026-10-05", "Dentista"), evento("b", "2026-10-05", "Cena")])
  const vista: MonthView | null = monthView(s, OCTUBRE, dia("2026-10-28"), null)
  assert.ok(vista !== null)
  const por: ReadonlyMap<string, DayCell> = new Map(celdas(vista).map((c: DayCell): [string, DayCell] => [c.day, c]))
  assert.equal(por.get("2026-10-05")?.marked, true)
  assert.equal(por.get("2026-10-06")?.marked, false)
  assert.equal(por.get("2026-10-28")?.isToday, true)
  assert.equal(por.get("2026-10-27")?.isToday, false)
})

test("monthView: allDone sólo si todos los eventos del día están hechos", (): void => {
  const s: AppState = estado([
    evento("a", "2026-10-05", "A", undefined, true),
    evento("b", "2026-10-05", "B", undefined, false),
    evento("c", "2026-10-06", "C", undefined, true),
  ])
  const vista: MonthView | null = monthView(s, OCTUBRE, null, null)
  assert.ok(vista !== null)
  const por: ReadonlyMap<string, DayCell> = new Map(celdas(vista).map((c: DayCell): [string, DayCell] => [c.day, c]))
  assert.equal(por.get("2026-10-05")?.allDone, false)
  assert.equal(por.get("2026-10-06")?.allDone, true)
  assert.equal(por.get("2026-10-07")?.allDone, false)
})

test("monthView: marca los días de los meses vecinos que se ven", (): void => {
  const s: AppState = estado([evento("a", "2026-09-30", "Ayer")])
  const vista: MonthView | null = monthView(s, OCTUBRE, null, null)
  assert.ok(vista !== null)
  const c: DayCell | undefined = celdas(vista).find((x: DayCell): boolean => x.day === dia("2026-09-30"))
  assert.equal(c?.marked, true)
  assert.equal(c?.inMonth, false)
})

test("monthView: sólo marca los eventos de los grupos elegidos", (): void => {
  const s: AppState = estado(
    [evento("a", "2026-10-05", "A"), evento("b", "2026-10-06", "B"), evento("c", "2026-10-07", "C")],
    [grupo("g1", "Trabajo", ["a"]), grupo("g2", "Casa", ["b"])],
  )
  const vista: MonthView | null = monthView(s, OCTUBRE, null, new Set<string>(["g1"]))
  assert.ok(vista !== null)
  const marcados: ReadonlyArray<string> = celdas(vista)
    .filter((c: DayCell): boolean => c.marked)
    .map((c: DayCell): string => c.day)
  assert.deepEqual(marcados, ["2026-10-05"])
})

test("isChosen: null es todos; sin grupo hace falta «Sin grupo»; en varios, basta uno", (): void => {
  const s: AppState = estado(
    [evento("a", "2026-10-05", "A"), evento("b", "2026-10-05", "B")],
    [grupo("g1", "Uno", ["a"]), grupo("g2", "Dos", ["a"])],
  )
  const a: CalendarEvent | undefined = s.events[eventId("a")]
  const b: CalendarEvent | undefined = s.events[eventId("b")]
  assert.ok(a !== undefined && b !== undefined)
  assert.equal(isChosen(s, a, null), true)
  assert.equal(isChosen(s, b, null), true)
  assert.equal(isChosen(s, b, new Set<string>(["g1"])), false)
  assert.equal(isChosen(s, b, new Set<string>([SIN_GRUPO])), true)
  assert.equal(isChosen(s, a, new Set<string>(["g2"])), true)
  assert.equal(isChosen(s, a, new Set<string>([SIN_GRUPO])), false)
})

test("eventsOfDay: primero los de todo el día, luego por hora y por motivo", (): void => {
  const s: AppState = estado([
    evento("a", "2026-10-05", "Zeta", "18:00"),
    evento("b", "2026-10-05", "Beta", "09:30"),
    evento("c", "2026-10-05", "Todo el día"),
    evento("d", "2026-10-05", "Alfa", "09:30"),
    evento("e", "2026-10-06", "Otro día"),
  ])
  const titulos: ReadonlyArray<string> = eventsOfDay(s, dia("2026-10-05")).map((e: CalendarEvent): string => e.title)
  assert.deepEqual(titulos, ["Todo el día", "Alfa", "Beta", "Zeta"])
})

test("shiftMonth cruza el año hacia delante y hacia atrás", (): void => {
  assert.deepEqual(shiftMonth({ year: 2026, month: 12 }, 1), { year: 2027, month: 1 })
  assert.deepEqual(shiftMonth({ year: 2026, month: 1 }, -1), { year: 2025, month: 12 })
  assert.deepEqual(shiftMonth(OCTUBRE, 0), OCTUBRE)
  assert.deepEqual(shiftMonth(OCTUBRE, 14), { year: 2027, month: 12 })
})

test("shiftMonth: fuera del rango de años, null", (): void => {
  assert.equal(shiftMonth({ year: 1, month: 1 }, -1), null)
  assert.equal(shiftMonth({ year: 9999, month: 12 }, 1), null)
})

test("monthOf, sameMonth y los títulos", (): void => {
  assert.deepEqual(monthOf(dia("2026-07-02")), { year: 2026, month: 7 })
  assert.equal(sameMonth({ year: 2026, month: 7 }, monthOf(dia("2026-07-31"))), true)
  assert.equal(sameMonth({ year: 2026, month: 7 }, { year: 2025, month: 7 }), false)
  assert.equal(monthTitle({ year: 2026, month: 1 }), "enero de 2026")
  assert.equal(dayTitle(dia("2026-07-02")), "2 de julio de 2026")
})
