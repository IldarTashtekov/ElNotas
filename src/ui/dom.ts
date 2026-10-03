/**
 * Ayudantes de DOM que comparten las vistas: crear un elemento con su texto, y el
 * aviso de ficheros que no se pudieron leer al arrancar, que flota arriba unos
 * segundos y se difumina.
 */

import type { StorageError } from "#core/index"
import { describeStorageError } from "./messages.js"

export const elemento = <K extends keyof HTMLElementTagNameMap>(
  etiqueta: K,
  texto?: string,
): HTMLElementTagNameMap[K] => {
  const el: HTMLElementTagNameMap[K] = document.createElement(etiqueta)
  /* `textContent` y nunca `innerHTML`: los nombres los escribe el usuario. */
  if (texto !== undefined) el.textContent = texto
  return el
}

/** Lo que dura el aviso de ficheros ilegibles antes de difuminarse. */
const AVISO_MS: number = 6000
/** Lo que tarda en difuminarse: el mismo tiempo que la transición de `.aviso-temporal`. */
const DIFUMINAR_MS: number = 600

export const corruptNotice = (corrupt: ReadonlyArray<StorageError>): HTMLElement => {
  const aviso: HTMLElement = elemento("div")
  aviso.className = "aviso aviso-temporal"
  aviso.setAttribute("role", "alert")
  const lista: HTMLUListElement = elemento("ul")
  lista.append(
    ...corrupt.map((fallo: StorageError): HTMLLIElement => elemento("li", describeStorageError(fallo))),
  )
  aviso.append(
    elemento(
      "p",
      corrupt.length === 1
        ? "Un fichero no se ha podido leer y se ha dejado fuera:"
        : `${corrupt.length} ficheros no se han podido leer y se han dejado fuera:`,
    ),
    lista,
    elemento(
      "p",
      corrupt.length === 1
        ? "Sigue guardado sin tocar. El resto está bien."
        : "Siguen guardados sin tocar. El resto está bien.",
    ),
  )
  /* Se difumina solo, o antes si se toca; al acabar, se quita. Con un tiempo y no
     con `transitionend`, que en una pestaña oculta no llega. */
  const irse = (): void => {
    aviso.classList.add("fuera")
    setTimeout((): void => aviso.remove(), DIFUMINAR_MS)
  }
  const espera: ReturnType<typeof setTimeout> = setTimeout(irse, AVISO_MS)
  aviso.addEventListener("click", (): void => {
    clearTimeout(espera)
    irse()
  })
  return aviso
}
