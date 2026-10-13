/**
 * El registro de verdad: la consola del navegador.
 *
 * Es la implementación de `Logger` que usa la app. Cada línea lleva delante
 * `ElNotas:`, para encontrarlas juntas. Las pruebas no la usan: se fabrican uno
 * que calla o que apunta lo registrado.
 */

import type { Logger } from "#core/index"

export const consoleLogger: Logger = {
  failure: (what: string, failure: unknown): void => console.error(`ElNotas: ${what}`, failure),
}
