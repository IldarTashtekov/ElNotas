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
 * Lo que sale por aquí son cinco grupos: el **modelo** (entidades, IDs,
 * contenido, `Position`, `Result` y los errores), las **ocho operaciones** sobre
 * el contenido de una nota, la **capa de aplicación** (las diecisiete acciones,
 * `createStore`, `createUseCases`, `diffState`), la **mitad pura del arranque**
 * (`hydrate`, `runMigrations`) y los **cinco puertos**.
 *
 * Y hay tres cosas que a propósito NO salen, porque son maquinaria interna: las
 * dos primitivas del helper de copia por camino (`updateContent` y
 * `updateContainerOf`) y `reduce`, al que se llega por el `Store`.
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

/* El fallo como valor: lo que puede fallar lo devuelve, no lo lanza (§6.5).
   Quien lo produce vive fuera del core —los adaptadores de `storage/`—, así que
   el tipo y sus dos constructores salen por aquí. `Result` es el sobre y va
   suelto en `domain/`: un `Result<Note, never>` no lleva ningún error dentro. */
export type { Result } from "./domain/Result"
export { err, ok } from "./domain/Result"

/* …y lo que va dentro del sobre. Los errores son entidades del dominio y viven
   juntos en `domain/errors/`, no repartidos por el módulo que los produce. */
export type { StorageError } from "./domain/errors/StorageError"
export type { MigrationError } from "./domain/errors/MigrationError"

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
/* …y los de persistencia, que implementa `storage/`. Su taxonomía de fallos
   —`StorageError`— sale más arriba, con el resto de entidades del dominio. */
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
