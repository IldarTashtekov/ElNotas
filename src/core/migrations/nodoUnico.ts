/**
 * La migración 1→2: los dos tipos de nodo del lienzo pasan a uno solo, de texto.
 *
 * Un nodo de texto pierde su `type` y se queda con su texto. Un nodo-nota pasa a
 * ser un enlace a su nota, `[nombre](#id)`; si la nota no está, `[Nota perdida](#id)`,
 * y si está pero no se pudo leer, `[Nota ilegible](#id)`: arreglada, el enlace
 * vuelve a llevar a ella. Un nodo ya nuevo, sin `type`, se deja igual.
 */

import type { Diagram, DiagramNode } from "../domain/Diagram.js"
import type { DiagramNodeId, ItemRef, NoteId } from "../domain/Ids.js"
import { buildLink } from "../domain/link.js"
import type { Note } from "../domain/Note.js"
import type { StoredEntities } from "./hydrate.js"
import type { Migration } from "./runMigrations.js"

/** Un nodo tal como puede estar guardado con el esquema 1, o ya con el 2. */
interface NodoGuardado {
  readonly id: DiagramNodeId
  readonly positionX: number
  readonly positionY: number
  readonly done: boolean
  readonly type?: "simple-node" | "note-node"
  readonly text?: string
  readonly noteId?: NoteId
}

const textoDelNodo = (
  nodo: NodoGuardado,
  nombreDe: (id: NoteId) => string | undefined,
  ilegible: (id: NoteId) => boolean,
): string => {
  if (nodo.type !== "note-node") return nodo.text ?? ""
  const id: NoteId = nodo.noteId ?? ("" as NoteId)
  const nombre: string | undefined = nombreDe(id)
  const visible: string =
    nombre !== undefined ? nombre : ilegible(id) ? "Nota ilegible" : "Nota perdida"
  /* Un id con `)` no cabe en un enlace: queda el texto suelto. */
  return buildLink(visible, `#${id}`) ?? visible
}

const migrarNodo = (
  nodo: NodoGuardado,
  nombreDe: (id: NoteId) => string | undefined,
  ilegible: (id: NoteId) => boolean,
): DiagramNode =>
  nodo.type === undefined
    ? (nodo as DiagramNode)
    : {
        id: nodo.id,
        positionX: nodo.positionX,
        positionY: nodo.positionY,
        done: nodo.done,
        text: textoDelNodo(nodo, nombreDe, ilegible),
      }

const migrarDiagrama = (
  diagrama: Diagram,
  nombreDe: (id: NoteId) => string | undefined,
  ilegible: (id: NoteId) => boolean,
): Diagram => {
  const nodos: ReadonlyArray<NodoGuardado> = Object.values<NodoGuardado>(
    diagrama.nodes as Readonly<Record<DiagramNodeId, NodoGuardado>>,
  )
  if (nodos.every((n: NodoGuardado): boolean => n.type === undefined)) return diagrama
  return {
    ...diagrama,
    nodes: Object.fromEntries(
      nodos.map((n: NodoGuardado): readonly [DiagramNodeId, DiagramNode] => [
        n.id,
        migrarNodo(n, nombreDe, ilegible),
      ]),
    ),
  }
}

export const nodoUnico: Migration = {
  from: 1,
  migrate: (data: unknown): unknown => {
    const guardado: StoredEntities = data as StoredEntities
    const nombres: ReadonlyMap<NoteId, string> = new Map<NoteId, string>(
      guardado.notes.map((n: Note): readonly [NoteId, string] => [n.id, n.name]),
    )
    const ilegibles: ReadonlySet<string> = new Set<string>(
      (guardado.unreadable ?? []).flatMap((r: ItemRef): ReadonlyArray<string> =>
        r.kind === "note" ? [r.id] : [],
      ),
    )
    const nombreDe = (id: NoteId): string | undefined => nombres.get(id)
    const ilegible = (id: NoteId): boolean => ilegibles.has(id)

    const diagrams: ReadonlyArray<Diagram> = guardado.diagrams.map(
      (d: Diagram): Diagram => migrarDiagrama(d, nombreDe, ilegible),
    )
    const iguales: boolean = diagrams.every((d: Diagram, i: number): boolean => d === guardado.diagrams[i])
    return iguales ? guardado : { ...guardado, diagrams }
  },
}
