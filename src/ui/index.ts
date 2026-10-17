/**
 * API pública de la UI.
 *
 * La UI sólo conoce al core: recibe el `Store` y los casos de uso ya montados, y
 * no sabe dónde se guarda nada. Quien la monta es `platform/`. Sólo sale lo que
 * usa `platform/`; lo vigila `npm run check:exportaciones`.
 */

export type { MountedApp } from "./App.js"
export { mountApp } from "./App.js"
export type { DiagramFraming, FramingPersistence, Framings } from "./diagramFraming.js"
export { createDiagramFraming, parseFramings } from "./diagramFraming.js"
export type { OpenLayers, OpenLayersPersistence } from "./openLayers.js"
export { describeBootError, describeImportFailure } from "./messages.js"
export type {
  BackupActions,
  ExportResult,
  ImportPreparation,
  ImportSummary,
} from "./backup.js"
export type { WindowsLayout } from "./windows.js"
export { parseWindowsLayout } from "./windows.js"
export type { WindowsModel, WindowsPersistence } from "./windowsModel.js"
export { createWindowsModel } from "./windowsModel.js"
export type { Phosphor, PhosphorPersistence, PhosphorSetting } from "./phosphor.js"
export { createPhosphorSetting, parsePhosphor } from "./phosphor.js"
