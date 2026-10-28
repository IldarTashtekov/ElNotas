/**
 * Días, horas y cuentas de calendario.
 *
 * Lo que se puede romper en silencio: los años bisiestos (también los de siglo),
 * el cambio de mes y de año, la semana que cruza meses, y los extremos del
 * rango, donde se devuelve `null` en vez de un día inventado.
 */

import { test } from "node:test"
import assert from "node:assert/strict"

import type { Day, Time } from "#core/domain/calendar"
import {
  addDays,
  compareDays,
  daysBetween,
  daysInMonth,
  dayFromParts,
  dayOfWeek,
  isLeapYear,
  monthGrid,
  parseDay,
  parseTime,
  partsOf,
  weekOf,
} from "#core/domain/calendar"

const d = (raw: string): Day => {
  const day: Day | null = parseDay(raw)
  assert.notEqual(day, null, `${raw} debería ser un día válido`)
  return day as Day
}

/* ── Validar ── */

test("parseDay acepta días que existen", () => {
  assert.equal(parseDay("2026-07-02"), "2026-07-02")
  assert.equal(parseDay("2024-02-29"), "2024-02-29")
  assert.equal(parseDay("0001-01-01"), "0001-01-01")
  assert.equal(parseDay("9999-12-31"), "9999-12-31")
})

test("parseDay rechaza lo mal escrito y lo que no existe", () => {
  const malos: ReadonlyArray<string> = [
    "", "2026-7-2", "2026/07/02", "26-07-02", "2026-07-02 ", " 2026-07-02", "2026-07-02T10:00",
    "2026-13-01", "2026-00-10", "2026-04-31", "2026-02-30", "2023-02-29", "1900-02-29",
    "2026-07-00", "0000-01-01", "abcd-ef-gh",
  ]
  for (const raw of malos) assert.equal(parseDay(raw), null, `«${raw}» no es un día`)
})

test("parseTime acepta de 00:00 a 23:59 y nada más", () => {
  assert.equal(parseTime("00:00"), "00:00")
  assert.equal(parseTime("18:05"), "18:05")
  assert.equal(parseTime("23:59"), "23:59")
  for (const raw of ["24:00", "12:60", "9:00", "09:0", "0900", "09:00:00", "", "ab:cd"]) {
    assert.equal(parseTime(raw), null, `«${raw}» no es una hora`)
  }
})

test("una hora válida se puede usar como Time", () => {
  const t: Time | null = parseTime("07:30")
  assert.equal(t, "07:30")
})

test("dayFromParts rechaza lo que no existe y partsOf lo deshace", () => {
  assert.equal(dayFromParts(2026, 2, 30), null)
  assert.equal(dayFromParts(2026, 13, 1), null)
  assert.equal(dayFromParts(2026, 1, 1.5), null)
  assert.equal(dayFromParts(0, 1, 1), null)
  assert.equal(dayFromParts(10000, 1, 1), null)
  assert.deepEqual(partsOf(d("2026-07-02")), { year: 2026, month: 7, day: 2 })
  assert.equal(dayFromParts(2026, 7, 2), "2026-07-02")
})

/* ── Bisiestos ── */

test("los años bisiestos, también los de siglo", () => {
  assert.equal(isLeapYear(2024), true)
  assert.equal(isLeapYear(2026), false)
  assert.equal(isLeapYear(1900), false)
  assert.equal(isLeapYear(2000), true)
  assert.equal(daysInMonth(2024, 2), 29)
  assert.equal(daysInMonth(2026, 2), 28)
  assert.equal(daysInMonth(2026, 4), 30)
  assert.equal(daysInMonth(2026, 12), 31)
})

/* ── Sumar y comparar ── */

test("addDays cruza mes, año y febrero bisiesto", () => {
  assert.equal(addDays(d("2026-07-02"), 0), "2026-07-02")
  assert.equal(addDays(d("2026-01-31"), 1), "2026-02-01")
  assert.equal(addDays(d("2026-12-31"), 1), "2027-01-01")
  assert.equal(addDays(d("2027-01-01"), -1), "2026-12-31")
  assert.equal(addDays(d("2024-02-28"), 1), "2024-02-29")
  assert.equal(addDays(d("2024-02-29"), 1), "2024-03-01")
  assert.equal(addDays(d("2026-02-28"), 1), "2026-03-01")
  assert.equal(addDays(d("2026-07-02"), 365), "2027-07-02")
  assert.equal(addDays(d("2024-01-01"), 366), "2025-01-01")
  assert.equal(addDays(d("1999-12-31"), 1), "2000-01-01")
})

test("addDays fuera del rango devuelve null", () => {
  assert.equal(addDays(d("9999-12-31"), 1), null)
  assert.equal(addDays(d("0001-01-01"), -1), null)
  assert.equal(addDays(d("9999-12-31"), 0), "9999-12-31")
})

test("sumar y volver atrás es la identidad", () => {
  for (const raw of ["2026-07-02", "2024-02-29", "2000-03-01", "1900-12-31", "2026-01-01"]) {
    for (const n of [1, 7, 30, 365, 1000, -1, -59, -4000]) {
      const ida: Day | null = addDays(d(raw), n)
      assert.notEqual(ida, null)
      assert.equal(addDays(ida as Day, -n), raw)
    }
  }
})

