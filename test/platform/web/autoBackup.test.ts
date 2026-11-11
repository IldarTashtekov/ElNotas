/**
 * La copia automática: cuándo toca, cómo se llama, cuál sobra, y que quien la
 * sigue escribe, apunta y borra sólo las suyas, con todo lo de fuera de mentira.
 */

import { test } from "node:test"
import assert from "node:assert/strict"

import type { Clock, Logger, Result, StorageError } from "#core/index"
import { err, ok } from "#core/index"
import type { AutoBackup, AutoBackupState } from "#platform/web/autoBackup"
import {
  COPIAS,
  PLAZO_MS,
  REINTENTO_MS,
  SIN_COPIAS,
  afterFailed,
  afterWritten,
  autoBackupFileName,
  autoBackupStatus,
  createAutoBackup,
  hasContent,
  isDue,
  readAutoBackupState,
} from "#platform/web/autoBackup"

const HORA: number = 60 * 60 * 1000
const T: number = new Date(2026, 10, 11, 9, 5, 7).getTime()

/* ── La regla ── */

test("sin ninguna hecha, toca", (): void => {
  assert.equal(isDue(SIN_COPIAS, T, PLAZO_MS), true)
})

test("hasta que pasa el plazo desde la última, no toca; al pasar, sí", (): void => {
  const hecha: AutoBackupState = { mias: ["a"], ultima: T, fallo: null }
  assert.equal(isDue(hecha, T + PLAZO_MS - 1, PLAZO_MS), false)
  assert.equal(isDue(hecha, T + PLAZO_MS, PLAZO_MS), true)
})

test("tras un fallo, se espera un rato antes de reintentar, aunque toque", (): void => {
  const fallida: AutoBackupState = { mias: [], ultima: null, fallo: T }
  assert.equal(isDue(fallida, T + REINTENTO_MS - 1, PLAZO_MS), false)
  assert.equal(isDue(fallida, T + REINTENTO_MS, PLAZO_MS), true)
})

test("un reloj que fue atrás no deja la copia esperando hasta la fecha de la última", (): void => {
  assert.equal(isDue({ mias: ["a"], ultima: T, fallo: null }, T - HORA, PLAZO_MS), true)
})

test("escrita la cuarta, sobra la más vieja; las demás quedan, de vieja a nueva", (): void => {
  const tres: AutoBackupState = { mias: ["a", "b", "c"], ultima: T, fallo: T + 1 }
  const { estado, sobran } = afterWritten(tres, "d", T + PLAZO_MS)
  assert.equal(COPIAS, 3)
  assert.deepEqual(sobran, ["a"])
  assert.deepEqual(estado, { mias: ["b", "c", "d"], ultima: T + PLAZO_MS, fallo: null })
})

test("con menos de tres, no sobra ninguna; el mismo nombre otra vez no se cuenta dos", (): void => {
  assert.deepEqual(afterWritten({ mias: ["a"], ultima: T, fallo: null }, "b", T).sobran, [])
  assert.deepEqual(afterWritten({ mias: ["a", "b"], ultima: T, fallo: null }, "b", T).estado.mias, ["a", "b"])
})

test("un fallo se apunta sin tocar la lista de las suyas", (): void => {
  assert.deepEqual(afterFailed({ mias: ["a"], ultima: T, fallo: null }, T + 5), {
    mias: ["a"],
    ultima: T,
    fallo: T + 5,
  })
})

test("el estado que se enseña es lo más reciente: la hecha o el fallo", (): void => {
  assert.deepEqual(autoBackupStatus(SIN_COPIAS, T), { kind: "none" })
  assert.deepEqual(autoBackupStatus({ mias: ["a"], ultima: T, fallo: null }, T + HORA), { kind: "done", ago: HORA })
  assert.deepEqual(autoBackupStatus({ mias: ["a"], ultima: T, fallo: T + 10 }, T + HORA), {
    kind: "failed",
    ago: HORA - 10,
  })
  assert.deepEqual(autoBackupStatus({ mias: ["a"], ultima: T + 10, fallo: T }, T + HORA), {
    kind: "done",
    ago: HORA - 10,
  })
})

test("el nombre lleva fecha y hora de este dispositivo, con los segundos", (): void => {
  assert.equal(autoBackupFileName(T), "elnotas-2026-11-11-090507.json")
})

test("lo apuntado sin la forma esperada cuenta como ninguna copia", (): void => {
  assert.deepEqual(readAutoBackupState({ mias: ["a"], ultima: T, fallo: null }), {
    mias: ["a"],
    ultima: T,
    fallo: null,
  })
  for (const roto of [
    null,
    3,
    "x",
    { mias: [1], ultima: null, fallo: null },
    { mias: [], ultima: "ayer", fallo: null },
  ]) {
    assert.strictEqual(readAutoBackupState(roto), SIN_COPIAS)
  }
})

test("con sólo el manifiesto no hay nada que copiar; con una nota, sí", (): void => {
  assert.equal(hasContent({}), false)
  assert.equal(hasContent({ "manifest.json": "{}" }), false)
  assert.equal(hasContent({ "manifest.json": "{}", "notes/a.json": "{}" }), true)
})

