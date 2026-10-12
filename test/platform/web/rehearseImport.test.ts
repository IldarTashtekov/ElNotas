/**
 * El ensayo de una importación, con copias hechas de verdad: se arranca la app
 * sobre un almacén de mentira, se crean cosas, se exporta, y se ensaya esa
 * copia. Lo que no arrancaría se rechaza; lo que sí, dice qué trae.
 */

import { test } from "node:test"
import assert from "node:assert/strict"

import type { Clock, Context, IdGenerator, Note, Result, StorageError } from "#core/index"
import { CURRENT_SCHEMA_VERSION, noteRef, ok } from "#core/index"
import type { Cancel } from "#storage/index"
import type { PhosphorPersistence, WindowsPersistence } from "#ui/index"
import type { App, BootError } from "#platform/index"
import { boot } from "#platform/index"
import type { Backup } from "#platform/web/backup"
import { makeBackup } from "#platform/web/backup"
import { collectBackup } from "#platform/web/exportBackup"
import type { ImportSummary } from "#ui/index"
import { rehearseImport } from "#platform/web/rehearseImport"

import type { FakeBlobStore } from "../../storage/file/FakeBlobStore"
import { createFakeBlobStore } from "../../storage/file/FakeBlobStore"

const reloj: Clock = { now: (): number => 1000 }

let siguienteId: number = 0
const ids = (): IdGenerator => ({ next: (): string => `id-${siguienteId++}` })

const nuncaSalta = (): Cancel => (): void => undefined

const sinVentanas: WindowsPersistence = {
  load: (): Result<unknown, StorageError> => ok(null),
  save: (): Result<void, StorageError> => ok(undefined),
}

const sinFosforo: PhosphorPersistence = {
  load: (): Result<unknown, StorageError> => ok(null),
  save: (): Result<void, StorageError> => ok(undefined),
}

/** Una copia hecha como la haría la app: dos notas en un contexto y un diagrama. */
const copiaDeVerdad = async (): Promise<{ readonly backup: Backup; readonly blobs: FakeBlobStore }> => {
  const blobs: FakeBlobStore = createFakeBlobStore()
  const arrancada: Result<App, BootError> = await boot({
    blobs,
    clock: reloj,
    ids: ids(),
    schedule: nuncaSalta,
  })
  if (!arrancada.ok) assert.fail("el arranque tenía que ir bien")
  const app: App = arrancada.value
  const compra: Note | null = app.useCases.createNote("Compra")
  const viaje: Note | null = app.useCases.createNote("Viaje")
  if (compra === null || viaje === null) assert.fail("tenían que crearse")
  const casa: Context | null = app.useCases.createContext("Casa")
  if (casa === null) assert.fail("tenía que crearse")
  app.useCases.addItem(casa.id, noteRef(compra.id))
  app.useCases.createDiagram("Plano")
  const guardado: Result<void, StorageError> = await app.flush()
  if (!guardado.ok) assert.fail("tenía que guardarse")

  const copia: Result<Backup, StorageError> = await collectBackup({
    blobs,
    windows: sinVentanas,
    phosphor: sinFosforo,
    clock: reloj,
  })
  if (!copia.ok) assert.fail("tenía que exportarse")
  return { backup: copia.value, blobs }
}

const resumenDe = (r: Result<ImportSummary, BootError>): ImportSummary => {
  if (!r.ok) assert.fail(`el ensayo tenía que ir bien: ${JSON.stringify(r.error)}`)
  return r.value
}

const conFicheros = (backup: Backup, files: Readonly<Record<string, string>>): Backup =>
  makeBackup({ ...backup, files })

test("una copia hecha por la app pasa el ensayo y dice qué trae", async (): Promise<void> => {
  const { backup } = await copiaDeVerdad()
  assert.deepEqual(resumenDe(await rehearseImport(backup, { clock: reloj, ids: ids() })), {
    notes: 2,
    diagrams: 1,
    contexts: 1,
    unreadable: 0,
  })
})

test("la copia de una app vacía pasa, sin nada dentro", async (): Promise<void> => {
  const { backup } = await copiaDeVerdad()
  const vacia: Backup = conFicheros(backup, {})
  assert.deepEqual(resumenDe(await rehearseImport(vacia, { clock: reloj, ids: ids() })), {
    notes: 0,
    diagrams: 0,
    contexts: 0,
    unreadable: 0,
  })
})

test("un formato más nuevo que la app se rechaza, sin arrancar", async (): Promise<void> => {
  const { backup } = await copiaDeVerdad()
  const futura: Backup = conFicheros(backup, {
    ...backup.files,
    "manifest.json": JSON.stringify({ schemaVersion: CURRENT_SCHEMA_VERSION + 1 }),
  })
  const ensayo: Result<ImportSummary, BootError> = await rehearseImport(futura, {
    clock: reloj,
    ids: ids(),
  })
  if (ensayo.ok) assert.fail("tenía que rechazarla")
  assert.equal(ensayo.error.kind, "schema-from-future")
})

test("un fichero ilegible no impide importar: se cuenta y se salta", async (): Promise<void> => {
  const { backup } = await copiaDeVerdad()
  const conRota: Backup = conFicheros(backup, { ...backup.files, "notes/rota.json": "no es json" })
  const resumen: ImportSummary = resumenDe(await rehearseImport(conRota, { clock: reloj, ids: ids() }))
  assert.equal(resumen.notes, 2)
  assert.equal(resumen.unreadable, 1)
})

test("el ensayo no toca el almacén del que salió la copia", async (): Promise<void> => {
  const { backup, blobs } = await copiaDeVerdad()
  const antes: ReadonlyArray<string> = blobs.caminos()
  await rehearseImport(conFicheros(backup, {}), { clock: reloj, ids: ids() })
  assert.deepEqual(blobs.caminos(), antes)
})
