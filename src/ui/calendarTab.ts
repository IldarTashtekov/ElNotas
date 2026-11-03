/**
 * La pestaña del calendario, Eventos o Rutinas: cuál hay, cómo se lee lo guardado
 * y el ajuste vivo que la comparten su vista y su ventana y que la guarda al
 * cambiarla.
 *
 * Es de cada dispositivo: se guarda aparte de las notas y no viaja con ellas.
 */

import type { Logger, Result, StorageError } from "#core/index"

export type CalendarTab = "events" | "routines"

export const DEFAULT_CALENDAR_TAB: CalendarTab = "events"

/** Cualquier cosa que no sea una pestaña conocida es la de siempre. */
export const parseCalendarTab = (guardado: unknown): CalendarTab =>
  guardado === "routines" ? "routines" : DEFAULT_CALENDAR_TAB

/** Si pulsar un día del mes abre su hoja: sólo en Eventos; en Rutinas el mes sólo enseña. */
export const daysOpenSheet = (tab: CalendarTab): boolean => tab === "events"

/** Dónde se guarda. Lo pone `platform/`. Ninguno de los dos lanza. */
export interface CalendarTabPersistence {
  /** Lo guardado tal cual, o `null` si nunca se guardó nada. */
  readonly load: () => Result<unknown, StorageError>
  readonly save: (tab: CalendarTab) => Result<void, StorageError>
}

export interface CalendarTabSetting {
  readonly get: () => CalendarTab
  /** No hace nada si ya era ésa. */
  readonly set: (tab: CalendarTab) => void
}

export interface CalendarTabSettingDeps {
  readonly persistence: CalendarTabPersistence
  readonly logger: Logger
}

export const createCalendarTabSetting = ({
  persistence,
  logger,
}: CalendarTabSettingDeps): CalendarTabSetting => {
  const leido: Result<unknown, StorageError> = persistence.load()
  /* Si no se puede leer, la de siempre: lo único que se pierde es una pestaña. */
  let actual: CalendarTab = leido.ok ? parseCalendarTab(leido.value) : DEFAULT_CALENDAR_TAB
  return {
    get: (): CalendarTab => actual,
    set: (tab: CalendarTab): void => {
      if (tab === actual) return
      actual = tab
      /* Un fallo al guardar no se avisa, como el del fósforo: la pestaña se ve
         igual y sólo se pierde al recargar. Queda en la consola. */
      const guardado: Result<void, StorageError> = persistence.save(actual)
      if (!guardado.ok) logger.failure("no se guardó la pestaña del calendario", guardado.error)
    },
  }
}
