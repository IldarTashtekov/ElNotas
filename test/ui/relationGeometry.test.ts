/**
 * Dónde se dibujan las relaciones, sin DOM: el corte con el borde del pósit, el
 * abanico de curvas y el texto que no sale boca abajo.
 */

import { test } from "node:test"
import assert from "node:assert/strict"

import type { Box, FanItem, RelationCurve } from "#ui/relationGeometry"
import type { Point } from "#ui/viewport"
import {
  FAN_SPACING,
  borderPoint,
  curveMidpoint,
  curvePath,
  fanOffsets,
  labelPath,
  relationCurve,
  relationsOf,
} from "#ui/relationGeometry"

/** Un pósit de 100 × 40 centrado en el origen, y otro igual 300 a su derecha. */
const A: Box = { x: 0, y: 0, width: 100, height: 40 }
const B: Box = { x: 300, y: 0, width: 100, height: 40 }

const cerca = (p: Point, q: Point): void => {
  assert.ok(Math.abs(p.x - q.x) < 1e-9 && Math.abs(p.y - q.y) < 1e-9, `${JSON.stringify(p)} ≠ ${JSON.stringify(q)}`)
}

/* ────────────────────────────── borderPoint ────────────────────────────── */

test("hacia la derecha corta el lado derecho; hacia abajo, el de abajo", (): void => {
  cerca(borderPoint(A, { x: 500, y: 0 }), { x: 50, y: 0 })
  cerca(borderPoint(A, { x: 0, y: 500 }), { x: 0, y: 20 })
  cerca(borderPoint(A, { x: -500, y: 0 }), { x: -50, y: 0 })
})

test("en diagonal corta el lado que llega antes: en uno ancho y bajo, el de arriba", (): void => {
  cerca(borderPoint(A, { x: 100, y: -100 }), { x: 20, y: -20 })
})

test("hacia su propio centro, el centro: no divide entre cero", (): void => {
  cerca(borderPoint(A, { x: 0, y: 0 }), { x: 0, y: 0 })
})

/* ─────────────────────────────── fanOffsets ────────────────────────────── */

const rel = (id: string, from: string, to: string): FanItem => ({ id, from, to })

test("una sola relación entre dos nodos va recta", (): void => {
  assert.equal(fanOffsets([rel("r1", "a", "b")]).get("r1"), 0)
})

test("dos entre el mismo par, una a cada lado, AUNQUE vayan en sentidos contrarios", (): void => {
  const c: ReadonlyMap<string, number> = fanOffsets([rel("r1", "a", "b"), rel("r2", "b", "a")])
  assert.equal(c.get("r1"), -FAN_SPACING / 2)
  assert.equal(c.get("r2"), FAN_SPACING / 2)
})

test("tres entre el mismo par: una recta en medio y una a cada lado", (): void => {
  const c: ReadonlyMap<string, number> = fanOffsets([
    rel("r3", "a", "b"),
    rel("r1", "a", "b"),
    rel("r2", "b", "a"),
  ])
  assert.deepEqual([c.get("r1"), c.get("r2"), c.get("r3")], [-FAN_SPACING, 0, FAN_SPACING])
})

test("las de otro par no cuentan para el abanico", (): void => {
  const c: ReadonlyMap<string, number> = fanOffsets([rel("r1", "a", "b"), rel("r2", "a", "c")])
  assert.equal(c.get("r1"), 0)
  assert.equal(c.get("r2"), 0)
})

/* ────────────────────────────── relationsOf ────────────────────────────── */

test("las de un nodo son las que salen de él y las que llegan, en su orden", (): void => {
  const sale: FanItem = rel("r1", "a", "b")
  const otra: FanItem = rel("r2", "b", "c")
  const llega: FanItem = rel("r3", "c", "a")
  const delA: ReadonlyArray<FanItem> = relationsOf([sale, otra, llega], "a")
  assert.equal(delA.length, 2)
  assert.strictEqual(delA[0], sale)
  assert.strictEqual(delA[1], llega)
})

