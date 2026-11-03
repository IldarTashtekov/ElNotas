/**
 * El vocabulario del «dónde» al insertar o mover líneas.
 *
 * El modelo sabe señalar nodos —«esta casilla»— pero no posiciones —«justo detrás
 * de esta casilla»—, y eso es lo que les hace falta a `insert` y a `move`.
 *
 * Son cuatro casos y ninguno más:
 *
 *     root-end       al final de la nota, en la raíz
 *     after          detrás de una línea, como hermana suya
 *     before         delante de una línea: la primera del todo, o la primera hija
 *     last-child-of  como última hija de una casilla, un nivel dentro
 */

import type { ContentId } from "./Ids.js"

/**
 * Unión discriminada por `at`, por el mismo motivo que `Content` lo es por
 * `type`: para que el `switch` que la consuma sea **exhaustivo**, y añadir un
 * caso el día de mañana rompa la compilación en vez de colarse en silencio.
 */
export type Position =
  | { readonly at: "root-end" }
  | { readonly at: "after"; readonly id: ContentId }
  | { readonly at: "before"; readonly id: ContentId }
  | { readonly at: "last-child-of"; readonly id: ContentId }

/*
    Constructores, como en `Ids.ts` y en `Content.ts`: quien llama no construye
    objetos literales a mano.
*/

/** Al final del contenido de la nota, en la raíz. */
export const rootEnd: Position = { at: "root-end" }

/** Justo detrás de ese bloque, como hermano suyo. */
export const after = (id: ContentId): Position => ({ at: "after", id })

/** Justo delante de ese bloque, como hermano suyo. */
export const before = (id: ContentId): Position => ({ at: "before", id })

/** Como última hija de esa casilla, un nivel dentro. */
export const lastChildOf = (id: ContentId): Position => ({ at: "last-child-of", id })
