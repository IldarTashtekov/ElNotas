/**
 * Lo puro de una rutina: la meta válida, poner o quitar un día manteniendo el
 * orden, y cómo va una semana (con meta, sin ella, y cruzando de mes).
 */

import { test } from "node:test"
import assert from "node:assert/strict"

import type { Day } from "#core/domain/calendar"
import { parseDay } from "#core/domain/calendar"
import { revision, routineId } from "#core/domain/Ids"
import type { Routine, WeekProgress } from "#core/domain/Routine"
import { isWeeklyGoal, weekProgress, withDay } from "#core/domain/Routine"

const dia = (raw: string): Day => parseDay(raw) as Day

const rutina = (days: ReadonlyArray<string>, weeklyGoal?: number): Routine => ({
  id: routineId("correr"),
  name: "Correr",
  days: days.map(dia),
  ...(weeklyGoal === undefined ? {} : { weeklyGoal }),
  updatedAt: 0,
  revision: revision("rev-correr"),
})

const progreso = (r: Routine, raw: string): WeekProgress => {
  const p: WeekProgress | null = weekProgress(r, dia(raw))
  if (p === null) assert.fail("la semana tenía que existir")
  return p
}

test("isWeeklyGoal: sólo enteros de 1 a 7", () => {
  for (const bueno of [1, 4, 7]) assert.equal(isWeeklyGoal(bueno), true, `${bueno}`)
  for (const malo of [0, 8, -1, 2.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.equal(isWeeklyGoal(malo), false, `${malo}`)
  }
})

test("withDay pone el día en su sitio, ordenado, y no repite", () => {
  const base: ReadonlyArray<Day> = [dia("2026-07-01"), dia("2026-07-05")]

  assert.deepEqual(withDay(base, dia("2026-07-03"), true), ["2026-07-01", "2026-07-03", "2026-07-05"])
  assert.deepEqual(withDay(base, dia("2026-06-30"), true), ["2026-06-30", "2026-07-01", "2026-07-05"])
  assert.deepEqual(withDay(base, dia("2026-07-01"), false), ["2026-07-05"])
})

test("withDay devuelve LOS MISMOS días si no cambia nada", () => {
  const base: ReadonlyArray<Day> = [dia("2026-07-01")]

  assert.strictEqual(withDay(base, dia("2026-07-01"), true), base, "ya estaba")
  assert.strictEqual(withDay(base, dia("2026-07-02"), false), base, "no estaba")
})

test("weekProgress cuenta los días marcados de la semana de lunes a domingo", () => {
  /* 2026-07-02 es jueves: su semana va del 29 de junio al 5 de julio. */
  const r: Routine = rutina(["2026-06-28", "2026-06-29", "2026-07-02", "2026-07-05", "2026-07-06"], 3)
  const p: WeekProgress = progreso(r, "2026-07-02")

  assert.deepEqual(p.week[0], "2026-06-29")
  assert.deepEqual(p.week[6], "2026-07-05")
  assert.equal(p.done, 3, "el domingo anterior y el lunes siguiente no cuentan")
  assert.equal(p.goal, 3)
  assert.equal(p.met, true)
})

test("weekProgress: una semana que cruza de mes cuenta sus siete días", () => {
  const r: Routine = rutina(["2026-06-30", "2026-07-01", "2026-07-02"], 3)

  assert.equal(progreso(r, "2026-06-30").done, 3, "visto desde junio")
  assert.equal(progreso(r, "2026-07-03").done, 3, "visto desde julio")
})

test("weekProgress: con meta exacta cumple, y un día menos no", () => {
  const r: Routine = rutina(["2026-06-29", "2026-06-30"], 2)

  assert.equal(progreso(r, "2026-07-01").met, true)
  assert.equal(progreso({ ...r, days: r.days.slice(1) }, "2026-07-01").met, false)
})

test("weekProgress: sin meta ninguna semana cumple, y done sigue contando", () => {
  const r: Routine = rutina(["2026-06-29", "2026-06-30", "2026-07-01", "2026-07-02", "2026-07-03", "2026-07-04", "2026-07-05"])
  const p: WeekProgress = progreso(r, "2026-07-02")

  assert.equal(p.goal, null)
  assert.equal(p.done, 7)
  assert.equal(p.met, false)
})

test("weekProgress: una semana sin marcas no cumple ni con la meta mínima", () => {
  assert.equal(progreso(rutina([], 1), "2026-07-02").met, false)
})

test("weekProgress: la semana que se sale del rango es null", () => {
  assert.equal(weekProgress(rutina([]), dia("9999-12-31")), null)
})
