/**
 * Dónde queda constancia de un fallo que no se avisa en pantalla.
 *
 * Para los sitios donde no hay nada útil que hacer con un error, pero tampoco se
 * quiere perder. Promete no lanzar, como los demás puertos. Una prueba se fabrica
 * el suyo en una línea:
 *
 *     const logger: Logger = { failure: (): void => undefined }
 */
export interface Logger {
  /** `what` dice qué falló, en castellano; `failure`, el error tal cual. */
  readonly failure: (what: string, failure: unknown) => void
}
