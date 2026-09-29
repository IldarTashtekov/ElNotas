/**
 * API pública de la UI.
 *
 * La UI sólo conoce al core: recibe el `Store` y los casos de uso ya montados, y
 * no sabe dónde se guarda nada. Quien la monta es `platform/`.
 */

export type { Caret, EditResult, EditorDeps } from "./editor.js"
export {
  pressBackspaceAtStart,
  pressEnter,
  startWriting,
  toggleCheckbox,
  toggleChecked,
} from "./editor.js"
export type { Located } from "./noteTree.js"
export {
  inReadingOrder,
  lineBeside,
  locate,
  mergeTarget,
  nextSibling,
  rootAncestor,
} from "./noteTree.js"
export type { WritingMode } from "./writingMode.js"
export { INITIAL_MODE, toggleNest } from "./writingMode.js"
export type { EditableTitle } from "./editableTitle.js"
export { createEditableTitle } from "./editableTitle.js"
export type { NoteViewDeps } from "./NoteView.js"
export { mountNoteView } from "./NoteView.js"
export type { KeyedContainer, ReconcileSteps } from "./reconcile.js"
export { reconcile, setAttrIfChanged, setTextIfChanged } from "./reconcile.js"
export type { BackStack } from "./backStack.js"
export { createBackStack } from "./backStack.js"
export type { NoteList, NoteListDeps } from "./NoteList.js"
export { createNoteList } from "./NoteList.js"
export {
  NEW_NOTE_NAME,
  createNoteIn,
  deleteQuestion,
  moveNotes,
  moveTargets,
  trashDeletes,
  trashNotes,
} from "./noteActions.js"
export type { Selection } from "./selection.js"
export { NO_SELECTION, pruneSelected, toggleSelected } from "./selection.js"
export type { AppDeps } from "./App.js"
export { mountApp } from "./App.js"
export type { SettingsViewDeps } from "./SettingsView.js"
export { NEW_CONTEXT_NAME, mountSettingsView } from "./SettingsView.js"
export type { SettingsContent, WindowRow } from "./settingsContent.js"
export { settingsContent } from "./settingsContent.js"
export type { WindowsViewDeps } from "./WindowsView.js"
export { mountWindowsView } from "./WindowsView.js"
export type { WindowView } from "./windowView.js"
export { GENERAL_TITLE, windowTitle, windowView } from "./windowView.js"
export { describeBootError, describeMigrationError, describeStorageError } from "./messages.js"
export type { WindowRef, WindowsLayout } from "./windows.js"
export {
  DEFAULT_LAYOUT,
  GENERAL,
  guardWindows,
  insertWindowAfter,
  parseWindowsLayout,
  removeWindowAt,
  replaceWindowAt,
  sameWindow,
  windowExists,
} from "./windows.js"
export type {
  WindowsListener,
  WindowsModel,
  WindowsModelDeps,
  WindowsPersistence,
} from "./windowsModel.js"
export { createWindowsModel } from "./windowsModel.js"
