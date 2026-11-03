/**
 * Diagramas: un lienzo libre con nodos que se colocan a mano y relaciones entre
 * ellos.
 *
 * Un nodo es una caja con texto, con el mismo Markdown que una línea de nota: lo
 * que lleve a una nota, a otra cosa de la app o a una web es un enlace dentro de
 * ese texto. Una relación une dos nodos, con flecha o sin ella, y puede llevar un
 * texto. Entre dos nodos puede haber tantas relaciones como se quiera.
 */

import type { Versioned } from "./Versioned.js"
import type { DiagramId, DiagramNodeId, DiagramRelationId } from "./Ids.js"

/** Un nodo del lienzo. Sus enlaces no los lee el core, como los de una nota. */
export interface DiagramNode {
  readonly id: DiagramNodeId
  readonly positionX: number
  readonly positionY: number
  readonly done: boolean
  /** Markdown, de una línea o de varias. */
  readonly text: string
}

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
