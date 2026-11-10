/**
 * Vaciar un almacén de bytes entero, contra el de `localStorage` sobre el
 * `Storage` de mentira, que sabe lanzar.
 */

import { test } from "node:test"
import assert from "node:assert/strict"

import type { BlobStore, Result, StorageError } from "#core/index"
import { createLocalStorageBlobStore } from "#storage/index"
import { vaciarBlobs } from "#platform/web/vaciarBlobs"

import type { FakeStorage } from "../../storage/blobs/FakeStorage"
import { createFakeStorage } from "../../storage/blobs/FakeStorage"

const BYTES: Uint8Array = new TextEncoder().encode("{}")

/** Un almacén con tres ficheros, uno en una carpeta. */
const conFicheros = async (almacen: FakeStorage): Promise<BlobStore> => {
  const blobs: BlobStore = createLocalStorageBlobStore(almacen)
  for (const camino of ["manifest.json", "notes/a.json", "notes/b.json"]) await blobs.write(camino, BYTES)
  return blobs
}

test("borra todo lo que hay, carpetas incluidas", async (): Promise<void> => {
  const blobs: BlobStore = await conFicheros(createFakeStorage())
  const vaciado: Result<void, StorageError> = await vaciarBlobs(blobs)
  assert.equal(vaciado.ok, true)
  assert.deepEqual(await blobs.list(""), { ok: true, value: [] })
})

test("vacío, no hace nada y va bien", async (): Promise<void> => {
  const vaciado: Result<void, StorageError> = await vaciarBlobs(createLocalStorageBlobStore(createFakeStorage()))
  assert.equal(vaciado.ok, true)
})

test("si un borrado falla, lo devuelve", async (): Promise<void> => {
  const almacen: FakeStorage = createFakeStorage()
  const blobs: BlobStore = await conFicheros(almacen)
  almacen.lanzarEn("removeItem", new Error("bloqueado"))
  const vaciado: Result<void, StorageError> = await vaciarBlobs(blobs)
  assert.equal(vaciado.ok, false)
})

test("el manifiesto se borra el último: si algo falla antes, sigue ahí", async (): Promise<void> => {
  const almacen: FakeStorage = createFakeStorage()
  const blobs: BlobStore = createLocalStorageBlobStore(almacen)
  /* El manifiesto, el primero en la lista: el orden de listar no lo protege. */
  for (const camino of ["manifest.json", "notes/a.json"]) await blobs.write(camino, BYTES)
  const borrados: string[] = []
  const apuntando: BlobStore = {
    ...blobs,
    delete: (camino: string): Promise<Result<void, StorageError>> => {
      borrados.push(camino)
      return blobs.delete(camino)
    },
  }
  await vaciarBlobs(apuntando)
  assert.deepEqual(borrados, ["notes/a.json", "manifest.json"])
})

test("si no se puede listar, lo devuelve sin borrar nada", async (): Promise<void> => {
  const almacen: FakeStorage = createFakeStorage()
  const blobs: BlobStore = await conFicheros(almacen)
  almacen.lanzarEn("key", new Error("bloqueado"))
  const vaciado: Result<void, StorageError> = await vaciarBlobs(blobs)
  assert.equal(vaciado.ok, false)
  assert.equal(almacen.claves().length, 3)
})
