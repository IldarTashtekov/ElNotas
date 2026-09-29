/**
 * El modo de escritura de la nota abierta: si las líneas nuevas nacen como
 * casillas, y si la próxima nacerá dentro de la de arriba.
 *
 * Nace apagado al abrir la nota y muere al salir: no se guarda en ningún sitio.
 * «Anidar» no es un modo: se arma, actúa una vez y se desarma solo.
 */

export interface WritingMode {
  /** Encendido, Intro crea casillas; apagado —lo normal—, texto. */
  readonly checkbox: boolean
  /** La próxima casilla nacerá hija de la actual. Sólo con `checkbox` encendido. */
  readonly nestArmed: boolean
}

export const INITIAL_MODE: WritingMode = { checkbox: false, nestArmed: false }

/** Arma o desarma anidar. Con la casilla apagada no hace nada: ahí no se anida. */
export const toggleNest = (mode: WritingMode): WritingMode =>
  mode.checkbox ? { ...mode, nestArmed: !mode.nestArmed } : mode
