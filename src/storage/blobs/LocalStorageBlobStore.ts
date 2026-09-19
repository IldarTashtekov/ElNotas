/**
 * Guarda los ficheros dentro del navegador, en `localStorage`.
 *
 * Es el de desarrollo y el de emergencia: sirve para arrancar la app sin pedirte
 * una carpeta, y para los navegadores que no saben abrir carpetas.
 *
 * ⚠️ No es el almacén de verdad. Da unos 5 MB, bloquea la pantalla mientras
 * escribe, y el navegador lo borra cuando limpia los datos del sitio.
 */

import type { BlobStore, Result, StorageError } from "#core/index"
import { err, ok } from "#core/index"

/* ═══════════════════════════ El espacio de nombres ═════════════════════════ */

/**
 * Delante de cada clave. Los dos puntos no tienen nada de especial para
 * `localStorage` —es convención de la web— pero hacen legible el almacén cuando
 * uno lo abre en las herramientas del navegador, que es justo cuando se usa esta
 * implementación.
 */
const ESPACIO_DE_NOMBRES: string = "elnotas:blob:"

const claveDe = (camino: string): string => `${ESPACIO_DE_NOMBRES}${camino}`

/* ══════════════════════════════ bytes ⇄ base64 ═════════════════════════════ */

/**
 * Cuántos bytes se pasan de golpe a `String.fromCharCode`. No es un ajuste fino:
 * es que esparcir un array entero en los argumentos de una llamada **revienta la
 * pila** a partir de unas decenas de miles de elementos, y con una imagen pegada
 * en una nota se llega enseguida. 32 KiB es el tamaño que todo el mundo usa para
 * esto y está muy por debajo del límite de cualquier motor.
 */
const TROZO: number = 0x8000

const aBase64 = (bytes: Uint8Array): string => {
  /* Acumulador local, como el `entidades` de `FileStorageAdapter`: lo que la
     regla de inmutabilidad prohíbe es mutar datos del dominio, no construir un
     valor por partes y devolverlo de una pieza. */
  let latin1: string = ""

  for (let i: number = 0; i < bytes.length; i += TROZO) {
    latin1 += String.fromCharCode(...bytes.subarray(i, i + TROZO))
  }

  return btoa(latin1)
}

const deBase64 = (texto: string): Uint8Array => {
  const latin1: string = atob(texto)
  const bytes: Uint8Array = new Uint8Array(latin1.length)

  for (let i: number = 0; i < latin1.length; i += 1) {
    bytes[i] = latin1.charCodeAt(i)
  }

  return bytes
}

/* ════════════════════ La traducción de las excepciones ═════════════════════ */

/*
    Los tres nombres de la cuota, y son tres porque cada navegador eligió el
    suyo antes de que hubiera estándar:

        QuotaExceededError           el del estándar, y lo que lanza Chromium
        NS_ERROR_DOM_QUOTA_REACHED   Firefox
        QUOTA_EXCEEDED_ERR           Safari viejo y el nombre heredado

    Se mira además el `code` numérico —22 en el estándar, 1014 en Firefox—
    porque es lo único que sobrevive en los navegadores antiguos donde el `name`
    venía vacío. Comprobar las dos cosas cuesta una línea y es justo la clase de
    detalle que, si se falla, convierte un «deja de escribir, no cabe» en un
    «reintenta» infinito.
*/

const NOMBRES_DE_CUOTA: ReadonlySet<string> = new Set([
  "QuotaExceededError",
  "NS_ERROR_DOM_QUOTA_REACHED",
  "QUOTA_EXCEEDED_ERR",
])

const CODIGOS_DE_CUOTA: ReadonlySet<number> = new Set([22, 1014])

/** El `name` de lo que venga por el `catch`, si es que trae uno. */
const nombreDe = (fallo: unknown): string | null => {
  if (typeof fallo !== "object" || fallo === null) return null
  if (!("name" in fallo) || typeof fallo.name !== "string") return null
  return fallo.name
}

/** El `code` heredado de `DOMException`, si lo trae. */
const codigoDe = (fallo: unknown): number | null => {
  if (typeof fallo !== "object" || fallo === null) return null
  if (!("code" in fallo) || typeof fallo.code !== "number") return null
  return fallo.code
}

/**
 * Excepción de `localStorage` → `StorageError`. **El criterio es siempre el
 * mismo: ¿reintentar sirve de algo?**, no qué mensaje sale en pantalla.
 *
 * - **cuota** → `quota-exceeded`. Reintentar no sirve: el almacén está lleno y
 *   seguirá lleno. Es además el caso que **detiene el write-behind**, que es
 *   exactamente lo que se quiere: insistir aquí es escribir en bucle contra una
 *   pared;
 * - **`SecurityError`** → `permission-denied`. Es lo que lanza el navegador
 *   cuando el almacenamiento del sitio está bloqueado: modo privado de algunos
 *   navegadores, cookies de terceros denegadas, un `iframe` sin permiso. Ni
 *   siquiera `getItem` funciona. Reintentar no sirve —hace falta que el usuario
 *   cambie un ajuste—, y eso es la definición de este caso;
 * - **cualquier otra cosa** → `io`, que es el cajón de «no sé clasificarlo, y
 *   reintentar puede servir». Que sea un cajón no lo convierte en un descuido:
 *   es la única de las cinco que dice «vuelve a intentarlo», y meter ahí algo
 *   que no se arregla reintentando es el error que la taxonomía existe para
 *   evitar, no al revés.
 */
