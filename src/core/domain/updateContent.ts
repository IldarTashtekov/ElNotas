/**
 * Copia por camino (*path copying*): llegar hasta un bloque del contenido de una
 * nota y cambiarlo reconstruyendo SÓLO el camino desde la raíz hasta él, y
 * reutilizando por referencia todo lo demás. La técnica está explicada en
 * `ARCHITECTURE.md` §2.3; la invariante que sostiene, en §3.
 *
 * Esta es la **primitiva A** de las dos que necesitan las operaciones de
 * contenido (§5.4): *transformar un nodo*. La **B** —*transformar el array
 * contenedor*, que es la que usarán `insert`, `remove`, `split` y `merge`— es
 * otra pieza y llega con las operaciones estructurales.
 *
 * ⚠️ LA INVARIANTE, que es lo único que de verdad no se puede romper aquí:
 *
 *     si nada cambió, se devuelve EL MISMO array de entrada,
 *     no una copia equivalente.
 *
 * Romperla no hace fallar nada visible. La app sigue funcionando: sólo redibuja
 * de más y escribe en disco de más, en silencio y para siempre.
 */

import type { CheckBox, Content, Text } from "./Content"
import { isCheckBox } from "./Content"
import type { ContentId } from "./Ids"

/**
 * Como `map`, pero devuelve el array de ENTRADA si `fn` no cambió ni un elemento.
 *
 * `Array.prototype.map` devuelve **siempre** un array nuevo, y con eso solo ya se
 * desactiva en silencio la detección de cambios de toda la app: el reducer
 * ensucia `updatedAt`, la persistencia escribe, el `Store` notifica y el render
 * redibuja, aunque no haya cambiado nada.
 */
export const mapPreservingIdentity = <T>(
  items: ReadonlyArray<T>,
  fn: (item: T) => T,
): ReadonlyArray<T> => {
  let changed = false
  const next = items.map((item) => {
    const updated = fn(item)
    if (updated !== item) changed = true
    return updated
  })
  return changed ? next : items
}

/**
 * La recursión, y vive aquí una sola vez: el caso homogéneo, donde todo el array
 * son casillas. Una `CheckBox` sólo admite casillas por hijas, así que en
 * profundidad no hay ninguna unión que discriminar.
 *
 * Nótese el `children === checkbox.children`: sin esa comparación, una casilla
 * cuyo subárbol no cambió devolvería un objeto nuevo igualmente, y el camino
 * copiado se ensancharía hasta abarcar el árbol entero.
 */
const updateCheckBoxes = (
  items: ReadonlyArray<CheckBox>,
  id: ContentId,
  fn: (checkbox: CheckBox) => CheckBox,
): ReadonlyArray<CheckBox> =>
  mapPreservingIdentity(items, (checkbox) => {
    if (checkbox.id === id) return fn(checkbox)
    const children = updateCheckBoxes(checkbox.children, id, fn)
    return children === checkbox.children ? checkbox : { ...checkbox, children }
  })

/**
 * Las dos transformaciones, una por variante de `Content`.
 *
 * Van separadas porque en la raíz el array es `Content` (`Text | CheckBox`) y en
 * profundidad es `CheckBox`. Con una sola firma `(nodo: Content) => Content` el
 * compilador no podría garantizar que una casilla siga siendo casilla al bajar, y
 * haría falta un `as` o un descarte silencioso — justo lo que este proyecto no
 * quiere (§1). Partiéndola en dos, el cast desaparece.
 */
export interface NodeTransform {
  readonly onText: (text: Text) => Text
  readonly onCheckBox: (checkbox: CheckBox) => CheckBox
}

/**
 * Aplica la transformación al bloque con ese id, a cualquier profundidad.
 *
 * Devuelve el array de entrada intacto en sus dos casos: **el id no existe**, y
 * **la transformación no cambió nada**. El segundo es el que se olvida.
 *
 * Éste no es una segunda implementación de la recursión: es el adaptador del
 * nivel raíz, el único donde conviven textos y casillas.
 */
export const updateContent = (
  content: ReadonlyArray<Content>,
  id: ContentId,
  fn: NodeTransform,
): ReadonlyArray<Content> =>
  mapPreservingIdentity<Content>(content, (block) => {
    if (block.id === id) {
      return isCheckBox(block) ? fn.onCheckBox(block) : fn.onText(block)
    }
    // Un texto no tiene hijas: no hay por dónde seguir bajando.
    if (!isCheckBox(block)) return block
    const children = updateCheckBoxes(block.children, id, fn.onCheckBox)
    return children === block.children ? block : { ...block, children }
  })
