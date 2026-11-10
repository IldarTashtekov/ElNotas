/**
 * Vacía un almacén de bytes entero: lista todo lo que hay y lo borra. Lo usan
 * «Borrar todo» e importar cuando las notas no viven en `localStorage`, que
 * entonces no basta con quitar sus claves.
 */

import type { BlobStore, Result, StorageError } from "#core/index"
import { ok } from "#core/index"

/** Dice la versión de lo guardado: si quedaran notas sin él, se leerían como de un almacén nuevo. */
const MANIFIESTO: string = "manifest.json"

/** Borra cuanto haya, el manifiesto el último; para en el primer fallo y lo devuelve. */
export const vaciarBlobs = async (blobs: BlobStore): Promise<Result<void, StorageError>> => {
  const caminos: Result<ReadonlyArray<string>, StorageError> = await blobs.list("")
  if (!caminos.ok) return caminos
  const enOrden: ReadonlyArray<string> = [
    ...caminos.value.filter((camino: string): boolean => camino !== MANIFIESTO),
    ...caminos.value.filter((camino: string): boolean => camino === MANIFIESTO),
  ]
  for (const camino of enOrden) {
    const borrado: Result<void, StorageError> = await blobs.delete(camino)
    if (!borrado.ok) return borrado
  }
  return ok(undefined)
}
