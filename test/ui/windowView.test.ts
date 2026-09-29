/**
 * Lo que enseña la vista ventanas, calculado sin DOM: título, si se renombra, las
 * notas de cada ventana, y las flechas que no dan la vuelta.
 */

import { test } from "node:test"
import assert from "node:assert/strict"

import type { AppState, Context, ItemRef, Note } from "#core/index"
import { contextId, emptyAppState, noteId, noteRef, revision } from "#core/index"
import type { WindowRef, WindowView, WindowsLayout } from "#ui/index"
import { GENERAL, GENERAL_TITLE, windowView } from "#ui/index"

const nota = (id: string, name: string): Note => ({
  id: noteId(id),
  name,
  content: [],
  updatedAt: 0,
  revision: revision(`rev-${id}`),
})

const contexto = (id: string, name: string, items: ReadonlyArray<ItemRef>): Context => ({
  id: contextId(id),
  name,
  defaultView: { type: "context" },
  items,
  updatedAt: 0,
  revision: revision(`rev-${id}`),
})

const LECHE: Note = nota("leche", "Leche")
const ACEITE: Note = nota("aceite", "Aceite")
const INFORME: Note = nota("informe", "Informe")

const ESTADO: AppState = {
  ...emptyAppState(),
  notes: { [LECHE.id]: LECHE, [ACEITE.id]: ACEITE, [INFORME.id]: INFORME },
  contexts: {
    [contextId("compra")]: contexto("compra", "Compra", [noteRef(LECHE.id), noteRef(ACEITE.id)]),
    [contextId("trabajo")]: contexto("trabajo", "Trabajo", [noteRef(INFORME.id)]),
  },
}

const COMPRA: WindowRef = { kind: "context", id: contextId("compra") }
const TRABAJO: WindowRef = { kind: "context", id: contextId("trabajo") }
const TRES: ReadonlyArray<WindowRef> = [COMPRA, GENERAL, TRABAJO]

const ventanaDe = (layout: WindowsLayout): Extract<WindowView, { kind: "window" }> => {
  const vista: WindowView = windowView(layout, ESTADO)
  if (vista.kind !== "window") assert.fail("tenía que enseñar una ventana")
  return vista
}

const nombres = (notas: ReadonlyArray<Note>): ReadonlyArray<string> =>
  notas.map((n: Note): string => n.name)

test("sin ventana activa, la pantalla vacía", (): void => {
  assert.deepEqual(windowView({ windows: [], active: null }, ESTADO), { kind: "empty" })
})

test("en la primera no hay anterior; en la del medio, las dos; en la última no hay siguiente", (): void => {
  const primera: Extract<WindowView, { kind: "window" }> = ventanaDe({ windows: TRES, active: COMPRA })
  assert.equal(primera.prev, null)
  assert.deepEqual(primera.next, GENERAL)

  const medio: Extract<WindowView, { kind: "window" }> = ventanaDe({ windows: TRES, active: GENERAL })
  assert.deepEqual(medio.prev, COMPRA)
  assert.deepEqual(medio.next, TRABAJO)

  const ultima: Extract<WindowView, { kind: "window" }> = ventanaDe({ windows: TRES, active: TRABAJO })
  assert.deepEqual(ultima.prev, GENERAL)
  assert.equal(ultima.next, null)
})

test("con una sola ventana no hay ninguna flecha", (): void => {
  const sola: Extract<WindowView, { kind: "window" }> = ventanaDe({ windows: [GENERAL], active: GENERAL })
  assert.equal(sola.prev, null)
  assert.equal(sola.next, null)
})

test("un contexto se titula con su nombre y se renombra", (): void => {
  const vista: Extract<WindowView, { kind: "window" }> = ventanaDe({ windows: TRES, active: COMPRA })
  assert.equal(vista.title, "Compra")
  assert.equal(vista.renames, contextId("compra"))
})

test("el General no se renombra", (): void => {
  const vista: Extract<WindowView, { kind: "window" }> = ventanaDe({ windows: TRES, active: GENERAL })
  assert.equal(vista.title, GENERAL_TITLE)
  assert.equal(vista.renames, null)
})

test("un contexto enseña SUS notas, en el orden en que las lista", (): void => {
  const vista: Extract<WindowView, { kind: "window" }> = ventanaDe({ windows: TRES, active: COMPRA })
  assert.deepEqual(nombres(vista.notes), ["Leche", "Aceite"])
})

test("el General enseña TODAS las notas, por nombre", (): void => {
  const vista: Extract<WindowView, { kind: "window" }> = ventanaDe({ windows: TRES, active: GENERAL })
  assert.deepEqual(nombres(vista.notes), ["Aceite", "Informe", "Leche"])
})

test("el General enseña también las notas que no están en ningún contexto", (): void => {
  const huerfana: Note = nota("suelta", "Suelta")
  const estado: AppState = { ...ESTADO, notes: { ...ESTADO.notes, [huerfana.id]: huerfana } }
  const vista: WindowView = windowView({ windows: [GENERAL], active: GENERAL }, estado)
  if (vista.kind !== "window") assert.fail("tenía que enseñar una ventana")
  assert.ok(vista.notes.includes(huerfana))
})

test("una activa que ya no está en la lista enseña la pantalla vacía, no otra", (): void => {
  /* La guarda lo evita, pero si fallara no se enseña una ventana cualquiera. */
  assert.deepEqual(windowView({ windows: [GENERAL], active: COMPRA }, ESTADO), { kind: "empty" })
})

test("una ventana de nota: se titula con la nota, la renombra, y no lleva lista", (): void => {
  const deNota: WindowRef = { kind: "note", id: LECHE.id }
  const vista: Extract<WindowView, { kind: "window" }> = ventanaDe({ windows: [GENERAL, deNota], active: deNota })
  assert.equal(vista.title, "Leche")
  assert.equal(vista.editsNote, LECHE.id)
  assert.equal(vista.renames, null)
  assert.deepEqual(vista.notes, [])
  assert.deepEqual(vista.prev, GENERAL)
})

test("en una ventana de contexto o del General no se edita ninguna nota", (): void => {
  assert.equal(ventanaDe({ windows: TRES, active: COMPRA }).editsNote, null)
  assert.equal(ventanaDe({ windows: TRES, active: GENERAL }).editsNote, null)
})
