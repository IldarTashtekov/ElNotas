/**
 * Arranca la app: lee lo guardado, lo pone al día, y monta el estado, el
 * guardado diferido y los casos de uso.
 *
 * Es la composición: el único sitio que junta el core con un almacén concreto.
 * Qué almacén es lo decide quien llama, que le pasa el `BlobStore` ya hecho.
 *
 * Si algo falla al leer, no arranca a medias: devuelve el fallo, y lo guardado
 * no se toca. Si lo guardado es de un formato viejo, guarda lo migrado y después
 * apunta la versión; cortado a medias, el próximo arranque lo repite.
 */

import type {
  AppState,
  BlobStore,
  CalendarEvent,
  Clock,
  Context,
  Diagram,
  IdGenerator,
  ItemRef,
  Logger,
  MigrationError,
  MigrationOptions,
  MigrationResult,
  Note,
  Repository,
  Revision,
  Routine,
  Result,
  StorageAdapter,
  StorageError,
  StoredEntities,
  Store,
  UseCases,
} from "#core/index"
import { EMPTY_STORE_VERSION, createStore, createUseCases, hydrate, ok, runMigrations } from "#core/index"
import type { OnCorrupt, OnError, Schedule, WriteBehind } from "#storage/index"
import { createFileStorageAdapter, createWriteBehind, pathOf, refOf } from "#storage/index"

export interface BootDeps {
  readonly blobs: BlobStore
  readonly clock: Clock
  readonly ids: IdGenerator
  readonly logger: Logger
  /**
   * Si un fichero ilegible se salta —y la app arranca con el resto, diciendo
   * cuáles en `App.corrupt`— o impide arrancar. Por defecto, lo impide.
   */
  readonly skipCorrupt?: boolean
  /** A quién avisar si el guardado se detiene. Sin él, sólo se entera `flush`. */
  readonly onError?: OnError
  /** Para las pruebas: en producción se usan los del write-behind. */
  readonly delayMs?: number
  readonly schedule?: Schedule
  /** Para las pruebas: en producción, las migraciones y la versión del core. */
  readonly migrations?: MigrationOptions
}

/** La app montada. `flush` escribe ya lo pendiente: para el cierre de la página. */
export interface App {
  readonly store: Store
  readonly useCases: UseCases
  readonly flush: () => Promise<Result<void, StorageError>>
  /** Los ficheros que no se pudieron leer y se saltaron. Vacío es lo normal. */
  readonly corrupt: ReadonlyArray<StorageError>
}

/** Los dos orígenes posibles del fallo. Sus `kind` no se solapan. */
export type BootError = StorageError | MigrationError

/**
 * Guarda las que la migración cambió —las que ya no son el mismo objeto—, cada
 * una esperando la revisión con la que se leyó; una nueva, que no haya nada.
 */
const guardarCambiadas = async <T extends { readonly id: TId; readonly revision: Revision }, TId extends string>(
  repo: Repository<T, TId>,
  antes: ReadonlyArray<T>,
  despues: ReadonlyArray<T>,
): Promise<Result<void, StorageError>> => {
  const leidas: ReadonlyMap<string, T> = new Map<string, T>(antes.map((e: T): readonly [string, T] => [e.id, e]))
  for (const entidad of despues) {
    const leida: T | undefined = leidas.get(entidad.id)
    if (leida === entidad) continue
    const hecho: Result<void, StorageError> = await repo.put(entidad, leida?.revision ?? null)
    if (!hecho.ok) return hecho
  }
  return ok(undefined)
}

/** Todo lo migrado, clase a clase. Sobre ficheros no es atómico: lo repite el próximo arranque. */
const guardarMigrado = (
  adapter: StorageAdapter,
  antes: StoredEntities,
  despues: StoredEntities,
): Promise<Result<void, StorageError>> =>
  adapter.transaction(async (): Promise<Result<void, StorageError>> => {
    const pasos: ReadonlyArray<() => Promise<Result<void, StorageError>>> = [
      (): Promise<Result<void, StorageError>> => guardarCambiadas(adapter.notes, antes.notes, despues.notes),
      (): Promise<Result<void, StorageError>> => guardarCambiadas(adapter.diagrams, antes.diagrams, despues.diagrams),
      (): Promise<Result<void, StorageError>> => guardarCambiadas(adapter.contexts, antes.contexts, despues.contexts),
      /* Eventos y rutinas pueden faltar en lo guardado antes de que existieran. */
      (): Promise<Result<void, StorageError>> =>
        guardarCambiadas(adapter.events, antes.events ?? [], despues.events ?? []),
      (): Promise<Result<void, StorageError>> =>
        guardarCambiadas(adapter.routines, antes.routines ?? [], despues.routines ?? []),
    ]
    for (const paso of pasos) {
      const hecho: Result<void, StorageError> = await paso()
      if (!hecho.ok) return hecho
    }
    return ok(undefined)
  })

