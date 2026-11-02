/**
 * Guarda el estado de la UI en `localStorage`, en una clave propia, aparte de las
 * notas: el objeto entero, sin entenderlo. Qué hay dentro lo sabe la UI.
 *
 * Es de este navegador: ni viaja con las notas ni se comparte entre dispositivos.
 */

import type { Result, StorageError } from "#core/index"
import { err, ok } from "#core/index"
import type { StoredUiState, UiStatePersistence } from "#ui/index"

export const UI_STATE_KEY: string = "elnotas:ui"

/** Donde se guardaba cada sección antes de juntarlas. No se leen: se empezó de cero. */
export const OLD_UI_KEYS: ReadonlyArray<string> = [
  "elnotas:phosphor",
  "elnotas:windows",
  "elnotas:framing",
  "elnotas:calendario-orden",
]

export const createLocalStorageUiState = (almacen: Storage): UiStatePersistence => ({
  load: (): Result<unknown, StorageError> => {
    try {
      const texto: string | null = almacen.getItem(UI_STATE_KEY)
      return ok(texto === null ? null : (JSON.parse(texto) as unknown))
    } catch (fallo: unknown) {
      /* Un JSON roto aquí no es una nota perdida: la pantalla vuelve a lo de siempre. */
      const ilegible: StorageError =
        fallo instanceof SyntaxError
          ? { kind: "corrupt", path: UI_STATE_KEY, cause: fallo }
          : { kind: "io", cause: fallo }
      return err(ilegible)
    }
  },

  save: (estado: StoredUiState): Result<void, StorageError> => {
    try {
      almacen.setItem(UI_STATE_KEY, JSON.stringify(estado))
      return ok(undefined)
    } catch (fallo: unknown) {
      /* Sin distinguir la cuota: quien guarda trata igual cualquier fallo, y el
         clasificador de verdad vive en `LocalStorageBlobStore`. */
      const sinGuardar: StorageError = { kind: "io", cause: fallo }
      return err(sinGuardar)
    }
  },
})

/** Al arrancar: quita las claves de antes de juntarlas. `false` si no se pudo; el próximo arranque lo reintenta. */
export const forgetOldUiKeys = (almacen: Storage): boolean => {
  try {
    for (const clave of OLD_UI_KEYS) almacen.removeItem(clave)
    return true
  } catch {
    return false
  }
}
