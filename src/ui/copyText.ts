/**
 * Lo que se copia de una nota: el texto que toca la selección, tal como se ve,
 * una línea por renglón y sin las marcas de casilla ni las de formato. Puro: el
 * editor le dice en qué línea y en qué letra de lo que se ve empieza y acaba, y
 * qué línea se ve en crudo; las líneas se recorren en el orden en que se leen,
 * las hijas detrás de su casilla.
 */

import type { Content, ContentId } from "#core/index"
import type { Caret } from "./editor.js"
import { readMarkdownLine, visibleText } from "./markdownLine.js"
import { inReadingOrder } from "./noteTree.js"

/**
 * El texto entre `desde` y `hasta`, cuyos `offset` cuentan lo que se ve: en la
 * línea `enCrudo`, la cadena tal cual; en las demás, sin las marcas de formato.
 * Vacío si alguno no está o van al revés.
 */
export const copiedText = (
  content: ReadonlyArray<Content>,
  desde: Caret,
  hasta: Caret,
  enCrudo: ContentId | null,
): string => {
  const lineas: ReadonlyArray<Content> = inReadingOrder(content)
  const primera: number = lineas.findIndex((l: Content): boolean => l.id === desde.line)
  const ultima: number = lineas.findIndex((l: Content): boolean => l.id === hasta.line)
  if (primera === -1 || ultima === -1 || primera > ultima) return ""
  const comoSeVe = (l: Content): string =>
    l.id === enCrudo ? l.text : visibleText(readMarkdownLine(l.text))
  const tramo: ReadonlyArray<Content> = lineas.slice(primera, ultima + 1)
  if (primera === ultima) {
    const unica: Content | undefined = tramo[0]
    return unica === undefined ? "" : comoSeVe(unica).slice(desde.offset, hasta.offset)
  }
  return tramo
    .map((l: Content, n: number): string => {
      const texto: string = comoSeVe(l)
      if (n === 0) return texto.slice(desde.offset)
      if (n === ultima - primera) return texto.slice(0, hasta.offset)
      return texto
    })
    .join("\n")
}
