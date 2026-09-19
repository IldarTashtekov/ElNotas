/**
 * Guardar y recuperar entidades de una clase —las notas, los planes, los
 * contextos—, sin decir dónde ni cómo se guardan.
 *
 * Es sólo la forma que tiene que cumplir quien guarde de verdad. Debajo hay otro
 * puerto, `BlobStore`, que ya no sabe qué es una Nota: sólo mueve bytes.
 */

import type { Result } from "../domain/Result"
import type { StorageError } from "../domain/errors/StorageError"

export interface Repository<T, TId extends string> {
  /** La entidad, o `null` si no está guardada — que **no** es un fallo. */
  readonly get: (id: TId) => Promise<Result<T | null, StorageError>>
  /** Todas las de esta clase. Sin orden garantizado: ordenar es de quien lee. */
  readonly getAll: () => Promise<Result<ReadonlyArray<T>, StorageError>>
  /** Guarda o reemplaza. La entidad ya lleva su id dentro. */
  readonly put: (entity: T) => Promise<Result<void, StorageError>>
  /** Borra. Borrar algo que no está **no es un error**: no hay nada que hacer. */
  readonly delete: (id: TId) => Promise<Result<void, StorageError>>
}
