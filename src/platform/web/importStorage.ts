/**
 * Importar una copia sustituyendo todo lo de la app en `localStorage`.
 *
 * Se hace en dos tiempos, como «Borrar todo»: el botón apunta la copia y recarga,
 * y es al arrancar, antes de leer nada, cuando se borra lo que había y se
 * escriben los ficheros, las ventanas, el fósforo y los encuadres de la copia. La marca se
 * quita la última: si algo falla a medias, el próximo arranque lo reintenta.
 */

import type { BlobStore, Result, StorageError } from "#core/index"
import { err, ok } from "#core/index"
import { createLocalStorageBlobStore } from "#storage/index"
import { parseFramings, parsePhosphor, parseWindowsLayout } from "#ui/index"
import type { Backup, BackupProblem } from "./backup.js"
import { backupBytes, readBackup } from "./backup.js"
import { createLocalStorageFraming } from "./LocalStorageFraming.js"
import { createLocalStoragePhosphor } from "./LocalStoragePhosphor.js"
import { createLocalStorageWindows } from "./LocalStorageWindows.js"

/** La marca que lleva dentro la copia que hay que importar en el próximo arranque. */
export const IMPORT_KEY: string = "elnotas:importar"

const PREFIJO: string = "elnotas:"

export type ImportAtBoot =
  /** No se pidió nada. */
  | { readonly kind: "none" }
  /** Entró entera, y la marca ya no está. */
  | { readonly kind: "imported" }
  /** Lo apuntado no es una copia: se descarta sin haber borrado nada. */
  | { readonly kind: "invalid" }
  /** Falló a medias: la marca sigue y el próximo arranque lo reintenta. */
  | { readonly kind: "failed"; readonly error: StorageError }

/** Apunta la copia para el próximo arranque. `false` si no cabe o no se pudo. */
export const requestImport = (almacen: Storage, backup: Backup): boolean => {
  try {
    almacen.setItem(IMPORT_KEY, JSON.stringify(backup))
    return true
  } catch {
    return false
  }
}

/** Olvida la importación pedida, sin tocar nada más. `false` si no se pudo. */
export const cancelImport = (almacen: Storage): boolean => {
  try {
    almacen.removeItem(IMPORT_KEY)
    return true
  } catch {
    return false
  }
}

const fallo = (cause: unknown): ImportAtBoot => ({ kind: "failed", error: { kind: "io", cause } })

/** La copia apuntada, `null` si no hay, o el problema si no es una. */
const leerApuntada = (almacen: Storage): Result<Backup | null, BackupProblem | StorageError> => {
  let texto: string | null
  try {
    texto = almacen.getItem(IMPORT_KEY)
  } catch (causa: unknown) {
    const ilegible: StorageError = { kind: "io", cause: causa }
    return err(ilegible)
  }
  if (texto === null) return ok(null)
  try {
    return readBackup(JSON.parse(texto))
  } catch {
    const roto: BackupProblem = { kind: "not-a-backup", detail: "la copia apuntada no es JSON" }
    return err(roto)
  }
}

/** Quita todas las claves de la app menos la marca. El fallo, si lo hay. */
const borrarLoDeAntes = (almacen: Storage): unknown => {
  try {
    const claves: ReadonlyArray<string> = Array.from(
      { length: almacen.length },
      (_: unknown, i: number): string | null => almacen.key(i),
    ).filter(
      (k: string | null): k is string => k !== null && k.startsWith(PREFIJO) && k !== IMPORT_KEY,
    )
    for (const clave of claves) almacen.removeItem(clave)
    return null
  } catch (causa: unknown) {
    return causa ?? "no se pudo borrar"
  }
}

/** Al arrancar, antes de leer nada: si se pidió, sustituye todo por la copia. */
export const importIfRequested = async (almacen: Storage): Promise<ImportAtBoot> => {
  const apuntada: Result<Backup | null, BackupProblem | StorageError> = leerApuntada(almacen)
  if (!apuntada.ok) {
    if (apuntada.error.kind === "io") return { kind: "failed", error: apuntada.error }
    /* Se comprobó antes de apuntarla, así que esto no debería pasar; si pasa, se
       descarta: no hay nada que reintentar y aún no se ha borrado nada. */
    cancelImport(almacen)
    return { kind: "invalid" }
  }
  const copia: Backup | null = apuntada.value
  if (copia === null) return { kind: "none" }

  const sinBorrar: unknown = borrarLoDeAntes(almacen)
  if (sinBorrar !== null) return fallo(sinBorrar)

  const blobs: BlobStore = createLocalStorageBlobStore(almacen)
  for (const [camino, bytes] of backupBytes(copia)) {
    const escrito: Result<void, StorageError> = await blobs.write(camino, bytes)
    if (!escrito.ok) return { kind: "failed", error: escrito.error }
  }

  /* Pasan por los mismos lectores que al arrancar: lo que no tenga forma se
     queda en lo de siempre en vez de llegar raro a la pantalla. */
  if (copia.windows !== null) {
    const ventanas: Result<void, StorageError> = createLocalStorageWindows(almacen).save(
      parseWindowsLayout(copia.windows),
    )
    if (!ventanas.ok) return { kind: "failed", error: ventanas.error }
  }
  if (copia.phosphor !== null) {
    const fosforo: Result<void, StorageError> = createLocalStoragePhosphor(almacen).save(
      parsePhosphor(copia.phosphor),
    )
    if (!fosforo.ok) return { kind: "failed", error: fosforo.error }
  }
  /* Los de diagramas que no vengan en la copia los quita el arranque. */
  if (copia.framing !== null) {
    const encuadres: Result<void, StorageError> = createLocalStorageFraming(almacen).save(
      parseFramings(copia.framing),
    )
    if (!encuadres.ok) return { kind: "failed", error: encuadres.error }
  }

  return cancelImport(almacen) ? { kind: "imported" } : fallo("no se pudo quitar la marca")
}
