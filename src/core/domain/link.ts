/**
 * Cómo se escribe un enlace en el texto de una nota o de un nodo: `[texto](destino)`.
 *
 * El core no lee los enlaces; sólo sabe escribirlos, para que la migración de los
 * nodos-nota y la UI los dejen igual.
 */

/**
 * `[texto](destino)`, con el texto escapado (`\`, `[`, `]` y `*` llevan una barra
 * delante) y «enlace» si el texto está en blanco. El destino se escribe tal cual:
 * quien llama lo da bien (un id, o una dirección que pasó `isWebAddress`). Un `)`
 * en el destino lo cerraría antes de tiempo: no se enlaza y vuelve `null`.
 */
export const buildLink = (texto: string, destino: string): string | null => {
  if (destino.includes(")")) return null
  const visible: string = texto.trim() === "" ? "enlace" : texto
  return `[${visible.replace(/[\\[\]*]/g, "\\$&")}](${destino})`
}
