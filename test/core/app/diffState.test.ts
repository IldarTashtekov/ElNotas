/**
 * El diff de estado.
 *
 * Lo que de verdad se comprueba aquí no es "que detecte los cambios" —eso es lo
 * fácil— sino lo contrario: **que NO detecte los que no hay**. Un diff que
 * devuelve todo sucio siempre funciona perfectamente de cara al usuario y sólo
 * escribe a disco de más, en silencio y para siempre (`ARCHITECTURE.md` §3).
 *
 * De ahí que casi todas las pruebas de abajo comparen con `strictEqual` contra
 * `NO_CHANGES`, y que haya una que cuenta cuántas entidades salen sucias cuando
 * sólo se ha tocado una.
 */

import { test } from "node:test"
import assert from "node:assert/strict"

import type { AppState } from "#core/domain/AppState"
import type { Context } from "#core/domain/Context"
import { contextId, noteId, planId, revision } from "#core/domain/Ids"
import type { Note } from "#core/domain/Note"
import type { Plan } from "#core/domain/Plan"
import { NO_CHANGES, diffState } from "#core/app/diffState"

/* ────────────────────────────── El escenario ────────────────────────────── */

const ID_COMPRA = noteId("compra")
const ID_DIARIO = noteId("diario")
const ID_CASA = contextId("casa")
const ID_MUDANZA = planId("mudanza")

const nota = (id: typeof ID_COMPRA, name: string): Note => ({
  id,
  name,
  content: [],
  updatedAt: 0,
  revision: revision(`rev-${id}`),
})

const COMPRA = nota(ID_COMPRA, "Compra semanal")
const DIARIO = nota(ID_DIARIO, "Diario")

const CASA: Context = {
  id: ID_CASA,
  name: "Casa",
  defaultView: { type: "context" },
  items: [],
  updatedAt: 0,
  revision: revision("rev-casa"),
}

const MUDANZA: Plan = {
  id: ID_MUDANZA,
  name: "Mudanza",
  nodes: [],
  updatedAt: 0,
  revision: revision("rev-mudanza"),
}

const estado = (): AppState => ({
  notes: { [ID_COMPRA]: COMPRA, [ID_DIARIO]: DIARIO },
  plans: { [ID_MUDANZA]: MUDANZA },
  contexts: { [ID_CASA]: CASA },
})

/* ───────────────────── Lo importante: NO detectar de más ──────────────────── */

test("el mismo estado consigo mismo no tiene nada que escribir", () => {
  const s = estado()
  assert.strictEqual(diffState(s, s), NO_CHANGES)
})

test("dos estados distintos con el mismo contenido tampoco", () => {
  // Objetos raíz distintos, pero las entidades son las mismas por referencia.
  assert.strictEqual(diffState(estado(), estado()), NO_CHANGES)
})

test("cambiar una nota NO ensucia las otras entidades", () => {
  const antes = estado()
  const renombrada: Note = { ...COMPRA, name: "Compra del mes" }
  const despues: AppState = {
    ...antes,
    notes: { ...antes.notes, [ID_COMPRA]: renombrada },
  }

  const d = diffState(antes, despues)

  assert.deepEqual(d.notes.upserted, [renombrada])
  assert.deepEqual(d.notes.deleted, [])
  // Y esto es el meollo: ni el plan ni el contexto se van a escribir.
  assert.deepEqual(d.plans.upserted, [])
  assert.deepEqual(d.contexts.upserted, [])
})

