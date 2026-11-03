/**
 * Las ventanas: qué hay en la vista principal y en qué orden, y cuál está activa.
 *
 * Una ventana es sólo una referencia a lo que enseña. La lista vive fuera del
 * core, así que puede apuntar a un contexto que ya se borró: la guarda de aquí
 * calcula las ventanas que se pueden enseñar y deja fuera las rotas.
 *
 * Todo es puro: se prueba en Node sin navegador.
 */

import type { AppState, ContextId, DiagramId, NoteId } from "#core/index"
import { contextId, diagramId, noteId } from "#core/index"

/** Lo que enseña una ventana: el General, el calendario, un contexto, una nota o un diagrama. */
export type WindowRef =
  | { readonly kind: "general" }
  | { readonly kind: "calendar" }
  | { readonly kind: "context"; readonly id: ContextId }
  | { readonly kind: "note"; readonly id: NoteId }
  | { readonly kind: "diagram"; readonly id: DiagramId }

export interface WindowsLayout {
  readonly windows: ReadonlyArray<WindowRef>
  /** Referencia y no índice: un índice señalaría a otra al quitar una anterior. */
  readonly active: WindowRef | null
}

export const GENERAL: WindowRef = { kind: "general" }

/** Sin id: el calendario es uno solo, y en la lista no puede haber dos. */
export const CALENDAR: WindowRef = { kind: "calendar" }

/** Lo que se ve la primera vez, sin nada guardado: la ventana del General. */
export const DEFAULT_LAYOUT: WindowsLayout = { windows: [GENERAL], active: GENERAL }

export const sameWindow = (a: WindowRef, b: WindowRef): boolean => {
  switch (a.kind) {
    case "general":
      return b.kind === "general"
    case "calendar":
      return b.kind === "calendar"
    case "context":
      return b.kind === "context" && a.id === b.id
    case "note":
      return b.kind === "note" && a.id === b.id
    case "diagram":
      return b.kind === "diagram" && a.id === b.id
  }
}

/** Si lo que enseña esa ventana existe. El General y el calendario, siempre: no son entidades. */
export const windowExists = (ref: WindowRef, state: AppState): boolean => {
  switch (ref.kind) {
    case "general":
    case "calendar":
      return true
    case "context":
      return state.contexts[ref.id] !== undefined
    case "note":
      return state.notes[ref.id] !== undefined
    case "diagram":
      return state.diagrams[ref.id] !== undefined
  }
}

/**
 * Las ventanas que se pueden enseñar: las guardadas menos las que apuntan a algo
 * que ya no existe. Si la activa se ha caído, la primera que quede, o ninguna.
 *
 * ⚠️ Si no sobra nada devuelve **el mismo objeto** que recibió: así quien llama
 * sabe sin comparar campo a campo que no hay nada que guardar ni que repintar.
 */
export const guardWindows = (layout: WindowsLayout, state: AppState): WindowsLayout => {
  const siguenTodas: boolean = layout.windows.every((ref: WindowRef): boolean =>
    windowExists(ref, state),
  )
  const windows: ReadonlyArray<WindowRef> = siguenTodas
    ? layout.windows
    : layout.windows.filter((ref: WindowRef): boolean => windowExists(ref, state))

  const activaSigue: boolean =
    layout.active !== null &&
    windows.some((ref: WindowRef): boolean => layout.active !== null && sameWindow(ref, layout.active))
  const active: WindowRef | null = activaSigue ? layout.active : (windows[0] ?? null)

  return windows === layout.windows && active === layout.active ? layout : { windows, active }
}

/* ──────────────────── Editar la lista, desde las pestañas ─────────────────── */

/*
    Todas las pestañas son iguales, también el General y el calendario. Las
    ediciones van por posición, porque es lo que se toca en la fila. Ninguna comprueba que el contenido exista —lo mira el modelo
    antes de llamarlas, y la guarda después— y todas devuelven el MISMO objeto si
    no cambian nada.
*/

