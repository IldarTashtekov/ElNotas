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
import { contextId, emptyAppState, noteId, revision } from "#core/index"
import type { WindowRef, WindowsLayout } from "#ui/index"
import {
  DEFAULT_LAYOUT,
  GENERAL,
  guardWindows,
  insertWindowAfter,
  moveWindow,
  parseWindowsLayout,
  removeWindowAt,
  replaceWindowAt,
  sameWindow,
} from "#ui/index"

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

/* ─────────────────── Las ediciones de la configuración ──────────────────── */

const TRES: WindowsLayout = {
  windows: [ventana("casa"), GENERAL, ventana("trabajo")],
  active: GENERAL,
}

test("replaceWindowAt cambia sólo esa ventana", (): void => {
  const editado: WindowsLayout = replaceWindowAt(TRES, 2, ventana("compra"))
  assert.deepEqual(editado.windows, [ventana("casa"), GENERAL, ventana("compra")])
  assert.deepEqual(editado.active, GENERAL)
})

test("replaceWindowAt de la activa: la activa sigue a la ventana, no a lo que enseñaba", (): void => {
  /* Se entró a configuración desde esa ventana, y al salir se vuelve a ella. */
  const editado: WindowsLayout = replaceWindowAt(TRES, 1, ventana("compra"))
  assert.deepEqual(editado.active, ventana("compra"))
})

test("replaceWindowAt por lo mismo que ya enseña, o fuera de rango, devuelve el MISMO objeto", (): void => {
  assert.strictEqual(replaceWindowAt(TRES, 0, ventana("casa")), TRES)
  assert.strictEqual(replaceWindowAt(TRES, 3, ventana("casa")), TRES)
  assert.strictEqual(replaceWindowAt(TRES, -1, ventana("casa")), TRES)
})

test("insertWindowAfter mete detrás de esa, y no toca la activa", (): void => {
  const editado: WindowsLayout = insertWindowAfter(TRES, 0, ventana("compra"))
  assert.deepEqual(editado.windows, [ventana("casa"), ventana("compra"), GENERAL, ventana("trabajo")])
  assert.deepEqual(editado.active, GENERAL)
})

test("insertWindowAfter la última, y con -1 la primera", (): void => {
  const detras: ReadonlyArray<WindowRef> = insertWindowAfter(TRES, 2, ventana("x")).windows
  assert.deepEqual(detras[detras.length - 1], ventana("x"))
  assert.deepEqual(insertWindowAfter(TRES, -1, ventana("x")).windows[0], ventana("x"))
})

test("insertWindowAfter en una lista vacía, con -1", (): void => {
  const vacia: WindowsLayout = { windows: [], active: null }
  assert.deepEqual(insertWindowAfter(vacia, -1, GENERAL).windows, [GENERAL])
})

test("insertWindowAfter fuera de rango devuelve el MISMO objeto", (): void => {
  assert.strictEqual(insertWindowAfter(TRES, 3, GENERAL), TRES)
  assert.strictEqual(insertWindowAfter(TRES, -2, GENERAL), TRES)
})

test("removeWindowAt quita sólo esa", (): void => {
  assert.deepEqual(removeWindowAt(TRES, 0).windows, [GENERAL, ventana("trabajo")])
})

test("removeWindowAt fuera de rango devuelve el MISMO objeto", (): void => {
  assert.strictEqual(removeWindowAt(TRES, 3), TRES)
  assert.strictEqual(removeWindowAt(TRES, -1), TRES)
})

test("moveWindow hacia delante y hacia atrás corre las de en medio", (): void => {
  const [a, b, c]: ReadonlyArray<WindowRef> = TRES.windows
  if (a === undefined || b === undefined || c === undefined) assert.fail("TRES tiene tres")
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
