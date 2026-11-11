/**
 * Dónde se apunta qué copias automáticas son de esta instalación: se lee lo que
 * se guardó, y lo que no se puede leer o guardar se registra, sin romper nada.
 */

import { test } from "node:test"
import assert from "node:assert/strict"

import type { Logger } from "#core/index"
import type { AutoBackupState } from "#platform/web/autoBackup"
import { SIN_COPIAS } from "#platform/web/autoBackup"
import type { AutoBackupStatePersistence } from "#platform/web/autoBackupStorage"
import { AUTO_BACKUP_KEY, createLocalStorageAutoBackupState } from "#platform/web/autoBackupStorage"

import type { FakeStorage } from "../../storage/blobs/FakeStorage"
import { createFakeStorage, excepcionDeCuota } from "../../storage/blobs/FakeStorage"

const conRegistro = (): { readonly logger: Logger; readonly fallos: () => ReadonlyArray<string> } => {
  let fallos: ReadonlyArray<string> = []
  return {
    logger: {
      failure: (que: string): void => {
        fallos = [...fallos, que]
      },
    },
    fallos: (): ReadonlyArray<string> => fallos,
  }
}

const ESTADO: AutoBackupState = { mias: ["elnotas-2026-11-11-090507.json"], ultima: 5, fallo: null }

test("lo guardado se lee igual", (): void => {
  const almacen: FakeStorage = createFakeStorage()
  const apuntado: AutoBackupStatePersistence = createLocalStorageAutoBackupState(almacen, conRegistro().logger)
  assert.equal(apuntado.save(ESTADO), true)
  assert.deepEqual(apuntado.load(), ESTADO)
})

test("sin nada guardado, ninguna copia, y no es un fallo", (): void => {
  const registro: ReturnType<typeof conRegistro> = conRegistro()
  assert.strictEqual(createLocalStorageAutoBackupState(createFakeStorage(), registro.logger).load(), SIN_COPIAS)
  assert.deepEqual(registro.fallos(), [])
})

test("un JSON roto cuenta como ninguna copia, y se registra", (): void => {
  const almacen: FakeStorage = createFakeStorage()
  almacen.setItem(AUTO_BACKUP_KEY, "{roto")
  const registro: ReturnType<typeof conRegistro> = conRegistro()
  assert.strictEqual(createLocalStorageAutoBackupState(almacen, registro.logger).load(), SIN_COPIAS)
  assert.equal(registro.fallos().length, 1)
})

test("si no cabe, responde que no y se registra", (): void => {
  const almacen: FakeStorage = createFakeStorage()
  almacen.lanzarEn("setItem", excepcionDeCuota())
  const registro: ReturnType<typeof conRegistro> = conRegistro()
  assert.equal(createLocalStorageAutoBackupState(almacen, registro.logger).save(ESTADO), false)
  assert.equal(registro.fallos().length, 1)
})
