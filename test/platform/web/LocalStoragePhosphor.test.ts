/**
 * El color del fósforo en `localStorage`: que lo que lanza el navegador salga
 * por `Result`, y que al recargar vuelva el color elegido.
 */

import { test } from "node:test"
import assert from "node:assert/strict"

import type { Result, StorageError } from "#core/index"
import type { Phosphor, PhosphorPersistence, PhosphorSetting } from "#ui/index"
import { createPhosphorSetting } from "#ui/index"
import { PHOSPHOR_KEY, createLocalStoragePhosphor } from "#platform/web/LocalStoragePhosphor"
import { requestReset, resetIfRequested } from "#platform/web/resetStorage"

import type { FakeStorage } from "../../storage/blobs/FakeStorage"
import { createFakeStorage, excepcionDeCuota } from "../../storage/blobs/FakeStorage"
import { silentLogger } from "../../core/ports/FakeLogger"

const errorDe = <T>(r: Result<T, StorageError>): StorageError => {
  if (r.ok) assert.fail("tenía que fallar")
  return r.error
}

test("sin nada guardado, load devuelve null", (): void => {
  assert.deepEqual(createLocalStoragePhosphor(createFakeStorage()).load(), { ok: true, value: null })
})

test("lo guardado se lee igual, en su clave", (): void => {
  const almacen: FakeStorage = createFakeStorage()
  const persistence: PhosphorPersistence = createLocalStoragePhosphor(almacen)
  persistence.save("green")
  assert.deepEqual(persistence.load(), { ok: true, value: "green" })
  assert.equal(almacen.getItem(PHOSPHOR_KEY), "green")
})

test("un getItem que lanza sale como io, sin lanzar", (): void => {
  const almacen: FakeStorage = createFakeStorage()
  almacen.lanzarEn("getItem", new DOMException("bloqueado", "SecurityError"))
  assert.equal(errorDe(createLocalStoragePhosphor(almacen).load()).kind, "io")
})

test("un setItem que lanza sale por Result, sin lanzar", (): void => {
  const almacen: FakeStorage = createFakeStorage()
  almacen.lanzarEn("setItem", excepcionDeCuota())
  assert.equal(errorDe(createLocalStoragePhosphor(almacen).save("green")).kind, "io")
})

const ajuste = (almacen: FakeStorage): PhosphorSetting =>
  createPhosphorSetting({
    logger: silentLogger,
    persistence: createLocalStoragePhosphor(almacen),
    apply: (_: Phosphor): void => {},
  })

test("AL RECARGAR vuelve el color elegido", (): void => {
  const almacen: FakeStorage = createFakeStorage()
  ajuste(almacen).set("green")
  assert.equal(ajuste(almacen).get(), "green")
})

test("«Borrar todo» se lleva también el color", (): void => {
  const almacen: FakeStorage = createFakeStorage()
  ajuste(almacen).set("green")
  assert.equal(requestReset(almacen), true)
  resetIfRequested(almacen)
  assert.equal(ajuste(almacen).get(), "amber")
})
