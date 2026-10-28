/**
 * La copia de seguridad: lo que se arma se vuelve a leer igual, y lo que no es
 * una copia —o la hizo una versión más nueva— se rechaza diciendo por qué.
 */

import { test } from "node:test"
import assert from "node:assert/strict"

import type { Result } from "#core/index"
import type { Backup, BackupProblem } from "#platform/web/backup"
import { BACKUP_VERSION, backupFileName, makeBackup, readBackup } from "#platform/web/backup"

const copia = (): Backup =>
  makeBackup({
    exportedAt: 1_760_000_000_000,
    files: {
      "manifest.json": '{"schemaVersion":1}',
      "notes/n1.json": '{"id":"n1"}',
    },
    windows: { windows: [{ kind: "general" }], active: { kind: "general" } },
    phosphor: "green",
    framing: { d1: { x: 10, y: -20, scale: 2 } },
    calendarOrder: { groups: ["g1", "@sin-grupo"], routines: [] },
  })

const problemaDe = (r: Result<Backup, BackupProblem>): BackupProblem => {
  if (r.ok) assert.fail("tenía que rechazarla")
  return r.error
}

/** La copia como saldría del fichero, con un campo cambiado. */
const con = (campo: string, valor: unknown): unknown => ({ ...copia(), [campo]: valor })

test("lo que se arma, pasado por JSON, se lee igual", (): void => {
  const leida: Result<Backup, BackupProblem> = readBackup(JSON.parse(JSON.stringify(copia())))
  assert.deepEqual(leida, { ok: true, value: copia() })
})

test("una copia de antes de los encuadres se lee igual, con los encuadres a null", (): void => {
  const { framing: _, ...vieja }: Backup = copia()
  const leida: Result<Backup, BackupProblem> = readBackup(JSON.parse(JSON.stringify(vieja)))
  if (!leida.ok) assert.fail("tenía que leerse")
  assert.equal(leida.value.framing, null)
  assert.equal(leida.value.phosphor, "green")
})

test("una copia de antes del calendario se lee igual, con su orden a null", (): void => {
  const { calendarOrder: _, ...vieja }: Backup = copia()
  const leida: Result<Backup, BackupProblem> = readBackup(JSON.parse(JSON.stringify(vieja)))
  if (!leida.ok) assert.fail("tenía que leerse")
  assert.equal(leida.value.calendarOrder, null)
  assert.deepEqual(leida.value.framing, { d1: { x: 10, y: -20, scale: 2 } })
})

test("lleva la marca de la app y la versión actual del formato", (): void => {
  const hecha: Backup = copia()
  assert.equal(hecha.app, "elnotas")
  assert.equal(hecha.backupVersion, BACKUP_VERSION)
})

test("lo que no es un objeto, o no lleva la marca, no es una copia", (): void => {
  const casos: ReadonlyArray<unknown> = [null, 3, "texto", [], {}, con("app", "otra-app")]
  for (const caso of casos) {
    assert.equal(problemaDe(readBackup(caso)).kind, "not-a-backup")
  }
})

test("una versión que no es un entero positivo no es una copia", (): void => {
  const casos: ReadonlyArray<unknown> = [undefined, "1", 0, -1, 1.5, Number.NaN]
  for (const caso of casos) {
    assert.equal(problemaDe(readBackup(con("backupVersion", caso))).kind, "not-a-backup")
  }
})

test("la de una versión más nueva se rechaza diciendo cuál", (): void => {
  const problema: BackupProblem = problemaDe(readBackup(con("backupVersion", BACKUP_VERSION + 1)))
  assert.deepEqual(problema, { kind: "newer-backup", version: BACKUP_VERSION + 1 })
})

test("sin fecha de exportación no es una copia", (): void => {
  assert.equal(problemaDe(readBackup(con("exportedAt", "ayer"))).kind, "not-a-backup")
})

test("sin ficheros, o con un fichero que no es texto, no es una copia", (): void => {
  const casos: ReadonlyArray<unknown> = [undefined, [], "x", { "notes/n1.json": 3 }]
  for (const caso of casos) {
    assert.equal(problemaDe(readBackup(con("files", caso))).kind, "not-a-backup")
  }
})

test("sin ficheros, pero con el objeto vacío, sí lo es: la de una app vacía", (): void => {
  assert.equal(readBackup(con("files", {})).ok, true)
})

test("sin ventanas ni fósforo sigue siendo una copia, con los dos a null", (): void => {
  const { windows: _w, phosphor: _p, ...sinNada }: Backup = copia()
  const leida: Result<Backup, BackupProblem> = readBackup(sinNada)
  if (!leida.ok) assert.fail("tenía que leerla")
  assert.equal(leida.value.windows, null)
  assert.equal(leida.value.phosphor, null)
})

test("un fósforo que no es texto se lee como null, sin rechazar la copia", (): void => {
  const leida: Result<Backup, BackupProblem> = readBackup(con("phosphor", 7))
  if (!leida.ok) assert.fail("tenía que leerla")
  assert.equal(leida.value.phosphor, null)
})

test("el nombre del fichero lleva la fecha local, con ceros delante", (): void => {
  const nueve: number = new Date(2026, 0, 9, 12).getTime()
  assert.equal(backupFileName(nueve), "elnotas-backup-2026-01-09.json")
})
