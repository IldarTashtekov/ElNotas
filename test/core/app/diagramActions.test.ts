/**
 * Las catorce acciones de Diagrama, a través del reducer.
 *
 * Las operaciones de dentro de un diagrama ya tienen sus pruebas en
 * `diagramOperations.test.ts`; aquí se prueba lo que añade el reducer: que cada
 * acción llega a su operación, que se estampa `meta` **sólo** si algo cambió, que
 * sobre un diagrama que no existe nada pasa, y las tres que tienen lógica propia
 * —crear, borrar (que limpia los contextos) y añadir un nodo-nota, que mira si la
 * nota existe—. Al final, lo que `delete-note` hace a los diagramas.
 */

import { test } from "node:test"
import assert from "node:assert/strict"

import type { ActionMeta, DiagramAction } from "#core/app/Action"
import { reduce } from "#core/app/reduce"
import type { AppState } from "#core/domain/AppState"
import type { Context } from "#core/domain/Context"
import type { Diagram, DiagramNode, NoteNode, SimpleNode } from "#core/domain/Diagram"
import type { ContextId, DiagramId, DiagramNodeId, DiagramRelationId, NoteId } from "#core/domain/Ids"
import {
  contextId,
  diagramId,
  diagramNodeId,
  diagramRef,
  diagramRelationId,
  noteId,
  noteRef,
  revision,
} from "#core/domain/Ids"
import type { Note } from "#core/domain/Note"

/* ────────────────────────────── El escenario ────────────────────────────── */

const ID_MUDANZA: DiagramId = diagramId("mudanza")
const ID_VIAJE: DiagramId = diagramId("viaje")
const ID_FANTASMA: DiagramId = diagramId("fantasma")
const ID_CAJAS: DiagramNodeId = diagramNodeId("cajas")
const ID_LLAVES: DiagramNodeId = diagramNodeId("llaves")
const ID_NODO_NUEVO: DiagramNodeId = diagramNodeId("nuevo")
const ID_R1: DiagramRelationId = diagramRelationId("r1")
const ID_COMPRA: NoteId = noteId("compra")
const ID_CASA: ContextId = contextId("casa")
const ID_TRABAJO: ContextId = contextId("trabajo")
const ID_VACIO: ContextId = contextId("vacio")

const HORA_INICIAL: number = 0
const META: ActionMeta = { now: 1000, revision: revision("rev-nueva") }

const texto = (id: DiagramNodeId, text: string): SimpleNode => ({
  type: "simple-node",
  id,
  text,
  positionX: 0,
  positionY: 0,
  done: false,
})

const diagrama = (id: DiagramId, name: string, nodes: Diagram["nodes"], relations: Diagram["relations"]): Diagram => ({
  id,
  name,
  nodes,
  relations,
  updatedAt: HORA_INICIAL,
  revision: revision(`rev-${id}`),
})

const contexto = (id: ContextId, items: Context["items"]): Context => ({
  id,
  name: id,
  defaultView: { type: "context" },
  items,
  updatedAt: HORA_INICIAL,
  revision: revision(`rev-${id}`),
})

const COMPRA: Note = {
  id: ID_COMPRA,
  name: "Compra",
  content: [],
  updatedAt: HORA_INICIAL,
  revision: revision("rev-compra"),
}

/**
 *   notas:     compra
 *   diagramas: mudanza → Cajas ──r1──▶ Llaves      viaje → (vacío)
 *   contextos: casa    → [mudanza, compra]
 *              trabajo → [mudanza]
 *              vacio   → []
 */
const estado = (): AppState => ({
  notes: { [ID_COMPRA]: COMPRA },
  diagrams: {
    [ID_MUDANZA]: diagrama(
      ID_MUDANZA,
      "Mudanza",
      { [ID_CAJAS]: texto(ID_CAJAS, "Cajas"), [ID_LLAVES]: texto(ID_LLAVES, "Llaves") },
      { [ID_R1]: { id: ID_R1, from: ID_CAJAS, to: ID_LLAVES, directed: true, label: "" } },
    ),
    [ID_VIAJE]: diagrama(ID_VIAJE, "Viaje", {}, {}),
  },
  contexts: {
    [ID_CASA]: contexto(ID_CASA, [diagramRef(ID_MUDANZA), noteRef(ID_COMPRA)]),
    [ID_TRABAJO]: contexto(ID_TRABAJO, [diagramRef(ID_MUDANZA)]),
    [ID_VACIO]: contexto(ID_VACIO, []),
  },
  events: {},
  eventGroups: {},
  routines: {},
})

const mudanzaDe = (s: AppState): Diagram => {
  const d: Diagram | undefined = s.diagrams[ID_MUDANZA]
  if (d === undefined) assert.fail("no está Mudanza")
  return d
}

