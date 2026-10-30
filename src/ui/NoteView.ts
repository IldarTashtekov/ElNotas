/**
 * La vista nota: la cabecera sólo con el título —que se renombra tocándolo—, el
 * editor, y abajo la barra con el modo de escritura y el exit.
 *
 * Se sale con el exit o con el atrás, a la misma ventana. El modo de escritura
 * nace al abrirla y muere al salir.
 */

import type { Day, DiagramId, EventId, Note, NoteId, RoutineId, Store, Unsubscribe, UseCases } from "#core/index"
import { elemento } from "./dom.js"
import type { EditableTitle } from "./editableTitle.js"
import { createEditableTitle } from "./editableTitle.js"
import type { NoteEditor } from "./NoteEditor.js"
import { createNoteEditor } from "./NoteEditor.js"
import type { Sheet } from "./sheet.js"

export interface NoteViewDeps {
  readonly store: Store
  readonly useCases: UseCases
  readonly noteId: NoteId
  readonly onExit: () => void
  /** Abrir lo que enlaza un enlace de la nota, apilado encima de ella. */
  readonly onOpenNote: (id: NoteId) => void
  readonly onOpenDiagram: (id: DiagramId) => void
  readonly onOpenEvent: (id: EventId) => void
  readonly onOpenRoutine: (id: RoutineId) => void
  /** El día de hoy en este dispositivo, para el atajo de rutina de una casilla. */
  readonly today: () => Day | null
  /** La hoja de la app, donde se elige a qué enlazar. */
  readonly sheet: Sheet
}

/** Devuelve la función que la desmonta. */
export const mountNoteView = (
  raiz: HTMLElement,
  { store, useCases, noteId, onExit, onOpenNote, onOpenDiagram, onOpenEvent, onOpenRoutine, today, sheet }: NoteViewDeps,
): (() => void) => {
  const nota = (): Note | undefined => store.getState().notes[noteId]

  const titulo: EditableTitle = createEditableTitle("Nombre de la nota", (nombre: string): void => {
    useCases.renameNote(noteId, nombre)
  })
  const cabecera: HTMLElement = elemento("header")
  cabecera.className = "cabecera"
  cabecera.append(titulo.element)

  const editor: NoteEditor = createNoteEditor({
    useCases,
    noteId,
    note: nota,
    state: store.getState,
    onOpenNote,
    onOpenDiagram,
    onOpenEvent,
    onOpenRoutine,
    today,
    sheet,
  })

  const salir: HTMLButtonElement = elemento("button", "✕ Salir")
  salir.type = "button"
  salir.className = "salir"
  salir.addEventListener("click", onExit)
  const barra: HTMLElement = elemento("div")
  barra.className = "barra barra-modo"
  barra.append(...editor.modeButtons, salir)

  const pintar = (): void => {
    const actual: Note | undefined = nota()
    /* Desde la vista nota no se puede borrar la nota, pero si no está, se sale. */
    if (actual === undefined) {
      onExit()
      return
    }
    titulo.show(actual.name, true)
    editor.refresh(actual)
  }

  /* Una columna que llena la pantalla: la barra queda abajo aunque la nota sea corta. */
  const vista: HTMLElement = elemento("div")
  vista.className = "vista-nota"
  vista.append(cabecera, editor.element, barra)
  raiz.replaceChildren(vista)
  pintar()
  const baja: Unsubscribe = store.subscribe((): void => pintar())

  return (): void => {
    baja()
    editor.destroy()
    raiz.replaceChildren()
  }
}
