/**
 * Lo abierto encima de la ventana, sobre el `Store` de verdad: que lo leído se
 * valide con la forma en que se abren las vistas, y que al arrancar no se abra
 * nada que ya no esté, ni lo que iba encima de ello.
 */

import { test } from "node:test"
import assert from "node:assert/strict"

import type {
  Clock,
  Diagram,
  IdGenerator,
  Note,
  Result,
  StorageError,
  Store,
  UseCases,
} from "#core/index"
import { createStore, createUseCases, diagramId, err, noteId, ok } from "#core/index"
import { emptyAppState } from "#core/domain/AppState"
import type { OpenLayers, OpenLayersPersistence } from "#ui/index"
import { NO_LAYERS, guardOpenLayers, layersToRestore, parseOpenLayers } from "#ui/openLayers"

interface Escenario {
  readonly store: Store
  readonly useCases: UseCases
  readonly nota: Note
  readonly diagrama: Diagram
}

const escenario = (): Escenario => {
  let n: number = 0
  const clock: Clock = { now: (): number => 1000 }
  const ids: IdGenerator = { next: (): string => `id-${n++}` }
  const store: Store = createStore(emptyAppState())
  const useCases: UseCases = createUseCases({ clock, ids, store })
  const nota: Note | null = useCases.createNote("Nota")
  const diagrama: Diagram | null = useCases.createDiagram("Plano")
  if (nota === null || diagrama === null) assert.fail("tenían que crearse")
  return { store, useCases, nota, diagrama }
}

const almacen = (leido: Result<unknown, StorageError>): OpenLayersPersistence => ({
  load: (): Result<unknown, StorageError> => leido,
  save: (): Result<void, StorageError> => ok(undefined),
})

/* ── Leer lo guardado ── */

test("sin nada guardado, o sin forma de lista, no se abre nada", (): void => {
  assert.deepEqual(parseOpenLayers(null), [])
  assert.deepEqual(parseOpenLayers({ kind: "note", id: "n" }), [])
  assert.deepEqual(parseOpenLayers("[]"), [])
})

test("una nota, un diagrama, o un diagrama y una nota encima, entran tal cual", (): void => {
  const nota: unknown = { kind: "note", id: "n" }
  const diagrama: unknown = { kind: "diagram", id: "d" }
  assert.deepEqual(parseOpenLayers([nota]), [nota])
  assert.deepEqual(parseOpenLayers([diagrama]), [diagrama])
  assert.deepEqual(parseOpenLayers([diagrama, nota]), [diagrama, nota])
})

test("se queda con las de abajo hasta la primera que no tiene forma", (): void => {
  const diagrama: unknown = { kind: "diagram", id: "d" }
  assert.deepEqual(parseOpenLayers([diagrama, { kind: "note", id: 7 }]), [diagrama])
  assert.deepEqual(parseOpenLayers([{ kind: "settings", id: "s" }, diagrama]), [])
  assert.deepEqual(parseOpenLayers([null, diagrama]), [])
})

test("lo que en la app no puede abrirse así se corta: sólo una nota encima de un diagrama", (): void => {
  const nota: unknown = { kind: "note", id: "n" }
  const diagrama: unknown = { kind: "diagram", id: "d" }
  assert.deepEqual(parseOpenLayers([nota, nota]), [nota])
  assert.deepEqual(parseOpenLayers([nota, diagrama]), [nota])
  assert.deepEqual(parseOpenLayers([diagrama, diagrama]), [diagrama])
  assert.deepEqual(parseOpenLayers([diagrama, nota, nota]), [diagrama, nota])
})

/* ── Lo que ya no está ── */

test("si están todas, devuelve LAS MISMAS capas", (): void => {
  const { store, nota, diagrama }: Escenario = escenario()
  const capas: OpenLayers = [
    { kind: "diagram", id: diagrama.id },
    { kind: "note", id: nota.id },
  ]
  assert.strictEqual(guardOpenLayers(capas, store.getState()), capas)
})

test("una nota borrada no se abre", (): void => {
  const { store, useCases, nota, diagrama }: Escenario = escenario()
  useCases.deleteNote(nota.id)
  assert.deepEqual(
    guardOpenLayers(
      [
        { kind: "diagram", id: diagrama.id },
        { kind: "note", id: nota.id },
      ],
      store.getState(),
    ),
    [{ kind: "diagram", id: diagrama.id }],
  )
})

test("un diagrama borrado no se abre, ni la nota que iba encima", (): void => {
  const { store, useCases, nota, diagrama }: Escenario = escenario()
  useCases.deleteDiagram(diagrama.id)
  assert.deepEqual(
    guardOpenLayers(
      [
        { kind: "diagram", id: diagrama.id },
        { kind: "note", id: nota.id },
      ],
      store.getState(),
    ),
    [],
  )
})

test("una nota y un diagrama no se confunden aunque compartan id", (): void => {
  const { store, nota, diagrama }: Escenario = escenario()
  assert.deepEqual(guardOpenLayers([{ kind: "note", id: noteId(diagrama.id) }], store.getState()), [])
  assert.deepEqual(guardOpenLayers([{ kind: "diagram", id: diagramId(nota.id) }], store.getState()), [])
})

/* ── Al arrancar ── */

test("al arrancar se abre lo guardado que sigue ahí", (): void => {
  const { store, nota }: Escenario = escenario()
  assert.deepEqual(
    layersToRestore(almacen(ok([{ kind: "note", id: nota.id }])), store.getState()),
    [{ kind: "note", id: nota.id }],
  )
})

test("al arrancar, lo guardado que ya no está no se abre", (): void => {
  const { store, useCases, nota, diagrama }: Escenario = escenario()
  useCases.deleteNote(nota.id)
  const guardado: unknown = [
    { kind: "diagram", id: diagrama.id },
    { kind: "note", id: nota.id },
  ]
  assert.deepEqual(layersToRestore(almacen(ok(guardado)), store.getState()), [
    { kind: "diagram", id: diagrama.id },
  ])
})

test("si no se puede leer, no se abre nada", (): void => {
  const { store }: Escenario = escenario()
  const fallo: StorageError = { kind: "io", cause: new Error("bloqueado") }
  assert.strictEqual(layersToRestore(almacen(err(fallo)), store.getState()), NO_LAYERS)
})
