/**
 * El generador de ids de la app: que salga un UUID v4 bien formado y que no se
 * repita.
 */

import { test } from "node:test"
import assert from "node:assert/strict"

import type { IdGenerator } from "#core/index"
import type { RandomSource } from "#platform/index"
import { createCryptoIdGenerator } from "#platform/index"

const UUID_V4: RegExp = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

/** Una fuente que rellena siempre con el mismo byte: salida predecible. */
const fuenteFija = (byte: number): RandomSource => ({
  getRandomValues: <T extends ArrayBufferView | null>(destino: T): T => {
    if (destino instanceof Uint8Array) destino.fill(byte)
    return destino
  },
})

test("con azar a cero salen justo los bits de versión y variante", (): void => {
  const ids: IdGenerator = createCryptoIdGenerator(fuenteFija(0x00))
  assert.equal(ids.next(), "00000000-0000-4000-8000-000000000000")
})

test("con azar a unos, la versión y la variante pisan lo que haya", (): void => {
  const ids: IdGenerator = createCryptoIdGenerator(fuenteFija(0xff))
  assert.equal(ids.next(), "ffffffff-ffff-4fff-bfff-ffffffffffff")
})

test("con el crypto de verdad: mil ids con forma de UUID v4 y ninguno repetido", (): void => {
  const ids: IdGenerator = createCryptoIdGenerator(globalThis.crypto)
  const generados: ReadonlyArray<string> = Array.from(
    { length: 1000 },
    (): string => ids.next(),
  )

  for (const id of generados) assert.match(id, UUID_V4)
  assert.equal(new Set<string>(generados).size, generados.length)
})
