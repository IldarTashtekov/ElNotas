/**
 * `BlobStore` sobre `localStorage`: **el de desarrollo y el de emergencia**
 * (`ARCHITECTURE.md` §6.1, primera fila de la tabla de los cuatro backends).
 *
 * Sirve para dos cosas, y conviene no confundirlas con una tercera que no es:
 *
 *     desarrollo   arrancar la app sin pedirle una carpeta al usuario
 *     fallback     un navegador sin File System Access API ni OPFS
 *
 * Lo que **no** es: el almacén de verdad. `localStorage` da unos 5 MB por origen,
 * es sincrónico —bloquea el hilo de la interfaz— y el navegador lo borra cuando
 * limpia datos del sitio. El primario es el fichero local (§6.2).
 *
 * ── Aquí SÍ hay trabajo, al contrario que en `DirectoryHandleBlobStore` ────
 *
 * `localStorage` no es un sistema de ficheros: es **un mapa de texto a texto**.
 * Así que hay tres traducciones que hacer, y son las tres cosas que este fichero
 * tiene de propio —y la razón de que sí se pruebe en Node con un `Storage` de
 * mentira (§6.3):
 *
 *     camino → clave    con un espacio de nombres delante, ver abajo
 *     bytes → texto     en base64, ver abajo
 *     list(prefijo)     recorriendo las claves, porque no hay carpetas
 *
 * ── 1. El espacio de nombres: `localStorage` es un sitio COMPARTIDO ───────
 *
 * Todas las claves del origen viven en el mismo saco: las de esta app, las de
 * cualquier script de terceros y las de cualquier prototipo que alguien dejara
 * ahí. Sin prefijo propio pasarían dos cosas, y las dos son silenciosas:
 *
 * - **`list("")` devolvería claves ajenas** como si fueran caminos nuestros, y
 *   `FileStorageAdapter.getAll` intentaría parsearlas. Hoy le salvaría el filtro
 *   por carpeta y extensión, pero eso es que nos salva otro fichero, no éste;
 * - **un `write` podría pisar la clave de otro**, que es peor porque rompe algo
 *   que no es nuestro.
 *
 * De ahí `ESPACIO_DE_NOMBRES`. Es un detalle **privado**: fuera de este fichero
 * los caminos son los mismos que ve cualquier otro `BlobStore`, sin prefijo. Y
 * no se hace configurable por constructor porque no tiene consumidor — la misma
 * regla que dejó fuera `move` y el puerto `Scheduler`.
 *
 * ── 2. base64, y lo que cuesta ────────────────────────────────────────────
 *
 * El puerto mueve `Uint8Array` (y el porqué está en `BlobStore.ts`: el día que
 * haya una imagen pegada en una nota, un almacén de cadenas no sirve).
 * `localStorage` sólo guarda texto, así que hay que codificar.
 *
 * Se elige **base64**, con los `btoa`/`atob` que el navegador ya trae —y Node
 * también, así que las pruebas corren sin nada instalado—. La alternativa era
 * guardar una «cadena binaria» latin1, un carácter por byte: ocupa un 33% menos,
 * pero deja en el almacén texto que parece texto y no lo es, y cualquier
 * herramienta que mire ahí —las de desarrollo del navegador, una exportación
 * futura— lo estropearía sin avisar. **Precio aceptado: +33% de tamaño sobre una
 * cuota que ya es pequeña.** Para el uso que tiene esta implementación —desarrollo
 * y emergencia— es el cambio correcto.
 *
 * ── 3. La traducción de errores, que es el trabajo de verdad ──────────────
 *
 * Es lo que este nivel existe para hacer (§6.1): **cada `BlobStore` traduce las
 * excepciones de SU plataforma**, y las de `localStorage` son tres:
 *
 *     cuota llena          → quota-exceeded   deja de intentarlo y avisa
 *     almacén bloqueado    → permission-denied  el navegador no deja ni mirar
 *     cualquier otra cosa  → io               reintentar puede servir
 *
 * Lo que **no** produce nunca es `not-found` —no hay carpeta que pueda
 * desaparecer: o hay `localStorage` o no lo hay— y `corrupt` sólo en un caso muy
 * concreto, el de `read`, razonado ahí abajo.
 *
 * ── La frontera, que es UNA ───────────────────────────────────────────────
 *
 * En todo el fichero hay **un solo `try/catch`**, el de `frontera`, y por encima
 * de él ninguna firma lanza (§6.5). Sale tan limpio porque `localStorage` es
 * sincrónico: no hay promesas que encadenar, sólo una llamada que envolver.
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
const ESPACIO_DE_NOMBRES = "elnotas:blob:"

const claveDe = (camino: string): string => `${ESPACIO_DE_NOMBRES}${camino}`

/* ══════════════════════════════ bytes ⇄ base64 ═════════════════════════════ */

