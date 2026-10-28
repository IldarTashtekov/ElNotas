/**
 * La app entera: la vista ventanas siempre montada y, encima, la configuración,
 * el calendario, una nota o un diagrama cuando se abren. Lo de encima se apila: de un diagrama
 * se entra a una nota, y al salir de ella se vuelve al diagrama.
 *
 * Lo de encima y el modo selección se cierran también con el atrás del
 * navegador —el del móvil incluido—, y comparten para eso un mismo historial.
 * Pasar de ventana no se apunta: el atrás no recorre ventanas. La nota o el
 * diagrama abiertos encima se guardan, y al recargar se vuelven a abrir.
 *
 * Arriba de todo, en cualquier vista, el aviso de que no se está guardando; y
 * encima de todo, la hoja que pregunta antes de borrar.
 */

import type { Day, DiagramId, Logger, NoteId, Result, StorageError, Store, UseCases } from "#core/index"
import type { BackStack } from "./backStack.js"
import type { BackupActions } from "./backup.js"
import { createBackStack } from "./backStack.js"
import { mountCalendarView } from "./CalendarView.js"
import type { DiagramFraming } from "./diagramFraming.js"
import { mountDiagramView } from "./DiagramView.js"
import { elemento } from "./dom.js"
import { describeStorageError } from "./messages.js"
import { mountNoteView } from "./NoteView.js"
import type { OpenLayer, OpenLayersPersistence } from "./openLayers.js"
import { layersToRestore } from "./openLayers.js"
import type { PhosphorSetting } from "./phosphor.js"
import { mountSettingsView } from "./SettingsView.js"
import type { Confirm, Sheet } from "./sheet.js"
import { createConfirm, createSheet } from "./sheet.js"
import { mountWindowsView } from "./WindowsView.js"
import type { WindowsModel } from "./windowsModel.js"

export interface AppDeps {
  readonly store: Store
  readonly useCases: UseCases
  readonly windows: WindowsModel
  /** Dónde se miraba cada diagrama, compartido por su vista y su ventana. */
  readonly framing: DiagramFraming
  /** El color de la pantalla, que se elige en la configuración. */
  readonly phosphor: PhosphorSetting
  /** Dónde se guarda lo abierto encima de la ventana, para volver a ello al recargar. */
  readonly openLayers: OpenLayersPersistence
  readonly corrupt: ReadonlyArray<StorageError>
  /** «Borrar todo» de la configuración: lo hace quien sabe dónde se guarda. */
  readonly onResetAll: () => boolean
  /** Exportar e importar la copia, en la configuración: también lo hace quien sabe dónde se guarda. */
  readonly backup: BackupActions
  /** La versión publicada, para el pie de la configuración; `null` en desarrollo. */
  readonly version: string | null
  readonly logger: Logger
  /** El día de hoy en este dispositivo, para el calendario; `null` si se sale del rango. */
  readonly today: () => Day | null
}

/** Lo que la app ofrece a quien la monta. */
export interface MountedApp {
  /** Avisa de que el guardado se ha detenido. Sólo informa: no se reanuda. */
  readonly showSaveError: (fallo: StorageError) => void
}

export const mountApp = (raiz: HTMLElement, deps: AppDeps): MountedApp => {
  const back: BackStack = createBackStack(deps.logger)
  /* Propia y no `window.confirm`: hay navegadores que la contestan «no» sin enseñarla. */
  const pregunta: Sheet = createSheet(back)
  const confirm: Confirm = createConfirm(pregunta)
  const aviso: HTMLElement = elemento("div")
  aviso.className = "aviso aviso-guardado"
  aviso.setAttribute("role", "alert")
  aviso.hidden = true
  const principal: HTMLElement = elemento("div")
  /** Lo abierto encima de la ventana, de abajo arriba. Sólo se ve el último. La
      configuración no lleva `abierta`: al recargar no se vuelve a ella. */
  let capas: ReadonlyArray<{ readonly elemento: HTMLElement; readonly abierta: OpenLayer | null }> = []

  /* Un fallo al guardar no se avisa, como el de las ventanas: sólo se pierde
     volver a lo abierto al recargar. Queda en la consola. */
  const guardarAbiertas = (): void => {
    const guardado: Result<void, StorageError> = deps.openLayers.save(
      capas.flatMap(({ abierta }): ReadonlyArray<OpenLayer> => (abierta === null ? [] : [abierta])),
    )
    if (!guardado.ok) deps.logger.failure("no se guardó lo abierto encima", guardado.error)
  }

  /** Monta algo encima de lo que se ve. `montar` devuelve cómo se desmonta. */
  const abrirEncima = (abierta: OpenLayer | null, montar: (raiz: HTMLElement) => () => void): void => {
    const debajo: HTMLElement = capas[capas.length - 1]?.elemento ?? principal
    const capa: HTMLElement = elemento("div")
    raiz.insertBefore(capa, pregunta.element)
    capas = [...capas, { elemento: capa, abierta }]
    guardarAbiertas()
    /* Lo de debajo se esconde ANTES de montar: lo que se monte puede querer el
       foco, y en algo que va a esconderse no se quedaría. */
    debajo.hidden = true
    const desmontar: () => void = montar(capa)
    window.scrollTo(0, 0)
    back.open((): void => {
      desmontar()
      capa.remove()
      capas = capas.filter(({ elemento }): boolean => elemento !== capa)
      guardarAbiertas()
      debajo.hidden = false
    })
  }

  /* Salir ES ir atrás: así el exit y el atrás del navegador no pueden divergir. */
  const abrirConfiguracion = (): void =>
    abrirEncima(null, (raiz: HTMLElement): (() => void) =>
      mountSettingsView(raiz, { ...deps, confirm, back, onExit: back.close }),
    )
  /* Como la configuración: no lleva `abierta`, al recargar no se vuelve a ella. */
  const abrirCalendario = (): void =>
    abrirEncima(null, (raiz: HTMLElement): (() => void) =>
      mountCalendarView(raiz, { ...deps, confirm, back, onExit: back.close }),
    )
  const abrirNota = (noteId: NoteId): void =>
    abrirEncima({ kind: "note", id: noteId }, (raiz: HTMLElement): (() => void) =>
      mountNoteView(raiz, {
        ...deps,
        noteId,
        onExit: back.close,
        onOpenNote: abrirNota,
        onOpenDiagram: (id: DiagramId): void => abrirDiagrama(id, false),
        sheet: pregunta,
      }),
    )

  const abrirDiagrama = (diagramId: DiagramId, editName: boolean): void =>
    abrirEncima({ kind: "diagram", id: diagramId }, (raiz: HTMLElement): (() => void) =>
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
    onOpenCalendar: abrirCalendario,
    onOpenNote: abrirNota,
    onOpenDiagram: abrirDiagrama,
  })
  /* Lo que había abierto antes de recargar, en el mismo orden, con su atrás. */
  for (const abierta of layersToRestore(deps.openLayers, deps.store.getState())) {
    if (abierta.kind === "note") abrirNota(abierta.id)
    else abrirDiagrama(abierta.id, false)
  }

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
