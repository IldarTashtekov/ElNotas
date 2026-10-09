/**
 * Qué enseña la vista configuración: las ventanas en su orden, todos los
 * contextos, y lo que se puede elegir como contenido de una ventana: el General,
 * los contextos, las notas y los diagramas.
 *
 * Puro, como `windowView`: la pantalla sólo lo pinta.
 */

import type { AppState, Context, Diagram, Note } from "#core/index"
import type { WindowRef, WindowsLayout } from "./windows.js"
import { GENERAL, sameWindow } from "./windows.js"
import { windowTitle } from "./windowView.js"

export interface WindowRow {
  readonly ref: WindowRef
  readonly title: string
}

export interface SettingsContent {
  readonly windows: ReadonlyArray<WindowRow>
  /** Todos los que existen, estén o no en alguna ventana, por nombre. */
  readonly contexts: ReadonlyArray<Context>
  /** Lo que puede enseñar una ventana: el General, cada contexto, cada nota y cada diagrama. */
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
  const diagramas: ReadonlyArray<Diagram> = [...Object.values<Diagram>(state.diagrams)].sort(
    (a: Diagram, b: Diagram): number => a.name.localeCompare(b.name),
  )
  const choices: ReadonlyArray<WindowRef> = [
    GENERAL,
    ...contexts.map((ctx: Context): WindowRef => ({ kind: "context", id: ctx.id })),
    ...notas.map((nota: Note): WindowRef => ({ kind: "note", id: nota.id })),
    ...diagramas.map((d: Diagram): WindowRef => ({ kind: "diagram", id: d.id })),
  ]
  return {
    windows: layout.windows.map(fila(state)),
    contexts,
    choices: choices.map(fila(state)),
  }
}

/**
 * Lo que ofrece el «+» de la última ventana: lo mismo que el selector de la
 * configuración, menos lo que ya está en alguna ventana.
 */
export const addWindowChoices = (layout: WindowsLayout, state: AppState): ReadonlyArray<WindowRow> =>
  settingsContent(layout, state).choices.filter(
    (opcion: WindowRow): boolean =>
      !layout.windows.some((w: WindowRef): boolean => sameWindow(w, opcion.ref)),
  )

/**
 * El rótulo que va delante de la primera opción de su grupo en un selector:
 * «Notas:» antes de la primera nota, «Diagramas:» antes del primer diagrama.
 * `null` en las demás, y en el General y los contextos, que van sin rótulo.
 */
export const choiceGroupLabel = (
  opciones: ReadonlyArray<WindowRow>,
  i: number,
): string | null => {
  const opcion: WindowRow | undefined = opciones[i]
  if (opcion === undefined) return null
  const clase: WindowRef["kind"] = opcion.ref.kind
  if (opciones[i - 1]?.ref.kind === clase) return null
  if (clase === "note") return "Notas:"
  if (clase === "diagram") return "Diagramas:"
  return null
}

/** «1 nota», «3 notas»: cuántas de algo, en singular o en plural. */
const cuantas = (n: number, singular: string, plural: string): string =>
  `${n} ${n === 1 ? singular : plural}`

/**
 * La pregunta de «Borrar todo»: cuenta lo que se pierde, para que no se confirme
 * a ciegas. Lo que no hay no se nombra; sin nada, se dice.
 */
export const resetQuestion = (state: AppState): string => {
  const partes: ReadonlyArray<string> = [
    [Object.keys(state.notes).length, "nota", "notas"] as const,
    [Object.keys(state.diagrams).length, "diagrama", "diagramas"] as const,
    [Object.keys(state.contexts).length, "contexto", "contextos"] as const,
  ]
    .filter(([n]): boolean => n > 0)
    .map(([n, singular, plural]): string => cuantas(n, singular, plural))
  if (partes.length === 0) return "¿Dejar la app en blanco? No hay nada guardado."
  const lista: string =
    partes.length === 1
      ? (partes[0] ?? "")
      : `${partes.slice(0, -1).join(", ")} y ${partes[partes.length - 1] ?? ""}`
  return `¿Borrar ${lista}, y las ventanas? No se puede deshacer.`
}

/**
 * La línea de la versión, al pie de la configuración. `null` es que no se está en
 * la versión publicada: la pone el script que la arma, y en desarrollo no existe.
 */
export const versionLine = (version: string | null): string =>
  version === null ? "Versión de desarrollo" : `Versión ${version}`
