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
 */

import type { AppState } from "../domain/AppState"
import type { Context } from "../domain/Context"
import type { ItemRef } from "../domain/Ids"
import type { Note } from "../domain/Note"
import type { Plan } from "../domain/Plan"

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

export const hydrate = (stored: StoredEntities): AppState => {
  const notes: AppState["notes"] = porId(stored.notes)
  const plans: AppState["plans"] = porId(stored.plans)

  const existe = (item: ItemRef): boolean =>
    item.kind === "note" ? notes[item.id] !== undefined : plans[item.id] !== undefined

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
