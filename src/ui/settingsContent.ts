/**
 * Qué enseña la vista configuración: las ventanas en su orden, todos los
 * contextos, y lo que se puede elegir como contenido de una ventana: el General,
 * los contextos y las notas.
 *
 * Puro, como `windowView`: la pantalla sólo lo pinta.
 */

import type { AppState, Context, Note } from "#core/index"
import type { WindowRef, WindowsLayout } from "./windows.js"
import { GENERAL } from "./windows.js"
import { windowTitle } from "./windowView.js"

export interface WindowRow {
  readonly ref: WindowRef
  readonly title: string
}

export interface SettingsContent {
  readonly windows: ReadonlyArray<WindowRow>
  /** Todos los que existen, estén o no en alguna ventana, por nombre. */
  readonly contexts: ReadonlyArray<Context>
  /** Lo que puede enseñar una ventana: el General, cada contexto y cada nota. */
  readonly choices: ReadonlyArray<WindowRow>
}

const fila = (state: AppState): ((ref: WindowRef) => WindowRow) => (ref: WindowRef): WindowRow => ({
  ref,
  title: windowTitle(ref, state),
})

export const settingsContent = (layout: WindowsLayout, state: AppState): SettingsContent => {
  const contexts: ReadonlyArray<Context> = [...Object.values<Context>(state.contexts)].sort(
    (a: Context, b: Context): number => a.name.localeCompare(b.name),
  )
  const notas: ReadonlyArray<Note> = [...Object.values<Note>(state.notes)].sort(
    (a: Note, b: Note): number => a.name.localeCompare(b.name),
  )
  const choices: ReadonlyArray<WindowRef> = [
    GENERAL,
    ...contexts.map((ctx: Context): WindowRef => ({ kind: "context", id: ctx.id })),
    ...notas.map((nota: Note): WindowRef => ({ kind: "note", id: nota.id })),
  ]
  return {
    windows: layout.windows.map(fila(state)),
    contexts,
    choices: choices.map(fila(state)),
  }
}
