/**
 * Lo que puede ir mal al guardar o al leer, en cinco casos.
 *
 * Están elegidos por una sola pregunta —**¿reintentar sirve de algo?**— y no por
 * qué mensaje sale en pantalla, porque lo que hay que decidir es qué puede hacer
 * el programa a continuación:
 *
 *     permission-denied  no  vuelve a pedir la carpeta
 *     not-found          no  la carpeta ya no está: ofrece elegir otra
 *     quota-exceeded     no  no cabe: deja de intentarlo y avisa
 *     corrupt            no  aparta esa nota y sigue con las demás, diciendo cuál
 *     io                 sí  reintenta en silencio; si persiste, avisa
 *
 * `corrupt` está fuera de `io` a propósito: es la diferencia entre perder una
 * nota y creer que las has perdido todas.
 */
export type StorageError =
  | { readonly kind: "permission-denied" }
  | { readonly kind: "not-found"; readonly path: string }
  | { readonly kind: "quota-exceeded" }
  | { readonly kind: "corrupt"; readonly path: string; readonly cause: unknown }
  | { readonly kind: "io"; readonly cause: unknown }
