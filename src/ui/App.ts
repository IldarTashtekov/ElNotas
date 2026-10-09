/**
 * La app entera: la vista ventanas siempre montada y, encima, la configuración,
 * una nota o un diagrama cuando se abren. Lo de encima se apila: de un diagrama
 * se entra a una nota, y al salir de ella se vuelve al diagrama.
 *
 * Lo de encima y el modo selección se cierran también con el atrás del
 * navegador —el del móvil incluido—, y comparten para eso un mismo historial.
 * Pasar de ventana no se apunta: el atrás no recorre ventanas.
 *
 * Arriba de todo, en cualquier vista, el aviso de que no se está guardando; y
 * encima de todo, la hoja que pregunta antes de borrar.
 */

import type { DiagramId, NoteId, StorageError, Store, UseCases } from "#core/index"
import type { BackStack } from "./backStack.js"
import { createBackStack } from "./backStack.js"
import { mountDiagramView } from "./DiagramView.js"
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
  /** «Borrar todo» de la configuración: lo hace quien sabe dónde se guarda. */
  readonly onResetAll: () => boolean
  /** La versión publicada, para el pie de la configuración; `null` en desarrollo. */
  readonly version: string | null
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
  /** Lo abierto encima de la ventana, de abajo arriba. Sólo se ve el último. */
  let capas: ReadonlyArray<HTMLElement> = []

  /** Monta algo encima de lo que se ve. `montar` devuelve cómo se desmonta. */
  const abrirEncima = (montar: (raiz: HTMLElement) => () => void): void => {
    const debajo: HTMLElement = capas[capas.length - 1] ?? principal
    const capa: HTMLElement = elemento("div")
    raiz.insertBefore(capa, pregunta.element)
    capas = [...capas, capa]
    /* Lo de debajo se esconde ANTES de montar: lo que se monte puede querer el
       foco, y en algo que va a esconderse no se quedaría. */
    debajo.hidden = true
    const desmontar: () => void = montar(capa)
    window.scrollTo(0, 0)
    back.open((): void => {
      desmontar()
      capa.remove()
      capas = capas.filter((c: HTMLElement): boolean => c !== capa)
      debajo.hidden = false
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

  const abrirDiagrama = (diagramId: DiagramId, editName: boolean): void =>
    abrirEncima((raiz: HTMLElement): (() => void) =>
      mountDiagramView(raiz, {
        ...deps,
        back,
        diagramId,
        editName,
        onExit: back.close,
        onOpenNote: abrirNota,
      }),
    )

  raiz.replaceChildren(aviso, principal, pregunta.element)
  mountWindowsView(principal, {
    ...deps,
    back,
    confirm,
    onOpenSettings: abrirConfiguracion,
    onOpenNote: abrirNota,
    onOpenDiagram: abrirDiagrama,
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
