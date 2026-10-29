/**
 * Las cuatro acciones de los eventos del calendario, `diffState` con su clase y
 * los casos de uso.
 *
 * Lo que se vigila, como en las demás acciones: que un no-op devuelva **el mismo
 * estado** (`strictEqual`, nunca `deepEqual`).
 */

import { test } from "node:test"
import assert from "node:assert/strict"

import type { AppState } from "#core/domain/AppState"
import type { Day, Time } from "#core/domain/calendar"
import { parseDay, parseTime } from "#core/domain/calendar"
import type { CalendarEvent } from "#core/domain/CalendarEvent"
import type { EventId } from "#core/domain/Ids"
import { eventId, revision } from "#core/domain/Ids"
import type { Action, ActionMeta } from "#core/app/Action"
import { diffState } from "#core/app/diffState"
import { reduce } from "#core/app/reduce"
import type { Store } from "#core/app/Store"
import { createStore } from "#core/app/Store"
import type { UseCases } from "#core/app/useCases"
import { createUseCases } from "#core/app/useCases"

/* ────────────────────────────── El escenario ────────────────────────────── */

const DIA: Day = parseDay("2026-07-02") as Day
const OTRO_DIA: Day = parseDay("2026-07-03") as Day
const HORA: Time = parseTime("18:00") as Time
const OTRA_HORA: Time = parseTime("09:30") as Time

const ID_CITA: EventId = eventId("cita")
const ID_CINE: EventId = eventId("cine")
const ID_SUELTO: EventId = eventId("suelto")

const META: ActionMeta = { now: 1000, revision: revision("rev-nueva") }

const evento = (id: EventId, extra: Partial<CalendarEvent> = {}): CalendarEvent => ({
  id,
  day: DIA,
  title: `Evento ${id}`,
  done: false,
  updatedAt: 0,
  revision: revision(`rev-${id}`),
  ...extra,
})

const CITA: CalendarEvent = evento(ID_CITA, { time: HORA })
const CINE: CalendarEvent = evento(ID_CINE)
const SUELTO: CalendarEvent = evento(ID_SUELTO)

const estado = (): AppState => ({
  notes: {},
  diagrams: {},
  contexts: {},
  events: { [ID_CITA]: CITA, [ID_CINE]: CINE, [ID_SUELTO]: SUELTO },
  routines: {},
})

/* ──────────────────────────────── Eventos ──────────────────────────────── */

test("create-event crea el evento, sin hora si es null", () => {
  const despues: AppState = reduce(estado(), {
    type: "create-event",
    eventId: eventId("nuevo"),
    day: OTRO_DIA,
    time: null,
    title: "Dentista",
    meta: META,
  })

  const e: CalendarEvent | undefined = despues.events[eventId("nuevo")]
  assert.ok(e !== undefined)
  assert.equal(e.day, OTRO_DIA)
  assert.equal("time" in e, false, "sin hora, la clave no existe")
  assert.equal(e.done, false)
  assert.equal(e.updatedAt, 1000)
})

test("create-event con la hora la guarda, y con el motivo vacío no falla", () => {
  const despues: AppState = reduce(estado(), {
    type: "create-event",
    eventId: eventId("nuevo"),
    day: DIA,
    time: OTRA_HORA,
    title: "",
    meta: META,
  })
  assert.equal(despues.events[eventId("nuevo")]?.time, OTRA_HORA)
  assert.equal(despues.events[eventId("nuevo")]?.title, "")
})

test("create-event con un id de evento repetido es no-op", () => {
  const antes: AppState = estado()
  const despues: AppState = reduce(antes, {
    type: "create-event",
    eventId: ID_CITA,
    day: DIA,
    time: null,
    title: "otra",
    meta: META,
  })
  assert.strictEqual(despues, antes)
})

test("update-event cambia día, hora y motivo, y quita la hora si llega null", () => {
  const conHora: AppState = reduce(estado(), {
    type: "update-event",
    eventId: ID_CINE,
    day: OTRO_DIA,
    time: OTRA_HORA,
    title: "Cine nuevo",
    meta: META,
  })
  assert.equal(conHora.events[ID_CINE]?.time, OTRA_HORA)
  assert.equal(conHora.events[ID_CINE]?.day, OTRO_DIA)
  assert.equal(conHora.events[ID_CINE]?.revision, META.revision)

  const sinHora: AppState = reduce(estado(), {
    type: "update-event",
    eventId: ID_CITA,
    day: DIA,
    time: null,
    title: CITA.title,
    meta: META,
  })
  assert.equal("time" in (sinHora.events[ID_CITA] as CalendarEvent), false)
})

