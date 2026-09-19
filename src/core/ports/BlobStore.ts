/**
 * Mueve bytes y nada más: no sabe qué es una Nota.
 *
 * Existe para que guardar en la carpeta del usuario, en el navegador o en Drive
 * sea sólo cambiar dónde van los bytes, sin tocar nada de lo de arriba.
 */

import type { Result } from "../domain/Result"
import type { StorageError } from "../domain/errors/StorageError"

export interface BlobStore {
  /** Los bytes, o `null` si no existe ese camino — que **no** es un fallo. */
  readonly read: (path: string) => Promise<Result<Uint8Array | null, StorageError>>
  /** Escribe o reemplaza. Crea lo que haga falta por el camino. */
  readonly write: (path: string, data: Uint8Array) => Promise<Result<void, StorageError>>
  /** Borra. Borrar lo que no existe **no es un error**. */
  readonly delete: (path: string) => Promise<Result<void, StorageError>>
  /** Los caminos que empiezan por ese prefijo. Es lo que hace posible `getAll`. */
  readonly list: (prefix: string) => Promise<Result<ReadonlyArray<string>, StorageError>>
}