/**
 * Cuántos bytes se pasan de golpe a `String.fromCharCode`. No es un ajuste fino:
 * es que esparcir un array entero en los argumentos de una llamada **revienta la
 * pila** a partir de unas decenas de miles de elementos, y con una imagen pegada
 * en una nota se llega enseguida. 32 KiB es el tamaño que todo el mundo usa para
 * esto y está muy por debajo del límite de cualquier motor.
 */
const TROZO = 0x8000

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
 * Excepción de `localStorage` → `StorageError`. **El criterio es el de §6.5:
 * ¿reintentar sirve de algo?**, no qué mensaje sale en pantalla.
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
 * ninguna firma lanza (§6.5).
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
  } catch (fallo) {
    return err(aError(fallo))
  }
}

/* ═══════════════════════════════ El almacén ════════════════════════════════ */

/**
 * El `Storage` llega **por constructor**, no se coge de `globalThis`, y es la
 * misma decisión que en `DirectoryHandleBlobStore`: quién es el almacén de
 * verdad lo elige `platform/` en la Fase 4 (§4), y aquí eso sería plataforma
 * cableada. De paso es lo que permite probarlo entero en Node con un objeto
 * falso de diez líneas, sin navegador (§6.3).
 *
 * Todos los métodos son `async` aunque `localStorage` sea sincrónico: lo pide el
 * puerto (§6.1), y por un motivo que ya está escrito —si un adaptador expone
 * firmas sincrónicas, el primero que sea de verdad asíncrono obliga a reescribir
 * a todos los que llaman.
 */
export const createLocalStorageBlobStore = (almacen: Storage): BlobStore => ({
  /**
   * Ausencia no es fallo: si esa clave no está, sale `ok(null)` y no
   * `not-found` (§6.5). El `null` de `getItem` significa exactamente eso.
   *
   * El segundo paso —descodificar— tiene su propia clasificación, y es la única
   * decisión delicada del fichero: **un base64 ilegible sale como `corrupt`**.
   *
   * Es la frontera que la cabecera de `BlobStore.ts` precisa: el **contenido**
   * no es cosa de un `BlobStore` —si dentro hay una `Note` bien formada lo mira
   * `FileStorageAdapter`, que es quien parsea—, pero el **sobre** base64 **sí**
   * es suyo: lo escribió él. Si no se puede abrir, lo que hay guardado ahí
   * ya no son los bytes que se guardaron —alguien los tocó a mano, otro programa
   * pisó la clave, el navegador truncó el valor—, y eso es literalmente estar
   * corrupto.
   *
   * El criterio de la taxonomía lo confirma: `atob` de la misma cadena va a
   * fallar igual la vez siguiente, así que `io` —que significa «reintenta»—
   * sería mentira, y además dejaría a la app dando vueltas sobre una clave rota.
   * `corrupt` dice «aparta ésta y sigue con el resto», que es lo que hay que
   * hacer, y es el único caso de la taxonomía que lleva `path` para poder decir
   * cuál.
   */
  read: async (camino) => {
    const guardado: Result<string | null, StorageError> = frontera(
      () => almacen.getItem(claveDe(camino)),
      dePlataforma,
    )
    if (!guardado.ok) return guardado

    const texto: string | null = guardado.value
    if (texto === null) return ok(null)

    return frontera(() => deBase64(texto), (fallo) => {
      const ilegible: StorageError = { kind: "corrupt", path: camino, cause: fallo }
      return ilegible
    })
  },

  /**
   * `setItem` reemplaza, que es lo que el puerto pide («escribe o reemplaza»), y
   * no hay nada que «crear por el camino»: sin carpetas, una clave con barras
   * dentro es una clave más.
   */
  write: async (camino, data) =>
    frontera(() => almacen.setItem(claveDe(camino), aBase64(data)), dePlataforma),

  /** Borrar lo que no está no es un error, y `removeItem` ya se comporta así. */
  delete: async (camino) => frontera(() => almacen.removeItem(claveDe(camino)), dePlataforma),

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
  list: async (prefijo) =>
    frontera(() => {
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
