/**
 * Las nueve acciones del calendario: cinco de evento y cuatro de grupo, más
 * `diffState` con sus dos clases nuevas y los dos ayudantes de lectura.
 *
 * Lo que se vigila, como en las demás acciones: que un no-op devuelva **el mismo
 * estado** (`strictEqual`, nunca `deepEqual`), que ningún grupo referencie un
 * evento que no existe, y que sólo se reescriba lo que cambia: borrar un evento
 * no toca los grupos que no lo listaban.
 */

import { test } from "node:test"
import assert from "node:assert/strict"

import type { AppState } from "#core/domain/AppState"
import type { Day, Time } from "#core/domain/calendar"
import { parseDay, parseTime } from "#core/domain/calendar"
import type { CalendarEvent } from "#core/domain/CalendarEvent"
import type { EventGroup } from "#core/domain/EventGroup"
import { eventsWithoutGroup, groupsOfEvent } from "#core/domain/EventGroup"
import type { EventGroupId, EventId } from "#core/domain/Ids"
import { eventGroupId, eventId, revision } from "#core/domain/Ids"
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
const ID_SALUD: EventGroupId = eventGroupId("salud")
const ID_OCIO: EventGroupId = eventGroupId("ocio")
const ID_VACIO: EventGroupId = eventGroupId("vacio")

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

const grupo = (id: EventGroupId, events: ReadonlyArray<EventId>, extra: Partial<EventGroup> = {}): EventGroup => ({
  id,
  name: `Grupo ${id}`,
  events,
  updatedAt: 0,
  revision: revision(`rev-${id}`),
  ...extra,
})

const CITA: CalendarEvent = evento(ID_CITA, { time: HORA })
const CINE: CalendarEvent = evento(ID_CINE)
const SUELTO: CalendarEvent = evento(ID_SUELTO)
const SALUD: EventGroup = grupo(ID_SALUD, [ID_CITA])
const OCIO: EventGroup = grupo(ID_OCIO, [ID_CITA, ID_CINE])
const VACIO: EventGroup = grupo(ID_VACIO, [])

/** Cita en Salud y Ocio, Cine sólo en Ocio, Suelto en ninguno, y un grupo vacío. */
const estado = (): AppState => ({
  notes: {},
  diagrams: {},
  contexts: {},
  events: { [ID_CITA]: CITA, [ID_CINE]: CINE, [ID_SUELTO]: SUELTO },
  eventGroups: { [ID_SALUD]: SALUD, [ID_OCIO]: OCIO, [ID_VACIO]: VACIO },
})

/* ──────────────────────────────── Eventos ──────────────────────────────── */

test("create-event crea el evento, sin hora si es null, y lo pone en los grupos que existen", () => {
  const antes: AppState = estado()
  const despues: AppState = reduce(antes, {
    type: "create-event",
    eventId: eventId("nuevo"),
    day: OTRO_DIA,
    time: null,
    title: "Dentista",
    groupIds: [ID_SALUD, eventGroupId("fantasma"), ID_SALUD],
    newGroup: null,
    meta: META,
  })

  const e: CalendarEvent | undefined = despues.events[eventId("nuevo")]
  assert.ok(e !== undefined)
  assert.equal(e.day, OTRO_DIA)
  assert.equal("time" in e, false, "sin hora, la clave no existe")
  assert.equal(e.done, false)
  assert.equal(e.updatedAt, 1000)
  assert.deepEqual(despues.eventGroups[ID_SALUD]?.events, [ID_CITA, eventId("nuevo")])
  assert.equal(Object.keys(despues.eventGroups).length, 3, "el grupo fantasma no se crea")
  assert.strictEqual(despues.eventGroups[ID_OCIO], antes.eventGroups[ID_OCIO], "Ocio no se toca")
})

test("create-event con la hora la guarda, y con el motivo vacío no falla", () => {
  const despues: AppState = reduce(estado(), {
    type: "create-event",
    eventId: eventId("nuevo"),
    day: DIA,
    time: OTRA_HORA,
    title: "",
    groupIds: [],
    newGroup: null,
    meta: META,
  })
  assert.equal(despues.events[eventId("nuevo")]?.time, OTRA_HORA)
  assert.equal(despues.events[eventId("nuevo")]?.title, "")
})