/* ── Quien la sigue ── */

interface Banco {
  readonly copia: AutoBackup
  readonly escritas: () => ReadonlyArray<string>
  readonly borradas: () => ReadonlyArray<string>
  readonly fallos: () => ReadonlyArray<string>
  readonly estado: () => AutoBackupState
  readonly mover: (ms: number) => void
}

const banco = (opciones: {
  readonly collect?: () => Promise<Result<string | null, StorageError>>
  readonly write?: boolean
  readonly remove?: boolean
  readonly save?: boolean
  readonly inicial?: AutoBackupState
}): Banco => {
  let ahora: number = T
  let guardado: AutoBackupState = opciones.inicial ?? SIN_COPIAS
  let escritas: ReadonlyArray<string> = []
  let borradas: ReadonlyArray<string> = []
  let fallos: ReadonlyArray<string> = []
  const clock: Clock = { now: (): number => ahora }
  const logger: Logger = {
    failure: (que: string): void => {
      fallos = [...fallos, que]
    },
  }
  const copia: AutoBackup = createAutoBackup({
    collect: opciones.collect ?? ((): Promise<Result<string | null, StorageError>> => Promise.resolve(ok("{}"))),
    write: (nombre: string): Promise<boolean> => {
      if (opciones.write !== false) escritas = [...escritas, nombre]
      return Promise.resolve(opciones.write !== false)
    },
    remove: (nombre: string): Promise<boolean> => {
      borradas = [...borradas, nombre]
      return Promise.resolve(opciones.remove !== false)
    },
    load: (): AutoBackupState => guardado,
    save: (estado: AutoBackupState): boolean => {
      if (opciones.save === false) return false
      guardado = estado
      return true
    },
    clock,
    plazo: PLAZO_MS,
    logger,
  })
  return {
    copia,
    escritas: (): ReadonlyArray<string> => escritas,
    borradas: (): ReadonlyArray<string> => borradas,
    fallos: (): ReadonlyArray<string> => fallos,
    estado: (): AutoBackupState => guardado,
    mover: (ms: number): void => {
      ahora += ms
    },
  }
}

test("cuatro copias espaciadas: quedan tres, y se borra la primera", async (): Promise<void> => {
  const b: Banco = banco({})
  for (let i: number = 0; i < 4; i += 1) {
    await b.copia.maybeRun()
    b.mover(PLAZO_MS)
  }
  assert.equal(b.escritas().length, 4)
  assert.deepEqual(b.borradas(), [b.escritas()[0]])
  assert.deepEqual(b.estado().mias, b.escritas().slice(1))
})

test("dentro del plazo, llamar otra vez no escribe nada", async (): Promise<void> => {
  const b: Banco = banco({})
  await b.copia.maybeRun()
  b.mover(HORA)
  await b.copia.maybeRun()
  assert.equal(b.escritas().length, 1)
})

test("dos llamadas a la vez escriben una sola copia", async (): Promise<void> => {
  const b: Banco = banco({})
  await Promise.all([b.copia.maybeRun(), b.copia.maybeRun()])
  assert.equal(b.escritas().length, 1)
})

test("con la app vacía no se escribe ni se apunta nada", async (): Promise<void> => {
  const b: Banco = banco({ collect: (): Promise<Result<string | null, StorageError>> => Promise.resolve(ok(null)) })
  await b.copia.maybeRun()
  assert.deepEqual(b.escritas(), [])
  assert.strictEqual(b.estado(), SIN_COPIAS)
})

test("si no se puede escribir, se apunta el fallo y se enseña", async (): Promise<void> => {
  const b: Banco = banco({ write: false })
  await b.copia.maybeRun()
  assert.equal(b.estado().fallo, T)
  assert.deepEqual(b.copia.status(), { kind: "failed", ago: 0 })
})

test("si no se puede leer lo guardado, también es un fallo: se registra y no se escribe", async (): Promise<void> => {
  const b: Banco = banco({
    collect: (): Promise<Result<string | null, StorageError>> => Promise.resolve(err({ kind: "io", cause: null })),
  })
  await b.copia.maybeRun()
  assert.deepEqual(b.escritas(), [])
  assert.equal(b.estado().fallo, T)
  assert.equal(b.fallos().length, 1)
})

test("una vieja que no se deja borrar sale igual de la cuenta", async (): Promise<void> => {
  const b: Banco = banco({ remove: false, inicial: { mias: ["a", "b", "c"], ultima: null, fallo: null } })
  await b.copia.maybeRun()
  assert.deepEqual(b.borradas(), ["a"])
  assert.deepEqual(b.estado().mias, ["b", "c", b.escritas()[0]])
})

test("si no se puede apuntar, el plazo sigue valiendo: un cambio después no escribe otra", async (): Promise<void> => {
  const b: Banco = banco({ save: false })
  await b.copia.maybeRun()
  b.mover(HORA)
  await b.copia.maybeRun()
  assert.equal(b.escritas().length, 1)
  assert.deepEqual(b.copia.status(), { kind: "done", ago: HORA })
})
