/**
 * El orden en que se enseñan las rutinas y cuáles están archivadas: una
 * presentación de este dispositivo, no parte del modelo.
 *
 * Son listas de ids. Lo guardado puede nombrar lo que ya no existe o no
 * nombrar lo recién creado: `reconcileOrder` lo pone al día.
 */

import type { Result, StorageError } from "#core/index"

export interface CalendarOrder {
  readonly routines: ReadonlyArray<string>
  /** Las apartadas de la lista, sin dejar de existir; siguen también en `routines`. */
  readonly archived: ReadonlyArray<string>
}

export const NO_ORDER: CalendarOrder = { routines: [], archived: [] }

/** Dónde se guarda. Lo pone `platform/`. Ninguno de los dos lanza. */
export interface CalendarOrderPersistence {
  /** Lo guardado tal cual, sin validar, o `null` si nunca se guardó nada. */
  readonly load: () => Result<unknown, StorageError>
  readonly save: (order: CalendarOrder) => Result<void, StorageError>
}

/** Una lista de ids leída: sólo textos, sin repetir. Lo demás se descarta. */
const leerIds = (x: unknown): ReadonlyArray<string> =>
  Array.isArray(x)
    ? x.filter(
        (id: unknown, i: number, todos: ReadonlyArray<unknown>): id is string =>
          typeof id === "string" && todos.indexOf(id) === i,
      )
    : []

/** Lo guardado → el orden. Lo que no tenga forma se descarta, sin fallar; un `groups` de copias viejas se ignora. */
export const parseCalendarOrder = (guardado: unknown): CalendarOrder => {
  if (typeof guardado !== "object" || guardado === null || Array.isArray(guardado)) return NO_ORDER
  const registro: Record<string, unknown> = guardado as Record<string, unknown>
  return { routines: leerIds(registro["routines"]), archived: leerIds(registro["archived"]) }
}

/**
 * Lo guardado puesto al día con lo que existe: fuera lo que ya no está y, al
 * final, lo nuevo en el orden en que llega.
 *
 * ⚠️ Si no hay nada que quitar ni que añadir devuelve **la misma lista**.
 */
export const reconcileOrder = (
  guardado: ReadonlyArray<string>,
  existentes: ReadonlyArray<string>,
): ReadonlyArray<string> => {
  const vivos: ReadonlyArray<string> = guardado.filter((id: string): boolean =>
    existentes.includes(id),
  )
  const nuevos: ReadonlyArray<string> = existentes.filter((id: string): boolean => !vivos.includes(id))
  if (vivos.length === guardado.length && nuevos.length === 0) return guardado
  return [...vivos, ...nuevos]
}
