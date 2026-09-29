/**
 * La vista ventanas, la principal: una ventana cada vez, con ◀ ▶ para pasar a la
 * de al lado, el título —que en un contexto se renombra tocándolo—, sus notas y
 * el ⚙ de la configuración. Sin ventanas, una pantalla vacía con el ⚙.
 *
 * Lo que se enseña lo decide `windowView`; aquí sólo se pinta y se escucha.
 */

import type { AppState, ContextId, Note, StorageError, Store, UseCases } from "#core/index"
import { corruptNotice, elemento } from "./dom.js"
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
}

/** Lo que está a medio renombrar: mientras dure, el título no se repinta. */
interface Renombrado {
  readonly id: ContextId
  readonly campo: HTMLInputElement
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
  { store, useCases, windows, corrupt, onOpenSettings }: WindowsViewDeps,
): void => {
  const anterior: HTMLButtonElement = flecha("◀", "Ventana anterior")
  const siguiente: HTMLButtonElement = flecha("▶", "Ventana siguiente")
  const titulo: HTMLHeadingElement = elemento("h1")
  titulo.className = "titulo"
  const cabecera: HTMLElement = elemento("header")
  cabecera.className = "cabecera"
  const engranaje = (): HTMLButtonElement => {
    const boton: HTMLButtonElement = flecha("⚙", "Configuración")
    boton.addEventListener("click", onOpenSettings)
    return boton
  }
  cabecera.append(anterior, titulo, siguiente, engranaje())

  const notas: HTMLUListElement = elemento("ul")
  notas.className = "notas"
  const sinNotas: HTMLParagraphElement = elemento("p", "Esta ventana no tiene notas.")
  sinNotas.className = "vacia"
  /* Sin ventanas no hay cabecera, pero el ⚙ tiene que seguir: es la salida. */
  const sinVentanas: HTMLElement = elemento("div")
  sinVentanas.className = "vacia"
  sinVentanas.append(elemento("p", "No hay ninguna ventana."), engranaje())

  let vista: WindowView = { kind: "empty" }
  let renombrado: Renombrado | null = null

  /* ── Renombrar tocando el título ── */

  const terminarRenombrado = (guardar: boolean): void => {
    if (renombrado === null) return
    const { id, campo }: Renombrado = renombrado
    /* Se suelta ANTES de tocar el DOM: quitar el campo dispara su `blur`, que
       vuelve a llamar aquí y tiene que encontrarse con que ya no hay nada. */
    renombrado = null
    const nombre: string = campo.value.trim()
    campo.replaceWith(titulo)
    if (guardar && nombre !== "") useCases.renameContext(id, nombre)
    pintar(true)
  }

  const empezarRenombrado = (): void => {
    if (vista.kind !== "window" || vista.renames === null || renombrado !== null) return
    const campo: HTMLInputElement = elemento("input")
    campo.className = "titulo"
    campo.value = vista.title
    campo.setAttribute("aria-label", "Nombre del contexto")
    campo.addEventListener("keydown", (evento: KeyboardEvent): void => {
      if (evento.key === "Enter") terminarRenombrado(true)
      if (evento.key === "Escape") terminarRenombrado(false)
    })
    campo.addEventListener("blur", (): void => terminarRenombrado(true))
    renombrado = { id: vista.renames, campo }
    titulo.replaceWith(campo)
    campo.focus()
    campo.select()
  }

  titulo.addEventListener("click", empezarRenombrado)
  titulo.addEventListener("keydown", (evento: KeyboardEvent): void => {
    if (evento.key === "Enter" || evento.key === " ") {
      evento.preventDefault()
      empezarRenombrado()
    }
  })

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
      notas.replaceChildren()
      sinNotas.hidden = true
      sinVentanas.hidden = false
      return
    }

    cabecera.hidden = false
    sinVentanas.hidden = true
    mostrar(anterior, vista.prev !== null)
    mostrar(siguiente, vista.next !== null)

    /* El título que se está editando no se toca: ahí manda lo que se teclea. */
    if (renombrado === null) {
      titulo.textContent = vista.title
      const renombrable: boolean = vista.renames !== null
      titulo.classList.toggle("renombrable", renombrable)
      titulo.tabIndex = renombrable ? 0 : -1
      if (renombrable) titulo.setAttribute("role", "button")
      else titulo.removeAttribute("role")
    }

    notas.replaceChildren(
      ...vista.notes.map((nota: Note): HTMLLIElement => {
        const fila: HTMLLIElement = elemento("li", nota.name)
        fila.dataset["id"] = nota.id
        return fila
      }),
    )
    sinNotas.hidden = vista.notes.length > 0
  }

  raiz.replaceChildren(
    ...(corrupt.length > 0 ? [corruptNotice(corrupt)] : []),
    cabecera,
    notas,
    sinNotas,
    sinVentanas,
  )
  pintar()
  store.subscribe((): void => pintar())
  windows.subscribe((): void => pintar())
}
