/**
 * Lo que hace cada tecla y cada botón del editor: Intro, Retroceso al principio
 * de una línea, el interruptor de casilla, anidar, marcar, pegar líneas y borrar
 * una selección de varias.
 *
 * Cada acción ejecuta las operaciones que tocan —con los casos de uso, sin tocar
 * el core— y devuelve dónde queda el cursor y cómo queda el modo. No sabe nada
 * del DOM, así que se prueba en Node, tecla a tecla y caso a caso.
 */

import type { Content, ContentDraft, ContentId, Note, NoteId, Position, UseCases } from "#core/index"
import { after, before, isCheckBox, lastChildOf, rootEnd } from "#core/index"
import type { Located } from "./noteTree.js"
import { inReadingOrder, locate, mergeTarget, nextSibling, rootAncestor } from "./noteTree.js"
import type { Cut } from "./markdownLine.js"
import { cutAfter, cutBefore, joinCuts, readMarkdownLine, withoutVisible } from "./markdownLine.js"
import type { WritingMode } from "./writingMode.js"

/** Dónde está el cursor: en qué línea y tras cuántos caracteres. */
export interface Caret {
  readonly line: ContentId
  readonly offset: number
}

export interface EditorDeps {
  readonly useCases: UseCases
  readonly noteId: NoteId
  /** La nota como está ahora, que cambia con cada operación. */
  readonly note: () => Note | undefined
}

/** Lo que queda tras una acción. `caret` es `null` si no hay línea donde ponerlo. */
export interface EditResult {
  readonly caret: Caret | null
  readonly mode: WritingMode
}

const contenido = (deps: EditorDeps): ReadonlyArray<Content> => deps.note()?.content ?? []

/** La última hija de una casilla, que es donde nace una línea anidada. */
const ultimaHija = (content: ReadonlyArray<Content>, id: ContentId): Content | null => {
  const madre: Content | undefined = locate(content, id)?.line
  return madre !== undefined && isCheckBox(madre) ? (madre.children[madre.children.length - 1] ?? null) : null
}

/** Parte la línea y deja la mitad nueva de la clase que diga el interruptor. */
const partir = (deps: EditorDeps, linea: Content, offset: number, casilla: boolean): Caret | null => {
  const raiz: Content | null = rootAncestor(contenido(deps), linea.id)
  if (!casilla && raiz !== null) {
    /* Un texto sólo cabe en la raíz: la mitad nueva va debajo de su línea de la raíz. */
    deps.useCases.setText(deps.noteId, linea.id, linea.text.slice(0, offset))
    const nota: Note | null = deps.useCases.insertText(deps.noteId, linea.text.slice(offset), after(raiz.id))
    const fuera: Content | null = nota === null ? null : nextSibling(nota.content, raiz.id)
    return fuera === null ? null : { line: fuera.id, offset: 0 }
  }
  /* Encendido: casilla de hermana, al mismo nivel. */
  deps.useCases.split(deps.noteId, linea.id, offset)
  const nueva: Content | null = nextSibling(contenido(deps), linea.id)
  if (nueva === null) return null
  if (!isCheckBox(nueva)) deps.useCases.convertToCheckBox(deps.noteId, nueva.id)
  return { line: nueva.id, offset: 0 }
}

/**
 * Intro. En medio de una línea la parte; al final crea la siguiente:
 *
 *     casilla apagada     texto, debajo de la línea —o de su casilla de la raíz—
 *     casilla encendida   casilla hermana, debajo
 *     … y anidar armado   casilla hija, dentro de la línea, y se desarma
 */
export const pressEnter = (deps: EditorDeps, caret: Caret, mode: WritingMode): EditResult => {
  const linea: Content | undefined = locate(contenido(deps), caret.line)?.line
  if (linea === undefined) return { caret: null, mode }

  if (caret.offset < linea.text.length) {
    /* Partir no anida: anidar sigue armado para la próxima línea que nazca. */
    return { caret: partir(deps, linea, caret.offset, mode.checkbox) ?? caret, mode }
  }

  if (!mode.checkbox) {
    /* Un texto sólo cabe en la raíz: debajo de la casilla de la raíz que la contiene. */
    const raiz: Content = rootAncestor(contenido(deps), linea.id) ?? linea
    const nota: Note | null = deps.useCases.insertText(deps.noteId, "", after(raiz.id))
    const nueva: Content | null = nota === null ? null : nextSibling(nota.content, raiz.id)
    return { caret: nueva === null ? caret : { line: nueva.id, offset: 0 }, mode }
  }

  const anida: boolean = mode.nestArmed && isCheckBox(linea)
  const donde: Position = anida ? lastChildOf(linea.id) : after(linea.id)
  const nota: Note | null = deps.useCases.insertCheckBox(deps.noteId, "", donde)
  const nueva: Content | null =
    nota === null ? null : anida ? ultimaHija(nota.content, linea.id) : nextSibling(nota.content, linea.id)
  return {
    caret: nueva === null ? caret : { line: nueva.id, offset: 0 },
    /* Sólo se desarma si ha anidado: desde un texto no puede, y espera a la siguiente. */
    mode: anida ? { ...mode, nestArmed: false } : mode,
  }
}

