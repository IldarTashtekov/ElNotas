import type { Versioned } from "./Versioned.js"
import type { ContextId, DiagramId, ItemRef, NoteId } from "./Ids.js"

/**
 * Qué se muestra al abrir un Contexto:
 * - "context": la lista de sus elementos
 * - "note" / "diagram": entra directo a uno concreto
 */
export type DefaultView =
  | { readonly type: "context" }
  | { readonly type: "note"; readonly id: NoteId }
  | { readonly type: "diagram"; readonly id: DiagramId }

/**
 * Agrupa notas y diagramas.
 *
 * `items` son REFERENCIAS, no las entidades. Es lo que permite que una nota esté
 * en varios contextos (base del ContextoCompuesto) y que guardar un contexto no
 * obligue a reescribir todas sus notas.
 */
export interface Context extends Versioned {
  readonly id: ContextId
  readonly name: string
  readonly defaultView: DefaultView
  readonly items: ReadonlyArray<ItemRef>
  /**
   * Lo de `items` que no sale en su lista, aunque siga siendo del contexto.
   * Siempre un subconjunto de `items`: el tipo no lo impide, lo impiden el
   * reducer y el arranque. Ausente es vacío, y así lo guardado antes no se migra.
   */
  readonly hidden?: ReadonlyArray<ItemRef>
}
