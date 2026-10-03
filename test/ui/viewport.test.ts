/**
 * El encuadre del lienzo, sin DOM: pasar de pantalla a corcho y vuelta, mover,
 * acercar alrededor de un punto y el pellizco.
 */

import { test } from "node:test"
import assert from "node:assert/strict"

import type { Point, Viewport } from "#ui/index"
import {
  MAX_SCALE,
  MIN_SCALE,
  centeredViewport,
  panBy,
  pinch,
  toCanvas,
  toScreen,
  wheelFactor,
  zoomAround,
} from "#ui/index"

/** El corcho desplazado (100, 50) y a escala 2. */
const V: Viewport = { offsetX: 100, offsetY: 50, scale: 2 }

const cerca = (a: Point, b: Point): void => {
  assert.ok(Math.abs(a.x - b.x) < 1e-9 && Math.abs(a.y - b.y) < 1e-9, `${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`)
}

test("al abrir, el origen del corcho cae en el centro de la pantalla, a escala 1", (): void => {
  const v: Viewport = centeredViewport(800, 600)
  assert.deepEqual(toScreen(v, { x: 0, y: 0 }), { x: 400, y: 300 })
  assert.equal(v.scale, 1)
})

test("toCanvas y toScreen son inversas", (): void => {
  const p: Point = { x: 37, y: -12 }
  cerca(toScreen(V, toCanvas(V, p)), p)
  cerca(toCanvas(V, toScreen(V, p)), p)
  assert.deepEqual(toScreen(V, { x: 10, y: 10 }), { x: 120, y: 70 })
})

test("panBy desplaza el corcho; sin desplazamiento, el MISMO encuadre", (): void => {
  assert.deepEqual(panBy(V, 5, -3), { offsetX: 105, offsetY: 47, scale: 2 })
  assert.strictEqual(panBy(V, 0, 0), V)
})

test("zoomAround deja quieto lo que hay bajo el punto", (): void => {
  const p: Point = { x: 300, y: 200 }
  const debajo: Point = toCanvas(V, p)
  const v: Viewport = zoomAround(V, p, 1.5)
  assert.equal(v.scale, 3)
  cerca(toScreen(v, debajo), p)
})

test("zoomAround no pasa de los topes, y en el tope devuelve el MISMO encuadre", (): void => {
  assert.equal(zoomAround(V, { x: 0, y: 0 }, 100).scale, MAX_SCALE)
  assert.equal(zoomAround(V, { x: 0, y: 0 }, 0.001).scale, MIN_SCALE)
  const tope: Viewport = { ...V, scale: MAX_SCALE }
  assert.strictEqual(zoomAround(tope, { x: 3, y: 4 }, 2), tope)
})

test("pinch: separar los dedos al doble acerca al doble alrededor del punto medio", (): void => {
  const a0: Point = { x: 100, y: 100 }
  const b0: Point = { x: 200, y: 100 }
  const debajo: Point = toCanvas(V, { x: 150, y: 100 })
  const v: Viewport = pinch(V, a0, b0, { x: 50, y: 100 }, { x: 250, y: 100 })
  assert.equal(v.scale, 4)
  cerca(toScreen(v, debajo), { x: 150, y: 100 })
})

test("pinch: mover los dos dedos sin separarlos arrastra el corcho", (): void => {
  const v: Viewport = pinch(V, { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 30, y: 40 }, { x: 40, y: 40 })
  assert.deepEqual(v, { offsetX: 130, offsetY: 90, scale: 2 })
})

test("pinch: se calcula desde el inicio, así que volver los dedos a su sitio deja el encuadre igual", (): void => {
  const a0: Point = { x: 10, y: 20 }
  const b0: Point = { x: 90, y: 60 }
  assert.deepEqual(pinch(V, a0, b0, a0, b0), V)
})

test("pinch: con los dos dedos en el mismo punto no divide entre cero", (): void => {
  const p: Point = { x: 5, y: 5 }
  const v: Viewport = pinch(V, p, p, { x: 15, y: 5 }, { x: 15, y: 5 })
  assert.equal(v.scale, V.scale)
  assert.ok(Number.isFinite(v.offsetX) && Number.isFinite(v.offsetY))
})

test("pinch: también respeta los topes", (): void => {
  const v: Viewport = pinch(V, { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 0 }, { x: 1000, y: 0 })
  assert.equal(v.scale, MAX_SCALE)
})

test("wheelFactor: la rueda hacia arriba acerca, hacia abajo aleja, y quieta no hace nada", (): void => {
  assert.ok(wheelFactor(-100) > 1)
  assert.ok(wheelFactor(100) < 1)
  assert.equal(wheelFactor(0), 1)
  // Subir y bajar lo mismo vuelve a la escala de partida.
  assert.ok(Math.abs(wheelFactor(-100) * wheelFactor(100) - 1) < 1e-12)
})
