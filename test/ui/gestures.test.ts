/**
 * Qué ha hecho el dedo, sin DOM: si se ha movido de más y si un toque es el
 * segundo de un doble toque.
 */

import { test } from "node:test"
import assert from "node:assert/strict"

import type { Tap } from "#ui/gestures"
import {
  DOUBLE_TAP_DISTANCE_PX,
  DOUBLE_TAP_MS,
  MOVE_TOLERANCE_PX,
  isDoubleTap,
  movedBeyondTolerance,
} from "#ui/gestures"

const PRIMERO: Tap = { x: 100, y: 100, time: 1000, target: "nodo-a" }

test("dentro de la tolerancia sigue siendo un toque; pasada, en cualquier eje, es arrastrar", (): void => {
  const o: { readonly x: number; readonly y: number } = { x: 0, y: 0 }
  assert.equal(movedBeyondTolerance(o, { x: MOVE_TOLERANCE_PX, y: -MOVE_TOLERANCE_PX }), false)
  assert.equal(movedBeyondTolerance(o, { x: MOVE_TOLERANCE_PX + 1, y: 0 }), true)
  assert.equal(movedBeyondTolerance(o, { x: 0, y: -(MOVE_TOLERANCE_PX + 1) }), true)
})

test("dos toques seguidos en el mismo sitio y sobre lo mismo son un doble toque", (): void => {
  assert.equal(isDoubleTap(PRIMERO, { ...PRIMERO, time: PRIMERO.time + DOUBLE_TAP_MS }), true)
})

test("sin toque anterior no hay doble", (): void => {
  assert.equal(isDoubleTap(null, PRIMERO), false)
})

test("si el segundo llega tarde, no es doble", (): void => {
  assert.equal(isDoubleTap(PRIMERO, { ...PRIMERO, time: PRIMERO.time + DOUBLE_TAP_MS + 1 }), false)
})

test("sobre otra cosa no es doble, aunque caiga cerca", (): void => {
  assert.equal(isDoubleTap(PRIMERO, { ...PRIMERO, time: PRIMERO.time + 50, target: "fondo" }), false)
})

test("el segundo puede caer un poco desplazado, pero no lejos", (): void => {
  const cerca: Tap = { ...PRIMERO, x: PRIMERO.x + DOUBLE_TAP_DISTANCE_PX, time: PRIMERO.time + 50 }
  const lejos: Tap = { ...PRIMERO, x: PRIMERO.x + DOUBLE_TAP_DISTANCE_PX + 1, time: PRIMERO.time + 50 }
  assert.equal(isDoubleTap(PRIMERO, cerca), true)
  assert.equal(isDoubleTap(PRIMERO, lejos), false)
})
