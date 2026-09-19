/**
 * Almacenamiento en ficheros JSON: **un fichero por entidad**, más un
 * `manifest.json` (`ARCHITECTURE.md` §6.2).
 *
 * Es la mitad de arriba del reparto en dos niveles de §6.1, y **aquí está toda
 * la lógica de la persistencia en fichero**. Su trabajo son cuatro cosas:
 *
 *     serializa            Note | Plan | Context → JSON → bytes, y la vuelta
 *     traduce id → camino  NoteId → "notes/<id>.json"
 *     mantiene el manifest  la versión de esquema de lo guardado
 *     implementa StorageAdapter  los tres Repository, transaction y el esquema
 *
 * Va **parametrizado por `BlobStore`**, que le llega por constructor, así que no
 * sabe si detrás hay `localStorage`, una carpeta de verdad, OPFS o Drive. Ése es
 * el beneficio entero del reparto: **el esquema `notes/<id>.json` vive en este
 * único fichero del proyecto**, y cambiarlo —o pasar de JSON a otro formato— se
 * toca aquí y en ningún otro sitio. Los `BlobStore` ni se enteran.
 *
 * Está terminado **cuando pasa la suite de contratos** (§6.3), igual que el de
 * memoria, y la pasa con un `BlobStore` falso en Node: por eso es la única parte
 * de la Fase 3 que se verifica entera sin navegador.
 *
 * ── El reparto de errores: cada nivel traduce lo suyo ──────────────────────
 *
 * Es lo que hay que tener claro antes de tocar nada de aquí:
 *
 *     BlobStore           traduce los fallos de ENTRADA/SALIDA de SU plataforma
 *                         — permisos, cuota, la carpeta que ya no está.
 *     FileStorageAdapter  traduce lo suyo, que es la SERIALIZACIÓN: un
 *                         `JSON.parse` que falla es `corrupt`, con su `path`.
 *
 * De ahí las dos reglas que este fichero cumple sin excepción:
 *
 * 1. **un `err` del `BlobStore` se propaga tal cual**, sin reempaquetar. Meter
 *    un `permission-denied` dentro de un `io` sería decirle a quien llama que
 *    reintentar sirve justo cuando no sirve — y es lo único que la taxonomía
 *    existe para evitar (§6.5);
 * 2. **lo único que este fichero inventa es `corrupt`**, porque es quien parsea:
 *    un `BlobStore` no sabe qué son esos bytes, así que no puede decidir que el
 *    **contenido** esté corrupto. (Que uno de ellos produzca `corrupt` por su
 *    **sobre** —el base64 de `LocalStorageBlobStore`, que escribió él mismo— no
 *    rompe el reparto; la frontera exacta está en la cabecera de `BlobStore.ts`.)
 *
 * Y **ausencia no es fallo**: un `read` que devuelve `ok(null)` —ese camino no
 * existe— sale de `get` como `ok(null)`, nunca como `err(not-found)`. Borrar lo
 * que no está es `ok`, porque no hay nada que hacer.
 *
 * ── El `try/catch`, confinado a dos funciones ──────────────────────────────
 *
 * `JSON.parse` lanza por su cuenta, y `TextDecoder` con `fatal: true` también.
 * Ésa es la frontera de este adaptador, y está en `parsear` y en `aBytes`; por
 * encima de esas dos funciones ninguna firma lanza. La tercera es `transaction`,
 * que es la única que ejecuta **código ajeno** — misma frontera que en el
 * adaptador de memoria.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  TRES DECISIONES TOMADAS AQUÍ, Y LAS TRES CONFIRMADAS
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * La documentación no las resolvía, así que se decidieron aquí; el usuario las
 * confirmó las tres y quedan cerradas. Se dejan visibles porque lo que vale de
 * ellas no es el veredicto sino el motivo, y cada una está razonada entera en
 * su sitio, más abajo.
 *
 * **1. El `manifest.json` lleva SÓLO la versión de esquema; NO lleva índice de
 * ids.** `getAll` se resuelve con `list(prefijo)` y una lectura por entidad. Un
 * índice ahorraría ese `list` a cambio de tener **dos fuentes de verdad** que se
 * pueden desincronizar, y la carpeta ya es una de ellas. Ver `Manifest`.
 *
 * **2. `transaction` no es atómica, y lo que garantiza está escrito.** No hay
 * transacción posible sobre ficheros sueltos: lo que promete es que no reordena
 * ni agrupa, que el `err` de dentro sale intacto y que una excepción se traduce
 * a `io`. Ver `transaction`.
 *
 * **3. Un fichero corrupto tumba el `getAll` entero**, con el `path` del
 * culpable. Es lo único honesto que permite la firma del puerto —`Result<T[],
 * …>` es todo o nada— y **contradice a §6.5**, que pide aislar esa entidad y
 * seguir con el resto: dicho sin suavizarlo, **hoy una sola nota ilegible
 * impide abrir la app**. Se confirma a sabiendas, porque las dos alternativas
 * son peores, y el arreglo bueno —un `onCorrupt`— queda aplazado a la Fase 4.
 * Ver `getAll`.
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
 * **DECISIÓN 1, confirmada: qué lleva dentro el manifiesto.**
 *
 * Lleva **sólo la versión de esquema**, que es lo que está decidido que vive en
 * el almacén y no en `AppState` (§9.7), porque es propiedad de lo guardado. Va
 * como objeto y no como un número pelado para que pueda crecer sin romper lo ya
 * escrito: `JSON.parse` de `{"schemaVersion":3}` sigue funcionando el día que
 * haya un segundo campo.
 *
 * **Lo que NO lleva es el índice de ids**, que era la pregunta de verdad. Con
 * índice, `getAll` sería una sola lectura en vez de `list` más N. Sin índice,
 * hay **una sola fuente de verdad**: la carpeta. Se elige esto último, y el
 * motivo es lo que cuesta la otra opción:
 *
 * - **dos fuentes de verdad que se desincronizan.** Un `put` pasaría a ser dos
 *   escrituras —la entidad y el manifiesto— sin forma de hacerlas atómicas
 *   (decisión 2). Morir en medio deja o un id fantasma en el índice, apuntando a
 *   un fichero que no existe, o una nota guardada que el índice no menciona y
 *   que por tanto **no se abriría nunca**. Lo segundo es perder una nota que
 *   está ahí, en disco, intacta;
 * - **los tres repositorios se pisarían**, que es el problema que §6.1 da como
 *   motivo de que `Repository` no hable directamente con `BlobStore`: tres
 *   escritores sobre un mismo fichero;
 * - **el `list` del puerto existe precisamente para esto.** `BlobStore.list` se
 *   declaró con el comentario «es lo que hace posible `getAll`». Con índice no
 *   tendría consumidor.
 *
 * **Precio aceptado, dicho sin esconderlo:** `getAll` hace N lecturas, y en la
 * File System Access API cada una es abrir un fichero. Se paga una vez al
 * arrancar —quien llama a `getAll` es `hydrate`— y con cientos de notas es
 * irrelevante. Si algún día deja de serlo, la respuesta es una caché, no una
 * segunda fuente de verdad.
 */