/* ─────────────────── El cableado: las diez de dentro ─────────────────────
    Para cada acción, una que CAMBIA algo y otra que NO aplica. La que cambia
    tiene que estampar y dejar el otro diagrama por referencia; la que no aplica,
    devolver el MISMO estado. */

interface Caso {
  readonly nombre: string
  readonly cambia: DiagramAction
  readonly noAplica: DiagramAction
  readonly comprobar: (d: Diagram) => boolean
}

const d: DiagramId = ID_MUDANZA
const CASOS: ReadonlyArray<Caso> = [
  {
    nombre: "add-node",
    cambia: { type: "add-node", diagramId: d, node: texto(ID_NODO_NUEVO, "Cinta"), meta: META },
    noAplica: { type: "add-node", diagramId: d, node: texto(ID_CAJAS, "Repetido"), meta: META },
    comprobar: (x: Diagram): boolean => x.nodes[ID_NODO_NUEVO] !== undefined,
  },
  {
    nombre: "set-node-text",
    cambia: { type: "set-node-text", diagramId: d, nodeId: ID_CAJAS, text: "Cajas grandes", meta: META },
    noAplica: { type: "set-node-text", diagramId: d, nodeId: ID_CAJAS, text: "Cajas", meta: META },
    comprobar: (x: Diagram): boolean => {
      const n: DiagramNode | undefined = x.nodes[ID_CAJAS]
      return n?.type === "simple-node" && n.text === "Cajas grandes"
    },
  },
  {
    nombre: "set-node-position",
    cambia: { type: "set-node-position", diagramId: d, nodeId: ID_CAJAS, positionX: 5, positionY: 6, meta: META },
    noAplica: { type: "set-node-position", diagramId: d, nodeId: ID_CAJAS, positionX: 0, positionY: 0, meta: META },
    comprobar: (x: Diagram): boolean => x.nodes[ID_CAJAS]?.positionX === 5 && x.nodes[ID_CAJAS]?.positionY === 6,
  },
  {
    nombre: "shift-nodes",
    cambia: { type: "shift-nodes", diagramId: d, nodeIds: [ID_CAJAS], dx: 5, dy: 6, meta: META },
    noAplica: { type: "shift-nodes", diagramId: d, nodeIds: [ID_CAJAS], dx: 0, dy: 0, meta: META },
    comprobar: (x: Diagram): boolean => x.nodes[ID_CAJAS]?.positionX === 5 && x.nodes[ID_CAJAS]?.positionY === 6,
  },
  {
    nombre: "set-node-done",
    cambia: { type: "set-node-done", diagramId: d, nodeId: ID_CAJAS, done: true, meta: META },
    noAplica: { type: "set-node-done", diagramId: d, nodeId: ID_CAJAS, done: false, meta: META },
    comprobar: (x: Diagram): boolean => x.nodes[ID_CAJAS]?.done === true,
  },
  {
    nombre: "remove-node",
    cambia: { type: "remove-node", diagramId: d, nodeId: ID_CAJAS, meta: META },
    noAplica: { type: "remove-node", diagramId: d, nodeId: ID_NODO_NUEVO, meta: META },
    comprobar: (x: Diagram): boolean => x.nodes[ID_CAJAS] === undefined && x.relations[ID_R1] === undefined,
  },
  {
    nombre: "add-relation",
    cambia: {
      type: "add-relation",
      diagramId: d,
      relation: { id: diagramRelationId("r2"), from: ID_LLAVES, to: ID_CAJAS, directed: true, label: "" },
      meta: META,
    },
    noAplica: {
      type: "add-relation",
      diagramId: d,
      relation: { id: diagramRelationId("r2"), from: ID_CAJAS, to: ID_CAJAS, directed: true, label: "" },
      meta: META,
    },
    comprobar: (x: Diagram): boolean => x.relations[diagramRelationId("r2")] !== undefined,
  },
  {
    nombre: "set-relation-ends",
    cambia: { type: "set-relation-ends", diagramId: d, relationId: ID_R1, from: ID_LLAVES, to: ID_CAJAS, meta: META },
    noAplica: { type: "set-relation-ends", diagramId: d, relationId: ID_R1, from: ID_CAJAS, to: ID_LLAVES, meta: META },
    comprobar: (x: Diagram): boolean => x.relations[ID_R1]?.from === ID_LLAVES,
  },
  {
    nombre: "set-relation-directed",
    cambia: { type: "set-relation-directed", diagramId: d, relationId: ID_R1, directed: false, meta: META },
    noAplica: { type: "set-relation-directed", diagramId: d, relationId: ID_R1, directed: true, meta: META },
    comprobar: (x: Diagram): boolean => x.relations[ID_R1]?.directed === false,
  },
  {
    nombre: "set-relation-label",
    cambia: { type: "set-relation-label", diagramId: d, relationId: ID_R1, label: "antes", meta: META },
    noAplica: { type: "set-relation-label", diagramId: d, relationId: ID_R1, label: "", meta: META },
    comprobar: (x: Diagram): boolean => x.relations[ID_R1]?.label === "antes",
  },
  {
    nombre: "remove-relation",
    cambia: { type: "remove-relation", diagramId: d, relationId: ID_R1, meta: META },
    noAplica: { type: "remove-relation", diagramId: d, relationId: diagramRelationId("no-existe"), meta: META },
    comprobar: (x: Diagram): boolean => x.relations[ID_R1] === undefined,
  },
]

