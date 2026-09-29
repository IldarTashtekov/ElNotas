/**
 * Las ventanas: qué hay en la vista principal y en qué orden, y cuál está activa.
 *
 * Una ventana es sólo una referencia a lo que enseña. La lista vive fuera del
 * core, así que puede apuntar a un contexto que ya se borró: la guarda de aquí
 * calcula las ventanas que se pueden enseñar y deja fuera las rotas.
 *
 * Todo es puro: se prueba en Node sin navegador.
 */

import type { AppState, ContextId } from "#core/index"
import { contextId } from "#core/index"

/** Lo que enseña una ventana. Las de tipo nota llegan con el editor. */
export type WindowRef =
  | { readonly kind: "general" }
  | { readonly kind: "context"; readonly id: ContextId }

export interface WindowsLayout {
  readonly windows: ReadonlyArray<WindowRef>
  /** Referencia y no índice: un índice señalaría a otra al quitar una anterior. */
  readonly active: WindowRef | null
}

export const GENERAL: WindowRef = { kind: "general" }

/** Lo que se ve la primera vez, sin nada guardado: la ventana del General. */
export const DEFAULT_LAYOUT: WindowsLayout = { windows: [GENERAL], active: GENERAL }

export const sameWindow = (a: WindowRef, b: WindowRef): boolean =>
  a.kind === "general" ? b.kind === "general" : b.kind === "context" && a.id === b.id

const existe = (ref: WindowRef, state: AppState): boolean =>
  ref.kind === "general" || state.contexts[ref.id] !== undefined

/**
 * Las ventanas que se pueden enseñar: las guardadas menos las que apuntan a algo
 * que ya no existe. Si la activa se ha caído, la primera que quede, o ninguna.
 *
 * ⚠️ Si no sobra nada devuelve **el mismo objeto** que recibió: así quien llama
 * sabe sin comparar campo a campo que no hay nada que guardar ni que repintar.
 */
export const guardWindows = (layout: WindowsLayout, state: AppState): WindowsLayout => {
  const siguenTodas: boolean = layout.windows.every((ref: WindowRef): boolean =>
    existe(ref, state),
  )
  const windows: ReadonlyArray<WindowRef> = siguenTodas
    ? layout.windows
    : layout.windows.filter((ref: WindowRef): boolean => existe(ref, state))

  const activaSigue: boolean =
    layout.active !== null &&
    windows.some((ref: WindowRef): boolean => layout.active !== null && sameWindow(ref, layout.active))
  const active: WindowRef | null = activaSigue ? layout.active : (windows[0] ?? null)

  return windows === layout.windows && active === layout.active ? layout : { windows, active }
}

/* ───────────────────── De lo guardado a una lista válida ─────────────────── */

const esObjeto = (x: unknown): x is Record<string, unknown> =>
  typeof x === "object" && x !== null && !Array.isArray(x)

/** Una referencia leída, o `null` si no tiene forma de ninguna. */
const refDe = (x: unknown): WindowRef | null => {
  if (!esObjeto(x)) return null
  if (x["kind"] === "general") return GENERAL
  if (x["kind"] === "context" && typeof x["id"] === "string") {
    return { kind: "context", id: contextId(x["id"]) }
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
  return { windows, active: refDe(guardado["active"]) }
}
