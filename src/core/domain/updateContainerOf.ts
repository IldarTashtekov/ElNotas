/**
 * Transformar el contenedor de una línea: la lista raíz de la nota, o la casilla
 * de la que cuelga.
 *
 * Es la pieza que permite **cambiar cuántas líneas hay** —añadir, quitar, partir
 * una en dos, unir dos en una—, que es lo que la primitiva A no puede hacer:
 * aquélla sustituye una línea por otra y la lista sale siempre del mismo tamaño.
 *
 * ⚠️ Si nada cambia se devuelve el array de entrada, sin copiar. La
 * transformación tiene que colaborar devolviendo *su* entrada tal cual cuando no
 * le toque hacer nada.
 */

import type { CheckBox, Content } from "./Content"
import { isCheckBox } from "./Content"
import type { ContentId } from "./Ids"
import { mapPreservingIdentity } from "./updateContent"

/** ¿Está esa línea directamente en esta lista? Sin bajar a las hijas. */
const contains = (
  items: ReadonlyArray<{ readonly id: ContentId }>,
  id: ContentId,
): boolean =>
  items.some((item: { readonly id: ContentId }): boolean => item.id === id)

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
  mapPreservingIdentity(items, (checkbox: CheckBox): CheckBox => {
    if (contains(checkbox.children, id)) return fn(checkbox)
    const children: ReadonlyArray<CheckBox> = updateParentIn(checkbox.children, id, fn)
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

  return mapPreservingIdentity<Content>(content, (block: Content): Content => {
    // Un texto no tiene hijas: no puede ser el contenedor de nadie.
    if (!isCheckBox(block)) return block
    if (contains(block.children, id)) return fn.onParent(block)
    const children: ReadonlyArray<CheckBox> = updateParentIn(block.children, id, fn.onParent)
    return children === block.children ? block : { ...block, children }
  })
}
