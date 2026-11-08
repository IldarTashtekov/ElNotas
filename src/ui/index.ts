/**
 * API pública de la UI.
 *
 * La UI sólo conoce al core: recibe el `Store` y los casos de uso ya montados, y
 * no sabe dónde se guarda nada. Quien la monta es `platform/`. Sólo sale lo que
 * usa `platform/`; lo vigila `npm run check:exportaciones`.
 */

export type { MountedApp } from "./App.js"
export { mountApp } from "./App.js"
export type { DiagramFraming } from "./diagramFraming.js"
export { createDiagramFraming } from "./diagramFraming.js"
export { textos } from "./textos/idioma.js"
export type { OpenLayers, OpenLayersPersistence } from "./openLayers.js"
export { describeBootError, describeImportFailure } from "./messages.js"
export type { BackupActions, ExportResult, ImportPreparation, ImportSummary } from "./backup.js"
export type { WindowsModel } from "./windowsModel.js"
export { createWindowsModel } from "./windowsModel.js"
export type { Phosphor, PhosphorSetting } from "./phosphor.js"
export { createPhosphorSetting } from "./phosphor.js"
export type { CalendarTabSetting } from "./calendarTab.js"
export { createCalendarTabSetting } from "./calendarTab.js"
export type { RoutineChartsSetting } from "./routineCharts.js"
export { createRoutineChartsSetting } from "./routineCharts.js"
export type { StoredUiState, UiStatePersistence } from "./uiState.js"
export { parseUiState, uiStateSection } from "./uiState.js"
