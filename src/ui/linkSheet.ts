/**
 * La hoja de elegir a qué enlazar: arriba el texto que llevará el enlace, luego
 * un campo para pegar una dirección web y, debajo, las notas y los diagramas que
 * se pueden enlazar. La usan «Enlazar…» y «Cambiar»; qué se hace con lo elegido
 * (y con el texto, que puede ir en blanco) lo decide quien la abre.
 */

import { elemento } from "./dom.js"
import type { LinkChoices } from "./linkActions.js"
import { isWebAddress } from "./linkActions.js"
import type { Sheet } from "./sheet.js"

export interface LinkSheetOptions {
  readonly title: string
  readonly choices: LinkChoices
  /** Lo que lleva el campo del texto al abrirla; sin él, vacío. */
  readonly initialText?: string
  /** Lo que lleva el campo de la dirección al abrirla; sin él, vacío. */
  readonly initialAddress?: string
  /** Se pegó una dirección web válida, con el texto del campo tal cual; la hoja ya se cerró. */
  readonly onPickAddress: (direccion: string, texto: string) => void
  /** Se eligió una nota o un diagrama, con el texto del campo tal cual; la hoja ya se cerró. */
  readonly onPick: (kind: "note" | "diagram", id: string, name: string, texto: string) => void
}

export const openLinkSheet = (
  sheet: Sheet,
  { title, choices, initialText, initialAddress, onPickAddress, onPick }: LinkSheetOptions,
): void => {
  const texto: HTMLInputElement = elemento("input")
  texto.type = "text"
  texto.className = "enlazar-texto"
  texto.placeholder = "Texto del enlace"
  texto.setAttribute("aria-label", "Texto del enlace")
  texto.autocapitalize = "off"
  texto.spellcheck = false
  texto.value = initialText ?? ""
  const campo: HTMLInputElement = elemento("input")
  campo.type = "text"
  campo.placeholder = "Pega una dirección"
  campo.setAttribute("aria-label", "Pega una dirección")
  campo.autocapitalize = "off"
  campo.spellcheck = false
  campo.value = initialAddress ?? ""
  const enlazar: HTMLButtonElement = elemento("button", "Enlazar")
  enlazar.type = "button"
  const pegar: HTMLElement = elemento("div")
  pegar.className = "enlazar-direccion"
  pegar.append(campo, enlazar)

  const intentar = (): void => {
    const direccion: string = campo.value.trim()
    const valida: boolean = isWebAddress(direccion)
    campo.classList.toggle("invalido", !valida)
    if (!valida) return
    sheet.close()
    onPickAddress(direccion, texto.value)
  }
  enlazar.addEventListener("click", intentar)
  campo.addEventListener("keydown", (evento: KeyboardEvent): void => {
    if (evento.key !== "Enter" || evento.isComposing) return
    evento.preventDefault()
    intentar()
  })
  /* Intro en el texto pasa a la dirección. */
  texto.addEventListener("keydown", (evento: KeyboardEvent): void => {
    if (evento.key !== "Enter" || evento.isComposing) return
    evento.preventDefault()
    campo.focus()
  })
  campo.addEventListener("input", (): void => campo.classList.remove("invalido"))

  const lista: HTMLElement = elemento("div")
  lista.className = "selector"
  const fila = (kind: "note" | "diagram", id: string, name: string): HTMLButtonElement => {
    const b: HTMLButtonElement = elemento("button", name === "" ? "Sin nombre" : name)
    b.type = "button"
    b.addEventListener("click", (): void => {
      sheet.close()
      onPick(kind, id, name, texto.value)
    })
    return b
  }
  const rotulo = (texto: string): HTMLElement => {
    const grupo: HTMLElement = elemento("span", texto)
    grupo.className = "grupo"
    return grupo
  }
  if (choices.notes.length > 0) {
    lista.append(rotulo("Notas"))
    lista.append(...choices.notes.map((n: { readonly id: string; readonly name: string }): HTMLElement => fila("note", n.id, n.name)))
  }
  if (choices.diagrams.length > 0) {
    lista.append(rotulo("Diagramas"))
    lista.append(...choices.diagrams.map((d: { readonly id: string; readonly name: string }): HTMLElement => fila("diagram", d.id, d.name)))
  }
  sheet.open(title, [texto, pegar, lista])
}
