/**
 * API pública de la composición.
 *
 * `platform/` es la capa de fuera: conoce al core, a `storage/` y a la UI, y
 * nadie la conoce a ella. Lo que sale por aquí es para la página de entrada y
 * para las pruebas.
 */

export type { App, BootDeps, BootError } from "./web/boot.js"
export { boot } from "./web/boot.js"
export { systemClock } from "./web/SystemClock.js"
export type { RandomSource } from "./web/CryptoIdGenerator.js"
export { createCryptoIdGenerator } from "./web/CryptoIdGenerator.js"
export { WINDOWS_KEY, createLocalStorageWindows } from "./web/LocalStorageWindows.js"
