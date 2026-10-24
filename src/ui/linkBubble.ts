/**
 * La burbuja de un enlace: un elemento con «↗ Abrir» y, si el enlace está
 * guardado, «Cambiar» y «Quitar», que se coloca bajo la línea que se escribe.
 * Quien la usa decide cuándo sale y qué hace cada botón; aquí sólo se dibuja y
 * se coloca.
 */

import { elemento } from "./dom.js"

export interface LinkBubble {
  readonly element: HTMLElement
  /** La enseña bajo `campo`, a la altura de `x` (de pantalla), dentro de `contenedor`. */
  readonly show: (saved: boolean, campo: HTMLElement, contenedor: HTMLElement, x: number) => void
  readonly hide: () => void
}

/** Un botón que no le quita el foco a la línea: el teclado del móvil no se cierra. */
const boton = (texto: string, alPulsar: () => void): HTMLButtonElement => {
  const b: HTMLButtonElement = elemento("button", texto)
  b.type = "button"
  b.addEventListener("pointerdown", (evento: PointerEvent): void => evento.preventDefault())
  b.addEventListener("click", alPulsar)
  return b
}

/** Lo que se separa de la línea. */
const HUECO_PX: number = 2

export const createLinkBubble = (acciones: {
  readonly onOpen: () => void
  readonly onChange: () => void
  readonly onRemove: () => void
}): LinkBubble => {
  const element: HTMLElement = elemento("div")
  element.className = "burbuja-enlace"
  element.hidden = true
  const abrir: HTMLButtonElement = boton("↗ Abrir", acciones.onOpen)
  const cambiar: HTMLButtonElement = boton("Cambiar", acciones.onChange)
  const quitar: HTMLButtonElement = boton("Quitar", acciones.onRemove)
  element.append(abrir, cambiar, quitar)

  return {
    element,
    show: (saved: boolean, campo: HTMLElement, contenedor: HTMLElement, x: number): void => {
      cambiar.hidden = !saved
      quitar.hidden = !saved
      /* Visible antes de medirla. */
      element.hidden = false
      const cont: DOMRect = contenedor.getBoundingClientRect()
      const linea: DOMRect = campo.getBoundingClientRect()
      const ancho: number = element.offsetWidth
      const alto: number = element.offsetHeight
      const izquierda: number = Math.max(0, Math.min(x - cont.left, cont.width - ancho))
      /* Bajo la línea; si abajo no cabe en pantalla y arriba sí, encima. */
      const pantalla: number = window.visualViewport?.height ?? window.innerHeight
      const abajoNoCabe: boolean = linea.bottom + HUECO_PX + alto > pantalla
      const arribaCabe: boolean = linea.top - HUECO_PX - alto >= 0
      const arriba: boolean = abajoNoCabe && arribaCabe
      const y: number = arriba ? linea.top - alto - HUECO_PX : linea.bottom + HUECO_PX
      element.style.left = `${izquierda}px`
      element.style.top = `${y - cont.top}px`
    },
    hide: (): void => {
      element.hidden = true
    },
  }
}
