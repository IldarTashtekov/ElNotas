/**
 * El ensayo de una importación: arranca la app de mentira sobre la copia, en
 * memoria, con el mismo `boot` de siempre, sin tocar lo guardado.
 *
 * Si la copia no arrancaría —un formato más nuevo que la app, una migración que
 * falla—, se sabe antes de borrar nada. Si arranca, dice qué trae, para
 * confirmarlo.
 */

import type { BlobStore, Clock, IdGenerator, Result, StorageError } from "#core/index"
import { ok } from "#core/index"
import type { ImportSummary } from "#ui/index"
import type { Backup } from "./backup.js"
import { backupBytes } from "./backup.js"
import type { App, BootError } from "./boot.js"
import { boot } from "./boot.js"

export interface RehearseDeps {
  readonly clock: Clock
  readonly ids: IdGenerator
}

/** Un `BlobStore` sobre un `Map`, sólo para el ensayo. Nada de aquí lanza. */
const enMemoria = (backup: Backup): BlobStore => {
  const ficheros: Map<string, Uint8Array> = new Map<string, Uint8Array>(backupBytes(backup))
  return {
    read: async (camino: string): Promise<Result<Uint8Array | null, StorageError>> =>
      ok(ficheros.get(camino) ?? null),
    write: async (camino: string, data: Uint8Array): Promise<Result<void, StorageError>> => {
      ficheros.set(camino, data)
      return ok(undefined)
    },
    delete: async (camino: string): Promise<Result<void, StorageError>> => {
      ficheros.delete(camino)
      return ok(undefined)
    },
    list: async (prefijo: string): Promise<Result<ReadonlyArray<string>, StorageError>> =>
      ok([...ficheros.keys()].filter((camino: string): boolean => camino.startsWith(prefijo))),
  }
}

export const rehearseImport = async (
  backup: Backup,
  { clock, ids }: RehearseDeps,
): Promise<Result<ImportSummary, BootError>> => {
  /* Saltando lo ilegible, como el arranque de verdad: si no, una copia con un
     fichero roto no se podría importar nunca, y exportar los lleva a propósito. */
  const arrancada: Result<App, BootError> = await boot({
    blobs: enMemoria(backup),
    clock,
    ids,
    skipCorrupt: true,
  })
  if (!arrancada.ok) return arrancada

  const { notes, diagrams, contexts } = arrancada.value.store.getState()
  return ok({
    notes: Object.keys(notes).length,
    diagrams: Object.keys(diagrams).length,
    contexts: Object.keys(contexts).length,
    unreadable: arrancada.value.corrupt.length,
  })
}
