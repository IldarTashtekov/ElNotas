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
import { contextId, emptyAppState, revision } from "#core/index"
import type { WindowRef, WindowsLayout } from "#ui/index"
import { DEFAULT_LAYOUT, GENERAL, guardWindows, parseWindowsLayout } from "#ui/index"

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
