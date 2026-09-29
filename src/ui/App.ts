/**
 * La app entera: la vista ventanas siempre montada y, encima, la configuración o
 * una nota cuando se abren. Un solo nivel: de lo de encima no se abre otra cosa.
 *
 * Lo de encima y el modo selección se cierran también con el atrás del
 * navegador —el del móvil incluido—, y comparten para eso un mismo historial.
 * Pasar de ventana no se apunta: el atrás no recorre ventanas.
 */

import type { NoteId, StorageError, Store, UseCases } from "#core/index"
import type { BackStack } from "./backStack.js"
import { createBackStack } from "./backStack.js"
import { elemento } from "./dom.js"
import { mountNoteView } from "./NoteView.js"
import { mountSettingsView } from "./SettingsView.js"
import { mountWindowsView } from "./WindowsView.js"
import type { WindowsModel } from "./windowsModel.js"

export interface AppDeps {
  readonly store: Store
  readonly useCases: UseCases
  readonly windows: WindowsModel
  readonly corrupt: ReadonlyArray<StorageError>
  readonly confirm: (pregunta: string) => boolean
}

export const mountApp = (raiz: HTMLElement, deps: AppDeps): void => {
  const back: BackStack = createBackStack()
  const principal: HTMLElement = elemento("div")
  const encima: HTMLElement = elemento("div")
  encima.hidden = true

  /** Monta algo encima de la ventana. `montar` devuelve cómo se desmonta. */
  const abrirEncima = (montar: (raiz: HTMLElement) => () => void): void => {
    if (back.isOpen()) return
    const desmontar: () => void = montar(encima)
    principal.hidden = true
    encima.hidden = false
    window.scrollTo(0, 0)
    back.open((): void => {
      desmontar()
      encima.hidden = true
      principal.hidden = false
    })
  }

  /* Salir ES ir atrás: así el exit y el atrás del navegador no pueden divergir. */
  const abrirConfiguracion = (): void =>
    abrirEncima((raiz: HTMLElement): (() => void) =>
      mountSettingsView(raiz, { ...deps, onExit: back.close }),
    )
  const abrirNota = (noteId: NoteId): void =>
    abrirEncima((raiz: HTMLElement): (() => void) =>
      mountNoteView(raiz, { ...deps, noteId, onExit: back.close }),
    )

  raiz.replaceChildren(principal, encima)
  mountWindowsView(principal, {
    ...deps,
    back,
    onOpenSettings: abrirConfiguracion,
    onOpenNote: abrirNota,
  })
}
