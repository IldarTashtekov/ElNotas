/**
 * Guarda cada nota, plan y contexto en su propio fichero JSON, más un
 * `manifest.json` con la versión del formato.
 *
 * Es la pieza que sabe de formato: convierte una entidad en texto y decide cómo
 * se llama su fichero. Dónde acaban esos bytes —el navegador, una carpeta tuya,
 * OPFS, Drive— lo pone el `BlobStore` que reciba.
 *
 * ⚠️ Un solo fichero ilegible tumba la lectura entera: hoy una nota rota impide
 * abrir la app. Arreglarlo es de la Fase 4.
 */

import type {
  BlobStore,
  Context,
  ContextId,
  Note,
  NoteId,
  Plan,
  PlanId,
  Repository,
  Result,
  StorageAdapter,
  StorageError,
} from "#core/index"
import { err, ok } from "#core/index"

/* ════════════════════════════ El esquema en disco ══════════════════════════ */

/*
    Las cuatro constantes que son **el formato**. Todo lo demás de este fichero
    es maquinaria alrededor de ellas, y fuera de aquí no se escribe ni una.
*/

const CARPETA_NOTAS: string = "notes/"
const CARPETA_PLANES: string = "plans/"
const CARPETA_CONTEXTOS: string = "contexts/"
const CAMINO_MANIFEST: string = "manifest.json"
const EXTENSION: string = ".json"

/**
 * Lo que va en `manifest.json`: sólo la versión del formato. Objeto y no número
 * pelado para que pueda crecer sin romper lo ya escrito.
 *
 * No lleva índice de ids a propósito. La carpeta es la única fuente de verdad, y
 * un índice desincronizado escondería notas que están en disco, intactas.
 */
interface Manifest {
  readonly schemaVersion: number
}

/**
 * id → camino (`notes/<id>.json`). La traducción que este fichero concentra.
 *
 * ⚠️ Devuelve `Result` porque `encodeURIComponent` **lanza**: un id con un
 * surrogate suelto tira `URIError`, y los ids vienen del disco, donde nadie ha
 * comprobado más que sean cadenas. Sale `corrupt` —el id seguirá siendo inválido
 * la próxima vez— y es el único `kind` con `path`, o sea el único que puede decir
 * cuál es la entidad que no se puede nombrar.
 *
 * El `encodeURIComponent` impide además que un id con `/` o `..` escriba fuera de
 * su carpeta. No hace falta descodificar: el id de vuelta sale del JSON.
 */
const caminoDe = (carpeta: string, id: string): Result<string, StorageError> => {
  try {
    return ok(`${carpeta}${encodeURIComponent(id)}${EXTENSION}`)
  } catch (fallo: unknown) {
    const idImposible: StorageError = {
      kind: "corrupt",
      path: `${carpeta}<id no representable>${EXTENSION}`,
      cause: fallo,
    }
    return err(idImposible)
  }
}

/**
 * Si un camino del `list` es una entidad de esta carpeta y no otra cosa.
 *
 * Hace falta porque **una carpeta de verdad es un sitio compartido**: el sistema
 * operativo y el usuario dejan ahí sus cosas, y un `.DS_Store` o un fichero a
 * medias de otro programa no deben convertir el `getAll` en un `corrupt`. Se
 * exige la extensión y que no haya nada anidado por debajo, que es lo único que
 * `caminoDe` puede producir.
 */
const esEntidadDe = (carpeta: string, camino: string): boolean =>
  camino.startsWith(carpeta) &&
  camino.endsWith(EXTENSION) &&
  !camino.slice(carpeta.length, camino.length - EXTENSION.length).includes("/")

/* ══════════════════════ La frontera: bytes ⇄ JSON ═════════════════════════ */

const codificador: TextEncoder = new TextEncoder()

