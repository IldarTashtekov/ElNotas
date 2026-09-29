/**
 * API pública del módulo de persistencia.
 *
 * Lo que hay aquí dentro son implementaciones de puertos que declara el core. La
 * dependencia va de fuera hacia dentro: `storage/` conoce al core; el core no sabe
 * que esto existe.
 *
 * Quién elige cuál de los adaptadores se usa de verdad no es este módulo, es
 * `platform/`: hoy, `platform/web/boot.ts`.
 */

export { createMemoryStorageAdapter } from "./memory/MemoryStorageAdapter.js"

/* El de ficheros JSON, parametrizado por un `BlobStore` que le llega por
   constructor. Quién es ese `BlobStore` —localStorage, la carpeta del usuario,
   OPFS— lo decide `platform/`; el falso de las pruebas no sale por
   esta puerta. */
export type { FileStorageOptions, OnCorrupt } from "./file/FileStorageAdapter.js"
export { createFileStorageAdapter } from "./file/FileStorageAdapter.js"

/* Las implementaciones de `BlobStore`, en `blobs/`: son lo de abajo del reparto
   en dos niveles y las dos se enchufan al adaptador de arriba.

   `LocalStorageBlobStore` es el de desarrollo y el de emergencia, y se prueba
   entero en Node. `DirectoryHandleBlobStore` es la carpeta de verdad —y OPFS,
   que es el mismo código con otro handle—, **no tiene pruebas a propósito**
   y se verifica con `blobs/VERIFICACION-MANUAL.md`.

   Las dos reciben por constructor lo que las conecta con la plataforma —un
   `Storage`, un `FileSystemDirectoryHandle`—, porque conseguirlo es composición
   y eso vive en `platform/`. */
export { createLocalStorageBlobStore } from "./blobs/LocalStorageBlobStore.js"
export { createDirectoryHandleBlobStore } from "./blobs/DirectoryHandleBlobStore.js"

/* El escritor diferido: la mitad impura del write-behind. La otra mitad
   —`diffState`, que decide qué está sucio— es pura y vive en el core. */
export type { Cancel, OnError, Schedule, WriteBehind, WriteBehindDeps } from "./writeBehind.js"
export { createWriteBehind } from "./writeBehind.js"
