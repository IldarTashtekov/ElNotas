/**
 * El vocabulario del "dónde".
 *
 * El modelo sabe direccionar **nodos** (`ContentId`), pero no **posiciones**: un
 * id dice "esta casilla", no dice "justo detrás de esta casilla". `insert` lo
 * necesita, y esto es lo que le falta al modelo para poder expresarlo.
 *
 * **Son tres casos y ninguno más** (`ARCHITECTURE.md` §9.4). No es casualidad que
 * sean tres: son exactamente los tres estados de `ModosEscritura` (§7.3), o sea
 * qué nace al pulsar Intro según el modo activo.
 *
 *     Modo "Texto"        → root-end       otra línea suelta al final
 *     Modo "Casilla"      → after          una casilla hermana
 *     Modo "Casilla hija" → last-child-of  una casilla un nivel dentro
 *
 * Quedan fuera `before`, `first-child-of` y `root-start`, y quedan fuera por
 * coste: cada caso es una rama más que probar en quien lo consuma. El disparador
 * para reabrirlo es el arrastrar y soltar de la Fase 4, que va en el mismo
 * paquete que `move`.
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
