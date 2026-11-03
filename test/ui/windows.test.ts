/**
 * La guarda de ventanas y la lectura de lo guardado: funciones puras, sin DOM.
 *
 * Las de identidad van con `strictEqual`: lo que se prueba es que la guarda
 * devuelve el MISMO objeto cuando no sobra nada, y un `deepEqual` pasaría igual
 * con una guarda que copiara siempre.
 */

import { test } from "node:test"
import assert from "node:assert/strict"

import type { AppState, Context } from "#core/index"
import { contextId, diagramId, noteId } from "#core/index"
import { emptyAppState } from "#core/domain/AppState"
import { revision } from "#core/domain/Ids"
import type { WindowRef } from "#ui/windows"
import type { WindowsLayout } from "#ui/windows"
import {
  CALENDAR,
  DEFAULT_LAYOUT,
  GENERAL,
  addWindow,
  closeWindowAt,
  guardWindows,
  moveWindow,
  sameWindow,
} from "#ui/windows"
import { parseWindowsLayout } from "#ui/windows"

const contexto = (id: string): Context => ({
  id: contextId(id),
  name: id,
  defaultView: { type: "context" },
  items: [],
  updatedAt: 0,
  revision: revision(`rev-${id}`),
})

const conContextos = (...ids: ReadonlyArray<string>): AppState => ({
  ...emptyAppState(),
  contexts: Object.fromEntries(ids.map((id: string): readonly [string, Context] => [id, contexto(id)])),
})

const ventana = (id: string): WindowRef => ({ kind: "context", id: contextId(id) })

/* ─────────────────────────────── La guarda ──────────────────────────────── */

test("si no sobra nada, devuelve el MISMO objeto", (): void => {
  const layout: WindowsLayout = { windows: [GENERAL, ventana("casa")], active: ventana("casa") }
  assert.strictEqual(guardWindows(layout, conContextos("casa")), layout)
})

test("si no sobra nada, tampoco copia la lista", (): void => {
  const layout: WindowsLayout = { windows: [GENERAL, ventana("casa")], active: GENERAL }
  assert.strictEqual(guardWindows(layout, conContextos("casa")).windows, layout.windows)
})

test("quita la ventana de un contexto que ya no existe", (): void => {
  const layout: WindowsLayout = {
    windows: [ventana("casa"), ventana("borrado"), GENERAL],
    active: ventana("casa"),
  }
  const guardado: WindowsLayout = guardWindows(layout, conContextos("casa"))

  assert.deepEqual(guardado.windows, [ventana("casa"), GENERAL])
  assert.deepEqual(guardado.active, ventana("casa"))
})

test("el General no se cae nunca: no es un contexto", (): void => {
  const layout: WindowsLayout = { windows: [GENERAL], active: GENERAL }
  assert.strictEqual(guardWindows(layout, emptyAppState()), layout)
})

test("si la activa se ha caído, pasa a la primera que quede", (): void => {
  const layout: WindowsLayout = {
    windows: [ventana("trabajo"), ventana("borrado")],
    active: ventana("borrado"),
  }
  const guardado: WindowsLayout = guardWindows(layout, conContextos("trabajo"))
  assert.deepEqual(guardado.active, ventana("trabajo"))
})

test("si no queda ninguna, ni ventanas ni activa: la pantalla vacía", (): void => {
  const layout: WindowsLayout = { windows: [ventana("borrado")], active: ventana("borrado") }
  assert.deepEqual(guardWindows(layout, emptyAppState()), { windows: [], active: null })
})

test("una activa que no está en la lista se cambia por la primera, aunque exista", (): void => {
  /* La activa tiene que ser una de las ventanas: si no, ◀ ▶ no sabrían dónde están. */
  const layout: WindowsLayout = { windows: [GENERAL], active: ventana("casa") }
  assert.deepEqual(guardWindows(layout, conContextos("casa")).active, GENERAL)
})

test("sin activa y con ventanas, abre la primera", (): void => {
  const layout: WindowsLayout = { windows: [ventana("casa"), GENERAL], active: null }
  assert.deepEqual(guardWindows(layout, conContextos("casa")).active, ventana("casa"))
})

