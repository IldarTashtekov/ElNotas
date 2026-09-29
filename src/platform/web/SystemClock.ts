/**
 * La hora de verdad, la del reloj del sistema.
 *
 * Es la implementación de `Clock` que usa la app en el navegador. Las pruebas no
 * la usan: se fabrican un reloj fijo en una línea.
 */

import type { Clock } from "#core/index"

export const systemClock: Clock = { now: (): number => Date.now() }
