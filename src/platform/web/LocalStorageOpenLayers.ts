/**
 * Guarda en `localStorage` lo que había abierto encima de la ventana, en una
 * clave propia, aparte de las notas y de las ventanas.
 *
 * Es de este navegador: ni viaja con las notas ni se comparte entre dispositivos.
 */

import type { Result, StorageError } from "#core/index"
import { err, ok } from "#core/index"
import type { OpenLayers, OpenLayersPersistence } from "#ui/index"

export const OPEN_LAYERS_KEY: string = "elnotas:capas"

export const createLocalStorageOpenLayers = (almacen: Storage): OpenLayersPersistence => ({
  load: (): Result<unknown, StorageError> => {
    try {
      const texto: string | null = almacen.getItem(OPEN_LAYERS_KEY)
      return ok(texto === null ? null : (JSON.parse(texto) as unknown))
    } catch (fallo: unknown) {
      /* Un JSON roto aquí no es una nota perdida: la app se abre en la ventana. */
      const ilegible: StorageError =
        fallo instanceof SyntaxError
          ? { kind: "corrupt", path: OPEN_LAYERS_KEY, cause: fallo }
          : { kind: "io", cause: fallo }
      return err(ilegible)
    }
  },

  save: (layers: OpenLayers): Result<void, StorageError> => {
    try {
      almacen.setItem(OPEN_LAYERS_KEY, JSON.stringify(layers))
      return ok(undefined)
    } catch (fallo: unknown) {
      const sinGuardar: StorageError = { kind: "io", cause: fallo }
      return err(sinGuardar)
    }
  },
})
