/**
 * Lo que enseña la vista configuración, sin DOM.
 */

import { test } from "node:test"
import assert from "node:assert/strict"

import type { AppState, Context, Diagram, Note } from "#core/index"
import { contextId, diagramId, emptyAppState, noteId, revision } from "#core/index"
import type { SettingsContent, WindowRef, WindowRow } from "#ui/index"
import {
  GENERAL,
  GENERAL_TITLE,
  addWindowChoices,
  choiceGroupLabel,
  resetQuestion,
  settingsContent,
  versionLine,
} from "#ui/index"

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

/* ──────────────────────────────── Diagramas ──────────────────────────────── */

const diagrama = (id: string, name: string): Diagram => ({
  id: diagramId(id),
  name,
  nodes: {},
  relations: {},
  updatedAt: 0,
  revision: revision(`rev-${id}`),
})

const CON_DIAGRAMAS: AppState = {
  ...ESTADO,
  diagrams: {
    [diagramId("d2")]: diagrama("d2", "Mudanza"),
    [diagramId("d1")]: diagrama("d1", "Boda"),
  },
}

test("los diagramas se pueden elegir como ventana: detrás de las notas, por nombre", (): void => {
  const opciones: ReadonlyArray<WindowRow> = settingsContent({ windows: [], active: null }, CON_DIAGRAMAS).choices
  assert.deepEqual(titulos(opciones).slice(-4), ["Diario", "Recetas", "Boda", "Mudanza"])
  assert.equal(opciones[opciones.length - 1]?.ref.kind, "diagram")
})

test("el «+» no ofrece un diagrama que ya está en una ventana", (): void => {
  const enVentana: WindowRef = { kind: "diagram", id: diagramId("d1") }
  const opciones: ReadonlyArray<WindowRow> = addWindowChoices({ windows: [enVentana], active: enVentana }, CON_DIAGRAMAS)
  assert.ok(!titulos(opciones).includes("Boda"))
  assert.ok(titulos(opciones).includes("Mudanza"))
})

test("los rótulos: «Notas:» ante la primera nota y «Diagramas:» ante el primer diagrama, y en nada más", (): void => {
  const opciones: ReadonlyArray<WindowRow> = settingsContent({ windows: [], active: null }, CON_DIAGRAMAS).choices
  const rotulos: ReadonlyArray<string> = opciones.flatMap((o: WindowRow, i: number): ReadonlyArray<string> => {
    const r: string | null = choiceGroupLabel(opciones, i)
    return r === null ? [] : [`${r} ${o.title}`]
  })
  assert.deepEqual(rotulos, ["Notas: Diario", "Diagramas: Boda"])
})

test("sin notas, el rótulo de diagramas va igual ante el primero; fuera de la lista, ninguno", (): void => {
  const sinNotas: AppState = { ...CON_DIAGRAMAS, notes: {} }
  const opciones: ReadonlyArray<WindowRow> = settingsContent({ windows: [], active: null }, sinNotas).choices
  const primero: number = opciones.findIndex((o: WindowRow): boolean => o.ref.kind === "diagram")
  assert.equal(choiceGroupLabel(opciones, primero), "Diagramas:")
  assert.equal(choiceGroupLabel(opciones, 0), null)
  assert.equal(choiceGroupLabel(opciones, opciones.length), null)
})

/* ─────────────────────────── La pregunta de «Borrar todo» ─────────────────── */

test("la pregunta de borrar todo cuenta notas, diagramas y contextos", (): void => {
  /* CON_DIAGRAMAS: 2 notas, 2 diagramas y 3 contextos. */
  assert.equal(
    resetQuestion(CON_DIAGRAMAS),
    "¿Borrar 2 notas, 2 diagramas y 3 contextos, y las ventanas? No se puede deshacer.",
  )
})

test("lo que no hay no se nombra, y uno va en singular", (): void => {
  const una: AppState = { ...emptyAppState(), notes: { [noteId("n1")]: nota("n1", "Diario") } }
  assert.equal(resetQuestion(una), "¿Borrar 1 nota, y las ventanas? No se puede deshacer.")
  const dos: AppState = { ...una, contexts: { [contextId("c")]: contexto("c", "Compra") } }
  assert.equal(resetQuestion(dos), "¿Borrar 1 nota y 1 contexto, y las ventanas? No se puede deshacer.")
})

test("sin nada guardado, lo dice", (): void => {
  assert.equal(resetQuestion(emptyAppState()), "¿Dejar la app en blanco? No hay nada guardado.")
})

test("la versión publicada se enseña tal cual la escribe el script", (): void => {
  assert.equal(versionLine("2026-10-09 · 2896c632"), "Versión 2026-10-09 · 2896c632")
})

test("sin versión es que se está en desarrollo, y lo dice", (): void => {
  assert.equal(versionLine(null), "Versión de desarrollo")
})
