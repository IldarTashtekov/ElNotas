/**
 * Guardar y recuperar entidades de una clase —las notas, los planes, los
 * contextos—, sin decir dónde ni cómo se guardan.
 *
 * Es sólo la forma que tiene que cumplir quien guarde de verdad. Debajo hay otro
 * puerto, `BlobStore`, que ya no sabe qué es una Nota: sólo mueve bytes.
 */

import type { Revision } from "../domain/Ids.js"
import type { Result } from "../domain/Result.js"
import type { StorageError } from "../domain/errors/StorageError.js"

/*
    Guardar y borrar son CONDICIONALES: se dice qué `revision` se espera
    encontrar —la de lo que se leyó o se guardó la última vez—, o `null` si se
    espera que no haya nada. Si lo guardado no coincide, alguien más lo ha
    cambiado: no se escribe y sale `stale`. Así dos pestañas no se pisan.
*/
export interface Repository<T, TId extends string> {
  /** La entidad, o `null` si no está guardada — que **no** es un fallo. */
  readonly get: (id: TId) => Promise<Result<T | null, StorageError>>
  /** Todas las de esta clase. Sin orden garantizado: ordenar es de quien lee. */
  readonly getAll: () => Promise<Result<ReadonlyArray<T>, StorageError>>
  /** Guarda o reemplaza, si lo guardado es lo esperado. La entidad lleva su id dentro. */
  readonly put: (entity: T, expected: Revision | null) => Promise<Result<void, StorageError>>
  /**
   * Borra, si lo guardado es lo esperado. Borrar algo que no está **no es un
   * error**, se esperara lo que se esperara: si otro lo borró antes, queríais lo
   * mismo. Sólo es `stale` si está y otro lo ha cambiado.
   */
  readonly delete: (id: TId, expected: Revision | null) => Promise<Result<void, StorageError>>
}
