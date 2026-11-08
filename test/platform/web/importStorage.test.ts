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
import { UI_STATE_KEY, createLocalStorageUiState } from "#platform/web/LocalStorageUiState"
import { boot } from "#platform/web/boot"
import type { Backup } from "#platform/web/backup"
import { makeBackup } from "#platform/web/backup"
import { rehearseImport } from "#platform/web/rehearseImport"
import type { ImportSummary } from "#ui/index"
import { collectBackup } from "#platform/web/exportBackup"
import type { ImportAtBoot } from "#platform/web/importStorage"
import { IMPORT_KEY, cancelImport, importIfRequested, requestImport } from "#platform/web/importStorage"

import type { FakeStorage } from "../../storage/blobs/FakeStorage"
import { createFakeStorage, excepcionDeCuota } from "../../storage/blobs/FakeStorage"
import { silentLogger } from "../../core/ports/FakeLogger"
import { MIGRADA, conLaMigracion, cortandoEn } from "./migracionDePrueba"
import { FICHEROS_ESQUEMA_UNO, NODOS_MIGRADOS, nodosDe } from "./esquemaUno"

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

/** El estado de la pantalla de otro dispositivo, ya con la forma que deja su lector. */
const PANTALLA: unknown = {
  phosphor: "magenta",
  language: "en",
  windows: { windows: [{ kind: "general" }], active: { kind: "general" } },
  framings: { d1: { x: 10, y: -20, scale: 2 } },
  calendarOrder: { routines: ["r1", "r2"], archived: [] },
  calendarTab: "routines",
  routineCharts: { view: "chart", axes: { r1: { span: 8, fromEnd: 1 } } },
}

const pantallaDe = (almacen: Storage): unknown => JSON.parse(almacen.getItem(UI_STATE_KEY) ?? "null")

/** La copia de un dispositivo con «Compra» y «Viaje» y su estado de la pantalla. */
const copiaDeOtro = async (): Promise<Backup> => {
  const origen: FakeStorage = createFakeStorage()
  await conNotas(origen, ["Compra", "Viaje"])
  origen.setItem(UI_STATE_KEY, JSON.stringify(PANTALLA))
  const copia: Result<Backup, StorageError> = await collectBackup({
    blobs: createLocalStorageBlobStore(origen),
    uiState: createLocalStorageUiState(origen),
    clock: reloj,
  })
  if (!copia.ok) assert.fail("tenía que exportarse")
  return copia.value
}

