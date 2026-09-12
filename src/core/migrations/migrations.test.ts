/**
 * La hidratación y el runner de migraciones: la parte pura del arranque.
 *
 * Las migraciones se prueban con una lista **inventada aquí**, no con
 * `MIGRATIONS`, que está vacía a propósito porque todavía no hay nada guardado
 * con un esquema viejo. Probar el runner no exige inventarse un pasado: exige
 * inyectarle una lista, que es justo por lo que la recibe por parámetro.
 */

import { test } from "node:test"
import assert from "node:assert/strict"

import type { Context } from "../domain/Context"
import { contextId, noteId, noteRef, planId, planRef, revision } from "../domain/Ids"
import type { Note } from "../domain/Note"
import type { StoredEntities } from "./hydrate"
import { hydrate } from "./hydrate"
import type { Migration } from "./runMigrations"
import {
  CURRENT_SCHEMA_VERSION,
  EMPTY_STORE_VERSION,
  MIGRATIONS,
  runMigrations,
} from "./runMigrations"

/* ────────────────────────────── El escenario ────────────────────────────── */

const ID_COMPRA = noteId("compra")
const ID_FANTASMA = noteId("borrada-hace-tiempo")
const ID_CASA = contextId("casa")
const ID_VACIO = contextId("vacio")

const COMPRA: Note = {
  id: ID_COMPRA,
  name: "Compra",
  content: [],
  updatedAt: 0,
  revision: revision("rev-compra"),
}

const contexto = (id: typeof ID_CASA, items: Context["items"]): Context => ({
  id,
  name: "Un contexto",
  defaultView: { type: "context" },
  items,
  updatedAt: 0,
  revision: revision(`rev-${id}`),
})

/* ──────────────────────────────── hydrate ─────────────────────────────────── */

test("hydrate pasa de listas a mapas por id", () => {
  const stored: StoredEntities = {
    notes: [COMPRA],
    plans: [],
    contexts: [contexto(ID_CASA, [noteRef(ID_COMPRA)])],
  }

  const state = hydrate(stored)
  assert.strictEqual(state.notes[ID_COMPRA], COMPRA)
  assert.equal(Object.keys(state.contexts).length, 1)
})

test("hydrate de un almacén vacío da un estado vacío", () => {
  const state = hydrate({ notes: [], plans: [], contexts: [] })
  assert.deepEqual(state, { notes: {}, plans: {}, contexts: {} })
})

test("hydrate tira las ItemRef que apuntan a algo que ya no está", () => {
  const stored: StoredEntities = {
    notes: [COMPRA],
    plans: [],
    contexts: [contexto(ID_CASA, [noteRef(ID_COMPRA), noteRef(ID_FANTASMA)])],
  }

  const state = hydrate(stored)
  assert.deepEqual(state.contexts[ID_CASA]?.items, [noteRef(ID_COMPRA)])
})

test("hydrate tira también las referencias a planes inexistentes", () => {
  const stored: StoredEntities = {
    notes: [],
    plans: [],
    contexts: [contexto(ID_CASA, [planRef(planId("no-existe"))])],
  }

  assert.deepEqual(hydrate(stored).contexts[ID_CASA]?.items, [])
})

test("un arranque NORMAL devuelve los contextos INTACTOS, por referencia", () => {
  /*
      ⚠️ La prueba que evita que la app se reescriba entera cada vez que arranca.
      `filter` crea siempre un array nuevo: si `hydrate` copiara los contextos sin
      necesidad, el primer diff contra lo guardado los daría todos por sucios y el
      write-behind los volcaría a disco sin que nada hubiera cambiado (§3).
  */
  const sano = contexto(ID_CASA, [noteRef(ID_COMPRA)])
  const vacio = contexto(ID_VACIO, [])

  const state = hydrate({ notes: [COMPRA], plans: [], contexts: [sano, vacio] })

  assert.strictEqual(state.contexts[ID_CASA], sano)
  assert.strictEqual(state.contexts[ID_VACIO], vacio)
})

/* ───────────────────────────── runMigrations ──────────────────────────────── */

test("un almacén vacío no migra nada y queda en la versión actual", () => {
  const r = runMigrations({ nada: true }, EMPTY_STORE_VERSION)

  assert.equal(r.applied, 0, "ha intentado migrar un almacén vacío")
  assert.equal(r.version, CURRENT_SCHEMA_VERSION)
})

test("un almacén ya en la versión actual no migra nada", () => {
  const datos = { notes: [] }
  const r = runMigrations(datos, CURRENT_SCHEMA_VERSION)

  assert.equal(r.applied, 0)
  assert.strictEqual(r.data, datos, "ha tocado los datos sin necesidad")
})

test("las migraciones se aplican en cadena y en orden", () => {
  const pasos: ReadonlyArray<Migration> = [
    { from: 2, migrate: (d) => `${String(d)}→3` },
    { from: 1, migrate: (d) => `${String(d)}→2` }, // a propósito, desordenada
  ]

  const r = runMigrations("v1", 1, { migrations: pasos, target: 3 })

  assert.equal(r.applied, 2)
  assert.equal(r.version, 3)
  // El orden lo marca `from`, no la posición en la lista.
  assert.equal(r.data, "v1→2→3")
})

test("se aplican SÓLO las que faltan, no la cadena entera", () => {
  const pasos: ReadonlyArray<Migration> = [
    { from: 1, migrate: (d) => `${String(d)}→2` },
    { from: 2, migrate: (d) => `${String(d)}→3` },
  ]

  const r = runMigrations("v2", 2, { migrations: pasos, target: 3 })

  assert.equal(r.applied, 1, "ha vuelto a aplicar una migración ya aplicada")
  assert.equal(r.data, "v2→3")
})

test("falta la migración que hace falta: lanza en vez de corromper", () => {
  assert.throws(
    () => runMigrations("viejo", 1, { migrations: [], target: 2 }),
    /Falta la migración del esquema 1 al 2/,
  )
})

test("datos de una versión MÁS NUEVA que el código: lanza", () => {
  /*
      Pasa de verdad: alguien abre su fichero con una versión nueva de la app y
      luego con una vieja. Seguir adelante leyendo campos que no entiende y
      volviendo a escribir corrompería sus notas, así que aquí lanzar es lo
      correcto — a diferencia del reducer, que no lanza nunca.
  */
  assert.throws(
    () => runMigrations({}, CURRENT_SCHEMA_VERSION + 1),
    /más nueva de la app/,
  )
})

test("la lista de migraciones está vacía, y es correcto", () => {
  // No hay nada guardado con un esquema viejo: el primero es el primero.
  // Escribir una migración de ejemplo sería inventarse un pasado que no existe.
  assert.deepEqual(MIGRATIONS, [])
  assert.equal(CURRENT_SCHEMA_VERSION, 1)
})
