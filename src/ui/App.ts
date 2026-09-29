/**
 * La app entera: la vista ventanas siempre montada y, encima, la configuración
 * cuando se abre.
 *
 * Abrir la configuración se apunta en el historial del navegador, así que salir
 * con ✕ y con el atrás —también el del móvil— son lo mismo. Pasar de ventana no
 * se apunta: el atrás no recorre ventanas.
 */

import type { StorageError, Store, UseCases } from "#core/index"
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
  const principal: HTMLElement = elemento("div")
  const encima: HTMLElement = elemento("div")
  encima.hidden = true

  /** Cómo se cierra lo que hay encima, o `null` si no hay nada. */
  let cerrar: (() => void) | null = null

  const abrirConfiguracion = (): void => {
    if (cerrar !== null) return
    window.history.pushState({ encima: "configuracion" }, "")
    const desmontar: () => void = mountSettingsView(encima, {
      ...deps,
      /* Salir ES ir atrás: así el ✕ y el atrás del navegador no pueden divergir. */
      onExit: (): void => window.history.back(),
    })
    principal.hidden = true
    encima.hidden = false
    window.scrollTo(0, 0)
    cerrar = (): void => {
      desmontar()
      encima.hidden = true
      principal.hidden = false
      cerrar = null
    }
  }

  /* Al recargar, lo que hubiera encima no se recuerda: se empieza en la ventana. */
  window.history.replaceState(null, "")
  window.addEventListener("popstate", (): void => {
    if (cerrar !== null) cerrar()
  })

  raiz.replaceChildren(principal, encima)
  mountWindowsView(principal, { ...deps, onOpenSettings: abrirConfiguracion })
}
