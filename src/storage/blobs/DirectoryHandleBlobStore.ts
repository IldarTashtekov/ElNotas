/**
 * `BlobStore` sobre un `FileSystemDirectoryHandle`: **la carpeta de verdad del
 * usuario** (`ARCHITECTURE.md` §6.1, filas 2 y 3 de la tabla de backends).
 *
 * Es el almacén primario de la app (§6.2): ficheros JSON de verdad, en una
 * carpeta que el usuario elige y puede abrir con cualquier otro programa.
 *
 * **Las filas 2 y 3 son este mismo fichero, sin una línea de diferencia.** La
 * File System Access API y OPFS exponen el mismo `FileSystemDirectoryHandle`, y
 * lo único que cambia es **cómo se consigue el handle**:
 *
 *     showDirectoryPicker()              la carpeta que elige el usuario
 *     navigator.storage.getDirectory()   OPFS, sin diálogo ni permisos
 *
 * Y conseguir el handle **no es cosa de este fichero**: le llega por
 * constructor. Eso es composición, y la composición vive en `platform/`, que no
 * nace hasta la Fase 4 (§9.7). Aquí eso importa más que de costumbre, porque es
 * lo que deja este fichero reducido a traducir llamadas — que es justo lo que
 * permite no probarlo.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 *  ⚠️ ESTE FICHERO NO TIENE PRUEBAS, Y ES UNA DECISIÓN (§6.3)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * No es un descuido ni una tarea pendiente. `node:test` no llega a un navegador,
 * y **un doble aquí no compra lo que parece**: probaría lo que quien lo escribe
 * *cree* que hace la API, no lo que hace. El ejemplo es el de abajo y está
 * elegido porque es real: escribir exige un `close()` final que es **lo que
 * vuelca los datos al disco**, y un `BlobStore` de mentira sobre un `Map` pasa
 * en verde con ese `close()` olvidado. Cuanto más fina es la capa de traducción,
 * menos vale probarla con un doble.
 *
 * Lo que sí hay es **una lista de verificación manual**, en
 * `VERIFICACION-MANUAL.md`, aquí al lado. Es la red de seguridad de este
 * fichero: si se toca algo de aquí, se vuelve a pasar la lista y se anota el
 * resultado. **No hay otra.**
 *
 * Por eso este fichero se mantiene deliberadamente tonto: cada línea de lógica
 * que se le añada es una línea que nadie comprueba. Lo que tenga lógica va
 * arriba, en `FileStorageAdapter`, que sí pasa la suite de contratos entera.
 *
 * ── La traducción de errores, que es lo único que hace ────────────────────
 *
 * Es su trabajo, y el reparto está escrito en `BlobStore.ts`: **cada
 * implementación traduce las excepciones de SU plataforma**. Las de ésta:
 *
 *     NotAllowedError     → permission-denied  el permiso ya no vale
 *     SecurityError       → permission-denied  el contexto no permite ni pedirlo
 *     NotFoundError       → not-found          la carpeta o el fichero ya no están
 *     QuotaExceededError  → quota-exceeded     no cabe
 *     cualquier otra cosa → io                 y es una decisión, ver `clasificar`
 *
 * Lo que **no** produce nunca es `corrupt`: este fichero no mira lo que hay
 * dentro de los bytes. Eso es de `FileStorageAdapter`, que es quien parsea.
 *
 * ── Ausencia no es fallo, y aquí cuesta una vuelta más ────────────────────
 *
 * `read` de un fichero que no está es `ok(null)`, no `err(not-found)` (§6.5).
 * Pero la API no distingue: lanza `NotFoundError` tanto si falta el fichero como
 * si falta la carpeta que lo contiene. Así que `read` y `delete` traducen ese
 * `not-found` a ausencia, y `list` a lista vacía. El precio está dicho en voz
 * alta en cada uno de los tres.
 */

import type { BlobStore, Result, StorageError } from "#core/index"
import { err, ok } from "#core/index"

/* ═════════════════════════ Los tipos que hay que declarar ══════════════════ */

