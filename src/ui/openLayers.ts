/**
 * Lo que había abierto encima de la ventana —una nota, un diagrama, o un
 * diagrama y una nota suya—, para volver a abrirlo cuando la app se recarga,
 * también cuando el sistema la cierra en segundo plano.
 *
 * Aquí, cómo se lee lo guardado y qué se descarta; dónde se guarda lo pone
 * `platform/`. Es de cada dispositivo: no viaja con las notas.
 */

import type { AppState, DiagramId, NoteId, Result, StorageError } from "#core/index"
import { diagramId, noteId } from "#core/index"

export type OpenLayer =
  | { readonly kind: "note"; readonly id: NoteId }
  | { readonly kind: "diagram"; readonly id: DiagramId }

/** De abajo arriba. La configuración no entra: al recargar no se vuelve a ella. */
export type OpenLayers = ReadonlyArray<OpenLayer>

export const NO_LAYERS: OpenLayers = []

/** Dónde se guarda. Lo pone `platform/`. Ninguno de los dos lanza. */
export interface OpenLayersPersistence {
  /** Lo guardado tal cual, sin validar, o `null` si nunca se guardó nada. */
  readonly load: () => Result<unknown, StorageError>
  readonly save: (layers: OpenLayers) => Result<void, StorageError>
}

type Registro = Record<string, unknown>

const esRegistro = (x: unknown): x is Registro =>
  typeof x === "object" && x !== null && !Array.isArray(x)

const leerCapa = (x: unknown): OpenLayer | null => {
  if (!esRegistro(x) || typeof x["id"] !== "string") return null
  if (x["kind"] === "note") return { kind: "note", id: noteId(x["id"]) }
  if (x["kind"] === "diagram") return { kind: "diagram", id: diagramId(x["id"]) }
  return null
}

/**
 * Si esa capa puede ir encima de las de debajo, tal como se abren en la app: un
 * diagrama sólo desde la ventana, y una nota desde la ventana o desde un diagrama.
 */
const cabeEncima = (debajo: OpenLayers, capa: OpenLayer): boolean => {
  const anterior: OpenLayer | undefined = debajo[debajo.length - 1]
  if (anterior === undefined) return true
  return debajo.length === 1 && anterior.kind === "diagram" && capa.kind === "note"
}

/** Lo guardado → las capas. Se queda con las de abajo hasta la primera que no tenga forma. */
export const parseOpenLayers = (guardado: unknown): OpenLayers => {
  if (!Array.isArray(guardado)) return NO_LAYERS
  const leidas: ReadonlyArray<unknown> = guardado
  let capas: OpenLayers = NO_LAYERS
  for (const valor of leidas) {
    const capa: OpenLayer | null = leerCapa(valor)
    if (capa === null || !cabeEncima(capas, capa)) break
    capas = [...capas, capa]
  }
  return capas
}

const existe = (capa: OpenLayer, state: AppState): boolean =>
  capa.kind === "note" ? state.notes[capa.id] !== undefined : state.diagrams[capa.id] !== undefined

/**
 * Hasta la primera que ya no está: lo de encima de algo borrado tampoco se abre.
 * Las MISMAS capas si están todas.
 */
export const guardOpenLayers = (layers: OpenLayers, state: AppState): OpenLayers => {
  const corte: number = layers.findIndex((capa: OpenLayer): boolean => !existe(capa, state))
  return corte === -1 ? layers : layers.slice(0, corte)
}

/** Lo que hay que volver a abrir al arrancar. Si no se puede leer, nada. */
export const layersToRestore = (
  persistence: OpenLayersPersistence,
  state: AppState,
): OpenLayers => {
  const leido: Result<unknown, StorageError> = persistence.load()
  return leido.ok ? guardOpenLayers(parseOpenLayers(leido.value), state) : NO_LAYERS
}
