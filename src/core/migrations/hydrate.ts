/**
 * De lo guardado al estado en memoria: **la parte pura del arranque**.
 *
 * El arranque de la app tenía dos dueños de fase y por eso no encajaba en
 * ninguno (`ARCHITECTURE.md` §9.7). Se parte por la costura de siempre:
 *
 * - **aquí, puro y en la Fase 2** — pasar de listas de entidades a un `AppState`
 *   normalizado, y aplicar migraciones si el esquema es viejo. De datos a datos,
 *   comprobable sin navegador;
 * - **en `platform/`, Fase 4** — quién abre el storage, en qué orden, y qué se le
 *   enseña al usuario si no hay nada guardado.
 *
 * ── Por qué hidratar no es sólo "meterlo en un objeto" ─────────────────────
 *
 * El almacén devuelve **listas**; `AppState` es un **mapa por id** (§5.2). La
 * conversión es trivial, pero es también el último sitio donde se puede notar
 * que lo guardado está mal — y lo estará alguna vez, porque un fichero JSON en
 * el disco del usuario lo puede tocar cualquiera.
 *
 * Aquí se hace una sola comprobación, la que sostiene una invariante del
 * proyecto: **ninguna `ItemRef` puede apuntar a algo que no existe**. El reducer
 * la mantiene en cada acción (`add-item` es no-op si el destino no existe;
 * `delete-note` limpia los contextos), pero eso no sirve de nada si la app
 * arranca ya con referencias rotas. Se limpian al entrar, en silencio: la
 * alternativa —fallar al arrancar y dejar al usuario sin sus notas porque una
 * referencia sobra— es mucho peor que la basura que se tira.
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
  Object.fromEntries(xs.map((x) => [x.id, x])) as Record<TId, T>

export const hydrate = (stored: StoredEntities): AppState => {
  const notes = porId(stored.notes)
  const plans = porId(stored.plans)

  const existe = (item: ItemRef): boolean =>
    item.kind === "note" ? notes[item.id] !== undefined : plans[item.id] !== undefined

  const contexts = porId(
    stored.contexts.map((ctx) => {
      const items = ctx.items.filter(existe)
      /* Si no sobraba ninguna, se devuelve el contexto TAL CUAL. `filter` crea
         siempre un array nuevo, y un contexto nuevo al arrancar saldría sucio en
         el primer diff y se reescribiría en disco sin haber cambiado nada (§3).
         Con un arranque normal —donde no sobra ninguna referencia— esto tiene
         que devolver exactamente lo que le entró. */
      return items.length === ctx.items.length ? ctx : { ...ctx, items }
    }),
  )

  return { notes, plans, contexts }
}
