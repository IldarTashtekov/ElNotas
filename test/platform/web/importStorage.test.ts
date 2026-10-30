/**
 * Importar sustituyendo, en sus dos tiempos: apuntar la copia y, al arrancar,
 * cambiar lo que había por ella. Con copias hechas de verdad y contra el
 * `localStorage` de mentira, que sabe lanzar.
 */

import { test } from "node:test"
import assert from "node:assert/strict"

import type { Clock, IdGenerator, Note, Result, StorageError } from "#core/index"
import type { Cancel } from "#storage/writeBehind"
import { createLocalStorageBlobStore } from "#storage/index"
import type { App, BootError } from "#platform/web/boot"
import { FRAMING_KEY, createLocalStorageFraming } from "#platform/web/LocalStorageFraming"
import { CALENDAR_ORDER_KEY, createLocalStorageCalendarOrder } from "#platform/web/LocalStorageCalendarOrder"
import { PHOSPHOR_KEY, createLocalStoragePhosphor } from "#platform/web/LocalStoragePhosphor"
import { WINDOWS_KEY, createLocalStorageWindows } from "#platform/web/LocalStorageWindows"
import { boot } from "#platform/web/boot"
import type { Backup } from "#platform/web/backup"
import { makeBackup } from "#platform/web/backup"
import { collectBackup } from "#platform/web/exportBackup"
import type { ImportAtBoot } from "#platform/web/importStorage"
import {
  IMPORT_KEY,
  cancelImport,
  importIfRequested,
  requestImport,
} from "#platform/web/importStorage"

import type { FakeStorage } from "../../storage/blobs/FakeStorage"
import { createFakeStorage, excepcionDeCuota } from "../../storage/blobs/FakeStorage"
import { silentLogger } from "../../core/ports/FakeLogger"

const reloj: Clock = { now: (): number => 1000 }

let siguienteId: number = 0
const ids = (): IdGenerator => ({ next: (): string => `id-${siguienteId++}` })

const nuncaSalta = (): Cancel => (): void => undefined

const arrancar = async (almacen: Storage): Promise<App> => {
  const arrancada: Result<App, BootError> = await boot({
    logger: silentLogger,
    blobs: createLocalStorageBlobStore(almacen),
    clock: reloj,
    ids: ids(),
    schedule: nuncaSalta,
  })
  if (!arrancada.ok) assert.fail(`el arranque tenía que ir bien: ${JSON.stringify(arrancada.error)}`)
  return arrancada.value
}

/** Una app con esas notas guardadas, en su almacén. */
const conNotas = async (almacen: Storage, nombres: ReadonlyArray<string>): Promise<void> => {
  const app: App = await arrancar(almacen)
  for (const nombre of nombres) app.useCases.createNote(nombre)
  const guardado: Result<void, StorageError> = await app.flush()
  if (!guardado.ok) assert.fail("tenía que guardarse")
}

const nombresDe = (app: App): ReadonlyArray<string> =>
  Object.values(app.store.getState().notes)
    .map((n: Note): string => n.name)
    .sort()

const VENTANAS: unknown = { windows: [{ kind: "general" }], active: { kind: "general" } }
const ENCUADRES: unknown = { d1: { x: 10, y: -20, scale: 2 } }
const ORDEN: unknown = { routines: ["r1", "r2"], archived: [] }

/** La copia de un dispositivo con «Compra» y «Viaje», fósforo verde, sus ventanas y sus encuadres. */
const copiaDeOtro = async (): Promise<Backup> => {
  const origen: FakeStorage = createFakeStorage()
  await conNotas(origen, ["Compra", "Viaje"])
  origen.setItem(WINDOWS_KEY, JSON.stringify(VENTANAS))
  origen.setItem(PHOSPHOR_KEY, "green")
  origen.setItem(FRAMING_KEY, JSON.stringify(ENCUADRES))
  origen.setItem(CALENDAR_ORDER_KEY, JSON.stringify(ORDEN))
  const copia: Result<Backup, StorageError> = await collectBackup({
    blobs: createLocalStorageBlobStore(origen),
    windows: createLocalStorageWindows(origen),
    phosphor: createLocalStoragePhosphor(origen),
    framing: createLocalStorageFraming(origen),
    calendarOrder: createLocalStorageCalendarOrder(origen),
    clock: reloj,
  })
  if (!copia.ok) assert.fail("tenía que exportarse")
  return copia.value
}