/**
 * **Lo único de la File System Access API que no viene en los tipos de
 * TypeScript**, y por eso se declara a mano en vez de instalar un paquete.
 *
 * `lib.dom.d.ts` trae `FileSystemDirectoryHandle` entero —`getFileHandle`,
 * `getDirectoryHandle`, `removeEntry`— pero **el recorrido de entradas vive en
 * `lib.dom.asynciterable.d.ts`**, que es una `lib` aparte que este proyecto no
 * activa. Se declara aquí lo mínimo que se usa —`values()` y nada más— porque
 * la alternativa era instalar tipos para tres líneas o tocar un `tsconfig`, y
 * ninguna de las dos vale lo que cuesta.
 *
 * **No es un puerto ni sale de este fichero.** Si algún día el proyecto activa
 * esa `lib`, esto se borra y no cambia nada más.
 */
interface CarpetaRecorrible {
  readonly values: () => AsyncIterableIterator<
    FileSystemDirectoryHandle | FileSystemFileHandle
  >
}

const entradasDe = (
  carpeta: FileSystemDirectoryHandle,
): AsyncIterableIterator<FileSystemDirectoryHandle | FileSystemFileHandle> =>
  (carpeta as FileSystemDirectoryHandle & CarpetaRecorrible).values()

/* ══════════════════════════ Caminos → nombres ══════════════════════════════ */

interface CaminoPartido {
  /** Las carpetas por las que hay que bajar, en orden. */
  readonly carpetas: ReadonlyArray<string>
  /** El nombre del fichero, que es el último tramo. */
  readonly fichero: string
}

/**
 * Los tramos de un camino, sin los vacíos. Se descartan para que `"notes//a"` o
 * una barra de más no acaben en un `getDirectoryHandle("")`, que lanzaría un
 * `TypeError` de la plataforma por algo que es sólo una barra sobrante.
 */
const tramosDe = (camino: string): ReadonlyArray<string> =>
  camino.split("/").filter((t: string): boolean => t.length > 0)

/** `"notes/abc.json"` → bajar por `notes` y abrir `abc.json`. */
const partir = (camino: string): CaminoPartido => {
  const tramos: ReadonlyArray<string> = tramosDe(camino)
  return {
    carpetas: tramos.slice(0, -1),
    /* El último tramo puede no haber: con `noUncheckedIndexedAccess` hay que
       tratarlo. Un camino sin ningún tramo es un camino inválido, y se deja
       que lo diga la plataforma —un `getFileHandle("")` lanza— en vez de
       inventar aquí un error que ningún otro `BlobStore` produciría. */
    fichero: tramos[tramos.length - 1] ?? "",
  }
}

/* ═══════════════════ La traducción de las excepciones ══════════════════════ */

