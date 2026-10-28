/**
 * El calendario como pantalla: el mismo contenido en la vista que se abre con
 * el icono de la cabecera —encima, con su ✕— y en la ventana de la lista.
 *
 * El contenido es `CalendarPanel`; aquí sólo va la cabecera de la vista.
 */

import type { CalendarPanel, CalendarPanelDeps } from "./CalendarPanel.js"
import { createCalendarPanel } from "./CalendarPanel.js"
import { elemento } from "./dom.js"
import { CALENDAR_TITLE } from "./windowView.js"

export interface CalendarViewDeps extends CalendarPanelDeps {
  readonly onExit: () => void
}

/** Devuelve la función que la desmonta. */
export const mountCalendarView = (raiz: HTMLElement, { onExit, ...deps }: CalendarViewDeps): (() => void) => {
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
  const panel: CalendarPanel = createCalendarPanel(deps)
  raiz.replaceChildren(cabecera, panel.element)
  return (): void => {
    panel.destroy()
    raiz.replaceChildren()
  }
}
