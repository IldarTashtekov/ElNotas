/**
 * Dónde cae una ficha arrastrada, sin DOM: fichas con centros en 50, 150, 250 y 350.
 */

import { test } from "node:test"
import assert from "node:assert/strict"

import { dropIndex } from "#ui/index"

const CENTROS: ReadonlyArray<number> = [50, 150, 250, 350]

test("sin pasar el centro de ninguna, se queda en su sitio", (): void => {
  assert.equal(dropIndex(CENTROS, 1, 140), 1)
  assert.equal(dropIndex(CENTROS, 1, 160), 1)
})

test("pasado el centro de la de al lado, ocupa su puesto", (): void => {
  assert.equal(dropIndex(CENTROS, 1, 260), 2)
  assert.equal(dropIndex(CENTROS, 1, 40), 0)
})

test("más allá de la última va al final; antes de la primera, al principio", (): void => {
  assert.equal(dropIndex(CENTROS, 0, 900), 3)
  assert.equal(dropIndex(CENTROS, 3, -100), 0)
})

test("su propio centro no cuenta", (): void => {
  assert.equal(dropIndex(CENTROS, 2, 251), 2)
  assert.equal(dropIndex(CENTROS, 0, 51), 0)
})
