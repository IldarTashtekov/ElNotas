/**
 * Las acciones: objetos planos que describen **qué ha pasado**.
 *
 * Una acción no es una función y no hace nada por sí misma. Es un dato, como un
 * apunte en un libro de cuentas, y eso tiene consecuencias prácticas: se puede
 * registrar, guardar, comparar en una prueba o mandar por la red tal cual.
 *
 * Son treinta y dos. Aquí están las ocho de contenido; las de Nota, Contexto y
 * Diagrama, abajo.
 * Es una unión discriminada por `type`, así que el `switch` del reducer **deja de
 * compilar** en cuanto se añada una acción sin tratar.
 */

import type { Content } from "../domain/Content.js"
import type { DefaultView } from "../domain/Context.js"
import type { DiagramNode, DiagramRelation } from "../domain/Diagram.js"
import type {
  ContentId,
  ContextId,
  DiagramId,
  DiagramNodeId,
  DiagramRelationId,
  ItemRef,
  NoteId,
  Revision,
} from "../domain/Ids.js"
import type { Position } from "../domain/Position.js"

/**
 * La hora y la revisión, **ya calculadas**, que viajan dentro de la acción.
 *
 * Es lo peculiar de este proyecto y merece explicación: el reducer es puro, así
 * que no puede pedirle la hora al reloj ni una revisión al generador. Se las
 * tienen que dar hechas. Quien las construye es la capa de casos de uso, que es
 * la única con los puertos inyectados.
 *
 * De propina: como el `meta` se construye **una vez** por acción, todas las
 * entidades que esa acción toque reciben exactamente la misma marca de tiempo,
 * en vez de milisegundos ligeramente distintos según el orden de proceso.
 */
export interface ActionMeta {
  /** Milisegundos desde 1970, del puerto `Clock`. */
  readonly now: number
  /** Token nuevo, del puerto `IdGenerator`. */
  readonly revision: Revision
}

/* ─────────────────────────── Las ocho de contenido ────────────────────────────
    Todas llevan `noteId` —el contenido vive dentro de una nota— y todas se
    reducen igual: llamar a su operación y comparar. Ver `reduce.ts`. */

/** «Se marcó (o desmarcó) esta casilla». */
export interface SetChecked {
  readonly type: "set-checked"
  readonly noteId: NoteId
  readonly contentId: ContentId
  readonly checked: boolean
  readonly meta: ActionMeta
}

/** «Se cambió el texto de esta línea», sea texto suelto o casilla. */
export interface SetText {
  readonly type: "set-text"
  readonly noteId: NoteId
  readonly contentId: ContentId
  readonly value: string
  readonly meta: ActionMeta
}

/**
 * «Se metió una línea nueva aquí».
 *
 * El bloque llega **ya construido, con su id**, porque el dominio no genera
 * identificadores: lo hace el caso de uso, que es quien tiene el `IdGenerator`.
 * Y el "aquí" es un `Position`, que tiene tres casos y ni uno más.
 */
export interface Insert {
  readonly type: "insert"
  readonly noteId: NoteId
  readonly block: Content
  readonly position: Position
  readonly meta: ActionMeta
}

/** «Se borró esta línea». No-op si es una casilla con hijas: se borra de abajo arriba. */
export interface Remove {
  readonly type: "remove"
  readonly noteId: NoteId
  readonly contentId: ContentId
  readonly meta: ActionMeta
}

/**
 * «Se partió esta línea por aquí» — Intro en medio de una línea.
 *
 * La **única** de las ocho que necesita un id nuevo: al partir nacen dos líneas,
 * y la segunda necesita el suyo. Llega hecho, como el de `insert`.
 */
export interface Split {
  readonly type: "split"
  readonly noteId: NoteId
  readonly contentId: ContentId
  readonly offset: number
  readonly newId: ContentId
  readonly meta: ActionMeta
}

