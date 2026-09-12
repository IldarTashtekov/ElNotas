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
 * ⚠️ **Este puerto no tiene consumidor hasta la Fase 3**, que es cuando llega
 * el `FileStorageAdapter`. Se declara ya porque es lo que fija el reparto en dos
 * niveles, y porque son cuatro líneas — el mismo trato que tuvieron `Clock` e
 * `IdGenerator`, declarados una fase antes de que nadie los implementara.
 */
export interface BlobStore {
  /** Los bytes, o `null` si no existe ese camino. */
  readonly read: (path: string) => Promise<Uint8Array | null>
  /** Escribe o reemplaza. Crea lo que haga falta por el camino. */
  readonly write: (path: string, data: Uint8Array) => Promise<void>
  /** Borra. Borrar lo que no existe **no es un error**. */
  readonly delete: (path: string) => Promise<void>
  /** Los caminos que empiezan por ese prefijo. Es lo que hace posible `getAll`. */
  readonly list: (prefix: string) => Promise<ReadonlyArray<string>>
}
