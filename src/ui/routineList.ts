/**
 * La lista de rutinas, sin DOM: sus filas en el orden guardado con cómo va la
 * semana de hoy, cuál pinta el mes, la semana de hoy de una rutina con sus
 * siete días y la cabecera de la tabla.
 *
 * El orden y qué rutinas están archivadas son de presentación (`calendarOrder`); aquí sólo se lee y se calcula.
 */

import type { AppState, Day, Routine, WeekProgress } from "#core/index"
import { compareDays, weekProgress } from "#core/index"
import type { CalendarOrder } from "./calendarOrder.js"
import { reconcileOrder } from "./calendarOrder.js"
import { WEEKDAYS } from "./calendarMonth.js"

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
        archived: order.archived.includes(id),
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

/** La rutina tocada pinta el mes si sigue entre las visibles; las archivadas nunca. */
export const touchedRoutineIds = (lista: RoutineList, tocada: string | null): ReadonlySet<string> =>
  new Set<string>(lista.visible.map((f: RoutineRow): string => f.id).filter((id: string): boolean => id === tocada))

/** Lo que dice la cabecera de una columna de la tabla. */
export interface WeekHeading {
  readonly initial: string
  readonly number: number
  readonly today: boolean
}

/** La cabecera de la tabla: inicial y número de cada día de la semana, con hoy señalado. */
export const weekHeadings = (semana: WeekRow, hoy: Day): ReadonlyArray<WeekHeading> =>
  semana.cells.map(
    (c: WeekCell, i: number): WeekHeading => ({
      initial: WEEKDAYS[i] ?? "",
      number: Number(c.day.slice(8)),
      today: c.day === hoy,
    }),
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
