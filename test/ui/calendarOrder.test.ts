/**
 * El orden de las rutinas: lo guardado se lee sin fallar y se pone
 * al día con lo que existe, devolviendo la MISMA lista si no hay nada que tocar.
 */

import { test } from "node:test"
import assert from "node:assert/strict"

import type { CalendarOrder } from "#ui/calendarOrder"
import { NO_ORDER, parseCalendarOrder, reconcileOrder } from "#ui/calendarOrder"

test("lo que no tiene forma de orden se lee como el orden vacío", (): void => {
  for (const caso of [null, 3, "x", [], undefined]) {
    assert.strictEqual(parseCalendarOrder(caso), NO_ORDER)
  }
})

test("lo guardado pasa por JSON y vuelve igual", (): void => {
  const orden: CalendarOrder = { routines: ["r1", "r2"], archived: ["r2"] }
  assert.deepEqual(parseCalendarOrder(JSON.parse(JSON.stringify(orden))), orden)
})

test("de las listas se descarta lo que no es texto y lo repetido, sin fallar", (): void => {
  assert.deepEqual(parseCalendarOrder({ routines: ["a", 3, "a", null, "b"], archived: ["b", "b", 7] }), { routines: ["a", "b"], archived: ["b"] })
  assert.deepEqual(parseCalendarOrder({ routines: "no", archived: "no" }), { routines: [], archived: [] })
})

test("un groups de una copia vieja se ignora", (): void => {
  assert.deepEqual(parseCalendarOrder({ groups: ["g1"], routines: ["r1"] }), { routines: ["r1"], archived: [] })
})

test("reconcileOrder: si no sobra ni falta nada, la MISMA lista", (): void => {
  const guardado: ReadonlyArray<string> = ["b", "a"]
  assert.strictEqual(reconcileOrder(guardado, ["a", "b"]), guardado)
})

test("reconcileOrder quita lo que ya no existe y conserva el orden de lo demás", (): void => {
  assert.deepEqual(reconcileOrder(["c", "a", "x", "b"], ["a", "b", "c"]), ["c", "a", "b"])
})

test("reconcileOrder añade al final lo nuevo, en el orden en que llega", (): void => {
  assert.deepEqual(reconcileOrder(["b"], ["a", "b", "c"]), ["b", "a", "c"])
})

test("reconcileOrder sin nada guardado es el orden de lo que existe", (): void => {
  assert.deepEqual(reconcileOrder([], ["a", "b"]), ["a", "b"])
})