/**
 * Excepción de la File System Access API → `StorageError`. **El criterio es el
 * de §6.5: ¿reintentar sirve de algo?**
 *
 * Los cuatro que se clasifican, y por qué cae cada uno donde cae:
 *
 * - **`NotAllowedError` → `permission-denied`.** Es *el* error de esta API: se
 *   lanza cuando el permiso sobre la carpeta ya no vale —se recargó la página,
 *   el usuario lo revocó desde el candado, o expiró—. Reintentar es inútil
 *   mientras nadie vuelva a pedirlo, y volver a pedirlo exige un gesto del
 *   usuario dentro de un evento suyo, o sea **plataforma y Fase 4**. Que salga
 *   con este `kind` es además lo que hace que el write-behind **se detenga**
 *   (§6.5) en vez de escribir en bucle contra una puerta cerrada;
 * - **`SecurityError` → `permission-denied`.** Otra puerta cerrada, por otro
 *   motivo: el contexto no permite ni pedir el permiso —un `iframe` sin
 *   `allow`, una página no segura—. La acción de quien lo recibe es la misma,
 *   y ése es el criterio para agrupar dos excepciones en un `kind`: no que se
 *   parezcan, sino que se respondan igual;
 * - **`NotFoundError` → `not-found`.** La carpeta o el fichero ya no están: el
 *   usuario los movió, los borró o desconectó el disco. Reintentar no los trae
 *   de vuelta; hay que ofrecer elegir otra carpeta. ⚠️ **Ojo**, porque es la
 *   parte con trampa: esta misma excepción es la que significa «eso no existe»
 *   en un `read`, y ahí **no** es un fallo. Quien traduce eso a ausencia son
 *   `read`, `delete` y `list`, cada uno en su sitio;
 * - **`QuotaExceededError` → `quota-exceeded`.** No cabe. Pasa sobre todo en
 *   OPFS, que tiene cuota de origen como `localStorage`; en una carpeta de
 *   verdad es el disco lleno. Se mira también el `code` 22 por lo mismo que en
 *   `LocalStorageBlobStore`: hay navegadores que no rellenan el `name`.
 *
 * **Y las que van a `io` a propósito, que es la parte que hay que justificar**,
 * porque `io` significa «reintenta» y decirlo a la ligera es lo único que la
 * taxonomía existe para evitar:
 *
 * - **`NoModificationAllowedError`** — otro escritor tiene el fichero cogido.
 *   Es transitorio de libro: dentro de un segundo puede estar libre. `io` es
 *   exactamente lo correcto;
 * - **`AbortError`** — la operación se canceló. Reintentar puede funcionar;
 * - **`TypeMismatchError`** — hay una carpeta donde se esperaba un fichero, o
 *   al revés. Reintentar **no** sirve, así que `io` no es la etiqueta ideal;
 *   pero no hay ningún `kind` que le quede mejor —no es un permiso, no es una
 *   ausencia, no es la cuota, y `corrupt` es para bytes que no se entienden— y
 *   §6.5 acepta que un caso raro acabe en `io`. Se anota aquí en vez de
 *   esconderlo;
 * - **lo que no conozcamos** — un `TypeError` por un nombre de fichero
 *   inválido, un fallo del disco, algo que la API haga y aquí no se sepa. `io`
 *   es el cajón, y que sea un cajón no lo convierte en un descuido: es la
 *   única de las cinco que dice «vuelve a intentarlo», y lo que no se sabe
 *   clasificar es precisamente lo que puede ser transitorio.
 */
const clasificar = (fallo: unknown, camino: string): StorageError => {
  const nombre: string | null =
    typeof fallo === "object" &&
    fallo !== null &&
    "name" in fallo &&
    typeof fallo.name === "string"
      ? fallo.name
      : null

  const codigo: number | null =
    typeof fallo === "object" &&
    fallo !== null &&
    "code" in fallo &&
    typeof fallo.code === "number"
      ? fallo.code
      : null

  if (nombre === "NotAllowedError" || nombre === "SecurityError") {
    const sinPermiso: StorageError = { kind: "permission-denied" }
    return sinPermiso
  }

  if (nombre === "NotFoundError") {
    const noEsta: StorageError = { kind: "not-found", path: camino }
    return noEsta
  }

  if (nombre === "QuotaExceededError" || codigo === 22) {
    const lleno: StorageError = { kind: "quota-exceeded" }
    return lleno
  }

  const otro: StorageError = { kind: "io", cause: fallo }
  return otro
}

/**
 * **LA FRONTERA. El único `try/catch` del fichero**, y por encima de esta línea
 * ninguna firma lanza (§6.5).
 *
 * Todo lo que toca la plataforma pasa por aquí dentro, incluido el `await`: sin
 * él, una promesa rechazada se escaparía del `try` sin que el `catch` llegara a
 * verla — que es la forma más fácil de romper esta regla sin darse cuenta.
 */
const frontera = async <T>(
  camino: string,
  fn: () => Promise<T>,
): Promise<Result<T, StorageError>> => {
  try {
    return ok(await fn())
  } catch (fallo: unknown) {
    return err(clasificar(fallo, camino))
  }
}

/** Si un `Result` fallido lo hizo por ausencia. Ver la cabecera del fichero. */
const esAusencia = <T>(r: Result<T, StorageError>): boolean =>
  !r.ok && r.error.kind === "not-found"

/* ══════════════════════════ Bajar por las carpetas ═════════════════════════ */

/**
 * De la raíz hasta la carpeta que contiene el fichero.
 *
 * `crear` es `true` sólo al escribir, que es lo que cumple el «crea lo que haga
 * falta por el camino» del puerto. Al leer y al borrar va en `false` a
 * propósito: **leer no debe crear carpetas**, y si se pasara `true` un `read`
 * de algo que no existe dejaría una carpeta vacía en la carpeta del usuario
 * cada vez.
 */
