/**
 * Las acciones sobre lo que lista una ventana, compuestas con los casos de uso de
 * verdad: crear en el contexto, la papelera con sus dos significados y «Mover a…»,
 * con notas y con diagramas.
 */

import { test } from "node:test"
import assert from "node:assert/strict"

import type {
  AppState,
  Context,
  ContextId,
  Diagram,
  DiagramId,
  IdGenerator,
  ItemRef,
  Note,
  NoteId,
  Store,
  UseCases,
} from "#core/index"
import { createStore, createUseCases, diagramRef, noteId, noteRef } from "#core/index"
import { emptyAppState } from "#core/domain/AppState"
import type { ListItem } from "#ui/windowView"
import type { WindowRef } from "#ui/windows"
import { GENERAL } from "#ui/windows"
import {
  NEW_CONTEXT_NAME,
  NEW_DIAGRAM_NAME,
  NEW_NOTE_NAME,
  contextsWith,
  createAsWindow,
  createDiagramIn,
  createNoteForDiagram,
  createNoteIn,
  deleteQuestion,
  moveItems,
  moveTargets,
  trashDeletes,
  trashItems,
} from "#ui/noteActions"

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

test("+ Contexto nuevo como ventana: un «Nuevo contexto» vacío, y su ventana", (): void => {
  const { store, useCases, compra } = escenario()
  const ref: WindowRef | null = createAsWindow(useCases, "context")
  if (ref === null || ref.kind !== "context") return assert.fail("tenía que dar una ventana de contexto")

  assert.equal(store.getState().contexts[ref.id]?.name, NEW_CONTEXT_NAME)
  assert.equal(itemsDe(store.getState(), ref.id).length, 0)
  assert.equal(itemsDe(store.getState(), compra).length, 2)
})

test("+ Nota nueva como ventana: una «Nueva Nota» sin contexto, y su ventana", (): void => {
  const { store, useCases, compra, casa } = escenario()
  const ref: WindowRef | null = createAsWindow(useCases, "note")
  if (ref === null || ref.kind !== "note") return assert.fail("tenía que dar una ventana de nota")

  assert.equal(store.getState().notes[ref.id]?.name, NEW_NOTE_NAME)
  assert.equal(itemsDe(store.getState(), compra).length, 2)
  assert.equal(itemsDe(store.getState(), casa).length, 0)
})

test("+ Diagrama nuevo como ventana: un «Nuevo diagrama» sin contexto, y su ventana", (): void => {
  const { store, useCases, compra, casa } = escenario()
  const ref: WindowRef | null = createAsWindow(useCases, "diagram")
  if (ref === null || ref.kind !== "diagram") return assert.fail("tenía que dar una ventana de diagrama")

  assert.equal(store.getState().diagrams[ref.id]?.name, NEW_DIAGRAM_NAME)
  assert.equal(itemsDe(store.getState(), compra).length, 2)
  assert.equal(itemsDe(store.getState(), casa).length, 0)
})

test("la papelera de un contexto QUITA de él, y la nota sigue existiendo", (): void => {
  const { store, useCases, compra, leche, pan } = escenario()
  assert.equal(trashDeletes({ kind: "context", id: compra }), false)
  trashItems(useCases, { kind: "context", id: compra }, [noteRef(leche)])

  assert.deepEqual(itemsDe(store.getState(), compra), [pan])
  assert.notEqual(store.getState().notes[leche], undefined)
})

test("la papelera del General BORRA de verdad, y de todos los contextos", (): void => {
  const { store, useCases, compra, leche, pan } = escenario()
  assert.equal(trashDeletes(GENERAL), true)
  trashItems(useCases, GENERAL, [noteRef(leche)])

  assert.equal(store.getState().notes[leche], undefined)
  assert.deepEqual(itemsDe(store.getState(), compra), [pan])
})

