/**
 * En qué orden se pintan los pósits de un lienzo, de abajo arriba: el último que
 * se movió o se creó queda encima. Puro, sin DOM.
 *
 * Ese orden no se guarda: al abrir otra vez el diagrama, se pintan en el orden en
 * que se crearon.
 */

/** Sube `id` al final de los levantados. Si ya era el último, la MISMA lista. */
export const raise = (raised: ReadonlyArray<string>, id: string): ReadonlyArray<string> =>
  raised[raised.length - 1] === id
    ? raised
    : [...raised.filter((x: string): boolean => x !== id), id]

/**
 * El orden de pintado: primero los que nunca se levantaron, en su orden de
 * creación; encima, los levantados, el último arriba. Un levantado que ya no
 * existe no se pinta.
 */
export const paintOrder = (
  ids: ReadonlyArray<string>,
  raised: ReadonlyArray<string>,
): ReadonlyArray<string> => {
  const existe: ReadonlySet<string> = new Set<string>(ids)
  const arriba: ReadonlySet<string> = new Set<string>(raised)
  return [
    ...ids.filter((id: string): boolean => !arriba.has(id)),
    ...raised.filter((id: string): boolean => existe.has(id)),
  ]
}
