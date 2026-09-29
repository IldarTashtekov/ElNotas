/**
 * La selección como conjunto inmutable: identidad cuando no cambia nada.
 */

import { test } from "node:test"
import assert from "node:assert/strict"

import type { NoteId } from "#core/index"
import { noteId } from "#core/index"
import type { Selection } from "#ui/index"
import { NO_SELECTION, pruneSelected, toggleSelected } from "#ui/index"

const A: NoteId = noteId("a")
const B: NoteId = noteId("b")

test("alternar pone y quita", (): void => {
  const una: Selection = toggleSelected(NO_SELECTION, A)
  assert.deepEqual([...una], [A])
  assert.deepEqual([...toggleSelected(una, B)].sort(), [A, B])
})

test("quitar la última devuelve LA selección vacía, no otra", (): void => {
  assert.strictEqual(toggleSelected(toggleSelected(NO_SELECTION, A), A), NO_SELECTION)
})

test("alternar no toca el conjunto de entrada", (): void => {
  const una: Selection = toggleSelected(NO_SELECTION, A)
  toggleSelected(una, B)
  assert.deepEqual([...una], [A])
})

test("podar sin que falte ninguna devuelve el MISMO conjunto", (): void => {
  const dos: Selection = toggleSelected(toggleSelected(NO_SELECTION, A), B)
  assert.strictEqual(pruneSelected(dos, [A, B, noteId("c")]), dos)
})

test("podar quita las que ya no están, y sin ninguna da la vacía", (): void => {
  const dos: Selection = toggleSelected(toggleSelected(NO_SELECTION, A), B)
  assert.deepEqual([...pruneSelected(dos, [B])], [B])
  assert.strictEqual(pruneSelected(dos, []), NO_SELECTION)
})