/**
 * `fatal: true` a propósito. Por defecto un `TextDecoder` **se traga** los bytes
 * que no son UTF-8 válido y los sustituye por `U+FFFD`, así que un fichero medio
 * escrito se convertiría en un texto plausible y el fallo aparecería más tarde y
 * peor. Con `fatal` lanza, y lanzar aquí dentro es exactamente lo que se quiere:
 * el `catch` de `parsear` lo traduce a `corrupt`, que es la verdad.
 */
const descodificador: TextDecoder = new TextDecoder("utf-8", { fatal: true })

/**
 * Entidad → bytes. Una de las dos fronteras con `try/catch` de la lectura y la
 * escritura.
 *
 * Se indenta y se cierra con salto de línea para que los diffs sean pequeños: un
 * JSON en una sola línea haría que cambiar una palabra reescribiera la línea
 * entera.
 *
 * El `catch` cubre un caso que los tipos ya impiden —`JSON.stringify` sólo lanza
 * con ciclos o `BigInt`— y aun así está, porque una promesa que se sostiene en un
 * razonamiento es más débil que una que se sostiene en el código. Sale `io` y no
 * `corrupt`: en disco no hay nada roto, esto sería un bug nuestro.
 */
const aBytes = (valor: unknown): Result<Uint8Array, StorageError> => {
  try {
    return ok(codificador.encode(`${JSON.stringify(valor, null, 2)}\n`))
  } catch (fallo: unknown) {
    const noSerializable: StorageError = { kind: "io", cause: fallo }
    return err(noSerializable)
  }
}

/**
 * Bytes → objeto JSON, o `corrupt`. **La otra frontera con `try/catch`.**
 *
 * Aquí es donde nace el único `StorageError` que este adaptador inventa, y es su
 * negocio porque es quien parsea. El `path` viaja dentro del error porque de un
 * `corrupt` hay que poder **decir cuál** es el fichero que no se entiende; sin
 * camino no serviría para nada de eso.
 *
 * Se exige además que lo parseado sea un objeto: un fichero con `42`, `null` o
 * `[]` dentro es JSON válido y no es una entidad. Lo que **no** se hace es
 * validar el esquema campo a campo —que `content` sea un array de `Content`,
 * etc.—; eso es un validador, no cabe en una frontera, y no hay dependencia que
 * lo haga. Anotado como lo que es: un agujero conocido.
 */
const parsear = (
  camino: string,
  bytes: Uint8Array,
): Result<Record<string, unknown>, StorageError> => {
  try {
    const texto: string = descodificador.decode(bytes)
    const valor: unknown = JSON.parse(texto)

    if (typeof valor !== "object" || valor === null || Array.isArray(valor)) {
      const noEsUnObjeto: StorageError = {
        kind: "corrupt",
        path: camino,
        cause: "el JSON no es un objeto",
      }
      return err(noEsUnObjeto)
    }

    return ok(valor as Record<string, unknown>)
  } catch (fallo: unknown) {
    /* `fallo` es `unknown` por `useUnknownInCatchVariables`, y viaja intacto en
       `cause`: es para depurar, no para enseñar. */
    const ilegible: StorageError = { kind: "corrupt", path: camino, cause: fallo }
    return err(ilegible)
  }
}

/**
 * Bytes → entidad. `parsear` más la única comprobación que se puede hacer sin
 * un validador: que lleve un `id` de texto, que es lo único que el `Repository`
 * necesita de ella (lo dice su `put`: «la entidad ya lleva su id dentro»).
 */
const entidadDe = <T>(camino: string, bytes: Uint8Array): Result<T, StorageError> => {
  const parsed: Result<Record<string, unknown>, StorageError> = parsear(camino, bytes)
  if (!parsed.ok) return parsed

  if (typeof parsed.value["id"] !== "string") {
    const sinId: StorageError = {
      kind: "corrupt",
      path: camino,
      cause: "el objeto no tiene un id de texto",
    }
    return err(sinId)
  }

  /* El único casting del fichero, y es inevitable: `JSON.parse` devuelve `any`
     y nadie puede demostrarle a TypeScript que esos bytes son una `Note`. Lo
     que se ha comprobado antes es lo que se puede comprobar sin validador. */
  return ok(parsed.value as T)
}