const navegar = async (
  raiz: FileSystemDirectoryHandle,
  carpetas: ReadonlyArray<string>,
  crear: boolean,
): Promise<FileSystemDirectoryHandle> => {
  /* Reasignar una variable local para recorrer no es mutar datos: lo que la
     regla de inmutabilidad protege son las estructuras del dominio. */
  let actual: FileSystemDirectoryHandle = raiz

  for (const nombre of carpetas) {
    actual = await actual.getDirectoryHandle(nombre, { create: crear })
  }

  return actual
}

/**
 * Todos los caminos de fichero que cuelgan de esa carpeta, con `prefijo`
 * delante. Recursivo porque el puerto dice «los caminos que empiezan por ese
 * prefijo» y no «los de este nivel»: hoy el esquema en disco es de un solo
 * nivel (`notes/<id>.json`), pero un `list` que se saltara lo anidado sería un
 * `BlobStore` que cumple el puerto a medias y sólo se notaría el día que el
 * esquema cambie.
 */
const caminosBajo = async (
  carpeta: FileSystemDirectoryHandle,
  prefijo: string,
): Promise<ReadonlyArray<string>> => {
  const encontrados: string[] = []

  for await (const entrada of entradasDe(carpeta)) {
    const camino: string = `${prefijo}${entrada.name}`

    if (entrada.kind === "file") {
      encontrados.push(camino)
    } else {
      /* Uno a uno y no `push(...otros)`: esparcir un array en los argumentos de
         una llamada revienta la pila si el array es grande, y aquí el tamaño lo
         pone la carpeta del usuario. Es el mismo cuidado que el troceado del
         base64 en `LocalStorageBlobStore`, y aquí no hay prueba que lo cace. */
      for (const hijo of await caminosBajo(entrada, `${camino}/`)) {
        encontrados.push(hijo)
      }
    }
  }

  return encontrados
}

/* ═══════════════════════════════ El almacén ════════════════════════════════ */

/**
 * La carpeta llega **por constructor**, ya abierta y con permiso concedido.
 * Quién la pide y cómo —`showDirectoryPicker()`, OPFS, un handle rescatado de
 * IndexedDB entre sesiones— es composición, y vive en `platform/` (Fase 4).
 */
