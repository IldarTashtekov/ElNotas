/**
 * Ayudantes de DOM que comparten las vistas: crear un elemento con su texto, y el
 * aviso de ficheros que no se pudieron leer al arrancar.
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

export const corruptNotice = (corrupt: ReadonlyArray<StorageError>): HTMLElement => {
  const aviso: HTMLElement = elemento("div")
  aviso.className = "aviso"
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
    elemento("p", "Siguen guardados sin tocar. El resto está bien."),
  )
  return aviso
}
