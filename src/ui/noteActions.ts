/**
 * Lo que se hace sobre lo que lista una ventana: crear una nota o un diagrama, la
 * papelera y «Mover a…».
 *
 * Cada una compone casos de uso que ya existen —crear y añadir, quitar y
 * añadir—, así que el core no se toca y cada acción sigue siendo una operación.
 * Lo que cambia según la ventana: en un contexto la papelera QUITA de él; en el
 * General, que no tiene de dónde quitar, BORRA de verdad.
 */

import type { AppState, Context, ContextId, Diagram, ItemRef, Note, UseCases } from "#core/index"
import { diagramRef, noteRef } from "#core/index"
import type { ListItem } from "./windowView.js"
import type { WindowRef } from "./windows.js"

export const NEW_NOTE_NAME: string = "Nueva Nota"
export const NEW_DIAGRAM_NAME: string = "Nuevo diagrama"

/** Una «Nueva Nota» en la ventana: dentro del contexto, o sin contexto desde el General. */
export const createNoteIn = (useCases: UseCases, ventana: WindowRef): Note | null => {
  const nota: Note | null = useCases.createNote(NEW_NOTE_NAME)
  if (nota !== null && ventana.kind === "context") useCases.addItem(ventana.id, noteRef(nota.id))
  return nota
}

/** Un «Nuevo diagrama» en la ventana, igual que una nota. */
export const createDiagramIn = (useCases: UseCases, ventana: WindowRef): Diagram | null => {
  const diagrama: Diagram | null = useCases.createDiagram(NEW_DIAGRAM_NAME)
  if (diagrama !== null && ventana.kind === "context") {
    useCases.addItem(ventana.id, diagramRef(diagrama.id))
  }
  return diagrama
}

/** Si la papelera de esta ventana borra de verdad, que es cuando hay que confirmar. */
export const trashDeletes = (ventana: WindowRef): boolean => ventana.kind === "general"

export const trashItems = (
  useCases: UseCases,
  ventana: WindowRef,
  refs: ReadonlyArray<ItemRef>,
): void => {
  for (const ref of refs) {
    if (ventana.kind === "general") {
      if (ref.kind === "note") useCases.deleteNote(ref.id)
      else useCases.deleteDiagram(ref.id)
    }
    /* Una ventana de nota no tiene lista, así que no hay nada que tirar. */
    else if (ventana.kind === "context") useCases.removeItem(ventana.id, ref)
  }
}

/**
 * Mueve, no copia: las quita de este contexto y las añade al destino. Desde el
 * General sólo añade —no es un contexto—, y es como se devuelve a un contexto
 * una nota que se quitó. Si ya estaba en el destino, añadirla no hace nada.
 */
export const moveItems = (
  useCases: UseCases,
  desde: WindowRef,
  destino: ContextId,
  refs: ReadonlyArray<ItemRef>,
): void => {
  for (const ref of refs) {
    useCases.addItem(destino, ref)
    if (desde.kind === "context") useCases.removeItem(desde.id, ref)
  }
}

/** Adónde se puede mover: los contextos, ni el General ni el de esta ventana. */
export const moveTargets = (state: AppState, desde: WindowRef): ReadonlyArray<Context> =>
  [...Object.values<Context>(state.contexts)]
    .filter((ctx: Context): boolean => desde.kind !== "context" || ctx.id !== desde.id)
    .sort((a: Context, b: Context): number => a.name.localeCompare(b.name))

/** Cómo se cuentan varios: notas, diagramas, o elementos si van mezclados. */
const cuantos = (items: ReadonlyArray<ListItem>): string => {
  const notas: number = items.filter((i: ListItem): boolean => i.ref.kind === "note").length
  if (notas === items.length) return `${items.length} notas`
  if (notas === 0) return `${items.length} diagramas`
  return `${items.length} elementos`
}

/** La pregunta de la papelera del General, con uno o con varios. */
export const deleteQuestion = (items: ReadonlyArray<ListItem>): string => {
  const [uno] = items
  return items.length === 1 && uno !== undefined
    ? `¿Borrar «${uno.name}»? No se puede deshacer.`
    : `¿Borrar ${cuantos(items)}? No se puede deshacer.`
}
