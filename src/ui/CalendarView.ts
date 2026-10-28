/**
 * El calendario como pantalla: el mismo contenido en la vista que se abre con
 * el icono de la cabecera —encima, con su ✕— y en la ventana de la lista.
 *
 * Por ahora es el marco: el mes y los grupos de eventos llegan en las tareas
 * siguientes.
 */

import { elemento } from "./dom.js"
import { CALENDAR_TITLE } from "./windowView.js"

export interface CalendarViewDeps {
  readonly onExit: () => void
}

/** El contenido del calendario, sin cabecera: lo comparten la vista y la ventana. */
export const createCalendarPanel = (): HTMLElement => {
  const panel: HTMLElement = elemento("div")
  panel.className = "calendario"
  panel.append(elemento("p", "El calendario llega en las próximas tareas."))
  return panel
}

/** Devuelve la función que la desmonta. */
export const mountCalendarView = (raiz: HTMLElement, { onExit }: CalendarViewDeps): (() => void) => {
  const titulo: HTMLHeadingElement = elemento("h1", CALENDAR_TITLE)
  titulo.className = "titulo"
  const salir: HTMLButtonElement = elemento("button", "✕")
  salir.type = "button"
  salir.className = "flecha"
  salir.setAttribute("aria-label", "Salir del calendario")
  salir.addEventListener("click", onExit)
  const cabecera: HTMLElement = elemento("header")
  cabecera.className = "cabecera"
  cabecera.append(titulo, salir)
  raiz.replaceChildren(cabecera, createCalendarPanel())
  return (): void => raiz.replaceChildren()
}
