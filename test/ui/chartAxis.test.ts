/**
 * El eje del tiempo de la gráfica de una rutina: sus topes, acercar sin mover lo
 * que hay bajo el puntero, arrastrar y el pellizco a lo ancho.
 */

import { describe, it } from "node:test"
import assert from "node:assert/strict"

import type { ChartAxis } from "#ui/chartAxis"
import { axisStart, clampAxis, defaultAxis, panAxis, pinchAxis, weekX, zoomAxis } from "#ui/chartAxis"

const cerca = (a: number, b: number): void => assert.ok(Math.abs(a - b) < 1e-9, `${a} ≠ ${b}`)

describe("topes", (): void => {
  it("la primera vez, las últimas 12 semanas; con menos, todas", (): void => {
    assert.deepEqual(defaultAxis(50), { span: 12, fromEnd: 0 })
    assert.deepEqual(defaultAxis(5), { span: 5, fromEnd: 0 })
    assert.deepEqual(defaultAxis(1), { span: 1, fromEnd: 0 })
  })

  it("se ven entre 4 semanas y toda la historia, sin pasarse de los bordes", (): void => {
    assert.deepEqual(clampAxis({ span: 1, fromEnd: 0 }, 50), { span: 4, fromEnd: 0 })
    assert.deepEqual(clampAxis({ span: 80, fromEnd: 3 }, 50), { span: 50, fromEnd: 0 })
    assert.deepEqual(clampAxis({ span: 10, fromEnd: 45 }, 50), { span: 10, fromEnd: 40 })
    assert.deepEqual(clampAxis({ span: 10, fromEnd: 0 }, 3), { span: 3, fromEnd: 0 })
  })

  it("un eje que ya está dentro es el MISMO", (): void => {
    const a: ChartAxis = { span: 10, fromEnd: 5 }
    assert.strictEqual(clampAxis(a, 50), a)
  })
})

describe("acercar y alejar", (): void => {
  it("la semana bajo el puntero no se mueve", (): void => {
    const a: ChartAxis = { span: 20, fromEnd: 10 }
    const antes: number = axisStart(a, 100) + 0.25 * a.span
    const b: ChartAxis = zoomAxis(a, 100, 0.25, 2)
    cerca(b.span, 10)
    cerca(axisStart(b, 100) + 0.25 * b.span, antes)
  })

  it("alejar del todo enseña toda la historia", (): void => {
    assert.deepEqual(zoomAxis({ span: 20, fromEnd: 10 }, 30, 0.5, 0.01), { span: 30, fromEnd: 0 })
  })

  it("en el tope, no cambia: el MISMO eje", (): void => {
    const a: ChartAxis = { span: 4, fromEnd: 0 }
    assert.strictEqual(zoomAxis(a, 50, 1, 3), a)
  })
})

describe("arrastrar", (): void => {
  it("hacia la derecha se ven semanas más antiguas, hasta el principio", (): void => {
    assert.deepEqual(panAxis({ span: 10, fromEnd: 0 }, 50, 0.5), { span: 10, fromEnd: 5 })
    assert.deepEqual(panAxis({ span: 10, fromEnd: 38 }, 50, 0.5), { span: 10, fromEnd: 40 })
  })

  it("hacia la izquierda, no se pasa de hoy", (): void => {
    assert.deepEqual(panAxis({ span: 10, fromEnd: 2 }, 50, -0.5), { span: 10, fromEnd: 0 })
  })
})

describe("pellizco", (): void => {
  it("separar los dedos el doble acerca al doble, alrededor del punto medio", (): void => {
    const a: ChartAxis = { span: 20, fromEnd: 10 }
    const b: ChartAxis = pinchAxis(a, 100, 0.4, 0.6, 0.3, 0.7)
    cerca(b.span, 10)
    cerca(axisStart(b, 100) + 0.5 * b.span, axisStart(a, 100) + 0.5 * a.span)
  })

  it("con los dedos en la misma columna sólo se arrastra", (): void => {
    const b: ChartAxis = pinchAxis({ span: 20, fromEnd: 10 }, 100, 0.5, 0.5, 0.6, 0.6)
    assert.equal(b.span, 20)
    cerca(b.fromEnd, 12)
  })
})

describe("dónde cae una semana", (): void => {
  it("la última, al final; la primera visible, al principio", (): void => {
    const a: ChartAxis = { span: 4, fromEnd: 0 }
    cerca(weekX(a, 10, 9, 400), 350)
    cerca(weekX(a, 10, 6, 400), 50)
  })
})
