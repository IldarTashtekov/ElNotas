import type { Context } from "./Context"
import type { ContextId, NoteId, PlanId } from "./Ids"
import type { Note } from "./Note"
import type { Plan } from "./Plan"

/**
 * Estado raíz de la aplicación: plano y normalizado, como una mini base de datos.
 *
 * Las entidades no se anidan unas dentro de otras; los Contextos guardan
 * referencias. El "ContextoGeneral" no está aquí porque no es una entidad: es
 * una vista derivada de `notes` y `plans`.
 *
 * El estado de navegación (las "Ventanas") tampoco vive aquí: es estado de
 * vista, no de dominio, y mezclarlos llenaría la persistencia de basura de UI.
 *
 * Falta `schemaVersion`, que entra en la Fase 2 junto al runner de migraciones
 * que lo consume.
 */
export interface AppState {
  readonly notes: Readonly<Record<NoteId, Note>>
  readonly plans: Readonly<Record<PlanId, Plan>>
  readonly contexts: Readonly<Record<ContextId, Context>>
}

export const emptyAppState = (): AppState => ({
  notes: {},
  plans: {},
  contexts: {},
})
