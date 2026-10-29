import type { CalendarEvent } from "./CalendarEvent.js"
import type { Context } from "./Context.js"
import type { Diagram } from "./Diagram.js"
import type { ContextId, DiagramId, EventId, NoteId, RoutineId } from "./Ids.js"
import type { Note } from "./Note.js"
import type { Routine } from "./Routine.js"

/**
 * Estado raíz de la aplicación: plano y normalizado, como una mini base de datos.
 *
 * Las entidades no se anidan unas dentro de otras; los Contextos guardan
 * referencias. El
 * "ContextoGeneral" no está aquí porque no es una entidad: es una vista
 * derivada de `notes` y `diagrams`.
 *
 * El estado de navegación (las "Ventanas") tampoco vive aquí: es estado de
 * vista, no de dominio, y mezclarlos llenaría la persistencia de basura de UI.
 *
 * ⚠️ `schemaVersion` **no va aquí**, y este comentario decía lo contrario. Es una
 * propiedad de **lo guardado**, no del estado en memoria: aquí no significaría
 * nada, no la leería nadie, y cada acción tendría que arrastrarla intacta de un
 * estado al siguiente. Vive en `StorageAdapter`, y quien la lee es el runner de
 * migraciones al arrancar — antes de que exista un `AppState`.
 */
export interface AppState {
  readonly notes: Readonly<Record<NoteId, Note>>
  readonly diagrams: Readonly<Record<DiagramId, Diagram>>
  readonly contexts: Readonly<Record<ContextId, Context>>
  readonly events: Readonly<Record<EventId, CalendarEvent>>
  readonly routines: Readonly<Record<RoutineId, Routine>>
}

export const emptyAppState = (): AppState => ({
  notes: {},
  diagrams: {},
  contexts: {},
  events: {},
  routines: {},
})
