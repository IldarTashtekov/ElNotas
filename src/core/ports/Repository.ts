/**
 * Puerto de un almacén de entidades de una clase.
 *
 * Es el nivel **alto** de la persistencia: sabe qué es una Nota y la devuelve ya
 * montada. Debajo hay otro puerto, `BlobStore`, que sólo mueve bytes y no sabe
 * nada de entidades (`ARCHITECTURE.md` §6.1).
 *
 * ── Por qué todo es `async`, incluso el adaptador de memoria ────────────────
 *
 * El primer adaptador que se escribe guarda las entidades en un `Map`, y ahí
 * `get` podría devolver la Nota directamente, sin `Promise`. **Sería una trampa
 * que se cobra dos fases más tarde:** en cuanto detrás haya un fichero, una red
 * o una base de datos —y el plan dice que los habrá—, las firmas pasan a ser
 * asíncronas y hay que reescribir a **todos** los llamantes, no sólo al
 * adaptador. La `Promise` de más en memoria es un coste que no se nota; la
 * reescritura sí.
 *
 * ── Por qué `null` y no `undefined` ────────────────────────────────────────
 *
 * `get` devuelve `T | null` a propósito, aunque el resto del proyecto conviva
 * con `undefined` por `noUncheckedIndexedAccess`. La diferencia es que aquí el
 * valor es una **respuesta**, no una ausencia: `null` dice "he ido a buscarlo y
 * no está", que es distinto de "no me han dado nada". Indexar un `Record` es lo
 * segundo; preguntarle a un almacén es lo primero.
 *
 * ── Todo devuelve `Result`, y el fallo deja de ser invisible ───────────────
 *
 * Las cuatro firmas van envueltas en `Result<…, StorageError>` (§6.5). El motivo
 * es que la versión anterior —`put(entity: T): Promise<void>`— es, leída, una
 * función que promete **no fallar nunca**: una excepción no aparece en ninguna
 * firma, así que quien llamaba no se enteraba de que había un caso que tratar y
 * el compilador tampoco podía avisarle. Ahora el caso está dentro del tipo.
 *
 * Consecuencia para quien implemente un adaptador: **ninguno de estos cuatro
 * métodos lanza**. El `try/catch` no desaparece —`JSON.parse` lanza y la File
 * System Access API también—, se confina: cada adaptador tiene **una frontera**
 * donde envuelve la llamada de plataforma y la traduce a `err(...)`.
 *
 * ── ⚠️ Ausencia NO es fallo, y por eso `Result<T | null, …>` ───────────────
 *
 * El `null` sigue **dentro** del `ok`, no se ha convertido en un error. Son dos
 * respuestas distintas y hace falta poder distinguirlas:
 *
 *     ok(null)                       he ido a mirar y esa nota no está guardada
 *     err({ kind: "permission-denied" })   no he podido ni mirar
 *
 * Colapsarlas en un solo caso sería perder justo la información que luego hace
 * falta para decidir. Lo mismo con `delete`: borrar algo que no está devuelve
 * `ok`, porque no hay nada que hacer y eso no es un fracaso.
 *
 * ── Por qué el id va marcado ───────────────────────────────────────────────
 *
 * El boceto de `ARCHITECTURE.md` §6.1 escribía `get(id: string)`. Aquí lleva un
 * segundo parámetro de tipo para que sea `NoteId` y no `string` pelado: con un
 * `string` se puede pasar un `ContextId` al repositorio de notas y compila
 * perfectamente, que es exactamente el fallo que los ids marcados existen para
 * impedir (§2.4). La marca no cuesta nada en runtime.
 *
 * Sin implementaciones aquí: el de memoria llega en la Fase 2 y vive en
 * `src/storage/`, fuera del core.
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
