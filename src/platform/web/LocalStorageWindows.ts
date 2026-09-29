/**
 * Guarda la lista de ventanas en `localStorage`, en una clave propia, aparte de
 * las notas.
 *
 * ⚠️ Por estar aparte no viaja con ellas: si cambia dónde se guardan las notas, o
 * de dispositivo, las ventanas se pierden y hay que rehacerlas.
 */

import type { Result, StorageError } from "#core/index"
import { err, ok } from "#core/index"
import type { WindowsLayout, WindowsPersistence } from "#ui/index"

export const WINDOWS_KEY: string = "elnotas:windows"

export const createLocalStorageWindows = (almacen: Storage): WindowsPersistence => ({
  load: (): Result<unknown, StorageError> => {
    try {
      const texto: string | null = almacen.getItem(WINDOWS_KEY)
      return ok(texto === null ? null : (JSON.parse(texto) as unknown))
    } catch (fallo: unknown) {
      /* Un JSON roto aquí no es una nota perdida: quien llama empieza de cero. */
      const ilegible: StorageError =
        fallo instanceof SyntaxError
          ? { kind: "corrupt", path: WINDOWS_KEY, cause: fallo }
          : { kind: "io", cause: fallo }
      return err(ilegible)
    }
  },

  save: (layout: WindowsLayout): Result<void, StorageError> => {
    try {
      almacen.setItem(WINDOWS_KEY, JSON.stringify(layout))
      return ok(undefined)
    } catch (fallo: unknown) {
      /* Sin distinguir la cuota: quien guarda las ventanas trata igual cualquier
         fallo, y el clasificador de verdad vive en `LocalStorageBlobStore`. */
      const sinGuardar: StorageError = { kind: "io", cause: fallo }
      return err(sinGuardar)
    }
  },
})