/** Este dispositivo: una nota «Vieja», ámbar, ventanas y encuadres propios y algo de otra app. */
const esteDispositivo = async (): Promise<FakeStorage> => {
  const almacen: FakeStorage = createFakeStorage()
  await conNotas(almacen, ["Vieja"])
  almacen.setItem(WINDOWS_KEY, '{"windows":[],"active":null}')
  almacen.setItem(PHOSPHOR_KEY, "amber")
  almacen.setItem(FRAMING_KEY, '{"vieja":{"x":0,"y":0,"scale":1}}')
  almacen.setItem(CALENDAR_ORDER_KEY, '{"routines":["vieja"]}')
  almacen.setItem("otra-app:cosa", "x")
  return almacen
}

test("sin pedirlo, arrancar no toca nada", async (): Promise<void> => {
  const almacen: FakeStorage = await esteDispositivo()
  const antes: ReadonlyArray<string> = almacen.claves()
  assert.deepEqual(await importIfRequested(almacen), { kind: "none" })
  assert.deepEqual(almacen.claves(), antes)
})

test("pedido, al arrancar lo de antes se va y entra la copia entera", async (): Promise<void> => {
  const almacen: FakeStorage = await esteDispositivo()
  assert.equal(requestImport(almacen, await copiaDeOtro()), true)
  assert.deepEqual(await importIfRequested(almacen), { kind: "imported" })
  assert.deepEqual(nombresDe(await arrancar(almacen)), ["Compra", "Viaje"])
})

test("entran también las ventanas, el fósforo y los encuadres de la copia", async (): Promise<void> => {
  const almacen: FakeStorage = await esteDispositivo()
  requestImport(almacen, await copiaDeOtro())
  await importIfRequested(almacen)
  assert.deepEqual(JSON.parse(almacen.getItem(WINDOWS_KEY) ?? "null"), VENTANAS)
  assert.equal(almacen.getItem(PHOSPHOR_KEY), "green")
  assert.deepEqual(JSON.parse(almacen.getItem(FRAMING_KEY) ?? "null"), ENCUADRES)
  assert.deepEqual(JSON.parse(almacen.getItem(CALENDAR_ORDER_KEY) ?? "null"), ORDEN)
})

test("si la copia no trae ventanas, fósforo ni encuadres, los de antes también se van", async (): Promise<void> => {
  const almacen: FakeStorage = await esteDispositivo()
  const sinNada: Backup = makeBackup({
    ...(await copiaDeOtro()),
    windows: null,
    phosphor: null,
    framing: null,
    calendarOrder: null,
  })
  requestImport(almacen, sinNada)
  await importIfRequested(almacen)
  assert.equal(almacen.getItem(WINDOWS_KEY), null)
  assert.equal(almacen.getItem(PHOSPHOR_KEY), null)
  assert.equal(almacen.getItem(FRAMING_KEY), null)
  assert.equal(almacen.getItem(CALENDAR_ORDER_KEY), null)
})

test("los encuadres de la copia pasan por el lector: lo que no tiene forma no entra", async (): Promise<void> => {
  const almacen: FakeStorage = await esteDispositivo()
  const rara: Backup = makeBackup({
    ...(await copiaDeOtro()),
    framing: { d1: { x: 1, y: 2, scale: 2 }, roto: { x: "a" } },
  })
  requestImport(almacen, rara)
  await importIfRequested(almacen)
  assert.deepEqual(JSON.parse(almacen.getItem(FRAMING_KEY) ?? "null"), { d1: { x: 1, y: 2, scale: 2 } })
})

test("el orden del calendario de la copia pasa por el lector: lo que no tiene forma no entra", async (): Promise<void> => {
  const almacen: FakeStorage = await esteDispositivo()
  const rara: Backup = makeBackup({
    ...(await copiaDeOtro()),
    calendarOrder: { groups: ["g1"], routines: ["r1", 3, "r1", "r2"], archived: ["r2", 5] },
  })
  requestImport(almacen, rara)
  await importIfRequested(almacen)
  assert.deepEqual(JSON.parse(almacen.getItem(CALENDAR_ORDER_KEY) ?? "null"), {
    routines: ["r1", "r2"],
    archived: ["r2"],
  })
})

