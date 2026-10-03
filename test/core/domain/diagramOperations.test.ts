/**
 * Pruebas de las operaciones de diagrama.
 *
 * Como las de contenido: cada operación se prueba por **valor** (hace lo que dice)
 * y por **identidad** (y no hace nada más). Cada caso en que no aplica tiene aquí
 * su prueba, con `assert.strictEqual` y nunca `deepStrictEqual`.
 */

import { test } from "node:test"
import assert from "node:assert/strict"

import type { Diagram, DiagramNode, DiagramRelation, NoteNode, SimpleNode } from "#core/domain/Diagram"
import type { DiagramNodeId, DiagramRelationId } from "#core/domain/Ids"
import { diagramId, diagramNodeId, diagramRelationId, noteId, revision } from "#core/domain/Ids"
import {
  addNode,
  addRelation,
  LOST_NOTE_TEXT,
  loseNote,
  removeNode,
  removeRelation,
  setNodeDone,
  setNodePosition,
  setNodeText,
  setRelationDirected,
  setRelationEnds,
  setRelationLabel,
} from "#core/domain/diagramOperations"

/* ─────────────────────────── El diagrama de pruebas ───────────────────────────

        Cajas ──R1──▶ [nota Compra] ──R3──▶ Furgoneta
              ◀──R2──
*/

const ID_CAJAS: DiagramNodeId = diagramNodeId("cajas")
const ID_COMPRA: DiagramNodeId = diagramNodeId("compra")
const ID_FURGONETA: DiagramNodeId = diagramNodeId("furgoneta")
const ID_NODO_NUEVO: DiagramNodeId = diagramNodeId("nuevo")
const ID_NODO_INEXISTENTE: DiagramNodeId = diagramNodeId("no-existe")

const R1: DiagramRelationId = diagramRelationId("r1")
const R2: DiagramRelationId = diagramRelationId("r2")
const R3: DiagramRelationId = diagramRelationId("r3")
const R_NUEVA: DiagramRelationId = diagramRelationId("nueva")
const R_INEXISTENTE: DiagramRelationId = diagramRelationId("no-existe")

const NOTA_COMPRA = noteId("nota-compra")

const textoEn = (id: DiagramNodeId, text: string, x: number, y: number): SimpleNode => ({
  type: "simple-node",
  id,
  text,
  positionX: x,
  positionY: y,
  done: false,
})

const relacion = (id: DiagramRelationId, from: DiagramNodeId, to: DiagramNodeId): DiagramRelation => ({
  id,
  from,
  to,
  directed: true,
  label: "",
})

const mudanza = (): Diagram => {
  const compra: NoteNode = {
    type: "note-node",
    id: ID_COMPRA,
    noteId: NOTA_COMPRA,
    positionX: 100,
    positionY: 0,
    done: true,
  }
  return {
    id: diagramId("mudanza"),
    name: "Mudanza",
    nodes: {
      [ID_CAJAS]: textoEn(ID_CAJAS, "Cajas", 0, 0),
      [ID_COMPRA]: compra,
      [ID_FURGONETA]: textoEn(ID_FURGONETA, "Furgoneta", 200, 0),
    },
    relations: {
      [R1]: relacion(R1, ID_CAJAS, ID_COMPRA),
      [R2]: relacion(R2, ID_COMPRA, ID_CAJAS),
      [R3]: relacion(R3, ID_COMPRA, ID_FURGONETA),
    },
    updatedAt: 0,
    revision: revision("rev"),
  }
}

const nodo = (d: Diagram, id: DiagramNodeId): DiagramNode => {
  const n: DiagramNode | undefined = d.nodes[id]
  if (n === undefined) assert.fail(`no está el nodo ${id}`)
  return n
}

const rel = (d: Diagram, id: DiagramRelationId): DiagramRelation => {
  const r: DiagramRelation | undefined = d.relations[id]
  if (r === undefined) assert.fail(`no está la relación ${id}`)
  return r
}

/* ──────────────────────────────── addNode ──────────────────────────────── */

test("addNode añade el nodo y deja lo demás por referencia", (): void => {
  const d: Diagram = mudanza()
  const nuevo: SimpleNode = textoEn(ID_NODO_NUEVO, "Llaves", -10, 5)
  const r: Diagram = addNode(d, nuevo)
  assert.strictEqual(r.nodes[ID_NODO_NUEVO], nuevo)
  assert.strictEqual(r.nodes[ID_CAJAS], d.nodes[ID_CAJAS])
  assert.strictEqual(r.relations, d.relations)
})

test("addNode: con un id que ya existe, devuelve el MISMO diagrama", (): void => {
  const d: Diagram = mudanza()
  assert.strictEqual(addNode(d, textoEn(ID_CAJAS, "Otra", 1, 1)), d)
})

