/**
 * Qué enseña el calendario: el mes como rejilla de lunes a domingo con sus días
 * marcados, y los eventos de un día en su orden.
 *
 * Puro, como `windowView`: el DOM sólo lo pinta. «Hoy» y los grupos elegidos
 * llegan de fuera: el core no lee el reloj, y elegir grupos es estado de pantalla.
 */

import type { AppState, CalendarEvent, Day, EventGroup } from "#core/index"
import { compareDays, dayFromParts, groupsOfEvent, monthGrid, partsOf } from "#core/index"
import { SIN_GRUPO } from "./calendarOrder.js"

/** El mes que se mira: el año y el mes de 1 a 12. */
export interface MonthRef {
  readonly year: number
  readonly month: number
}

/** Una casilla de la rejilla. */
export interface DayCell {
  readonly day: Day
  /** El número que se pinta: 1 a 31. */
  readonly number: number
  /** Los días de los meses vecinos completan la primera y la última fila, y salen apagados. */
  readonly inMonth: boolean
  readonly isToday: boolean
  /** Tiene algún evento de los grupos elegidos. */
  readonly marked: boolean
  /** Todos sus eventos están hechos: se marca igual, pero tachado. */
  readonly allDone: boolean
}

export interface MonthView {
  readonly title: string
  readonly weeks: ReadonlyArray<ReadonlyArray<DayCell>>
}

/** Las iniciales de las columnas: la semana empieza en lunes. */
export const WEEKDAYS: ReadonlyArray<string> = ["L", "M", "X", "J", "V", "S", "D"]

const MESES: ReadonlyArray<string> = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
]

export const monthOf = (day: Day): MonthRef => {
  const { year, month } = partsOf(day)
  return { year, month }
}

/**
 * El mes `n` meses después (o antes, si es negativo). `null` si se sale del rango
 * de años del calendario.
 */
export const shiftMonth = (mes: MonthRef, n: number): MonthRef | null => {
  const indice: number = mes.year * 12 + (mes.month - 1) + n
  const year: number = Math.floor(indice / 12)
  const month: number = (((indice % 12) + 12) % 12) + 1
  return dayFromParts(year, month, 1) === null ? null : { year, month }
}

export const sameMonth = (a: MonthRef, b: MonthRef): boolean => a.year === b.year && a.month === b.month

/** «octubre de 2026». */
export const monthTitle = (mes: MonthRef): string => `${MESES[mes.month - 1] ?? ""} de ${mes.year}`

/** «2 de julio de 2026». */
export const dayTitle = (day: Day): string => {
  const { year, month, day: dia } = partsOf(day)
  return `${dia} de ${MESES[month - 1] ?? ""} de ${year}`
}

/**
 * Si un evento cuenta para el mes con esos grupos elegidos. `null` es «todos»,
 * lo que hay hasta que se puedan elegir. Un evento en varios grupos cuenta si
 * cualquiera está elegido, y uno sin grupo cuenta si lo está «Sin grupo».
 */
export const isChosen = (
  state: AppState,
  evento: CalendarEvent,
  elegidos: ReadonlySet<string> | null,
): boolean => {
  if (elegidos === null) return true
  const grupos: ReadonlyArray<EventGroup> = groupsOfEvent(state, evento.id)
  if (grupos.length === 0) return elegidos.has(SIN_GRUPO)
  return grupos.some((g: EventGroup): boolean => elegidos.has(g.id))
}

/**
 * Los eventos de un día: primero los de todo el día, luego por hora, y a igual
 * hora por motivo. Con `elegidos` sólo los de esos grupos; sin él, todos.
 */
export const eventsOfDay = (
  state: AppState,
  day: Day,
  elegidos: ReadonlySet<string> | null = null,
): ReadonlyArray<CalendarEvent> =>
  Object.values<CalendarEvent>(state.events)
    .filter((e: CalendarEvent): boolean => e.day === day && isChosen(state, e, elegidos))
    .sort((a: CalendarEvent, b: CalendarEvent): number => {
      const horas: number = (a.time ?? "").localeCompare(b.time ?? "")
      return horas !== 0 ? horas : a.title.localeCompare(b.title)
    })

/**
 * El mes como rejilla. `null` si el mes se sale del rango del calendario.
 * Se recorren los eventos una vez, no una por casilla.
 */
export const monthView = (
  state: AppState,
  mes: MonthRef,
  hoy: Day | null,
  elegidos: ReadonlySet<string> | null,
): MonthView | null => {
  const rejilla: ReadonlyArray<ReadonlyArray<Day>> | null = monthGrid(mes.year, mes.month)
  if (rejilla === null) return null

  /* Por día: cuántos eventos hay y cuántos sin hacer. */
  const cuentas: Map<Day, { total: number; pendientes: number }> = new Map<
    Day,
    { total: number; pendientes: number }
  >()
  for (const e of Object.values<CalendarEvent>(state.events)) {
    if (!isChosen(state, e, elegidos)) continue
    const cuenta: { total: number; pendientes: number } = cuentas.get(e.day) ?? {
      total: 0,
      pendientes: 0,
    }
    cuenta.total += 1
    if (!e.done) cuenta.pendientes += 1
    cuentas.set(e.day, cuenta)
  }

  return {
    title: monthTitle(mes),
    weeks: rejilla.map(
      (fila: ReadonlyArray<Day>): ReadonlyArray<DayCell> =>
        fila.map((day: Day): DayCell => {
          const cuenta: { total: number; pendientes: number } | undefined = cuentas.get(day)
          return {
            day,
            number: partsOf(day).day,
            inMonth: monthOf(day).year === mes.year && monthOf(day).month === mes.month,
            isToday: hoy !== null && compareDays(day, hoy) === 0,
            marked: cuenta !== undefined,
            allDone: cuenta !== undefined && cuenta.pendientes === 0,
          }
        }),
    ),
  }
}
