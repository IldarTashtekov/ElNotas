/**
 * Almacenamiento en memoria: tres `Map` y un número. Se borra al recargar.
 *
 * Es el que usan las pruebas de todo lo que hay por encima, sin navegador ni
 * ficheros temporales de por medio.
 *
 * Aquí sí se muta, y no contradice la regla de inmutabilidad: lo mutable es el
 * almacén, que es un contenedor y no un dato. Las entidades que entran y salen
 * siguen siendo inmutables.
 *
 * ⚠️ Devuelve el MISMO objeto que se le guardó, porque no serializa nada. El de
 * fichero devolverá uno equivalente pero distinto: nadie debe depender de esto.
 */

import type {
  Context,
  ContextId,
  Note,
  NoteId,
  Plan,
  PlanId,
  Repository,
  Revision,
  StorageAdapter,
  Result,
  StorageError,
} from "#core/index"
import { err, ok } from "#core/index"

/**
 * Un repositorio sobre un `Map`. Los tres son el mismo código: lo único que
 * necesita saber de la entidad es que lleva su `id` dentro, que es justo lo que
 * pide `Repository.put`.
 */
const createMemoryRepository = <
  T extends { readonly id: TId; readonly revision: Revision },
  TId extends string,
>(): Repository<T, TId> => {
  const guardadas: Map<TId, T> = new Map<TId, T>()

  /** `stale` si lo guardado no es lo que se esperaba; `null` si se puede seguir. */
  const comprobar = (id: TId, expected: Revision | null): StorageError | null =>
    (guardadas.get(id)?.revision ?? null) === expected ? null : { kind: "stale", id }

  return {
    /* `ok(null)` y no un error: preguntar por algo que no está guardado es una
       respuesta, no un fracaso. Es el principio de "ausencia no es fallo" visto
       desde el único sitio que puede romperlo. */
    get: async (id: TId): Promise<Result<T | null, StorageError>> =>
      ok(guardadas.get(id) ?? null),
    // Array nuevo en cada llamada, a propósito: si devolviera el interior del
    // Map, quien lo recibe podría manosear el almacén sin pasar por `put`.
    getAll: async (): Promise<Result<ReadonlyArray<T>, StorageError>> =>
      ok([...guardadas.values()]),
    put: async (entity: T, expected: Revision | null): Promise<Result<void, StorageError>> => {
      const choque: StorageError | null = comprobar(entity.id, expected)
      if (choque !== null) return err(choque)
      guardadas.set(entity.id, entity)
      return ok(undefined)
    },
    // Borrar lo que no está no es error, se esperara lo que se esperara.
    delete: async (id: TId, expected: Revision | null): Promise<Result<void, StorageError>> => {
      if (!guardadas.has(id)) return ok(undefined)
      const choque: StorageError | null = comprobar(id, expected)
      if (choque !== null) return err(choque)
      guardadas.delete(id)
      return ok(undefined)
    },
  }
}

export const createMemoryStorageAdapter = (): StorageAdapter => {
  const notes: Repository<Note, NoteId> = createMemoryRepository<Note, NoteId>()
  const plans: Repository<Plan, PlanId> = createMemoryRepository<Plan, PlanId>()
  const contexts: Repository<Context, ContextId> = createMemoryRepository<
    Context,
    ContextId
  >()

  /* Empieza en 0: un almacén vacío es "sin esquema todavía", que es lo que el
     runner de migraciones de la Fase 2 tiene que saber distinguir de "esquema
     viejo". */
  let schemaVersion: number = 0

  return {
    notes,
    plans,
    contexts,

    /*
        En memoria no hay nada que agrupar: las tres escrituras son asignaciones
        en un Map y no se pueden quedar a medias. Así que `transaction` se limita
        a ejecutar la función y a devolver lo que ella devuelva —incluido su
        `err`, intacto: quien llama necesita el `kind` original para decidir si
        reintentar, y reempaquetarlo aquí lo perdería.

        LA ÚNICA FRONTERA DE ESTE FICHERO. `fn` es código ajeno y puede lanzar
        aunque el puerto diga que no, así que el `catch` traduce la excepción a
        `io` en vez de dejarla escapar: si escapara, `transaction` estaría
        rompiendo su propia firma, que promete un `Result` y no un rechazo.

        El `async` sigue siendo necesario por el motivo de siempre, y ahora por
        dos: un `fn` que lanza de forma SÍNCRONA rompería un `transaction` sin
        `async` antes de que hubiera promesa ninguna — ni `catch` que valiera.
    */
    transaction: async <T>(
      fn: () => Promise<Result<T, StorageError>>,
    ): Promise<Result<T, StorageError>> => {
      try {
        return await fn()
      } catch (fallo: unknown) {
        const excepcionAjena: StorageError = { kind: "io", cause: fallo }
        return err(excepcionAjena)
      }
    },

    getSchemaVersion: async (): Promise<Result<number, StorageError>> => ok(schemaVersion),
    setSchemaVersion: async (v: number): Promise<Result<void, StorageError>> => {
      schemaVersion = v
      return ok(undefined)
    },
  }
}
