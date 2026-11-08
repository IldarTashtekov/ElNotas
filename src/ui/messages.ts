/**
 * Los fallos, dichos para quien usa la app: una frase por cada caso.
 *
 * Son funciones puras de un error a un texto, así que se prueban en Node sin
 * navegador.
 */

import type { MigrationError, StorageError } from "#core/index"
import { textos } from "./textos/idioma.js"

export const describeStorageError = (fallo: StorageError): string => {
  switch (fallo.kind) {
    case "corrupt":
      return textos.fallos.ilegible(fallo.path)
    case "permission-denied":
      return textos.fallos.sinPermiso
    case "not-found":
      return textos.fallos.noEncontrado
    case "quota-exceeded":
      return textos.fallos.sinSitio
    case "stale":
      return textos.fallos.otraPestana
    case "io":
      return textos.fallos.alLeerOGuardar
  }
}

export const describeMigrationError = (fallo: MigrationError): string => {
  switch (fallo.kind) {
    case "schema-from-future":
      return textos.fallos.versionMasNueva
    case "missing-migration":
    case "migration-failed":
      return textos.fallos.migracionImposible
  }
}

/** La pantalla de cuando una importación se quedó a medias al arrancar. */
export const describeImportFailure = (fallo: StorageError): string =>
  textos.fallos.importacionSinTerminar(describeStorageError(fallo), textos.arranque.abandonarImportacion)

/** Para el arranque, que puede fallar por cualquiera de los dos lados. */
export const describeBootError = (fallo: StorageError | MigrationError): string =>
  fallo.kind === "schema-from-future" || fallo.kind === "missing-migration" || fallo.kind === "migration-failed"
    ? describeMigrationError(fallo)
    : describeStorageError(fallo)
