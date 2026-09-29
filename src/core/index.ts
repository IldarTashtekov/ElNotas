/**
 * API pública del core.
 *
 * Todo lo que consuman `ui/`, `storage/` o `platform/` se importa desde aquí, por
 * el alias `#core/`, nunca apuntando a ficheros internos: es lo que hace que el
 * límite del módulo exista de verdad. Dentro del core, los imports son relativos.
 *
 * Tres cosas NO salen a propósito, porque son maquinaria interna: las dos
 * primitivas de copia por camino y `reduce`, al que se llega por el `Store`.
 */

/* Identificadores y referencias */
export type {
  ContentId,
  ContextId,
  ItemRef,
  NoteId,
  PlanId,
  PlanNodeId,
  Revision,
} from "./domain/Ids.js"
export {
  contentId,
  contextId,
  noteId,
  noteRef,
  planId,
  planNodeId,
  planRef,
  revision,
} from "./domain/Ids.js"

/* Contenido de una nota */
export type { CheckBox, Content, Text } from "./domain/Content.js"
export { checkBox, isCheckBox, isText, text } from "./domain/Content.js"

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

/* La capa de aplicación: acciones, la caja del estado y los casos de uso */
export type {
  Action,
  ActionMeta,
  /* Las ocho de contenido */
  ContentAction,
  ConvertToCheckBox,
  ConvertToText,
  Insert,
  Merge,
  Remove,
  SetChecked,
  SetText,
  Split,
  /* Las tres de Nota */
  CreateNote,
  DeleteNote,
  NoteAction,
  RenameNote,
  /* Las seis de Contexto */
  AddItem,
  ContextAction,
  CreateContext,
  DeleteContext,
  RemoveItem,
  RenameContext,
  SetDefaultView,
} from "./app/Action.js"
export type { Listener, Store, Unsubscribe } from "./app/Store.js"
export { createStore } from "./app/Store.js"
export type { UseCaseDeps, UseCases } from "./app/useCases.js"
export { createUseCases } from "./app/useCases.js"
/* Qué cambió entre dos estados: la mitad PURA del write-behind, que consume
   `storage/`. La otra mitad —el temporizador— vive allí, fuera de la verja. */
export type { EntityChanges, StateDiff } from "./app/diffState.js"
export { NO_CHANGES, diffState } from "./app/diffState.js"

/* El arranque, en su mitad pura: de lo guardado al estado, y las migraciones.
   La otra mitad —quién abre el storage, qué se ve sin nada guardado— es Fase 4. */
export type { StoredEntities } from "./migrations/hydrate.js"
export { hydrate } from "./migrations/hydrate.js"
export type { Migration, MigrationOptions, MigrationResult } from "./migrations/runMigrations.js"
export {
  CURRENT_SCHEMA_VERSION,
  EMPTY_STORE_VERSION,
  MIGRATIONS,
  runMigrations,
} from "./migrations/runMigrations.js"

/* Puertos: lo que el core necesita del mundo, y que implementa `platform/` */
export type { Clock } from "./ports/Clock.js"
export type { IdGenerator } from "./ports/IdGenerator.js"
/* …y los de persistencia, que implementa `storage/`. Su taxonomía de fallos
   —`StorageError`— sale más arriba, con el resto de entidades del dominio. */
export type { Repository } from "./ports/Repository.js"
export type { StorageAdapter } from "./ports/StorageAdapter.js"
export type { BlobStore } from "./ports/BlobStore.js"

/* Operaciones sobre el contenido de una nota */
export {
  convertToCheckBox,
  convertToText,
  insert,
  merge,
  remove,
  setChecked,
  setText,
  split,
} from "./domain/operations.js"

/* Entidades */
export type { Versioned } from "./domain/Versioned.js"
export type { Note } from "./domain/Note.js"
export type { NoteNode, Plan, PlanNode, SimpleNode } from "./domain/Plan.js"
export type { Context, DefaultView } from "./domain/Context.js"
export type { AppState } from "./domain/AppState.js"
export { emptyAppState } from "./domain/AppState.js"
