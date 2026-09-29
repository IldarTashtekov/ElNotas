/**
 * Lo que hace cada tecla y cada botón del editor: Intro, Retroceso al principio
 * de una línea, el interruptor de casilla, anidar y marcar.
 *
 * Cada acción ejecuta las operaciones que tocan —con los casos de uso, sin tocar
 * el core— y devuelve dónde queda el cursor y cómo queda el modo. No sabe nada
 * del DOM, así que se prueba en Node contra las tablas del teclado de
 * `ARCHITECTURE.md`.
 */

import type { Content, ContentId, Note, NoteId, Position, UseCases } from "#core/index"
import { after, isCheckBox, lastChildOf, rootEnd } from "#core/index"
import type { Located } from "./noteTree.js"
import { locate, mergeTarget, nextSibling, rootAncestor } from "./noteTree.js"
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
  return madre !== undefined && isCheckBox(madre)
    ? (madre.children[madre.children.length - 1] ?? null)
    : null
}

/** Parte la línea y deja la mitad nueva de la clase que diga el interruptor. */
const partir = (deps: EditorDeps, linea: Content, offset: number, casilla: boolean): Caret | null => {
  deps.useCases.split(deps.noteId, linea.id, offset)
  const nueva: Content | null = nextSibling(contenido(deps), linea.id)
  if (nueva === null) return null
  /* Si no cabe —un texto anidado—, la conversión no hace nada y sigue casilla. */
  if (casilla && !isCheckBox(nueva)) deps.useCases.convertToCheckBox(deps.noteId, nueva.id)
  if (!casilla && isCheckBox(nueva)) deps.useCases.convertToText(deps.noteId, nueva.id)
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
    nota === null
      ? null
      : anida
        ? ultimaHija(nota.content, linea.id)
        : nextSibling(nota.content, linea.id)
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
export const pressBackspaceAtStart = (
  deps: EditorDeps,
  caret: Caret,
  mode: WritingMode,
): EditResult => {
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
export const toggleCheckbox = (
  deps: EditorDeps,
  caret: Caret | null,
  mode: WritingMode,
): EditResult => {
  const encender: boolean = !mode.checkbox
  /* Cambiar el interruptor desarma anidar: lo armado era para el modo de antes. */
  const modo: WritingMode = { checkbox: encender, nestArmed: false }
  const linea: Content | undefined =
    caret === null ? undefined : locate(contenido(deps), caret.line)?.line
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
