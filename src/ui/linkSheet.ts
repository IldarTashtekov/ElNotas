/**
 * La hoja de elegir a qué enlazar: arriba el texto que llevará el enlace, luego
 * un campo para pegar una dirección web y, debajo, las notas, los diagramas, los
 * eventos y las rutinas que se pueden enlazar. La usan «Enlazar…» y «Cambiar»; qué se hace con lo elegido
 * (y con el texto, que puede ir en blanco) lo decide quien la abre.
 */

import { elemento } from "./dom.js"
import type { LinkChoice, LinkChoices, LinkKind } from "./linkActions.js"
import { isWebAddress } from "./linkActions.js"
import type { Sheet } from "./sheet.js"
import { textos } from "./textos/idioma.js"

export interface LinkSheetOptions {
  readonly title: string
  readonly choices: LinkChoices
  /** Lo que lleva el campo del texto al abrirla; sin él, vacío. */
  readonly initialText?: string
  /** Lo que lleva el campo de la dirección al abrirla; sin él, vacío. */
  readonly initialAddress?: string
  /** Se pegó una dirección web válida, con el texto del campo tal cual; la hoja ya se cerró. */
  readonly onPickAddress: (direccion: string, texto: string) => void
  /** Se eligió algo de la lista, con el texto del campo tal cual; la hoja ya se cerró. */
  readonly onPick: (kind: LinkKind, id: string, name: string, texto: string) => void
}

export const openLinkSheet = (
  sheet: Sheet,
  { title, choices, initialText, initialAddress, onPickAddress, onPick }: LinkSheetOptions,
): void => {
  const texto: HTMLInputElement = elemento("input")
  texto.type = "text"
  texto.className = "enlazar-texto"
  texto.placeholder = textos.enlaces.textoDelEnlace
  texto.setAttribute("aria-label", textos.enlaces.textoDelEnlace)
  texto.autocapitalize = "off"
  texto.spellcheck = false
  texto.value = initialText ?? ""
  const campo: HTMLInputElement = elemento("input")
  campo.type = "text"
  campo.placeholder = textos.enlaces.pegarDireccion
  campo.setAttribute("aria-label", textos.enlaces.pegarDireccion)
  campo.autocapitalize = "off"
  campo.spellcheck = false
  campo.value = initialAddress ?? ""
  const enlazar: HTMLButtonElement = elemento("button", textos.enlaces.enlazar)
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
  const fila = (kind: LinkKind, { id, name, detail }: LinkChoice<string>): HTMLButtonElement => {
    const sinNombre: string = name === "" ? textos.nombres.sinNombre : name
    const b: HTMLButtonElement = elemento("button", detail === undefined ? sinNombre : `${detail} · ${sinNombre}`)
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
  const grupo = (titulo: string, tipo: LinkKind, elegibles: ReadonlyArray<LinkChoice<string>>): void => {
    if (elegibles.length === 0) return
    lista.append(rotulo(titulo))
    lista.append(...elegibles.map((c: LinkChoice<string>): HTMLElement => fila(tipo, c)))
  }
  grupo(textos.enlaces.grupoNotas, "note", choices.notes)
  grupo(textos.enlaces.grupoDiagramas, "diagram", choices.diagrams)
  grupo(textos.enlaces.grupoEventos, "event", choices.events)
  grupo(textos.enlaces.grupoRutinas, "routine", choices.routines)
  sheet.open(title, [texto, pegar, lista])
}
