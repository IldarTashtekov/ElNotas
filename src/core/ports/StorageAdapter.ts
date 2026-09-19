/**
 * Un backend de almacenamiento entero: las notas, los planes, los contextos y la
 * versión del formato de lo guardado.
 *
 * Es lo que se le enchufa a la app al arrancar, y lo único que el resto del
 * proyecto conoce. Cuál es en concreto —memoria, fichero, lo que venga— se decide
 * en un solo sitio.
 *
 * ⚠️ `transaction` agrupa escrituras «lo mejor que pueda»: sobre ficheros sueltos
 * no hay atomicidad posible, así que un fallo a mitad puede dejar el disco a
 * medias. Quien la use no debe suponer lo contrario.
 */

import type { Context } from "../domain/Context"
import type { ContextId, NoteId, PlanId } from "../domain/Ids"
import type { Note } from "../domain/Note"
import type { Plan } from "../domain/Plan"
import type { Result } from "../domain/Result"
import type { StorageError } from "../domain/errors/StorageError"
import type { Repository } from "./Repository"

export interface StorageAdapter {
  readonly notes: Repository<Note, NoteId>
  readonly plans: Repository<Plan, PlanId>
  readonly contexts: Repository<Context, ContextId>

  /**
   * Agrupa escrituras. **Best-effort según el adaptador** — ver arriba.
   * El `T` es el de la función que se le pasa, no el de ninguna entidad.
   */
  readonly transaction: <T>(
    fn: () => Promise<Result<T, StorageError>>,
  ) => Promise<Result<T, StorageError>>

  /** Versión del esquema de lo guardado. Un almacén vacío responde `0`. */
  readonly getSchemaVersion: () => Promise<Result<number, StorageError>>
  readonly setSchemaVersion: (v: number) => Promise<Result<void, StorageError>>
}
