/**
 * La pestaña del calendario: cómo se lee lo guardado y que el ajuste la guarde
 * sólo al cambiarla.
 */

import { test } from "node:test"
import assert from "node:assert/strict"

import type { Result, StorageError } from "#core/index"
import { err, ok } from "#core/index"
import type { CalendarTab, CalendarTabPersistence, CalendarTabSetting } from "#ui/calendarTab"
import { createCalendarTabSetting, daysOpenSheet, parseCalendarTab } from "#ui/calendarTab"
import type { RecordingLogger } from "../core/ports/FakeLogger"
import { createRecordingLogger, silentLogger } from "../core/ports/FakeLogger"

interface AlmacenFalso extends CalendarTabPersistence {
  readonly guardados: () => ReadonlyArray<CalendarTab>
}

const almacen = (leido: Result<unknown, StorageError> = ok(null)): AlmacenFalso => {
  let guardados: ReadonlyArray<CalendarTab> = []
  return {
    load: (): Result<unknown, StorageError> => leido,
    save: (tab: CalendarTab): Result<void, StorageError> => {
      guardados = [...guardados, tab]
      return ok(undefined)
    },
    guardados: (): ReadonlyArray<CalendarTab> => guardados,
  }
}

test("lo leído que no es una pestaña conocida es Eventos", (): void => {
  assert.equal(parseCalendarTab("routines"), "routines")
  for (const raro of [null, "events", "rutinas", 3, {}]) {
    assert.equal(parseCalendarTab(raro), "events")
  }
})

test("empieza en lo guardado; sin poder leerlo, en Eventos", (): void => {
  const guardada: CalendarTabSetting = createCalendarTabSetting({
    persistence: almacen(ok("routines")),
    logger: silentLogger,
  })
  assert.equal(guardada.get(), "routines")
  const ilegible: CalendarTabSetting = createCalendarTabSetting({
    persistence: almacen(err({ kind: "io", cause: "bloqueado" })),
    logger: silentLogger,
  })
  assert.equal(ilegible.get(), "events")
})

test("cambiarla la guarda; a la misma, no escribe", (): void => {
  const persistence: AlmacenFalso = almacen()
  const pestana: CalendarTabSetting = createCalendarTabSetting({ persistence, logger: silentLogger })
  pestana.set("events")
  pestana.set("routines")
  pestana.set("routines")
  assert.equal(pestana.get(), "routines")
  assert.deepEqual(persistence.guardados(), ["routines"])
})

test("un fallo al guardar queda en el registro, y la pestaña cambia igual", (): void => {
  const registro: RecordingLogger = createRecordingLogger()
  const pestana: CalendarTabSetting = createCalendarTabSetting({
    persistence: {
      load: (): Result<unknown, StorageError> => ok(null),
      save: (): Result<void, StorageError> => err({ kind: "io", cause: "lleno" }),
    },
    logger: registro.logger,
  })
  pestana.set("routines")
  assert.equal(pestana.get(), "routines")
  assert.deepEqual(registro.logged(), ["no se guardó la pestaña del calendario"])
})

test("pulsar un día abre su hoja sólo en Eventos", (): void => {
  assert.equal(daysOpenSheet("events"), true)
  assert.equal(daysOpenSheet("routines"), false)
})
