/**
 * Las ventanas en `localStorage`: que lo que lanza el navegador salga por
 * `Result`, y que al recargar se vuelva a la ventana en la que se estaba.
 */

import { test } from "node:test"
import assert from "node:assert/strict"

import type { Context, IdGenerator, Result, StorageError, Store, UseCases } from "#core/index"
import { createStore, createUseCases, emptyAppState } from "#core/index"
import type { WindowRef, WindowsModel, WindowsPersistence } from "#ui/index"
import { DEFAULT_LAYOUT, GENERAL, createWindowsModel } from "#ui/index"
import { WINDOWS_KEY, createLocalStorageWindows } from "#platform/index"

import type { FakeStorage } from "../../storage/blobs/FakeStorage"
import { createFakeStorage, excepcionDeCuota } from "../../storage/blobs/FakeStorage"

const errorDe = <T>(r: Result<T, StorageError>): StorageError => {
  if (r.ok) assert.fail("tenía que fallar")
  return r.error
}

test("sin nada guardado, load devuelve null", (): void => {
  assert.deepEqual(createLocalStorageWindows(createFakeStorage()).load(), { ok: true, value: null })
})

test("lo guardado se lee igual", (): void => {
  const persistence: WindowsPersistence = createLocalStorageWindows(createFakeStorage())
  persistence.save(DEFAULT_LAYOUT)
  assert.deepEqual(persistence.load(), { ok: true, value: DEFAULT_LAYOUT })
})

test("un JSON roto en la clave sale como corrupt, sin lanzar", (): void => {
  const almacen: FakeStorage = createFakeStorage()
  almacen.escribirCrudo(WINDOWS_KEY, "{roto")
  assert.equal(errorDe(createLocalStorageWindows(almacen).load()).kind, "corrupt")
})

test("un getItem que lanza sale como io, sin lanzar", (): void => {
  const almacen: FakeStorage = createFakeStorage()
  almacen.lanzarEn("getItem", new DOMException("bloqueado", "SecurityError"))
  assert.equal(errorDe(createLocalStorageWindows(almacen).load()).kind, "io")
})

test("un setItem que lanza sale por Result, sin lanzar", (): void => {
  const almacen: FakeStorage = createFakeStorage()
  almacen.lanzarEn("setItem", excepcionDeCuota())
  assert.equal(errorDe(createLocalStorageWindows(almacen).save(DEFAULT_LAYOUT)).kind, "io")
})

const idsSecuenciales = (): IdGenerator => {
  let n: number = 0
  return { next: (): string => `id-${n++}` }
}

test("AL RECARGAR se vuelve a la ventana activa", (): void => {
  const almacen: FakeStorage = createFakeStorage()
  const store: Store = createStore(emptyAppState())
  const useCases: UseCases = createUseCases({
    clock: { now: (): number => 1000 },
    ids: idsSecuenciales(),
    store,
  })
  const casa: Context | null = useCases.createContext("Casa")
  if (casa === null) assert.fail("el contexto tenía que crearse")
  const ventanaCasa: WindowRef = { kind: "context", id: casa.id }

  /* Una sesión deja la lista con dos ventanas y la de Casa activa… */
  createLocalStorageWindows(almacen).save({ windows: [GENERAL, ventanaCasa], active: GENERAL })
  const primera: WindowsModel = createWindowsModel({
    store,
    persistence: createLocalStorageWindows(almacen),
  })
  primera.setActive(ventanaCasa)

  /* …y la siguiente, con todo nuevo salvo el almacén, vuelve a ella. */
  const segunda: WindowsModel = createWindowsModel({
    store,
    persistence: createLocalStorageWindows(almacen),
  })
  assert.deepEqual(segunda.getLayout(), { windows: [GENERAL, ventanaCasa], active: ventanaCasa })
})
