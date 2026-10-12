/**
 * Los encuadres en `localStorage`: que lo que lanza el navegador salga por
 * `Result`, y que al recargar cada diagrama vuelva a donde se miraba.
 */

import { test } from "node:test"
import assert from "node:assert/strict"

import type { Clock, Diagram, IdGenerator, Result, StorageError, Store, UseCases } from "#core/index"
import { createStore, createUseCases, emptyAppState } from "#core/index"
import type { DiagramFraming, FramingPersistence, Framings } from "#ui/index"
import { createDiagramFraming } from "#ui/index"
import { FRAMING_KEY, createLocalStorageFraming } from "#platform/index"

import type { FakeStorage } from "../../storage/blobs/FakeStorage"
import { createFakeStorage, excepcionDeCuota } from "../../storage/blobs/FakeStorage"

const ENCUADRES: Framings = { d1: { x: 10, y: -20, scale: 2 } }

const errorDe = <T>(r: Result<T, StorageError>): StorageError => {
  if (r.ok) assert.fail("tenía que fallar")
  return r.error
}

test("sin nada guardado, load devuelve null", (): void => {
  assert.deepEqual(createLocalStorageFraming(createFakeStorage()).load(), { ok: true, value: null })
})

test("lo guardado se lee igual", (): void => {
  const persistence: FramingPersistence = createLocalStorageFraming(createFakeStorage())
  persistence.save(ENCUADRES)
  assert.deepEqual(persistence.load(), { ok: true, value: ENCUADRES })
})

test("un JSON roto en la clave sale como corrupt, sin lanzar", (): void => {
  const almacen: FakeStorage = createFakeStorage()
  almacen.escribirCrudo(FRAMING_KEY, "{roto")
  assert.equal(errorDe(createLocalStorageFraming(almacen).load()).kind, "corrupt")
})

test("un getItem que lanza sale como io, sin lanzar", (): void => {
  const almacen: FakeStorage = createFakeStorage()
  almacen.lanzarEn("getItem", new DOMException("bloqueado", "SecurityError"))
  assert.equal(errorDe(createLocalStorageFraming(almacen).load()).kind, "io")
})

test("un setItem que lanza sale por Result, sin lanzar", (): void => {
  const almacen: FakeStorage = createFakeStorage()
  almacen.lanzarEn("setItem", excepcionDeCuota())
  assert.equal(errorDe(createLocalStorageFraming(almacen).save(ENCUADRES)).kind, "io")
})

test("AL RECARGAR, el diagrama vuelve a donde se miraba", (): void => {
  const almacen: FakeStorage = createFakeStorage()
  let n: number = 0
  const clock: Clock = { now: (): number => 1000 }
  const ids: IdGenerator = { next: (): string => `id-${n++}` }
  const store: Store = createStore(emptyAppState())
  const useCases: UseCases = createUseCases({ clock, ids, store })
  const plano: Diagram | null = useCases.createDiagram("Plano")
  if (plano === null) assert.fail("el diagrama tenía que crearse")

  const antes: DiagramFraming = createDiagramFraming({
    store,
    persistence: createLocalStorageFraming(almacen),
  })
  antes.remember(plano.id, { x: 7, y: 8, scale: 3 })
  antes.save()

  const despues: DiagramFraming = createDiagramFraming({
    store,
    persistence: createLocalStorageFraming(almacen),
  })
  assert.deepEqual(despues.get(plano.id), { x: 7, y: 8, scale: 3 })
})
