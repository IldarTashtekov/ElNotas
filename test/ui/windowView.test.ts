/**
 * Lo que enseña la vista ventanas, calculado sin DOM: título, si se renombra, las
 * notas y diagramas de cada ventana, y las flechas que no dan la vuelta.
 */

import { test } from "node:test"
import assert from "node:assert/strict"

import type { AppState, Context, Diagram, ItemRef, Note } from "#core/index"
import { contextId, diagramId, diagramRef, noteId, noteRef } from "#core/index"
import { emptyAppState } from "#core/domain/AppState"
import { revision } from "#core/domain/Ids"
import type { ListItem, WindowView } from "#ui/windowView"
import type { WindowRef } from "#ui/windows"
import type { WindowsLayout } from "#ui/index"
import { GENERAL } from "#ui/windows"
import { GENERAL_TITLE, windowView } from "#ui/windowView"

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

const nombres = (items: ReadonlyArray<ListItem>): ReadonlyArray<string> =>
  items.map((i: ListItem): string => i.name)

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
  assert.deepEqual(nombres(vista.items), ["Leche", "Aceite"])
})

test("el General enseña TODAS las notas, por nombre", (): void => {
  const vista: Extract<WindowView, { kind: "window" }> = ventanaDe({ windows: TRES, active: GENERAL })
  assert.deepEqual(nombres(vista.items), ["Aceite", "Informe", "Leche"])
})

test("el General enseña también las notas que no están en ningún contexto", (): void => {
  const huerfana: Note = nota("suelta", "Suelta")
  const estado: AppState = { ...ESTADO, notes: { ...ESTADO.notes, [huerfana.id]: huerfana } }
  const vista: WindowView = windowView({ windows: [GENERAL], active: GENERAL }, estado)
  if (vista.kind !== "window") assert.fail("tenía que enseñar una ventana")
  assert.ok(nombres(vista.items).includes("Suelta"))
})

/** Compra, con Aceite oculto. */
const CON_OCULTO: AppState = {
  ...ESTADO,
  contexts: {
    ...ESTADO.contexts,
    [contextId("compra")]: {
      ...contexto("compra", "Compra", [noteRef(LECHE.id), noteRef(ACEITE.id), noteRef(INFORME.id)]),
      hidden: [noteRef(INFORME.id), noteRef(ACEITE.id)],
    },
  },
}

const vistaCon = (estado: AppState, activa: WindowRef): Extract<WindowView, { kind: "window" }> => {
  const vista: WindowView = windowView({ windows: TRES, active: activa }, estado)
  if (vista.kind !== "window") assert.fail("tenía que enseñar una ventana")
  return vista
}

test("lo oculto de un contexto no sale en su lista, y se enseña aparte en el orden de la lista", (): void => {
  const vista: Extract<WindowView, { kind: "window" }> = vistaCon(CON_OCULTO, COMPRA)
  assert.deepEqual(nombres(vista.items), ["Leche"])
  assert.deepEqual(nombres(vista.hidden), ["Aceite", "Informe"])
})

test("el General lo enseña todo, también lo oculto en un contexto", (): void => {
  const vista: Extract<WindowView, { kind: "window" }> = vistaCon(CON_OCULTO, GENERAL)
  assert.deepEqual(nombres(vista.items), ["Aceite", "Informe", "Leche"])
  assert.deepEqual(vista.hidden, [])
})

test("lo oculto en un contexto se ve en otro que lo tenga sin ocultar", (): void => {
  const vista: Extract<WindowView, { kind: "window" }> = vistaCon(CON_OCULTO, TRABAJO)
  assert.deepEqual(nombres(vista.items), ["Informe"])
  assert.deepEqual(vista.hidden, [])
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
  assert.deepEqual(vista.items, [])
  assert.deepEqual(vista.prev, GENERAL)
})