for (const caso of CASOS) {
  test(`${caso.nombre} llega a su operación, estampa, y deja lo demás por referencia`, (): void => {
    const s: AppState = estado()
    const r: AppState = reduce(s, caso.cambia)
    const m: Diagram = mudanzaDe(r)
    assert.equal(caso.comprobar(m), true)
    assert.equal(m.updatedAt, META.now)
    assert.strictEqual(m.revision, META.revision)
    assert.strictEqual(r.diagrams[ID_VIAJE], s.diagrams[ID_VIAJE])
    assert.strictEqual(r.notes, s.notes)
    assert.strictEqual(r.contexts, s.contexts)
  })

  test(`${caso.nombre} que no aplica devuelve el MISMO estado, sin estampar`, (): void => {
    const s: AppState = estado()
    assert.strictEqual(reduce(s, caso.noAplica), s)
  })

  test(`${caso.nombre} sobre un diagrama que no existe devuelve el MISMO estado`, (): void => {
    const s: AppState = estado()
    assert.strictEqual(reduce(s, { ...caso.cambia, diagramId: ID_FANTASMA }), s)
  })
}

/* ────────────────────────── add-node de un nodo-nota ──────────────────────── */

const nodoNota = (nota: NoteId): NoteNode => ({
  type: "note-node",
  id: ID_NODO_NUEVO,
  noteId: nota,
  positionX: 0,
  positionY: 0,
  done: false,
})

test("add-node de un nodo-nota a una nota que existe lo añade", (): void => {
  const r: AppState = reduce(estado(), {
    type: "add-node",
    diagramId: ID_MUDANZA,
    node: nodoNota(ID_COMPRA),
    meta: META,
  })
  assert.equal(mudanzaDe(r).nodes[ID_NODO_NUEVO]?.type, "note-node")
})

test("add-node de un nodo-nota a una nota que NO existe devuelve el MISMO estado", (): void => {
  const s: AppState = estado()
  const r: AppState = reduce(s, {
    type: "add-node",
    diagramId: ID_MUDANZA,
    node: nodoNota(noteId("no-existe")),
    meta: META,
  })
  assert.strictEqual(r, s)
})

/* ──────────────────────────────── create-diagram ─────────────────────────── */

test("create-diagram crea un diagrama vacío con sus metadatos", (): void => {
  const nuevo: DiagramId = diagramId("nuevo")
  const r: AppState = reduce(estado(), { type: "create-diagram", diagramId: nuevo, name: "Nuevo diagrama", meta: META })
  assert.deepEqual(r.diagrams[nuevo], {
    id: nuevo,
    name: "Nuevo diagrama",
    nodes: {},
    relations: {},
    updatedAt: META.now,
    revision: META.revision,
  })
})

test("create-diagram con un id que ya existe devuelve el MISMO estado", (): void => {
  const s: AppState = estado()
  assert.strictEqual(reduce(s, { type: "create-diagram", diagramId: ID_MUDANZA, name: "Otro", meta: META }), s)
})

/* ──────────────────────────────── rename-diagram ─────────────────────────── */

test("rename-diagram cambia el nombre y estampa", (): void => {
  const r: AppState = reduce(estado(), { type: "rename-diagram", diagramId: ID_MUDANZA, name: "Traslado", meta: META })
  assert.equal(mudanzaDe(r).name, "Traslado")
  assert.strictEqual(mudanzaDe(r).revision, META.revision)
})

test("rename-diagram con el mismo nombre devuelve el MISMO estado", (): void => {
  const s: AppState = estado()
  assert.strictEqual(reduce(s, { type: "rename-diagram", diagramId: ID_MUDANZA, name: "Mudanza", meta: META }), s)
})

test("rename-diagram sobre un diagrama que no existe devuelve el MISMO estado", (): void => {
  const s: AppState = estado()
  assert.strictEqual(reduce(s, { type: "rename-diagram", diagramId: ID_FANTASMA, name: "x", meta: META }), s)
})

