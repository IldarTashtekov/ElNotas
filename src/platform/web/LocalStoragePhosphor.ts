/**
 * Guarda el color del fósforo en `localStorage`, en una clave propia, aparte de
 * las notas y de las ventanas.
 *
 * Es de este navegador: ni viaja con las notas ni se comparte entre dispositivos.
 */

import type { Result, StorageError } from "#core/index"
import { err, ok } from "#core/index"
import type { Phosphor, PhosphorPersistence } from "#ui/index"

export const PHOSPHOR_KEY: string = "elnotas:phosphor"

export const createLocalStoragePhosphor = (almacen: Storage): PhosphorPersistence => ({
  load: (): Result<unknown, StorageError> => {
    try {
      return ok(almacen.getItem(PHOSPHOR_KEY))
    } catch (fallo: unknown) {
      const sinLeer: StorageError = { kind: "io", cause: fallo }
      return err(sinLeer)
    }
  },

  save: (phosphor: Phosphor): Result<void, StorageError> => {
    try {
      almacen.setItem(PHOSPHOR_KEY, phosphor)
      return ok(undefined)
    } catch (fallo: unknown) {
      const sinGuardar: StorageError = { kind: "io", cause: fallo }
      return err(sinGuardar)
    }
  },
})
