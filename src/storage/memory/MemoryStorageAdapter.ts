/**
 * Almacenamiento en memoria: tres `Map` y un número.
 *
 * Es el primer adaptador del proyecto, y está terminado **cuando pasa la suite
 * de contratos** (`../contract-tests/storageContract.test.ts`), no cuando parece
 * que funciona. Esa es la única definición de "modular" que no se degrada con el
 * tiempo: el `FileStorageAdapter` de la Fase 3 pasará exactamente la misma
 * suite, sin tocarla.
 *
 * Para qué sirve un almacén que se borra al recargar:
 *
 * - es el que usan las pruebas de todo lo que haya por encima —incluida la que
 *   comprueba que un `set-checked` redundante **no llega a disco**—, sin
 *   necesidad de navegador ni de ficheros temporales;
 * - es el que permite escribir el write-behind y el catálogo de acciones enteros
 *   antes de que exista un solo fichero de verdad.
 *
 * ── Aquí sí hay mutación, y no es una excepción a la regla ─────────────────
 *
 * El proyecto prohíbe `push` y `splice` sobre los datos del dominio, y eso sigue
 * en pie: **las entidades que entran y salen de aquí son inmutables**. Lo
 * mutable es el **almacén**, que es un contenedor y no un dato — igual que un
 * fichero en disco se sobrescribe. Confundir las dos cosas llevaría a copiar tres
 * `Map` enteros en cada escritura para nada.
 *
 * ⚠️ **Este adaptador devuelve el MISMO objeto que se le guardó**, porque no
 * serializa nada. El de fichero devolverá uno equivalente pero distinto, salido
 * de un `JSON.parse`. **Nadie debe depender de recibir el mismo objeto**, y por
 * eso el contrato compara por valor y jamás con `strictEqual`. Es el único sitio
 * del proyecto donde `deepEqual` es lo correcto, y está explicado allí.
 *
 * `BlobStore` no aparece por ninguna parte, y es lo esperado: guardar en memoria
 * no tiene "dónde van los bytes". Ese puerto es de la Fase 3.
 *
 * ── Todo devuelve `ok(...)`, y aquí eso es la verdad ───────────────────────
 *
 * Un `Map` no tiene permisos que revocar ni disco que llenar, así que **este
 * adaptador no produce ni un `StorageError`**: las siete firmas devuelven `ok`.
 * No es que se los trague — es que no los hay. El primero que falla de verdad es
 * el de fichero, de la Fase 3, y para entonces el tipo ya está en su sitio.
 *
 * La única excepción es `transaction`, que ejecuta **código ajeno** y por tanto
 * sí tiene una frontera con `try/catch`. Es la única de este fichero.
 */

import type {
  Context,
  ContextId,
  Note,
  NoteId,
  Plan,
  PlanId,
  Repository,
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
  T extends { readonly id: TId },
  TId extends string,
>(): Repository<T, TId> => {
  const guardadas: Map<TId, T> = new Map<TId, T>()

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
    put: async (entity: T): Promise<Result<void, StorageError>> => {
      guardadas.set(entity.id, entity)
      return ok(undefined)
    },
    // `Map.delete` sobre una clave que no está devuelve false y no lanza, que es
    // exactamente lo que el puerto promete: borrar lo que no existe no es error.
    delete: async (id: TId): Promise<Result<void, StorageError>> => {
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
