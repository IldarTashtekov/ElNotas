/**
 * Diagramas: grafos de nodos para esquematizar tareas.
 *
 * Aquí sólo están los TIPOS, porque el editor de grafos está fuera de alcance
 * por ahora. Existen porque AppState y Context los referencian. No hay ninguna
 * operación sobre ellos todavía, y no hay que escribirla hasta que se pida.
 *
 * Cuando llegue el editor habrá que decidir si `nodes` pasa a ser un
 * Record<DiagramNodeId, DiagramNode>: las aristas se guardan por id, así que
 * con un array toda búsqueda es O(n).
 */

import type { Versioned } from "./Versioned.js"
import type { DiagramId, DiagramNodeId, NoteId } from "./Ids.js"

interface DiagramNodeBase {
  readonly id: DiagramNodeId
  readonly positionX: number
  readonly positionY: number
  readonly parents: ReadonlyArray<DiagramNodeId>
  readonly children: ReadonlyArray<DiagramNodeId>
}

/** Nodo con una etiqueta de texto. */
export interface SimpleNode extends DiagramNodeBase {
  readonly type: "simple-node"
  readonly text: string
}

/** Nodo que al pincharlo abre una Nota. Es el puente entre diagramas y notas. */
export interface NoteNode extends DiagramNodeBase {
  readonly type: "note-node"
  readonly noteId: NoteId
}

export type DiagramNode = SimpleNode | NoteNode

export interface Diagram extends Versioned {
  readonly id: DiagramId
  readonly name: string
  readonly nodes: ReadonlyArray<DiagramNode>
}
