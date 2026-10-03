/**
 * La app entera: la vista ventanas siempre montada y, encima, la configuración o
 * una nota cuando se abren. Un solo nivel: de lo de encima no se abre otra cosa.
 *
 * Lo de encima y el modo selección se cierran también con el atrás del
 * navegador —el del móvil incluido—, y comparten para eso un mismo historial.
 * Pasar de ventana no se apunta: el atrás no recorre ventanas.
 *
 * Arriba de todo, en cualquier vista, el aviso de que no se está guardando; y
 * encima de todo, la hoja que pregunta antes de borrar.
 */

import type { NoteId, StorageError, Store, UseCases } from "#core/index"
import type { BackStack } from "./backStack.js"
import { createBackStack } from "./backStack.js"
import { elemento } from "./dom.js"
import { describeStorageError } from "./messages.js"
import { mountNoteView } from "./NoteView.js"
import { mountSettingsView } from "./SettingsView.js"
import type { Confirm, Sheet } from "./sheet.js"
import { createConfirm, createSheet } from "./sheet.js"
import { mountWindowsView } from "./WindowsView.js"
import type { WindowsModel } from "./windowsModel.js"

export interface AppDeps {
  readonly store: Store
  readonly useCases: UseCases
  readonly windows: WindowsModel
  readonly corrupt: ReadonlyArray<StorageError>
}

/** Lo que la app ofrece a quien la monta. */
export interface MountedApp {
  /** Avisa de que el guardado se ha detenido. Sólo informa: no se reanuda. */
  readonly showSaveError: (fallo: StorageError) => void
}

export const mountApp = (raiz: HTMLElement, deps: AppDeps): MountedApp => {
  const back: BackStack = createBackStack()
  /* Propia y no `window.confirm`: hay navegadores que la contestan «no» sin enseñarla. */
  const pregunta: Sheet = createSheet(back)
  const confirm: Confirm = createConfirm(pregunta)
  const aviso: HTMLElement = elemento("div")
  aviso.className = "aviso aviso-guardado"
  aviso.setAttribute("role", "alert")
  aviso.hidden = true
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
      mountSettingsView(raiz, { ...deps, confirm, back, onExit: back.close }),
    )
  const abrirNota = (noteId: NoteId): void =>
    abrirEncima((raiz: HTMLElement): (() => void) =>
      mountNoteView(raiz, { ...deps, noteId, onExit: back.close }),
    )

  raiz.replaceChildren(aviso, principal, encima, pregunta.element)
  mountWindowsView(principal, {
    ...deps,
    back,
    confirm,
    onOpenSettings: abrirConfiguracion,
    onOpenNote: abrirNota,
  })

  return {
    showSaveError: (fallo: StorageError): void => {
      aviso.replaceChildren(
        elemento("p", `No se están guardando los cambios. ${describeStorageError(fallo)}`),
        elemento("p", "Lo que ves sigue aquí, pero se perderá al cerrar la página."),
      )
      /* Otra pestaña cambió lo mismo: lo que hay en el almacén es lo bueno, y
         recargar trae esa versión. Lo escrito aquí desde el último guardado se pierde. */
      if (fallo.kind === "stale") {
        const recargar: HTMLButtonElement = elemento("button", "Recargar")
        recargar.type = "button"
        recargar.className = "recargar"
        recargar.addEventListener("click", (): void => window.location.reload())
        aviso.append(recargar)
      }
      aviso.hidden = false
    },
  }
}
