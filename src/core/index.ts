/**
 * API pública del core.
 *
 * Todo lo que consuman `ui/`, `storage/` o `platform/` se importa desde aquí, por
 * el alias `#core/`, nunca apuntando a ficheros internos: es lo que hace que el
 * límite del módulo exista de verdad. Dentro del core, los imports son relativos.
 *
 * Sólo sale lo que usa otro módulo de `src/`: lo demás es maquinaria interna, y
 * las pruebas lo importan por su fichero. Lo vigila `npm run check:exportaciones`.
 */

/* Identificadores y referencias */
export type {
  ContentId,
  ContextId,
  DiagramId,
  DiagramNodeId,
  DiagramRelationId,
  EventGroupId,
  EventId,
  ItemRef,
  NoteId,
  Revision,
} from "./domain/Ids.js"
export {
  contentId,
  contextId,
  diagramId,
  diagramNodeId,
  diagramRef,
  diagramRelationId,
  noteId,
  noteRef,
} from "./domain/Ids.js"

/* Contenido de una nota */
export type { CheckBox, Content } from "./domain/Content.js"
export { isCheckBox } from "./domain/Content.js"

/* El fallo como valor: lo que puede fallar lo devuelve, no lo lanza.
   Quien lo produce vive fuera del core —los adaptadores de `storage/`—, así que
   el tipo y sus dos constructores salen por aquí. `Result` es el sobre y va
   suelto en `domain/`: un `Result<Note, never>` no lleva ningún error dentro. */
export type { Result } from "./domain/Result.js"
export { err, ok } from "./domain/Result.js"

/* …y lo que va dentro del sobre. Los errores son entidades del dominio y viven
   juntos en `domain/errors/`, no repartidos por el módulo que los produce. */
export type { StorageError } from "./domain/errors/StorageError.js"
export type { MigrationError } from "./domain/errors/MigrationError.js"

/* El "dónde": vocabulario de posiciones para insertar */
export type { Position } from "./domain/Position.js"
export { after, lastChildOf, rootEnd } from "./domain/Position.js"

/* La capa de aplicación: la caja del estado y los casos de uso */
export type { Store, Unsubscribe } from "./app/Store.js"
export { createStore } from "./app/Store.js"
export type { UseCases } from "./app/useCases.js"
export { createUseCases } from "./app/useCases.js"
/* Qué cambió entre dos estados: la mitad PURA del write-behind, que consume
   `storage/`. La otra mitad —el temporizador— vive allí, fuera de la verja. */
export type { StateDiff } from "./app/diffState.js"
export { NO_CHANGES, diffState } from "./app/diffState.js"

/* El arranque, en su mitad pura: de lo guardado al estado, y las migraciones.
   La otra mitad —quién abre el storage, qué se ve sin nada guardado— es Fase 4. */
export type { StoredEntities } from "./migrations/hydrate.js"
export { hydrate } from "./migrations/hydrate.js"
export type { MigrationResult } from "./migrations/runMigrations.js"
export {
  CURRENT_SCHEMA_VERSION,
  EMPTY_STORE_VERSION,
  runMigrations,
} from "./migrations/runMigrations.js"

/* Puertos: lo que el core necesita del mundo, y que implementa `platform/` */
export type { Clock } from "./ports/Clock.js"
export type { IdGenerator } from "./ports/IdGenerator.js"
export type { Logger } from "./ports/Logger.js"
/* …y los de persistencia, que implementa `storage/`. Su taxonomía de fallos
   —`StorageError`— sale más arriba, con el resto de entidades del dominio. */
export type { Repository } from "./ports/Repository.js"
export type { StorageAdapter } from "./ports/StorageAdapter.js"
export type { BlobStore } from "./ports/BlobStore.js"

/* Entidades */
export type { Note } from "./domain/Note.js"
export type { Diagram, DiagramNode, DiagramRelation } from "./domain/Diagram.js"
export type { Context } from "./domain/Context.js"
export type { CalendarEvent } from "./domain/CalendarEvent.js"
export type { EventGroup } from "./domain/EventGroup.js"
/* Las fechas del calendario: el guardado valida con ellas lo que lee. */
export { parseDay, parseTime } from "./domain/calendar.js"
export type { AppState } from "./domain/AppState.js"
