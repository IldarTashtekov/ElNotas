/**
 * API pública del core.
 *
 * Todo lo que consuman ui/, storage/ o platform/ se importa desde aquí (vía el
 * alias #core/ declarado en package.json), nunca apuntando a ficheros internos:
 * es lo que hace que el límite del módulo exista de verdad y que moverlo a
 * packages/core algún día sea trivial.
 *
 * Dentro del core, en cambio, los imports son relativos.
 *
 * Ahora mismo esto es SÓLO el modelo de datos: entidades, sus IDs y los
 * constructores mínimos para crearlas y discriminarlas. Ninguna operación sobre
 * ellas — ni árbol de contenido, ni reducers, ni Store.
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
} from "./domain/Ids"
export {
  contentId,
  contextId,
  noteId,
  noteRef,
  planId,
  planNodeId,
  planRef,
  revision,
} from "./domain/Ids"

/* Contenido de una nota */
export type { CheckBox, Content, Text } from "./domain/Content"
export { checkBox, isCheckBox, isText, text } from "./domain/Content"

/* El "dónde": vocabulario de posiciones para insertar */
export type { Position } from "./domain/Position"
export { after, lastChildOf, rootEnd } from "./domain/Position"

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
} from "./app/Action"
export type { Listener, Store, Unsubscribe } from "./app/Store"
export { createStore } from "./app/Store"
export type { UseCaseDeps, UseCases } from "./app/useCases"
export { createUseCases } from "./app/useCases"
/* Qué cambió entre dos estados: la mitad PURA del write-behind, que consume
   `storage/`. La otra mitad —el temporizador— vive allí, fuera de la verja. */
export type { EntityChanges, StateDiff } from "./app/diffState"
export { NO_CHANGES, diffState } from "./app/diffState"

/* El arranque, en su mitad pura: de lo guardado al estado, y las migraciones.
   La otra mitad —quién abre el storage, qué se ve sin nada guardado— es Fase 4. */
export type { StoredEntities } from "./migrations/hydrate"
export { hydrate } from "./migrations/hydrate"
export type { Migration, MigrationOptions, MigrationResult } from "./migrations/runMigrations"
export {
  CURRENT_SCHEMA_VERSION,
  EMPTY_STORE_VERSION,
  MIGRATIONS,
  runMigrations,
} from "./migrations/runMigrations"

/* Puertos: lo que el core necesita del mundo, y que implementa `platform/` */
export type { Clock } from "./ports/Clock"
export type { IdGenerator } from "./ports/IdGenerator"
/* …y los de persistencia, que implementa `storage/` */
export type { Repository } from "./ports/Repository"
export type { StorageAdapter } from "./ports/StorageAdapter"
export type { BlobStore } from "./ports/BlobStore"

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
} from "./domain/operations"

/* Entidades */
export type { Versioned } from "./domain/Versioned"
export type { Note } from "./domain/Note"
export type { NoteNode, Plan, PlanNode, SimpleNode } from "./domain/Plan"
export type { Context, DefaultView } from "./domain/Context"
export type { AppState } from "./domain/AppState"
export { emptyAppState } from "./domain/AppState"
