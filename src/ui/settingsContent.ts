/**
 * Qué enseña la vista configuración: las ventanas en su orden, todos los
 * contextos, y lo que se puede elegir como contenido de una ventana: el General,
 * los contextos, las notas y los diagramas. Y lo que dice al borrar, exportar e
 * importar.
 *
 * Puro, como `windowView`: la pantalla sólo lo pinta.
 */

import type { AppState, Context, Diagram, Note } from "#core/index"
import type { ExportResult, ImportPreparation, ImportSummary } from "./backup.js"
import { describeBootError, describeStorageError } from "./messages.js"
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
 * «2 notas, 1 diagrama y 3 contextos». Lo que no hay no se nombra; `null` si no
 * hay nada.
 */
const recuento = (notas: number, diagramas: number, contextos: number): string | null => {
  const partes: ReadonlyArray<string> = [
    [notas, "nota", "notas"] as const,
    [diagramas, "diagrama", "diagramas"] as const,
    [contextos, "contexto", "contextos"] as const,
  ]
    .filter(([n]): boolean => n > 0)
    .map(([n, singular, plural]): string => cuantas(n, singular, plural))
  if (partes.length === 0) return null
  return partes.length === 1
    ? (partes[0] ?? "")
    : `${partes.slice(0, -1).join(", ")} y ${partes[partes.length - 1] ?? ""}`
}

/**
 * La pregunta de «Borrar todo»: cuenta lo que se pierde, para que no se confirme
 * a ciegas. Lo que no hay no se nombra; sin nada, se dice.
 */
export const resetQuestion = (state: AppState): string => {
  const lista: string | null = recuento(
    Object.keys(state.notes).length,
    Object.keys(state.diagrams).length,
    Object.keys(state.contexts).length,
  )
  if (lista === null) return "¿Dejar la app en blanco? No hay nada guardado."
  return `¿Borrar ${lista}, y las ventanas? No se puede deshacer.`
}

/**
 * La pregunta antes de importar: qué trae la copia y que lo de ahora se pierde.
 * Los ficheros ilegibles se nombran: entran, pero no se verán.
 */
export const importQuestion = (resumen: ImportSummary): string => {
  const lista: string | null = recuento(resumen.notes, resumen.diagrams, resumen.contexts)
  const trae: string = lista === null ? "La copia está vacía." : `La copia trae ${lista}.`
  const ilegibles: string =
    resumen.unreadable === 0
      ? ""
      : resumen.unreadable === 1
        ? " 1 fichero no se puede leer: entra igual, pero no se verá."
        : ` ${resumen.unreadable} ficheros no se pueden leer: entran igual, pero no se verán.`
  return `${trae}${ilegibles} ¿Sustituir por ella todo lo de este navegador? Lo de ahora se pierde.`
}

/** Por qué no se puede importar ese fichero. */
export const importProblem = (
  problema: Exclude<ImportPreparation, { readonly kind: "ready" }>,
): string => {
  switch (problema.kind) {
    case "unreadable-file":
      return "No se ha podido leer el fichero."
    case "not-a-backup":
      return "Ese fichero no es una copia de ElNotas."
    case "newer-backup":
      return "Esa copia es de una versión más nueva de ElNotas. Actualiza la app y vuelve a probar."
    case "wont-boot":
      return `Esa copia no se puede usar. ${describeBootError(problema.error)}`
  }
}

/** Cuando se confirmó, pero la copia no cabe para apuntarla. */
export const IMPORT_NOT_APPLIED: string =
  "La copia no cabe en el navegador. No se ha cambiado nada."

/** Cómo fue exportar. `null` si no hay nada que decir: se canceló. */
export const exportMessage = (resultado: ExportResult): string | null => {
  switch (resultado.kind) {
    case "exported":
      return resultado.partial
        ? "Copia guardada, pero sin los últimos cambios: el guardado está detenido."
        : "Copia guardada."
    case "cancelled":
      return null
    case "failed":
      return resultado.error === null
        ? "No se ha podido escribir la copia."
        : `No se ha podido hacer la copia. ${describeStorageError(resultado.error)}`
  }
}

/**
 * La línea de la versión, al pie de la configuración. `null` es que no se está en
 * la versión publicada: la pone el script que la arma, y en desarrollo no existe.
 */
export const versionLine = (version: string | null): string =>
  version === null ? "Versión de desarrollo" : `Versión ${version}`
