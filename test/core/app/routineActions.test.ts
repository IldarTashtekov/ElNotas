/**
 * Las seis acciones de rutina y `diffState` con su clase nueva.
 *
 * Lo que se vigila, como en las demás: que un no-op devuelva **el mismo estado**
 * (`strictEqual`, nunca `deepEqual`), que el futuro no se marque, que los días
 * queden ordenados y que borrar o cambiar una rutina no toque nada más.
 */

import { test } from "node:test"
import assert from "node:assert/strict"

import type { AppState } from "#core/domain/AppState"
import type { Day } from "#core/domain/calendar"
import { parseDay } from "#core/domain/calendar"
import type { RoutineId } from "#core/domain/Ids"
import { revision, routineId } from "#core/domain/Ids"
import type { Routine } from "#core/domain/Routine"
import type { Action, ActionMeta } from "#core/app/Action"
import { diffState, NO_CHANGES } from "#core/app/diffState"
import { reduce } from "#core/app/reduce"
import type { Store } from "#core/app/Store"
import { createStore } from "#core/app/Store"
import type { UseCases } from "#core/app/useCases"
import { createUseCases } from "#core/app/useCases"

const dia = (raw: string): Day => parseDay(raw) as Day

const HOY: Day = dia("2026-07-02")
const AYER: Day = dia("2026-07-01")
const MANANA: Day = dia("2026-07-03")

const ID_CORRER: RoutineId = routineId("correr")
const ID_LEER: RoutineId = routineId("leer")

const META: ActionMeta = { now: 1000, revision: revision("rev-nueva") }

const rutina = (id: RoutineId, extra: Partial<Routine> = {}): Routine => ({
  id,
  name: `Rutina ${id}`,
  days: [],
  updatedAt: 0,
  revision: revision(`rev-${id}`),
  ...extra,
})

const CORRER: Routine = rutina(ID_CORRER, { days: [AYER], weeklyGoal: 3 })
const LEER: Routine = rutina(ID_LEER)

const estado = (): AppState => ({
  notes: {},
  diagrams: {},
  contexts: {},
  events: {},
  eventGroups: {},
  routines: { [ID_CORRER]: CORRER, [ID_LEER]: LEER },
})

const aplicar = (accion: Action): AppState => reduce(estado(), accion)

const rutinaDe = (s: AppState, id: RoutineId): Routine => {
  const r: Routine | undefined = s.routines[id]
  if (r === undefined) assert.fail(`la rutina ${id} tenía que estar`)
  return r
}

/* ──────────────────────────────── create / rename ─────────────────────────────── */

test("create-routine crea una rutina vacía, con la meta si va y sin la clave si no", () => {
  const con: AppState = aplicar({ type: "create-routine", routineId: routineId("n1"), name: "Yoga", weeklyGoal: 5, meta: META })
  const sin: AppState = aplicar({ type: "create-routine", routineId: routineId("n2"), name: "Leer", weeklyGoal: null, meta: META })

  assert.deepEqual(rutinaDe(con, routineId("n1")).days, [])
  assert.equal(rutinaDe(con, routineId("n1")).weeklyGoal, 5)
  assert.equal("weeklyGoal" in rutinaDe(sin, routineId("n2")), false, "sin meta, la clave no existe")
  assert.equal(rutinaDe(con, routineId("n1")).updatedAt, META.now)
})

test("create-routine: un id repetido o una meta fuera de 1 a 7 no hacen nada", () => {
  const antes: AppState = estado()
  for (const meta of [0, 8, 2.5]) {
    assert.strictEqual(
      reduce(antes, { type: "create-routine", routineId: routineId("nueva"), name: "X", weeklyGoal: meta, meta: META }),
      antes,
      `meta ${meta}`,
    )
  }
  assert.strictEqual(
    reduce(antes, { type: "create-routine", routineId: ID_CORRER, name: "Otra", weeklyGoal: null, meta: META }),
    antes,
  )
})

