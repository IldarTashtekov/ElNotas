/**
 * Qué enseña la vista ventanas ahora mismo: la ventana activa, su título, si se
 * puede renombrar, sus notas y si hay ventana antes y después.
 *
 * Es un cálculo puro sobre el estado y la lista de ventanas, así que todo lo que
 * decide la pantalla se prueba en Node; al DOM sólo le queda pintarlo.
 */

import type { AppState, Context, ContextId, ItemRef, Note } from "#core/index"
import type { WindowRef, WindowsLayout } from "./windows.js"
import { sameWindow } from "./windows.js"

export const GENERAL_TITLE: string = "General"

export type WindowView =
  | { readonly kind: "empty" }
  | {
      readonly kind: "window"
      readonly ref: WindowRef
      readonly title: string
      /** El contexto que se renombra al tocar el título; `null` en el General. */
      readonly renames: ContextId | null
      readonly notes: ReadonlyArray<Note>
      /** Sin anterior en la primera ni siguiente en la última: no es circular. */
      readonly prev: WindowRef | null
      readonly next: WindowRef | null
    }

const VACIA: WindowView = { kind: "empty" }

/** El General enseña todas, por nombre: no hay otro orden que sea suyo. */
const todasLasNotas = (state: AppState): ReadonlyArray<Note> =>
  [...Object.values<Note>(state.notes)].sort((a: Note, b: Note): number =>
    a.name.localeCompare(b.name),
  )

/** Un contexto enseña las suyas en el orden en que las lista. */
const notasDe = (ctx: Context, state: AppState): ReadonlyArray<Note> =>
  ctx.items
    .map((item: ItemRef): Note | undefined =>
      item.kind === "note" ? state.notes[item.id] : undefined,
    )
    .filter((nota: Note | undefined): nota is Note => nota !== undefined)

export const windowView = (layout: WindowsLayout, state: AppState): WindowView => {
  const activa: WindowRef | null = layout.active
  if (activa === null) return VACIA

  const i: number = layout.windows.findIndex((ref: WindowRef): boolean => sameWindow(ref, activa))
  if (i === -1) return VACIA
  const vecinas: { readonly prev: WindowRef | null; readonly next: WindowRef | null } = {
    prev: layout.windows[i - 1] ?? null,
    next: layout.windows[i + 1] ?? null,
  }

  if (activa.kind === "general") {
    return {
      kind: "window",
      ref: activa,
      title: GENERAL_TITLE,
      renames: null,
      notes: todasLasNotas(state),
      ...vecinas,
    }
  }

  const ctx: Context | undefined = state.contexts[activa.id]
  /* La guarda ya lo ha quitado, pero el tipo no lo sabe. */
  if (ctx === undefined) return VACIA

  return {
    kind: "window",
    ref: activa,
    title: ctx.name,
    renames: ctx.id,
    notes: notasDe(ctx, state),
    ...vecinas,
  }
}
