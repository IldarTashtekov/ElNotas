/**
 * Exportar: qué va dentro de la copia, en qué orden se hacen las cosas y qué
 * pasa cuando algo falla por el camino. Con un almacén y un destino de mentira.
 */

import { test } from "node:test"
import assert from "node:assert/strict"

import type { Clock, Result, StorageError } from "#core/index"
import { err, ok } from "#core/index"
import type { CalendarOrderPersistence, FramingPersistence, PhosphorPersistence, WindowsPersistence } from "#ui/index"
import type { Backup, BackupProblem } from "#platform/web/backup"
import { readBackup } from "#platform/web/backup"
import type { ExportResult } from "#ui/index"
import type { Destination, ExportDeps } from "#platform/web/exportBackup"
import { collectBackup, exportBackup } from "#platform/web/exportBackup"

import type { FakeBlobStore } from "../../storage/file/FakeBlobStore"
import { createFakeBlobStore } from "../../storage/file/FakeBlobStore"

const AHORA: number = new Date(2026, 9, 12, 10).getTime()
const reloj: Clock = { now: (): number => AHORA }

const VENTANAS: unknown = { windows: [{ kind: "general" }], active: { kind: "general" } }

const ventanas = (leido: Result<unknown, StorageError>): WindowsPersistence => ({
  load: (): Result<unknown, StorageError> => leido,
  save: (): Result<void, StorageError> => ok(undefined),
})

const fosforo = (leido: Result<unknown, StorageError>): PhosphorPersistence => ({
  load: (): Result<unknown, StorageError> => leido,
  save: (): Result<void, StorageError> => ok(undefined),
})

const ENCUADRES: unknown = { d1: { x: 10, y: -20, scale: 2 } }

const encuadres = (leido: Result<unknown, StorageError>): FramingPersistence => ({
  load: (): Result<unknown, StorageError> => leido,
  save: (): Result<void, StorageError> => ok(undefined),
})

const ORDEN: unknown = { routines: ["r1", "r2"] }

const orden = (leido: Result<unknown, StorageError>): CalendarOrderPersistence => ({
  load: (): Result<unknown, StorageError> => leido,
  save: (): Result<void, StorageError> => ok(undefined),
})

const conFicheros = (): FakeBlobStore => {
  const blobs: FakeBlobStore = createFakeBlobStore()
  blobs.escribirTexto("manifest.json", '{"schemaVersion":1}')
  blobs.escribirTexto("notes/n1.json", '{"id":"n1","name":"Compra"}')
  blobs.escribirTexto("notes/rota.json", "esto no es json")
  return blobs
}

/** Un destino que apunta lo que se le escribe, y en qué orden pasó cada cosa. */
interface Escena {
  readonly deps: ExportDeps
  readonly escrito: () => string | null
  readonly pasos: () => ReadonlyArray<string>
  readonly nombre: () => string | null
}

const escena = (cambios: Partial<ExportDeps> = {}, escribe: boolean = true): Escena => {
  let escrito: string | null = null
  let nombre: string | null = null
  let pasos: ReadonlyArray<string> = []
  const destino: Destination = {
    write: async (texto: string): Promise<boolean> => {
      pasos = [...pasos, "escribir"]
      if (escribe) escrito = texto
      return escribe
    },
  }
  const deps: ExportDeps = {
    flush: async (): Promise<Result<void, StorageError>> => {
      pasos = [...pasos, "guardar"]
      return ok(undefined)
    },
    blobs: conFicheros(),
    windows: ventanas(ok(VENTANAS)),
    phosphor: fosforo(ok("green")),
    framing: encuadres(ok(ENCUADRES)),
    calendarOrder: orden(ok(ORDEN)),
    clock: reloj,
    chooseDestination: async (n: string): Promise<Destination | null> => {
      pasos = [...pasos, "elegir"]
      nombre = n
      return destino
    },
    ...cambios,
  }
  return {
    deps,
    escrito: (): string | null => escrito,
    pasos: (): ReadonlyArray<string> => pasos,
    nombre: (): string | null => nombre,
  }
}

const copiaEscrita = (e: Escena): Backup => {
  const texto: string | null = e.escrito()
  if (texto === null) assert.fail("no se escribió nada")
  const leida: Result<Backup, BackupProblem> = readBackup(JSON.parse(texto))
  if (!leida.ok) assert.fail(`lo escrito no es una copia: ${leida.error.kind}`)
  return leida.value
}

test("la copia lleva todos los ficheros tal cual, los ilegibles incluidos", async (): Promise<void> => {
  const e: Escena = escena()
  assert.deepEqual(await exportBackup(e.deps), { kind: "exported", partial: false })
  assert.deepEqual(copiaEscrita(e).files, {
    "manifest.json": '{"schemaVersion":1}',
    "notes/n1.json": '{"id":"n1","name":"Compra"}',
    "notes/rota.json": "esto no es json",
  })
})

