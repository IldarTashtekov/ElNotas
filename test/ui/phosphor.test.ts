/**
 * El color del fósforo: qué se lee de lo guardado, que se aplique al arrancar y
 * que cambiarlo lo aplique y lo guarde sólo cuando cambia.
 */

import { test } from "node:test"
import assert from "node:assert/strict"

import type { Result, StorageError } from "#core/index"
import { err, ok } from "#core/index"
import type { Phosphor, PhosphorPersistence, PhosphorSetting } from "#ui/index"
import { DEFAULT_PHOSPHOR } from "#ui/phosphor"
import { createPhosphorSetting, parsePhosphor } from "#ui/index"
import type { RecordingLogger } from "../core/ports/FakeLogger"
import { createRecordingLogger, silentLogger } from "../core/ports/FakeLogger"

test("parsePhosphor reconoce los tres fósforos", (): void => {
  assert.equal(parsePhosphor("green"), "green")
  assert.equal(parsePhosphor("magenta"), "magenta")
  assert.equal(parsePhosphor("amber"), "amber")
})

test("parsePhosphor convierte cualquier otra cosa en el de siempre", (): void => {
  for (const raro of [null, undefined, "", "verde", "GREEN", 1, {}]) {
    assert.equal(parsePhosphor(raro), DEFAULT_PHOSPHOR)
  }
  assert.equal(DEFAULT_PHOSPHOR, "green")
})

interface Escenario {
  readonly setting: PhosphorSetting
  readonly aplicados: () => ReadonlyArray<Phosphor>
  readonly guardados: () => ReadonlyArray<Phosphor>
}

const escenario = (leido: Result<unknown, StorageError>): Escenario => {
  let aplicados: ReadonlyArray<Phosphor> = []
  let guardados: ReadonlyArray<Phosphor> = []
  const persistence: PhosphorPersistence = {
    load: (): Result<unknown, StorageError> => leido,
    save: (phosphor: Phosphor): Result<void, StorageError> => {
      guardados = [...guardados, phosphor]
      return ok(undefined)
    },
  }
  const setting: PhosphorSetting = createPhosphorSetting({
    logger: silentLogger,
    persistence,
    apply: (phosphor: Phosphor): void => {
      aplicados = [...aplicados, phosphor]
    },
  })
  return {
    setting,
    aplicados: (): ReadonlyArray<Phosphor> => aplicados,
    guardados: (): ReadonlyArray<Phosphor> => guardados,
  }
}

test("al crearlo aplica lo guardado, sin volver a guardarlo", (): void => {
  const e: Escenario = escenario(ok("amber"))
  assert.equal(e.setting.get(), "amber")
  assert.deepEqual(e.aplicados(), ["amber"])
  assert.deepEqual(e.guardados(), [])
})

test("sin nada guardado, o si no se puede leer, aplica el de siempre", (): void => {
  const fallo: StorageError = { kind: "io", cause: new Error("bloqueado") }
  for (const leido of [ok(null), err(fallo)]) {
    const e: Escenario = escenario(leido)
    assert.equal(e.setting.get(), "green")
    assert.deepEqual(e.aplicados(), ["green"])
  }
})

test("cambiarlo lo aplica y lo guarda", (): void => {
  const e: Escenario = escenario(ok(null))
  e.setting.set("amber")
  assert.equal(e.setting.get(), "amber")
  assert.deepEqual(e.aplicados(), ["green", "amber"])
  assert.deepEqual(e.guardados(), ["amber"])
})

test("elegir el que ya está no hace nada: ni aplica ni guarda", (): void => {
  const e: Escenario = escenario(ok("amber"))
  e.setting.set("amber")
  assert.deepEqual(e.aplicados(), ["amber"])
  assert.deepEqual(e.guardados(), [])
})

test("un fallo al guardar no impide el cambio", (): void => {
  const fallo: StorageError = { kind: "io", cause: new Error("lleno") }
  let aplicado: Phosphor | null = null
  const setting: PhosphorSetting = createPhosphorSetting({
    logger: silentLogger,
    persistence: {
      load: (): Result<unknown, StorageError> => ok(null),
      save: (): Result<void, StorageError> => err(fallo),
    },
    apply: (phosphor: Phosphor): void => {
      aplicado = phosphor
    },
  })
  setting.set("amber")
  assert.equal(setting.get(), "amber")
  assert.equal(aplicado, "amber")
})

test("un fallo al guardar queda en el registro, y un guardado bueno no", (): void => {
  const registro: RecordingLogger = createRecordingLogger()
  let falla: boolean = true
  const setting: PhosphorSetting = createPhosphorSetting({
    logger: registro.logger,
    persistence: {
      load: (): Result<unknown, StorageError> => ok(null),
      save: (): Result<void, StorageError> => (falla ? err({ kind: "io", cause: "lleno" }) : ok(undefined)),
    },
    apply: (): void => undefined,
  })
  setting.set("amber")
  falla = false
  setting.set("green")
  assert.deepEqual(registro.logged(), ["no se guardó el fósforo"])
})
