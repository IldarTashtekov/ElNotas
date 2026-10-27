/**
 * Lo que se hace con los enlaces de una línea de nota: saber a qué lleva uno
 * interno, cuál hay bajo el cursor, cómo se quita su marca dejando el texto,
 * qué se puede enlazar, cómo se escribe un enlace, qué texto lleva por defecto y
 * cómo se cambia.
 * Puro: ni DOM ni core más allá de leer el estado.
 */

import type { AppState, Diagram, DiagramId, Note, NoteId } from "#core/index"
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

/** Si es una dirección web que se puede enlazar: `http://`, `https://` o `www.` y algo detrás, sin espacios. */
export const isWebAddress = (texto: string): boolean =>
  /^(https?:\/\/|www\.)\S+$/i.test(texto.trim())

/** Una nota o un diagrama que se puede enlazar, con el nombre que se enseña. */
export interface LinkChoices {
  readonly notes: ReadonlyArray<{ readonly id: NoteId; readonly name: string }>
  readonly diagrams: ReadonlyArray<{ readonly id: DiagramId; readonly name: string }>
}

const porNombre = (a: { readonly name: string }, b: { readonly name: string }): number =>
  a.name.localeCompare(b.name, "es", { sensitivity: "base" })

/**
 * A qué se puede enlazar desde la nota `excluding`: las demás notas y todos los
 * diagramas, por nombre. Los contextos, por ahora, no.
 */
export const linkChoices = (state: AppState, excluding: NoteId): LinkChoices => ({
  notes: Object.values(state.notes)
    .filter((n: Note): boolean => n.id !== excluding)
    .map((n: Note): { readonly id: NoteId; readonly name: string } => ({ id: n.id, name: n.name }))
    .sort(porNombre),
  diagrams: Object.values(state.diagrams)
    .map((d: Diagram): { readonly id: DiagramId; readonly name: string } => ({ id: d.id, name: d.name }))
    .sort(porNombre),
})

/**
 * `[texto](destino)`, con el texto escapado (`\`, `[`, `]` y `*` llevan una barra
 * delante) y «enlace» si el texto está en blanco. El destino se escribe tal cual:
 * quien llama lo da bien (un id, o una dirección que pasó `isWebAddress`). Un `)`
 * en el destino lo cerraría antes de tiempo: no se enlaza y vuelve `null`.
 */
export const buildLink = (texto: string, destino: string): string | null => {
  if (destino.includes(")")) return null
  const visible: string = texto.trim() === "" ? "enlace" : texto
  return `[${visible.replace(/[\\[\]*]/g, "\\$&")}](${destino})`
}

/**
 * Cambia el destino de un enlace guardado y deja su texto como estaba:
 * `[texto](viejo)` pasa a `[texto](destino)`, y el cursor queda tras el enlace.
 * Un enlace no guardado, que no está en la línea, o un destino con `)`, no
 * cambia nada.
 */
export const changeLinkTarget = (
  raw: string,
  line: FormattedLine,
  link: LineLink,
  destino: string,
): { readonly text: string; readonly cursor: number } => {
  if (!link.saved || destino.includes(")")) return { text: raw, cursor: link.end }
  /* La última marca del enlace es `](viejo)`, como en `removeLink`. */
  const cierre: LineSpan | undefined = line.spans.find(
    (s: LineSpan): boolean => s.kind === "mark" && s.start > link.start && s.end === link.end,
  )
  if (cierre === undefined) return { text: raw, cursor: link.end }
  const nuevaMarca: string = `](${destino})`
  return {
    text: raw.slice(0, cierre.start) + nuevaMarca + raw.slice(link.end),
    cursor: cierre.start + nuevaMarca.length,
  }
}

/**
 * El texto que lleva un enlace nuevo si nadie escribe otro. Una web, su host sin
 * `www.` ni puerto ni ruta; un enlace interno, el nombre de lo enlazado. Lo que no
 * se puede sacar, «enlace».
 */
export const defaultLinkText = (destino: string, nombre?: string): string => {
  const limpio: string = destino.trim()
  if (/^(https?:\/\/|www\.)/i.test(limpio)) {
    const host: string =
      /^(?:https?:\/\/)?(?:[^\s/?#@]*@)?([^\s/?#:]*)/i.exec(limpio)?.[1]?.replace(/^www\./i, "") ?? ""
    return host === "" ? "enlace" : host
  }
  return nombre !== undefined && nombre.trim() !== "" ? nombre : "enlace"
}

/**
 * Reescribe un enlace guardado con otro texto y otro destino (`buildLink`) y deja
 * el cursor justo tras él. Un enlace no guardado, que no está en la línea, o que
 * no se puede construir (un `)` en el destino), no cambia nada.
 */
export const changeLink = (
  raw: string,
  line: FormattedLine,
  link: LineLink,
  texto: string,
  destino: string,
): { readonly text: string; readonly cursor: number } => {
  const sinCambios: { readonly text: string; readonly cursor: number } = { text: raw, cursor: link.end }
  const enLinea: boolean = line.links.some(
    (l: LineLink): boolean => l.saved && l.start === link.start && l.end === link.end,
  )
  if (!link.saved || !enLinea) return sinCambios
  const nuevo: string | null = buildLink(texto, destino)
  if (nuevo === null) return sinCambios
  return {
    text: raw.slice(0, link.start) + nuevo + raw.slice(link.end),
    cursor: link.start + nuevo.length,
  }
}
