/**
 * Lo que enseña la vista configuración, sin DOM.
 */

import { test } from "node:test"
import assert from "node:assert/strict"

import type { AppState, Context, Note } from "#core/index"
import { contextId, emptyAppState, noteId, revision } from "#core/index"
import type { SettingsContent, WindowRef, WindowRow } from "#ui/index"
import { GENERAL, GENERAL_TITLE, addWindowChoices, settingsContent } from "#ui/index"

const contexto = (id: string, name: string): Context => ({
  id: contextId(id),
  name,
  defaultView: { type: "context" },
  items: [],
  updatedAt: 0,
  revision: revision(`rev-${id}`),
})

const nota = (id: string, name: string): Note => ({
  id: noteId(id),
  name,
  content: [],
  updatedAt: 0,
  revision: revision(`rev-${id}`),
})

const ESTADO: AppState = {
  ...emptyAppState(),
  notes: {
    [noteId("n2")]: nota("n2", "Recetas"),
    [noteId("n1")]: nota("n1", "Diario"),
  },
  contexts: {
    [contextId("t")]: contexto("t", "Trabajo"),
    [contextId("c")]: contexto("c", "Compra"),
    [contextId("s")]: contexto("s", "Sin ventana"),
  },
}

const TRABAJO: WindowRef = { kind: "context", id: contextId("t") }

const titulos = (filas: ReadonlyArray<WindowRow>): ReadonlyArray<string> =>
  filas.map((f: WindowRow): string => f.title)

const CONTENIDO: SettingsContent = settingsContent({ windows: [TRABAJO, GENERAL], active: GENERAL }, ESTADO)

test("las ventanas salen en su orden, con su título", (): void => {
  assert.deepEqual(titulos(CONTENIDO.windows), ["Trabajo", GENERAL_TITLE])
})

test("los contextos salen TODOS, estén o no en una ventana, por nombre", (): void => {
  assert.deepEqual(
    CONTENIDO.contexts.map((c: Context): string => c.name),
    ["Compra", "Sin ventana", "Trabajo"],
  )
})

test("se puede elegir el General, cada contexto y cada nota: en ese orden, y por nombre", (): void => {
  assert.deepEqual(titulos(CONTENIDO.choices), [
    GENERAL_TITLE,
    "Compra",
    "Sin ventana",
    "Trabajo",
    "Diario",
    "Recetas",
  ])
})

test("una ventana de nota sale en la lista con el nombre de la nota", (): void => {
  const deNota: WindowRef = { kind: "note", id: noteId("n1") }
  const contenido: SettingsContent = settingsContent({ windows: [deNota], active: deNota }, ESTADO)
  assert.deepEqual(titulos(contenido.windows), ["Diario"])
})

/* ── El «+» de la última ventana ── */

test("el «+» ofrece lo que NO tiene ventana: sin el General ni Trabajo, que ya la tienen", (): void => {
  const filas: ReadonlyArray<WindowRow> = addWindowChoices({ windows: [TRABAJO, GENERAL], active: GENERAL }, ESTADO)
  assert.deepEqual(titulos(filas), ["Compra", "Sin ventana", "Diario", "Recetas"])
})

test("el «+» esconde también una nota que ya es ventana, y ofrece el General si no lo es", (): void => {
  const deNota: WindowRef = { kind: "note", id: noteId("n1") }
  const filas: ReadonlyArray<WindowRow> = addWindowChoices({ windows: [deNota], active: deNota }, ESTADO)
  assert.deepEqual(titulos(filas), [GENERAL_TITLE, "Compra", "Sin ventana", "Trabajo", "Recetas"])
})

test("con todo en ventanas, el «+» no ofrece nada", (): void => {
  const todas: ReadonlyArray<WindowRef> = settingsContent({ windows: [], active: null }, ESTADO).choices.map(
    (f: WindowRow): WindowRef => f.ref,
  )
  const filas: ReadonlyArray<WindowRow> = addWindowChoices({ windows: todas, active: GENERAL }, ESTADO)
  assert.deepEqual(titulos(filas), [])
})
