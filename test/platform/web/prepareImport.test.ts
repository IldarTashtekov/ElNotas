/**
 * El primer tiempo de importar: del fichero elegido a «se puede» o a por qué no.
 * Hasta confirmar no cambia nada; al confirmar, apunta la copia y recarga.
 */

import { test } from "node:test"
import assert from "node:assert/strict"

import type { Clock, IdGenerator, Result, StorageError } from "#core/index"
import { CURRENT_SCHEMA_VERSION } from "#core/index"
import type { Cancel } from "#storage/index"
import { createLocalStorageBlobStore } from "#storage/index"
import type { ImportPreparation } from "#ui/index"
import type { App, BootError } from "#platform/index"
import {
  boot,
  createLocalStorageFraming,
  createLocalStoragePhosphor,
  createLocalStorageWindows,
} from "#platform/index"
import type { Backup } from "#platform/web/backup"
import { BACKUP_VERSION, makeBackup } from "#platform/web/backup"
import { collectBackup } from "#platform/web/exportBackup"
import { IMPORT_KEY } from "#platform/web/importStorage"
import type { PrepareImportDeps } from "#platform/web/prepareImport"
import { prepareImport } from "#platform/web/prepareImport"

import type { FakeStorage } from "../../storage/blobs/FakeStorage"
import { createFakeStorage, excepcionDeCuota } from "../../storage/blobs/FakeStorage"

const reloj: Clock = { now: (): number => 1000 }

let siguienteId: number = 0
const ids = (): IdGenerator => ({ next: (): string => `id-${siguienteId++}` })

const nuncaSalta = (): Cancel => (): void => undefined

/** La copia de un dispositivo con una nota y un contexto. */
const copiaDeVerdad = async (): Promise<Backup> => {
  const origen: FakeStorage = createFakeStorage()
  const arrancada: Result<App, BootError> = await boot({
    blobs: createLocalStorageBlobStore(origen),
    clock: reloj,
    ids: ids(),
    schedule: nuncaSalta,
  })
  if (!arrancada.ok) assert.fail("el arranque tenía que ir bien")
  arrancada.value.useCases.createNote("Compra")
  arrancada.value.useCases.createContext("Casa")
  await arrancada.value.flush()
  const copia: Result<Backup, StorageError> = await collectBackup({
    blobs: createLocalStorageBlobStore(origen),
    windows: createLocalStorageWindows(origen),
    phosphor: createLocalStoragePhosphor(origen),
    framing: createLocalStorageFraming(origen),
    clock: reloj,
  })
  if (!copia.ok) assert.fail("tenía que exportarse")
  return copia.value
}

const fichero = (texto: string): Blob => new Blob([texto], { type: "application/json" })

interface Escena {
  readonly deps: PrepareImportDeps
  readonly almacen: FakeStorage
  readonly recargas: () => number
}

const escena = (): Escena => {
  const almacen: FakeStorage = createFakeStorage()
  let recargas: number = 0
  return {
    almacen,
    deps: {
      almacen,
      clock: reloj,
      ids: ids(),
      reload: (): void => {
        recargas += 1
      },
    },
    recargas: (): number => recargas,
  }
}

test("una copia buena está lista, dice qué trae y no cambia nada", async (): Promise<void> => {
  const e: Escena = escena()
  const lista: ImportPreparation = await prepareImport(
    fichero(JSON.stringify(await copiaDeVerdad())),
    e.deps,
  )
  if (lista.kind !== "ready") assert.fail(`tenía que estar lista: ${lista.kind}`)
  assert.deepEqual(lista.summary, { notes: 1, diagrams: 0, contexts: 1, unreadable: 0 })
  assert.deepEqual(e.almacen.claves(), [])
  assert.equal(e.recargas(), 0)
})

test("al confirmarla, la apunta y recarga", async (): Promise<void> => {
  const e: Escena = escena()
  const lista: ImportPreparation = await prepareImport(
    fichero(JSON.stringify(await copiaDeVerdad())),
    e.deps,
  )
  if (lista.kind !== "ready") assert.fail("tenía que estar lista")
  assert.equal(lista.apply(), true)
  assert.notEqual(e.almacen.getItem(IMPORT_KEY), null)
  assert.equal(e.recargas(), 1)
})

test("si no cabe al confirmarla, lo dice y no recarga", async (): Promise<void> => {
  const e: Escena = escena()
  const lista: ImportPreparation = await prepareImport(
    fichero(JSON.stringify(await copiaDeVerdad())),
    e.deps,
  )
  if (lista.kind !== "ready") assert.fail("tenía que estar lista")
  e.almacen.lanzarEn("setItem", excepcionDeCuota())
  assert.equal(lista.apply(), false)
  assert.equal(e.recargas(), 0)
})

test("un fichero que no es JSON no es una copia", async (): Promise<void> => {
  const salida: ImportPreparation = await prepareImport(fichero("hola"), escena().deps)
  assert.deepEqual(salida, { kind: "not-a-backup" })
})

test("un JSON que no es una copia, tampoco", async (): Promise<void> => {
  const salida: ImportPreparation = await prepareImport(fichero('{"notas":[]}'), escena().deps)
  assert.deepEqual(salida, { kind: "not-a-backup" })
})

test("la copia de una versión más nueva de la app se rechaza como tal", async (): Promise<void> => {
  const nueva: unknown = { ...(await copiaDeVerdad()), backupVersion: BACKUP_VERSION + 1 }
  const salida: ImportPreparation = await prepareImport(fichero(JSON.stringify(nueva)), escena().deps)
  assert.deepEqual(salida, { kind: "newer-backup" })
})

test("una copia con la que no arrancaría se rechaza con el error del arranque", async (): Promise<void> => {
  const copia: Backup = await copiaDeVerdad()
  const futura: Backup = makeBackup({
    ...copia,
    files: {
      ...copia.files,
      "manifest.json": JSON.stringify({ schemaVersion: CURRENT_SCHEMA_VERSION + 1 }),
    },
  })
  const salida: ImportPreparation = await prepareImport(
    fichero(JSON.stringify(futura)),
    escena().deps,
  )
  if (salida.kind !== "wont-boot") assert.fail(`tenía que rechazarla: ${salida.kind}`)
  assert.equal(salida.error.kind, "schema-from-future")
})

test("un fichero que no se puede leer lo dice", async (): Promise<void> => {
  const roto: Blob = {
    text: async (): Promise<string> => {
      throw new Error("no se puede leer")
    },
  } as unknown as Blob
  assert.deepEqual(await prepareImport(roto, escena().deps), { kind: "unreadable-file" })
})
