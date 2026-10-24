/**
 * La selección del lienzo, sin DOM: el rectángulo, lo que toca y el avance por
 * los bordes.
 */

import { test } from "node:test"
import assert from "node:assert/strict"

import type { Box } from "#ui/relationGeometry"
import type { Point } from "#ui/viewport"
import type { Rect } from "#ui/canvasSelection"
import { EDGE_BAND_PX, boxesTouching, edgeDirection, rectBetween } from "#ui/canvasSelection"

/** Tres pósits de 20 × 10, centrados en (0, 0), (100, 0) y (0, 100). */
const CAJAS: ReadonlyMap<string, Box> = new Map<string, Box>([
  ["a", { x: 0, y: 0, width: 20, height: 10 }],
  ["b", { x: 100, y: 0, width: 20, height: 10 }],
  ["c", { x: 0, y: 100, width: 20, height: 10 }],
])

test("rectBetween ordena las esquinas, las pongan como las pongan", (): void => {
  assert.deepEqual(rectBetween({ x: 10, y: 5 }, { x: -3, y: 20 }), {
    left: -3,
    top: 5,
    right: 10,
    bottom: 20,
  })
})

test("boxesTouching marca lo que el rectángulo toca, no sólo lo que encierra", (): void => {
  /* Del centro de «a» hasta el borde izquierdo de «b»: los dos, aunque «b» apenas. */
  const r: Rect = rectBetween({ x: 0, y: 0 }, { x: 90, y: 2 })
  assert.deepEqual([...boxesTouching(CAJAS, r)].sort(), ["a", "b"])
})

test("boxesTouching: a un pelo del borde, no lo toca", (): void => {
  const r: Rect = rectBetween({ x: 11, y: -50 }, { x: 89, y: 50 })
  assert.deepEqual(boxesTouching(CAJAS, r), [])
})

test("boxesTouching: un rectángulo que lo cubre todo, todos", (): void => {
  const r: Rect = rectBetween({ x: -500, y: -500 }, { x: 500, y: 500 })
  assert.deepEqual([...boxesTouching(CAJAS, r)].sort(), ["a", "b", "c"])
})

test("edgeDirection: en medio, quieto", (): void => {
  assert.deepEqual(edgeDirection({ x: 200, y: 150 }, 400, 300), { x: 0, y: 0 })
})

test("edgeDirection: junto a cada borde, el corcho va hacia el lado contrario del dedo", (): void => {
  const dentro: number = EDGE_BAND_PX - 1
  assert.deepEqual(edgeDirection({ x: dentro, y: 150 }, 400, 300), { x: 1, y: 0 })
  assert.deepEqual(edgeDirection({ x: 400 - dentro, y: 150 }, 400, 300), { x: -1, y: 0 })
  assert.deepEqual(edgeDirection({ x: 200, y: dentro }, 400, 300), { x: 0, y: 1 })
  assert.deepEqual(edgeDirection({ x: 200, y: 300 - dentro }, 400, 300), { x: 0, y: -1 })
})

test("edgeDirection: en una esquina, en diagonal; fuera del lienzo, como en la franja", (): void => {
  assert.deepEqual(edgeDirection({ x: 5, y: 295 }, 400, 300), { x: 1, y: -1 })
  const fuera: Point = { x: -30, y: 150 }
  assert.deepEqual(edgeDirection(fuera, 400, 300), { x: 1, y: 0 })
})

test("edgeDirection: justo en el límite de la franja, todavía quieto", (): void => {
  assert.deepEqual(edgeDirection({ x: EDGE_BAND_PX, y: 150 }, 400, 300), { x: 0, y: 0 })
})
