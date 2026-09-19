/**
 * El vocabulario del «dónde» al insertar una línea.
 *
 * El modelo sabe señalar nodos —«esta casilla»— pero no posiciones —«justo detrás
 * de esta casilla»—, y eso es lo que le hace falta a `insert`.
 *
 * Son tres casos y ninguno más, uno por cada modo de escritura:
 *
 *     Modo "Texto"        → root-end       otra línea suelta al final
 *     Modo "Casilla"      → after          una casilla hermana
 *     Modo "Casilla hija" → last-child-of  una casilla un nivel dentro
 */

import type { ContentId } from "./Ids"

/**
 * Unión discriminada por `at`, por el mismo motivo que `Content` lo es por
 * `type`: para que el `switch` que la consuma sea **exhaustivo**, y añadir un
 * caso el día de mañana rompa la compilación en vez de colarse en silencio.
 */
export type Position =
  | { readonly at: "root-end" }
  | { readonly at: "after"; readonly id: ContentId }
  | { readonly at: "last-child-of"; readonly id: ContentId }

/*
    Constructores, como en `Ids.ts` y en `Content.ts`: quien llama no construye
    objetos literales a mano.
*/

/** Al final del contenido de la nota, en la raíz. */
export const rootEnd: Position = { at: "root-end" }

/** Justo detrás de ese bloque, como hermano suyo. */
export const after = (id: ContentId): Position => ({ at: "after", id })

/** Como última hija de esa casilla, un nivel dentro. */
export const lastChildOf = (id: ContentId): Position => ({ at: "last-child-of", id })
