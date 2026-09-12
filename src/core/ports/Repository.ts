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
export interface Repository<T, TId extends string> {
  /** La entidad, o `null` si no está guardada. */
  readonly get: (id: TId) => Promise<T | null>
  /** Todas las de esta clase. Sin orden garantizado: ordenar es de quien lee. */
  readonly getAll: () => Promise<ReadonlyArray<T>>
  /** Guarda o reemplaza. La entidad ya lleva su id dentro. */
  readonly put: (entity: T) => Promise<void>
  /** Borra. Borrar algo que no está **no es un error**: no hay nada que hacer. */
  readonly delete: (id: TId) => Promise<void>
}
