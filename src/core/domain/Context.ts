import type { Versioned } from "./Versioned"
import type { ContextId, ItemRef, NoteId, PlanId } from "./Ids"

/**
 * Qué se muestra al abrir un Contexto:
 * - "context": la lista de sus elementos
 * - "note" / "plan": entra directo a uno concreto
 */
export type DefaultView =
  | { readonly type: "context" }
  | { readonly type: "note"; readonly id: NoteId }
  | { readonly type: "plan"; readonly id: PlanId }

/**
 * Agrupa notas y planes.
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
}