/* ════════════════════════════ Un repositorio ══════════════════════════════ */

/**
 * Los tres repositorios son este mismo código con otra carpeta, igual que en el
 * adaptador de memoria. Lo único que necesita saber de la entidad es que lleva
 * su `id` dentro.
 */
const createFileRepository = <T extends { readonly id: TId }, TId extends string>(
  blobs: BlobStore,
  carpeta: string,
): Repository<T, TId> => ({
  get: async (id: TId): Promise<Result<T | null, StorageError>> => {
    const destino: Result<string, StorageError> = caminoDe(carpeta, id)
    if (!destino.ok) return destino

    const camino: string = destino.value
    const leido: Result<Uint8Array | null, StorageError> = await blobs.read(camino)

    // El err del BlobStore, TAL CUAL. Envolverlo perdería el `kind` de origen.
    if (!leido.ok) return leido
    // AUSENCIA NO ES FALLO: ese camino no existe, y eso es una respuesta.
    if (leido.value === null) return ok(null)

    return entidadDe<T>(camino, leido.value)
  },

  /**
   * ⚠️ **Un fichero ilegible tumba la lectura entera**, y hoy eso significa que
   * una sola nota rota impide abrir la app.
   *
   * La firma es todo o nada —no hay dónde poner «estas nueve, y la décima está
   * rota»—, así que al primer `corrupt` se corta y sale el `path` del culpable.
   * Saltárselo en silencio sería peor: el write-behind daría esa nota por borrada
   * y la limpiaría de los contextos, convirtiendo un fichero recuperable en una
   * pérdida de verdad.
   *
   * El arreglo está decidido y aplazado a la Fase 4 (`onCorrupt`, anotado en
   * `TAREAS.md`): saltar la entidad y avisar de cuál, sin tocar el puerto. La
   * prueba que fija esto lleva ⚠️ en `FileStorageAdapter.errors.test.ts`, y la
   * marca se queda para que el día que cambie se vea en el diff.
   */
  getAll: async (): Promise<Result<ReadonlyArray<T>, StorageError>> => {
    const listado: Result<ReadonlyArray<string>, StorageError> = await blobs.list(carpeta)
    if (!listado.ok) return listado

    /* Acumulador local, y no contradice la regla de inmutabilidad: lo que ésa
       prohíbe es mutar datos del dominio, y esto es un array que se construye
       aquí y sale de una pieza — igual que el `[...map.values()]` del adaptador
       de memoria. Hace falta un bucle porque hay que cortar al primer fallo. */
    const entidades: T[] = []

    for (const camino of listado.value) {
      if (!esEntidadDe(carpeta, camino)) continue

      const leido: Result<Uint8Array | null, StorageError> = await blobs.read(camino)
      if (!leido.ok) return leido
      /* Estaba en el listado y ya no está: lo han borrado entre el `list` y el
         `read`. No es un fallo — es exactamente lo que `getAll` habría
         devuelto si el borrado hubiera llegado un instante antes. */
      if (leido.value === null) continue

      const entidad: Result<T, StorageError> = entidadDe<T>(camino, leido.value)
      if (!entidad.ok) return entidad

      entidades.push(entidad.value)
    }

    return ok(entidades)
  },

  put: async (entity: T): Promise<Result<void, StorageError>> => {
    const destino: Result<string, StorageError> = caminoDe(carpeta, entity.id)
    if (!destino.ok) return destino

    const bytes: Result<Uint8Array, StorageError> = aBytes(entity)
    if (!bytes.ok) return bytes

    /* El `Result` del `BlobStore` sale tal cual, sin mirarlo siquiera: si es un
       `quota-exceeded`, quien llama necesita ese `kind` para dejar de insistir
       y avisar de que hay que hacer hueco. */
    return blobs.write(destino.value, bytes.value)
  },

  /* Borrar lo que no está no es un error, y aquí no hay nada que hacer para
     conseguirlo: el propio `BlobStore` promete lo mismo en su puerto. */
  delete: async (id: TId): Promise<Result<void, StorageError>> => {
    const destino: Result<string, StorageError> = caminoDe(carpeta, id)
    if (!destino.ok) return destino

    return blobs.delete(destino.value)
  },
})

