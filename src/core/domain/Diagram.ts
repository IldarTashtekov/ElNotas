/**
 * Diagramas: un lienzo libre con nodos que se colocan a mano y relaciones entre
 * ellos.
 *
 * Un nodo es una caja con texto o una que lleva a una nota; una relación une dos
 * nodos, con flecha o sin ella, y puede llevar un texto. Entre dos nodos puede
 * haber tantas relaciones como se quiera.
 */

import type { Versioned } from "./Versioned.js"
import type { DiagramId, DiagramNodeId, DiagramRelationId, NoteId } from "./Ids.js"

interface DiagramNodeBase {
  readonly id: DiagramNodeId
  readonly positionX: number
  readonly positionY: number
  readonly done: boolean
}

/** Nodo con una etiqueta de texto. */
export interface SimpleNode extends DiagramNodeBase {
  readonly type: "simple-node"
  readonly text: string
}

/** Nodo que al pincharlo abre una Nota. Enseña el título de la nota, no guarda copia. */
export interface NoteNode extends DiagramNodeBase {
  readonly type: "note-node"
  readonly noteId: NoteId
}

export type DiagramNode = SimpleNode | NoteNode

/**
 * Una relación de `from` a `to`. Sin flecha (`directed: false`) conserva los dos
 * extremos, para que la flecha vuelva como estaba. `label` vacío es sin texto.
 */
export interface DiagramRelation {
  readonly id: DiagramRelationId
  readonly from: DiagramNodeId
  readonly to: DiagramNodeId
  readonly directed: boolean
  readonly label: string
}

export interface Diagram extends Versioned {
  readonly id: DiagramId
  readonly name: string
  readonly nodes: Readonly<Record<DiagramNodeId, DiagramNode>>
  readonly relations: Readonly<Record<DiagramRelationId, DiagramRelation>>
}
