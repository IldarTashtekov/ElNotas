/**
 * La vista nota: la cabecera sólo con el título —que se renombra tocándolo—, el
 * contenido, y abajo la barra con el exit.
 *
 * De momento el contenido sólo se lee: textos y casillas, con sus hijas. Editar
 * llega con el editor. Se sale con el exit o con el atrás, a la misma ventana.
 */

import type { CheckBox, Content, Note, NoteId, Store, Unsubscribe, UseCases } from "#core/index"
import { isCheckBox } from "#core/index"
import { elemento } from "./dom.js"
import type { EditableTitle } from "./editableTitle.js"
import { createEditableTitle } from "./editableTitle.js"

export interface NoteViewDeps {
  readonly store: Store
  readonly useCases: UseCases
  readonly noteId: NoteId
  readonly onExit: () => void
}

/** Una línea, con sus hijas dentro si es una casilla que las tiene. */
const linea = (content: Content): HTMLElement => {
  const fila: HTMLElement = elemento("div")
  fila.dataset["id"] = content.id
  if (!isCheckBox(content)) {
    fila.className = "linea texto"
    fila.textContent = content.text
    return fila
  }
  fila.className = content.checked ? "linea casilla marcada" : "linea casilla"
  const marca: HTMLSpanElement = elemento("span", content.checked ? "☑" : "☐")
  marca.className = "marca"
  marca.setAttribute("aria-hidden", "true")
  fila.setAttribute("role", "checkbox")
  fila.setAttribute("aria-checked", content.checked ? "true" : "false")
  fila.append(marca, elemento("span", content.text))
  if (content.children.length > 0) {
    const hijas: HTMLElement = elemento("div")
    hijas.className = "hijas"
    hijas.append(...content.children.map((hija: CheckBox): HTMLElement => linea(hija)))
    fila.append(hijas)
  }
  return fila
}

/** Devuelve la función que la desmonta. */
export const mountNoteView = (
  raiz: HTMLElement,
  { store, useCases, noteId, onExit }: NoteViewDeps,
): (() => void) => {
  const titulo: EditableTitle = createEditableTitle("Nombre de la nota", (nombre: string): void => {
    useCases.renameNote(noteId, nombre)
  })
  const cabecera: HTMLElement = elemento("header")
  cabecera.className = "cabecera"
  cabecera.append(titulo.element)

  const contenido: HTMLElement = elemento("div")
  contenido.className = "contenido"
  const vacia: HTMLParagraphElement = elemento("p", "Esta nota está vacía.")
  vacia.className = "vacia"

  const salir: HTMLButtonElement = elemento("button", "✕ Salir")
  salir.type = "button"
  salir.addEventListener("click", onExit)
  const barra: HTMLElement = elemento("div")
  barra.className = "barra barra-modo"
  barra.append(salir)

  let pintada: Note | null = null

  const pintar = (): void => {
    const nota: Note | undefined = store.getState().notes[noteId]
    /* Desde la vista nota no se puede borrar la nota, pero si no está, se sale. */
    if (nota === undefined) {
      onExit()
      return
    }
    /* La nota es la MISMA si nada cambió: entonces no se toca el DOM. */
    if (nota === pintada) return
    pintada = nota
    titulo.show(nota.name, true)
    contenido.replaceChildren(...nota.content.map((c: Content): HTMLElement => linea(c)))
    vacia.hidden = nota.content.length > 0
  }

  /* Una columna que llena la pantalla: la barra queda abajo aunque la nota sea corta. */
  const vista: HTMLElement = elemento("div")
  vista.className = "vista-nota"
  vista.append(cabecera, contenido, vacia, barra)
  raiz.replaceChildren(vista)
  pintar()
  const baja: Unsubscribe = store.subscribe((): void => pintar())

  return (): void => {
    baja()
    raiz.replaceChildren()
  }
}
