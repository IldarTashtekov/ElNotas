/**
 * Lo que se copia de una nota: el texto que toca la selección, una línea por
 * renglón y sin las marcas de casilla. Puro: el editor le dice en qué línea y
 * en qué letra empieza y acaba, y las líneas se recorren en el orden en que se
 * leen, las hijas detrás de su casilla.
 */

import type { Content } from "#core/index"
import type { Caret } from "./editor.js"
import { inReadingOrder } from "./noteTree.js"

/** El texto entre `desde` y `hasta`. Vacío si alguno no está o van al revés. */
export const copiedText = (
  content: ReadonlyArray<Content>,
  desde: Caret,
  hasta: Caret,
): string => {
  const lineas: ReadonlyArray<Content> = inReadingOrder(content)
  const primera: number = lineas.findIndex((l: Content): boolean => l.id === desde.line)
  const ultima: number = lineas.findIndex((l: Content): boolean => l.id === hasta.line)
  if (primera === -1 || ultima === -1 || primera > ultima) return ""
  if (primera === ultima) return lineas[primera]?.text.slice(desde.offset, hasta.offset) ?? ""
  return lineas
    .slice(primera, ultima + 1)
    .map((l: Content, n: number): string => {
      if (n === 0) return l.text.slice(desde.offset)
      if (n === ultima - primera) return l.text.slice(0, hasta.offset)
      return l.text
    })
    .join("\n")
}