test("una COPIA equivalente sí cuenta como cambio, y tiene que ser así", () => {
  /*
      Puede sorprender: la nota tiene exactamente el mismo contenido y aun así
      sale sucia. Es la consecuencia directa de comparar por referencia, y es
      deliberado.

      Comparar por valor —un `deepEqual` o un `JSON.stringify`— daría respuestas
      más "listas" a cambio de recorrer entera cada entidad en cada cambio, que
      es precisamente el trabajo que la arquitectura está montada para no hacer
      (§3). Que una copia equivalente ensucie no es un fallo del diff: es un
      fallo de quien copió sin necesidad, y el sitio donde se arregla es la
      operación de dominio que devolvió una copia en vez de su entrada.

      Esta prueba existe para que nadie "mejore" el diff comparando por valor:
      sin ella, ese cambio pasa casi inadvertido.
  */
  const antes = estado()
  const copia: Note = { ...COMPRA }
  const despues: AppState = {
    ...antes,
    notes: { ...antes.notes, [ID_COMPRA]: copia },
  }

  assert.deepEqual(diffState(antes, despues).notes.upserted, [copia])
})

/* ────────────────────────── Lo que sí tiene que ver ───────────────────────── */

test("una entidad nueva sale como upserted", () => {
  const antes = estado()
  const nueva = nota(noteId("recetas"), "Recetas")
  const despues: AppState = {
    ...antes,
    notes: { ...antes.notes, [nueva.id]: nueva },
  }

  assert.deepEqual(diffState(antes, despues).notes.upserted, [nueva])
})

test("una entidad borrada sale como deleted, y sólo ella", () => {
  const antes = estado()
  const { [ID_COMPRA]: _fuera, ...quedan } = antes.notes
  const despues: AppState = { ...antes, notes: quedan }

  const d = diffState(antes, despues)
  assert.deepEqual(d.notes.deleted, [ID_COMPRA])
  assert.deepEqual(d.notes.upserted, [])
})

test("borrar una nota y tocar un contexto sale en el mismo diff", () => {
  const antes = estado()
  const { [ID_COMPRA]: _fuera, ...quedan } = antes.notes
  const limpio: Context = { ...CASA, items: [] }
  const despues: AppState = {
    ...antes,
    notes: quedan,
    contexts: { [ID_CASA]: limpio },
  }

  const d = diffState(antes, despues)
  assert.deepEqual(d.notes.deleted, [ID_COMPRA])
  assert.deepEqual(d.contexts.upserted, [limpio])
})

test("las tres clases de entidad se diferencian a la vez", () => {
  const antes = estado()
  const despues: AppState = {
    notes: { [ID_DIARIO]: DIARIO },
    plans: { [ID_MUDANZA]: { ...MUDANZA, name: "Mudanza 2" } },
    contexts: {},
  }

  const d = diffState(antes, despues)
  assert.deepEqual(d.notes.deleted, [ID_COMPRA])
  assert.equal(d.plans.upserted.length, 1)
  assert.deepEqual(d.contexts.deleted, [ID_CASA])
})

/* ──────────────────────── El caso que se acumula solo ─────────────────────── */

test("crear y borrar entre dos escrituras se cancela: no hay nada que escribir", () => {
  // Es lo que hace el write-behind con una ráfaga: no acumula una lista de
  // cambios, compara "lo último escrito" con "lo de ahora". Una nota que nació y
  // murió dentro de la ráfaga no llega nunca a disco.
  const antes = estado()
  const efimera = nota(noteId("efimera"), "Se va a ir")
  const enMedio: AppState = {
    ...antes,
    notes: { ...antes.notes, [efimera.id]: efimera },
  }
  assert.notStrictEqual(diffState(antes, enMedio), NO_CHANGES)

  const despues: AppState = { ...antes, notes: { ...antes.notes } }
  assert.strictEqual(diffState(antes, despues), NO_CHANGES)
})

/* ─────────────────────────── Estados vacíos y bordes ──────────────────────── */

test("de vacío a vacío no hay nada que escribir", () => {
  const vacio = (): AppState => ({ notes: {}, plans: {}, contexts: {} })
  assert.strictEqual(diffState(vacio(), vacio()), NO_CHANGES)
})

test("la primera entidad de un almacén vacío sale como upserted", () => {
  const vacio: AppState = { notes: {}, plans: {}, contexts: {} }
  const conUna: AppState = { ...vacio, notes: { [ID_COMPRA]: COMPRA } }

  assert.deepEqual(diffState(vacio, conUna).notes.upserted, [COMPRA])
})
