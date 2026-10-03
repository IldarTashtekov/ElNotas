/**
 * Lo seleccionado en una lista —notas y diagramas—, como conjunto inmutable.
 *
 * Todas devuelven el MISMO conjunto si no cambia nada: así quien pinta sabe sin
 * mirar dentro que no hay nada que repintar.
 */

import type { ItemRef } from "#core/index"

/** Cada fila por su clave: una nota y un diagrama con el mismo id son dos filas. */
export type Selection = ReadonlySet<string>

export const NO_SELECTION: Selection = new Set<string>()

/** La clave de una fila en la selección. */
export const itemKey = (ref: ItemRef): string => `${ref.kind}:${ref.id}`

/** Si estaba, la quita; si no, la pone. */
export const toggleSelected = (sel: Selection, key: string): Selection => {
  const siguiente: Set<string> = new Set<string>(sel)
  if (sel.has(key)) siguiente.delete(key)
  else siguiente.add(key)
  return siguiente.size === 0 ? NO_SELECTION : siguiente
}

/** Deja sólo las que siguen en la lista: algo borrado no sigue seleccionado. */
export const pruneSelected = (sel: Selection, visibles: ReadonlyArray<string>): Selection => {
  const quedan: ReadonlyArray<string> = visibles.filter((key: string): boolean => sel.has(key))
  if (quedan.length === sel.size) return sel
  return quedan.length === 0 ? NO_SELECTION : new Set<string>(quedan)
}
