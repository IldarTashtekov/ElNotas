/**
 * Las operaciones sobre los nodos y las relaciones de un diagrama.
 *
 * Siguen la misma disciplina que las de contenido: una operación que no aplica
 * NO HACE NADA, y eso significa devolver el diagrama de ENTRADA, no una copia
 * equivalente. Cada caso en que no aplica tiene su prueba.
 *
 * Todas son puras. No estampan `updatedAt` ni `revision`: eso lo hace el reducer,
 * sólo si algo cambió. Lo que mira fuera del diagrama —que una nota exista— también.
 */

import type { Diagram, DiagramNode, DiagramRelation, SimpleNode } from "./Diagram.js"
import type { DiagramNodeId, DiagramRelationId, NoteId } from "./Ids.js"

/** El texto que queda en un nodo-nota cuando su nota ya no está. */
export const LOST_NOTE_TEXT: string = "Nota perdida"

const posicionValida = (x: number, y: number): boolean =>
  Number.isFinite(x) && Number.isFinite(y)

/**
 * Transforma un nodo y devuelve el diagrama con él. Si el nodo no existe, o `f`
 * lo devuelve tal cual, el diagrama de entrada: la comparación, escrita una vez.
 */
const enNodo = (
  diagram: Diagram,
  id: DiagramNodeId,
  f: (node: DiagramNode) => DiagramNode,
): Diagram => {
  const node: DiagramNode | undefined = diagram.nodes[id]
  if (node === undefined) return diagram
  const siguiente: DiagramNode = f(node)
  if (siguiente === node) return diagram
  return { ...diagram, nodes: { ...diagram.nodes, [id]: siguiente } }
}

/** Lo mismo que `enNodo`, para una relación. */
const enRelacion = (
  diagram: Diagram,
  id: DiagramRelationId,
  f: (relation: DiagramRelation) => DiagramRelation,
): Diagram => {
  const relation: DiagramRelation | undefined = diagram.relations[id]
  if (relation === undefined) return diagram
  const siguiente: DiagramRelation = f(relation)
  if (siguiente === relation) return diagram
  return { ...diagram, relations: { ...diagram.relations, [id]: siguiente } }
}

/* ──────────────────────────────── Nodos ──────────────────────────────── */

/**
 * Añade un nodo, que llega construido y con su id.
 *
 * **No hace nada si:** el id ya existe · la posición no es un número finito.
 */
export const addNode = (diagram: Diagram, node: DiagramNode): Diagram => {
  if (diagram.nodes[node.id] !== undefined) return diagram
  if (!posicionValida(node.positionX, node.positionY)) return diagram
  return { ...diagram, nodes: { ...diagram.nodes, [node.id]: node } }
}

/**
 * Cambia el texto de un nodo de texto.
 *
 * **No hace nada si:** el nodo no existe · es un nodo-nota, que enseña el título
 * de su nota · el texto ya es ese.
 */
export const setNodeText = (diagram: Diagram, id: DiagramNodeId, text: string): Diagram =>
  enNodo(diagram, id, (node: DiagramNode): DiagramNode =>
    node.type !== "simple-node" || node.text === text ? node : { ...node, text },
  )

/**
 * Lleva un nodo a otra posición.
 *
 * **No hace nada si:** el nodo no existe · ya está ahí · la posición no es un
 * número finito.
 */
export const setNodePosition = (
  diagram: Diagram,
  id: DiagramNodeId,
  positionX: number,
  positionY: number,
): Diagram => {
  if (!posicionValida(positionX, positionY)) return diagram
  return enNodo(diagram, id, (node: DiagramNode): DiagramNode =>
    node.positionX === positionX && node.positionY === positionY
      ? node
      : { ...node, positionX, positionY },
  )
}

/**
 * Desplaza varios nodos a la vez lo mismo, `dx` y `dy`: lo que hay debajo de
 * arrastrar un grupo. Un id repetido cuenta una vez; uno que no existe, nada.
 *
 * **No hace nada si:** el desplazamiento es cero o no es un número finito ·
 * ningún nodo existe.
 */
export const shiftNodes = (
  diagram: Diagram,
  ids: ReadonlyArray<DiagramNodeId>,
  dx: number,
  dy: number,
): Diagram => {
  if (!posicionValida(dx, dy) || (dx === 0 && dy === 0)) return diagram
  return [...new Set<DiagramNodeId>(ids)].reduce(
    (d: Diagram, id: DiagramNodeId): Diagram =>
      enNodo(d, id, (node: DiagramNode): DiagramNode => {
        const positionX: number = node.positionX + dx
        const positionY: number = node.positionY + dy
        return posicionValida(positionX, positionY) ? { ...node, positionX, positionY } : node
      }),
    diagram,
  )
}

/**
 * Marca o desmarca un nodo como hecho. `set` y no `toggle`, como `setChecked`.
 *
 * **No hace nada si:** el nodo no existe · ya está en ese valor.
 */
export const setNodeDone = (diagram: Diagram, id: DiagramNodeId, done: boolean): Diagram =>
  enNodo(diagram, id, (node: DiagramNode): DiagramNode =>
    node.done === done ? node : { ...node, done },
  )

