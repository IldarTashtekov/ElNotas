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
} from "#core/index"

/**
 * Un repositorio sobre un `Map`. Los tres son el mismo código: lo único que
 * necesita saber de la entidad es que lleva su `id` dentro, que es justo lo que
 * pide `Repository.put`.
 */
const createMemoryRepository = <
  T extends { readonly id: TId },
  TId extends string,
>(): Repository<T, TId> => {
  const guardadas = new Map<TId, T>()

  return {
    get: async (id) => guardadas.get(id) ?? null,
    // Array nuevo en cada llamada, a propósito: si devolviera el interior del
    // Map, quien lo recibe podría manosear el almacén sin pasar por `put`.
    getAll: async () => [...guardadas.values()],
    put: async (entity) => {
      guardadas.set(entity.id, entity)
    },
    // `Map.delete` sobre una clave que no está devuelve false y no lanza, que es
    // exactamente lo que el puerto promete: borrar lo que no existe no es error.
    delete: async (id) => {
      guardadas.delete(id)
    },
  }
}

export const createMemoryStorageAdapter = (): StorageAdapter => {
  const notes = createMemoryRepository<Note, NoteId>()
  const plans = createMemoryRepository<Plan, PlanId>()
  const contexts = createMemoryRepository<Context, ContextId>()

  /* Empieza en 0: un almacén vacío es "sin esquema todavía", que es lo que el
     runner de migraciones de la Fase 2 tiene que saber distinguir de "esquema
     viejo". */
  let schemaVersion = 0

  return {
    notes,
    plans,
    contexts,

    /*
        En memoria no hay nada que agrupar: las tres escrituras son asignaciones
        en un Map y no se pueden quedar a medias. Así que `transaction` se limita
        a ejecutar la función.

        Es `async` a propósito, aunque `fn()` ya devuelva una promesa: si `fn`
        lanzara de forma SÍNCRONA, un `transaction` sin `async` lanzaría también
        de forma síncrona en vez de devolver una promesa rechazada, y quien
        esperase poder hacer `.catch()` se quedaría con la excepción por la cara.
    */
    transaction: async (fn) => fn(),

    getSchemaVersion: async () => schemaVersion,
    setSchemaVersion: async (v) => {
      schemaVersion = v
    },
  }
}
