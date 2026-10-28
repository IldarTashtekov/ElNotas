/**
 * Un backend de almacenamiento entero: las notas, los diagramas, los contextos, los
 * eventos del calendario con sus grupos, las rutinas, y la versión del formato de lo guardado.
 *
 * Es lo que se le enchufa a la app al arrancar, y lo único que el resto del
 * proyecto conoce. Cuál es en concreto —memoria, fichero, lo que venga— se decide
 * en un solo sitio.
 *
 * ⚠️ `transaction` agrupa escrituras «lo mejor que pueda»: sobre ficheros sueltos
 * no hay atomicidad posible, así que un fallo a mitad puede dejar el disco a
 * medias. Quien la use no debe suponer lo contrario.
 */

import type { Context } from "../domain/Context.js"
import type { CalendarEvent } from "../domain/CalendarEvent.js"
import type { Diagram } from "../domain/Diagram.js"
import type { EventGroup } from "../domain/EventGroup.js"
import type {
  ContextId,
  DiagramId,
  EventGroupId,
  EventId,
  NoteId,
  RoutineId,
} from "../domain/Ids.js"
import type { Note } from "../domain/Note.js"
import type { Routine } from "../domain/Routine.js"
import type { Result } from "../domain/Result.js"
import type { StorageError } from "../domain/errors/StorageError.js"
import type { Repository } from "./Repository.js"

export interface StorageAdapter {
  readonly notes: Repository<Note, NoteId>
  readonly diagrams: Repository<Diagram, DiagramId>
  readonly contexts: Repository<Context, ContextId>
  readonly events: Repository<CalendarEvent, EventId>
  readonly eventGroups: Repository<EventGroup, EventGroupId>
  readonly routines: Repository<Routine, RoutineId>

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
