/**
 * La línea activa del editor partida en partes: cada enlace guardado es un
 * bloque con su texto, y el resto de la línea sigue en crudo. Lleva también las
 * posiciones entre el DOM de esa línea (parte y desplazamiento) y la cadena
 * cruda. Puro: ni DOM ni core.
 */

import type { EmphasisRun, FormattedLine, LineLink, LineSpan } from "./markdownLine.js"
import { readMarkdownLine, visibleText } from "./markdownLine.js"

/** Un trozo de texto crudo, tal como se escribió. */
export interface TextPart {
  readonly kind: "text"
  /** Siempre `raw.slice(start, end)` de la línea. */
  readonly raw: string
  readonly start: number
  readonly end: number
  /** Si está dentro de algún par de negrita / de cursiva. */
  readonly bold: boolean
  readonly italic: boolean
  /** Índice en `runs` del par más interno que lo contiene, o `null`. */
  readonly run: number | null
}

/** Una marca de énfasis (`**` o `*`), que se esconde salvo con el cursor en su par. */
export interface MarkPart {
  readonly kind: "mark"
  /** Siempre `raw.slice(start, end)` de la línea. */
  readonly raw: string
  readonly start: number
  readonly end: number
  /** Índice en `runs` del par al que pertenece. */
  readonly run: number
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

export type ActivePart = TextPart | MarkPart | LinkPart

/** La línea activa partida, con los pares de énfasis a los que apuntan sus partes. */
export interface ActiveLine {
  readonly partes: ReadonlyArray<ActivePart>
  readonly runs: ReadonlyArray<EmphasisRun>
}

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
    runs: [],
    spans: line.spans.filter(
      (s: LineSpan): boolean => s.kind === "text" && s.link === link,
    ),
  })

// Los pares que contienen [start, end) entre sus marcas, el más interno el último.
const paresQueContienen = (runs: ReadonlyArray<EmphasisRun>, start: number, end: number): number[] => {
  const dentro: number[] = []
  runs.forEach((r: EmphasisRun, i: number): void => {
    if (r.openEnd <= start && end <= r.closeStart) dentro.push(i)
  })
  return dentro
}

/**
 * Parte la línea en partes seguidas, sin huecos ni solapes y ninguna vacía: cada
 * enlace guardado es una parte `link`; cada marca de énfasis, una parte `mark`;
 * lo demás, también las direcciones sueltas, el `# ` y las barras, va en partes
 * `text` con su cadena cruda y su estilo. Una línea vacía no tiene partes.
 */
export const activeLine = (raw: string): ActiveLine => {
  const line: FormattedLine = readMarkdownLine(raw)
  const runs: ReadonlyArray<EmphasisRun> = line.runs
  const partes: ActivePart[] = []
  const marcaDe: Map<number, number> = new Map<number, number>()
  runs.forEach((r: EmphasisRun, i: number): void => {
    marcaDe.set(r.start, i)
    marcaDe.set(r.closeStart, i)
  })
  const guardados: ReadonlyArray<LineLink> = line.links.filter((l: LineLink): boolean => l.saved)
  const texto = (start: number, end: number): void => {
    const dentro: number[] = paresQueContienen(runs, start, end)
    const bold: boolean = dentro.some((i: number): boolean => (runs[i] as EmphasisRun).bold)
    const italic: boolean = dentro.some((i: number): boolean => (runs[i] as EmphasisRun).italic)
    const run: number | null = dentro.length === 0 ? null : (dentro[dentro.length - 1] as number)
    const previa: ActivePart | undefined = partes[partes.length - 1]
    if (
      previa !== undefined &&
      previa.kind === "text" &&
      previa.end === start &&
      previa.bold === bold &&
      previa.italic === italic &&
      previa.run === run
    ) {
      partes[partes.length - 1] = { ...previa, end, raw: raw.slice(previa.start, end) }
    } else {
      partes.push({ kind: "text", raw: raw.slice(start, end), start, end, bold, italic, run })
    }
  }
  let hasta: number = 0
  for (const s of line.spans) {
    if (s.end <= hasta) continue
    const link: LineLink | undefined = guardados.find(
      (l: LineLink): boolean => l.start <= s.start && s.start < l.end,
    )
    if (link !== undefined) {
      partes.push({
        kind: "link",
        label: etiquetaDe(line, link),
        raw: raw.slice(link.start, link.end),
        link,
        start: link.start,
        end: link.end,
      })
      hasta = link.end
      continue
    }
    const run: number | undefined = s.kind === "mark" ? marcaDe.get(s.start) : undefined
    if (run !== undefined) {
      partes.push({ kind: "mark", raw: s.text, start: s.start, end: s.end, run })
    } else {
      texto(s.start, s.end)
    }
    hasta = s.end
  }
  return { partes, runs }
}

/** Sólo las partes de la línea activa; ver `activeLine`. */
export const activeParts = (raw: string): ReadonlyArray<ActivePart> => activeLine(raw).partes

/**
 * Los pares que muestran sus marcas: aquellos con el cursor (posición cruda) en
 * su intervalo cerrado `[start, end]`, marcas incluidas. Los que se anidan donde
 * está el cursor entran todos. `partes` no se mira: el parámetro sólo acompaña a
 * `runs`, que son los que salen de `activeLine`.
 */
export const visibleRuns = (
  _partes: ReadonlyArray<ActivePart>,
  runs: ReadonlyArray<EmphasisRun>,
  cursor: number,
): ReadonlySet<number> => {
  const visibles: Set<number> = new Set<number>()
  runs.forEach((r: EmphasisRun, i: number): void => {
    if (r.start <= cursor && cursor <= r.end) visibles.add(i)
  })
  return visibles
}

/** Cuántas posiciones ocupa la parte en el DOM: el texto, sus caracteres; un enlace, los de su etiqueta. */
export const visibleLength = (parte: ActivePart): number =>
  parte.kind === "link" ? parte.label.length : parte.raw.length

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
    if (p.kind !== "link") return { partIndex: i, offset: raw - p.start }
    return alBorde(i, p.end - raw <= raw - p.start)
  }
  const ultima: ActivePart = partes[partes.length - 1] as ActivePart
  return ultima.kind === "link"
    ? alBorde(partes.length - 1, true)
    : { partIndex: partes.length - 1, offset: ultima.raw.length }
}
