/**
 * Qué enseña la vista configuración: todos los contextos, y lo que dice al
 * borrar, exportar e importar. Y lo que ofrece el «+» de las pestañas: el General,
 * el calendario, los contextos, las notas y los diagramas que aún no son ventana.
 *
 * Puro, como `windowView`: la pantalla sólo lo pinta.
 */

import type { AppState, Context, Diagram, Note } from "#core/index"
import type { ExportResult, ImportPreparation, ImportSummary } from "./backup.js"
import { describeBootError, describeStorageError } from "./messages.js"
import type { WindowRef, WindowsLayout } from "./windows.js"
import { CALENDAR, GENERAL, sameWindow } from "./windows.js"
import { windowTitle } from "./windowView.js"
import { textos } from "./textos/idioma.js"

export interface WindowRow {
  readonly ref: WindowRef
  readonly title: string
}

export interface SettingsContent {
  /** Todos los que existen, estén o no en alguna ventana, por nombre. */
  readonly contexts: ReadonlyArray<Context>
  /** Lo que puede enseñar una ventana: el General, cada contexto, cada nota y cada diagrama. */
  readonly choices: ReadonlyArray<WindowRow>
}

const fila =
  (state: AppState): ((ref: WindowRef) => WindowRow) =>
  (ref: WindowRef): WindowRow => ({
    ref,
    title: windowTitle(ref, state),
  })

export const settingsContent = (state: AppState): SettingsContent => {
  const contexts: ReadonlyArray<Context> = [...Object.values<Context>(state.contexts)].sort(
    (a: Context, b: Context): number => a.name.localeCompare(b.name),
  )
  const notas: ReadonlyArray<Note> = [...Object.values<Note>(state.notes)].sort((a: Note, b: Note): number =>
    a.name.localeCompare(b.name),
  )
  const diagramas: ReadonlyArray<Diagram> = [...Object.values<Diagram>(state.diagrams)].sort(
    (a: Diagram, b: Diagram): number => a.name.localeCompare(b.name),
  )
  const choices: ReadonlyArray<WindowRef> = [
    GENERAL,
    CALENDAR,
    ...contexts.map((ctx: Context): WindowRef => ({ kind: "context", id: ctx.id })),
    ...notas.map((nota: Note): WindowRef => ({ kind: "note", id: nota.id })),
    ...diagramas.map((d: Diagram): WindowRef => ({ kind: "diagram", id: d.id })),
  ]
  return {
    contexts,
    choices: choices.map(fila(state)),
  }
}

/**
 * Lo que ofrece el «+» de las pestañas: todo lo que puede enseñar una ventana,
 * menos lo que ya está en alguna.
 */
export const addWindowChoices = (layout: WindowsLayout, state: AppState): ReadonlyArray<WindowRow> =>
  settingsContent(state).choices.filter(
    (opcion: WindowRow): boolean => !layout.windows.some((w: WindowRef): boolean => sameWindow(w, opcion.ref)),
  )

/**
 * El rótulo que va delante de la primera opción de su grupo en un selector:
 * «Notas:» antes de la primera nota, «Diagramas:» antes del primer diagrama.
 * `null` en las demás, y en el General y los contextos, que van sin rótulo.
 */
export const choiceGroupLabel = (opciones: ReadonlyArray<WindowRow>, i: number): string | null => {
  const opcion: WindowRow | undefined = opciones[i]
  if (opcion === undefined) return null
  const clase: WindowRef["kind"] = opcion.ref.kind
  if (opciones[i - 1]?.ref.kind === clase) return null
  if (clase === "note") return textos.ventanas.rotuloNotas
  if (clase === "diagram") return textos.ventanas.rotuloDiagramas
  return null
}

/**
 * «2 notas, 1 diagrama y 3 contextos». Lo que no hay no se nombra; `null` si no
 * hay nada.
 */
const recuento = (notas: number, diagramas: number, contextos: number): string | null => {
  const partes: ReadonlyArray<string> = [
    [notas, textos.recuentos.notas] as const,
    [diagramas, textos.recuentos.diagramas] as const,
    [contextos, textos.recuentos.contextos] as const,
  ]
    .filter(([n]): boolean => n > 0)
    .map(([n, cuantas]): string => cuantas(n))
  if (partes.length === 0) return null
  return textos.recuentos.unir(partes)
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
  if (lista === null) return textos.ajustes.preguntaEnBlanco
  return textos.ajustes.preguntaBorrarTodo(lista)
}

/**
 * La pregunta antes de importar: qué trae la copia y que lo de ahora se pierde.
 * Los ficheros ilegibles se nombran: entran, pero no se verán.
 */
export const importQuestion = (resumen: ImportSummary): string => {
  const lista: string | null = recuento(resumen.notes, resumen.diagrams, resumen.contexts)
  const trae: string = lista === null ? textos.copia.vacia : textos.copia.trae(lista)
  return textos.copia.preguntaImportar(trae, textos.copia.ilegibles(resumen.unreadable))
}

/** Por qué no se puede importar ese fichero. */
export const importProblem = (problema: Exclude<ImportPreparation, { readonly kind: "ready" }>): string => {
  switch (problema.kind) {
    case "unreadable-file":
      return textos.copia.ficheroNoSeLee
    case "not-a-backup":
      return textos.copia.noEsCopia
    case "newer-backup":
      return textos.copia.copiaNueva
    case "wont-boot":
      return textos.copia.copiaInutil(describeBootError(problema.error))
  }
}

/** Cómo fue exportar. `null` si no hay nada que decir: se canceló. */
export const exportMessage = (resultado: ExportResult): string | null => {
  switch (resultado.kind) {
    case "exported":
      return resultado.partial ? textos.copia.guardadaSinLoUltimo : textos.copia.guardada
    case "shared":
      return resultado.partial ? textos.copia.enviadaSinLoUltimo : textos.copia.enviada
    case "cancelled":
      return null
    case "failed":
      return resultado.error === null
        ? textos.copia.noSePudoEscribir
        : textos.copia.noSePudoHacer(describeStorageError(resultado.error))
  }
}

/**
 * La línea de la versión, al pie de la configuración. `null` es que no se está en
 * la versión publicada: la pone el script que la arma, y en desarrollo no existe.
 */
export const versionLine = (version: string | null): string =>
  version === null ? textos.ajustes.versionDesarrollo : textos.ajustes.version(version)
