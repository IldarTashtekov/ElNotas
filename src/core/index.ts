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
export type { Action, ActionMeta, SetChecked } from "./app/Action"
export type { Listener, Store, Unsubscribe } from "./app/Store"
export { createStore } from "./app/Store"
export type { UseCaseDeps, UseCases } from "./app/useCases"
export { createUseCases } from "./app/useCases"

/* Puertos: lo que el core necesita del mundo, y que implementa `platform/` */
export type { Clock } from "./ports/Clock"
export type { IdGenerator } from "./ports/IdGenerator"

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
