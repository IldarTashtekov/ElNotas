/**
 * API pública de la UI.
 *
 * La UI sólo conoce al core: recibe el `Store` y los casos de uso ya montados, y
 * no sabe dónde se guarda nada. Quien la monta es `platform/`.
 */

export type { NoteEditor, NoteEditorDeps } from "./NoteEditor.js"
export { createNoteEditor } from "./NoteEditor.js"
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
export type { DiagramViewDeps } from "./DiagramView.js"
export { mountDiagramView } from "./DiagramView.js"
export type { KeyedContainer, ReconcileSteps } from "./reconcile.js"
export { reconcile, setAttrIfChanged, setTextIfChanged } from "./reconcile.js"
export type { BackStack } from "./backStack.js"
export { createBackStack } from "./backStack.js"
export type { Confirm, Sheet } from "./sheet.js"
export { createConfirm, createSheet } from "./sheet.js"
export type { NoteList, NoteListDeps } from "./NoteList.js"
export { createNoteList } from "./NoteList.js"
export {
  NEW_DIAGRAM_NAME,
  NEW_NOTE_NAME,
  contextsWith,
  createDiagramIn,
  createNoteForDiagram,
  createNoteIn,
  deleteQuestion,
  moveItems,
  moveTargets,
  trashDeletes,
  trashItems,
} from "./noteActions.js"
export type { Selection } from "./selection.js"
export { NO_SELECTION, itemKey, pruneSelected, toggleSelected } from "./selection.js"
export type { AppDeps, MountedApp } from "./App.js"
export { mountApp } from "./App.js"
export type { SettingsViewDeps } from "./SettingsView.js"
export { NEW_CONTEXT_NAME, mountSettingsView } from "./SettingsView.js"
export type { SettingsContent, WindowRow } from "./settingsContent.js"
export { addWindowChoices, choiceGroupLabel, settingsContent } from "./settingsContent.js"
export { dropIndex } from "./dropIndex.js"
export type { Point, Viewport } from "./viewport.js"
export {
  MAX_SCALE,
  MIN_SCALE,
  centeredViewport,
  panBy,
  pinch,
  toCanvas,
  toScreen,
  wheelFactor,
  zoomAround,
} from "./viewport.js"
export { paintOrder, raise } from "./paintOrder.js"
export type { Tap } from "./gestures.js"
export {
  DOUBLE_TAP_DISTANCE_PX,
  DOUBLE_TAP_MS,
  LONG_PRESS_MS,
  MOVE_TOLERANCE_PX,
  isDoubleTap,
  movedBeyondTolerance,
} from "./gestures.js"
export type { WindowsViewDeps } from "./WindowsView.js"
export { mountWindowsView } from "./WindowsView.js"
export type { ListItem, WindowView } from "./windowView.js"
export { GENERAL_TITLE, windowTitle, windowView } from "./windowView.js"
export { describeBootError, describeMigrationError, describeStorageError } from "./messages.js"
export type { WindowRef, WindowsLayout } from "./windows.js"
export {
  DEFAULT_LAYOUT,
  GENERAL,
  guardWindows,
  insertWindowAfter,
  moveWindow,
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
