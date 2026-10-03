/**
 * Dónde caería una ficha que se arrastra: el puesto que le toca según por dónde
 * va el dedo. Puro: lo usa el arrastre de la lista de ventanas.
 */

/**
 * `centros` son los centros de las fichas, en orden y medidos al empezar a
 * arrastrar; `de`, la que se arrastra; `x`, por dónde va el dedo. El puesto es
 * cuántas de las otras han quedado a su izquierda.
 */
export const dropIndex = (centros: ReadonlyArray<number>, de: number, x: number): number =>
  centros.filter((c: number, j: number): boolean => j !== de && c < x).length