test("la activa se reconoce por referencia, no por posición", (): void => {
  /* Con un índice, quitar la de delante haría que la activa señalara a otra. */
  const layout: WindowsLayout = {
    windows: [ventana("borrado"), ventana("casa"), ventana("trabajo")],
    active: ventana("trabajo"),
  }
  const guardado: WindowsLayout = guardWindows(layout, conContextos("casa", "trabajo"))
  assert.deepEqual(guardado.active, ventana("trabajo"))
})

/* ─────────────────────────── Lo que se lee guardado ─────────────────────── */

test("lo que no tiene forma de lista empieza como la primera vez", (): void => {
  const basuras: ReadonlyArray<unknown> = [null, 42, "hola", [], { windows: "no" }]
  for (const basura of basuras) assert.strictEqual(parseWindowsLayout(basura), DEFAULT_LAYOUT)
})

test("se descarta de una en una lo que no tiene forma de ventana", (): void => {
  const leido: WindowsLayout = parseWindowsLayout({
    windows: [{ kind: "general" }, { kind: "context" }, { kind: "otra" }, 7, { kind: "context", id: "casa" }],
    active: { kind: "context", id: "casa" },
  })
  assert.deepEqual(leido, { windows: [GENERAL, ventana("casa")], active: ventana("casa") })
})

test("una activa sin forma de ventana se lee como ninguna", (): void => {
  assert.equal(parseWindowsLayout({ windows: [], active: "casa" }).active, null)
})

test("lo guardado pasa por JSON y vuelve igual", (): void => {
  const layout: WindowsLayout = { windows: [ventana("casa"), GENERAL], active: GENERAL }
  assert.deepEqual(parseWindowsLayout(JSON.parse(JSON.stringify(layout))), layout)
})

/* ───────────────────────── Las ediciones de las pestañas ─────────────────── */

const TRES: WindowsLayout = {
  windows: [ventana("casa"), ventana("compra"), ventana("trabajo")],
  active: ventana("compra"),
}

test("addWindow pone la nueva al final y la deja activa", (): void => {
  const editado: WindowsLayout = addWindow(TRES, ventana("x"))
  assert.deepEqual(editado.windows, [...TRES.windows, ventana("x")])
  assert.deepEqual(editado.active, ventana("x"))
})

test("addWindow a una lista vacía la deja como la única, activa", (): void => {
  assert.deepEqual(addWindow({ windows: [], active: null }, GENERAL), { windows: [GENERAL], active: GENERAL })
})

test("addWindow de una que ya está sólo pasa a ella, sin repetirla", (): void => {
  const editado: WindowsLayout = addWindow(TRES, ventana("trabajo"))
  assert.strictEqual(editado.windows, TRES.windows)
  assert.deepEqual(editado.active, ventana("trabajo"))
})

test("addWindow de la que ya es activa devuelve el MISMO objeto", (): void => {
  assert.strictEqual(addWindow(TRES, ventana("compra")), TRES)
})

test("addWindow del General o del calendario los pone al final, como a cualquier otra", (): void => {
  const conCalendario: WindowsLayout = addWindow(TRES, CALENDAR)
  assert.deepEqual(conCalendario.windows, [...TRES.windows, CALENDAR])
  assert.deepEqual(addWindow(conCalendario, GENERAL).windows, [...TRES.windows, CALENDAR, GENERAL])
})

test("closeWindowAt de la activa pasa a la de su derecha", (): void => {
  const editado: WindowsLayout = closeWindowAt(TRES, 1)
  assert.deepEqual(editado.windows, [ventana("casa"), ventana("trabajo")])
  assert.deepEqual(editado.active, ventana("trabajo"))
})

test("closeWindowAt de la activa, si es la última, pasa a la de su izquierda", (): void => {
  const enLaUltima: WindowsLayout = { ...TRES, active: ventana("trabajo") }
  assert.deepEqual(closeWindowAt(enLaUltima, 2).active, ventana("compra"))
})

test("closeWindowAt de la única deja la pantalla vacía", (): void => {
  assert.deepEqual(closeWindowAt({ windows: [GENERAL], active: GENERAL }, 0), { windows: [], active: null })
})

test("closeWindowAt de otra no toca la activa", (): void => {
  const editado: WindowsLayout = closeWindowAt(TRES, 0)
  assert.deepEqual(editado.windows, [ventana("compra"), ventana("trabajo")])
  assert.strictEqual(editado.active, TRES.active)
})

