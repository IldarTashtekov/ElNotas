/**
 * API pública del módulo de persistencia.
 *
 * Lo que hay aquí dentro son **implementaciones** de puertos que declara el core
 * (`Repository`, `StorageAdapter` y `BlobStore`). La dependencia
 * va, como siempre, de fuera hacia dentro: `storage/` conoce al core; el core no
 * sabe que esto existe.
 *
 * Quien decide cuál de los adaptadores se usa de verdad no es este módulo: es
 * `platform/`, que no nace hasta la Fase 4 (`ARCHITECTURE.md` §4).
 *
 * La suite de contratos NO sale por aquí: es código de pruebas, y quien la
 * consume son otros ficheros de prueba del propio módulo, con import relativo.
 */

export { createMemoryStorageAdapter } from "./memory/MemoryStorageAdapter"

/* El de ficheros JSON, parametrizado por un `BlobStore` que le llega por
   constructor. Quién es ese `BlobStore` —localStorage, la carpeta del usuario,
   OPFS— lo decide `platform/` en la Fase 4; el falso de las pruebas no sale por
   esta puerta. */
export { createFileStorageAdapter } from "./file/FileStorageAdapter"

/* Las implementaciones de `BlobStore`, en `blobs/`: son lo de abajo del reparto
   en dos niveles (§6.1) y las dos se enchufan al adaptador de arriba.

   `LocalStorageBlobStore` es el de desarrollo y el de emergencia, y se prueba
   entero en Node. `DirectoryHandleBlobStore` es la carpeta de verdad —y OPFS,
   que es el mismo código con otro handle—, **no tiene pruebas a propósito**
   (§6.3) y se verifica con `blobs/VERIFICACION-MANUAL.md`.

   Las dos reciben por constructor lo que las conecta con la plataforma —un
   `Storage`, un `FileSystemDirectoryHandle`—, porque conseguirlo es composición
   y eso vive en `platform/`, que no nace hasta la Fase 4. */
export { createLocalStorageBlobStore } from "./blobs/LocalStorageBlobStore"
export { createDirectoryHandleBlobStore } from "./blobs/DirectoryHandleBlobStore"

/* El escritor diferido: la mitad impura del write-behind. La otra mitad
   —`diffState`, que decide qué está sucio— es pura y vive en el core. */
export type { Cancel, Schedule, WriteBehind, WriteBehindDeps } from "./writeBehind"
export { createWriteBehind } from "./writeBehind"
