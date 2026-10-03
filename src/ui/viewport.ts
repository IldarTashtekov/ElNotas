/**
 * El encuadre del lienzo de un diagrama: dónde está el corcho en la pantalla y a
 * qué escala. Puro, sin DOM.
 *
 * Un punto del corcho se ve en `corcho × scale + offset`. Moverlo es cambiar el
 * `offset`; acercarlo, la `scale`, sin que se mueva lo que hay bajo el dedo.
 */

/** Un punto, en píxeles de pantalla o en unidades del corcho según quién lo use. */
export interface Point {
  readonly x: number
  readonly y: number
}

export interface Viewport {
  readonly offsetX: number
  readonly offsetY: number
  readonly scale: number
}

/** Lo más lejos y lo más cerca que se puede ver el corcho. */
export const MIN_SCALE: number = 0.25
export const MAX_SCALE: number = 4

const acotar = (scale: number): number => Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale))

/** Al abrir: el origen del corcho en el centro de la pantalla, a tamaño real. */
export const centeredViewport = (width: number, height: number): Viewport => ({
  offsetX: width / 2,
  offsetY: height / 2,
  scale: 1,
})

/** De pantalla a corcho: dónde cae en el corcho lo que hay bajo el dedo. */
export const toCanvas = (v: Viewport, p: Point): Point => ({
  x: (p.x - v.offsetX) / v.scale,
  y: (p.y - v.offsetY) / v.scale,
})

/** De corcho a pantalla. */
export const toScreen = (v: Viewport, p: Point): Point => ({
  x: p.x * v.scale + v.offsetX,
  y: p.y * v.scale + v.offsetY,
})

/** Desplaza el corcho. Sin desplazamiento, el mismo encuadre. */
export const panBy = (v: Viewport, dx: number, dy: number): Viewport =>
  dx === 0 && dy === 0 ? v : { ...v, offsetX: v.offsetX + dx, offsetY: v.offsetY + dy }

/** El encuadre a escala `scale` que deja el punto del corcho `c` bajo `p`. */
const conPuntoEn = (c: Point, p: Point, scale: number): Viewport => ({
  offsetX: p.x - c.x * scale,
  offsetY: p.y - c.y * scale,
  scale,
})

/**
 * Acerca (`factor` > 1) o aleja alrededor de `p`, que se queda quieto. Si la
 * escala ya está en su tope, el mismo encuadre.
 */
export const zoomAround = (v: Viewport, p: Point, factor: number): Viewport => {
  const scale: number = acotar(v.scale * factor)
  if (scale === v.scale) return v
  return conPuntoEn(toCanvas(v, p), p, scale)
}

const distancia = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y)
const puntoMedio = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })

/**
 * El pellizco, calculado siempre desde como estaba al empezar: `inicio` es el
 * encuadre al poner el segundo dedo, `a0`/`b0` dónde estaban los dos dedos
 * entonces y `a1`/`b1` dónde están ahora. Acerca lo que se separan y arrastra lo
 * que se mueve su punto medio.
 */
export const pinch = (inicio: Viewport, a0: Point, b0: Point, a1: Point, b1: Point): Viewport => {
  const antes: number = distancia(a0, b0)
  const scale: number =
    antes === 0 ? inicio.scale : acotar((inicio.scale * distancia(a1, b1)) / antes)
  return conPuntoEn(toCanvas(inicio, puntoMedio(a0, b0)), puntoMedio(a1, b1), scale)
}

/** Lo que acerca un paso de rueda: hacia arriba, más cerca. */
export const wheelFactor = (deltaY: number): number => Math.exp(-deltaY * 0.002)
