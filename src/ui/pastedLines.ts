/**
 * Lo pegado en una nota, leído como líneas: cada renglón, una. El que empieza por
 * `- [ ]` o `- [x]` (también con `*` o `X`) es una casilla, y cuelga de la casilla
 * de encima que vaya menos sangrada; cualquier otro, un texto en la raíz, tal
 * cual. Lo que copia el editor de una línea a otra se lee así de vuelta, y una
 * lista de Markdown de fuera, también. Puro.
 */

import type { CheckBoxDraft, ContentDraft } from "#core/index"

/** Un renglón leído: su sangría, y si es casilla, su marca. */
interface Renglon {
  readonly sangria: number
  readonly casilla: boolean
  readonly checked: boolean
  readonly texto: string
}

const CASILLA: RegExp = /^([ \t]*)[-*] \[([ xX])\](?: (.*))?$/

/** Un tabulador sangra como dos espacios, lo que pone el editor por nivel. */
const sangria = (blancos: string): number =>
  [...blancos].reduce((n: number, c: string): number => n + (c === "\t" ? 2 : 1), 0)

const leer = (renglon: string): Renglon => {
  const m: RegExpExecArray | null = CASILLA.exec(renglon)
  if (m === null) return { sangria: 0, casilla: false, checked: false, texto: renglon }
  return { sangria: sangria(m[1] ?? ""), casilla: true, checked: m[2] !== " ", texto: m[3] ?? "" }
}

/**
 * Dónde acaba el árbol de la casilla `i`: en el primer renglón que no va más
 * sangrado que ella, o que es un texto.
 */
const finDe = (renglones: ReadonlyArray<Renglon>, i: number): number => {
  const sangriaPropia: number = renglones[i]?.sangria ?? 0
  let j: number = i + 1
  while (renglones[j]?.casilla === true && (renglones[j]?.sangria ?? 0) > sangriaPropia) j += 1
  return j
}

/**
 * Las líneas de los renglones `[desde, hasta)`, del mismo nivel: cada texto
 * suelto, y cada casilla con las que cuelgan de ella. Las hermanas se recorren en
 * bucle y sólo se baja un nivel por anidado, para que una lista de miles de
 * renglones no agote la pila (miles de niveles de anidado, sí lo harían).
 */
function* nivel(renglones: ReadonlyArray<Renglon>, desde: number, hasta: number): Generator<ContentDraft> {
  let k: number = desde
  while (k < hasta) {
    const r: Renglon | undefined = renglones[k]
    if (r === undefined) return
    if (!r.casilla) {
      yield { type: "text", text: r.texto }
      k += 1
      continue
    }
    const fin: number = finDe(renglones, k)
    const hijas: ReadonlyArray<CheckBoxDraft> = [...nivel(renglones, k + 1, fin)].filter(
      (h: ContentDraft): h is CheckBoxDraft => h.type === "checkbox",
    )
    yield { type: "checkbox", text: r.texto, checked: r.checked, children: hijas }
    k = fin
  }
}

/** Las líneas de lo pegado. Los renglones vacíos del final no cuentan; los de en medio, sí. */
export const pastedLines = (pegado: string): ReadonlyArray<ContentDraft> => {
  const renglones: ReadonlyArray<string> = pegado.replace(/(\r?\n)+$/, "").split(/\r?\n/)
  const leidos: ReadonlyArray<Renglon> = renglones.map(leer)
  return [...nivel(leidos, 0, leidos.length)]
}

/** ¿Es lo pegado un solo texto, que entra dentro de la línea como hasta ahora? */
export const isInlinePaste = (lineas: ReadonlyArray<ContentDraft>): boolean =>
  lineas.length === 1 && lineas[0]?.type === "text"
