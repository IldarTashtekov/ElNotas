/**
 * «Hoy» como día del calendario: el día de este dispositivo, no el de otra zona.
 *
 * Lo calcula la plataforma y se lo pasa a la UI: el core no lee el reloj.
 */

import type { Day } from "#core/index"
import { dayFromParts } from "#core/index"

/** El día local de ese instante (milisegundos epoch), o `null` si se sale del rango. */
export const todayOf = (now: number): Day | null => {
  const fecha: Date = new Date(now)
  return dayFromParts(fecha.getFullYear(), fecha.getMonth() + 1, fecha.getDate())
}