test("closeWindowAt fuera de rango devuelve el MISMO objeto", (): void => {
  assert.strictEqual(closeWindowAt(TRES, 3), TRES)
  assert.strictEqual(closeWindowAt(TRES, -1), TRES)
})

test("moveWindow hacia delante y hacia atrás corre las de en medio", (): void => {
  const [a, b, c] = TRES.windows
  assert.ok(a !== undefined && b !== undefined && c !== undefined)
  assert.deepEqual(moveWindow(TRES, 0, 2).windows, [b, c, a])
  assert.deepEqual(moveWindow(TRES, 2, 0).windows, [c, a, b])
  assert.deepEqual(moveWindow(TRES, 1, 2).windows, [a, c, b])
})

test("moveWindow no toca la activa: la sigue por referencia", (): void => {
  assert.strictEqual(moveWindow(TRES, 0, 2).active, TRES.active)
})

test("moveWindow al mismo sitio, o fuera de rango, devuelve el MISMO objeto", (): void => {
  assert.strictEqual(moveWindow(TRES, 1, 1), TRES)
  assert.strictEqual(moveWindow(TRES, 3, 0), TRES)
  assert.strictEqual(moveWindow(TRES, 0, 3), TRES)
  assert.strictEqual(moveWindow(TRES, 0, -1), TRES)
  assert.strictEqual(moveWindow(TRES, -1, 0), TRES)
})

test("moveWindow lleva el General y el calendario como a cualquier otra", (): void => {
  const conAmbos: WindowsLayout = { windows: [GENERAL, CALENDAR, ventana("casa")], active: GENERAL }
  assert.deepEqual(moveWindow(conAmbos, 0, 2).windows, [CALENDAR, ventana("casa"), GENERAL])
  assert.deepEqual(moveWindow(conAmbos, 2, 0).windows, [ventana("casa"), GENERAL, CALENDAR])
})

/* ────────────────────────── Las ventanas de tipo nota ──────────────────────── */

const ventanaNota = (id: string): WindowRef => ({ kind: "note", id: noteId(id) })

const conNota = (estado: AppState, id: string): AppState => ({
  ...estado,
  notes: {
    ...estado.notes,
    [noteId(id)]: { id: noteId(id), name: id, content: [], updatedAt: 0, revision: revision(`rev-${id}`) },
  },
})

test("la guarda sabe de notas: la de una nota que existe se queda, y es la MISMA lista", (): void => {
  const layout: WindowsLayout = { windows: [ventanaNota("lista"), GENERAL], active: ventanaNota("lista") }
  assert.strictEqual(guardWindows(layout, conNota(emptyAppState(), "lista")), layout)
})

test("la guarda sabe de notas: la de una nota borrada desaparece", (): void => {
  const layout: WindowsLayout = { windows: [ventanaNota("borrada"), GENERAL], active: ventanaNota("borrada") }
  assert.deepEqual(guardWindows(layout, emptyAppState()), { windows: [GENERAL], active: GENERAL })
})

test("una nota y un contexto con el mismo id no son la misma ventana", (): void => {
  const layout: WindowsLayout = { windows: [ventana("x"), ventanaNota("x")], active: ventanaNota("x") }
  /* Existe el contexto «x» pero no la nota «x»: sólo se cae la de nota. */
  assert.deepEqual(guardWindows(layout, conContextos("x")), { windows: [ventana("x")], active: ventana("x") })
})

test("una ventana de nota se lee de lo guardado", (): void => {
  assert.deepEqual(parseWindowsLayout({ windows: [{ kind: "note", id: "lista" }], active: null }).windows, [
    ventanaNota("lista"),
  ])
})

test("sameWindow no confunde clases: ni nota con contexto, en ningún sentido", (): void => {
  assert.equal(sameWindow(ventanaNota("x"), ventana("x")), false)
  assert.equal(sameWindow(ventana("x"), ventanaNota("x")), false)
  assert.equal(sameWindow(ventanaNota("x"), ventanaNota("x")), true)
  assert.equal(sameWindow(ventanaNota("x"), GENERAL), false)
})

/* ──────────────────────── Las ventanas de tipo diagrama ────────────────────── */

const ventanaDiagrama = (id: string): WindowRef => ({ kind: "diagram", id: diagramId(id) })

const conDiagrama = (estado: AppState, id: string): AppState => ({
  ...estado,
  diagrams: {
    ...estado.diagrams,
    [diagramId(id)]: {
      id: diagramId(id),
      name: id,
      nodes: {},
      relations: {},
      updatedAt: 0,
      revision: revision(`rev-${id}`),
    },
  },
})

