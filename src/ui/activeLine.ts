/**
 * La línea activa del editor partida en partes: cada enlace guardado es un
 * bloque con su texto, y el resto de la línea sigue en crudo. Lleva también las
 * posiciones entre el DOM de esa línea (parte y desplazamiento) y la cadena
 * cruda. Puro: ni DOM ni core.
 */

import type { FormattedLine, LineLink, LineSpan } from "./markdownLine.js"
import { readMarkdownLine, visibleText } from "./markdownLine.js"

/** Un trozo de texto crudo, tal como se escribió. */
export interface TextPart {
  readonly kind: "text"
  /** Siempre `raw.slice(start, end)` de la línea. */
  readonly raw: string
  readonly start: number
  readonly end: number
}

/** Un enlace guardado, que se ve como un bloque con su texto. */
export interface LinkPart {
  readonly kind: "link"
  /** Lo que se ve del enlace: su texto, sin `\`, `*` ni marcas. */
  readonly label: string
  /** Siempre `raw.slice(start, end)` de la línea: `[texto](destino)` entero. */
  readonly raw: string
  readonly link: LineLink
  readonly start: number
  readonly end: number
}

export type ActivePart = TextPart | LinkPart

/** Un sitio dentro del DOM de la línea activa: parte y desplazamiento en ella. */
export interface DomPosition {
  readonly partIndex: number
  /** Texto: de 0 a `raw.length`. Bloque: 0 = antes, 1 = después. */
  readonly offset: number
  /** Sólo en un bloque: de qué lado queda el cursor. */
  readonly side?: "before" | "after"
}

// Lo que se ve de un enlace: sus tramos de texto, los que apuntan a ese mismo objeto.
const etiquetaDe = (line: FormattedLine, link: LineLink): string =>
  visibleText({
    heading: false,
    links: [],
    spans: line.spans.filter(
      (s: LineSpan): boolean => s.kind === "text" && s.link === link,
    ),
  })

/**
 * Parte la línea en partes seguidas, sin huecos ni solapes y ninguna vacía: cada
 * enlace guardado es una parte `link`; lo demás, también las direcciones sueltas,
 * va en partes `text` con su cadena cruda. Una línea vacía no tiene partes.
 */
export const activeParts = (raw: string): ReadonlyArray<ActivePart> => {
  const line: FormattedLine = readMarkdownLine(raw)
  const partes: ActivePart[] = []
  const texto = (start: number, end: number): void => {
    if (end > start) partes.push({ kind: "text", raw: raw.slice(start, end), start, end })
  }
  let desde: number = 0
  for (const link of line.links) {
    if (!link.saved || link.start < desde) continue
    texto(desde, link.start)
    partes.push({
      kind: "link",
      label: etiquetaDe(line, link),
      raw: raw.slice(link.start, link.end),
      link,
      start: link.start,
      end: link.end,
    })
    desde = link.end
  }
  texto(desde, raw.length)
  return partes
}

/** Cuántas posiciones ocupa la parte en el DOM: el texto, sus caracteres; un enlace, los de su etiqueta. */
export const visibleLength = (parte: ActivePart): number =>
  parte.kind === "text" ? parte.raw.length : parte.label.length

/**
 * De una posición en el DOM a la de la cadena cruda. Una parte que no existe cae
 * al principio (índice negativo) o al final (pasado de largo); un
 * desplazamiento fuera de la parte se recorta a ella.
 */
export const domToRaw = (partes: ReadonlyArray<ActivePart>, dentro: DomPosition): number => {
  const ultima: ActivePart | undefined = partes[partes.length - 1]
  if (ultima === undefined) return 0
  const parte: ActivePart | undefined = partes[dentro.partIndex]
  if (parte === undefined) return dentro.partIndex < 0 ? 0 : ultima.end
  if (parte.kind === "link") return dentro.offset <= 0 ? parte.start : parte.end
  return parte.start + Math.max(0, Math.min(dentro.offset, parte.raw.length))
}

/**
 * De una posición en la cadena cruda a la del DOM. Dentro de un enlace (estrictamente
 * entre su principio y su final) va al borde más cercano, y en un empate al final.
 * En el límite entre dos partes manda la de la izquierda; el principio de la línea,
 * la primera. Más allá del final, el final.
 */
export const rawToDom = (partes: ReadonlyArray<ActivePart>, raw: number): DomPosition => {
  const primera: ActivePart | undefined = partes[0]
  if (primera === undefined) return { partIndex: 0, offset: 0 }
  const alBorde = (i: number, final: boolean): DomPosition =>
    final
      ? { partIndex: i, offset: 1, side: "after" }
      : { partIndex: i, offset: 0, side: "before" }
  if (raw <= primera.start) {
    return primera.kind === "link" ? alBorde(0, false) : { partIndex: 0, offset: 0 }
  }
  for (let i: number = 0; i < partes.length; i++) {
    const p: ActivePart = partes[i] as ActivePart
    if (raw > p.end) continue
    if (p.kind === "text") return { partIndex: i, offset: raw - p.start }
    return alBorde(i, p.end - raw <= raw - p.start)
  }
  const ultima: ActivePart = partes[partes.length - 1] as ActivePart
  return ultima.kind === "link"
    ? alBorde(partes.length - 1, true)
    : { partIndex: partes.length - 1, offset: ultima.raw.length }
}
