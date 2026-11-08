/**
 * Los tres botones de crear algo y enseñarlo en una ventana nueva —contexto,
 * nota y diagrama—, en vídeo inverso y uno bajo otro. Los pone el «+» de las
 * pestañas, en su hoja.
 *
 * Crea; lo que se hace con la ventana nueva lo decide quien los pone.
 */

import type { UseCases } from "#core/index"
import { elemento } from "./dom.js"
import { createAsWindow } from "./noteActions.js"
import type { WindowRef } from "./windows.js"
import { textos } from "./textos/idioma.js"

export const newWindowButtons = (useCases: UseCases, alCrear: (ref: WindowRef) => void): HTMLElement => {
  const nuevo = (texto: string, kind: "context" | "note" | "diagram"): HTMLButtonElement => {
    const b: HTMLButtonElement = elemento("button", texto)
    b.type = "button"
    b.className = "hoja-nuevo"
    b.addEventListener("click", (): void => {
      const ref: WindowRef | null = createAsWindow(useCases, kind)
      if (ref !== null) alCrear(ref)
    })
    return b
  }
  const caja: HTMLElement = elemento("div")
  caja.className = "hoja-nuevos"
  caja.append(
    nuevo(textos.ventanas.contextoNuevo, "context"),
    nuevo(textos.ventanas.notaNueva, "note"),
    nuevo(textos.ventanas.diagramaNuevo, "diagram"),
  )
  return caja
}
