/**
 * El sitio al que se piden los textos: `textos.comun.borrar`, sin saber en qué idioma.
 *
 * Empieza en español. La plataforma elige el idioma al arrancar, antes de pintar
 * nada, con `usarIdioma`, y no cambia mientras la app está abierta: cambiarlo
 * recarga. Un texto se pide al usarlo, nunca se guarda en una constante al
 * cargar un módulo.
 */

import { es } from "./es.js"
import type { Textos } from "./Textos.js"

export let textos: Textos = es

/** Lo llama la plataforma al arrancar, antes de montar la app. */
export const usarIdioma = (elegidos: Textos): void => {
  textos = elegidos
}
