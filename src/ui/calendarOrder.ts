/**
 * El orden en que se enseñan los grupos de eventos y las rutinas: una
 * presentación de este dispositivo, no parte del modelo.
 *
 * Son dos listas de ids. La de grupos puede llevar `SIN_GRUPO`, el elemento
 * fijo que se puede mover como cualquier otro. Lo guardado puede nombrar lo que
 * ya no existe o no nombrar lo recién creado: `reconcileOrder` lo pone al día.
 */

import type { Result, StorageError } from "#core/index"

/** El id reservado de «Sin grupo» en la lista de grupos: no es el de ningún grupo. */
export const SIN_GRUPO: string = "@sin-grupo"

export interface CalendarOrder {
  readonly groups: ReadonlyArray<string>
  readonly routines: ReadonlyArray<string>
}

export const NO_ORDER: CalendarOrder = { groups: [], routines: [] }

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

/** Lo guardado → el orden. Lo que no tenga forma se descarta, sin fallar. */
export const parseCalendarOrder = (guardado: unknown): CalendarOrder => {
  if (typeof guardado !== "object" || guardado === null || Array.isArray(guardado)) return NO_ORDER
  const registro: Record<string, unknown> = guardado as Record<string, unknown>
  return { groups: leerIds(registro["groups"]), routines: leerIds(registro["routines"]) }
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
