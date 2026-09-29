/**
 * Qué enseña la vista configuración: las ventanas en su orden, todos los
 * contextos, y lo que se puede elegir como contenido de una ventana.
 *
 * Puro, como `windowView`: la pantalla sólo lo pinta.
 */

import type { AppState, Context } from "#core/index"
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
  /** Lo que puede enseñar una ventana: el General y cada contexto. */
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
  const choices: ReadonlyArray<WindowRef> = [
    GENERAL,
    ...contexts.map((ctx: Context): WindowRef => ({ kind: "context", id: ctx.id })),
  ]
  return {
    windows: layout.windows.map(fila(state)),
    contexts,
    choices: choices.map(fila(state)),
  }
}
