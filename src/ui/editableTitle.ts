/**
 * Un título que se renombra tocándolo: se convierte en un campo, Intro o tocar
 * fuera guardan, Escape cancela.
 *
 * Lo usan la ventana de un contexto y la vista nota. Mientras se escribe, el
 * título no se repinta: ahí manda lo que se teclea.
 */

import { elemento } from "./dom.js"

export interface EditableTitle {
  readonly element: HTMLElement
  /** El título que se enseña, y si se puede renombrar. Se ignora mientras se edita. */
  readonly show: (titulo: string, renombrable: boolean) => void
  /** Lo pone a editar sin tocarlo, como si se hubiera tocado. Nada si no se puede renombrar. */
  readonly edit: () => void
}

export const createEditableTitle = (
  etiqueta: string,
  onRename: (nombre: string) => void,
): EditableTitle => {
  const titulo: HTMLHeadingElement = elemento("h1")
  titulo.className = "titulo"
  let actual: string = ""
  let renombrable: boolean = false
  let campo: HTMLInputElement | null = null

  const terminar = (guardar: boolean): void => {
    if (campo === null) return
    const editado: HTMLInputElement = campo
    /* Se suelta ANTES de tocar el DOM: quitar el campo dispara su `blur`, que
       vuelve a llamar aquí y tiene que encontrarse con que ya no hay nada. */
    campo = null
    const nombre: string = editado.value.trim()
    editado.replaceWith(titulo)
    if (guardar && nombre !== "" && nombre !== actual) onRename(nombre)
  }

  const empezar = (): void => {
    if (!renombrable || campo !== null) return
    const nuevo: HTMLInputElement = elemento("input")
    nuevo.className = "titulo"
    nuevo.value = actual
    nuevo.setAttribute("aria-label", etiqueta)
    nuevo.addEventListener("keydown", (evento: KeyboardEvent): void => {
      if (evento.key === "Enter") terminar(true)
      if (evento.key === "Escape") terminar(false)
    })
    nuevo.addEventListener("blur", (): void => terminar(true))
    campo = nuevo
    titulo.replaceWith(nuevo)
    nuevo.focus()
    nuevo.select()
  }

  titulo.addEventListener("click", empezar)
  titulo.addEventListener("keydown", (evento: KeyboardEvent): void => {
    if (evento.key === "Enter" || evento.key === " ") {
      evento.preventDefault()
      empezar()
    }
  })

  return {
    element: titulo,
    show: (texto: string, puede: boolean): void => {
      actual = texto
      renombrable = puede
      if (campo !== null) return
      if (titulo.textContent !== texto) titulo.textContent = texto
      titulo.classList.toggle("renombrable", puede)
      titulo.tabIndex = puede ? 0 : -1
      if (puede) titulo.setAttribute("role", "button")
      else titulo.removeAttribute("role")
    },
    edit: empezar,
  }
}