/**
 * Retroceso con el cursor al principio de la línea. Una pulsación, una cosa:
 * primero intenta quitar la casilla; si no cambió nada —era texto, o una casilla
 * anidada o con hijas—, une con la de arriba.
 */
export const pressBackspaceAtStart = (deps: EditorDeps, caret: Caret, mode: WritingMode): EditResult => {
  const antes: Located | null = locate(contenido(deps), caret.line)
  if (antes === null) return { caret: null, mode }

  if (isCheckBox(antes.line)) {
    /* La invariante de identidad dice si aplicó: un no-op devuelve la MISMA nota. */
    if (deps.useCases.convertToText(deps.noteId, caret.line) !== null) {
      return { caret: { line: caret.line, offset: 0 }, mode }
    }
  }

  const receptora: Content | null = mergeTarget(contenido(deps), caret.line)
  if (receptora === null) return { caret, mode }
  const unido: Note | null = deps.useCases.merge(deps.noteId, caret.line)
  /* No aplicó —la línea tiene hijas—: el cursor se queda donde estaba. */
  if (unido === null) return { caret, mode }
  return { caret: { line: receptora.id, offset: receptora.text.length }, mode }
}

/**
 * El interruptor de casilla. No sólo cambia lo que nacerá: toca la línea actual.
 *
 *     encender en un texto, al principio   la línea entera pasa a casilla
 *     encender en un texto, en otro sitio  se parte, y la mitad nueva es casilla
 *     encender en una casilla              nada: ya lo es
 *     apagar en una casilla                pasa a texto, si cabe; y se desarma anidar
 */
export const toggleCheckbox = (deps: EditorDeps, caret: Caret | null, mode: WritingMode): EditResult => {
  const encender: boolean = !mode.checkbox
  /* Cambiar el interruptor desarma anidar: lo armado era para el modo de antes. */
  const modo: WritingMode = { checkbox: encender, nestArmed: false }
  const linea: Content | undefined = caret === null ? undefined : locate(contenido(deps), caret.line)?.line
  if (caret === null || linea === undefined) return { caret, mode: modo }

  if (!encender) {
    if (isCheckBox(linea)) deps.useCases.convertToText(deps.noteId, linea.id)
    return { caret, mode: modo }
  }

  if (isCheckBox(linea)) return { caret, mode: modo }
  if (caret.offset === 0) {
    deps.useCases.convertToCheckBox(deps.noteId, linea.id)
    return { caret, mode: modo }
  }
  return { caret: partir(deps, linea, caret.offset, true) ?? caret, mode: modo }
}

/** Marca o desmarca la casilla. En un texto no hace nada. */
export const toggleChecked = (deps: EditorDeps, id: ContentId): void => {
  const linea: Content | undefined = locate(contenido(deps), id)?.line
  if (linea !== undefined && isCheckBox(linea)) {
    deps.useCases.setChecked(deps.noteId, id, !linea.checked)
  }
}

/** La primera línea de una nota vacía, de la clase que diga el interruptor. */
export const startWriting = (deps: EditorDeps, mode: WritingMode): EditResult => {
  const nota: Note | null = mode.checkbox
    ? deps.useCases.insertCheckBox(deps.noteId, "", rootEnd)
    : deps.useCases.insertText(deps.noteId, "", rootEnd)
  const ultima: Content | undefined = nota?.content[nota.content.length - 1]
  return { caret: ultima === undefined ? null : { line: ultima.id, offset: 0 }, mode }
}

/**
 * Pegar líneas: entran seguidas, en una sola acción, donde está el cursor.
 *
 *     al final de la línea       debajo de ella
 *     al principio               encima
 *     en medio                   la línea se parte, y entran entre las dos mitades
 *     en una línea vacía         ocupan su sitio, si no tiene hijas
 *
 * Un texto sólo cabe en la raíz: si la línea va anidada y lo pegado trae alguno,
 * entran debajo de su casilla de la raíz, y la línea no se parte. El cursor queda al final de la última
 * línea pegada, y si no entraron, donde estaba.
 */
