/**
 * La lista de grupos de eventos, sin DOM: sus filas con «Sin grupo», qué grupos
 * pintan el mes, a dónde va una fila movida y los eventos de un grupo por tiempo.
 */

import { test } from "node:test"
import assert from "node:assert/strict"

import type { AppState, CalendarEvent, Day, EventGroup, Time } from "#core/index"
import { parseDay, parseTime } from "#core/index"
import { emptyAppState } from "#core/domain/AppState"
import { eventGroupId, eventId, revision } from "#core/domain/Ids"
import type { CalendarOrder } from "#ui/calendarOrder"
import { NO_ORDER, SIN_GRUPO } from "#ui/calendarOrder"
import type { GroupList, GroupRow } from "#ui/groupList"
import { chosenIds, eventsOfGroup, groupList, movedOrder, splitPast, toggleId } from "#ui/groupList"

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

const grupo = (id: string, name: string, events: ReadonlyArray<string>, archived: boolean = false): EventGroup => ({
  id: eventGroupId(id),
  name,
  events: events.map(eventId),
  ...(archived ? { archived: true as const } : {}),
  updatedAt: 0,
  revision: revision(`rev-${id}`),
})

const estado = (eventos: ReadonlyArray<CalendarEvent>, grupos: ReadonlyArray<EventGroup>): AppState => ({
  ...emptyAppState(),
  events: Object.fromEntries(eventos.map((e: CalendarEvent): [string, CalendarEvent] => [e.id, e])),
  eventGroups: Object.fromEntries(grupos.map((g: EventGroup): [string, EventGroup] => [g.id, g])),
})

const ESTADO: AppState = estado(
  [evento("a", "2026-10-05", "A"), evento("b", "2026-10-06", "B"), evento("c", "2026-10-07", "C")],
  [grupo("g1", "Trabajo", ["a"]), grupo("g2", "Casa", ["b"], true)],
)

const ids = (filas: ReadonlyArray<GroupRow>): ReadonlyArray<string> => filas.map((f: GroupRow): string => f.id)

test("sin orden guardado: «Sin grupo» primero, luego los grupos, y los archivados aparte", (): void => {
  const lista: GroupList = groupList(ESTADO, NO_ORDER)
  assert.deepEqual(ids(lista.visible), [SIN_GRUPO, "g1"])
  assert.deepEqual(ids(lista.archived), ["g2"])
})

test("las filas llevan su nombre y cuántos eventos tienen", (): void => {
  const lista: GroupList = groupList(ESTADO, NO_ORDER)
  assert.deepEqual(
    lista.visible.map((f: GroupRow): [string, number] => [f.name, f.count]),
    [["Sin grupo", 1], ["Trabajo", 1]],
  )
})

test("el orden guardado manda, también para «Sin grupo»", (): void => {
  const orden: CalendarOrder = { groups: ["g1", SIN_GRUPO, "g2"], routines: [] }
  assert.deepEqual(ids(groupList(ESTADO, orden).visible), ["g1", SIN_GRUPO])
})

test("un orden que nombra lo que ya no existe no rompe la lista", (): void => {
  const orden: CalendarOrder = { groups: ["fantasma", "g1"], routines: [] }
  assert.deepEqual(ids(groupList(ESTADO, orden).visible), ["g1", SIN_GRUPO])
})

test("chosenIds: los visibles menos los apagados, y nunca un archivado", (): void => {
  const lista: GroupList = groupList(ESTADO, NO_ORDER)
  assert.deepEqual([...chosenIds(lista, new Set<string>())], [SIN_GRUPO, "g1"])
  assert.deepEqual([...chosenIds(lista, new Set<string>(["g1"]))], [SIN_GRUPO])
  assert.equal(chosenIds(lista, new Set<string>()).has("g2"), false)
})

test("toggleId devuelve un conjunto nuevo y no toca el de entrada", (): void => {
  const antes: ReadonlySet<string> = new Set<string>(["x"])
  assert.deepEqual([...toggleId(antes, "y")], ["x", "y"])
  assert.deepEqual([...toggleId(antes, "x")], [])
  assert.deepEqual([...antes], ["x"])
})

test("movedOrder mueve una fila visible y deja las archivadas detrás", (): void => {
  assert.deepEqual(movedOrder(["a", "b", "c"], ["z"], 0, 2), ["b", "c", "a", "z"])
  assert.deepEqual(movedOrder(["a", "b", "c"], ["z"], 2, 0), ["c", "a", "b", "z"])
  assert.deepEqual(movedOrder(["a", "b", "c"], [], 1, 1), ["a", "b", "c"])
  assert.deepEqual(movedOrder(["a"], [], 5, 0), ["a"])
})

test("eventsOfGroup: por día y hora, con el de todo el día antes; y «Sin grupo» los sueltos", (): void => {
  const s: AppState = estado(
    [
      evento("a", "2026-10-06", "Tarde", "18:00"),
      evento("b", "2026-10-06", "Mañana", "09:00"),
      evento("c", "2026-10-06", "Todo el día"),
      evento("d", "2026-10-05", "Antes", "23:00"),
      evento("e", "2026-10-09", "Suelto"),
    ],
    [grupo("g1", "G", ["a", "b", "c", "d"])],
  )
  assert.deepEqual(
    eventsOfGroup(s, "g1").map((e: CalendarEvent): string => e.title),
    ["Antes", "Todo el día", "Mañana", "Tarde"],
  )
  assert.deepEqual(
    eventsOfGroup(s, SIN_GRUPO).map((e: CalendarEvent): string => e.title),
    ["Suelto"],
  )
  assert.deepEqual(eventsOfGroup(s, "no-existe"), [])
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
