/**
 * Guarda en `localStorage` el orden de las rutinas, en una
 * clave propia, aparte de las notas y de las ventanas.
 *
 * Es de este navegador: ni viaja con las notas ni se comparte entre dispositivos.
 */

import type { Result, StorageError } from "#core/index"
import { err, ok } from "#core/index"
import type { CalendarOrderPersistence, CalendarOrder } from "#ui/index"

export const CALENDAR_ORDER_KEY: string = "elnotas:calendario-orden"

export const createLocalStorageCalendarOrder = (almacen: Storage): CalendarOrderPersistence => ({
  load: (): Result<unknown, StorageError> => {
    try {
      const texto: string | null = almacen.getItem(CALENDAR_ORDER_KEY)
      return ok(texto === null ? null : (JSON.parse(texto) as unknown))
    } catch (fallo: unknown) {
      /* Un JSON roto aquí no es una nota perdida: las rutinas salen por defecto. */
      const ilegible: StorageError =
        fallo instanceof SyntaxError
          ? { kind: "corrupt", path: CALENDAR_ORDER_KEY, cause: fallo }
          : { kind: "io", cause: fallo }
      return err(ilegible)
    }
  },

  save: (order: CalendarOrder): Result<void, StorageError> => {
    try {
      almacen.setItem(CALENDAR_ORDER_KEY, JSON.stringify(order))
      return ok(undefined)
    } catch (fallo: unknown) {
      const sinGuardar: StorageError = { kind: "io", cause: fallo }
      return err(sinGuardar)
    }
  },
})
