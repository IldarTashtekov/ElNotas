/**
 * Lo que es un nodo del lienzo, leído de su texto guardado: un texto, o un enlace
 * entero. En el lienzo no se ve ni se escribe Markdown: aquí se decide qué se
 * enseña de un nodo, a qué lleva y qué se guarda cuando se cambia lo que se ve.
 * Puro: ni DOM ni core más allá de leer el estado.
 */

import type { AppState } from "#core/index"
import { buildLink } from "#core/index"
import type { ResolvedLink } from "./linkActions.js"
import { resolveLink } from "./linkActions.js"
import type { FormattedLine, LineLink, LineSpan, LinkTarget } from "./markdownLine.js"
import { readMarkdownLine } from "./markdownLine.js"

/** Un nodo, como se ve. */
export type NodeContent =
  | { readonly kind: "text"; readonly text: string }
  | {
      readonly kind: "link"
      /** Lo que se ve: el nombre de ahora de lo enlazado; si es una web o está roto, el texto del enlace. */
      readonly text: string
      readonly target: LinkTarget
      /** A qué lleva, si es interno y existe; `null` si es una web o está roto. */
      readonly resolved: ResolvedLink
      /** Interno y lo enlazado ya no está. */
      readonly broken: boolean
      /** El destino tal como está escrito, para volver a escribir el enlace. */
      readonly destination: string
    }

/* Lo que el lector de Markdown toma por marca si va sin barra. */
const ESPECIALES: RegExp = /[\\*[\]()#]/g
const ESCAPADO: RegExp = /\\([\\*[\]()#])/g

/** El texto de un nodo de texto tal como se guarda: lo escrito, con sus símbolos escapados. */
export const textNodeText = (texto: string): string => texto.replace(ESPECIALES, "\\$&")

/** El nombre de ahora de algo de la app. */
const nombreDe = (state: AppState, destino: NonNullable<ResolvedLink>): string => {
  switch (destino.kind) {
    case "note":
      return state.notes[destino.id]?.name ?? ""
    case "diagram":
      return state.diagrams[destino.id]?.name ?? ""
    case "event":
      return state.events[destino.id]?.title ?? ""
    case "routine":
      return state.routines[destino.id]?.name ?? ""
  }
}

/** El único enlace guardado de la línea, si ocupa todo su texto salvo los espacios de los bordes. */
const enlaceEntero = (linea: FormattedLine, raw: string): LineLink | null => {
  const unico: LineLink | undefined = linea.links[0]
  if (linea.links.length !== 1 || unico === undefined || !unico.saved) return null
  const ini: number = raw.length - raw.trimStart().length
  return unico.start === ini && unico.end === raw.trimEnd().length ? unico : null
}

export const readNode = (state: AppState, raw: string): NodeContent => {
  const comoTexto: NodeContent = { kind: "text", text: raw.replace(ESCAPADO, "$1") }
  if (raw.includes("\n")) return comoTexto
  const linea: FormattedLine = readMarkdownLine(raw)
  const enlace: LineLink | null = enlaceEntero(linea, raw)
  /* La última marca del enlace es la que lo cierra: `](destino)`. */
  const cierre: LineSpan | undefined = linea.spans.find(
    (s: LineSpan): boolean => s.kind === "mark" && enlace !== null && s.start > enlace.start && s.end === enlace.end,
  )
  if (enlace === null || cierre === undefined) return comoTexto
  const visible: string = linea.spans
    .filter((s: LineSpan): boolean => s.kind === "text" && s.link === enlace)
    .map((s: LineSpan): string => s.text)
    .join("")
  const destination: string = cierre.text.slice(2, -1)
  if (enlace.target.kind === "web") {
    return { kind: "link", text: visible, target: enlace.target, resolved: null, broken: false, destination }
  }
  const resolved: ResolvedLink = resolveLink(state, enlace.target.id)
  return {
    kind: "link",
    text: resolved === null ? visible : nombreDe(state, resolved),
    target: enlace.target,
    resolved,
    broken: resolved === null,
    destination,
  }
}

/**
 * Lo que se guarda al cambiar lo que se ve de un nodo. Uno de texto, el texto
 * escapado; uno que enlaza a una web, el mismo enlace con el texto nuevo. Uno que
 * enlaza a algo de la app enseña su nombre, no un texto propio: no cambia.
 */
export const editedNodeText = (state: AppState, raw: string, visible: string): string => {
  const nodo: NodeContent = readNode(state, raw)
  if (nodo.kind === "text") return textNodeText(visible)
  if (nodo.target.kind === "internal") return raw
  return buildLink(visible, nodo.destination) ?? raw
}

/** Si «Editar» tiene algo que cambiar: en uno que enlaza a algo de la app, no. */
export const canEditNodeText = (nodo: NodeContent): boolean =>
  nodo.kind === "text" || nodo.target.kind === "web"