/* ═════════════════════════════ El adaptador ═══════════════════════════════ */

export const createFileStorageAdapter = (blobs: BlobStore): StorageAdapter => {
  const notes: Repository<Note, NoteId> = createFileRepository<Note, NoteId>(
    blobs,
    CARPETA_NOTAS,
  )
  const plans: Repository<Plan, PlanId> = createFileRepository<Plan, PlanId>(
    blobs,
    CARPETA_PLANES,
  )
  const contexts: Repository<Context, ContextId> = createFileRepository<Context, ContextId>(
    blobs,
    CARPETA_CONTEXTOS,
  )

  return {
    notes,
    plans,
    contexts,

    /**
     * *Best-effort*, y aquí eso es literal: ejecuta la función y devuelve lo que
     * ella devuelva. Ni agrupa, ni difiere, ni deshace nada — sobre ficheros
     * sueltos no hay transacción posible. No hay atomicidad, ni aislamiento, ni
     * lecturas consistentes.
     *
     * ⚠️ Lo único que promete, y de lo que el write-behind depende: **las
     * escrituras salen en el orden en que se pidieron**. Él hace primero todos
     * los `put` y después todos los `delete` para que el peor caso sea una nota
     * de más, y nunca una referencia apuntando a algo que ya no existe.
     *
     * El `async` de la firma no es decorativo: sin él, un `fn` que lance de forma
     * síncrona rompería antes de que existiera promesa, y no habría `catch` a
     * tiempo.
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

    /**
     * Sin manifiesto, versión 0: un almacén vacío es «aquí no se ha escrito
     * nunca nada», que es lo que el runner de migraciones tiene que distinguir
     * de «esquema viejo». El `null` del `read` es ausencia, no fallo, así que no
     * se convierte en `not-found`.
     *
     * Un manifiesto ilegible, en cambio, **sí** es `corrupt`: es un fichero que
     * este adaptador parsea, o sea su negocio. Y conviene que lo sea, porque
     * migrar sin saber de qué versión se viene es la forma de estropear lo
     * guardado de verdad.
     */
    getSchemaVersion: async (): Promise<Result<number, StorageError>> => {
      const leido: Result<Uint8Array | null, StorageError> =
        await blobs.read(CAMINO_MANIFEST)
      if (!leido.ok) return leido
      if (leido.value === null) return ok(0)

      const manifest: Result<Record<string, unknown>, StorageError> = parsear(
        CAMINO_MANIFEST,
        leido.value,
      )
      if (!manifest.ok) return manifest

      const version: unknown = manifest.value["schemaVersion"]
      if (typeof version !== "number") {
        const sinVersion: StorageError = {
          kind: "corrupt",
          path: CAMINO_MANIFEST,
          cause: "el manifiesto no tiene schemaVersion numérico",
        }
        return err(sinVersion)
      }

      return ok(version)
    },

    /* El manifiesto se reescribe entero, que hoy es exacto porque sólo tiene
       este campo (decisión 1). El día que tenga un segundo, esto pasa a ser
       leer-modificar-escribir. */
    setSchemaVersion: async (v: number): Promise<Result<void, StorageError>> => {
      const manifest: Manifest = { schemaVersion: v }
      const bytes: Result<Uint8Array, StorageError> = aBytes(manifest)
      if (!bytes.ok) return bytes

      return blobs.write(CAMINO_MANIFEST, bytes.value)
    },
  }
}