test("en una ventana de contexto o del General no se edita ninguna nota", (): void => {
  assert.equal(ventanaDe({ windows: TRES, active: COMPRA }).editsNote, null)
  assert.equal(ventanaDe({ windows: TRES, active: GENERAL }).editsNote, null)
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

const BODA: Diagram = diagrama("boda", "Boda")
const MUDANZA: Diagram = diagrama("mudanza", "Mudanza")

/** Compra lista Leche, Mudanza y Aceite, en ese orden; Boda no está en ningún contexto. */
const CON_DIAGRAMAS: AppState = {
  ...ESTADO,
  diagrams: { [BODA.id]: BODA, [MUDANZA.id]: MUDANZA },
  contexts: {
    ...ESTADO.contexts,
    [contextId("compra")]: contexto("compra", "Compra", [
      noteRef(LECHE.id),
      diagramRef(MUDANZA.id),
      noteRef(ACEITE.id),
    ]),
  },
}

const ventanaCon = (estado: AppState, activa: WindowRef): Extract<WindowView, { kind: "window" }> => {
  const vista: WindowView = windowView({ windows: TRES, active: activa }, estado)
  if (vista.kind !== "window") assert.fail("tenía que enseñar una ventana")
  return vista
}

test("un contexto enseña sus diagramas entre sus notas, en el orden en que los lista", (): void => {
  const vista: Extract<WindowView, { kind: "window" }> = ventanaCon(CON_DIAGRAMAS, COMPRA)
  assert.deepEqual(nombres(vista.items), ["Leche", "Mudanza", "Aceite"])
  assert.deepEqual(vista.items[1]?.ref, diagramRef(MUDANZA.id))
})

test("el General enseña notas y diagramas mezclados por nombre, también los que no están en ningún contexto", (): void => {
  const vista: Extract<WindowView, { kind: "window" }> = ventanaCon(CON_DIAGRAMAS, GENERAL)
  assert.deepEqual(nombres(vista.items), ["Aceite", "Boda", "Informe", "Leche", "Mudanza"])
})

test("una referencia a un diagrama que no está en el estado no se enseña", (): void => {
  const estado: AppState = {
    ...CON_DIAGRAMAS,
    contexts: {
      ...CON_DIAGRAMAS.contexts,
      [contextId("compra")]: contexto("compra", "Compra", [diagramRef(diagramId("ilegible"))]),
    },
  }
  assert.deepEqual(ventanaCon(estado, COMPRA).items, [])
})

test("una ventana de diagrama: se titula con el diagrama, lo renombra, y no lleva lista", (): void => {
  const deDiagrama: WindowRef = { kind: "diagram", id: MUDANZA.id }
  const vista: WindowView = windowView({ windows: [GENERAL, deDiagrama], active: deDiagrama }, CON_DIAGRAMAS)
  if (vista.kind !== "window") assert.fail("tenía que enseñar una ventana")
  assert.equal(vista.title, "Mudanza")
  assert.equal(vista.editsDiagram, MUDANZA.id)
  assert.equal(vista.editsNote, null)
  assert.equal(vista.renames, null)
  assert.deepEqual(vista.items, [])
})

test("en una ventana que no es de diagrama no se enseña ninguno", (): void => {
  assert.equal(ventanaCon(CON_DIAGRAMAS, COMPRA).editsDiagram, null)
  assert.equal(ventanaCon(CON_DIAGRAMAS, GENERAL).editsDiagram, null)
})

test("una ventana de diagrama que ya no existe enseña la pantalla vacía", (): void => {
  const fantasma: WindowRef = { kind: "diagram", id: diagramId("fantasma") }
  assert.deepEqual(windowView({ windows: [fantasma], active: fantasma }, CON_DIAGRAMAS), { kind: "empty" })
})

test("la ventana del calendario: se titula «Calendario», no se renombra, no lleva lista y lo dice", (): void => {
  const deCalendario: WindowRef = { kind: "calendar" }
  const vista: WindowView = windowView({ windows: [GENERAL, deCalendario], active: deCalendario }, ESTADO)
  if (vista.kind !== "window") assert.fail("tenía que enseñar una ventana")
  assert.equal(vista.title, "Calendario")
  assert.equal(vista.showsCalendar, true)
  assert.equal(vista.renames, null)
  assert.equal(vista.editsNote, null)
  assert.equal(vista.editsDiagram, null)
  assert.deepEqual(vista.items, [])
  assert.equal(vista.prev, GENERAL)
  assert.equal(vista.next, null)
})

test("en una ventana que no es la del calendario no se enseña el calendario", (): void => {
  assert.equal(ventanaDe({ windows: TRES, active: GENERAL }).showsCalendar, false)
  assert.equal(ventanaDe({ windows: TRES, active: COMPRA }).showsCalendar, false)
})
