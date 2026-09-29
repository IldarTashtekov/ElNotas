/**
 * Las acciones sobre las notas de una ventana, compuestas con los casos de uso de
 * verdad: crear en el contexto, la papelera con sus dos significados y «Mover a…».
 */

import { test } from "node:test"
import assert from "node:assert/strict"

import type {
  AppState,
  Context,
  ContextId,
  IdGenerator,
  ItemRef,
  Note,
  NoteId,
  Store,
  UseCases,
} from "#core/index"
import { createStore, createUseCases, emptyAppState, noteId } from "#core/index"
import type { WindowRef } from "#ui/index"
import {
  GENERAL,
  NEW_NOTE_NAME,
  createNoteIn,
  deleteQuestion,
  moveNotes,
  moveTargets,
  trashDeletes,
  trashNotes,
} from "#ui/index"

interface Escenario {
  readonly store: Store
  readonly useCases: UseCases
  readonly compra: ContextId
  readonly casa: ContextId
  readonly leche: NoteId
  readonly pan: NoteId
}

/** Compra con Leche y Pan; Casa vacía. */
const escenario = (): Escenario => {
  let n: number = 0
  const ids: IdGenerator = { next: (): string => `id-${n++}` }
  const store: Store = createStore(emptyAppState())
  const useCases: UseCases = createUseCases({ clock: { now: (): number => 1 }, ids, store })
  const ctx = (nombre: string): ContextId => {
    const c: Context | null = useCases.createContext(nombre)
    if (c === null) assert.fail("el contexto tenía que crearse")
    return c.id
  }
  const compra: ContextId = ctx("Compra")
  const casa: ContextId = ctx("Casa")
  const enCompra: WindowRef = { kind: "context", id: compra }
  const nota = (): NoteId => {
    const creada: Note | null = createNoteIn(useCases, enCompra)
    if (creada === null) assert.fail("la nota tenía que crearse")
    return creada.id
  }
  return { store, useCases, compra, casa, leche: nota(), pan: nota() }
}

const itemsDe = (state: AppState, id: ContextId): ReadonlyArray<NoteId> =>
  (state.contexts[id]?.items ?? []).map((i: ItemRef): NoteId => noteId(i.id))

test("+ Nota en un contexto crea una «Nueva Nota» DENTRO de él", (): void => {
  const { store, compra, leche, pan } = escenario()
  assert.equal(store.getState().notes[leche]?.name, NEW_NOTE_NAME)
  assert.deepEqual(itemsDe(store.getState(), compra), [leche, pan])
})

test("+ Nota desde el General la crea sin contexto", (): void => {
  const { store, useCases, compra, casa } = escenario()
  const suelta: Note | null = createNoteIn(useCases, GENERAL)
  assert.notEqual(suelta, null)
  assert.equal(itemsDe(store.getState(), compra).length, 2)
  assert.equal(itemsDe(store.getState(), casa).length, 0)
})

test("la papelera de un contexto QUITA de él, y la nota sigue existiendo", (): void => {
  const { store, useCases, compra, leche, pan } = escenario()
  assert.equal(trashDeletes({ kind: "context", id: compra }), false)
  trashNotes(useCases, { kind: "context", id: compra }, [leche])

  assert.deepEqual(itemsDe(store.getState(), compra), [pan])
  assert.notEqual(store.getState().notes[leche], undefined)
})

test("la papelera del General BORRA de verdad, y de todos los contextos", (): void => {
  const { store, useCases, compra, leche, pan } = escenario()
  assert.equal(trashDeletes(GENERAL), true)
  trashNotes(useCases, GENERAL, [leche])

  assert.equal(store.getState().notes[leche], undefined)
  assert.deepEqual(itemsDe(store.getState(), compra), [pan])
})

test("Mover a… desde un contexto MUEVE: quita de éste y añade al destino", (): void => {
  const { store, useCases, compra, casa, leche, pan } = escenario()
  moveNotes(useCases, { kind: "context", id: compra }, casa, [leche])

  assert.deepEqual(itemsDe(store.getState(), compra), [pan])
  assert.deepEqual(itemsDe(store.getState(), casa), [leche])
})

test("Mover a… desde el General sólo añade: no toca donde ya estuviera", (): void => {
  const { store, useCases, compra, casa, leche, pan } = escenario()
  moveNotes(useCases, GENERAL, casa, [leche])

  assert.deepEqual(itemsDe(store.getState(), compra), [leche, pan])
  assert.deepEqual(itemsDe(store.getState(), casa), [leche])
})

test("Mover a… una nota que ya estaba en el destino no la duplica", (): void => {
  const { store, useCases, compra, casa, leche } = escenario()
  moveNotes(useCases, GENERAL, casa, [leche])
  moveNotes(useCases, { kind: "context", id: compra }, casa, [leche])

  assert.deepEqual(itemsDe(store.getState(), casa), [leche])
})

test("los destinos: ni el General ni el contexto actual, por nombre", (): void => {
  const { store, compra } = escenario()
  const nombres = (desde: WindowRef): ReadonlyArray<string> =>
    moveTargets(store.getState(), desde).map((c: Context): string => c.name)

  assert.deepEqual(nombres({ kind: "context", id: compra }), ["Casa"])
  assert.deepEqual(nombres(GENERAL), ["Casa", "Compra"])
})

test("la pregunta de borrar nombra la nota, o cuenta cuántas", (): void => {
  const { store, leche, pan } = escenario()
  const notas: ReadonlyArray<Note> = [leche, pan]
    .map((id: NoteId): Note | undefined => store.getState().notes[id])
    .filter((n: Note | undefined): n is Note => n !== undefined)
  assert.match(deleteQuestion(notas.slice(0, 1)), /«Nueva Nota»/)
  assert.match(deleteQuestion(notas), /2 notas/)
})