/**
 * Borra un nodo y, en la misma operación, todas las relaciones que lo tocan: una
 * relación con un extremo en el aire no se deja.
 *
 * **No hace nada si:** el nodo no existe.
 */
export const removeNode = (diagram: Diagram, id: DiagramNodeId): Diagram => {
  if (diagram.nodes[id] === undefined) return diagram
  const { [id]: _fuera, ...nodes } = diagram.nodes

  const quedan: ReadonlyArray<DiagramRelation> = Object.values<DiagramRelation>(
    diagram.relations,
  ).filter((r: DiagramRelation): boolean => r.from !== id && r.to !== id)
  // Si no tocaba ninguna, el mismo objeto `relations`: no se copia por copiar.
  const relations: Diagram["relations"] =
    quedan.length === Object.keys(diagram.relations).length
      ? diagram.relations
      : Object.fromEntries(
          quedan.map((r: DiagramRelation): readonly [DiagramRelationId, DiagramRelation] => [
            r.id,
            r,
          ]),
        )

  return { ...diagram, nodes, relations }
}

/**
 * Convierte en nodos de texto «Nota perdida» los nodos-nota de una nota que ya no
 * está. Conservan id, posición, hecho y relaciones.
 *
 * **No hace nada si:** ningún nodo apunta a esa nota.
 */
export const loseNote = (diagram: Diagram, noteId: NoteId): Diagram => {
  const perdidos: ReadonlyArray<DiagramNode> = Object.values<DiagramNode>(diagram.nodes).filter(
    (n: DiagramNode): boolean => n.type === "note-node" && n.noteId === noteId,
  )
  if (perdidos.length === 0) return diagram

  const textos: ReadonlyArray<SimpleNode> = perdidos.map(
    (n: DiagramNode): SimpleNode => ({
      type: "simple-node",
      id: n.id,
      positionX: n.positionX,
      positionY: n.positionY,
      done: n.done,
      text: LOST_NOTE_TEXT,
    }),
  )
  return {
    ...diagram,
    nodes: {
      ...diagram.nodes,
      ...Object.fromEntries(
        textos.map((n: SimpleNode): readonly [DiagramNodeId, SimpleNode] => [n.id, n]),
      ),
    },
  }
}

/* ────────────────────────────── Relaciones ────────────────────────────── */

/** ¿Pueden ser `from` y `to` los extremos de una relación de este diagrama? */
const extremosValidos = (diagram: Diagram, from: DiagramNodeId, to: DiagramNodeId): boolean =>
  from !== to && diagram.nodes[from] !== undefined && diagram.nodes[to] !== undefined

/**
 * Añade una relación, que llega construida y con su id. Entre dos nodos puede
 * haber tantas como se quiera, repetidas incluidas.
 *
 * **No hace nada si:** el id ya existe · algún extremo no existe · va de un nodo
 * a sí mismo.
 */
export const addRelation = (diagram: Diagram, relation: DiagramRelation): Diagram => {
  if (diagram.relations[relation.id] !== undefined) return diagram
  if (!extremosValidos(diagram, relation.from, relation.to)) return diagram
  return { ...diagram, relations: { ...diagram.relations, [relation.id]: relation } }
}

/**
 * Cambia los extremos de una relación. Es lo que hay debajo de «invertir»: los
 * extremos llegan ya decididos, como `setChecked` debajo de marcar.
 *
 * **No hace nada si:** la relación no existe · ya tiene esos extremos · algún
 * extremo no existe · iría de un nodo a sí mismo.
 */
export const setRelationEnds = (
  diagram: Diagram,
  id: DiagramRelationId,
  from: DiagramNodeId,
  to: DiagramNodeId,
): Diagram => {
  if (!extremosValidos(diagram, from, to)) return diagram
  return enRelacion(diagram, id, (r: DiagramRelation): DiagramRelation =>
    r.from === from && r.to === to ? r : { ...r, from, to },
  )
}

/**
 * Pone o quita la flecha. Sin flecha, la relación conserva `from` y `to`.
 *
 * **No hace nada si:** la relación no existe · ya está en ese valor.
 */
export const setRelationDirected = (
  diagram: Diagram,
  id: DiagramRelationId,
  directed: boolean,
): Diagram =>
  enRelacion(diagram, id, (r: DiagramRelation): DiagramRelation =>
    r.directed === directed ? r : { ...r, directed },
  )

/**
 * Cambia el texto de una relación; vacío es sin texto.
 *
 * **No hace nada si:** la relación no existe · el texto ya es ese.
 */
export const setRelationLabel = (
  diagram: Diagram,
  id: DiagramRelationId,
  label: string,
): Diagram =>
  enRelacion(diagram, id, (r: DiagramRelation): DiagramRelation =>
    r.label === label ? r : { ...r, label },
  )

/**
 * Borra una relación. Los nodos no se tocan.
 *
 * **No hace nada si:** la relación no existe.
 */
export const removeRelation = (diagram: Diagram, id: DiagramRelationId): Diagram => {
  if (diagram.relations[id] === undefined) return diagram
  const { [id]: _fuera, ...relations } = diagram.relations
  return { ...diagram, relations }
}
