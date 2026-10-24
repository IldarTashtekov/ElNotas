/**
 * De lo guardado al estado en memoria: la parte pura del arranque.
 *
 * El almacén devuelve listas y el estado en memoria es un mapa por id. Convertir
 * es trivial, pero es el último sitio donde se puede notar que lo guardado está
 * mal — y lo estará alguna vez, porque un fichero JSON en el disco del usuario lo
 * puede tocar cualquiera.
 *
 * Por eso aquí se limpian, en silencio, las referencias que apuntan a algo que ya
 * no existe. Fallar al arrancar y dejar al usuario sin sus notas porque sobra una
 * referencia sería mucho peor que la basura que se tira. Lo oculto de un contexto
 * que ya no esté en él, igual.
 *
 * Lo que existe pero no se pudo leer es otra cosa: su referencia se conserva,
 * para que arreglar el fichero lo devuelva a su contexto.
 *
 * En los diagramas, igual: una relación con un extremo que no está se tira, y un
 * nodo cuya nota ya no existe pasa a «Nota perdida».
 */

import type { AppState } from "../domain/AppState.js"
import type { Context } from "../domain/Context.js"
import type { Diagram, DiagramNode, DiagramRelation } from "../domain/Diagram.js"
import { loseNote } from "../domain/diagramOperations.js"
import type { DiagramRelationId, ItemRef, NoteId } from "../domain/Ids.js"
import { noteRef } from "../domain/Ids.js"
import type { Note } from "../domain/Note.js"

/** Lo que devuelve el almacén: tres listas. */
export interface StoredEntities {
  readonly notes: ReadonlyArray<Note>
  readonly diagrams: ReadonlyArray<Diagram>
  readonly contexts: ReadonlyArray<Context>
}

const porId = <TId extends string, T extends { readonly id: TId }>(
  xs: ReadonlyArray<T>,
): Readonly<Record<TId, T>> =>
  Object.fromEntries(xs.map((x: T): readonly [TId, T] => [x.id, x])) as Record<TId, T>

/** Si una referencia apunta a algo que está guardado pero no se pudo leer. */
export type Unreadable = (item: ItemRef) => boolean

const nadaIlegible: Unreadable = (): boolean => false

/**
 * Un diagrama sin relaciones rotas —con un extremo que no está, o de un nodo a sí
 * mismo— y con los nodos de notas que ya no existen como «Nota perdida». Si no
 * sobraba nada, el diagrama TAL CUAL, como los contextos de abajo.
 */
const diagramaLimpio = (d: Diagram, notaPerdida: (id: NoteId) => boolean): Diagram => {
  const relaciones: ReadonlyArray<DiagramRelation> = Object.values<DiagramRelation>(d.relations)
  const sanas: ReadonlyArray<DiagramRelation> = relaciones.filter(
    (r: DiagramRelation): boolean =>
      r.from !== r.to && d.nodes[r.from] !== undefined && d.nodes[r.to] !== undefined,
  )
  const conRelaciones: Diagram =
    sanas.length === relaciones.length
      ? d
      : {
          ...d,
          relations: Object.fromEntries(
            sanas.map((r: DiagramRelation): readonly [DiagramRelationId, DiagramRelation] => [
              r.id,
              r,
            ]),
          ),
        }

  const perdidas: ReadonlyArray<NoteId> = Object.values<DiagramNode>(d.nodes).flatMap(
    (n: DiagramNode): ReadonlyArray<NoteId> =>
      n.type === "note-node" && notaPerdida(n.noteId) ? [n.noteId] : [],
  )
  return perdidas.reduce(
    (acc: Diagram, id: NoteId): Diagram => loseNote(acc, id),
    conRelaciones,
  )
}

export const hydrate = (stored: StoredEntities, ilegible: Unreadable = nadaIlegible): AppState => {
  const notes: AppState["notes"] = porId(stored.notes)

  /* Perdida es la que no está y tampoco está ilegible: ésa vuelve si se arregla. */
  const notaPerdida = (id: NoteId): boolean =>
    notes[id] === undefined && !ilegible(noteRef(id))
  const diagrams: AppState["diagrams"] = porId(
    stored.diagrams.map((d: Diagram): Diagram => diagramaLimpio(d, notaPerdida)),
  )

  /* Se queda lo que está, y lo que está pero no se pudo leer. */
  const existe = (item: ItemRef): boolean =>
    (item.kind === "note" ? notes[item.id] !== undefined : diagrams[item.id] !== undefined) ||
    ilegible(item)

  const contexts: AppState["contexts"] = porId(
    stored.contexts.map((ctx: Context): Context => {
      const items: ReadonlyArray<ItemRef> = ctx.items.filter(existe)
      /* Lo oculto, sólo si sigue en `items`: ocultar es de lo que el contexto tiene. */
      const enItems = (h: ItemRef): boolean =>
        items.some((i: ItemRef): boolean => i.kind === h.kind && i.id === h.id)
      const hidden: ReadonlyArray<ItemRef> | undefined = ctx.hidden?.filter(enItems)
      /* Si no sobraba ninguna, se devuelve el contexto TAL CUAL. `filter` crea
         siempre un array nuevo, y un contexto nuevo al arrancar saldría sucio en
         el primer diff y se reescribiría en disco sin haber cambiado nada.
         Con un arranque normal —donde no sobra ninguna referencia— esto tiene
         que devolver exactamente lo que le entró. */
      if (items.length === ctx.items.length && hidden?.length === ctx.hidden?.length) return ctx
      return hidden === undefined ? { ...ctx, items } : { ...ctx, items, hidden }
    }),
  )

  return { notes, diagrams, contexts }
}
