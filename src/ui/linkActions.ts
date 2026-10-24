/**
 * Lo que se hace con los enlaces de una línea de nota: saber a qué lleva uno
 * interno, cuál hay bajo el cursor y cómo se quita su marca dejando el texto.
 * Puro: ni DOM ni core más allá de leer el estado.
 */

import type { AppState, DiagramId, NoteId } from "#core/index"
import { diagramId, noteId } from "#core/index"
import type { FormattedLine, LineLink, LineSpan } from "./markdownLine.js"

/** Lo que hay detrás de un enlace interno, o `null` si está roto. */
export type ResolvedLink =
  | { readonly kind: "note"; readonly id: NoteId }
  | { readonly kind: "diagram"; readonly id: DiagramId }
  | null

// `id` sale del texto de una nota: "constructor" o "__proto__" no son claves del almacén.
const tiene = (registro: object, id: string): boolean =>
  Object.prototype.hasOwnProperty.call(registro, id)

/**
 * A qué lleva el `#id` de un enlace. Un contexto, que por ahora no se puede
 * enlazar, o lo que ya no existe, es un enlace roto.
 */
export const resolveLink = (state: AppState, id: string): ResolvedLink => {
  if (tiene(state.notes, id)) return { kind: "note", id: noteId(id) }
  if (tiene(state.diagrams, id)) return { kind: "diagram", id: diagramId(id) }
  return null
}

/** El enlace con el cursor ESTRICTAMENTE dentro (en la cadena cruda), o `null`. */
export const linkAtCursor = (line: FormattedLine, offset: number): LineLink | null =>
  line.links.find((l: LineLink): boolean => l.start < offset && offset < l.end) ?? null

/**
 * Quita la marca de un enlace guardado y deja su texto: `[texto](destino)` pasa
 * a `texto`, tal como se escribió (con sus escapes y sus marcas de dentro), y el
 * cursor queda al final de ese texto. Un enlace no guardado, o que no está en la
 * línea, no cambia nada.
 */
export const removeLink = (
  raw: string,
  line: FormattedLine,
  link: LineLink,
  cursor: number,
): { readonly text: string; readonly cursor: number } => {
  if (!link.saved) return { text: raw, cursor }
  /* La última marca del enlace es la que cierra `](destino)`: donde acaba su texto. */
  const cierre: LineSpan | undefined = line.spans.find(
    (s: LineSpan): boolean => s.kind === "mark" && s.start > link.start && s.end === link.end,
  )
  if (cierre === undefined) return { text: raw, cursor }
  const dentro: string = raw.slice(link.start + 1, cierre.start)
  return {
    text: raw.slice(0, link.start) + dentro + raw.slice(link.end),
    cursor: link.start + dentro.length,
  }
}
