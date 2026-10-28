/**
 * La hoja de un evento: lo escrito en los campos se convierte en lo que pide el
 * core, o dice por qué no vale.
 */

import { test } from "node:test"
import assert from "node:assert/strict"

import type { EventFormResult } from "#ui/eventForm"
import { NEW_EVENT_TITLE, parseEventForm } from "#ui/eventForm"

test("un evento con hora y motivo se lee tal cual, sin espacios de más", (): void => {
  const r: EventFormResult = parseEventForm(" 2026-07-02 ", "18:00", "  Cena  ")
  assert.deepEqual(r, { ok: true, input: { day: "2026-07-02", time: "18:00", title: "Cena" } })
})

test("sin hora es de todo el día", (): void => {
  const r: EventFormResult = parseEventForm("2026-07-02", "", "Cena")
  assert.ok(r.ok)
  assert.equal(r.input.time, null)
})

test("sin motivo se llama «Evento»", (): void => {
  const r: EventFormResult = parseEventForm("2026-07-02", "", "   ")
  assert.ok(r.ok)
  assert.equal(r.input.title, NEW_EVENT_TITLE)
})

test("un día que no existe no vale", (): void => {
  for (const dia of ["", "2026-02-30", "02/07/2026", "2026-13-01"]) {
    const r: EventFormResult = parseEventForm(dia, "", "x")
    assert.deepEqual(r, { ok: false, problem: "Pon un día válido." })
  }
})

test("una hora mal escrita no vale, aunque el día sí", (): void => {
  for (const hora of ["25:00", "9:00", "18:60", "tarde"]) {
    const r: EventFormResult = parseEventForm("2026-07-02", hora, "x")
    assert.deepEqual(r, { ok: false, problem: "Pon una hora válida, como 18:00." })
  }
})