/* ──────────────────────────────── delete-diagram ─────────────────────────── */

const borrarMudanza = (s: AppState): AppState =>
  reduce(s, { type: "delete-diagram", diagramId: ID_MUDANZA, meta: META })

test("delete-diagram borra el diagrama y deja los otros por referencia", (): void => {
  const s: AppState = estado()
  const r: AppState = borrarMudanza(s)
  assert.equal(r.diagrams[ID_MUDANZA], undefined)
  assert.strictEqual(r.diagrams[ID_VIAJE], s.diagrams[ID_VIAJE])
})

test("delete-diagram lo quita de TODOS los contextos que lo listaban, con el MISMO meta", (): void => {
  const r: AppState = borrarMudanza(estado())
  const casa: Context | undefined = r.contexts[ID_CASA]
  const trabajo: Context | undefined = r.contexts[ID_TRABAJO]
  assert.deepEqual(casa?.items, [noteRef(ID_COMPRA)])
  assert.deepEqual(trabajo?.items, [])
  assert.strictEqual(casa?.revision, META.revision)
  assert.strictEqual(trabajo?.revision, META.revision)
})

test("delete-diagram deja INTACTOS, por referencia, los contextos que no lo listaban", (): void => {
  const s: AppState = estado()
  assert.strictEqual(borrarMudanza(s).contexts[ID_VACIO], s.contexts[ID_VACIO])
})

test("delete-diagram NO borra notas", (): void => {
  const s: AppState = estado()
  assert.strictEqual(borrarMudanza(s).notes, s.notes)
})

test("delete-diagram sobre un diagrama que no existe devuelve el MISMO estado", (): void => {
  const s: AppState = estado()
  assert.strictEqual(reduce(s, { type: "delete-diagram", diagramId: ID_FANTASMA, meta: META }), s)
})

/* ────────────────────── delete-note, del lado de los diagramas ──────────────
    Borrar una nota pasa sus nodos-nota a «Nota perdida» en TODOS los diagramas,
    con el mismo meta, y deja por referencia los que no la usaban. */

/** Mudanza y Viaje apuntan a Compra; Obra, no. */
const conNodosNota = (): AppState => {
  const s: AppState = estado()
  const mudanza: Diagram = mudanzaDe(s)
  const obra: Diagram = diagrama(diagramId("obra"), "Obra", { [ID_CAJAS]: texto(ID_CAJAS, "Yeso") }, {})
  return {
    ...s,
    diagrams: {
      ...s.diagrams,
      [ID_MUDANZA]: {
        ...mudanza,
        nodes: { ...mudanza.nodes, [ID_LLAVES]: { ...nodoNota(ID_COMPRA), id: ID_LLAVES } },
      },
      [ID_VIAJE]: diagrama(ID_VIAJE, "Viaje", { [ID_NODO_NUEVO]: nodoNota(ID_COMPRA) }, {}),
      [obra.id]: obra,
    },
  }
}

const borrarCompra = (s: AppState): AppState =>
  reduce(s, { type: "delete-note", noteId: ID_COMPRA, meta: META })

test("delete-note pasa su nodo-nota a «Nota perdida» y conserva sus relaciones", (): void => {
  const s: AppState = conNodosNota()
  const r: AppState = borrarCompra(s)
  const m: Diagram = mudanzaDe(r)
  const llaves: DiagramNode | undefined = m.nodes[ID_LLAVES]

  assert.equal(llaves?.type === "simple-node" && llaves.text, "Nota perdida")
  assert.strictEqual(m.relations, mudanzaDe(s).relations)
  assert.strictEqual(m.nodes[ID_CAJAS], mudanzaDe(s).nodes[ID_CAJAS])
})

test("delete-note toca TODOS los diagramas que la usaban, con el MISMO meta", (): void => {
  const r: AppState = borrarCompra(conNodosNota())
  const viaje: Diagram | undefined = r.diagrams[ID_VIAJE]

  assert.equal(viaje?.nodes[ID_NODO_NUEVO]?.type, "simple-node")
  assert.strictEqual(mudanzaDe(r).revision, META.revision)
  assert.strictEqual(viaje?.revision, META.revision)
  assert.equal(viaje?.updatedAt, META.now)
})

test("delete-note deja INTACTOS, por referencia, los diagramas que no la usaban", (): void => {
  const s: AppState = conNodosNota()
  const obra: DiagramId = diagramId("obra")
  assert.strictEqual(borrarCompra(s).diagrams[obra], s.diagrams[obra])
})

test("delete-note de una nota que ningún diagrama usa deja el MISMO objeto diagrams", (): void => {
  const s: AppState = estado() // Compra existe, pero ningún nodo la usa
  assert.strictEqual(borrarCompra(s).diagrams, s.diagrams)
})
