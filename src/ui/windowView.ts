/**
 * Qué enseña la vista ventanas ahora mismo: la ventana activa, su título, si se
 * puede renombrar, sus notas —o la nota que se edita, si es una ventana de nota—
 * y si hay ventana antes y después.
 *
 * Es un cálculo puro sobre el estado y la lista de ventanas, así que todo lo que
 * decide la pantalla se prueba en Node; al DOM sólo le queda pintarlo.
 */

import type { AppState, Context, ContextId, ItemRef, Note, NoteId } from "#core/index"
import type { WindowRef, WindowsLayout } from "./windows.js"
import { sameWindow } from "./windows.js"

export const GENERAL_TITLE: string = "General"

export type WindowView =
  | { readonly kind: "empty" }
  | {
      readonly kind: "window"
      readonly ref: WindowRef
      readonly title: string
      /** El contexto que se renombra al tocar el título; `null` en el General y en una nota. */
      readonly renames: ContextId | null
      /** La nota que se edita en la ventana, si es de tipo nota. Su título la renombra. */
      readonly editsNote: NoteId | null
      /** La lista de la ventana. Vacía en una ventana de nota: ahí va el editor. */
      readonly notes: ReadonlyArray<Note>
      /** Sin anterior en la primera ni siguiente en la última: no es circular. */
      readonly prev: WindowRef | null
      readonly next: WindowRef | null
    }

const VACIA: WindowView = { kind: "empty" }

/** Cómo se llama lo que enseña una ventana. Vacío si ya no existe: la guarda lo quita. */
export const windowTitle = (ref: WindowRef, state: AppState): string => {
  switch (ref.kind) {
    case "general":
      return GENERAL_TITLE
    case "context":
      return state.contexts[ref.id]?.name ?? ""
    case "note":
      return state.notes[ref.id]?.name ?? ""
  }
}

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
      editsNote: null,
      notes: todasLasNotas(state),
      ...vecinas,
    }
  }

  if (activa.kind === "note") {
    const nota: Note | undefined = state.notes[activa.id]
    if (nota === undefined) return VACIA
    return {
      kind: "window",
      ref: activa,
      title: nota.name,
      renames: null,
      editsNote: nota.id,
      notes: [],
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
    editsNote: null,
    notes: notasDe(ctx, state),
    ...vecinas,
  }
}
