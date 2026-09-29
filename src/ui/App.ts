/**
 * La app entera: la vista ventanas siempre montada y, encima, la configuración
 * cuando se abre.
 *
 * La configuración y el modo selección se cierran también con el atrás del
 * navegador —el del móvil incluido—, y comparten para eso un mismo historial.
 * Pasar de ventana no se apunta: el atrás no recorre ventanas.
 */

import type { StorageError, Store, UseCases } from "#core/index"
import type { BackStack } from "./backStack.js"
import { createBackStack } from "./backStack.js"
import { elemento } from "./dom.js"
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

  const abrirConfiguracion = (): void => {
    if (back.isOpen()) return
    /* Salir ES ir atrás: así el ✕ y el atrás del navegador no pueden divergir. */
    const desmontar: () => void = mountSettingsView(encima, { ...deps, onExit: back.close })
    principal.hidden = true
    encima.hidden = false
    window.scrollTo(0, 0)
    back.open((): void => {
      desmontar()
      encima.hidden = true
      principal.hidden = false
    })
  }

  raiz.replaceChildren(principal, encima)
  mountWindowsView(principal, { ...deps, back, onOpenSettings: abrirConfiguracion })
}
