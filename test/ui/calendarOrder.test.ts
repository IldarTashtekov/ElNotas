/**
 * El orden de los grupos y las rutinas: lo guardado se lee sin fallar y se pone
 * al día con lo que existe, devolviendo la MISMA lista si no hay nada que tocar.
 */

import { test } from "node:test"
import assert from "node:assert/strict"

import type { CalendarOrder } from "#ui/calendarOrder"
import { NO_ORDER, SIN_GRUPO, parseCalendarOrder, reconcileOrder } from "#ui/calendarOrder"

test("lo que no tiene forma de orden se lee como el orden vacío", (): void => {
  for (const caso of [null, 3, "x", [], undefined]) {
    assert.strictEqual(parseCalendarOrder(caso), NO_ORDER)
  }
})

test("lo guardado pasa por JSON y vuelve igual", (): void => {
  const orden: CalendarOrder = { groups: ["g2", SIN_GRUPO, "g1"], routines: ["r1"] }
  assert.deepEqual(parseCalendarOrder(JSON.parse(JSON.stringify(orden))), orden)
})

test("de las listas se descarta lo que no es texto y lo repetido, sin fallar", (): void => {
  assert.deepEqual(parseCalendarOrder({ groups: ["a", 3, "a", null, "b"], routines: "no" }), {
    groups: ["a", "b"],
    routines: [],
  })
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

test("«Sin grupo» se mueve como cualquier otro elemento", (): void => {
  assert.deepEqual(reconcileOrder([SIN_GRUPO, "g1"], [SIN_GRUPO, "g1", "g2"]), [SIN_GRUPO, "g1", "g2"])
})
