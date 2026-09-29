/**
 * Lo que se hace sobre las notas de una ventana: crear una, la papelera y
 * «Mover a…».
 *
 * Cada una compone casos de uso que ya existen —crear y añadir, quitar y
 * añadir—, así que el core no se toca y cada acción sigue siendo una operación.
 * Lo que cambia según la ventana: en un contexto la papelera QUITA de él; en el
 * General, que no tiene de dónde quitar, BORRA de verdad.
 */

import type { AppState, Context, ContextId, Note, NoteId, UseCases } from "#core/index"
import { noteRef } from "#core/index"
import type { WindowRef } from "./windows.js"

export const NEW_NOTE_NAME: string = "Nueva Nota"

/** Una «Nueva Nota» en la ventana: dentro del contexto, o sin contexto desde el General. */
export const createNoteIn = (useCases: UseCases, ventana: WindowRef): Note | null => {
  const nota: Note | null = useCases.createNote(NEW_NOTE_NAME)
  if (nota !== null && ventana.kind === "context") useCases.addItem(ventana.id, noteRef(nota.id))
  return nota
}

/** Si la papelera de esta ventana borra de verdad, que es cuando hay que confirmar. */
export const trashDeletes = (ventana: WindowRef): boolean => ventana.kind === "general"

export const trashNotes = (
  useCases: UseCases,
  ventana: WindowRef,
  ids: ReadonlyArray<NoteId>,
): void => {
  for (const id of ids) {
    if (ventana.kind === "general") useCases.deleteNote(id)
    /* Una ventana de nota no tiene lista, así que no hay nada que tirar. */
    else if (ventana.kind === "context") useCases.removeItem(ventana.id, noteRef(id))
  }
}

/**
 * Mueve, no copia: las quita de este contexto y las añade al destino. Desde el
 * General sólo añade —no es un contexto—, y es como se devuelve a un contexto
 * una nota que se quitó. Si ya estaba en el destino, añadirla no hace nada.
 */
export const moveNotes = (
  useCases: UseCases,
  desde: WindowRef,
  destino: ContextId,
  ids: ReadonlyArray<NoteId>,
): void => {
  for (const id of ids) {
    useCases.addItem(destino, noteRef(id))
    if (desde.kind === "context") useCases.removeItem(desde.id, noteRef(id))
  }
}

/** Adónde se puede mover: los contextos, ni el General ni el de esta ventana. */
export const moveTargets = (state: AppState, desde: WindowRef): ReadonlyArray<Context> =>
  [...Object.values<Context>(state.contexts)]
    .filter((ctx: Context): boolean => desde.kind !== "context" || ctx.id !== desde.id)
    .sort((a: Context, b: Context): number => a.name.localeCompare(b.name))

/** La pregunta de la papelera del General, con una nota o con varias. */
export const deleteQuestion = (notas: ReadonlyArray<Note>): string => {
  const [una] = notas
  return notas.length === 1 && una !== undefined
    ? `¿Borrar «${una.name}»? No se puede deshacer.`
    : `¿Borrar ${notas.length} notas? No se puede deshacer.`
}
