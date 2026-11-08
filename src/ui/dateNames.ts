/**
 * Las fechas escritas en el idioma de la app: el título de un mes, el de un día,
 * las iniciales de la semana y el rótulo corto de la gráfica.
 *
 * Las escribe `Intl` del navegador con el código del idioma en uso, en UTC para
 * que la hora del dispositivo no cambie el día.
 */

import { textos } from "./textos/idioma.js"

const enUtc = (year: number, month: number, day: number): Date => new Date(Date.UTC(year, month - 1, day))

const formato = (opciones: Intl.DateTimeFormatOptions): Intl.DateTimeFormat =>
  new Intl.DateTimeFormat(textos.codigo, { ...opciones, timeZone: "UTC" })

/** «noviembre de 2026», «November 2026». */
export const monthYearName = (year: number, month: number): string =>
  formato({ month: "long", year: "numeric" }).format(enUtc(year, month, 1))

/** «8 de noviembre de 2026», «November 8, 2026». */
export const fullDateName = (year: number, month: number, day: number): string =>
  formato({ day: "numeric", month: "long", year: "numeric" }).format(enUtc(year, month, day))

/** «8/11», «11/8»: el rótulo de una semana en la gráfica. */
export const shortDateName = (month: number, day: number): string =>
  formato({ day: "numeric", month: "numeric" }).format(enUtc(2000, month, day))

/** Las iniciales de los días, de lunes a domingo: el 1 de enero de 2024 fue lunes. */
export const weekdayInitials = (): ReadonlyArray<string> => {
  const inicial: Intl.DateTimeFormat = formato({ weekday: "narrow" })
  return [0, 1, 2, 3, 4, 5, 6].map((i: number): string => inicial.format(enUtc(2024, 1, 1 + i)))
}
