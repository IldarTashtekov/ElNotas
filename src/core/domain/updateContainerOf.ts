/**
 * Copia por camino, **primitiva B**: *transformar el contenedor de una línea*.
 *
 * La primitiva A (`updateContent.ts`) sabe sustituir una línea por otra, y con
 * eso basta para `setText` y `setChecked`. Pero recorre la lista pidiendo un
 * reemplazo por cada elemento, así que la lista que sale tiene **siempre** tantas
 * líneas como la que entró: no puede añadir, ni quitar, ni convertir una línea en
 * dos. Y eso es justo lo que hacen `insert`, `remove`, `split` y `merge`.
 *
 * ── Qué es un "contenedor" ─────────────────────────────────────────────────
 *
 * Toda línea vive en uno de dos sitios, y sólo dos:
 *
 *   - en la **raíz** de la nota, y entonces su contenedor es la lista raíz;
 *   - como **hija de una casilla**, y entonces su contenedor es esa casilla.
 *
 * Nótese que en el segundo caso el contenedor es **la casilla madre entera**, no
 * sólo su lista de hijas. No es un capricho: `merge` necesita que la madre
 * cambie de texto **y** pierda una hija a la vez, cuando absorbe a su primera
 * hija (§9.3).
 *
 * ── Por qué dos transformaciones y no una ──────────────────────────────────
 *
 * El mismo motivo que en la primitiva A: en la raíz conviven textos y casillas,
 * y en profundidad sólo hay casillas. Con una firma genérica se podría **meter un
 * texto suelto dentro de una casilla**, que es exactamente lo que el modelo
 * prohíbe. Partiéndola en dos, `onParent` recibe y devuelve una `CheckBox`, así
 * que sus hijas sólo pueden ser casillas: la regla la hace cumplir el compilador
 * y no hay comprobación que acordarse de escribir.
 *
 * ⚠️ Misma invariante que la A: **si nada cambia, se devuelve el array de
 * entrada.** Aquí la responsabilidad es compartida — la transformación tiene que
 * devolver *su* entrada tal cual cuando no aplique, y a cambio esta función
 * propaga esa identidad hasta la raíz.
 */

import type { CheckBox, Content } from "./Content"
import { isCheckBox } from "./Content"
import type { ContentId } from "./Ids"
import { mapPreservingIdentity } from "./updateContent"

/** ¿Está esa línea directamente en esta lista? Sin bajar a las hijas. */
const contains = (
  items: ReadonlyArray<{ readonly id: ContentId }>,
  id: ContentId,
): boolean => items.some((item) => item.id === id)

export interface ContainerTransform {
  /** La línea vive en la raíz: se recibe la lista raíz entera. */
  readonly onRoot: (items: ReadonlyArray<Content>) => ReadonlyArray<Content>
  /** La línea es hija de esa casilla: se recibe **la madre**, no sus hijas. */
  readonly onParent: (parent: CheckBox) => CheckBox
}

/**
 * La recursión, escrita una sola vez: el caso homogéneo, donde todo son casillas.
 * Busca a la que tiene a `id` entre sus hijas.
 */
const updateParentIn = (
  items: ReadonlyArray<CheckBox>,
  id: ContentId,
  fn: (parent: CheckBox) => CheckBox,
): ReadonlyArray<CheckBox> =>
  mapPreservingIdentity(items, (checkbox) => {
    if (contains(checkbox.children, id)) return fn(checkbox)
    const children = updateParentIn(checkbox.children, id, fn)
    return children === checkbox.children ? checkbox : { ...checkbox, children }
  })

/**
 * Llega al contenedor de esa línea, esté a la profundidad que esté, y lo
 * reescribe.
 *
 * **No hace nada si el id no existe**, ni en la raíz ni colgando de ninguna
 * casilla: ninguna de las dos transformaciones llega a llamarse.
 */
export const updateContainerOf = (
  content: ReadonlyArray<Content>,
  id: ContentId,
  fn: ContainerTransform,
): ReadonlyArray<Content> => {
  // Caso raíz. Va aparte porque no hay madre a la que llegar: el contenedor es
  // la propia lista que nos han pasado.
  if (contains(content, id)) return fn.onRoot(content)

  return mapPreservingIdentity<Content>(content, (block) => {
    // Un texto no tiene hijas: no puede ser el contenedor de nadie.
    if (!isCheckBox(block)) return block
    if (contains(block.children, id)) return fn.onParent(block)
    const children = updateParentIn(block.children, id, fn.onParent)
    return children === block.children ? block : { ...block, children }
  })
}