interface Manifest {
  readonly schemaVersion: number
}

/**
 * id → camino. La traducción que este fichero existe para concentrar.
 *
 * El id va por `encodeURIComponent` aunque hoy no haga falta: los ids los
 * fabricará un `IdGenerator` en la Fase 4 y no traerán barras. Es una línea, y
 * lo que impide es que un id con `/` o `..` dentro escriba **fuera de su
 * carpeta**. No hace falta descodificar nunca: el id de vuelta sale de dentro
 * del JSON, no del nombre del fichero.
 *
 * ── ⚠️ Por qué devuelve `Result` y no una cadena ───────────────────────────
 *
 * **Porque `encodeURIComponent` LANZA.** Con un surrogate suelto dentro del id
 * —`"nota-\uD800"`— tira un `URIError: URI malformed`. Y esto no es teórico: un
 * id llega desde el disco, donde lo único que se comprueba de él es que sea una
 * cadena (ver `entidadDe`; validar el esquema es otra tarea). Un `notes/x.json`
 * tocado a mano o escrito a medias mete ese id en `AppState`.
 *
 * Devolviéndolo pelado, los tres métodos que lo usan —`get`, `put` y `delete`—
 * **lanzaban por una firma que promete `Result`**, que es justo lo que §6.5
 * prohíbe. Estaba tapado por accidente: el único consumidor de producción es el
 * write-behind, que llama desde dentro de `transaction`, y su `try` lo traducía
 * a `io`. En cuanto `platform/` (Fase 4) llame a `adapter.notes.get(id)`
 * directamente, el accidente se acaba.
 *
 * **Con `Result` deja de depender de quién llame:** el tipo obliga a tratarlo en
 * los tres sitios, y no hay forma de usarlo mal sin que el compilador proteste.
 *
 * Sale `corrupt` y no `io` por el criterio de §6.5 —*¿reintentar sirve de
 * algo?*—: el id va a seguir siendo inválido la próxima vez. Y `corrupt` es
 * además el único `kind` que lleva `path`, o sea el único que puede **decir
 * cuál** es la entidad que no se puede nombrar.
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
 * Se indenta con dos espacios y se cierra con salto de línea porque §6.2 elige
 * un fichero por entidad **para tener diffs pequeños**, y un JSON en una sola
 * línea no los da: cambiar una palabra reescribiría la línea entera.
 *
 * El `catch` cubre un caso que los tipos ya impiden —`JSON.stringify` sólo lanza
 * con ciclos o `BigInt`, y una entidad del dominio no tiene ni lo uno ni lo
 * otro—, y aun así está: el puerto promete que **nada lanza**, y una promesa que
 * se sostiene en un razonamiento es más débil que una que se sostiene en el
 * código. Sale como `io` y no como `corrupt`: en disco no hay nada corrupto
 * todavía, esto es un bug nuestro, y §6.5 ya acepta que un bug acabe en `io`.
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
 * negocio porque es quien parsea. El `path` viaja dentro del error porque lo que
 * §6.5 pide de `corrupt` es poder **decir cuál** es el fichero que no se
 * entiende; un `corrupt` sin camino no serviría para nada de eso.
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
       `cause`: es para depurar, no para enseñar (§6.5). */
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
   * ⚠️ **DECISIÓN 3, confirmada: un fichero corrupto tumba el `getAll`
   * entero — y se confirma SABIENDO que contradice a §6.5.**
   *
   * La firma del puerto es `Result<ReadonlyArray<T>, StorageError>`, o sea
   * **todo o nada**: no hay dónde poner «estas nueve notas, y esta décima está
   * rota». Así que al primer `corrupt` se corta y sale el error con el `path`
   * del culpable.
   *
   * La contradicción no se suaviza, se dice con todas las letras, porque una
   * contradicción sin explicar se lee como un olvido: **§6.5 exige «aislar esa
   * entidad y seguir con el resto, diciendo cuál»** —es la razón entera de que
   * `corrupt` no esté metido dentro de `io`— y esto no lo hace. **Hoy una sola
   * nota ilegible impide abrir la app**, que es justo el «creer que las has
   * perdido todas» que esa decisión quería evitar.
   *
   * Se acepta igualmente, porque las otras dos salidas son peores:
   *
   * - **saltarse el fichero corrupto en silencio** devolvería nueve notas como
   *   si fueran todas. Un `Context` que listara la décima se quedaría con una
   *   `ItemRef` apuntando a nada, y eso **rompe la integridad referencial**, que
   *   no es negociable. Peor todavía: el write-behind vería la nota como
   *   borrada y acabaría limpiándola de los contextos, convirtiendo un fichero
   *   recuperable en una pérdida de verdad;
   * - **cambiar la firma del puerto** es justo lo que el paso 0 acaba de
   *   estabilizar, y no se toca por iniciativa propia.
   *
   * **El arreglo bueno está decidido y aplazado a la Fase 4: un `onCorrupt` en
   * las dependencias DE ESTE ADAPTADOR** —saltar la entidad y avisar de cuál—,
   * que no toca el puerto. Va en el mismo paquete que el `onError` que el
   * write-behind tiene aplazado por el mismo motivo: hoy no hay a quién avisar,
   * y aquí no se construye lo que no tiene consumidor. Está anotado en
   * `TAREAS.md`, al lado del `onError`.
   *
   * La prueba que fija este comportamiento está marcada con ⚠️ en
   * `FileStorageAdapter.errors.test.ts`, y la marca se queda: existe para que el
   * día que esto cambie **se vea en el diff**.
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
     * **DECISIÓN 2, confirmada: qué significa `transaction` aquí.**
     *
     * El puerto la declara *best-effort* y avisa de que un adaptador sobre
     * ficheros sueltos «no puede» cumplirla de verdad. Esto es exactamente eso:
     * **ejecuta la función y devuelve lo que ella devuelva**. Ni agrupa, ni
     * difiere las escrituras, ni deshace nada.
     *
     * Lo que SÍ garantiza, que es lo que hay que poder decir de ella:
     *
     * - **las escrituras salen en el orden en que las pidió `fn`.** No se
     *   reordenan ni se agrupan, y eso no es una perogrullada: es de lo que
     *   depende el write-behind, que hace **primero todos los `put` y después
     *   todos los `delete`** para que el peor caso sea una nota de más —basura
     *   inofensiva— y nunca una `ItemRef` apuntando a algo que ya no existe. Si
     *   este adaptador se pusiera a bufferizar y volcar en otro orden, esa
     *   garantía se perdería aquí sin que nadie lo notara;
     * - **el `err` de `fn` corta y sale sin reempaquetar**, con su `kind` de
     *   origen intacto;
     * - **una excepción de `fn` no escapa**: se traduce a `io`. `fn` es código
     *   ajeno y puede lanzar aunque el puerto diga que no; lo que no puede es
     *   romper la firma, que promete un `Result` y no un rechazo. Ésta es la
     *   tercera y última frontera con `try/catch` del fichero.
     *
     * Lo que NO garantiza, y quien la use no debe suponer:
     *
     * - **atomicidad.** Si el proceso muere a mitad, unas escrituras están y
     *   otras no. No hay rollback y no puede haberlo: lo ya escrito está en
     *   disco;
     * - **aislamiento.** No hay exclusión mutua: dos `transaction` concurrentes
     *   intercalarían sus escrituras. Hoy no hay dos llamantes a la vez —el
     *   write-behind encadena las suyas en una cola propia— y añadir un cerrojo
     *   sería construir para un consumidor que no existe, con el regalo de un
     *   interbloqueo si alguien anidara dos transacciones;
     * - **lecturas consistentes.** Un `get` desde dentro de `fn` ve el disco tal
     *   y como esté en ese momento, incluido lo que la propia `fn` lleve escrito.
     *
     * Y el `async` de la firma no es decorativo: sin él, un `fn` que lance de
     * forma **síncrona** rompería antes de que existiera promesa alguna, y no
     * habría `catch` que llegara a tiempo.
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
