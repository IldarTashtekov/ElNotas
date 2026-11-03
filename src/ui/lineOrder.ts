/**
 * El modo Ordenar de una nota, sin DOM: qué líneas se llevan al arrastrar una, y
 * a qué posición del modelo corresponde dejarlas en un hueco y a una profundidad.
 *
 * La pantalla mide entre qué dos líneas cae el dedo y cuánto se ha ido a la
 * derecha; aquí se decide qué profundidades caben ahí y qué `Position` es eso.
 */

import type { Content, ContentId, Position } from "#core/index"
import { after, before, isCheckBox, lastChildOf, rootEnd } from "#core/index"

/** Una línea en orden de lectura, con lo hondo que está. */
export interface FlatLine {
  readonly id: ContentId
  readonly depth: number
  readonly checkBox: boolean
}

/** Dónde caen: la profundidad a la que se pinta la raya y la posición para `move`. */
export interface DropTarget {
  readonly depth: number
  readonly position: Position
}

/** Todas las líneas en orden de lectura; las de dentro de `fuera` no salen, ni sus hijas. */
const aplanar = (
  items: ReadonlyArray<Content>,
  depth: number,
  fuera: ReadonlySet<ContentId>,
): ReadonlyArray<FlatLine> =>
  items.flatMap((item: Content): ReadonlyArray<FlatLine> =>
    fuera.has(item.id)
      ? []
      : [
          { id: item.id, depth, checkBox: isCheckBox(item) },
          ...(isCheckBox(item) ? aplanar(item.children, depth + 1, fuera) : []),
        ],
  )

/** Las líneas de la nota en orden de lectura, con su profundidad. */
export const flatLines = (content: ReadonlyArray<Content>): ReadonlyArray<FlatLine> =>
  aplanar(content, 0, new Set<ContentId>())

/**
 * Lo que se lleva al arrastrar `dragged`: si está elegida, todas las elegidas
 * que existen; si no, sólo ella.
 */
export const linesToMove = (
  content: ReadonlyArray<Content>,
  selected: ReadonlySet<ContentId>,
  dragged: ContentId,
): ReadonlyArray<ContentId> =>
  selected.has(dragged)
    ? flatLines(content)
        .map((l: FlatLine): ContentId => l.id)
        .filter((id: ContentId): boolean => selected.has(id))
    : [dragged]

/** Las líneas que se quedan, en orden de lectura: sin las que se mueven ni sus hijas. */
export const remainingLines = (
  content: ReadonlyArray<Content>,
  moving: ReadonlyArray<ContentId>,
): ReadonlyArray<FlatLine> => aplanar(content, 0, new Set<ContentId>(moving))

/**
 * Las que borra la papelera, en orden de lectura: las elegidas y, de cada casilla,
 * todo su árbol. Lo mismo que hace `remove`.
 */
export const linesToDelete = (
  content: ReadonlyArray<Content>,
  selected: ReadonlySet<ContentId>,
): ReadonlyArray<ContentId> => {
  const quedan: ReadonlySet<ContentId> = new Set<ContentId>(
    aplanar(content, 0, selected).map((l: FlatLine): ContentId => l.id),
  )
  return flatLines(content)
    .map((l: FlatLine): ContentId => l.id)
    .filter((id: ContentId): boolean => !quedan.has(id))
}

/** ¿Va algún texto suelto entre las que se mueven? Entonces sólo caben en la raíz. */
export const movesText = (content: ReadonlyArray<Content>, moving: ReadonlyArray<ContentId>): boolean => {
  const ids: ReadonlySet<ContentId> = new Set<ContentId>(moving)
  return flatLines(content).some((l: FlatLine): boolean => ids.has(l.id) && !l.checkBox)
}

/**
 * Dónde caen en el hueco `gap` de las que se quedan (0, encima de la primera;
 * `rest.length`, debajo de la última), lo más cerca posible de `wanted`.
 *
 * Caben de la profundidad de la de debajo —más afuera, la dejarían colgando de
 * ellas— a una más que la de encima si es casilla. Con texto, sólo la raíz.
 * `null` si ahí no cabe ninguna.
 */
export const dropTarget = (
  rest: ReadonlyArray<FlatLine>,
  gap: number,
  wanted: number,
  onlyRoot: boolean,
): DropTarget | null => {
  const encima: FlatLine | undefined = rest[gap - 1]
  const debajo: FlatLine | undefined = rest[gap]
  const minima: number = debajo?.depth ?? 0
  const maxima: number = onlyRoot ? 0 : encima === undefined ? 0 : encima.depth + (encima.checkBox ? 1 : 0)
  if (minima > maxima) return null
  const depth: number = Math.min(maxima, Math.max(minima, Math.round(wanted)))

  if (encima === undefined) return { depth, position: debajo === undefined ? rootEnd : before(debajo.id) }
  /* Un nivel más dentro que la de encima: su primera hija, o la única. */
  if (depth === encima.depth + 1) {
    return { depth, position: debajo !== undefined && debajo.depth === depth ? before(debajo.id) : lastChildOf(encima.id) }
  }
  /* Si no, detrás de la de encima o de la madre suya que esté a esa profundidad. */
  const hermana: FlatLine | undefined = rest
    .slice(0, gap)
    .reverse()
    .find((l: FlatLine): boolean => l.depth <= depth)
  return hermana === undefined ? null : { depth, position: after(hermana.id) }
}