test("Mover a… desde un contexto MUEVE: quita de éste y añade al destino", (): void => {
  const { store, useCases, compra, casa, leche, pan } = escenario()
  moveItems(useCases, { kind: "context", id: compra }, casa, [noteRef(leche)])

  assert.deepEqual(itemsDe(store.getState(), compra), [pan])
  assert.deepEqual(itemsDe(store.getState(), casa), [leche])
})

test("Mover a… desde el General sólo añade: no toca donde ya estuviera", (): void => {
  const { store, useCases, compra, casa, leche, pan } = escenario()
  moveItems(useCases, GENERAL, casa, [noteRef(leche)])

  assert.deepEqual(itemsDe(store.getState(), compra), [leche, pan])
  assert.deepEqual(itemsDe(store.getState(), casa), [leche])
})

test("Mover a… una nota que ya estaba en el destino no la duplica", (): void => {
  const { store, useCases, compra, casa, leche } = escenario()
  moveItems(useCases, GENERAL, casa, [noteRef(leche)])
  moveItems(useCases, { kind: "context", id: compra }, casa, [noteRef(leche)])

  assert.deepEqual(itemsDe(store.getState(), casa), [leche])
})

test("los destinos: ni el General ni el contexto actual, por nombre", (): void => {
  const { store, compra } = escenario()
  const nombres = (desde: WindowRef): ReadonlyArray<string> =>
    moveTargets(store.getState(), desde).map((c: Context): string => c.name)

  assert.deepEqual(nombres({ kind: "context", id: compra }), ["Casa"])
  assert.deepEqual(nombres(GENERAL), ["Casa", "Compra"])
})

const filaNota = (name: string): ListItem => ({ ref: noteRef(noteId(name)), name })
const filaDiagrama = (name: string, d: DiagramId): ListItem => ({ ref: diagramRef(d), name })

test("la pregunta de borrar nombra lo que borra, o cuenta cuántas notas", (): void => {
  assert.match(deleteQuestion([filaNota("Leche")]), /«Leche»/)
  assert.match(deleteQuestion([filaNota("Leche"), filaNota("Pan")]), /2 notas/)
})

/* ──────────────────────────────── Diagramas ──────────────────────────────── */

/** Un diagrama creado en Compra, para las pruebas de abajo. */
const conDiagrama = (): Escenario & { readonly mudanza: DiagramId } => {
  const e: Escenario = escenario()
  const d: Diagram | null = createDiagramIn(e.useCases, { kind: "context", id: e.compra })
  if (d === null) assert.fail("el diagrama tenía que crearse")
  return { ...e, mudanza: d.id }
}

const refsDe = (state: AppState, id: ContextId): ReadonlyArray<ItemRef> =>
  state.contexts[id]?.items ?? []

test("+ Diagrama en un contexto crea un «Nuevo diagrama» DENTRO de él, detrás de las notas", (): void => {
  const { store, compra, leche, pan, mudanza } = conDiagrama()
  assert.equal(store.getState().diagrams[mudanza]?.name, NEW_DIAGRAM_NAME)
  assert.deepEqual(refsDe(store.getState(), compra), [
    noteRef(leche),
    noteRef(pan),
    diagramRef(mudanza),
  ])
})

test("+ Diagrama desde el General lo crea sin contexto", (): void => {
  const { store, useCases, compra, casa } = escenario()
  const suelto: Diagram | null = createDiagramIn(useCases, GENERAL)
  assert.notEqual(suelto, null)
  assert.equal(refsDe(store.getState(), compra).length, 2)
  assert.equal(refsDe(store.getState(), casa).length, 0)
})

test("la papelera de un contexto QUITA el diagrama de él, y sigue existiendo", (): void => {
  const { store, useCases, compra, mudanza } = conDiagrama()
  trashItems(useCases, { kind: "context", id: compra }, [diagramRef(mudanza)])
  assert.equal(refsDe(store.getState(), compra).length, 2)
  assert.notEqual(store.getState().diagrams[mudanza], undefined)
})

