/**
 * Lo que enseña la vista configuración, sin DOM.
 */

import { test } from "node:test"
import assert from "node:assert/strict"

import type { AppState, Context } from "#core/index"
import { contextId, emptyAppState, revision } from "#core/index"
import type { SettingsContent, WindowRef, WindowRow } from "#ui/index"
import { GENERAL, GENERAL_TITLE, settingsContent } from "#ui/index"

const contexto = (id: string, name: string): Context => ({
  id: contextId(id),
  name,
  defaultView: { type: "context" },
  items: [],
  updatedAt: 0,
  revision: revision(`rev-${id}`),
})

const ESTADO: AppState = {
  ...emptyAppState(),
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

test("se puede elegir el General y cada contexto, el General primero", (): void => {
  assert.deepEqual(titulos(CONTENIDO.choices), [GENERAL_TITLE, "Compra", "Sin ventana", "Trabajo"])
})