const dePlataforma = (fallo: unknown): StorageError => {
  const nombre: string | null = nombreDe(fallo)
  const codigo: number | null = codigoDe(fallo)

  if (
    (nombre !== null && NOMBRES_DE_CUOTA.has(nombre)) ||
    (codigo !== null && CODIGOS_DE_CUOTA.has(codigo))
  ) {
    const lleno: StorageError = { kind: "quota-exceeded" }
    return lleno
  }

  if (nombre === "SecurityError") {
    const bloqueado: StorageError = { kind: "permission-denied" }
    return bloqueado
  }

  const otro: StorageError = { kind: "io", cause: fallo }
  return otro
}

/**
 * **LA FRONTERA. El único `try/catch` del fichero**, y por encima de esta línea
 * ninguna firma lanza.
 *
 * Recibe el traductor por parámetro porque hay dos clases de fallo aquí dentro y
 * no se clasifican igual: lo que venga de `localStorage` lo traduce
 * `dePlataforma`, y lo que venga de descodificar base64 es otra cosa —ver
 * `read`—. Un traductor fijo obligaría a un segundo `try`, que es justo lo que
 * esta función existe para que no haga falta.
 */
const frontera = <T>(
  fn: () => T,
  aError: (fallo: unknown) => StorageError,
): Result<T, StorageError> => {
  try {
    return ok(fn())
  } catch (fallo: unknown) {
    return err(aError(fallo))
  }
}

/* ═══════════════════════════════ El almacén ════════════════════════════════ */

/**
 * El `Storage` llega **por constructor**, no se coge de `globalThis`, y es la
 * misma decisión que en `DirectoryHandleBlobStore`: quién es el almacén de verdad
 * lo elige `platform/` en la Fase 4, y aquí eso sería plataforma cableada. De
 * paso es lo que permite probarlo entero en Node con un objeto falso de diez
 * líneas, sin navegador.
 *
 * Todos los métodos son `async` aunque `localStorage` sea sincrónico: lo pide el
 * puerto, porque si un adaptador expone firmas sincrónicas, el primero que sea de
 * verdad asíncrono obliga a reescribir a todos los que llaman.
 */
export const createLocalStorageBlobStore = (almacen: Storage): BlobStore => ({
  /**
   * Ausencia no es fallo: si esa clave no está, sale `ok(null)` y no
   * `not-found`. El `null` de `getItem` significa exactamente eso.
   *
   * La única decisión delicada del fichero es el segundo paso: **un base64
   * ilegible sale como `corrupt`**. Si dentro hay una `Note` bien formada no es
   * cosa suya —eso lo mira quien parsea—, pero el **sobre** base64 sí lo escribió
   * él, y si no se puede abrir, lo guardado ya no son los bytes que guardó.
   * Además `atob` de la misma cadena va a fallar igual la vez siguiente, así que
   * `io` —que significa «reintenta»— sería mentira.
   */
  read: async (camino: string): Promise<Result<Uint8Array | null, StorageError>> => {
    const guardado: Result<string | null, StorageError> = frontera(
      (): string | null => almacen.getItem(claveDe(camino)),
      dePlataforma,
    )
    if (!guardado.ok) return guardado

    const texto: string | null = guardado.value
    if (texto === null) return ok(null)

    return frontera(
      (): Uint8Array => deBase64(texto),
      (fallo: unknown): StorageError => {
        const ilegible: StorageError = { kind: "corrupt", path: camino, cause: fallo }
        return ilegible
      },
    )
  },

  /**
   * `setItem` reemplaza, que es lo que el puerto pide («escribe o reemplaza»), y
   * no hay nada que «crear por el camino»: sin carpetas, una clave con barras
   * dentro es una clave más.
   */
  write: async (camino: string, data: Uint8Array): Promise<Result<void, StorageError>> =>
    frontera(
      (): void => almacen.setItem(claveDe(camino), aBase64(data)),
      dePlataforma,
    ),

  /** Borrar lo que no está no es un error, y `removeItem` ya se comporta así. */
  delete: async (camino: string): Promise<Result<void, StorageError>> =>
    frontera((): void => almacen.removeItem(claveDe(camino)), dePlataforma),

  /**
   * Sin carpetas, «los caminos que empiezan por ese prefijo» es literalmente
   * recorrer las claves. Se recorre por índice con `key(i)` y no con
   * `Object.keys`, porque el segundo sólo funciona por el acceso por propiedad
   * que `Storage` ofrece de regalo y que no todos los entornos implementan.
   *
   * Las claves salen **sin el espacio de nombres**: fuera de este fichero los
   * caminos son los mismos que vería cualquier otro `BlobStore`, y quien llama
   * pasa lo devuelto directo a `read`.
   */
  list: async (prefijo: string): Promise<Result<ReadonlyArray<string>, StorageError>> =>
    frontera((): ReadonlyArray<string> => {
      const completo: string = claveDe(prefijo)
      const encontrados: string[] = []

      for (let i: number = 0; i < almacen.length; i += 1) {
        /* `key` devuelve `string | null` —`null` si el índice se sale—, y con
           `noUncheckedIndexedAccess` eso hay que tratarlo. Puede pasar de
           verdad: otra pestaña del mismo origen puede borrar una clave entre
           dos vueltas de este bucle. */
        const clave: string | null = almacen.key(i)
        if (clave === null) continue
        if (!clave.startsWith(completo)) continue

        encontrados.push(clave.slice(ESPACIO_DE_NOMBRES.length))
      }

      return encontrados
    }, dePlataforma),
})
