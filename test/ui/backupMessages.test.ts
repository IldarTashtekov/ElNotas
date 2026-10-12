/**
 * Lo que dice la configuración al exportar e importar una copia, y la pantalla
 * de una importación a medias. Sin DOM.
 */

import { test } from "node:test"
import assert from "node:assert/strict"

import type { MigrationError, StorageError } from "#core/index"
import type { ImportPreparation, ImportSummary } from "#ui/index"
import {
  IMPORT_NOT_APPLIED,
  describeImportFailure,
  describeMigrationError,
  describeStorageError,
  exportMessage,
  importProblem,
  importQuestion,
} from "#ui/index"

const resumen = (cambios: Partial<ImportSummary>): ImportSummary => ({
  notes: 0,
  diagrams: 0,
  contexts: 0,
  unreadable: 0,
  ...cambios,
})

/* ── Exportar ── */

test("exportada, lo dice", (): void => {
  assert.equal(exportMessage({ kind: "exported", partial: false }), "Copia guardada.")
})

test("exportada con el guardado detenido, avisa de que falta lo último", (): void => {
  assert.match(exportMessage({ kind: "exported", partial: true }) ?? "", /sin los últimos cambios/)
})

test("cancelada, no dice nada", (): void => {
  assert.equal(exportMessage({ kind: "cancelled" }), null)
})

test("sin poder leer lo guardado, dice por qué", (): void => {
  const fallo: StorageError = { kind: "permission-denied" }
  assert.match(
    exportMessage({ kind: "failed", error: fallo }) ?? "",
    new RegExp(describeStorageError(fallo)),
  )
})

test("sin poder escribir el fichero, lo dice", (): void => {
  assert.equal(
    exportMessage({ kind: "failed", error: null }),
    "No se ha podido escribir la copia.",
  )
})

/* ── Importar: la pregunta ── */

test("la pregunta cuenta lo que trae, como la de «Borrar todo»", (): void => {
  assert.equal(
    importQuestion(resumen({ notes: 2, diagrams: 1, contexts: 3 })),
    "La copia trae 2 notas, 1 diagrama y 3 contextos. ¿Sustituir por ella todo lo de este navegador? Lo de ahora se pierde.",
  )
})

test("una copia vacía lo dice", (): void => {
  assert.match(importQuestion(resumen({})), /^La copia está vacía\./)
})

test("los ficheros ilegibles se nombran, en singular y en plural", (): void => {
  assert.match(
    importQuestion(resumen({ notes: 1, unreadable: 1 })),
    / 1 fichero no se puede leer: entra igual, pero no se verá\. /,
  )
  assert.match(
    importQuestion(resumen({ notes: 1, unreadable: 3 })),
    / 3 ficheros no se pueden leer: entran igual, pero no se verán\. /,
  )
})

test("sin ilegibles, no se nombran", (): void => {
  assert.doesNotMatch(importQuestion(resumen({ notes: 1 })), /leer/)
})

/* ── Importar: por qué no ── */

test("cada motivo para no importar tiene su frase", (): void => {
  const motivos: ReadonlyArray<Exclude<ImportPreparation, { readonly kind: "ready" }>> = [
    { kind: "unreadable-file" },
    { kind: "not-a-backup" },
    { kind: "newer-backup" },
    { kind: "wont-boot", error: { kind: "io", cause: null } },
  ]
  const frases: ReadonlySet<string> = new Set(motivos.map(importProblem))
  assert.equal(frases.size, motivos.length)
})

test("si no arrancaría, dice el motivo del arranque", (): void => {
  const futuro: MigrationError = { kind: "schema-from-future", stored: 9, supported: 1 }
  assert.match(
    importProblem({ kind: "wont-boot", error: futuro }),
    new RegExp(describeMigrationError(futuro)),
  )
})

test("si no cabe al confirmar, dice que no ha cambiado nada", (): void => {
  assert.match(IMPORT_NOT_APPLIED, /No se ha cambiado nada/)
})

/* ── La importación a medias ── */

test("la pantalla de una importación a medias dice el fallo y qué hacer", (): void => {
  const lleno: StorageError = { kind: "quota-exceeded" }
  const texto: string = describeImportFailure(lleno)
  assert.match(texto, new RegExp(describeStorageError(lleno)))
  assert.match(texto, /Se reintentará al recargar/)
  assert.match(texto, /«Abandonar la importación»/)
})
