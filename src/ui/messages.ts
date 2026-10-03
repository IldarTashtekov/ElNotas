/**
 * Los fallos, dichos para quien usa la app: una frase por cada caso.
 *
 * Son funciones puras de un error a un texto, así que se prueban en Node sin
 * navegador.
 */

import type { MigrationError, StorageError } from "#core/index"

export const describeStorageError = (fallo: StorageError): string => {
  switch (fallo.kind) {
    case "corrupt":
      return `No se entiende el fichero ${fallo.path}.`
    case "permission-denied":
      return "El navegador no deja leer ni guardar los datos de ElNotas."
    case "not-found":
      return "No se encuentra dónde se guardan las notas."
    case "quota-exceeded":
      return "No queda sitio para guardar más."
    case "stale":
      return "Otra pestaña ha cambiado lo mismo que esta. Para no pisarlo, aquí se ha dejado de guardar."
    case "io":
      return "Algo ha fallado al leer o guardar."
  }
}

export const describeMigrationError = (fallo: MigrationError): string => {
  switch (fallo.kind) {
    case "schema-from-future":
      return "Estas notas se guardaron con una versión más nueva de ElNotas. Ábrelas con esa versión."
    case "missing-migration":
    case "migration-failed":
      return "Estas notas vienen de una versión antigua de ElNotas y no se han podido poner al día."
  }
}

/** Para el arranque, que puede fallar por cualquiera de los dos lados. */
export const describeBootError = (fallo: StorageError | MigrationError): string =>
  fallo.kind === "schema-from-future" ||
  fallo.kind === "missing-migration" ||
  fallo.kind === "migration-failed"
    ? describeMigrationError(fallo)
    : describeStorageError(fallo)
