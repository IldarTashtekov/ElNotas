/**
 * Lo que se hace sobre lo que lista una ventana: crear una nota o un diagrama, la
 * papelera y «Mover a…»; crear una nota desde un diagrama; y crear un contexto,
 * una nota o un diagrama como ventana nueva.
 *
 * Cada una compone casos de uso que ya existen —crear y añadir, quitar y
 * añadir—, así que el core no se toca y cada acción sigue siendo una operación.
 * Lo que cambia según la ventana: en un contexto la papelera QUITA de él; en el
 * General, que no tiene de dónde quitar, BORRA de verdad.
 */

import type {
  AppState,
  Context,
  ContextId,
  Diagram,
  DiagramId,
  ItemRef,
  Note,
  UseCases,
} from "#core/index"
import { diagramRef, noteRef } from "#core/index"
import type { ListItem } from "./windowView.js"
import type { WindowRef } from "./windows.js"
import { GENERAL } from "./windows.js"

export const NEW_CONTEXT_NAME: string = "Nuevo contexto"
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

/**
 * Un contexto, una nota o un diagrama nuevos para enseñarlos en una ventana
 * nueva, desde el «+» de la última o desde la configuración. La nota y el
 * diagrama nacen sin contexto, como desde el General. Devuelve la ventana que
 * los enseña, o `null` si no se pudo crear.
 */
export const createAsWindow = (
  useCases: UseCases,
  kind: "context" | "note" | "diagram",
): WindowRef | null => {
  if (kind === "context") {
    const contexto: Context | null = useCases.createContext(NEW_CONTEXT_NAME)
    return contexto === null ? null : { kind: "context", id: contexto.id }
  }
  if (kind === "note") {
    const nota: Note | null = createNoteIn(useCases, GENERAL)
    return nota === null ? null : { kind: "note", id: nota.id }
  }
  const diagrama: Diagram | null = createDiagramIn(useCases, GENERAL)
  return diagrama === null ? null : { kind: "diagram", id: diagrama.id }
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

/** Los contextos que listan esto, por nombre. */
export const contextsWith = (state: AppState, ref: ItemRef): ReadonlyArray<Context> =>
  [...Object.values<Context>(state.contexts)]
    .filter((ctx: Context): boolean =>
      ctx.items.some((i: ItemRef): boolean => i.kind === ref.kind && i.id === ref.id),
    )
    .sort((a: Context, b: Context): number => a.name.localeCompare(b.name))

/**
 * Una «Nueva Nota» creada desde un diagrama: va a TODOS los contextos donde está
 * el diagrama; si no está en ninguno, a ninguno, y se ve en el General.
 */
export const createNoteForDiagram = (
  useCases: UseCases,
  state: AppState,
  diagramId: DiagramId,
): Note | null => {
  const nota: Note | null = useCases.createNote(NEW_NOTE_NAME)
  if (nota === null) return null
  for (const ctx of contextsWith(state, diagramRef(diagramId))) {
    useCases.addItem(ctx.id, noteRef(nota.id))
  }
  return nota
}
