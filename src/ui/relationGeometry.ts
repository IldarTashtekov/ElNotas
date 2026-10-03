/**
 * Dónde se dibuja cada relación de un diagrama: de qué punto del borde de un
 * pósit sale, a qué punto del otro llega y cuánto se curva. Puro, sin DOM.
 *
 * Entre dos nodos puede haber varias relaciones, en cualquier sentido: se abren
 * en abanico, cada una con su curvatura, y una sola va recta. El texto de una
 * relación sigue la línea, pero nunca boca abajo.
 */

import type { Point } from "./viewport.js"

/** Un pósit, en unidades del corcho: su centro y lo que mide. */
export interface Box {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

/** Lo que separa una curva de la de al lado, en su punto más alejado de la recta. */
export const FAN_SPACING: number = 28

/**
 * Dónde corta el borde de `box` la recta que va de su centro hacia `hacia`. Si
 * `hacia` es el propio centro, el centro.
 */
export const borderPoint = (box: Box, hacia: Point): Point => {
  const dx: number = hacia.x - box.x
  const dy: number = hacia.y - box.y
  if (dx === 0 && dy === 0) return { x: box.x, y: box.y }
  const t: number = Math.min(
    dx === 0 ? Number.POSITIVE_INFINITY : box.width / 2 / Math.abs(dx),
    dy === 0 ? Number.POSITIVE_INFINITY : box.height / 2 / Math.abs(dy),
  )
  return { x: box.x + dx * t, y: box.y + dy * t }
}

/** Lo que hace falta de una relación para repartir el abanico. */
export interface FanItem {
  readonly id: string
  readonly from: string
  readonly to: string
}

/** El par de nodos, sin sentido: A→B y B→A son del mismo par. */
const parDe = (r: FanItem): string => (r.from < r.to ? `${r.from}|${r.to}` : `${r.to}|${r.from}`)

/**
 * La curvatura de cada relación. Las del mismo par se reparten alrededor del
 * cero, separadas `FAN_SPACING`, en el orden de sus ids; una sola, cero. El
 * signo se mide siempre hacia el mismo lado del par —el que queda a la derecha
 * yendo del nodo de id menor al mayor—, así que A→B y B→A no se pisan.
 */
export const fanOffsets = (relaciones: ReadonlyArray<FanItem>): ReadonlyMap<string, number> => {
  const grupos: Map<string, ReadonlyArray<string>> = new Map<string, ReadonlyArray<string>>()
  for (const r of relaciones) {
    const par: string = parDe(r)
    grupos.set(par, [...(grupos.get(par) ?? []), r.id])
  }
  const curvas: Map<string, number> = new Map<string, number>()
  for (const ids of grupos.values()) {
    const orden: ReadonlyArray<string> = [...ids].sort()
    orden.forEach((id: string, k: number): void => {
      curvas.set(id, (k - (orden.length - 1) / 2) * FAN_SPACING)
    })
  }
  return curvas
}

/** Cómo se dibuja una relación: los dos extremos, ya en el borde, y el punto de control. */
export interface RelationCurve {
  readonly start: Point
  readonly control: Point
  readonly end: Point
}

/**
 * La curva de una relación de `desde` a `hasta`, con la curvatura `offset` de
 * `fanOffsets`. `idDesde` e `idHasta` dicen hacia qué lado se curva: el mismo
 * para las dos direcciones del par.
 */
export const relationCurve = (
  desde: Box,
  hasta: Box,
  idDesde: string,
  idHasta: string,
  offset: number,
): RelationCurve => {
  /* El lado se mide yendo del nodo de id menor al mayor, sea cual sea el sentido. */
  const a: Box = idDesde < idHasta ? desde : hasta
  const b: Box = idDesde < idHasta ? hasta : desde
  const dx: number = b.x - a.x
  const dy: number = b.y - a.y
  const largo: number = Math.hypot(dx, dy)
  /* La normal, a la derecha de a→b. Con los centros en el mismo sitio no hay lado. */
  const nx: number = largo === 0 ? 0 : -dy / largo
  const ny: number = largo === 0 ? 0 : dx / largo
  /* El vértice de una cuadrática queda a mitad de camino del control: se dobla. */
  const control: Point = {
    x: (desde.x + hasta.x) / 2 + nx * offset * 2,
    y: (desde.y + hasta.y) / 2 + ny * offset * 2,
  }
  return { start: borderPoint(desde, control), control, end: borderPoint(hasta, control) }
}

const punto = (p: Point): string => `${p.x} ${p.y}`

/** El trazado SVG de la curva, de `start` a `end`. */
export const curvePath = (c: RelationCurve): string =>
  `M ${punto(c.start)} Q ${punto(c.control)} ${punto(c.end)}`

/**
 * El trazado que sigue el texto: el mismo, salvo que vaya de derecha a
 * izquierda; entonces, al revés, para que el texto no salga boca abajo.
 */
export const labelPath = (c: RelationCurve): string =>
  c.end.x < c.start.x
    ? `M ${punto(c.end)} Q ${punto(c.control)} ${punto(c.start)}`
    : curvePath(c)