test("addNode: con una posición no finita, devuelve el MISMO diagrama", (): void => {
  const d: Diagram = mudanza()
  assert.strictEqual(addNode(d, textoEn(ID_NODO_NUEVO, "x", Number.NaN, 0)), d)
  assert.strictEqual(addNode(d, textoEn(ID_NODO_NUEVO, "x", 0, Number.POSITIVE_INFINITY)), d)
})

/* ────────────────────────────── setNodeText ────────────────────────────── */

test("setNodeText cambia el texto de un nodo de texto, y sólo eso", (): void => {
  const d: Diagram = mudanza()
  const r: Diagram = setNodeText(d, ID_CAJAS, "Cajas grandes")
  const cajas: DiagramNode = nodo(r, ID_CAJAS)
  assert.equal(cajas.type === "simple-node" && cajas.text, "Cajas grandes")
  assert.strictEqual(r.nodes[ID_FURGONETA], d.nodes[ID_FURGONETA])
  assert.strictEqual(r.relations, d.relations)
})

test("setNodeText: con el mismo texto, devuelve el MISMO diagrama", (): void => {
  const d: Diagram = mudanza()
  assert.strictEqual(setNodeText(d, ID_CAJAS, "Cajas"), d)
})

test("setNodeText: sobre un nodo-nota, devuelve el MISMO diagrama", (): void => {
  const d: Diagram = mudanza()
  assert.strictEqual(setNodeText(d, ID_COMPRA, "Otro título"), d)
})

test("setNodeText: con un nodo que no existe, devuelve el MISMO diagrama", (): void => {
  const d: Diagram = mudanza()
  assert.strictEqual(setNodeText(d, ID_NODO_INEXISTENTE, "x"), d)
})

/* ──────────────────────────── setNodePosition ──────────────────────────── */

test("setNodePosition mueve el nodo, también un nodo-nota", (): void => {
  const d: Diagram = mudanza()
  const r: Diagram = setNodePosition(d, ID_COMPRA, -3.5, 40)
  assert.equal(nodo(r, ID_COMPRA).positionX, -3.5)
  assert.equal(nodo(r, ID_COMPRA).positionY, 40)
  assert.strictEqual(r.relations, d.relations)
})

test("setNodePosition: moverlo sólo en una coordenada también cuenta", (): void => {
  const d: Diagram = mudanza()
  assert.notStrictEqual(setNodePosition(d, ID_CAJAS, 0, 1), d)
  assert.notStrictEqual(setNodePosition(d, ID_CAJAS, 1, 0), d)
})

test("setNodePosition: a donde ya está, devuelve el MISMO diagrama", (): void => {
  const d: Diagram = mudanza()
  assert.strictEqual(setNodePosition(d, ID_CAJAS, 0, 0), d)
})

test("setNodePosition: con una posición no finita, devuelve el MISMO diagrama", (): void => {
  const d: Diagram = mudanza()
  assert.strictEqual(setNodePosition(d, ID_CAJAS, Number.NaN, 0), d)
  assert.strictEqual(setNodePosition(d, ID_CAJAS, 0, Number.NEGATIVE_INFINITY), d)
})

test("setNodePosition: con un nodo que no existe, devuelve el MISMO diagrama", (): void => {
  const d: Diagram = mudanza()
  assert.strictEqual(setNodePosition(d, ID_NODO_INEXISTENTE, 1, 1), d)
})

/* ────────────────────────────── setNodeDone ────────────────────────────── */

test("setNodeDone marca un nodo de texto y desmarca un nodo-nota", (): void => {
  const d: Diagram = mudanza()
  assert.equal(nodo(setNodeDone(d, ID_CAJAS, true), ID_CAJAS).done, true)
  assert.equal(nodo(setNodeDone(d, ID_COMPRA, false), ID_COMPRA).done, false)
})

test("setNodeDone: con el mismo valor, devuelve el MISMO diagrama", (): void => {
  const d: Diagram = mudanza()
  assert.strictEqual(setNodeDone(d, ID_CAJAS, false), d)
  assert.strictEqual(setNodeDone(d, ID_COMPRA, true), d)
})

test("setNodeDone: con un nodo que no existe, devuelve el MISMO diagrama", (): void => {
  const d: Diagram = mudanza()
  assert.strictEqual(setNodeDone(d, ID_NODO_INEXISTENTE, true), d)
})

/* ────────────────────────────── removeNode ─────────────────────────────── */

