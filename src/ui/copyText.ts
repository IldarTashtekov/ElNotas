/**
 * Lo que se copia de una nota. Dentro de una línea, el trozo seleccionado, tal
 * como se ve. De una línea a otra, las líneas enteras como se guardan, una por
 * renglón, cada casilla con su marca y las hijas sangradas, que es lo que el
 * editor sabe volver a pegar. Puro: el editor le dice en qué línea y en qué letra
 * de lo que se ve empieza y acaba, y qué línea se ve en crudo.
 */

import type { Content, ContentId } from "#core/index"
import { isCheckBox } from "#core/index"
import type { Caret } from "./editor.js"
import { readMarkdownLine, visibleText } from "./markdownLine.js"

/** Una línea con su profundidad: 0 en la raíz, 1 la hija, y así. */
interface Renglon {
  readonly linea: Content
  readonly hondura: number
}

/** Todas las líneas en el orden en que se leen, cada una con su profundidad. */
const renglones = (content: ReadonlyArray<Content>, hondura: number): ReadonlyArray<Renglon> =>
  content.flatMap((linea: Content): ReadonlyArray<Renglon> => [
    { linea, hondura },
    ...(isCheckBox(linea) ? renglones(linea.children, hondura + 1) : []),
  ])

/** La línea entera como se pega: una casilla, con su marca y sangrada dos espacios por nivel. */
const comoSePega = ({ linea, hondura }: Renglon, base: number): string =>
  isCheckBox(linea) ? `${"  ".repeat(hondura - base)}- [${linea.checked ? "x" : " "}] ${linea.text}` : linea.text

/**
 * El texto entre `desde` y `hasta`. Dentro de una línea, sus `offset` cuentan lo
 * que se ve: en la línea `enCrudo`, la cadena tal cual; en las demás, sin las
 * marcas de formato. De una línea a otra, van las líneas enteras, sangradas desde
 * la menos honda. Vacío si alguno no está o van al revés.
 */
export const copiedText = (
  content: ReadonlyArray<Content>,
  desde: Caret,
  hasta: Caret,
  enCrudo: ContentId | null,
): string => {
  const todos: ReadonlyArray<Renglon> = renglones(content, 0)
  const primera: number = todos.findIndex((r: Renglon): boolean => r.linea.id === desde.line)
  const ultima: number = todos.findIndex((r: Renglon): boolean => r.linea.id === hasta.line)
  if (primera === -1 || ultima === -1 || primera > ultima) return ""
  const tramo: ReadonlyArray<Renglon> = todos.slice(primera, ultima + 1)
  const [unica] = tramo
  if (primera === ultima && unica !== undefined) {
    const l: Content = unica.linea
    const comoSeVe: string = l.id === enCrudo ? l.text : visibleText(readMarkdownLine(l.text))
    return comoSeVe.slice(desde.offset, hasta.offset)
  }
  const base: number = Math.min(...tramo.map((r: Renglon): number => r.hondura))
  return tramo.map((r: Renglon): string => comoSePega(r, base)).join("\n")
}
