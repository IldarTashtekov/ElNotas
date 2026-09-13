/**
 * La pila entera —`FileStorageAdapter` **sobre un `BlobStore` de verdad**—
 * contra el contrato.
 *
 * Corto a propósito, como los otros dos que enganchan la suite. La diferencia
 * con `FileStorageAdapter.test.ts` es cuál es la pieza de abajo: allí es el
 * `BlobStore` falso, escrito para que se comporte como dice el puerto; aquí es
 * `LocalStorageBlobStore`, que es código de producción.
 *
 * Y eso prueba algo que ninguno de los dos prueba por separado: que **lo que el
 * adaptador necesita de un `BlobStore` es lo que este `BlobStore` hace de
 * verdad**. Un falso demasiado amable —uno que devolviera los mismos bytes que
 * recibió sin codificarlos, por ejemplo— deja pasar un error de codificación que
 * aquí no pasa.
 *
 * Es además lo más cerca que se puede llegar de la Fase 3 a ejecutar la app
 * contra un almacén real sin salir de Node: lo único de mentira que queda por
 * debajo es el objeto `Storage`, que son seis miembros sin sorpresas.
 */

import { runStorageContract } from "../contract-tests/storageContract.test"
import { createFileStorageAdapter } from "../file/FileStorageAdapter"
import { createFakeStorage } from "./FakeStorage.test"
import { createLocalStorageBlobStore } from "./LocalStorageBlobStore"

runStorageContract("FileStorageAdapter sobre LocalStorageBlobStore", () =>
  createFileStorageAdapter(createLocalStorageBlobStore(createFakeStorage())),
)
