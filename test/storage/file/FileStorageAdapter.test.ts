/**
 * El adaptador de fichero, contra el contrato.
 *
 * Corto a propósito, como el de memoria: **el contrato no se toca y no se
 * duplica**. Lo que se le exige a este adaptador es lo mismo que a cualquier
 * otro backend, y eso vive en un solo sitio.
 *
 * Que esta línea pase es la mitad de la Fase 3: significa que toda la lógica de
 * la persistencia en fichero —serializar, id a camino, el manifiesto— queda
 * verificada en Node, sin navegador, con el `BlobStore` falso. Lo que queda sin
 * automatizar es `DirectoryHandleBlobStore`, que no tiene lógica propia y se
 * verifica a mano con `VERIFICACION-MANUAL.md`.
 *
 * La otra mitad está en `FileStorageAdapter.errors.test.ts`, y no es una prueba
 * «propia del adaptador» en el sentido que el proyecto desaconseja: prueba la
 * traducción de errores del nivel de abajo, que **el contrato no puede ver**
 * porque no sabe que existe un `BlobStore`.
 */

import { runStorageContract } from "../contract-tests/storageContract"
import { createFakeBlobStore } from "./FakeBlobStore"
import { createFileStorageAdapter } from "#storage/file/FileStorageAdapter"

runStorageContract("FileStorageAdapter", () =>
  createFileStorageAdapter(createFakeBlobStore()),
)
