/**
 * La gráfica de una rutina, sin DOM: el recuento por semana y lo que se
 * recuerda de ella (el modo y el tramo de cada rutina).
 */

import { describe, it } from "node:test"
import assert from "node:assert/strict"

import type { AppState, Day, Result, Routine, RoutineId, StorageError, Store } from "#core/index"
import { err, ok } from "#core/index"
import { revision } from "#core/domain/Ids"
import type { RoutineCharts, RoutineChartsPersistence, RoutineChartsSetting, WeekCount } from "#ui/routineCharts"
import {
  NO_ROUTINE_CHARTS,
  createRoutineChartsSetting,
  guardRoutineCharts,
  parseRoutineCharts,
  routineWeeks,
} from "#ui/routineCharts"
import type { RecordingLogger } from "../core/ports/FakeLogger"
import { createRecordingLogger, silentLogger } from "../core/ports/FakeLogger"

const d = (s: string): Day => s as Day
const rutina = (id: string, days: ReadonlyArray<string>): Routine => ({
  id: id as RoutineId,
  name: id,
  days: days.map(d),
  updatedAt: 0,
  revision: revision("rev"),
})
const estado = (...rs: ReadonlyArray<Routine>): AppState =>
  ({
    notes: {},
    diagrams: {},
    contexts: {},
    events: {},
    routines: Object.fromEntries(rs.map((r: Routine): [string, Routine] => [r.id, r])),
  }) as unknown as AppState
const almacenDe = (e: AppState): Store => ({ getState: (): AppState => e }) as unknown as Store

/* 2026-11-03 es martes: su semana empieza el lunes 2 de noviembre. */
const HOY: Day = d("2026-11-03")

describe("routineWeeks", (): void => {
  it("sin días cumplidos, sólo la semana de hoy, a 0", (): void => {
    assert.deepEqual(routineWeeks(rutina("a", []), HOY), [{ monday: d("2026-11-02"), done: 0 }])
  })

  it("de la primera semana con algún día a la de hoy, con las vacías a 0", (): void => {
    const semanas: ReadonlyArray<WeekCount> = routineWeeks(
      rutina("a", ["2026-10-14", "2026-10-12", "2026-10-18", "2026-11-03"]),
      HOY,
    )
    assert.deepEqual(semanas, [
      { monday: d("2026-10-12"), done: 3 },
      { monday: d("2026-10-19"), done: 0 },
      { monday: d("2026-10-26"), done: 0 },
      { monday: d("2026-11-02"), done: 1 },
    ])
  })

  it("el domingo cuenta en su semana, de lunes a domingo", (): void => {
    const semanas: ReadonlyArray<WeekCount> = routineWeeks(rutina("a", ["2026-11-01", "2026-11-02"]), HOY)
    assert.deepEqual(
      semanas.map((s: WeekCount): number => s.done),
      [1, 1],
    )
  })

  it("lo que pase de la semana de hoy no cuenta", (): void => {
    const semanas: ReadonlyArray<WeekCount> = routineWeeks(rutina("a", ["2026-11-02", "2026-11-12"]), HOY)
    assert.deepEqual(semanas, [{ monday: d("2026-11-02"), done: 1 }])
    assert.deepEqual(routineWeeks(rutina("a", ["2026-11-12"]), HOY), [{ monday: d("2026-11-02"), done: 0 }])
  })
})