test("la papelera del General BORRA el diagrama de verdad, y lo quita de los contextos", (): void => {
  const { store, useCases, compra, mudanza } = conDiagrama()
  trashItems(useCases, GENERAL, [diagramRef(mudanza)])
  assert.equal(store.getState().diagrams[mudanza], undefined)
  assert.equal(refsDe(store.getState(), compra).length, 2)
})

test("la papelera del General con una nota y un diagrama borra los dos", (): void => {
  const { store, useCases, leche, mudanza } = conDiagrama()
  trashItems(useCases, GENERAL, [noteRef(leche), diagramRef(mudanza)])
  assert.equal(store.getState().notes[leche], undefined)
  assert.equal(store.getState().diagrams[mudanza], undefined)
})

test("Mover a… mueve un diagrama igual que una nota", (): void => {
  const { store, useCases, compra, casa, mudanza } = conDiagrama()
  moveItems(useCases, { kind: "context", id: compra }, casa, [diagramRef(mudanza)])
  assert.deepEqual(refsDe(store.getState(), casa), [diagramRef(mudanza)])
  assert.equal(refsDe(store.getState(), compra).length, 2)
})

test("la pregunta de borrar cuenta diagramas, o elementos si van mezclados", (): void => {
  const d: DiagramId = conDiagrama().mudanza
  assert.match(deleteQuestion([filaDiagrama("Mudanza", d)]), /«Mudanza»/)
  assert.match(deleteQuestion([filaDiagrama("A", d), filaDiagrama("B", d)]), /2 diagramas/)
  assert.match(deleteQuestion([filaNota("Leche"), filaDiagrama("Mudanza", d)]), /2 elementos/)
})

/* ────────────────────── Una nota nueva desde un diagrama ──────────────────── */

test("contextsWith da los contextos que listan algo, por nombre", (): void => {
  const { store, useCases, compra, casa, mudanza } = conDiagrama()
  useCases.addItem(casa, diagramRef(mudanza))
  const nombres: ReadonlyArray<string> = contextsWith(store.getState(), diagramRef(mudanza)).map(
    (c: Context): string => c.name,
  )
  assert.deepEqual(nombres, ["Casa", "Compra"])
  assert.deepEqual(contextsWith(store.getState(), diagramRef(mudanza)).map((c: Context): ContextId => c.id), [casa, compra])
})

test("contextsWith no confunde un diagrama con una nota del mismo id", (): void => {
  const { store, leche } = escenario()
  assert.deepEqual(contextsWith(store.getState(), diagramRef(leche as unknown as DiagramId)), [])
})

test("la nota nueva de un diagrama va a TODOS los contextos donde está el diagrama", (): void => {
  const { store, useCases, compra, casa, mudanza } = conDiagrama()
  useCases.addItem(casa, diagramRef(mudanza))
  const nota: Note | null = createNoteForDiagram(useCases, store.getState(), mudanza)
  if (nota === null) assert.fail("la nota tenía que crearse")

  assert.equal(nota.name, NEW_NOTE_NAME)
  assert.ok(refsDe(store.getState(), compra).some((r: ItemRef): boolean => r.id === nota.id))
  assert.ok(refsDe(store.getState(), casa).some((r: ItemRef): boolean => r.id === nota.id))
})

test("la nota nueva de un diagrama que no está en ningún contexto no va a ninguno", (): void => {
  const { store, useCases, compra, casa } = escenario()
  const suelto: Diagram | null = createDiagramIn(useCases, GENERAL)
  if (suelto === null) assert.fail("el diagrama tenía que crearse")
  const nota: Note | null = createNoteForDiagram(useCases, store.getState(), suelto.id)

  assert.notEqual(nota, null)
  assert.equal(refsDe(store.getState(), compra).length, 2)
  assert.equal(refsDe(store.getState(), casa).length, 0)
})