test("rename-routine cambia el nombre; el mismo nombre o una rutina que no existe, nada", () => {
  const antes: AppState = estado()
  const despues: AppState = reduce(antes, { type: "rename-routine", routineId: ID_CORRER, name: "Trotar", meta: META })

  assert.equal(rutinaDe(despues, ID_CORRER).name, "Trotar")
  assert.strictEqual(despues.routines[ID_LEER], LEER, "Leer no se toca")
  assert.strictEqual(
    reduce(antes, { type: "rename-routine", routineId: ID_CORRER, name: CORRER.name, meta: META }),
    antes,
  )
  assert.strictEqual(
    reduce(antes, { type: "rename-routine", routineId: routineId("fantasma"), name: "X", meta: META }),
    antes,
  )
})

/* ───────────────────────────────── set-routine-day ─────────────────────────────── */

const marcar = (día: Day, done: boolean, today: Day = HOY): Action => ({
  type: "set-routine-day",
  routineId: ID_CORRER,
  day: día,
  done,
  today,
  meta: META,
})

test("set-routine-day marca hoy y un día pasado, y los deja ordenados", () => {
  const conHoy: AppState = aplicar(marcar(HOY, true))
  const conAntiguo: AppState = reduce(conHoy, marcar(dia("2026-06-20"), true))

  assert.deepEqual(rutinaDe(conHoy, ID_CORRER).days, [AYER, HOY])
  assert.deepEqual(rutinaDe(conAntiguo, ID_CORRER).days, ["2026-06-20", AYER, HOY])
  assert.equal(rutinaDe(conHoy, ID_CORRER).updatedAt, META.now)
})

test("set-routine-day: el futuro no se marca", () => {
  const antes: AppState = estado()

  assert.strictEqual(reduce(antes, marcar(MANANA, true)), antes)
})

test("set-routine-day: quitar la marca de un día vale esté donde esté", () => {
  /* La rutina tiene un día posterior a `today` (por ejemplo, el reloj retrocedió). */
  const conFuturo: AppState = {
    ...estado(),
    routines: { ...estado().routines, [ID_CORRER]: { ...CORRER, days: [AYER, MANANA] } },
  }

  assert.deepEqual(rutinaDe(reduce(conFuturo, marcar(MANANA, false)), ID_CORRER).days, [AYER])
})

test("set-routine-day: marcar lo marcado, desmarcar lo no marcado o una rutina que no existe, nada", () => {
  const antes: AppState = estado()

  assert.strictEqual(reduce(antes, marcar(AYER, true)), antes)
  assert.strictEqual(reduce(antes, marcar(HOY, false)), antes)
  assert.strictEqual(
    reduce(antes, { type: "set-routine-day", routineId: routineId("fantasma"), day: HOY, done: true, today: HOY, meta: META }),
    antes,
  )
})

/* ───────────────────────────── goal / archived / delete ────────────────────────── */

test("set-routine-goal cambia la meta sin tocar los días, y null la quita", () => {
  const cinco: AppState = aplicar({ type: "set-routine-goal", routineId: ID_CORRER, weeklyGoal: 5, meta: META })
  const ninguna: AppState = aplicar({ type: "set-routine-goal", routineId: ID_CORRER, weeklyGoal: null, meta: META })

  assert.equal(rutinaDe(cinco, ID_CORRER).weeklyGoal, 5)
  assert.deepEqual(rutinaDe(cinco, ID_CORRER).days, [AYER], "los días no se tocan")
  assert.equal("weeklyGoal" in rutinaDe(ninguna, ID_CORRER), false)
  assert.equal(
    rutinaDe(aplicar({ type: "set-routine-goal", routineId: ID_LEER, weeklyGoal: 2, meta: META }), ID_LEER).weeklyGoal,
    2,
    "también donde no había",
  )
})