describe("lo que se recuerda", (): void => {
  it("lo leído sin forma es el mes, sin tramos", (): void => {
    assert.deepEqual(parseRoutineCharts(null), NO_ROUTINE_CHARTS)
    assert.deepEqual(parseRoutineCharts({ view: "tarta", axes: [] }), NO_ROUTINE_CHARTS)
  })

  it("se queda con los tramos que tienen forma", (): void => {
    assert.deepEqual(
      parseRoutineCharts({
        view: "chart",
        axes: { a: { span: 8, fromEnd: 2 }, b: { span: 0, fromEnd: 0 }, c: { span: 3 }, e: { span: 4, fromEnd: -1 } },
      }),
      { view: "chart", axes: { a: { span: 8, fromEnd: 2 } } },
    )
  })

  it("olvida los tramos de rutinas que ya no están; sin sobrantes, lo MISMO", (): void => {
    const c: RoutineCharts = { view: "chart", axes: { a: { span: 8, fromEnd: 0 }, b: { span: 4, fromEnd: 1 } } }
    assert.deepEqual(guardRoutineCharts(c, estado(rutina("a", []))), {
      view: "chart",
      axes: { a: { span: 8, fromEnd: 0 } },
    })
    assert.strictEqual(guardRoutineCharts(c, estado(rutina("a", []), rutina("b", []))), c)
  })
})

interface AlmacenFalso extends RoutineChartsPersistence {
  readonly guardados: () => ReadonlyArray<RoutineCharts>
}

const persistencia = (leido: Result<unknown, StorageError> = ok(null)): AlmacenFalso => {
  let guardados: ReadonlyArray<RoutineCharts> = []
  return {
    load: (): Result<unknown, StorageError> => leido,
    save: (c: RoutineCharts): Result<void, StorageError> => {
      guardados = [...guardados, c]
      return ok(undefined)
    },
    guardados: (): ReadonlyArray<RoutineCharts> => guardados,
  }
}

describe("el ajuste", (): void => {
  it("empieza en lo guardado, sin los tramos de rutinas que ya no están", (): void => {
    const p: AlmacenFalso = persistencia(
      ok({ view: "chart", axes: { a: { span: 8, fromEnd: 1 }, z: { span: 4, fromEnd: 0 } } }),
    )
    const g: RoutineChartsSetting = createRoutineChartsSetting({
      store: almacenDe(estado(rutina("a", []))),
      persistence: p,
      logger: silentLogger,
    })
    assert.equal(g.view(), "chart")
    assert.deepEqual(g.axis("a"), { span: 8, fromEnd: 1 })
    assert.equal(g.axis("z"), null)
  })

  it("cambiar el modo lo guarda; al mismo, no escribe", (): void => {
    const p: AlmacenFalso = persistencia()
    const g: RoutineChartsSetting = createRoutineChartsSetting({
      store: almacenDe(estado()),
      persistence: p,
      logger: silentLogger,
    })
    g.setView("month")
    assert.equal(p.guardados().length, 0)
    g.setView("chart")
    assert.deepEqual(p.guardados(), [{ view: "chart", axes: {} }])
  })

  it("un tramo se apunta en memoria y se escribe al guardar, sólo si cambió", (): void => {
    const p: AlmacenFalso = persistencia()
    const g: RoutineChartsSetting = createRoutineChartsSetting({
      store: almacenDe(estado(rutina("a", []))),
      persistence: p,
      logger: silentLogger,
    })
    g.rememberAxis("a", { span: 6, fromEnd: 2 })
    assert.equal(p.guardados().length, 0)
    assert.deepEqual(g.axis("a"), { span: 6, fromEnd: 2 })
    g.save()
    g.save()
    g.rememberAxis("a", { span: 6, fromEnd: 2 })
    g.save()
    assert.deepEqual(p.guardados(), [{ view: "month", axes: { a: { span: 6, fromEnd: 2 } } }])
  })

  it("un fallo al guardar queda en el registro", (): void => {
    const registro: RecordingLogger = createRecordingLogger()
    const g: RoutineChartsSetting = createRoutineChartsSetting({
      store: almacenDe(estado()),
      persistence: {
        load: (): Result<unknown, StorageError> => ok(null),
        save: (): Result<void, StorageError> => err({ kind: "io", cause: "lleno" }),
      },
      logger: registro.logger,
    })
    g.setView("chart")
    assert.equal(g.view(), "chart")
    assert.deepEqual(registro.logged(), ["no se guardó la gráfica de las rutinas"])
  })
})