export const createDirectoryHandleBlobStore = (
  raiz: FileSystemDirectoryHandle,
): BlobStore => ({
  /**
   * Ausencia no es fallo: **si no está, `ok(null)`**. Y aquí «no está» incluye
   * que no exista la carpeta intermedia, porque la API lanza el mismo
   * `NotFoundError` en los dos casos y no hay forma de distinguirlos.
   *
   * ⚠️ **El precio, dicho en voz alta:** si la carpeta raíz entera ha
   * desaparecido —el usuario la borró, el disco externo no está—, esto devuelve
   * «no hay nada» en vez de «no la encuentro», y la app arrancaría vacía. No se
   * pierde nada en disco (nadie borra), y el primer `write` sí dirá
   * `not-found`, que es cuando se entera de verdad. Distinguirlo exigiría
   * sondear la raíz antes de cada lectura: una llamada más por lectura, en el
   * fichero que no tiene pruebas, para un caso que la Fase 4 va a tener que
   * tratar de todas formas con el botón de reconectar la carpeta.
   */
  read: async (camino: string): Promise<Result<Uint8Array | null, StorageError>> => {
    const leido: Result<Uint8Array, StorageError> = await frontera(
      camino,
      async (): Promise<Uint8Array> => {
        const { carpetas, fichero } = partir(camino)
        const carpeta: FileSystemDirectoryHandle = await navegar(raiz, carpetas, false)
        const handle: FileSystemFileHandle = await carpeta.getFileHandle(fichero)
        /* `getFile()` también lanza `NotFoundError` si el fichero desapareció
           entre que se obtuvo el handle y ahora: misma respuesta, ausencia. */
        const contenido: File = await handle.getFile()
        return new Uint8Array(await contenido.arrayBuffer())
      },
    )

    return esAusencia(leido) ? ok(null) : leido
  },

  /**
   * ═════════════════════════════════════════════════════════════════════════
   *  ⚠️⚠️ EL `close()` ES LO QUE ESCRIBE EN EL DISCO. NO SE TOCA. ⚠️⚠️
   * ═════════════════════════════════════════════════════════════════════════
   *
   * `createWritable()` **no escribe en el fichero**: abre un fichero temporal
   * aparte. `write()` llena ese temporal. Es `close()` quien lo vuelca sobre el
   * fichero de verdad, de una vez. Sin `close()` no se guarda absolutamente
   * nada, **y ningún test lo detecta** —§6.3 usa justamente este caso como
   * ejemplo de lo que un doble sobre un `Map` deja pasar en verde—. Lo detecta
   * el paso 1 de `VERIFICACION-MANUAL.md`, y nada más.
   *
   * Ese mismo mecanismo del temporal es lo que hace que aquí no haga falta un
   * `abort()` en caso de fallo: si algo revienta antes del `close()`, **el
   * fichero original se queda intacto** y lo único que queda por ahí es un
   * temporal que el navegador recoge. Ahorrarse ese `abort()` ahorra un segundo
   * `try` en el único fichero del proyecto sin pruebas, que es donde menos hay
   * que ponerlos.
   *
   * Y `{ create: true }` en todo el camino es lo que cumple el «crea lo que
   * haga falta» del puerto: la primera nota crea la carpeta `notes/`.
   */
  write: async (camino: string, data: Uint8Array): Promise<Result<void, StorageError>> =>
    frontera(camino, async (): Promise<void> => {
      const { carpetas, fichero } = partir(camino)
      const carpeta: FileSystemDirectoryHandle = await navegar(raiz, carpetas, true)
      const handle: FileSystemFileHandle = await carpeta.getFileHandle(fichero, {
        create: true,
      })

      const flujo: FileSystemWritableFileStream = await handle.createWritable()
      /* La copia no es un adorno del tipado, aunque la pida el compilador: el
         puerto mueve `Uint8Array` sobre cualquier búfer y `write` exige uno
         sobre `ArrayBuffer` (un `SharedArrayBuffer` no vale). De regalo, quien
         llamó no puede tocar sus bytes mientras la escritura está en vuelo. */
      await flujo.write(new Uint8Array(data))
      await flujo.close() // ⚠️ ESTO. Ver arriba.
    }),

  /** Borrar lo que no está no es un error: el `NotFoundError` sale como `ok`. */
  delete: async (camino: string): Promise<Result<void, StorageError>> => {
    const borrado: Result<void, StorageError> = await frontera(
      camino,
      async (): Promise<void> => {
        const { carpetas, fichero } = partir(camino)
        const carpeta: FileSystemDirectoryHandle = await navegar(raiz, carpetas, false)
        await carpeta.removeEntry(fichero)
      },
    )

    return esAusencia(borrado) ? ok(undefined) : borrado
  },

  /**
   * El prefijo se parte por su última barra: lo de delante es la carpeta por la
   * que hay que bajar (`"notes/"` → `notes`) y lo de detrás, si lo hay, filtra
   * por nombre. Después se filtra otra vez por el prefijo entero, que es lo
   * único que el puerto promete.
   *
   * **Una carpeta que no existe es una lista vacía, no un error**, y hace falta
   * que lo sea: al arrancar por primera vez contra una carpeta recién elegida
   * no hay ningún `notes/`, y el `getAll` de `hydrate` tiene que devolver cero
   * notas en vez de impedir abrir la app.
   */
  list: async (
    prefijo: string,
  ): Promise<Result<ReadonlyArray<string>, StorageError>> => {
    const corte: number = prefijo.lastIndexOf("/")
    const base: string = corte === -1 ? "" : prefijo.slice(0, corte + 1)

    const listado: Result<ReadonlyArray<string>, StorageError> = await frontera(
      prefijo,
      async (): Promise<ReadonlyArray<string>> => {
        /* `tramosDe` y no `partir`: aquí el camino es **entero** una ruta de
           carpetas, y `partir` se comería la última tomándola por fichero. */
        const carpeta: FileSystemDirectoryHandle = await navegar(
          raiz,
          tramosDe(base),
          false,
        )
        const todos: ReadonlyArray<string> = await caminosBajo(carpeta, base)
        return todos.filter((c: string): boolean => c.startsWith(prefijo))
      },
    )

    return esAusencia(listado) ? ok([]) : listado
  },
})
