/**
 * Lo abierto encima de la ventana en `localStorage`: que lo que lanza el
 * navegador salga por `Result`, y que al recargar se vuelva a abrir lo mismo.
 */

import { test } from "node:test"
import assert from "node:assert/strict"

import type { Clock, Diagram, IdGenerator, Note, Result, StorageError, Store, UseCases } from "#core/index"
import { createStore, createUseCases, emptyAppState } from "#core/index"
import type { OpenLayers, OpenLayersPersistence } from "#ui/index"
import { layersToRestore } from "#ui/index"
import { OPEN_LAYERS_KEY, createLocalStorageOpenLayers } from "#platform/index"

import type { FakeStorage } from "../../storage/blobs/FakeStorage"
import { createFakeStorage, excepcionDeCuota } from "../../storage/blobs/FakeStorage"

const errorDe = <T>(r: Result<T, StorageError>): StorageError => {
  if (r.ok) assert.fail("tenía que fallar")
  return r.error
}

test("sin nada guardado, load devuelve null", (): void => {
  assert.deepEqual(createLocalStorageOpenLayers(createFakeStorage()).load(), { ok: true, value: null })
})

test("un JSON roto en la clave sale como corrupt, sin lanzar", (): void => {
  const almacen: FakeStorage = createFakeStorage()
  almacen.escribirCrudo(OPEN_LAYERS_KEY, "[roto")
  assert.equal(errorDe(createLocalStorageOpenLayers(almacen).load()).kind, "corrupt")
})

test("un getItem que lanza sale como io, sin lanzar", (): void => {
  const almacen: FakeStorage = createFakeStorage()
  almacen.lanzarEn("getItem", new DOMException("bloqueado", "SecurityError"))
  assert.equal(errorDe(createLocalStorageOpenLayers(almacen).load()).kind, "io")
})

test("un setItem que lanza sale por Result, sin lanzar", (): void => {
  const almacen: FakeStorage = createFakeStorage()
  almacen.lanzarEn("setItem", excepcionDeCuota())
  assert.equal(errorDe(createLocalStorageOpenLayers(almacen).save([])).kind, "io")
})

test("AL RECARGAR, se vuelve a abrir el diagrama y la nota que había encima", (): void => {
  const almacen: FakeStorage = createFakeStorage()
  let n: number = 0
  const clock: Clock = { now: (): number => 1000 }
  const ids: IdGenerator = { next: (): string => `id-${n++}` }
  const store: Store = createStore(emptyAppState())
  const useCases: UseCases = createUseCases({ clock, ids, store })
  const plano: Diagram | null = useCases.createDiagram("Plano")
  const nota: Note | null = useCases.createNote("Nota")
  if (plano === null || nota === null) assert.fail("tenían que crearse")
  const capas: OpenLayers = [
    { kind: "diagram", id: plano.id },
    { kind: "note", id: nota.id },
  ]

  createLocalStorageOpenLayers(almacen).save(capas)

  const despues: OpenLayersPersistence = createLocalStorageOpenLayers(almacen)
  assert.deepEqual(layersToRestore(despues, store.getState()), capas)
})