test("removeNode borra el nodo y TODAS las relaciones que lo tocan, en los dos sentidos", (): void => {
  const d: Diagram = mudanza()
  const r: Diagram = removeNode(d, ID_COMPRA)
  assert.equal(r.nodes[ID_COMPRA], undefined)
  assert.deepEqual(Object.keys(r.relations), [])
  assert.strictEqual(r.nodes[ID_CAJAS], d.nodes[ID_CAJAS])
})

test("removeNode conserva por referencia las relaciones que no lo tocan", (): void => {
  const d: Diagram = mudanza()
  const r: Diagram = removeNode(d, ID_FURGONETA)
  assert.deepEqual(Object.keys(r.relations).sort(), [R1, R2])
  assert.strictEqual(r.relations[R1], d.relations[R1])
})

test("removeNode: si no lo tocaba ninguna relación, el MISMO objeto relations", (): void => {
  const d: Diagram = addNode(mudanza(), textoEn(ID_NODO_NUEVO, "Suelto", 0, 0))
  const r: Diagram = removeNode(d, ID_NODO_NUEVO)
  assert.strictEqual(r.relations, d.relations)
  assert.equal(r.nodes[ID_NODO_NUEVO], undefined)
})

test("removeNode: con un nodo que no existe, devuelve el MISMO diagrama", (): void => {
  const d: Diagram = mudanza()
  assert.strictEqual(removeNode(d, ID_NODO_INEXISTENTE), d)
})

/* ──────────────────────────────── loseNote ─────────────────────────────── */

test("loseNote convierte el nodo-nota en «Nota perdida» y conserva id, posición y hecho", (): void => {
  const d: Diagram = mudanza()
  const r: Diagram = loseNote(d, NOTA_COMPRA)
  assert.deepEqual(nodo(r, ID_COMPRA), {
    type: "simple-node",
    id: ID_COMPRA,
    positionX: 100,
    positionY: 0,
    done: true,
    text: LOST_NOTE_TEXT,
  })
  assert.equal(LOST_NOTE_TEXT, "Nota perdida")
  // Las relaciones siguen: el nodo es el mismo, con otra pinta.
  assert.strictEqual(r.relations, d.relations)
  assert.strictEqual(r.nodes[ID_CAJAS], d.nodes[ID_CAJAS])
})

test("loseNote convierte TODOS los nodos de esa nota, no sólo el primero", (): void => {
  const otro: NoteNode = {
    type: "note-node",
    id: ID_NODO_NUEVO,
    noteId: NOTA_COMPRA,
    positionX: 0,
    positionY: 0,
    done: false,
  }
  const r: Diagram = loseNote(addNode(mudanza(), otro), NOTA_COMPRA)
  assert.equal(nodo(r, ID_COMPRA).type, "simple-node")
  assert.equal(nodo(r, ID_NODO_NUEVO).type, "simple-node")
})

test("loseNote: si ningún nodo apunta a esa nota, devuelve el MISMO diagrama", (): void => {
  const d: Diagram = mudanza()
  assert.strictEqual(loseNote(d, noteId("otra")), d)
})

/* ────────────────────────────── addRelation ────────────────────────────── */

test("addRelation añade la relación y deja los nodos por referencia", (): void => {
  const d: Diagram = mudanza()
  const nueva: DiagramRelation = relacion(R_NUEVA, ID_CAJAS, ID_FURGONETA)
  const r: Diagram = addRelation(d, nueva)
  assert.strictEqual(r.relations[R_NUEVA], nueva)
  assert.strictEqual(r.nodes, d.nodes)
})

test("addRelation admite una REPETIDA: dos Cajas → Compra conviven", (): void => {
  const d: Diagram = mudanza()
  const r: Diagram = addRelation(d, relacion(R_NUEVA, ID_CAJAS, ID_COMPRA))
  assert.equal(Object.keys(r.relations).length, 4)
})

test("addRelation: con un id que ya existe, devuelve el MISMO diagrama", (): void => {
  const d: Diagram = mudanza()
  assert.strictEqual(addRelation(d, relacion(R1, ID_CAJAS, ID_FURGONETA)), d)
})

test("addRelation: con un extremo que no existe, devuelve el MISMO diagrama", (): void => {
  const d: Diagram = mudanza()
  assert.strictEqual(addRelation(d, relacion(R_NUEVA, ID_NODO_INEXISTENTE, ID_CAJAS)), d)
  assert.strictEqual(addRelation(d, relacion(R_NUEVA, ID_CAJAS, ID_NODO_INEXISTENTE)), d)
})

test("addRelation: de un nodo a sí mismo, devuelve el MISMO diagrama", (): void => {
  const d: Diagram = mudanza()
  assert.strictEqual(addRelation(d, relacion(R_NUEVA, ID_CAJAS, ID_CAJAS)), d)
})

/* ──────────────────────────── setRelationEnds ──────────────────────────── */