test("create-event con grupo nuevo lo crea con el evento dentro, en la misma acción", () => {
  const despues: AppState = reduce(estado(), {
    type: "create-event",
    eventId: eventId("nuevo"),
    day: DIA,
    time: null,
    title: "Yoga",
    groupIds: [ID_SALUD],
    newGroup: { id: eventGroupId("deporte"), name: "Deporte" },
    meta: META,
  })
  assert.deepEqual(despues.eventGroups[eventGroupId("deporte")]?.events, [eventId("nuevo")])
  assert.equal(despues.eventGroups[eventGroupId("deporte")]?.name, "Deporte")
  assert.deepEqual(despues.eventGroups[ID_SALUD]?.events, [ID_CITA, eventId("nuevo")])
})

test("create-event con un id de evento repetido es no-op", () => {
  const antes: AppState = estado()
  const despues: AppState = reduce(antes, {
    type: "create-event",
    eventId: ID_CITA,
    day: DIA,
    time: null,
    title: "otra",
    groupIds: [],
    newGroup: null,
    meta: META,
  })
  assert.strictEqual(despues, antes)
})

test("create-event con un id de grupo nuevo repetido no lo pisa", () => {
  const antes: AppState = estado()
  const despues: AppState = reduce(antes, {
    type: "create-event",
    eventId: eventId("nuevo"),
    day: DIA,
    time: null,
    title: "x",
    groupIds: [],
    newGroup: { id: ID_SALUD, name: "Pisado" },
    meta: META,
  })
  assert.strictEqual(despues.eventGroups[ID_SALUD], SALUD)
  assert.ok(despues.events[eventId("nuevo")] !== undefined)
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

test("delete-event lo quita y lo saca de los grupos que lo listaban, y sólo de ésos", () => {
  const antes: AppState = estado()
  const despues: AppState = reduce(antes, { type: "delete-event", eventId: ID_CITA, meta: META })

  assert.equal(despues.events[ID_CITA], undefined)
  assert.deepEqual(despues.eventGroups[ID_SALUD]?.events, [])
  assert.deepEqual(despues.eventGroups[ID_OCIO]?.events, [ID_CINE])
  assert.equal(despues.eventGroups[ID_SALUD]?.revision, META.revision)
  assert.strictEqual(despues.eventGroups[ID_VACIO], VACIO, "un grupo que no lo listaba, intacto")
  assert.strictEqual(despues.events[ID_CINE], CINE)
})

test("delete-event de un evento sin grupo deja los grupos intactos, por referencia", () => {
  const antes: AppState = estado()
  const despues: AppState = reduce(antes, { type: "delete-event", eventId: ID_SUELTO, meta: META })
  assert.equal(despues.events[ID_SUELTO], undefined)
  assert.strictEqual(despues.eventGroups, antes.eventGroups)
})

test("delete-event de un evento que no está es no-op", () => {
  const antes: AppState = estado()
  assert.strictEqual(
    reduce(antes, { type: "delete-event", eventId: eventId("no-esta"), meta: META }),
    antes,
  )
})

test("set-event-groups fija el conjunto entero y sólo reescribe los grupos que cambian", () => {
  const antes: AppState = estado()
  /* Cita estaba en Salud y Ocio: pasa a Ocio y Vacío. */
  const despues: AppState = reduce(antes, {
    type: "set-event-groups",
    eventId: ID_CITA,
    groupIds: [ID_OCIO, ID_VACIO],
    meta: META,
  })
  assert.deepEqual(despues.eventGroups[ID_SALUD]?.events, [])
  assert.deepEqual(despues.eventGroups[ID_VACIO]?.events, [ID_CITA])
  assert.strictEqual(despues.eventGroups[ID_OCIO], OCIO, "Ocio ya lo tenía: intacto")
  assert.strictEqual(despues.events, antes.events, "el evento no cambia")
})

test("set-event-groups con vacío lo deja en «Sin grupo»", () => {
  const despues: AppState = reduce(estado(), {
    type: "set-event-groups",
    eventId: ID_CITA,
    groupIds: [],
    meta: META,
  })
  assert.deepEqual(
    eventsWithoutGroup(despues).map((e: CalendarEvent): EventId => e.id).sort(),
    [ID_CITA, ID_SUELTO].sort(),
  )
})

test("set-event-groups con los grupos que ya tiene, o de un evento que no está, es no-op", () => {
  const antes: AppState = estado()
  assert.strictEqual(
    reduce(antes, {
      type: "set-event-groups",
      eventId: ID_CITA,
      groupIds: [ID_OCIO, ID_SALUD],
      meta: META,
    }),
    antes,
    "el mismo conjunto, en otro orden",
  )
  assert.strictEqual(
    reduce(antes, {
      type: "set-event-groups",
      eventId: ID_SUELTO,
      groupIds: [eventGroupId("fantasma")],
      meta: META,
    }),
    antes,
    "un grupo que no existe no cuenta",
  )
  assert.strictEqual(
    reduce(antes, {
      type: "set-event-groups",
      eventId: eventId("no-esta"),
      groupIds: [ID_SALUD],
      meta: META,
    }),
    antes,
  )
})

/* ──────────────────────────────── Grupos ──────────────────────────────── */

test("create-event-group crea un grupo vacío; con el id repetido es no-op", () => {
  const antes: AppState = estado()
  const despues: AppState = reduce(antes, {
    type: "create-event-group",
    groupId: eventGroupId("nuevo"),
    name: "Nuevo",
    meta: META,
  })
  assert.deepEqual(despues.eventGroups[eventGroupId("nuevo")]?.events, [])
  assert.equal("archived" in (despues.eventGroups[eventGroupId("nuevo")] as EventGroup), false)

  assert.strictEqual(
    reduce(antes, { type: "create-event-group", groupId: ID_SALUD, name: "x", meta: META }),
    antes,
  )
})

test("rename-event-group renombra; el mismo nombre o un grupo que no está, no-op", () => {
  const antes: AppState = estado()
  const despues: AppState = reduce(antes, {
    type: "rename-event-group",
    groupId: ID_SALUD,
    name: "Médico",
    meta: META,
  })
  assert.equal(despues.eventGroups[ID_SALUD]?.name, "Médico")
  assert.strictEqual(despues.eventGroups[ID_OCIO], OCIO)

  assert.strictEqual(
    reduce(antes, { type: "rename-event-group", groupId: ID_SALUD, name: SALUD.name, meta: META }),
    antes,
  )
  assert.strictEqual(
    reduce(antes, {
      type: "rename-event-group",
      groupId: eventGroupId("no-esta"),
      name: "x",
      meta: META,
    }),
    antes,
  )
})

test("set-event-group-archived: la clave existe sólo cuando vale true", () => {
  const antes: AppState = estado()
  const archivado: AppState = reduce(antes, {
    type: "set-event-group-archived",
    groupId: ID_SALUD,
    archived: true,
    meta: META,
  })
  assert.equal(archivado.eventGroups[ID_SALUD]?.archived, true)

  const desarchivado: AppState = reduce(archivado, {
    type: "set-event-group-archived",
    groupId: ID_SALUD,
    archived: false,
    meta: META,
  })
  assert.equal("archived" in (desarchivado.eventGroups[ID_SALUD] as EventGroup), false)
})

test("set-event-group-archived no hace nada si ya está así, ni si el grupo no está", () => {
  const antes: AppState = estado()
  assert.strictEqual(
    reduce(antes, {
      type: "set-event-group-archived",
      groupId: ID_SALUD,
      archived: false,
      meta: META,
    }),
    antes,
  )
  const archivado: AppState = reduce(antes, {
    type: "set-event-group-archived",
    groupId: ID_SALUD,
    archived: true,
    meta: META,
  })
  assert.strictEqual(
    reduce(archivado, {
      type: "set-event-group-archived",
      groupId: ID_SALUD,
      archived: true,
      meta: META,
    }),
    archivado,
  )
  assert.strictEqual(
    reduce(antes, {
      type: "set-event-group-archived",
      groupId: eventGroupId("no-esta"),
      archived: true,
      meta: META,
    }),
    antes,
  )
})

test("delete-event-group no borra sus eventos, y deja los demás grupos intactos", () => {
  const antes: AppState = estado()
  const despues: AppState = reduce(antes, {
    type: "delete-event-group",
    groupId: ID_OCIO,
    meta: META,
  })
  assert.equal(despues.eventGroups[ID_OCIO], undefined)
  assert.strictEqual(despues.events, antes.events, "los eventos, ni se tocan")
  assert.strictEqual(despues.eventGroups[ID_SALUD], SALUD)
  assert.deepEqual(
    eventsWithoutGroup(despues).map((e: CalendarEvent): EventId => e.id).sort(),
    [ID_CINE, ID_SUELTO].sort(),
    "Cine se queda sin grupo",
  )

  assert.strictEqual(
    reduce(antes, { type: "delete-event-group", groupId: eventGroupId("no-esta"), meta: META }),
    antes,
  )
})

/* ──────────────────────────── Lectura derivada ──────────────────────────── */

test("groupsOfEvent da los grupos de un evento, y ninguno si está suelto", () => {
  const s: AppState = estado()
  assert.deepEqual(
    groupsOfEvent(s, ID_CITA).map((g: EventGroup): EventGroupId => g.id).sort(),
    [ID_OCIO, ID_SALUD].sort(),
  )
  assert.deepEqual(groupsOfEvent(s, ID_SUELTO), [])
})

test("eventsWithoutGroup sólo da los que no están en ningún grupo", () => {
  assert.deepEqual(
    eventsWithoutGroup(estado()).map((e: CalendarEvent): EventId => e.id),
    [ID_SUELTO],
  )
})

/* ───────────────────────────────── diffState ───────────────────────────────── */

test("diffState ve eventos y grupos por referencia: lo nuevo, lo cambiado y lo borrado", () => {
  const antes: AppState = estado()
  const despues: AppState = reduce(antes, { type: "delete-event", eventId: ID_CITA, meta: META })
  const d = diffState(antes, despues)

  assert.deepEqual(d.events.deleted, [ID_CITA])
  assert.equal(d.events.upserted.length, 0)
  assert.deepEqual(
    d.eventGroups.upserted.map((g: EventGroup): EventGroupId => g.id).sort(),
    [ID_OCIO, ID_SALUD].sort(),
    "los dos grupos que lo listaban, y no el vacío",
  )
  assert.equal(d.notes.upserted.length + d.diagrams.upserted.length + d.contexts.upserted.length, 0)
})

test("diffState de un estado consigo mismo no ve cambios en los eventos", () => {
  const s: AppState = estado()
  const d = diffState(s, s)
  assert.equal(d.events.upserted.length + d.events.deleted.length, 0)
  assert.equal(d.eventGroups.upserted.length + d.eventGroups.deleted.length, 0)
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

test("createEvent devuelve el evento, con su id y el del grupo nuevo generados", () => {
  const { store, useCases } = montar()
  const e: CalendarEvent | null = useCases.createEvent(DIA, null, "Yoga", [ID_SALUD], "Deporte")
  assert.ok(e !== null)
  assert.equal(e.id, "id-1")
  assert.equal(store.getState().eventGroups[eventGroupId("id-2")]?.name, "Deporte")
  assert.deepEqual(store.getState().eventGroups[eventGroupId("id-2")]?.events, [e.id])
})

test("los casos de uso devuelven null cuando no aplican y la entidad cuando sí", () => {
  const { useCases } = montar()
  assert.equal(useCases.setEventDone(ID_CITA, false), null)
  assert.equal(useCases.setEventDone(ID_CITA, true)?.done, true)
  assert.equal(useCases.updateEvent(ID_CITA, DIA, HORA, CITA.title), null)
  assert.equal(useCases.deleteEvent(eventId("no-esta")), null)
  assert.equal(useCases.deleteEvent(ID_SUELTO)?.id, ID_SUELTO)
  assert.equal(useCases.renameEventGroup(ID_SALUD, SALUD.name), null)
  assert.equal(useCases.setEventGroupArchived(ID_SALUD, true)?.archived, true)
  assert.equal(useCases.deleteEventGroup(ID_OCIO)?.id, ID_OCIO)
})

test("setEventGroups devuelve el evento si cambian sus grupos, y null si ya estaba así", () => {
  const { useCases } = montar()
  assert.equal(useCases.setEventGroups(ID_CITA, [ID_SALUD, ID_OCIO]), null)
  assert.equal(useCases.setEventGroups(ID_CITA, [ID_VACIO])?.id, ID_CITA)
  assert.equal(useCases.setEventGroups(eventId("no-esta"), [ID_SALUD]), null)
})

/* El tipo `Action` se usa sólo para anclar que el catálogo trae las nueve. */
const _NUEVE: ReadonlyArray<Action["type"]> = [
  "create-event",
  "update-event",
  "set-event-done",
  "delete-event",
  "set-event-groups",
  "create-event-group",
  "rename-event-group",
  "set-event-group-archived",
  "delete-event-group",
]
test("el catálogo trae las nueve acciones del calendario", () => {
  assert.equal(new Set(_NUEVE).size, 9)
})