test("update-event que no cambia nada, o de un evento que no está, es no-op", () => {
  const antes: AppState = estado()
  assert.strictEqual(
    reduce(antes, {
      type: "update-event",
      eventId: ID_CITA,
      day: DIA,
      time: HORA,
      title: CITA.title,
      meta: META,
    }),
    antes,
  )
  assert.strictEqual(
    reduce(antes, {
      type: "update-event",
      eventId: ID_CINE,
      day: DIA,
      time: null,
      title: CINE.title,
      meta: META,
    }),
    antes,
    "sin hora y sigue sin hora",
  )
  assert.strictEqual(
    reduce(antes, {
      type: "update-event",
      eventId: eventId("no-esta"),
      day: DIA,
      time: null,
      title: "x",
      meta: META,
    }),
    antes,
  )
})

test("set-event-done marca y desmarca; repetir lo mismo es no-op", () => {
  const antes: AppState = estado()
  const hecho: AppState = reduce(antes, {
    type: "set-event-done",
    eventId: ID_CITA,
    done: true,
    meta: META,
  })
  assert.equal(hecho.events[ID_CITA]?.done, true)
  assert.strictEqual(hecho.events[ID_CINE], CINE)

  assert.strictEqual(
    reduce(hecho, { type: "set-event-done", eventId: ID_CITA, done: true, meta: META }),
    hecho,
  )
  assert.strictEqual(
    reduce(antes, { type: "set-event-done", eventId: ID_CITA, done: false, meta: META }),
    antes,
  )
  assert.strictEqual(
    reduce(antes, { type: "set-event-done", eventId: eventId("no-esta"), done: true, meta: META }),
    antes,
  )
})

test("delete-event lo quita y deja los demás intactos, por referencia", () => {
  const antes: AppState = estado()
  const despues: AppState = reduce(antes, { type: "delete-event", eventId: ID_CITA, meta: META })
  assert.equal(despues.events[ID_CITA], undefined)
  assert.strictEqual(despues.events[ID_CINE], CINE)
})

test("delete-event de un evento que no está es no-op", () => {
  const antes: AppState = estado()
  assert.strictEqual(
    reduce(antes, { type: "delete-event", eventId: eventId("no-esta"), meta: META }),
    antes,
  )
})

/* ───────────────────────────────── diffState ───────────────────────────────── */

test("diffState ve los eventos por referencia: lo borrado", () => {
  const antes: AppState = estado()
  const despues: AppState = reduce(antes, { type: "delete-event", eventId: ID_CITA, meta: META })
  const d = diffState(antes, despues)

  assert.deepEqual(d.events.deleted, [ID_CITA])
  assert.equal(d.events.upserted.length, 0)
  assert.equal(d.notes.upserted.length + d.diagrams.upserted.length + d.contexts.upserted.length, 0)
})

test("diffState de un estado consigo mismo no ve cambios en los eventos", () => {
  const s: AppState = estado()
  const d = diffState(s, s)
  assert.equal(d.events.upserted.length + d.events.deleted.length, 0)
})

/* ──────────────────────────────── Casos de uso ──────────────────────────────── */

const montar = (): { readonly store: Store; readonly useCases: UseCases } => {
  let n: number = 0
  const store: Store = createStore(estado())
  return {
    store,
    useCases: createUseCases({
      clock: { now: (): number => 1000 },
      ids: { next: (): string => `id-${(n += 1)}` },
      store,
    }),
  }
}

test("createEvent devuelve el evento, con su id generado", () => {
  const { store, useCases } = montar()
  const e: CalendarEvent | null = useCases.createEvent(DIA, null, "Yoga")
  assert.ok(e !== null)
  assert.equal(e.id, "id-1")
  assert.strictEqual(store.getState().events[e.id], e)
})

test("los casos de uso devuelven null cuando no aplican y la entidad cuando sí", () => {
  const { useCases } = montar()
  assert.equal(useCases.setEventDone(ID_CITA, false), null)
  assert.equal(useCases.setEventDone(ID_CITA, true)?.done, true)
  assert.equal(useCases.updateEvent(ID_CITA, DIA, HORA, CITA.title), null)
  assert.equal(useCases.deleteEvent(eventId("no-esta")), null)
  assert.equal(useCases.deleteEvent(ID_SUELTO)?.id, ID_SUELTO)
})

/* El tipo `Action` se usa sólo para anclar que el catálogo trae las cuatro. */
const _CUATRO: ReadonlyArray<Action["type"]> = ["create-event", "update-event", "set-event-done", "delete-event"]
test("el catálogo trae las cuatro acciones de evento", () => {
  assert.equal(new Set(_CUATRO).size, 4)
})
