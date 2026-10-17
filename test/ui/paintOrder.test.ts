/**
 * El orden en que se pintan los pósits, sin DOM: el último levantado, encima.
 */

import { test } from "node:test"
import assert from "node:assert/strict"

import { paintOrder, raise } from "#ui/paintOrder"

test("sin levantar ninguno, se pintan en su orden de creación", (): void => {
  assert.deepEqual(paintOrder(["a", "b", "c"], []), ["a", "b", "c"])
})

test("el levantado va encima de todos, y el último levantado, más arriba", (): void => {
  assert.deepEqual(paintOrder(["a", "b", "c"], ["a"]), ["b", "c", "a"])
  assert.deepEqual(paintOrder(["a", "b", "c"], ["c", "a"]), ["b", "c", "a"])
})

test("un levantado que ya no existe no se pinta", (): void => {
  assert.deepEqual(paintOrder(["a", "b"], ["borrado", "a"]), ["b", "a"])
})

test("raise lo sube al final, y si se repite no se duplica", (): void => {
  assert.deepEqual(raise(["a", "b"], "a"), ["b", "a"])
  assert.deepEqual(raise([], "a"), ["a"])
})

test("raise del que ya está arriba devuelve la MISMA lista", (): void => {
  const levantados: ReadonlyArray<string> = ["a", "b"]
  assert.strictEqual(raise(levantados, "b"), levantados)
})
