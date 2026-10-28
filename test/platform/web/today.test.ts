/**
 * «Hoy» como día del calendario: el día local del instante, no el de otra zona.
 */

import { test } from "node:test"
import assert from "node:assert/strict"

import type { Day } from "#core/index"
import { todayOf } from "#platform/web/today"

test("todayOf da el día local del instante", (): void => {
  const mediodia: number = new Date(2026, 9, 28, 12, 0, 0).getTime()
  assert.equal(todayOf(mediodia), "2026-10-28")
})

test("todayOf: a las 00:00 y a las 23:59 locales sigue siendo el mismo día", (): void => {
  const inicio: Day | null = todayOf(new Date(2026, 0, 1, 0, 0, 0).getTime())
  const fin: Day | null = todayOf(new Date(2026, 0, 1, 23, 59, 59).getTime())
  assert.equal(inicio, "2026-01-01")
  assert.equal(fin, "2026-01-01")
})

test("todayOf: un instante fuera del rango del calendario es null", (): void => {
  assert.equal(todayOf(Number.NaN), null)
})