test("compareDays ordena como el tiempo, también entre años y meses", () => {
  assert.equal(compareDays(d("2026-07-02"), d("2026-07-02")), 0)
  assert.equal(compareDays(d("2026-07-02"), d("2026-07-03")), -1)
  assert.equal(compareDays(d("2026-12-31"), d("2027-01-01")), -1)
  assert.equal(compareDays(d("2026-10-01"), d("2026-09-30")), 1)
  const mezclados: Day[] = [d("2027-01-01"), d("2026-07-02"), d("2026-07-01"), d("2025-12-31")]
  assert.deepEqual(
    [...mezclados].sort(compareDays),
    [d("2025-12-31"), d("2026-07-01"), d("2026-07-02"), d("2027-01-01")],
  )
})

test("daysBetween cuenta días con signo", () => {
  assert.equal(daysBetween(d("2026-07-02"), d("2026-07-02")), 0)
  assert.equal(daysBetween(d("2026-07-02"), d("2026-07-09")), 7)
  assert.equal(daysBetween(d("2026-07-09"), d("2026-07-02")), -7)
  assert.equal(daysBetween(d("2024-02-28"), d("2024-03-01")), 2)
  assert.equal(daysBetween(d("2026-01-01"), d("2027-01-01")), 365)
  assert.equal(daysBetween(d("2024-01-01"), d("2025-01-01")), 366)
})

/* ── Día de la semana (0 = lunes) ── */

test("dayOfWeek con la semana empezando en lunes", () => {
  assert.equal(dayOfWeek(d("1970-01-01")), 3) // jueves
  assert.equal(dayOfWeek(d("2000-01-01")), 5) // sábado
  assert.equal(dayOfWeek(d("2024-02-29")), 3) // jueves
  assert.equal(dayOfWeek(d("2026-07-02")), 3) // jueves
  assert.equal(dayOfWeek(d("2026-06-29")), 0) // lunes
  assert.equal(dayOfWeek(d("2026-07-05")), 6) // domingo
  assert.equal(dayOfWeek(d("0001-01-01")), 0) // lunes, en el calendario gregoriano
  assert.equal(dayOfWeek(d("9999-12-31")), 4) // viernes
})

/* ── Semanas ── */

test("weekOf devuelve de lunes a domingo, desde cualquier día de la semana", () => {
  const semana: ReadonlyArray<Day> = [
    d("2026-06-29"), d("2026-06-30"), d("2026-07-01"), d("2026-07-02"),
    d("2026-07-03"), d("2026-07-04"), d("2026-07-05"),
  ]
  for (const dia of semana) assert.deepEqual(weekOf(dia), semana)
})

test("weekOf cruza meses y años", () => {
  assert.deepEqual(weekOf(d("2025-12-31")), [
    d("2025-12-29"), d("2025-12-30"), d("2025-12-31"), d("2026-01-01"),
    d("2026-01-02"), d("2026-01-03"), d("2026-01-04"),
  ])
})

test("weekOf fuera del rango devuelve null", () => {
  assert.equal(weekOf(d("9999-12-31")), null)
  assert.notEqual(weekOf(d("0001-01-01")), null)
})

/* ── La rejilla del mes ── */

test("monthGrid de julio de 2026 son cinco filas que empiezan en el lunes anterior", () => {
  const rejilla: ReadonlyArray<ReadonlyArray<Day>> | null = monthGrid(2026, 7)
  assert.notEqual(rejilla, null)
  const filas: ReadonlyArray<ReadonlyArray<Day>> = rejilla as ReadonlyArray<ReadonlyArray<Day>>
  assert.equal(filas.length, 5)
  assert.equal(filas[0]?.[0], "2026-06-29")
  assert.equal(filas[0]?.[2], "2026-07-01")
  assert.equal(filas[4]?.[6], "2026-08-02")
  for (const fila of filas) assert.equal(fila.length, 7)
})

test("monthGrid: cuatro filas si febrero empieza en lunes y no es bisiesto, seis en agosto de 2026", () => {
  assert.equal(monthGrid(2027, 2)?.length, 4)
  assert.equal(monthGrid(2026, 8)?.length, 6)
})

test("monthGrid de febrero de 2024 incluye el 29 y de febrero de 2026 no", () => {
  const bisiesto: ReadonlyArray<ReadonlyArray<Day>> = monthGrid(2024, 2) as ReadonlyArray<ReadonlyArray<Day>>
  assert.ok(bisiesto.flat().includes(d("2024-02-29")))
  const normal: ReadonlyArray<ReadonlyArray<Day>> = monthGrid(2026, 2) as ReadonlyArray<ReadonlyArray<Day>>
  assert.ok(normal.flat().includes(d("2026-02-28")))
  assert.ok(!normal.flat().some((x: Day): boolean => x === "2026-02-29"))
})

test("monthGrid es continua: cada día es el siguiente del anterior, todos los meses de tres años", () => {
  for (let year: number = 2023; year <= 2025; year++) {
    for (let month: number = 1; month <= 12; month++) {
      const dias: ReadonlyArray<Day> = (monthGrid(year, month) as ReadonlyArray<ReadonlyArray<Day>>).flat()
      assert.equal(dayOfWeek(dias[0] as Day), 0)
      assert.equal(dayOfWeek(dias[dias.length - 1] as Day), 6)
      for (let i: number = 1; i < dias.length; i++) {
        assert.equal(addDays(dias[i - 1] as Day, 1), dias[i])
      }
      assert.equal(dias.filter((x: Day): boolean => partsOf(x).month === month).length, daysInMonth(year, month))
    }
  }
})

test("monthGrid con un mes que no existe o fuera del rango devuelve null", () => {
  assert.equal(monthGrid(2026, 0), null)
  assert.equal(monthGrid(2026, 13), null)
  assert.equal(monthGrid(0, 1), null)
  assert.equal(monthGrid(10000, 1), null)
  assert.equal(monthGrid(9999, 12), null)
})
