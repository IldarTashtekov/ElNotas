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
 * referencia sería mucho peor que la basura que se tira.
 *
 * Lo que existe pero no se pudo leer es otra cosa: su referencia se conserva,
 * para que arreglar el fichero lo devuelva a su contexto.
 */

import type { AppState } from "../domain/AppState.js"
import type { Context } from "../domain/Context.js"
import type { ItemRef } from "../domain/Ids.js"
import type { Note } from "../domain/Note.js"
import type { Plan } from "../domain/Plan.js"

/** Lo que devuelve el almacén: tres listas. */
export interface StoredEntities {
  readonly notes: ReadonlyArray<Note>
  readonly plans: ReadonlyArray<Plan>
  readonly contexts: ReadonlyArray<Context>
}

const porId = <TId extends string, T extends { readonly id: TId }>(
  xs: ReadonlyArray<T>,
): Readonly<Record<TId, T>> =>
  Object.fromEntries(xs.map((x: T): readonly [TId, T] => [x.id, x])) as Record<TId, T>

/** Si una referencia apunta a algo que está guardado pero no se pudo leer. */
export type Unreadable = (item: ItemRef) => boolean

const nadaIlegible: Unreadable = (): boolean => false

export const hydrate = (stored: StoredEntities, ilegible: Unreadable = nadaIlegible): AppState => {
  const notes: AppState["notes"] = porId(stored.notes)
  const plans: AppState["plans"] = porId(stored.plans)

  /* Se queda lo que está, y lo que está pero no se pudo leer. */
  const existe = (item: ItemRef): boolean =>
    (item.kind === "note" ? notes[item.id] !== undefined : plans[item.id] !== undefined) ||
    ilegible(item)

  const contexts: AppState["contexts"] = porId(
    stored.contexts.map((ctx: Context): Context => {
      const items: ReadonlyArray<ItemRef> = ctx.items.filter(existe)
      /* Si no sobraba ninguna, se devuelve el contexto TAL CUAL. `filter` crea
         siempre un array nuevo, y un contexto nuevo al arrancar saldría sucio en
         el primer diff y se reescribiría en disco sin haber cambiado nada.
         Con un arranque normal —donde no sobra ninguna referencia— esto tiene
         que devolver exactamente lo que le entró. */
      return items.length === ctx.items.length ? ctx : { ...ctx, items }
    }),
  )

  return { notes, plans, contexts }
}