test("la marca se quita, y lo que no es de la app no se toca", async (): Promise<void> => {
  const almacen: FakeStorage = await esteDispositivo()
  requestImport(almacen, await copiaDeOtro())
  await importIfRequested(almacen)
  assert.equal(almacen.getItem(IMPORT_KEY), null)
  assert.equal(almacen.getItem("otra-app:cosa"), "x")
})

test("lo que se escriba entre pedirlo y arrancar también se va", async (): Promise<void> => {
  /* Es la razón de los dos tiempos: el guardado de salida escribe tras el botón. */
  const almacen: FakeStorage = await esteDispositivo()
  requestImport(almacen, await copiaDeOtro())
  await conNotas(almacen, ["Escrita al salir"])
  await importIfRequested(almacen)
  assert.deepEqual(nombresDe(await arrancar(almacen)), ["Compra", "Viaje"])
})

test("si no cabe al apuntarla, lo dice y no cambia nada", async (): Promise<void> => {
  const almacen: FakeStorage = await esteDispositivo()
  const antes: ReadonlyArray<string> = almacen.claves()
  const copia: Backup = await copiaDeOtro()
  almacen.lanzarEn("setItem", excepcionDeCuota())
  assert.equal(requestImport(almacen, copia), false)
  assert.deepEqual(almacen.claves(), antes)
})

test("lo apuntado que no es una copia se descarta sin borrar nada", async (): Promise<void> => {
  const almacen: FakeStorage = await esteDispositivo()
  almacen.setItem(IMPORT_KEY, "esto no es json")
  assert.deepEqual(await importIfRequested(almacen), { kind: "invalid" })
  assert.equal(almacen.getItem(IMPORT_KEY), null)
  assert.deepEqual(nombresDe(await arrancar(almacen)), ["Vieja"])
})

test("si falla al escribir, la marca sigue y el siguiente arranque lo termina", async (): Promise<void> => {
  const almacen: FakeStorage = await esteDispositivo()
  requestImport(almacen, await copiaDeOtro())
  const cuota: DOMException = excepcionDeCuota()
  almacen.lanzarEn("setItem", cuota)
  const primero: ImportAtBoot = await importIfRequested(almacen)
  assert.deepEqual(primero, { kind: "failed", error: { kind: "quota-exceeded" } })
  assert.notEqual(almacen.getItem(IMPORT_KEY), null)

  assert.deepEqual(await importIfRequested(almacen), { kind: "imported" })
  assert.deepEqual(nombresDe(await arrancar(almacen)), ["Compra", "Viaje"])
})

test("si falla al borrar lo de antes, la marca sigue y no se escribe nada", async (): Promise<void> => {
  const almacen: FakeStorage = await esteDispositivo()
  requestImport(almacen, await copiaDeOtro())
  almacen.lanzarEn("removeItem", new Error("bloqueado"))
  const salida: ImportAtBoot = await importIfRequested(almacen)
  assert.equal(salida.kind, "failed")
  assert.notEqual(almacen.getItem(IMPORT_KEY), null)
})

test("si leer la marca lanza, falla sin borrar nada", async (): Promise<void> => {
  const almacen: FakeStorage = await esteDispositivo()
  requestImport(almacen, await copiaDeOtro())
  const antes: ReadonlyArray<string> = almacen.claves()
  almacen.lanzarEn("getItem", new Error("bloqueado"))
  assert.equal((await importIfRequested(almacen)).kind, "failed")
  assert.deepEqual(almacen.claves(), antes)
})

test("cancelar quita sólo la marca", async (): Promise<void> => {
  const almacen: FakeStorage = await esteDispositivo()
  requestImport(almacen, await copiaDeOtro())
  assert.equal(cancelImport(almacen), true)
  assert.deepEqual(await importIfRequested(almacen), { kind: "none" })
  assert.deepEqual(nombresDe(await arrancar(almacen)), ["Vieja"])
})