test("la guarda sabe de diagramas: la de uno que existe se queda, y es la MISMA lista", (): void => {
  const layout: WindowsLayout = {
    windows: [ventanaDiagrama("mudanza"), GENERAL],
    active: ventanaDiagrama("mudanza"),
  }
  assert.strictEqual(guardWindows(layout, conDiagrama(emptyAppState(), "mudanza")), layout)
})

test("la guarda sabe de diagramas: la de uno borrado desaparece", (): void => {
  const layout: WindowsLayout = {
    windows: [ventanaDiagrama("borrado"), GENERAL],
    active: ventanaDiagrama("borrado"),
  }
  assert.deepEqual(guardWindows(layout, emptyAppState()), { windows: [GENERAL], active: GENERAL })
})

test("un diagrama y una nota con el mismo id no son la misma ventana", (): void => {
  const layout: WindowsLayout = { windows: [ventanaNota("x"), ventanaDiagrama("x")], active: ventanaDiagrama("x") }
  /* Existe la nota «x» pero no el diagrama «x»: sólo se cae la de diagrama. */
  assert.deepEqual(guardWindows(layout, conNota(emptyAppState(), "x")), {
    windows: [ventanaNota("x")],
    active: ventanaNota("x"),
  })
})

test("una ventana de diagrama se lee de lo guardado, también como la activa", (): void => {
  const leido: WindowsLayout = parseWindowsLayout({
    windows: [{ kind: "diagram", id: "mudanza" }],
    active: { kind: "diagram", id: "mudanza" },
  })
  assert.deepEqual(leido, { windows: [ventanaDiagrama("mudanza")], active: ventanaDiagrama("mudanza") })
})

test("una ventana de diagrama sin id se descarta al leer", (): void => {
  assert.deepEqual(parseWindowsLayout({ windows: [{ kind: "diagram" }, GENERAL], active: null }).windows, [GENERAL])
})

test("sameWindow no confunde un diagrama con ninguna otra clase", (): void => {
  assert.equal(sameWindow(ventanaDiagrama("x"), ventanaNota("x")), false)
  assert.equal(sameWindow(ventanaNota("x"), ventanaDiagrama("x")), false)
  assert.equal(sameWindow(ventanaDiagrama("x"), ventana("x")), false)
  assert.equal(sameWindow(ventanaDiagrama("x"), ventanaDiagrama("x")), true)
  assert.equal(sameWindow(ventanaDiagrama("x"), ventanaDiagrama("y")), false)
})

/* ─────────────────────────── La ventana del calendario ───────────────────── */

test("el calendario no se cae nunca: no es una entidad, y la guarda devuelve el MISMO objeto", (): void => {
  const layout: WindowsLayout = { windows: [GENERAL, CALENDAR], active: CALENDAR }
  assert.strictEqual(guardWindows(layout, conContextos()), layout)
})

test("el calendario sólo es igual a sí mismo", (): void => {
  assert.equal(sameWindow(CALENDAR, { kind: "calendar" }), true)
  assert.equal(sameWindow(CALENDAR, GENERAL), false)
  assert.equal(sameWindow(GENERAL, CALENDAR), false)
  assert.equal(sameWindow(CALENDAR, ventana("calendar")), false)
})

test("addWindow no mete un segundo calendario: devuelve el MISMO objeto", (): void => {
  const layout: WindowsLayout = { windows: [GENERAL, CALENDAR], active: CALENDAR }
  assert.strictEqual(addWindow(layout, CALENDAR), layout)
})

test("una ventana de calendario se lee de lo guardado, también como la activa", (): void => {
  const leido: WindowsLayout = parseWindowsLayout({
    windows: [{ kind: "general" }, { kind: "calendar" }],
    active: { kind: "calendar" },
  })
  assert.deepEqual(leido, { windows: [GENERAL, CALENDAR], active: CALENDAR })
})

test("un calendario repetido en lo guardado se queda en el primero", (): void => {
  const leido: WindowsLayout = parseWindowsLayout({
    windows: [{ kind: "calendar" }, { kind: "general" }, { kind: "calendar" }],
    active: null,
  })
  assert.deepEqual(leido.windows, [CALENDAR, GENERAL])
})
