/**
 * Arranca la app: lee lo guardado, lo pone al día, y monta el estado, el
 * guardado diferido y los casos de uso.
 *
 * Es la composición: el único sitio que junta el core con un almacén concreto.
 * Qué almacén es lo decide quien llama, que le pasa el `BlobStore` ya hecho.
 *
 * Si algo falla al leer, no arranca a medias: devuelve el fallo, y lo guardado
 * no se toca.
 */

import type {
  AppState,
  BlobStore,
  Clock,
  Context,
  IdGenerator,
  MigrationError,
  MigrationResult,
  Note,
  Plan,
  Result,
  StorageAdapter,
  StorageError,
  StoredEntities,
  Store,
  UseCases,
} from "#core/index"
import {
  CURRENT_SCHEMA_VERSION,
  EMPTY_STORE_VERSION,
  createStore,
  createUseCases,
  hydrate,
  ok,
  runMigrations,
} from "#core/index"
import type { OnCorrupt, OnError, Schedule, WriteBehind } from "#storage/index"
import { createFileStorageAdapter, createWriteBehind } from "#storage/index"

export interface BootDeps {
  readonly blobs: BlobStore
  readonly clock: Clock
  readonly ids: IdGenerator
  /**
   * A quién avisar de un fichero ilegible. Con él, ese fichero se salta y la app
   * arranca con el resto; sin él, no arranca.
   */
  readonly onCorrupt?: OnCorrupt
  /** A quién avisar si el guardado se detiene. Sin él, sólo se entera `flush`. */
  readonly onError?: OnError
  /** Para las pruebas: en producción se usan los del write-behind. */
  readonly delayMs?: number
  readonly schedule?: Schedule
}

/** La app montada. `flush` escribe ya lo pendiente: para el cierre de la página. */
export interface App {
  readonly store: Store
  readonly useCases: UseCases
  readonly flush: () => Promise<Result<void, StorageError>>
}

/** Los dos orígenes posibles del fallo. Sus `kind` no se solapan. */
export type BootError = StorageError | MigrationError

export const boot = async ({
  blobs,
  clock,
  ids,
  onCorrupt,
  onError,
  delayMs,
  schedule,
}: BootDeps): Promise<Result<App, BootError>> => {
  const adapter: StorageAdapter = createFileStorageAdapter(blobs, { onCorrupt })

  const version: Result<number, StorageError> = await adapter.getSchemaVersion()
  if (!version.ok) return version

  const notes: Result<ReadonlyArray<Note>, StorageError> = await adapter.notes.getAll()
  if (!notes.ok) return notes
  const plans: Result<ReadonlyArray<Plan>, StorageError> = await adapter.plans.getAll()
  if (!plans.ok) return plans
  const contexts: Result<ReadonlyArray<Context>, StorageError> =
    await adapter.contexts.getAll()
  if (!contexts.ok) return contexts

  const guardado: StoredEntities = {
    notes: notes.value,
    plans: plans.value,
    contexts: contexts.value,
  }
  const migrado: Result<MigrationResult, MigrationError> = runMigrations(
    guardado,
    version.value,
  )
  if (!migrado.ok) return migrado

  /* Almacén vacío: se apunta ya la versión. Sin esto, uno con notas seguiría
     diciendo «0», y el día que haya una migración se tomaría por vacío y se la
     saltaría. Con migraciones aplicadas habría que escribir además lo migrado
     antes de subir la versión; hoy no hay ninguna, así que ese caso no llega. */
  if (version.value === EMPTY_STORE_VERSION) {
    const apuntada: Result<void, StorageError> =
      await adapter.setSchemaVersion(CURRENT_SCHEMA_VERSION)
    if (!apuntada.ok) return apuntada
  }

  /* El único casting del arranque: lo que sale de las migraciones es `unknown`.
     Con la lista vacía es literalmente `guardado`; validar la forma de lo leído
     es otra tarea, la de la validación de esquema. */
  const estado: AppState = hydrate(migrado.value.data as StoredEntities)

  const store: Store = createStore(estado)
  const writer: WriteBehind = createWriteBehind({
    adapter,
    initial: estado,
    delayMs,
    schedule,
    onError,
  })
  store.subscribe(writer.onState)

  const app: App = {
    store,
    useCases: createUseCases({ clock, ids, store }),
    flush: writer.flush,
  }
  return ok(app)
}
