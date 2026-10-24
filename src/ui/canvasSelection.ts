/**
 * Lo que decide la selección del lienzo, sin DOM: el rectángulo entre dos
 * esquinas, qué pósits toca, y hacia dónde avanza el corcho cuando el dedo que
 * arrastra un pósit llega a la franja de un borde.
 */

import type { Box } from "./relationGeometry.js"
import type { Point } from "./viewport.js"

/** El ancho de la franja de cada borde que hace avanzar el corcho. */
export const EDGE_BAND_PX: number = 40
/** Lo que avanza el corcho por segundo con el dedo en la franja: fijo, sin acelerar. */
export const EDGE_SPEED_PX_S: number = 360

export interface Rect {
  readonly left: number
  readonly top: number
  readonly right: number
  readonly bottom: number
}

/** El rectángulo entre dos esquinas opuestas, en cualquier orden. */
export const rectBetween = (a: Point, b: Point): Rect => ({
  left: Math.min(a.x, b.x),
  top: Math.min(a.y, b.y),
  right: Math.max(a.x, b.x),
  bottom: Math.max(a.y, b.y),
})

/**
 * Los que toca el rectángulo, aunque sea sólo con un borde. Cada caja se mide
 * desde su centro, como se coloca un pósit.
 */
export const boxesTouching = (
  cajas: ReadonlyMap<string, Box>,
  r: Rect,
): ReadonlyArray<string> =>
  [...cajas.entries()]
    .filter(
      ([, c]: readonly [string, Box]): boolean =>
        c.x - c.width / 2 <= r.right &&
        c.x + c.width / 2 >= r.left &&
        c.y - c.height / 2 <= r.bottom &&
        c.y + c.height / 2 >= r.top,
    )
    .map(([id]: readonly [string, Box]): string => id)

/**
 * Hacia dónde se desplaza el corcho con el dedo en `p`, en un lienzo de
 * `width` × `height`: +1, −1 o 0 en cada eje. Junto al borde izquierdo, +1 en
 * `x`: el corcho va a la derecha y asoma lo que había a la izquierda. Fuera del
 * lienzo, como en la franja.
 */
export const edgeDirection = (p: Point, width: number, height: number): Point => {
  const eje = (v: number, largo: number): number => {
    if (v < EDGE_BAND_PX) return 1
    if (v > largo - EDGE_BAND_PX) return -1
    return 0
  }
  return { x: eje(p.x, width), y: eje(p.y, height) }
}