test("set-routine-goal: la misma meta, una inválida o una rutina que no existe, nada", () => {
  const antes: AppState = estado()
  const meta = (id: RoutineId, weeklyGoal: number | null): Action => ({ type: "set-routine-goal", routineId: id, weeklyGoal, meta: META })

  assert.strictEqual(reduce(antes, meta(ID_CORRER, 3)), antes, "la misma")
  assert.strictEqual(reduce(antes, meta(ID_LEER, null)), antes, "quitar lo que no hay")
  for (const mala of [0, 8, 1.5]) assert.strictEqual(reduce(antes, meta(ID_CORRER, mala)), antes, `${mala}`)
  assert.strictEqual(reduce(antes, meta(routineId("fantasma"), 3)), antes)
})

test("set-routine-archived: la clave sólo existe cuando vale true", () => {
  const archivada: AppState = aplicar({ type: "set-routine-archived", routineId: ID_CORRER, archived: true, meta: META })
  const vuelta: AppState = reduce(archivada, { type: "set-routine-archived", routineId: ID_CORRER, archived: false, meta: META })

  assert.equal(rutinaDe(archivada, ID_CORRER).archived, true)
  assert.equal("archived" in rutinaDe(vuelta, ID_CORRER), false)
  assert.strictEqual(
    reduce(estado(), { type: "set-routine-archived", routineId: ID_CORRER, archived: false, meta: META }).routines[ID_CORRER],
    CORRER,
    "desarchivar lo no archivado no hace nada",
  )
  assert.strictEqual(
    reduce(archivada, { type: "set-routine-archived", routineId: ID_CORRER, archived: true, meta: META }),
    archivada,
  )
})

test("delete-routine borra la rutina con sus días y no toca la otra ni lo demás", () => {
  const antes: AppState = estado()
  const despues: AppState = reduce(antes, { type: "delete-routine", routineId: ID_CORRER, meta: META })

  assert.equal(despues.routines[ID_CORRER], undefined)
  assert.strictEqual(despues.routines[ID_LEER], LEER)
  assert.strictEqual(despues.events, antes.events)
  assert.strictEqual(despues.eventGroups, antes.eventGroups)
  assert.strictEqual(
    reduce(antes, { type: "delete-routine", routineId: routineId("fantasma"), meta: META }),
    antes,
  )
})

/* ─────────────────────────────────── diffState ─────────────────────────────────── */

test("diffState: una rutina nueva, cambiada o borrada sale en routines, y nada más", () => {
  const antes: AppState = estado()
  const marcada: AppState = reduce(antes, marcar(HOY, true))
  const sin: AppState = reduce(antes, { type: "delete-routine", routineId: ID_LEER, meta: META })

  const cambio = diffState(antes, marcada)
  assert.deepEqual(cambio.routines.upserted.map((r: Routine): RoutineId => r.id), [ID_CORRER])
  assert.deepEqual(cambio.routines.deleted, [])
  assert.strictEqual(cambio.notes, NO_CHANGES.notes)

  assert.deepEqual(diffState(antes, sin).routines.deleted, [ID_LEER])
  assert.strictEqual(diffState(antes, antes), NO_CHANGES)
})

/* ──────────────────────────────── Casos de uso ─────────────────────────────── */

test("setRoutineDay pasa el «hoy» de quien llama: el futuro devuelve null y el pasado, la rutina", () => {
  const store: Store = createStore(estado())
  const useCases: UseCases = createUseCases({
    clock: { now: (): number => 1000 },
    ids: { next: (): string => "id-1" },
    store,
  })

  assert.equal(useCases.setRoutineDay(ID_CORRER, MANANA, true, HOY), null)
  assert.deepEqual(useCases.setRoutineDay(ID_CORRER, HOY, true, HOY)?.days, [AYER, HOY])
  assert.equal(useCases.createRoutine("Yoga", 9), null, "meta inválida: no se crea")
  assert.equal(useCases.createRoutine("Yoga", 2)?.id, "id-1")
})
