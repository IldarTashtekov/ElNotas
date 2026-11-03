/**
 * Una migración de prueba, de la versión actual a la siguiente, para ver migrar
 * al arranque, al ensayo y a la importación: añade « (migrada)» al nombre de
 * cada nota. Cumple lo que pide `Migration`: pasa dos veces sin daño y devuelve
 * la misma nota que no cambia.
 *
 * Y un almacén que se corta a la enésima escritura, para cortarla a medias.
 */

import type { Note, StoredEntities } from "#core/index"
import type { Migration, MigrationOptions } from "#core/migrations/runMigrations"
import { CURRENT_SCHEMA_VERSION } from "#core/migrations/runMigrations"

import { excepcionDeCuota } from "../../storage/blobs/FakeStorage"

export const MIGRADA: string = " (migrada)"

const migrarNota = (nota: Note): Note =>
  nota.name.endsWith(MIGRADA) ? nota : { ...nota, name: `${nota.name}${MIGRADA}` }

const renombrarNotas: Migration = {
  from: CURRENT_SCHEMA_VERSION,
  migrate: (data: unknown): unknown => {
    const guardado: StoredEntities = data as StoredEntities
    const notes: ReadonlyArray<Note> = guardado.notes.map(migrarNota)
    const iguales: boolean = notes.every((n: Note, i: number): boolean => n === guardado.notes[i])
    return iguales ? guardado : { ...guardado, notes }
  },
}

/** La versión a la que lleva. */
export const VERSION_MIGRADA: number = CURRENT_SCHEMA_VERSION + 1

export const conLaMigracion: MigrationOptions = { migrations: [renombrarNotas], target: VERSION_MIGRADA }

/** Una que revienta, como una de verdad ante datos que no esperaba. */
export const conUnaQueFalla: MigrationOptions = {
  migrations: [
    {
      from: CURRENT_SCHEMA_VERSION,
      migrate: (): unknown => {
        throw new Error("no esperaba esto")
      },
    },
  ],
  target: VERSION_MIGRADA,
}

/** El mismo almacén, pero la escritura número `n` (desde 1) no cabe. */
export const cortandoEn = (almacen: Storage, n: number): Storage => {
  let hechas: number = 0
  return {
    get length(): number {
      return almacen.length
    },
    clear: (): void => almacen.clear(),
    getItem: (clave: string): string | null => almacen.getItem(clave),
    key: (indice: number): string | null => almacen.key(indice),
    removeItem: (clave: string): void => almacen.removeItem(clave),
    setItem: (clave: string, valor: string): void => {
      hechas = hechas + 1
      if (hechas === n) throw excepcionDeCuota()
      almacen.setItem(clave, valor)
    },
  }
}
