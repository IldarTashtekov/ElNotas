/**
 * Las operaciones de contenido de una nota.
 *
 * Son ocho (`ARCHITECTURE.md` §9.3) y viven juntas a propósito: comparten una
 * misma disciplina, y leerlas seguidas es como se comprueba que se aplica igual
 * en todas.
 *
 *     Una operación que no aplica NO HACE NADA, en lugar de fallar.
 *     Y "no hacer nada" significa devolver el array de ENTRADA,
 *     no una copia equivalente.
 *
 * Enumerar cuándo no aplica cada una es **la mitad de su especificación**: la
 * tabla está en §9.3 y cada fila tiene su prueba en `operations.test.ts`.
 *
 * Todas son puras: no generan IDs, no leen el reloj y no lanzan excepciones.
 */

import type { Content } from "./Content"
import type { ContentId } from "./Ids"
import { updateContent } from "./updateContent"

/* ───────────────────────── Sin tocar la estructura ─────────────────────────
    Las dos triviales: cambian un campo de una línea y nada más. */

/**
 * Cambia el texto de un bloque, sea un texto suelto o una casilla: los dos lo
 * tienen.
 *
 * **No hace nada si:** el id no existe · el texto ya es ese.
 */
export const setText = (
  content: ReadonlyArray<Content>,
  id: ContentId,
  value: string,
): ReadonlyArray<Content> =>
  updateContent(content, id, {
    onText: (block) => (block.text === value ? block : { ...block, text: value }),
    onCheckBox: (block) => (block.text === value ? block : { ...block, text: value }),
  })

/**
 * Marca o desmarca una casilla.
 *
 * Se llama `setChecked` **y no `toggleChecked`** a conciencia: un *toggle* no
 * puede ser nunca un no-op —siempre cambia algo por definición—, mientras que
 * `setChecked(id, true)` sobre una casilla ya marcada sí puede devolver el árbol
 * intacto. El nombre es lo que sostiene la invariante (§3).
 *
 * **No arrastra a las hijas**, y es decisión cerrada: la primitiva es
 * deliberadamente mínima y la cascada se compone arriba, en la barra de
 * `ModosEscritura` (§7.2).
 *
 * **No hace nada si:** el id no existe · el id es un `Text`, que no tiene
 * `checked` · ya está en ese valor. Los tres salen de la forma del helper, sin
 * un solo condicional extra: fíjate en que `onText` devuelve la entrada tal cual.
 */
export const setChecked = (
  content: ReadonlyArray<Content>,
  id: ContentId,
  checked: boolean,
): ReadonlyArray<Content> =>
  updateContent(content, id, {
    onText: (block) => block,
    onCheckBox: (block) => (block.checked === checked ? block : { ...block, checked }),
  })
