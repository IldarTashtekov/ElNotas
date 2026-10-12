/**
 * Guarda en `localStorage` dónde se miraba cada diagrama, en una clave propia,
 * aparte de las notas y de las ventanas.
 *
 * Es de este navegador: ni viaja con las notas ni se comparte entre dispositivos.
 */

import type { Result, StorageError } from "#core/index"
import { err, ok } from "#core/index"
import type { FramingPersistence, Framings } from "#ui/index"

export const FRAMING_KEY: string = "elnotas:framing"

export const createLocalStorageFraming = (almacen: Storage): FramingPersistence => ({
  load: (): Result<unknown, StorageError> => {
    try {
      const texto: string | null = almacen.getItem(FRAMING_KEY)
      return ok(texto === null ? null : (JSON.parse(texto) as unknown))
    } catch (fallo: unknown) {
      /* Un JSON roto aquí no es una nota perdida: los diagramas se abren centrados. */
      const ilegible: StorageError =
        fallo instanceof SyntaxError
          ? { kind: "corrupt", path: FRAMING_KEY, cause: fallo }
          : { kind: "io", cause: fallo }
      return err(ilegible)
    }
  },

  save: (framings: Framings): Result<void, StorageError> => {
    try {
      almacen.setItem(FRAMING_KEY, JSON.stringify(framings))
      return ok(undefined)
    } catch (fallo: unknown) {
      const sinGuardar: StorageError = { kind: "io", cause: fallo }
      return err(sinGuardar)
    }
  },
})