test("lleva las ventanas, el fósforo, los encuadres, el orden del calendario y la hora del reloj", async (): Promise<void> => {
  const e: Escena = escena()
  await exportBackup(e.deps)
  const copia: Backup = copiaEscrita(e)
  assert.deepEqual(copia.windows, VENTANAS)
  assert.equal(copia.phosphor, "green")
  assert.deepEqual(copia.framing, ENCUADRES)
  assert.deepEqual(copia.calendarOrder, ORDEN)
  assert.equal(copia.exportedAt, AHORA)
})

test("primero elige dónde, luego guarda lo pendiente, y al final escribe", async (): Promise<void> => {
  const e: Escena = escena()
  await exportBackup(e.deps)
  assert.deepEqual(e.pasos(), ["elegir", "guardar", "escribir"])
})

test("propone el nombre con la fecha de hoy", async (): Promise<void> => {
  const e: Escena = escena()
  await exportBackup(e.deps)
  assert.equal(e.nombre(), "elnotas-backup-2026-10-12.json")
})

test("si cancela el diálogo, no guarda, no lee y no escribe", async (): Promise<void> => {
  const e: Escena = escena({ chooseDestination: async (): Promise<Destination | null> => null })
  assert.deepEqual(await exportBackup(e.deps), { kind: "cancelled" })
  assert.deepEqual(e.pasos(), [])
})

test("con el guardado detenido exporta lo guardado y lo dice", async (): Promise<void> => {
  const e: Escena = escena({
    flush: async (): Promise<Result<void, StorageError>> => err({ kind: "quota-exceeded" }),
  })
  assert.deepEqual(await exportBackup(e.deps), { kind: "exported", partial: true })
  assert.equal(Object.keys(copiaEscrita(e).files).length, 3)
})

test("si no se puede listar lo guardado, falla con ese error y no escribe", async (): Promise<void> => {
  const fallo: StorageError = { kind: "permission-denied" }
  const blobs: FakeBlobStore = conFicheros()
  blobs.fallarEn("list", fallo)
  const e: Escena = escena({ blobs })
  const salida: ExportResult = await exportBackup(e.deps)
  if (salida.kind !== "failed") assert.fail("tenía que fallar")
  assert.strictEqual(salida.error, fallo)
  assert.equal(e.escrito(), null)
})

test("si no se puede leer un fichero, falla con ese error", async (): Promise<void> => {
  const fallo: StorageError = { kind: "io", cause: "disco" }
  const blobs: FakeBlobStore = conFicheros()
  blobs.fallarEn("read", fallo)
  const salida: ExportResult = await exportBackup(escena({ blobs }).deps)
  if (salida.kind !== "failed") assert.fail("tenía que fallar")
  assert.strictEqual(salida.error, fallo)
})

test("si no se puede escribir el fichero, falla sin error de almacén", async (): Promise<void> => {
  const e: Escena = escena({}, false)
  assert.deepEqual(await exportBackup(e.deps), { kind: "failed", error: null })
})

test("un fichero listado que ya no está no va, y no es un fallo", async (): Promise<void> => {
  const blobs: FakeBlobStore = conFicheros()
  blobs.fantasma("notes/borrada.json")
  const copia: Result<Backup, StorageError> = await collectBackup({
    blobs,
    windows: ventanas(ok(null)),
    phosphor: fosforo(ok(null)),
    framing: encuadres(ok(null)),
    calendarOrder: orden(ok(null)),
    clock: reloj,
  })
  if (!copia.ok) assert.fail("tenía que salir")
  assert.equal("notes/borrada.json" in copia.value.files, false)
})

test("ventanas, fósforo, encuadres u orden del calendario que no se pueden leer van a null, sin fallar", async (): Promise<void> => {
  const ilegible: StorageError = { kind: "io", cause: "bloqueado" }
  const copia: Result<Backup, StorageError> = await collectBackup({
    blobs: conFicheros(),
    windows: ventanas(err(ilegible)),
    phosphor: fosforo(err(ilegible)),
    framing: encuadres(err(ilegible)),
    calendarOrder: orden(err(ilegible)),
    clock: reloj,
  })
  if (!copia.ok) assert.fail("tenía que salir")
  assert.equal(copia.value.windows, null)
  assert.equal(copia.value.phosphor, null)
  assert.equal(copia.value.framing, null)
  assert.equal(copia.value.calendarOrder, null)
})

test("un fósforo guardado que no es texto va a null", async (): Promise<void> => {
  const copia: Result<Backup, StorageError> = await collectBackup({
    blobs: conFicheros(),
    windows: ventanas(ok(null)),
    phosphor: fosforo(ok(42)),
    framing: encuadres(ok(null)),
    calendarOrder: orden(ok(null)),
    clock: reloj,
  })
  if (!copia.ok) assert.fail("tenía que salir")
  assert.equal(copia.value.phosphor, null)
})