test("un nodo sin relaciones no tiene ninguna, aunque el diagrama tenga otras", (): void => {
  assert.equal(relationsOf([rel("r1", "a", "b")], "c").length, 0)
})

/* ────────────────────────────── relationCurve ──────────────────────────── */

test("recta: sale del borde de uno hacia el otro y llega a su borde", (): void => {
  const c: RelationCurve = relationCurve(A, B, "a", "b", 0)
  cerca(c.start, { x: 50, y: 0 })
  cerca(c.end, { x: 250, y: 0 })
  cerca(c.control, { x: 150, y: 0 })
})

test("curvada: el control se separa de la recta el doble de la curvatura", (): void => {
  const c: RelationCurve = relationCurve(A, B, "a", "b", 10)
  cerca(c.control, { x: 150, y: 20 })
})

test("curvada en vertical: el control se separa hacia un lado, también el doble", (): void => {
  const abajo: Box = { x: 0, y: 300, width: 100, height: 40 }
  cerca(relationCurve(A, abajo, "a", "b", 10).control, { x: -20, y: 150 })
})

test("A→B y B→A con curvaturas opuestas se curvan hacia lados opuestos", (): void => {
  const ida: RelationCurve = relationCurve(A, B, "a", "b", -14)
  const vuelta: RelationCurve = relationCurve(B, A, "b", "a", 14)
  assert.ok(ida.control.y * vuelta.control.y < 0, "las dos se curvan hacia el mismo lado")
})

test("el sentido no cambia el lado: la misma curvatura cae en el mismo sitio vaya hacia donde vaya", (): void => {
  cerca(relationCurve(A, B, "a", "b", 10).control, relationCurve(B, A, "b", "a", 10).control)
})

test("curvada, cada extremo sale hacia el control, no hacia el otro centro", (): void => {
  const c: RelationCurve = relationCurve(A, B, "a", "b", 40)
  cerca(c.start, borderPoint(A, c.control))
  cerca(c.end, borderPoint(B, c.control))
  assert.ok(c.start.y > 0, "tendría que salir por el lado de la curva")
})

test("dos pósits en el mismo sitio no rompen la cuenta", (): void => {
  const c: RelationCurve = relationCurve(A, A, "a", "b", 10)
  assert.ok([c.start, c.control, c.end].every((p: Point): boolean => Number.isFinite(p.x) && Number.isFinite(p.y)))
})

/* ──────────────────────────── curvePath y labelPath ─────────────────────── */

test("el trazado va del inicio al final pasando por el control", (): void => {
  assert.equal(curvePath(relationCurve(A, B, "a", "b", 0)), "M 50 0 Q 150 0 250 0")
})

test("el texto de una línea que va hacia la derecha sigue el mismo trazado", (): void => {
  const c: RelationCurve = relationCurve(A, B, "a", "b", 0)
  assert.equal(labelPath(c), curvePath(c))
})

test("el texto de una línea que va hacia la izquierda va al revés, para no salir boca abajo", (): void => {
  assert.equal(labelPath(relationCurve(B, A, "b", "a", 0)), "M 50 0 Q 150 0 250 0")
})

/* ───────────────────────────── curveMidpoint ───────────────────────────── */

test("el punto medio de una recta es su mitad", (): void => {
  cerca(curveMidpoint(relationCurve(A, B, "a", "b", 0)), { x: 150, y: 0 })
})

test("el punto medio de una curva está a mitad de camino del control: en la curva, no en él", (): void => {
  const c: RelationCurve = relationCurve(A, B, "a", "b", 10)
  const m: Point = curveMidpoint(c)
  assert.ok(Math.abs(m.x - 150) < 1e-9, `se esperaba x = 150 y es ${m.x}`)
  assert.ok(m.y > 0, "tendría que estar hacia el lado de la curva")
  assert.ok(m.y < c.control.y, "está en el control, no en la curva")
})
