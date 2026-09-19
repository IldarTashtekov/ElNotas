/**
 * De dónde salen los identificadores nuevos.
 *
 * Fabricarlos es una lectura del mundo, no un cálculo, así que el núcleo no lo
 * hace: lo pide. Así una prueba puede darle ids predecibles y saber qué esperar.
 *
 *     let n = 0
 *     const ids: IdGenerator = { next: () => `id-${n++}` }
 *
 * Devuelve texto pelado: no sabe ni le importa si eso va a ser una nota o un
 * contexto. Quien llama es quien lo sabe, y quien le pone la marca.
 */
export interface IdGenerator {
  /** Una cadena única. Quien llama la marca con el constructor que toque. */
  readonly next: () => string
}
