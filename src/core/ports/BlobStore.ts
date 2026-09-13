/**
 * Puerto de bajo nivel: **sólo mueve bytes**. No sabe qué es una Nota.
 *
 * Es la mitad de abajo del reparto en dos niveles de `ARCHITECTURE.md` §6.1, y
 * la razón de que exista es concreta: **un fichero local y uno remoto se
 * diferencian sólo en dónde van los bytes**, no en cómo se serializa una Nota.
 * Si esa distinción no estuviera separada, cada destino nuevo obligaría a
 * reescribir la serialización entera.
 *
 * Separado así, **un único `FileStorageAdapter` parametrizado por `BlobStore`
 * da cuatro backends**: `localStorage` para desarrollo, la carpeta del usuario
 * con la File System Access API, OPFS como recurso para los navegadores que no
 * la tienen, y Drive más adelante. Los dos del medio ni siquiera son
 * implementaciones distintas: la File System Access API y OPFS exponen el mismo
 * `FileSystemDirectoryHandle`, y lo único que cambia es **cómo se consigue el
 * handle**.
 *
 * ── Por qué `Uint8Array` y no `string` ─────────────────────────────────────
 *
 * Hoy todo lo que se guarda es JSON, así que `string` parecería suficiente. Se
 * elige bytes porque es el denominador común de verdad: es lo que aceptan y
 * devuelven las APIs de fichero, y en cuanto haya que guardar algo que no sea
 * texto —una imagen pegada en una nota— un `BlobStore` de cadenas no sirve.
 * Codificar y descodificar es trabajo de quien monta la entidad, no de quien
 * mueve los bytes.
 *
 * ── Todo devuelve `Result`, y cada nivel traduce lo suyo ───────────────────
 *
 * Los cuatro métodos van envueltos en `Result<…, StorageError>` (§6.5), igual
 * que los siete de `Repository` y `StorageAdapter`: **ninguno lanza**. El
 * `try/catch` no desaparece, se confina a **una frontera** por implementación,
 * la que envuelve la llamada de plataforma y la traduce a `err(...)`.
 *
 * Que la traducción se haga **aquí abajo** y no en la capa de encima es la parte
 * que importa, porque el reparto de §6.1 existe precisamente para eso:
 *
 *     BlobStore           traduce los fallos de ENTRADA/SALIDA de SU plataforma
 *                         — permisos, cuota, la carpeta que ya no está.
 *     FileStorageAdapter  traduce lo suyo, que es la SERIALIZACIÓN: un
 *                         `JSON.parse` que falla es `corrupt`, y es su negocio
 *                         porque es quien parsea.
 *
 * Cada implementación conoce las excepciones de su plataforma y de nadie más:
 * `LocalStorageBlobStore` sabe que la excepción de cuota de `localStorage` es
 * `quota-exceeded`, y `DirectoryHandleBlobStore` sabe que la suya de la File
 * System Access API es `permission-denied`. Si esa traducción la hiciera
 * `FileStorageAdapter`, tendría que conocer las formas de excepción de los
 * cuatro backends — que es **exactamente el acoplamiento que este puerto existe
 * para evitar**.
 *
 * Al revés el reparto es el mismo, pero la frontera cae en un sitio muy
 * concreto y conviene precisar dónde, porque **hay un `corrupt` que sí nace
 * aquí abajo**. La distinción es entre el sobre y el contenido:
 *
 *     el sobre      la codificación que el propio `BlobStore` aplicó para poder
 *                   guardar bytes en un almacén que sólo admite texto. Es SUYO,
 *                   lo escribió él, y si no se puede abrir es `corrupt`
 *     el contenido  si dentro hay una `Note` bien formada. NO es suyo: un
 *                   `BlobStore` no sabe qué son esos bytes, así que no puede
 *                   decidir que están corruptos. Eso es de `FileStorageAdapter`,
 *                   que es quien parsea
 *
 * El caso real es `LocalStorageBlobStore`: guarda en base64 porque
 * `localStorage` es un mapa de texto a texto, y si su propio `atob` falla, lo
 * guardado ya no son los bytes que escribió. Ahí `io` sería mentira —`atob`
 * volverá a fallar igual la próxima vez, y `io` significa «reintenta»—, así que
 * sale `corrupt`, con su `path` para poder decir cuál. `DirectoryHandleBlobStore`
 * no tiene sobre que abrir y por eso no produce `corrupt` nunca.
 *
 * Nada de esto cambia el reparto de §6.1: sólo dice **dónde cae la frontera**.
 * Lo de arriba sigue siendo serialización, y sigue sin bajar aquí.
 *
 * ── ⚠️ Ausencia NO es fallo, igual que en `Repository.get` ─────────────────
 *
 * El `null` de `read` se queda **dentro** del `ok`, no se convierte en
 * `not-found`. Son dos respuestas distintas y hace falta distinguirlas:
 *
 *     ok(null)                             ese camino no existe
 *     err({ kind: "permission-denied" })   no he podido ni mirar
 *
 * `not-found` queda para "la carpeta entera ha desaparecido", que es otra cosa.
 * Y borrar lo que no existe sigue devolviendo `ok`: no hay nada que hacer.
 *
 * Se declaró una fase antes de que nadie lo implementara —el mismo trato que
 * tuvieron `Clock` e `IdGenerator`— porque es lo que fija el reparto en dos
 * niveles y porque son cuatro líneas. Ya tiene consumidores: `FileStorageAdapter`
 * lo recibe por constructor, y lo implementan `LocalStorageBlobStore` y
 * `DirectoryHandleBlobStore`.
 */

import type { Result } from "../domain/Result"
import type { StorageError } from "../domain/errors/StorageError"

export interface BlobStore {
  /** Los bytes, o `null` si no existe ese camino — que **no** es un fallo. */
  readonly read: (path: string) => Promise<Result<Uint8Array | null, StorageError>>
  /** Escribe o reemplaza. Crea lo que haga falta por el camino. */
  readonly write: (path: string, data: Uint8Array) => Promise<Result<void, StorageError>>
  /** Borra. Borrar lo que no existe **no es un error**. */
  readonly delete: (path: string) => Promise<Result<void, StorageError>>
  /** Los caminos que empiezan por ese prefijo. Es lo que hace posible `getAll`. */
  readonly list: (prefix: string) => Promise<Result<ReadonlyArray<string>, StorageError>>
}