/** Este dispositivo: una nota «Vieja», su estado de la pantalla y algo de otra app. */
const esteDispositivo = async (): Promise<FakeStorage> => {
  const almacen: FakeStorage = createFakeStorage()
  await conNotas(almacen, ["Vieja"])
  almacen.setItem(UI_STATE_KEY, '{"phosphor":"amber","framings":{"vieja":{"x":0,"y":0,"scale":1}}}')
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

test("entra también el estado de la pantalla de la copia", async (): Promise<void> => {
  const almacen: FakeStorage = await esteDispositivo()
  requestImport(almacen, await copiaDeOtro())
  await importIfRequested(almacen)
  assert.deepEqual(pantallaDe(almacen), PANTALLA)
})

test("si la copia no trae estado de la pantalla, el de antes también se va", async (): Promise<void> => {
  const almacen: FakeStorage = await esteDispositivo()
  const sinPantalla: Backup = makeBackup({ ...(await copiaDeOtro()), uiState: null })
  requestImport(almacen, sinPantalla)
  await importIfRequested(almacen)
  assert.equal(almacen.getItem(UI_STATE_KEY), null)
})

test("el estado de la pantalla de la copia pasa por el lector: lo que no tiene forma no entra", async (): Promise<void> => {
  const almacen: FakeStorage = await esteDispositivo()
  const rara: Backup = makeBackup({
    ...(await copiaDeOtro()),
    uiState: {
      phosphor: "azul",
      language: "fr",
      framings: { d1: { x: 1, y: 2, scale: 2 }, roto: { x: "a" } },
      calendarOrder: { groups: ["g1"], routines: ["r1", 3, "r1", "r2"], archived: ["r2", 5] },
      calendarTab: "otra",
      sobra: true,
    },
  })
  requestImport(almacen, rara)
  await importIfRequested(almacen)
  const guardado: unknown = pantallaDe(almacen)
  assert.deepEqual(guardado, {
    ...(guardado as object),
    phosphor: "green",
    language: null,
    framings: { d1: { x: 1, y: 2, scale: 2 } },
    calendarOrder: { routines: ["r1", "r2"], archived: ["r2"] },
    calendarTab: "events",
  })
  assert.equal("sobra" in (guardado as object), false)
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

/** El arranque que sigue a importar, con la migración de prueba. */
const arrancarMigrando = (almacen: Storage): Promise<Result<App, BootError>> =>
  boot({
    logger: silentLogger,
    blobs: createLocalStorageBlobStore(almacen),
    clock: reloj,
    ids: ids(),
    schedule: nuncaSalta,
    migrations: conLaMigracion,
  })

test("una copia de un formato viejo se importa y el arranque la migra y la guarda", async (): Promise<void> => {
  const almacen: FakeStorage = await esteDispositivo()
  requestImport(almacen, await copiaDeOtro())
  assert.deepEqual(await importIfRequested(almacen), { kind: "imported" })

  const migrada: Result<App, BootError> = await arrancarMigrando(almacen)
  if (!migrada.ok) assert.fail("tenía que arrancar")
  assert.deepEqual(nombresDe(migrada.value), [`Compra${MIGRADA}`, `Viaje${MIGRADA}`])

  /* Guardada: otro arranque, sin escribir nada, la ve igual. */
  almacen.lanzarEn("setItem", excepcionDeCuota())
  const otra: Result<App, BootError> = await arrancarMigrando(almacen)
  if (!otra.ok) assert.fail("tenía que arrancar sin escribir")
  assert.deepEqual(nombresDe(otra.value), [`Compra${MIGRADA}`, `Viaje${MIGRADA}`])
})

test("importada, si la migración se corta a medias, el siguiente arranque la termina", async (): Promise<void> => {
  const almacen: FakeStorage = await esteDispositivo()
  requestImport(almacen, await copiaDeOtro())
  await importIfRequested(almacen)

  const cortada: Result<App, BootError> = await arrancarMigrando(cortandoEn(almacen, 2))
  assert.equal(cortada.ok, false)

  const migrada: Result<App, BootError> = await arrancarMigrando(almacen)
  if (!migrada.ok) assert.fail("tenía que arrancar")
  assert.deepEqual(nombresDe(migrada.value), [`Compra${MIGRADA}`, `Viaje${MIGRADA}`])
})

test("una copia v1 con los nodos de antes pasa el ensayo y, importada, arranca con ellos convertidos", async (): Promise<void> => {
  const copia: Backup = makeBackup({ exportedAt: 0, files: FICHEROS_ESQUEMA_UNO, uiState: null })
  const ensayo: Result<ImportSummary, BootError> = await rehearseImport(copia, {
    logger: silentLogger,
    clock: reloj,
    ids: ids(),
  })
  if (!ensayo.ok) assert.fail(`el ensayo tenía que pasar: ${JSON.stringify(ensayo.error)}`)

  const almacen: FakeStorage = await esteDispositivo()
  assert.equal(requestImport(almacen, copia), true)
  assert.deepEqual(await importIfRequested(almacen), { kind: "imported" })
  const arrancada: Result<App, BootError> = await boot({
    logger: silentLogger,
    blobs: createLocalStorageBlobStore(almacen),
    clock: reloj,
    ids: ids(),
    schedule: nuncaSalta,
    skipCorrupt: true,
  })
  if (!arrancada.ok) assert.fail(`tenía que arrancar: ${JSON.stringify(arrancada.error)}`)
  assert.deepEqual(nodosDe(arrancada.value.store.getState().diagrams), NODOS_MIGRADOS)
})
