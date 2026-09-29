/**
 * API pública de la UI.
 *
 * La UI sólo conoce al core: recibe el `Store` y los casos de uso ya montados, y
 * no sabe dónde se guarda nada. Quien la monta es `platform/`.
 */

export type { WindowsViewDeps } from "./WindowsView.js"
export { mountWindowsView } from "./WindowsView.js"
export type { WindowView } from "./windowView.js"
export { GENERAL_TITLE, windowView } from "./windowView.js"
export { describeBootError, describeMigrationError, describeStorageError } from "./messages.js"
export type { WindowRef, WindowsLayout } from "./windows.js"
export { DEFAULT_LAYOUT, GENERAL, guardWindows, parseWindowsLayout, sameWindow } from "./windows.js"
export type {
  WindowsListener,
  WindowsModel,
  WindowsModelDeps,
  WindowsPersistence,
} from "./windowsModel.js"
export { createWindowsModel } from "./windowsModel.js"
