/**
 * El camino de lo que señala una referencia: tiene que ser el mismo que dice
 * `onCorrupt`, porque es como el arranque reconoce las referencias a ficheros
 * ilegibles. Y `refOf`, lo contrario: de un camino ilegible, a qué señalaba. Que
 * coincidan de verdad lo prueba el arranque entero.
 */

import { test } from "node:test"
import assert from "node:assert/strict"

import { diagramId, diagramRef, noteId, noteRef } from "#core/index"
import { pathOf, refOf } from "#storage/index"

test("una nota va en notes/ y un diagrama en diagrams/", (): void => {
  assert.equal(pathOf(noteRef(noteId("rota"))), "notes/rota.json")
  assert.equal(pathOf(diagramRef(diagramId("viaje"))), "diagrams/viaje.json")
})

test("un id con / no sale de su carpeta: se codifica como al guardar", (): void => {
  assert.equal(pathOf(noteRef(noteId("a/../b"))), "notes/a%2F..%2Fb.json")
})

test("un id que no se puede nombrar no tiene camino", (): void => {
  assert.equal(pathOf(noteRef(noteId("\uD800"))), null)
})

/* ── refOf, lo contrario ── */

test("refOf vuelve de un camino a su referencia, descodificando el id", (): void => {
  assert.deepEqual(refOf("notes/rota.json"), noteRef(noteId("rota")))
  assert.deepEqual(refOf("diagrams/viaje.json"), diagramRef(diagramId("viaje")))
  assert.deepEqual(refOf("notes/a%2F..%2Fb.json"), noteRef(noteId("a/../b")))
})

test("refOf no da referencia de lo que no es una nota ni un diagrama, ni de un nombre roto", (): void => {
  assert.equal(refOf("contexts/casa.json"), null)
  assert.equal(refOf("manifest.json"), null)
  assert.equal(refOf("notes/sub/x.json"), null)
  assert.equal(refOf("notes/%E0.json"), null)
})
