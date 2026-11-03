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
 * En los diagramas, igual: una relación con un extremo que no está se tira.
 */

import type { AppState } from "../domain/AppState.js"
import type { CalendarEvent } from "../domain/CalendarEvent.js"
import type { Context } from "../domain/Context.js"
import type { Diagram, DiagramRelation } from "../domain/Diagram.js"
import type { DiagramRelationId, ItemRef } from "../domain/Ids.js"
import type { Note } from "../domain/Note.js"
import type { Routine } from "../domain/Routine.js"

/**
 * Lo que devuelve el almacén: las listas. Los eventos, si faltan, son
 * vacíos, y las rutinas igual: lo guardado antes de que existieran no se migra.
 */
export interface StoredEntities {
  readonly notes: ReadonlyArray<Note>
  readonly diagrams: ReadonlyArray<Diagram>
  readonly contexts: ReadonlyArray<Context>
  readonly events?: ReadonlyArray<CalendarEvent>
  readonly routines?: ReadonlyArray<Routine>
  /** Lo que está guardado pero no se pudo leer: para las migraciones, que no lo ven. */
  readonly unreadable?: ReadonlyArray<ItemRef>
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
 * mismo—. Si no sobraba nada, el diagrama TAL CUAL, como los contextos de abajo.
 */
const diagramaLimpio = (d: Diagram): Diagram => {
  const relaciones: ReadonlyArray<DiagramRelation> = Object.values<DiagramRelation>(d.relations)
  const sanas: ReadonlyArray<DiagramRelation> = relaciones.filter(
    (r: DiagramRelation): boolean =>
      r.from !== r.to && d.nodes[r.from] !== undefined && d.nodes[r.to] !== undefined,
  )
  if (sanas.length === relaciones.length) return d
  return {
    ...d,
    relations: Object.fromEntries(
      sanas.map((r: DiagramRelation): readonly [DiagramRelationId, DiagramRelation] => [r.id, r]),
    ),
  }
}

export const hydrate = (
  stored: StoredEntities,
  ilegible: Unreadable = nadaIlegible,
): AppState => {
  const notes: AppState["notes"] = porId(stored.notes)
  const diagrams: AppState["diagrams"] = porId(stored.diagrams.map(diagramaLimpio))

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

  const events: AppState["events"] = porId(stored.events ?? [])
  const routines: AppState["routines"] = porId(stored.routines ?? [])

  return { notes, diagrams, contexts, events, routines }
}