export const boot = async ({
  blobs,
  clock,
  ids,
  logger,
  skipCorrupt = false,
  onError,
  delayMs,
  schedule,
  migrations = {},
}: BootDeps): Promise<Result<App, BootError>> => {
  /* Los ficheros que se saltan: para decirlo, y para que sus referencias no se
     pierdan. Sin `skipCorrupt` no se salta ninguno: se corta la lectura. */
  let saltados: ReadonlyArray<StorageError> = []
  const apuntar: OnCorrupt = (fallo: StorageError): void => {
    saltados = [...saltados, fallo]
  }
  const adapter: StorageAdapter = createFileStorageAdapter(blobs, skipCorrupt ? { onCorrupt: apuntar } : {})

  const version: Result<number, StorageError> = await adapter.getSchemaVersion()
  if (!version.ok) return version

  const notes: Result<ReadonlyArray<Note>, StorageError> = await adapter.notes.getAll()
  if (!notes.ok) return notes
  const diagrams: Result<ReadonlyArray<Diagram>, StorageError> = await adapter.diagrams.getAll()
  if (!diagrams.ok) return diagrams
  const contexts: Result<ReadonlyArray<Context>, StorageError> = await adapter.contexts.getAll()
  if (!contexts.ok) return contexts
  const events: Result<ReadonlyArray<CalendarEvent>, StorageError> = await adapter.events.getAll()
  if (!events.ok) return events
  const routines: Result<ReadonlyArray<Routine>, StorageError> = await adapter.routines.getAll()
  if (!routines.ok) return routines

  const ilegibles: ReadonlySet<string> = new Set<string>(
    saltados.flatMap((f: StorageError): ReadonlyArray<string> => (f.kind === "corrupt" ? [f.path] : [])),
  )
  const guardado: StoredEntities = {
    notes: notes.value,
    diagrams: diagrams.value,
    contexts: contexts.value,
    events: events.value,
    routines: routines.value,
    /* La migración no los ve, pero un enlace a uno de ellos no es como uno a lo que no está. */
    unreadable: [...ilegibles].flatMap((camino: string): ReadonlyArray<ItemRef> => {
      const ref: ItemRef | null = refOf(camino)
      return ref === null ? [] : [ref]
    }),
  }
  const migrado: Result<MigrationResult, MigrationError> = runMigrations(guardado, version.value, migrations)
  if (!migrado.ok) return migrado

  /* El único casting del arranque: lo que sale de las migraciones es `unknown`.
     Sin migraciones aplicadas es literalmente `guardado`. Lo leído se validó al
     leerlo, con las formas que la migración espera; lo migrado lo valida ella. */
  const migradas: StoredEntities = migrado.value.data as StoredEntities

  /* Lo migrado se guarda ANTES de apuntar la versión: si se corta en medio, la
     versión sigue siendo la vieja y el próximo arranque migra otra vez. */
  if (migrado.value.applied > 0) {
    const guardadas: Result<void, StorageError> = await guardarMigrado(adapter, guardado, migradas)
    if (!guardadas.ok) return guardadas
  }

  /* Almacén vacío: se apunta ya la versión. Sin esto, uno con notas seguiría
     diciendo «0», y la primera migración lo tomaría por vacío y se la saltaría. */
  if (version.value === EMPTY_STORE_VERSION || migrado.value.applied > 0) {
    const apuntada: Result<void, StorageError> = await adapter.setSchemaVersion(migrado.value.version)
    if (!apuntada.ok) return apuntada
  }

  const estado: AppState = hydrate(migradas, (item: ItemRef): boolean => {
    const camino: string | null = pathOf(item)
    return camino !== null && ilegibles.has(camino)
  })

  const store: Store = createStore(estado)
  const writer: WriteBehind = createWriteBehind({
    adapter,
    initial: estado,
    delayMs,
    schedule,
    onError,
    logger,
  })
  store.subscribe(writer.onState)

  const app: App = {
    store,
    useCases: createUseCases({ clock, ids, store }),
    flush: writer.flush,
    corrupt: saltados,
  }
  return ok(app)
}
