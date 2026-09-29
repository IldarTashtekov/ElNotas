/**
 * Identificadores nuevos: un UUID versión 4 sacado del azar criptográfico del
 * navegador.
 *
 * Es la implementación de `IdGenerator` que usa la app. Recibe la fuente de azar
 * por parámetro, así que en Node se prueba con el `crypto` que ya trae.
 */

import type { IdGenerator } from "#core/index"

/** Lo único que se usa de `Crypto`. */
export type RandomSource = Pick<Crypto, "getRandomValues">

const aHex = (byte: number): string => byte.toString(16).padStart(2, "0")

export const createCryptoIdGenerator = (fuente: RandomSource): IdGenerator => ({
  next: (): string => {
    /* `getRandomValues` y no `randomUUID`: éste sólo existe en contexto seguro, y
       el móvil abriendo la app por la IP de la red local NO lo es. */
    const bytes: Uint8Array = fuente.getRandomValues(new Uint8Array(16))

    const hex: ReadonlyArray<string> = Array.from(bytes, (byte: number, i: number): string =>
      /* Los bits que dicen «versión 4» y «variante RFC 4122». El resto, azar. */
      i === 6 ? aHex((byte & 0x0f) | 0x40) : i === 8 ? aHex((byte & 0x3f) | 0x80) : aHex(byte),
    )
    const tramo = (desde: number, hasta: number): string => hex.slice(desde, hasta).join("")

    return `${tramo(0, 4)}-${tramo(4, 6)}-${tramo(6, 8)}-${tramo(8, 10)}-${tramo(10, 16)}`
  },
})
