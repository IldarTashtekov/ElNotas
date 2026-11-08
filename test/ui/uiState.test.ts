/**
 * El estado de la UI en un objeto: que leerlo valide cada sección por su lado y
 * que guardar una sección deje las demás como estaban, también cuando lo
 * guardado no se puede leer.
 */

import { test } from "node:test"
import assert from "node:assert/strict"

import type { Result, StorageError } from "#core/index"
import { err, ok } from "#core/index"
import type { StoredUiState, UiState, UiStatePersistence, UiStateSection } from "#ui/uiState"
import { parseUiState, uiStateSection } from "#ui/uiState"
import { DEFAULT_LAYOUT } from "#ui/windows"

interface AlmacenFalso extends UiStatePersistence {
  readonly guardados: () => ReadonlyArray<StoredUiState>
}

/** Una persistencia que lee lo último guardado, o `leido` mientras no se guarde nada. */
const almacen = (leido: Result<unknown, StorageError>): AlmacenFalso => {
  let guardados: ReadonlyArray<StoredUiState> = []
  return {
    load: (): Result<unknown, StorageError> => {
      const ultimo: StoredUiState | undefined = guardados[guardados.length - 1]
      return ultimo === undefined ? leido : ok(ultimo)
    },
    save: (estado: StoredUiState): Result<void, StorageError> => {
      guardados = [...guardados, estado]
      return ok(undefined)
    },
    guardados: (): ReadonlyArray<StoredUiState> => guardados,
  }
}

/* ── Leer ── */

test("sin nada guardado, cada sección es la de siempre", (): void => {
  assert.deepEqual(parseUiState(null), {
    phosphor: "green",
    language: null,
    windows: DEFAULT_LAYOUT,
    framings: {},
    calendarOrder: { routines: [], archived: [] },
    calendarTab: "events",
    routineCharts: { view: "month", axes: {} },
  })
})

test("una sección rota vuelve a la de siempre sin tirar las demás", (): void => {
  const estado: UiState = parseUiState({ phosphor: 42, language: "en", calendarTab: "routines", framings: "roto" })
  assert.equal(estado.phosphor, "green")
  assert.equal(estado.language, "en")
  assert.equal(estado.calendarTab, "routines")
  assert.deepEqual(estado.framings, {})
})

/* ── Una sección ── */

test("leer una sección que no está da null", (): void => {
  const seccion: UiStateSection<"phosphor"> = uiStateSection(almacen(ok({ calendarTab: "routines" })), "phosphor")
  assert.deepEqual(seccion.load(), { ok: true, value: null })
})

test("leer una sección da lo suyo tal cual, sin validar", (): void => {
  const seccion: UiStateSection<"phosphor"> = uiStateSection(almacen(ok({ phosphor: "raro" })), "phosphor")
  assert.deepEqual(seccion.load(), { ok: true, value: "raro" })
})

test("un fallo al leer el objeto es el fallo de la sección", (): void => {
  const fallo: StorageError = { kind: "io", cause: "bloqueado" }
  const seccion: UiStateSection<"phosphor"> = uiStateSection(almacen(err(fallo)), "phosphor")
  assert.deepEqual(seccion.load(), { ok: false, error: fallo })
})

test("guardar una sección no pisa las demás", (): void => {
  const persistencia: AlmacenFalso = almacen(ok({ phosphor: "amber", calendarTab: "routines" }))
  uiStateSection(persistencia, "phosphor").save("magenta")
  uiStateSection(persistencia, "framings").save({ d1: { x: 1, y: 2, scale: 2 } })
  assert.deepEqual(persistencia.guardados()[persistencia.guardados().length - 1], {
    phosphor: "magenta",
    calendarTab: "routines",
    framings: { d1: { x: 1, y: 2, scale: 2 } },
  })
})

test("si lo guardado no se puede leer, no se escribe: se borrarían las demás", (): void => {
  const fallo: StorageError = { kind: "io", cause: "bloqueado" }
  const persistencia: AlmacenFalso = almacen(err(fallo))
  assert.deepEqual(uiStateSection(persistencia, "phosphor").save("amber"), { ok: false, error: fallo })
  assert.equal(persistencia.guardados().length, 0)
})

test("si lo guardado está roto, se empieza de cero con la sección", (): void => {
  const persistencia: AlmacenFalso = almacen(err({ kind: "corrupt", path: "elnotas:ui", cause: null }))
  assert.equal(uiStateSection(persistencia, "phosphor").save("amber").ok, true)
  assert.deepEqual(persistencia.guardados(), [{ phosphor: "amber" }])
})
