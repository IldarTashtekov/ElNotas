/**
 * Los nombres de las fechas en los dos idiomas: el mes con su año, el día
 * entero, el día corto de las gráficas y las iniciales de la semana.
 */

import { afterEach, test } from "node:test"
import assert from "node:assert/strict"

import { fullDateName, monthYearName, shortDateName, weekdayInitials } from "#ui/dateNames"
import { en } from "#ui/textos/en"
import { es } from "#ui/textos/es"
import { usarIdioma } from "#ui/textos/idioma"

/* El idioma es de todo el proceso: cada prueba deja el de partida. */
afterEach((): void => {
  usarIdioma(es)
})

test("en español, el mes y el día van en minúscula y con «de»", (): void => {
  usarIdioma(es)
  assert.equal(monthYearName(2026, 11), "noviembre de 2026")
  assert.equal(fullDateName(2026, 11, 8), "8 de noviembre de 2026")
  assert.equal(shortDateName(11, 8), "8/11")
})

test("en inglés, el mes va delante del día", (): void => {
  usarIdioma(en)
  assert.equal(monthYearName(2026, 11), "November 2026")
  assert.equal(fullDateName(2026, 11, 8), "November 8, 2026")
  assert.equal(shortDateName(11, 8), "11/8")
})

test("la semana empieza en lunes en los dos idiomas", (): void => {
  usarIdioma(es)
  assert.deepEqual(weekdayInitials(), ["L", "M", "X", "J", "V", "S", "D"])
  usarIdioma(en)
  assert.deepEqual(weekdayInitials(), ["M", "T", "W", "T", "F", "S", "S"])
})

test("el día es el pedido, sin correrse por la zona horaria", (): void => {
  /* Al oeste de Greenwich, la medianoche en UTC aún es el día anterior. */
  const antes: string | undefined = process.env["TZ"]
  process.env["TZ"] = "America/Los_Angeles"
  try {
    assert.equal(fullDateName(2026, 1, 1), "1 de enero de 2026")
    assert.equal(fullDateName(2026, 12, 31), "31 de diciembre de 2026")
    assert.deepEqual(weekdayInitials(), ["L", "M", "X", "J", "V", "S", "D"])
  } finally {
    if (antes === undefined) delete process.env["TZ"]
    else process.env["TZ"] = antes
  }
})
