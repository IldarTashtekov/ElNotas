/**
 * Las notas seleccionadas en una lista, como conjunto inmutable.
 *
 * Todas devuelven el MISMO conjunto si no cambia nada: así quien pinta sabe sin
 * mirar dentro que no hay nada que repintar.
 */

import type { NoteId } from "#core/index"

export type Selection = ReadonlySet<NoteId>

export const NO_SELECTION: Selection = new Set<NoteId>()

/** Si estaba, la quita; si no, la pone. */
export const toggleSelected = (sel: Selection, id: NoteId): Selection => {
  const siguiente: Set<NoteId> = new Set<NoteId>(sel)
  if (sel.has(id)) siguiente.delete(id)
  else siguiente.add(id)
  return siguiente.size === 0 ? NO_SELECTION : siguiente
}

/** Deja sólo las que siguen en la lista: una nota borrada no sigue seleccionada. */
export const pruneSelected = (sel: Selection, visibles: ReadonlyArray<NoteId>): Selection => {
  const quedan: ReadonlyArray<NoteId> = visibles.filter((id: NoteId): boolean => sel.has(id))
  if (quedan.length === sel.size) return sel
  return quedan.length === 0 ? NO_SELECTION : new Set<NoteId>(quedan)
}
