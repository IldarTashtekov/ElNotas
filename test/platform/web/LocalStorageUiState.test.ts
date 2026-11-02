/**
 * El estado de la UI en `localStorage`: que lo que lanza el navegador salga por
 * `Result`, que se quiten las claves de antes y que, al recargar, cada sección
 * vuelva como se dejó.
 */

import { test } from "node:test"
import assert from "node:assert/strict"

import type { Result, StorageError } from "#core/index"
import type { PhosphorSetting, UiStatePersistence } from "#ui/index"
import { createPhosphorSetting, parseUiState, uiStateSection } from "#ui/index"
import type { CalendarTabSetting } from "#ui/calendarTab"
import { createCalendarTabSetting } from "#ui/calendarTab"
import {
  OLD_UI_KEYS,
  UI_STATE_KEY,
  createLocalStorageUiState,
  forgetOldUiKeys,
} from "#platform/web/LocalStorageUiState"
import { RESET_KEY, resetIfRequested } from "#platform/web/resetStorage"

import type { FakeStorage } from "../../storage/blobs/FakeStorage"
import { createFakeStorage, excepcionDeCuota } from "../../storage/blobs/FakeStorage"
import { silentLogger } from "../../core/ports/FakeLogger"

const sinPintar = (): void => undefined

const errorDe =<T>(r: Result<T, StorageError>): StorageError => {
  if (r.ok) assert.fail("tenía que fallar")
  return r.error
}

test("sin nada guardado, load devuelve null", (): void => {
  assert.deepEqual(createLocalStorageUiState(createFakeStorage()).load(), { ok: true, value: null })
})

test("lo guardado se vuelve a leer igual", (): void => {
  const almacen: FakeStorage = createFakeStorage()
  createLocalStorageUiState(almacen).save({ phosphor: "amber", calendarTab: "routines" })
  assert.deepEqual(createLocalStorageUiState(almacen).load(), {
    ok: true,
    value: { phosphor: "amber", calendarTab: "routines" },
  })
})

test("un JSON roto en la clave sale como corrupt, sin lanzar", (): void => {
  const almacen: FakeStorage = createFakeStorage()
  almacen.escribirCrudo(UI_STATE_KEY, "{roto")
  assert.equal(errorDe(createLocalStorageUiState(almacen).load()).kind, "corrupt")
})

test("un getItem que lanza sale como io, sin lanzar", (): void => {
  const almacen: FakeStorage = createFakeStorage()
  almacen.lanzarEn("getItem", new DOMException("bloqueado", "SecurityError"))
  assert.equal(errorDe(createLocalStorageUiState(almacen).load()).kind, "io")
})

test("un setItem que lanza sale como io, sin lanzar", (): void => {
  const almacen: FakeStorage = createFakeStorage()
  almacen.lanzarEn("setItem", excepcionDeCuota())
  assert.equal(errorDe(createLocalStorageUiState(almacen).save({})).kind, "io")
})

test("se quitan las claves de antes, y sólo ésas", (): void => {
  const almacen: FakeStorage = createFakeStorage()
  for (const clave of OLD_UI_KEYS) almacen.setItem(clave, "x")
  almacen.setItem(UI_STATE_KEY, "{}")
  almacen.setItem("elnotas:capas", "[]")
  assert.equal(forgetOldUiKeys(almacen), true)
  assert.deepEqual([...almacen.claves()].sort(), ["elnotas:capas", UI_STATE_KEY])
})

test("si quitarlas lanza, lo dice sin lanzar", (): void => {
  const almacen: FakeStorage = createFakeStorage()
  almacen.lanzarEn("removeItem", new Error("bloqueado"))
  assert.equal(forgetOldUiKeys(almacen), false)
})

test("«Borrar todo» se lleva también el estado de la UI", (): void => {
  const almacen: FakeStorage = createFakeStorage()
  almacen.setItem(UI_STATE_KEY, '{"phosphor":"amber"}')
  almacen.setItem(RESET_KEY, "1")
  resetIfRequested(almacen)
  assert.equal(almacen.getItem(UI_STATE_KEY), null)
})

test("AL RECARGAR, el fósforo y la pestaña vuelven como se dejaron, cada uno en su sección", (): void => {
  const almacen: FakeStorage = createFakeStorage()
  const antes: UiStatePersistence = createLocalStorageUiState(almacen)
  createPhosphorSetting({ persistence: uiStateSection(antes, "phosphor"), apply: sinPintar, logger: silentLogger }).set("magenta")
  createCalendarTabSetting({ persistence: uiStateSection(antes, "calendarTab"), logger: silentLogger }).set("routines")

  const despues: UiStatePersistence = createLocalStorageUiState(almacen)
  const fosforo: PhosphorSetting = createPhosphorSetting({
    persistence: uiStateSection(despues, "phosphor"),
    apply: sinPintar,
    logger: silentLogger,
  })
  const pestana: CalendarTabSetting = createCalendarTabSetting({
    persistence: uiStateSection(despues, "calendarTab"),
    logger: silentLogger,
  })
  assert.equal(fosforo.get(), "magenta")
  assert.equal(pestana.get(), "routines")
  const leido: Result<unknown, StorageError> = despues.load()
  if (!leido.ok) assert.fail("tenía que leerse")
  assert.equal(parseUiState(leido.value).phosphor, "magenta")
})
