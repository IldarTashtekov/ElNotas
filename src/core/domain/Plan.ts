/**
 * Planes: grafos de nodos para esquematizar tareas.
 *
 * Aquí sólo están los TIPOS, porque el editor de grafos está fuera de alcance
 * por ahora. Existen porque AppState y Context los referencian. No hay ninguna
 * operación sobre ellos todavía, y no hay que escribirla hasta que se pida.
 *
 * Cuando llegue el editor habrá que decidir si `nodes` pasa a ser un
 * Record<PlanNodeId, PlanNode>: las aristas se guardan por id, así que con un
 * array toda búsqueda es O(n).
 */

import type { Versioned } from "./Versioned"
import type { NoteId, PlanId, PlanNodeId } from "./Ids"

interface PlanNodeBase {
  readonly id: PlanNodeId
  readonly positionX: number
  readonly positionY: number
  readonly parents: ReadonlyArray<PlanNodeId>
  readonly children: ReadonlyArray<PlanNodeId>
}

/** Nodo con una etiqueta de texto. */
export interface SimpleNode extends PlanNodeBase {
  readonly type: "simple-node"
  readonly text: string
}

/** Nodo que al pincharlo abre una Nota. Es el puente entre planes y notas. */
export interface NoteNode extends PlanNodeBase {
  readonly type: "note-node"
  readonly noteId: NoteId
}

export type PlanNode = SimpleNode | NoteNode

export interface Plan extends Versioned {
  readonly id: PlanId
  readonly name: string
  readonly nodes: ReadonlyArray<PlanNode>
}
