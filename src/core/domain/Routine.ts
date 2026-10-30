import type { Day } from "./calendar.js"
import { compareDays, weekOf } from "./calendar.js"
import type { RoutineId } from "./Ids.js"
import type { Versioned } from "./Versioned.js"

/**
 * Un hábito que se marca día a día: su nombre y los días cumplidos.
 *
 * Los días van ordenados y sin repetir, para leerse y compararse como texto. La
 * meta semanal, de 1 a 7, es opcional: sin ella ninguna semana «cumple». Si una
 * semana cumple no se guarda: es un cálculo (`weekProgress`).
 */
export interface Routine extends Versioned {
  readonly id: RoutineId
  readonly name: string
  readonly days: ReadonlyArray<Day>
  readonly weeklyGoal?: number
}

/** Una meta semanal válida: un entero de 1 a 7. */
export const isWeeklyGoal = (n: number): boolean => Number.isInteger(n) && n >= 1 && n <= 7

/** Los días con `day` puesto o quitado, ordenados; los mismos `days` si ya estaba así. */
export const withDay = (days: ReadonlyArray<Day>, day: Day, done: boolean): ReadonlyArray<Day> => {
  const esta: boolean = days.includes(day)
  if (esta === done) return days
  return done
    ? [...days, day].sort(compareDays)
    : days.filter((d: Day): boolean => d !== day)
}

/** Cómo va la semana (de lunes a domingo) que contiene un día. */
export interface WeekProgress {
  readonly week: ReadonlyArray<Day>
  /** Días de la semana marcados. */
  readonly done: number
  readonly goal: number | null
  /** Con meta, que `done` llegue a ella; sin meta, nunca. */
  readonly met: boolean
}

/**
 * La semana de `day`, cuántos de sus siete días están marcados y si llegan a la
 * meta. La semana cuenta sus siete días aunque cruce de mes. `null` si la semana
 * se sale del rango del calendario.
 */
export const weekProgress = (routine: Routine, day: Day): WeekProgress | null => {
  const week: ReadonlyArray<Day> | null = weekOf(day)
  if (week === null) return null
  const done: number = week.filter((d: Day): boolean => routine.days.includes(d)).length
  const goal: number | null = routine.weeklyGoal ?? null
  return { week, done, goal, met: goal !== null && done >= goal }
}
