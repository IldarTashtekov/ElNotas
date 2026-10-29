/**
 * La lista de rutinas, sin DOM: sus filas en el orden guardado con cómo va la
 * semana de hoy, cuáles pintan el mes, y la semana de hoy de una rutina con sus
 * siete días.
 *
 * El orden es de presentación (`calendarOrder`); aquí sólo se lee y se calcula.
 */

import type { AppState, Day, Routine, WeekProgress } from "#core/index"
import { compareDays, weekProgress } from "#core/index"
import type { CalendarOrder } from "./calendarOrder.js"
import { reconcileOrder } from "./calendarOrder.js"

export interface RoutineRow {
  readonly id: string
  readonly name: string
  readonly archived: boolean
  readonly goal: number | null
  /** Días marcados esta semana; 0 sin «hoy». */
  readonly done: number
  /** Esta semana llega a la meta. */
  readonly met: boolean
}

export interface RoutineList {
  readonly visible: ReadonlyArray<RoutineRow>
  readonly archived: ReadonlyArray<RoutineRow>
}

/** Un día de una semana: marcado o no, y si aún no ha llegado (no se puede marcar). */
export interface WeekCell {
  readonly day: Day
  readonly marked: boolean
  readonly future: boolean
}

export interface WeekRow {
  readonly cells: ReadonlyArray<WeekCell>
  readonly done: number
  readonly goal: number | null
  readonly met: boolean
}

export const routineList = (state: AppState, order: CalendarOrder, hoy: Day | null): RoutineList => {
  const rutinas: ReadonlyArray<Routine> = Object.values<Routine>(state.routines)
  const ids: ReadonlyArray<string> = reconcileOrder(
    order.routines,
    rutinas.map((r: Routine): string => r.id).sort(),
  )
  const filas: ReadonlyArray<RoutineRow> = ids.flatMap((id: string): ReadonlyArray<RoutineRow> => {
    const r: Routine | undefined = state.routines[id as Routine["id"]]
    if (r === undefined) return []
    const semana: WeekProgress | null = hoy === null ? null : weekProgress(r, hoy)
    return [
      {
        id,
        name: r.name,
        archived: r.archived === true,
        goal: r.weeklyGoal ?? null,
        done: semana?.done ?? 0,
        met: semana?.met ?? false,
      },
    ]
  })
  return {
    visible: filas.filter((f: RoutineRow): boolean => !f.archived),
    archived: filas.filter((f: RoutineRow): boolean => f.archived),
  }
}

/** Las rutinas que pintan el mes: las visibles que se han encendido. Las archivadas nunca. */
export const chosenRoutineIds = (
  lista: RoutineList,
  encendidas: ReadonlySet<string>,
): ReadonlySet<string> =>
  new Set<string>(
    lista.visible.map((f: RoutineRow): string => f.id).filter((id: string): boolean => encendidas.has(id)),
  )

/** La semana de `hoy` de una rutina, con sus siete días; `null` si se sale del rango del calendario. */
export const currentWeek = (routine: Routine, hoy: Day): WeekRow | null => {
  const semana: WeekProgress | null = weekProgress(routine, hoy)
  if (semana === null) return null
  return {
    cells: semana.week.map(
      (d: Day): WeekCell => ({
        day: d,
        marked: routine.days.includes(d),
        future: compareDays(d, hoy) > 0,
      }),
    ),
    done: semana.done,
    goal: semana.goal,
    met: semana.met,
  }
}

/** «3/4» con meta, «3» sin ella, y «✓» detrás cuando la semana la cumple. */
export const weekSummary = (done: number, goal: number | null, met: boolean): string =>
  `${goal === null ? done : `${done}/${goal}`}${met ? " ✓" : ""}`

/** Enciende o apaga uno: un conjunto nuevo. */
export const toggleId = (ids: ReadonlySet<string>, id: string): ReadonlySet<string> => {
  const otro: Set<string> = new Set<string>(ids)
  if (otro.has(id)) otro.delete(id)
  else otro.add(id)
  return otro
}

/**
 * El orden que se guarda al mover una fila visible de `de` a `a`: las visibles
 * como quedan, y detrás las archivadas como estaban.
 */
export const movedOrder = (
  visibles: ReadonlyArray<string>,
  archivados: ReadonlyArray<string>,
  de: number,
  a: number,
): ReadonlyArray<string> => {
  const movido: string | undefined = visibles[de]
  if (movido === undefined) return [...visibles, ...archivados]
  const resto: ReadonlyArray<string> = visibles.filter((_: string, i: number): boolean => i !== de)
  return [...resto.slice(0, a), movido, ...resto.slice(a), ...archivados]
}
