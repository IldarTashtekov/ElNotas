/**
 * De dónde sale la hora.
 *
 * Mirar el reloj es una lectura del mundo, no un cálculo: llamarlo dos veces da
 * dos resultados. Una operación que dependa de eso deja de poder comprobarse, así
 * que el núcleo no lo llama, lo pide. Una prueba se fabrica el suyo en una línea:
 *
 *     const clock: Clock = { now: () => 1000 }
 *
 * ⚠️ A este puerto no lo protege el compilador: `Date.now()` sí compila dentro del
 * núcleo. Lo caza `npm run check:purity`.
 */
export interface Clock {
  /** Milisegundos desde 1970, el mismo formato que `Versioned.updatedAt`. */
  readonly now: () => number
}
