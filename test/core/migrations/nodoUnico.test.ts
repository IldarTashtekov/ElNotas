/**
 * La migración 1→2, sola: cada nodo viejo, en qué texto se queda, y que lo que ya
 * es nuevo sale como entró, el mismo objeto.
 */

import { test } from "node:test"
import assert from "node:assert/strict"

import type { Diagram, DiagramNode } from "#core/domain/Diagram"
import type { DiagramNodeId } from "#core/domain/Ids"
import { diagramId, diagramNodeId, noteId, noteRef, revision } from "#core/domain/Ids"
import type { Note } from "#core/domain/Note"
import type { StoredEntities } from "#core/migrations/hydrate"
import { nodoUnico } from "#core/migrations/nodoUnico"

const nota = (id: string, name: string): Note => ({
  id: noteId(id),
  name,
  content: [],
  updatedAt: 0,
  revision: revision(`r-${id}`),
})

const ID_NODO: DiagramNodeId = diagramNodeId("n")

/** Un diagrama con un solo nodo, tal como venga, viejo o nuevo. */
const conNodo = (nodo: unknown): Diagram =>
  ({
    id: diagramId("d"),
    name: "D",
    nodes: { [ID_NODO]: nodo },
    relations: {},
    updatedAt: 0,
    revision: revision("r-d"),
  }) as unknown as Diagram

const migrado = (guardado: StoredEntities): StoredEntities => nodoUnico.migrate(guardado) as StoredEntities

/** El nodo en el que se queda uno viejo, con esas notas a la vista. */
const nodoMigrado = (viejo: unknown, extra: Partial<StoredEntities> = {}): DiagramNode | undefined => {
  const r: StoredEntities = migrado({ notes: [], contexts: [], diagrams: [conNodo(viejo)], ...extra })
  return r.diagrams[0]?.nodes[ID_NODO]
}

const posicion: { readonly positionX: number; readonly positionY: number; readonly done: boolean } = {
  positionX: 3,
  positionY: 4,
  done: true,
}

test("nodoUnico sale del esquema 1", (): void => {
  assert.equal(nodoUnico.from, 1)
})

test("un nodo de texto pierde su tipo y se queda con su texto", (): void => {
  assert.deepEqual(nodoMigrado({ type: "simple-node", id: ID_NODO, text: "Cajas", ...posicion }), {
    id: ID_NODO,
    text: "Cajas",
    ...posicion,
  })
})

test("un nodo-nota pasa a ser el enlace a su nota, con el nombre escapado", (): void => {
  const n: DiagramNode | undefined = nodoMigrado(
    { type: "note-node", id: ID_NODO, noteId: "c", ...posicion },
    { notes: [nota("c", "Compra *[sábado]*")] },
  )
  assert.deepEqual(n, { id: ID_NODO, text: "[Compra \\*\\[sábado\\]\\*](#c)", ...posicion })
})

test("el nodo de una nota que no está pasa a «Nota perdida», enlazando a su id", (): void => {
  const n: DiagramNode | undefined = nodoMigrado({ type: "note-node", id: ID_NODO, noteId: "x", ...posicion })
  assert.equal(n?.text, "[Nota perdida](#x)")
})

test("el nodo de una nota ilegible pasa a «Nota ilegible», enlazando a su id", (): void => {
  const n: DiagramNode | undefined = nodoMigrado(
    { type: "note-node", id: ID_NODO, noteId: "x", ...posicion },
    { unreadable: [noteRef(noteId("x"))] },
  )
  assert.equal(n?.text, "[Nota ilegible](#x)")
})

test("un nodo ya nuevo sale como entró: los datos son el MISMO objeto", (): void => {
  const guardado: StoredEntities = {
    notes: [],
    contexts: [],
    diagrams: [conNodo({ id: ID_NODO, text: "[Compra](#c)", ...posicion })],
  }
  assert.strictEqual(migrado(guardado), guardado)
})

test("migrar dos veces es migrar una, y no toca la revisión", (): void => {
  const guardado: StoredEntities = {
    notes: [nota("c", "Compra")],
    contexts: [],
    diagrams: [conNodo({ type: "note-node", id: ID_NODO, noteId: "c", ...posicion })],
  }
  const una: StoredEntities = migrado(guardado)
  assert.strictEqual(migrado(una), una)
  assert.equal(una.diagrams[0]?.revision, guardado.diagrams[0]?.revision)
})

test("sólo se copia el diagrama que tiene nodos viejos; los demás, el mismo objeto", (): void => {
  const nuevo: Diagram = { ...conNodo({ id: ID_NODO, text: "x", ...posicion }), id: diagramId("nuevo") }
  const viejo: Diagram = conNodo({ type: "simple-node", id: ID_NODO, text: "x", ...posicion })
  const r: StoredEntities = migrado({ notes: [], contexts: [], diagrams: [nuevo, viejo] })
  assert.strictEqual(r.diagrams[0], nuevo)
  assert.notStrictEqual(r.diagrams[1], viejo)
})
