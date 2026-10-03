/**
 * Una hoja que sube desde abajo, sobre la pantalla oscurecida, con lo que haya
 * que elegir.
 *
 * Se cierra con el atrás, con Escape, tocando fuera o con «Cancelar», y entonces
 * el foco vuelve a donde estaba. Lo que lleva dentro lo pone quien la abre; la
 * pregunta antes de borrar es una de ellas (`createConfirm`).
 */

import type { BackStack } from "./backStack.js"
import { elemento } from "./dom.js"

export interface Sheet {
  readonly element: HTMLElement
  /** La abre con ese título —vacío, sin título— y ese contenido. Nada si ya está abierta. */
  readonly open: (titulo: string, contenido: ReadonlyArray<HTMLElement>) => void
  /** La cierra tras elegir algo. El foco no vuelve: lo pone quien la cierra. */
  readonly close: () => void
}

export const createSheet = (back: BackStack): Sheet => {
  const fondo: HTMLDivElement = elemento("div")
  fondo.className = "hoja-fondo"
  fondo.hidden = true
  const hoja: HTMLDivElement = elemento("div")
  hoja.className = "hoja"
  hoja.setAttribute("role", "dialog")
  hoja.setAttribute("aria-modal", "true")
  const cabeza: HTMLHeadingElement = elemento("h2")
  const cuerpo: HTMLDivElement = elemento("div")
  cuerpo.className = "hoja-cuerpo"
  const cancelar: HTMLButtonElement = elemento("button", "Cancelar")
  cancelar.type = "button"
  cancelar.className = "secundario hoja-cancelar"
  hoja.append(cabeza, cuerpo, cancelar)
  fondo.append(hoja)

  /** Dónde estaba el foco al abrirla, y si hay que devolverlo al cerrar. */
  let volverA: HTMLElement | null = null
  let devolverFoco: boolean = true

  /* Lo llama el `popstate`, cierre quien la cierre. */
  const esconder = (): void => {
    fondo.hidden = true
    cuerpo.replaceChildren()
    if (devolverFoco) volverA?.focus()
    volverA = null
  }

  const descartar = (): void => {
    devolverFoco = true
    back.close()
  }
  cancelar.addEventListener("click", descartar)
  fondo.addEventListener("click", (evento: MouseEvent): void => {
    if (evento.target === fondo) descartar()
  })
  fondo.addEventListener("keydown", (evento: KeyboardEvent): void => {
    if (evento.key !== "Escape") return
    evento.preventDefault()
    /* Cierra la hoja y nada más: que no llegue al Escape del modo selección. */
    evento.stopPropagation()
    descartar()
  })

  return {
    element: fondo,
    open: (titulo: string, contenido: ReadonlyArray<HTMLElement>): void => {
      if (!fondo.hidden) return
      volverA = document.activeElement instanceof HTMLElement ? document.activeElement : null
      devolverFoco = true
      cabeza.textContent = titulo
      cabeza.hidden = titulo === ""
      cuerpo.replaceChildren(...contenido)
      hoja.setAttribute("aria-label", titulo !== "" ? titulo : (contenido[0]?.textContent ?? ""))
      fondo.hidden = false
      back.open(esconder)
      hoja.querySelector<HTMLElement>("button")?.focus()
    },
    close: (): void => {
      devolverFoco = false
      /* Se esconde ya: el `popstate` del atrás llega un poco más tarde. */
      fondo.hidden = true
      back.close()
    },
  }
}

/**
 * Preguntar antes de algo que no tiene vuelta atrás: la pregunta, un botón rojo
 * que lo hace y «Cancelar». `alAceptar` sólo corre si se pulsa el rojo.
 */
export type Confirm = (pregunta: string, boton: string, alAceptar: () => void) => void

export const createConfirm = (sheet: Sheet): Confirm =>
  (pregunta: string, boton: string, alAceptar: () => void): void => {
    const texto: HTMLParagraphElement = elemento("p", pregunta)
    texto.className = "hoja-pregunta"
    const hacer: HTMLButtonElement = elemento("button", boton)
    hacer.type = "button"
    hacer.className = "hoja-peligro"
    hacer.addEventListener("click", (): void => {
      sheet.close()
      alAceptar()
    })
    sheet.open("", [texto, hacer])
  }
