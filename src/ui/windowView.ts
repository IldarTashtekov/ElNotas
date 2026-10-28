/**
 * Qué enseña la vista ventanas ahora mismo: la ventana activa, su título, si se
 * puede renombrar, sus notas y diagramas —o la nota o el diagrama que enseña, si
 * es una ventana de nota o de diagrama— y si hay ventana antes y después.
 *
 * Es un cálculo puro sobre el estado y la lista de ventanas, así que todo lo que
 * decide la pantalla se prueba en Node; al DOM sólo le queda pintarlo.
 */

import type {
  AppState,
  Context,
  ContextId,
  Diagram,
  DiagramId,
  ItemRef,
  Note,
  NoteId,
} from "#core/index"
import { diagramRef, noteRef } from "#core/index"
import type { WindowRef, WindowsLayout } from "./windows.js"
import { sameWindow } from "./windows.js"

export const GENERAL_TITLE: string = "General"
export const CALENDAR_TITLE: string = "Calendario"

/** Una fila de la lista de una ventana: una nota o un diagrama, con su nombre. */
export interface ListItem {
  readonly ref: ItemRef
  readonly name: string
}

export type WindowView =
  | { readonly kind: "empty" }
  | {
      readonly kind: "window"
      readonly ref: WindowRef
      readonly title: string
      /** El contexto que se renombra al tocar el título; `null` si la ventana no es de contexto. */
      readonly renames: ContextId | null
      /** La nota que se edita en la ventana, si es de tipo nota. Su título la renombra. */
      readonly editsNote: NoteId | null
      /** El diagrama que enseña la ventana, si es de tipo diagrama. Su título lo renombra. */
      readonly editsDiagram: DiagramId | null
      /** Si la ventana enseña el calendario, que no es de nota ni de diagrama ni lleva lista. */
      readonly showsCalendar: boolean
      /** La lista de la ventana, sin lo oculto. Vacía en una de nota o de diagrama: ahí va lo suyo. */
      readonly items: ReadonlyArray<ListItem>
      /** Lo oculto del contexto, en su orden. Vacío fuera de una ventana de contexto. */
      readonly hidden: ReadonlyArray<ListItem>
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
    case "calendar":
      return CALENDAR_TITLE
    case "context":
      return state.contexts[ref.id]?.name ?? ""
    case "note":
      return state.notes[ref.id]?.name ?? ""
    case "diagram":
      return state.diagrams[ref.id]?.name ?? ""
  }
}

const deNota = (n: Note): ListItem => ({ ref: noteRef(n.id), name: n.name })
const deDiagrama = (d: Diagram): ListItem => ({ ref: diagramRef(d.id), name: d.name })

/** El General enseña todo, notas y diagramas mezclados, por nombre: no hay otro orden suyo. */
const todo = (state: AppState): ReadonlyArray<ListItem> =>
  [
    ...Object.values<Note>(state.notes).map(deNota),
    ...Object.values<Diagram>(state.diagrams).map(deDiagrama),
  ].sort((a: ListItem, b: ListItem): number => a.name.localeCompare(b.name))

/** Lo que una referencia señala, si se puede enseñar: una nota ilegible no. */
const fila = (item: ItemRef, state: AppState): ReadonlyArray<ListItem> => {
  if (item.kind === "note") {
    const n: Note | undefined = state.notes[item.id]
    return n === undefined ? [] : [deNota(n)]
  }
  const d: Diagram | undefined = state.diagrams[item.id]
  return d === undefined ? [] : [deDiagrama(d)]
}

/** Si el contexto tiene oculta esta referencia. */
const oculto = (ctx: Context, item: ItemRef): boolean =>
  (ctx.hidden ?? []).some((h: ItemRef): boolean => h.kind === item.kind && h.id === item.id)

/** Lo de un contexto, oculto o no, en el orden en que lo lista. */
const deContexto = (
  ctx: Context,
  state: AppState,
  ocultos: boolean,
): ReadonlyArray<ListItem> =>
  ctx.items
    .filter((item: ItemRef): boolean => oculto(ctx, item) === ocultos)
    .flatMap((item: ItemRef): ReadonlyArray<ListItem> => fila(item, state))

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
      editsDiagram: null,
      showsCalendar: false,
      items: todo(state),
      hidden: [],
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
      editsDiagram: null,
      showsCalendar: false,
      items: [],
      hidden: [],
      ...vecinas,
    }
  }

  if (activa.kind === "diagram") {
    const diagrama: Diagram | undefined = state.diagrams[activa.id]
    if (diagrama === undefined) return VACIA
    return {
      kind: "window",
      ref: activa,
      title: diagrama.name,
      renames: null,
      editsNote: null,
      editsDiagram: diagrama.id,
      showsCalendar: false,
      items: [],
      hidden: [],
      ...vecinas,
    }
  }

  if (activa.kind === "calendar") {
    return {
      kind: "window",
      ref: activa,
      title: CALENDAR_TITLE,
      renames: null,
      editsNote: null,
      editsDiagram: null,
      showsCalendar: true,
      items: [],
      hidden: [],
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
    editsDiagram: null,
    showsCalendar: false,
    items: deContexto(ctx, state, false),
    hidden: deContexto(ctx, state, true),
    ...vecinas,
  }
}
