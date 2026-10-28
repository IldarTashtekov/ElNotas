/**
 * La lista de rutinas, sin DOM: sus filas en el orden guardado con cómo va la
 * semana de hoy, cuáles pintan el mes, y las semanas de una rutina de la actual
 * hacia atrás, con sus siete días.
 *
 * El orden es de presentación (`calendarOrder`); aquí sólo se lee y se calcula.
 */

import type { AppState, Day, Routine, WeekProgress } from "#core/index"
import { addDays, compareDays, partsOf, weekProgress } from "#core/index"
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
  /** El lunes. */
  readonly first: Day
  readonly cells: ReadonlyArray<WeekCell>
  readonly done: number
  readonly goal: number | null
  readonly met: boolean
  readonly current: boolean
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

/**
 * Las `cuantas` últimas semanas de una rutina, la de hoy primero y hacia atrás.
 * Se corta si la semana se sale del rango del calendario.
 */
export const weekRows = (routine: Routine, hoy: Day, cuantas: number): ReadonlyArray<WeekRow> => {
  const filas: WeekRow[] = []
  let dia: Day = hoy
  for (let i: number = 0; i < cuantas; i += 1) {
    const semana: WeekProgress | null = weekProgress(routine, dia)
    const lunes: Day | undefined = semana?.week[0]
    if (semana === null || lunes === undefined) break
    filas.push({
      first: lunes,
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
      current: i === 0,
    })
    const anterior: Day | null = addDays(lunes, -7)
    if (anterior === null) break
    dia = anterior
  }
  return filas
}

/** «22/6»: el día y el mes, para rotular una semana por su lunes. */
export const shortDay = (day: Day): string => {
  const { month, day: dia } = partsOf(day)
  return `${dia}/${month}`
}

/** «3/4» con meta, «3» sin ella, y «✓» detrás cuando la semana la cumple. */
export const weekSummary = (done: number, goal: number | null, met: boolean): string =>
  `${goal === null ? done : `${done}/${goal}`}${met ? " ✓" : ""}`
