/**
 * Los mensajes de fallo: que cada caso tenga su frase y que el de arranque
 * elija bien de qué lado viene el error.
 */

import { test } from "node:test"
import assert from "node:assert/strict"

import type { MigrationError, StorageError } from "#core/index"
import { describeBootError, describeMigrationError, describeStorageError } from "#ui/index"

const CORRUPTO: StorageError = { kind: "corrupt", path: "notes/rota.json", cause: "x" }
const DEL_FUTURO: MigrationError = { kind: "schema-from-future", stored: 9, supported: 1 }

test("un corrupt dice qué fichero es", (): void => {
  assert.match(describeStorageError(CORRUPTO), /notes\/rota\.json/)
})

test("cada fallo de almacén tiene una frase distinta", (): void => {
  const fallos: ReadonlyArray<StorageError> = [
    CORRUPTO,
    { kind: "permission-denied" },
    { kind: "not-found", path: "notes/" },
    { kind: "quota-exceeded" },
    { kind: "stale", id: "compra" },
    { kind: "io", cause: "x" },
  ]
  const frases: ReadonlyArray<string> = fallos.map(describeStorageError)
  assert.equal(new Set<string>(frases).size, fallos.length)
})

test("el arranque manda cada error a su lado", (): void => {
  assert.equal(describeBootError(DEL_FUTURO), describeMigrationError(DEL_FUTURO))
  assert.equal(describeBootError(CORRUPTO), describeStorageError(CORRUPTO))
})