export const pasteLines = (
  deps: EditorDeps,
  caret: Caret,
  lineas: ReadonlyArray<ContentDraft>,
  mode: WritingMode,
): EditResult => {
  const donde: Located | null = locate(contenido(deps), caret.line)
  if (donde === null) return { caret, mode }
  const linea: Content = donde.line
  const largo: number = linea.text.length
  const vacia: boolean = largo === 0 && !(isCheckBox(linea) && linea.children.length > 0)
  const aLaRaiz: boolean = donde.parent !== null && lineas.some((l: ContentDraft): boolean => l.type === "text")

  if (lineas.length === 0) return { caret, mode }
  /* Si lo pegado se va a la raíz, no hay nada que meter entre las mitades: no se parte. */
  if (!aLaRaiz && caret.offset > 0 && caret.offset < largo) deps.useCases.split(deps.noteId, linea.id, caret.offset)
  /* Lo que ya había, mitad partida incluida: lo que no esté aquí es lo pegado. */
  const habia: ReadonlySet<ContentId> = new Set(inReadingOrder(contenido(deps)).map((l: Content): ContentId => l.id))
  const raiz: Content = rootAncestor(contenido(deps), linea.id) ?? linea
  const posicion: Position = aLaRaiz
    ? after(raiz.id)
    : caret.offset === 0 && largo > 0
      ? before(linea.id)
      : after(linea.id)
  const nota: Note | null = deps.useCases.insertLines(deps.noteId, lineas, posicion)
  if (nota === null) return { caret, mode }
  if (vacia) deps.useCases.remove(deps.noteId, [linea.id])

  const pegadas: ReadonlyArray<Content> = inReadingOrder(contenido(deps)).filter(
    (l: Content): boolean => !habia.has(l.id),
  )
  const ultima: Content | undefined = pegadas[pegadas.length - 1]
  return { caret: ultima === undefined ? caret : { line: ultima.id, offset: ultima.text.length }, mode }
}

/** Cuántas líneas lleva colgando, a cualquier profundidad. */
const descendientes = (linea: Content): number => inReadingOrder([linea]).length - 1

/**
 * Borrar lo seleccionado, de `desde` a `hasta`. Como en un editor de texto:
 *
 *     la primera línea        se queda con lo de antes de la selección
 *     la última               lo de después se une a la primera, y se va
 *     … con hijas             no se une: sólo pierde lo seleccionado
 *     las de en medio         se van, cada casilla con sus hijas
 *     … con hijas fuera       no se va: se queda vacía
 *
 * Dentro de una sola línea, quita el trozo. Los `offset` cuentan lo que se ve,
 * salvo en la línea `enCrudo`, que se ve tal cual: una negrita o un enlace
 * partidos se cierran o se reabren a cada lado. El cursor queda donde empezaba la
 * selección; si alguna no está o van al revés, no hace nada.
 */
export const deleteSelection = (
  deps: EditorDeps,
  desde: Caret,
  hasta: Caret,
  enCrudo: ContentId | null,
  mode: WritingMode,
): EditResult => {
  const todas: ReadonlyArray<Content> = inReadingOrder(contenido(deps))
  const a: number = todas.findIndex((l: Content): boolean => l.id === desde.line)
  const b: number = todas.findIndex((l: Content): boolean => l.id === hasta.line)
  const primera: Content | undefined = todas[a]
  const ultima: Content | undefined = todas[b]
  if (primera === undefined || ultima === undefined || a > b) return { caret: null, mode }
  const enBruto = (l: Content): boolean => l.id === enCrudo
  const caret: Caret = {
    line: primera.id,
    offset: enBruto(primera) ? desde.offset : cutBefore(primera.text, desde.offset).text.length,
  }
  if (a === b) {
    if (desde.offset >= hasta.offset) return { caret, mode }
    const queda: string = enBruto(primera)
      ? primera.text.slice(0, desde.offset) + primera.text.slice(hasta.offset)
      : withoutVisible(primera.text, desde.offset, hasta.offset)
    deps.useCases.setText(deps.noteId, primera.id, queda)
    return { caret, mode }
  }

  /* Una línea se va si todo su árbol cae dentro: su última hija, como mucho, es la última. */
  const seVa = (linea: Content, i: number): boolean => i + descendientes(linea) <= b
  const seUne: boolean = seVa(ultima, b)
  const cola: Cut = enBruto(ultima)
    ? { text: ultima.text.slice(hasta.offset), marks: [] }
    : cutAfter(ultima.text, hasta.offset)
  const cabeza: Cut = enBruto(primera)
    ? { text: primera.text.slice(0, desde.offset), marks: [] }
    : cutBefore(primera.text, desde.offset)
  const unida: { readonly text: string; readonly caret: number } = joinCuts(
    cabeza,
    seUne ? cola : { text: "", marks: [] },
  )

  const medio: ReadonlyArray<Content> = todas.slice(a + 1, b)
  const fuera: ReadonlyArray<ContentId> = [
    ...medio.filter((l: Content, k: number): boolean => seVa(l, a + 1 + k)).map((l: Content): ContentId => l.id),
    ...(seUne ? [ultima.id] : []),
  ]
  for (const [k, linea] of medio.entries()) {
    if (!seVa(linea, a + 1 + k) && linea.text !== "") deps.useCases.setText(deps.noteId, linea.id, "")
  }
  if (!seUne) {
    /* Se queda en su sitio: si era un título, lo sigue siendo. */
    const titulo: string = !enBruto(ultima) && readMarkdownLine(ultima.text).heading ? "# " : ""
    deps.useCases.setText(deps.noteId, ultima.id, titulo + joinCuts({ text: "", marks: [] }, cola).text)
  }
  deps.useCases.setText(deps.noteId, primera.id, unida.text)
  if (fuera.length > 0) deps.useCases.remove(deps.noteId, fuera)
  /* El cursor, donde acaba lo que se quedó de la primera: tras un enlace partido, no en medio. */
  return { caret: { line: primera.id, offset: unida.caret }, mode }
}