/** «Se unió esta línea con la de arriba» — Retroceso al principio. */
export interface Merge {
  readonly type: "merge"
  readonly noteId: NoteId
  readonly contentId: ContentId
  readonly meta: ActionMeta
}

/** «Este texto pasa a ser casilla». Conserva su id: es la misma línea con otra pinta. */
export interface ConvertToCheckBox {
  readonly type: "convert-to-checkbox"
  readonly noteId: NoteId
  readonly contentId: ContentId
  readonly meta: ActionMeta
}

/** «Esta casilla pasa a ser texto». También conserva su id. */
export interface ConvertToText {
  readonly type: "convert-to-text"
  readonly noteId: NoteId
  readonly contentId: ContentId
  readonly meta: ActionMeta
}

/** Las que operan sobre el contenido de una nota. Ocho. */
export type ContentAction =
  | SetChecked
  | SetText
  | Insert
  | Remove
  | Split
  | Merge
  | ConvertToCheckBox
  | ConvertToText

/* ──────────────────────────── Las tres de Nota ────────────────────────────── */

/** «Se creó una nota vacía». El id llega hecho, del `IdGenerator`. */
export interface CreateNote {
  readonly type: "create-note"
  readonly noteId: NoteId
  readonly name: string
  readonly meta: ActionMeta
}

export interface RenameNote {
  readonly type: "rename-note"
  readonly noteId: NoteId
  readonly name: string
  readonly meta: ActionMeta
}

/**
 * «Se borró la nota».
 *
 * **La primera acción del proyecto que toca varias entidades a la vez:** hay que
 * quitarla también de todos los contextos que la listaban, o queda una `ItemRef`
 * apuntando a nada; y sus nodos-nota pasan a «Nota perdida» en todos los
 * diagramas.
 */
export interface DeleteNote {
  readonly type: "delete-note"
  readonly noteId: NoteId
  readonly meta: ActionMeta
}

export type NoteAction = CreateNote | RenameNote | DeleteNote

/* ────────────────────────── Las ocho de Contexto ──────────────────────────── */

export interface CreateContext {
  readonly type: "create-context"
  readonly contextId: ContextId
  readonly name: string
  readonly meta: ActionMeta
}

export interface RenameContext {
  readonly type: "rename-context"
  readonly contextId: ContextId
  readonly name: string
  readonly meta: ActionMeta
}

/** Borrar un contexto **no borra lo que contenía**: sólo guardaba referencias. */
export interface DeleteContext {
  readonly type: "delete-context"
  readonly contextId: ContextId
  readonly meta: ActionMeta
}

/** «Se metió una nota o un diagrama en este contexto». No-op si no existe. */
export interface AddItem {
  readonly type: "add-item"
  readonly contextId: ContextId
  readonly item: ItemRef
  readonly meta: ActionMeta
}

export interface RemoveItem {
  readonly type: "remove-item"
  readonly contextId: ContextId
  readonly item: ItemRef
  readonly meta: ActionMeta
}

/** Qué se ve al abrir el contexto: la lista, o directo a una nota o diagrama. */
export interface SetDefaultView {
  readonly type: "set-default-view"
  readonly contextId: ContextId
  readonly view: DefaultView
  readonly meta: ActionMeta
}

/**
 * «Estos dejan de salir en la lista del contexto», sin dejar de ser suyos. Lo
 * que no está en el contexto o ya estaba oculto no cuenta.
 */
export interface HideItems {
  readonly type: "hide-items"
  readonly contextId: ContextId
  readonly items: ReadonlyArray<ItemRef>
  readonly meta: ActionMeta
}

/** «Estos vuelven a la lista», a su sitio de siempre. Lo que no estaba oculto no cuenta. */
export interface ShowItems {
  readonly type: "show-items"
  readonly contextId: ContextId
  readonly items: ReadonlyArray<ItemRef>
  readonly meta: ActionMeta
}