/**
 * Añade una pestaña al final y la deja activa. Si ya
 * estaba, sólo pasa a ella.
 */
export const addWindow = (layout: WindowsLayout, ref: WindowRef): WindowsLayout => {
  const ya: WindowRef | undefined = layout.windows.find((w: WindowRef): boolean => sameWindow(w, ref))
  if (ya !== undefined) {
    return layout.active !== null && sameWindow(layout.active, ya) ? layout : { ...layout, active: ya }
  }
  return { windows: [...layout.windows, ref], active: ref }
}

/**
 * Cierra la pestaña `i`: sólo la referencia, lo que enseñaba sigue en el
 * almacén. Si era la activa, pasa a la de su derecha, o a la de su izquierda si
 * era la última; sin ninguna, a ninguna.
 */
export const closeWindowAt = (layout: WindowsLayout, i: number): WindowsLayout => {
  const cerrada: WindowRef | undefined = layout.windows[i]
  if (cerrada === undefined) return layout
  const windows: ReadonlyArray<WindowRef> = layout.windows.filter(
    (_: WindowRef, j: number): boolean => j !== i,
  )
  const eraActiva: boolean = layout.active !== null && sameWindow(cerrada, layout.active)
  const active: WindowRef | null = eraActiva ? (windows[i] ?? windows[i - 1] ?? null) : layout.active
  return { windows, active }
}

/**
 * Lleva la pestaña `de` al puesto `a`, corriendo las de en medio. La activa no
 * cambia.
 */
export const moveWindow = (layout: WindowsLayout, de: number, a: number): WindowsLayout => {
  const movida: WindowRef | undefined = layout.windows[de]
  if (movida === undefined || de === a || a < 0 || a >= layout.windows.length) return layout
  const sin: ReadonlyArray<WindowRef> = layout.windows.filter(
    (_: WindowRef, j: number): boolean => j !== de,
  )
  const windows: ReadonlyArray<WindowRef> = [...sin.slice(0, a), movida, ...sin.slice(a)]
  return { windows, active: layout.active }
}

/* ───────────────────── De lo guardado a una lista válida ─────────────────── */

const esObjeto = (x: unknown): x is Record<string, unknown> =>
  typeof x === "object" && x !== null && !Array.isArray(x)

/** Una referencia leída, o `null` si no tiene forma de ninguna. */
const refDe = (x: unknown): WindowRef | null => {
  if (!esObjeto(x)) return null
  if (x["kind"] === "general") return GENERAL
  if (x["kind"] === "calendar") return CALENDAR
  if (x["kind"] === "context" && typeof x["id"] === "string") {
    return { kind: "context", id: contextId(x["id"]) }
  }
  if (x["kind"] === "note" && typeof x["id"] === "string") {
    return { kind: "note", id: noteId(x["id"]) }
  }
  if (x["kind"] === "diagram" && typeof x["id"] === "string") {
    return { kind: "diagram", id: diagramId(x["id"]) }
  }
  return null
}

/**
 * Lo que se leyó de `localStorage`, convertido en una lista. Lo que no tenga
 * forma de ventana se descarta de una en una; si el conjunto no tiene forma de
 * lista, se empieza como la primera vez. No valida que existan: eso es la guarda.
 */
export const parseWindowsLayout = (guardado: unknown): WindowsLayout => {
  if (!esObjeto(guardado) || !Array.isArray(guardado["windows"])) return DEFAULT_LAYOUT

  const windows: ReadonlyArray<WindowRef> = guardado["windows"]
    .map(refDe)
    .filter((ref: WindowRef | null): ref is WindowRef => ref !== null)
    /* Un calendario repetido, a mano o en una copia, se queda en el primero. */
    .filter((ref: WindowRef, i: number, todas: ReadonlyArray<WindowRef>): boolean =>
      ref.kind !== "calendar" || todas.findIndex((w: WindowRef): boolean => w.kind === "calendar") === i,
    )
  return { windows, active: refDe(guardado["active"]) }
}
