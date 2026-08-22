import type { Revision } from "./Ids"

/**
 * Lo que lleva encima toda entidad que se guarda: cuándo se escribió y qué
 * versión es. Las entidades lo heredan (`interface Note extends Versioned`).
 *
 * No es una entidad en sí: no tiene id ni contenido. Es la chapa de metadatos
 * de escritura, y de ahí el nombre — lo que dice es "una Nota está versionada".
 *
 * Van desde el principio aunque hoy no haya sincronización, porque son campos de
 * entidades que acabarán en disco y añadirlos cuando ya haya notas guardadas
 * sería una migración de datos.
 */
export interface Versioned {
  /**
   * Milisegundos epoch de la última escritura. Viene del puerto Clock, nunca
   * de Date.now() — dentro del core eso no compila.
   *
   * Es el campo "para el usuario": ordenar por recientes, "editada hace 5 min".
   */
  readonly updatedAt: number

  /**
   * Identifica QUÉ versión es esta, no cuándo se hizo. Cambia en cada escritura
   * y es opaca: lo único que puedes preguntar es si sigue siendo la misma.
   *
   * Sirve para escribir condicionalmente ("actualiza esto sólo si la revisión
   * sigue siendo la que leí") y así DETECTAR que algo cambió por debajo, en vez
   * de machacarlo en silencio. Ojo: detectar, no resolver — qué hacer con el
   * conflicto es una política aparte, y "gana el último" no es la elegida.
   *
   * Se prefiere a comparar `updatedAt` porque los relojes de dos dispositivos
   * no coinciden, y porque "gana el más nuevo" pierde datos sin avisar.
   */
  readonly revision: Revision
}
