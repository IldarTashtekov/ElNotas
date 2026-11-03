/**
 * Lo guardado con el esquema 1, escrito a mano como lo dejaba aquella versión:
 * un diagrama con los dos tipos de nodo de entonces. Sus nodos-nota apuntan a una
 * nota que está, a una ilegible y a una que ya no existe.
 *
 * Para probar la migración de verdad en el arranque y en una copia importada.
 */

import assert from "node:assert/strict"

import type { BlobStore, Diagram, DiagramNode, Result, StorageError } from "#core/index"
import type { DiagramId, DiagramNodeId } from "#core/domain/Ids"
import { diagramId, diagramNodeId } from "#core/domain/Ids"

export const ID_DIAGRAMA_VIEJO: DiagramId = diagramId("mudanza")
export const NODO_TEXTO: DiagramNodeId = diagramNodeId("texto")
export const NODO_COMPRA: DiagramNodeId = diagramNodeId("a-compra")
export const NODO_ROTA: DiagramNodeId = diagramNodeId("a-rota")
export const NODO_FANTASMA: DiagramNodeId = diagramNodeId("a-fantasma")

const posicion: { readonly positionX: number; readonly positionY: number; readonly done: boolean } = {
  positionX: 10,
  positionY: 20,
  done: false,
}

/** Camino → contenido, como lo lleva una copia de seguridad. */
export const FICHEROS_ESQUEMA_UNO: Readonly<Record<string, string>> = {
  "manifest.json": JSON.stringify({ schemaVersion: 1 }),
  "notes/compra.json": JSON.stringify({
    id: "compra",
    name: "Compra [sábado]",
    content: [],
    updatedAt: 1,
    revision: "r-compra",
  }),
  "notes/rota.json": "no es json",
  "diagrams/mudanza.json": JSON.stringify({
    id: "mudanza",
    name: "Mudanza",
    updatedAt: 1,
    revision: "r-mudanza",
    nodes: {
      texto: { type: "simple-node", id: "texto", text: "Cajas", ...posicion, done: true },
      "a-compra": { type: "note-node", id: "a-compra", noteId: "compra", ...posicion },
      "a-rota": { type: "note-node", id: "a-rota", noteId: "rota", ...posicion },
      "a-fantasma": { type: "note-node", id: "a-fantasma", noteId: "fantasma", ...posicion },
    },
    relations: {
      r: { id: "r", from: "texto", to: "a-compra", directed: true, label: "" },
    },
  }),
}

/** Los nodos tal como tienen que quedar, ya del esquema 2. */
export const NODOS_MIGRADOS: Readonly<Record<string, DiagramNode>> = {
  [NODO_TEXTO]: { id: NODO_TEXTO, text: "Cajas", positionX: 10, positionY: 20, done: true },
  [NODO_COMPRA]: { id: NODO_COMPRA, text: "[Compra \\[sábado\\]](#compra)", positionX: 10, positionY: 20, done: false },
  [NODO_ROTA]: { id: NODO_ROTA, text: "[Nota ilegible](#rota)", positionX: 10, positionY: 20, done: false },
  [NODO_FANTASMA]: { id: NODO_FANTASMA, text: "[Nota perdida](#fantasma)", positionX: 10, positionY: 20, done: false },
}

/** Escribe esos ficheros en un almacén. */
export const escribirEsquemaUno = async (blobs: BlobStore): Promise<void> => {
  for (const [camino, contenido] of Object.entries(FICHEROS_ESQUEMA_UNO)) {
    const hecho: Result<void, StorageError> = await blobs.write(camino, new TextEncoder().encode(contenido))
    if (!hecho.ok) assert.fail(`no se pudo escribir ${camino}`)
  }
}

/** Los nodos del diagrama viejo en un estado, que tiene que estar. */
export const nodosDe = (diagramas: Readonly<Record<string, Diagram>>): Readonly<Record<string, DiagramNode>> => {
  const d: Diagram | undefined = diagramas[ID_DIAGRAMA_VIEJO]
  if (d === undefined) assert.fail("el diagrama viejo no ha llegado")
  return d.nodes
}
