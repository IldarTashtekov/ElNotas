/**
 * La vista ventanas, la principal: una ventana cada vez, con ◀ ▶ para pasar a la
 * de al lado, el título —que en un contexto se renombra tocándolo—, sus notas y
 * el ⚙ de la configuración. Sin ventanas, una pantalla vacía con el ⚙.
 *
 * Lo que se enseña lo decide `windowView`; aquí sólo se pinta y se escucha.
 */

import type { AppState, NoteId, StorageError, Store, UseCases } from "#core/index"
import type { BackStack } from "./backStack.js"
import { corruptNotice, elemento } from "./dom.js"
import type { EditableTitle } from "./editableTitle.js"
import { createEditableTitle } from "./editableTitle.js"
import type { NoteList } from "./NoteList.js"
import { createNoteList } from "./NoteList.js"
import type { WindowView } from "./windowView.js"
import { windowView } from "./windowView.js"
import type { WindowsLayout } from "./windows.js"
import type { WindowsModel } from "./windowsModel.js"

export interface WindowsViewDeps {
  readonly store: Store
  readonly useCases: UseCases
  readonly windows: WindowsModel
  /** Los ficheros que no se pudieron leer al arrancar. Vacío es lo normal. */
  readonly corrupt: ReadonlyArray<StorageError>
  readonly onOpenSettings: () => void
  readonly back: BackStack
  readonly confirm: (pregunta: string) => boolean
  readonly onOpenNote: (id: NoteId) => void
}

const flecha = (texto: string, etiqueta: string): HTMLButtonElement => {
  const boton: HTMLButtonElement = elemento("button", texto)
  boton.type = "button"
  boton.className = "flecha"
  boton.setAttribute("aria-label", etiqueta)
  return boton
}

/** Se ocultan sin quitarlas del sitio, para que el título no baile. */
const mostrar = (el: HTMLElement, visible: boolean): void => {
  el.style.visibility = visible ? "visible" : "hidden"
  el.setAttribute("aria-hidden", visible ? "false" : "true")
}

export const mountWindowsView = (
  raiz: HTMLElement,
  { store, useCases, windows, corrupt, onOpenSettings, back, confirm, onOpenNote }: WindowsViewDeps,
): void => {
  const anterior: HTMLButtonElement = flecha("◀", "Ventana anterior")
  const siguiente: HTMLButtonElement = flecha("▶", "Ventana siguiente")
  const titulo: EditableTitle = createEditableTitle("Nombre del contexto", (nombre: string): void => {
    /* Se lee al guardar: es el contexto de la ventana en la que se empezó a escribir. */
    if (vista.kind === "window" && vista.renames !== null) useCases.renameContext(vista.renames, nombre)
  })
  const cabecera: HTMLElement = elemento("header")
  cabecera.className = "cabecera"
  const engranaje = (): HTMLButtonElement => {
    const boton: HTMLButtonElement = flecha("⚙", "Configuración")
    boton.addEventListener("click", onOpenSettings)
    return boton
  }
  const ajustes: HTMLButtonElement = engranaje()
  cabecera.append(anterior, titulo.element, siguiente, ajustes)

  /* Mientras se selecciona se apagan ◀ ▶ y ⚙: no se sale de la lista a medias. */
  const apagar = (seleccionando: boolean): void => {
    for (const b of [anterior, siguiente, ajustes]) {
      b.disabled = seleccionando
      b.classList.toggle("apagado", seleccionando)
    }
  }
  const notas: NoteList = createNoteList({
    store,
    useCases,
    back,
    confirm,
    onSelectingChange: apagar,
    onOpenNote,
  })
  /* Sin ventanas no hay cabecera, pero el ⚙ tiene que seguir: es la salida. */
  const sinVentanas: HTMLElement = elemento("div")
  sinVentanas.className = "vacia"
  sinVentanas.append(elemento("p", "No hay ninguna ventana."), engranaje())

  let vista: WindowView = { kind: "empty" }

  anterior.addEventListener("click", (): void => {
    if (vista.kind === "window" && vista.prev !== null) windows.setActive(vista.prev)
  })
  siguiente.addEventListener("click", (): void => {
    if (vista.kind === "window" && vista.next !== null) windows.setActive(vista.next)
  })

  /* ── Pintar ── */

  let pintadoEstado: AppState | null = null
  let pintadoLayout: WindowsLayout | null = null

  const pintar = (forzar: boolean = false): void => {
    const estado: AppState = store.getState()
    const layout: WindowsLayout = windows.getLayout()
    /* El core y la guarda devuelven el MISMO objeto si nada cambió: con eso basta
       para no tocar el DOM. */
    if (!forzar && estado === pintadoEstado && layout === pintadoLayout) return
    pintadoEstado = estado
    pintadoLayout = layout
    vista = windowView(layout, estado)

    if (vista.kind === "empty") {
      cabecera.hidden = true
      notas.update(null, [])
      sinVentanas.hidden = false
      return
    }

    cabecera.hidden = false
    sinVentanas.hidden = true
    mostrar(anterior, vista.prev !== null)
    mostrar(siguiente, vista.next !== null)

    titulo.show(vista.title, vista.renames !== null)

    notas.update(vista.ref, vista.notes)
  }

  raiz.replaceChildren(
    ...(corrupt.length > 0 ? [corruptNotice(corrupt)] : []),
    cabecera,
    notas.element,
    sinVentanas,
  )
  pintar()
  store.subscribe((): void => pintar())
  windows.subscribe((): void => pintar())
}