export type ContextAction =
  | CreateContext
  | RenameContext
  | DeleteContext
  | AddItem
  | RemoveItem
  | SetDefaultView
  | HideItems
  | ShowItems

/* ────────────────────────── Las trece de Diagrama ─────────────────────────── */

/** «Se creó un diagrama vacío». El id llega hecho, del `IdGenerator`. */
export interface CreateDiagram {
  readonly type: "create-diagram"
  readonly diagramId: DiagramId
  readonly name: string
  readonly meta: ActionMeta
}

export interface RenameDiagram {
  readonly type: "rename-diagram"
  readonly diagramId: DiagramId
  readonly name: string
  readonly meta: ActionMeta
}

/** «Se borró el diagrama». Como `delete-note`: también sale de los contextos. */
export interface DeleteDiagram {
  readonly type: "delete-diagram"
  readonly diagramId: DiagramId
  readonly meta: ActionMeta
}

/** «Se puso un nodo en el lienzo». Llega construido, con su id, como el bloque de `insert`. */
export interface AddNode {
  readonly type: "add-node"
  readonly diagramId: DiagramId
  readonly node: DiagramNode
  readonly meta: ActionMeta
}

export interface SetNodeText {
  readonly type: "set-node-text"
  readonly diagramId: DiagramId
  readonly nodeId: DiagramNodeId
  readonly text: string
  readonly meta: ActionMeta
}

/** «Se soltó el nodo aquí». Una vez al soltar, no mientras se arrastra. */
export interface SetNodePosition {
  readonly type: "set-node-position"
  readonly diagramId: DiagramId
  readonly nodeId: DiagramNodeId
  readonly positionX: number
  readonly positionY: number
  readonly meta: ActionMeta
}

export interface SetNodeDone {
  readonly type: "set-node-done"
  readonly diagramId: DiagramId
  readonly nodeId: DiagramNodeId
  readonly done: boolean
  readonly meta: ActionMeta
}

/** «Se borró el nodo», y con él sus relaciones. */
export interface RemoveNode {
  readonly type: "remove-node"
  readonly diagramId: DiagramId
  readonly nodeId: DiagramNodeId
  readonly meta: ActionMeta
}

/** «Se unieron dos nodos». Llega construida, con su id. */
export interface AddRelation {
  readonly type: "add-relation"
  readonly diagramId: DiagramId
  readonly relation: DiagramRelation
  readonly meta: ActionMeta
}

/** Lo que hay debajo de «invertir»: los extremos llegan ya decididos. */
export interface SetRelationEnds {
  readonly type: "set-relation-ends"
  readonly diagramId: DiagramId
  readonly relationId: DiagramRelationId
  readonly from: DiagramNodeId
  readonly to: DiagramNodeId
  readonly meta: ActionMeta
}

export interface SetRelationDirected {
  readonly type: "set-relation-directed"
  readonly diagramId: DiagramId
  readonly relationId: DiagramRelationId
  readonly directed: boolean
  readonly meta: ActionMeta
}

export interface SetRelationLabel {
  readonly type: "set-relation-label"
  readonly diagramId: DiagramId
  readonly relationId: DiagramRelationId
  readonly label: string
  readonly meta: ActionMeta
}

export interface RemoveRelation {
  readonly type: "remove-relation"
  readonly diagramId: DiagramId
  readonly relationId: DiagramRelationId
  readonly meta: ActionMeta
}

export type DiagramAction =
  | CreateDiagram
  | RenameDiagram
  | DeleteDiagram
  | AddNode
  | SetNodeText
  | SetNodePosition
  | SetNodeDone
  | RemoveNode
  | AddRelation
  | SetRelationEnds
  | SetRelationDirected
  | SetRelationLabel
  | RemoveRelation

/** El catálogo entero: 8 + 3 + 8 + 13 = **treinta y dos**. */
export type Action = ContentAction | NoteAction | ContextAction | DiagramAction
