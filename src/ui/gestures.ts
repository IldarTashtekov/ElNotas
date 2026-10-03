/**
 * Qué ha hecho el dedo (o el ratón) en el lienzo: un toque, un doble toque o una
 * pulsación larga. Puro, sin DOM: el lienzo le pasa dónde y cuándo.
 *
 * Los umbrales de la pulsación larga son los mismos que los del arrastre de las
 * fichas de ventanas, para que los dos gestos se sientan igual.
 */

import type { Point } from "./viewport.js"

/** Lo que dura una pulsación larga. */
export const LONG_PRESS_MS: number = 500
/** Lo que se puede mover el dedo sin que deje de ser un toque o una pulsación. */
export const MOVE_TOLERANCE_PX: number = 10
/** Lo que se espera al segundo toque; es también lo que tarda en abrirse un nodo-nota. */
export const DOUBLE_TAP_MS: number = 250
/** Lo lejos que puede caer el segundo toque del primero: un dedo no repite el sitio exacto. */
export const DOUBLE_TAP_DISTANCE_PX: number = 25

/** Si el dedo se ha alejado tanto de donde empezó que ya está arrastrando. */
export const movedBeyondTolerance = (from: Point, to: Point): boolean =>
  Math.abs(to.x - from.x) > MOVE_TOLERANCE_PX || Math.abs(to.y - from.y) > MOVE_TOLERANCE_PX

/**
 * Un toque terminado. `target` dice sobre qué cayó —un nodo, una relación, el
 * fondo—, para que dos toques en sitios distintos no cuenten como doble.
 */
export interface Tap {
  readonly x: number
  readonly y: number
  readonly time: number
  readonly target: string
}

/** Si `current` es el segundo toque de un doble toque que empezó en `previous`. */
export const isDoubleTap = (previous: Tap | null, current: Tap): boolean =>
  previous !== null &&
  previous.target === current.target &&
  current.time - previous.time <= DOUBLE_TAP_MS &&
  Math.hypot(current.x - previous.x, current.y - previous.y) <= DOUBLE_TAP_DISTANCE_PX
