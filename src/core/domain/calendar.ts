/**
 * Días y horas del calendario, y las cuentas de calendario.
 *
 * Un `Day` es un día del calendario, no un instante: el texto `2026-07-02`, que
 * no se mueve con la zona horaria ni con el horario de verano y se ordena como
 * texto. Un `Time` es una hora del reloj de pared, `18:00`. Las cuentas son
 * aritmética entera sobre el calendario gregoriano: ni `Date` ni zona. «Hoy» lo
 * calcula la plataforma y lo pasa; aquí no se lee el reloj.
 *
 * El rango válido es del año 1 al 9999. Lo que se sale de él (sumar días al
 * 9999-12-31, la semana del 0001-01-01) no existe, y las funciones lo devuelven
 * como `null`.
 */

declare const brand: unique symbol

type Branded<T, B extends string> = T & { readonly [brand]: B }

export type Day = Branded<string, "Day">
export type Time = Branded<string, "Time">

/** Año, mes (1 a 12) y día del mes (1 a 31) de un `Day`. */
export interface DayParts {
  readonly year: number
  readonly month: number
  readonly day: number
}

const MIN_YEAR: number = 1
const MAX_YEAR: number = 9999

export const isLeapYear = (year: number): boolean =>
  (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0

/** Los días de un mes (1 a 12), con febrero bisiesto cuando toca. */
export const daysInMonth = (year: number, month: number): number => {
  if (month === 2) return isLeapYear(year) ? 29 : 28
  return month === 4 || month === 6 || month === 9 || month === 11 ? 30 : 31
}

const pad = (n: number, width: number): string => String(n).padStart(width, "0")

/* ── Construir y leer ── */

/** El `Day` de un año, un mes y un día, o `null` si ese día no existe (30 de febrero, mes 13…). */
export const dayFromParts = (year: number, month: number, day: number): Day | null => {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null
  if (year < MIN_YEAR || year > MAX_YEAR || month < 1 || month > 12) return null
  if (day < 1 || day > daysInMonth(year, month)) return null
  return `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}` as Day
}

/** Valida un texto leído de fuera: `AAAA-MM-DD` y un día que exista; si no, `null`. */
export const parseDay = (raw: string): Day | null => {
  const m: RegExpExecArray | null = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw)
  if (m === null) return null
  return dayFromParts(Number(m[1]), Number(m[2]), Number(m[3]))
}

/** Valida una hora `HH:MM` de 00:00 a 23:59; si no, `null`. */
export const parseTime = (raw: string): Time | null => {
  const m: RegExpExecArray | null = /^(\d{2}):(\d{2})$/.exec(raw)
  if (m === null) return null
  return Number(m[1]) <= 23 && Number(m[2]) <= 59 ? (raw as Time) : null
}

export const partsOf = (day: Day): DayParts => ({
  year: Number(day.slice(0, 4)),
  month: Number(day.slice(5, 7)),
  day: Number(day.slice(8, 10)),
})

/* ── Aritmética: días desde 1970-01-01 (algoritmo de Hinnant, sin Date) ── */

const ordinalOf = (day: Day): number => {
  const p: DayParts = partsOf(day)
  const y: number = p.month <= 2 ? p.year - 1 : p.year
  const era: number = Math.floor(y / 400)
  const yoe: number = y - era * 400
  const doy: number = Math.floor((153 * (p.month + (p.month > 2 ? -3 : 9)) + 2) / 5) + p.day - 1
  const doe: number = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy
  return era * 146097 + doe - 719468
}

const dayOfOrdinal = (ordinal: number): Day | null => {
  const z: number = ordinal + 719468
  const era: number = Math.floor(z / 146097)
  const doe: number = z - era * 146097
  const yoe: number = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365)
  const doy: number = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100))
  const mp: number = Math.floor((5 * doy + 2) / 153)
  const day: number = doy - Math.floor((153 * mp + 2) / 5) + 1
  const month: number = mp < 10 ? mp + 3 : mp - 9
  const year: number = yoe + era * 400 + (month <= 2 ? 1 : 0)
  return dayFromParts(year, month, day)
}

/** El día `n` días después (o antes, si `n` es negativo); `null` si cae fuera del rango. */
export const addDays = (day: Day, n: number): Day | null => dayOfOrdinal(ordinalOf(day) + n)

/** Negativo si `a` es anterior a `b`, 0 si son el mismo, positivo si es posterior. */
export const compareDays = (a: Day, b: Day): number => (a < b ? -1 : a > b ? 1 : 0)

/** Días de `from` a `to`: positivo si `to` es posterior. */
export const daysBetween = (from: Day, to: Day): number => ordinalOf(to) - ordinalOf(from)

/** Día de la semana con la semana empezando en lunes: 0 = lunes … 6 = domingo. */
export const dayOfWeek = (day: Day): number => (((ordinalOf(day) + 3) % 7) + 7) % 7

/* ── Semanas y meses ── */

/** Los siete días de la semana (lunes a domingo) que contiene `day`; `null` si alguno se sale del rango. */
export const weekOf = (day: Day): ReadonlyArray<Day> | null => {
  const monday: number = ordinalOf(day) - dayOfWeek(day)
  const week: Day[] = []
  for (let i: number = 0; i < 7; i++) {
    const d: Day | null = dayOfOrdinal(monday + i)
    if (d === null) return null
    week.push(d)
  }
  return week
}

/**
 * La rejilla de un mes (1 a 12): filas de lunes a domingo, con los días de los
 * meses vecinos que completan la primera y la última. `null` si el mes no existe
 * o la rejilla se sale del rango.
 */
export const monthGrid = (year: number, month: number): ReadonlyArray<ReadonlyArray<Day>> | null => {
  const first: Day | null = dayFromParts(year, month, 1)
  const last: Day | null = dayFromParts(year, month, daysInMonth(year, month))
  if (first === null || last === null) return null
  const start: number = ordinalOf(first) - dayOfWeek(first)
  const end: number = ordinalOf(last) + (6 - dayOfWeek(last))
  const weeks: Day[][] = []
  for (let from: number = start; from <= end; from += 7) {
    const row: Day[] = []
    for (let i: number = 0; i < 7; i++) {
      const d: Day | null = dayOfOrdinal(from + i)
      if (d === null) return null
      row.push(d)
    }
    weeks.push(row)
  }
  return weeks
}