test("setRelationEnds invierte una relación y conserva lo demás de ella", (): void => {
  const d: Diagram = setRelationLabel(mudanza(), R3, "luego")
  const r: Diagram = setRelationEnds(d, R3, ID_FURGONETA, ID_COMPRA)
  assert.deepEqual(rel(r, R3), { ...rel(d, R3), from: ID_FURGONETA, to: ID_COMPRA })
  assert.strictEqual(r.relations[R1], d.relations[R1])
  assert.strictEqual(r.nodes, d.nodes)
})

test("setRelationEnds: invertir dejando dos iguales está permitido, conviven", (): void => {
  const d: Diagram = mudanza()
  const r: Diagram = setRelationEnds(d, R2, ID_CAJAS, ID_COMPRA) // R2 pasa a ser como R1
  assert.equal(rel(r, R2).from, rel(r, R1).from)
  assert.equal(rel(r, R2).to, rel(r, R1).to)
})

test("setRelationEnds: con los mismos extremos, devuelve el MISMO diagrama", (): void => {
  const d: Diagram = mudanza()
  assert.strictEqual(setRelationEnds(d, R1, ID_CAJAS, ID_COMPRA), d)
})

test("setRelationEnds: con un extremo que no existe, devuelve el MISMO diagrama", (): void => {
  const d: Diagram = mudanza()
  assert.strictEqual(setRelationEnds(d, R1, ID_NODO_INEXISTENTE, ID_COMPRA), d)
  assert.strictEqual(setRelationEnds(d, R1, ID_CAJAS, ID_NODO_INEXISTENTE), d)
})

test("setRelationEnds: de un nodo a sí mismo, devuelve el MISMO diagrama", (): void => {
  const d: Diagram = mudanza()
  assert.strictEqual(setRelationEnds(d, R1, ID_CAJAS, ID_CAJAS), d)
})

test("setRelationEnds: con una relación que no existe, devuelve el MISMO diagrama", (): void => {
  const d: Diagram = mudanza()
  assert.strictEqual(setRelationEnds(d, R_INEXISTENTE, ID_CAJAS, ID_FURGONETA), d)
})

/* ────────────────────────── setRelationDirected ────────────────────────── */

test("setRelationDirected quita la flecha y CONSERVA from y to; ponerla la devuelve igual", (): void => {
  const d: Diagram = mudanza()
  const sin: Diagram = setRelationDirected(d, R1, false)
  assert.deepEqual(rel(sin, R1), { ...rel(d, R1), directed: false })
  assert.deepEqual(rel(setRelationDirected(sin, R1, true), R1), rel(d, R1))
  assert.strictEqual(sin.nodes, d.nodes)
})

test("setRelationDirected: con el mismo valor, devuelve el MISMO diagrama", (): void => {
  const d: Diagram = mudanza()
  assert.strictEqual(setRelationDirected(d, R1, true), d)
})

test("setRelationDirected: con una relación que no existe, devuelve el MISMO diagrama", (): void => {
  const d: Diagram = mudanza()
  assert.strictEqual(setRelationDirected(d, R_INEXISTENTE, false), d)
})

/* ──────────────────────────── setRelationLabel ─────────────────────────── */

test("setRelationLabel pone el texto, y con vacío lo quita", (): void => {
  const d: Diagram = mudanza()
  const con: Diagram = setRelationLabel(d, R1, "antes de")
  assert.equal(rel(con, R1).label, "antes de")
  assert.equal(rel(setRelationLabel(con, R1, ""), R1).label, "")
  assert.strictEqual(con.relations[R2], d.relations[R2])
})

test("setRelationLabel: con el mismo texto, devuelve el MISMO diagrama", (): void => {
  const d: Diagram = mudanza()
  assert.strictEqual(setRelationLabel(d, R1, ""), d)
})

test("setRelationLabel: con una relación que no existe, devuelve el MISMO diagrama", (): void => {
  const d: Diagram = mudanza()
  assert.strictEqual(setRelationLabel(d, R_INEXISTENTE, "x"), d)
})

/* ───────────────────────────── removeRelation ──────────────────────────── */

test("removeRelation borra la relación y no toca los nodos", (): void => {
  const d: Diagram = mudanza()
  const r: Diagram = removeRelation(d, R2)
  assert.equal(r.relations[R2], undefined)
  assert.strictEqual(r.relations[R1], d.relations[R1])
  assert.strictEqual(r.nodes, d.nodes)
})

test("removeRelation: con una relación que no existe, devuelve el MISMO diagrama", (): void => {
  const d: Diagram = mudanza()
  assert.strictEqual(removeRelation(d, R_INEXISTENTE), d)
})
