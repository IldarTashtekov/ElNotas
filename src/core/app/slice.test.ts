/**
 * La rebanada vertical, de punta a punta.
 *
 * No comprueba "que marcar una casilla funcione" —eso es lo fácil—. Comprueba la
 * propiedad que sostiene toda la arquitectura, y que es el criterio de cierre de
 * la Fase 1 (`ARCHITECTURE.md` §9.5):
 *
 *     marcar una casilla que YA estaba marcada
 *     no avisa a nadie y no ensucia `updatedAt`.
 *
 * Si eso se rompe en cualquier eslabón, la app sigue funcionando: sólo redibuja
 * y escribe en disco de más, en silencio y para siempre.
 */

import { test } from "node:test"
import assert from "node:assert/strict"

import type { AppState } from "../domain/AppState"
import type { Content } from "../domain/Content"
import { checkBox, isCheckBox, text } from "../domain/Content"
import { contentId, noteId, revision } from "../domain/Ids"
import type { Note } from "../domain/Note"
import type { Clock } from "../ports/Clock"
import type { IdGenerator } from "../ports/IdGenerator"
import { createStore } from "./Store"
import { createUseCases } from "./useCases"
import { reduce } from "./reduce"

/* ────────────────────────────── El escenario ────────────────────────────── */

const ID_NOTA = noteId("nota-compra")
const ID_OTRA_NOTA = noteId("nota-diario")
const ID_COMPRA = contentId("compra")
const ID_FRUTA = contentId("fruta")
const ID_PERAS = contentId("peras")
const ID_INEXISTENTE = contentId("no-existe")

const HORA_INICIAL = 0
const HORA_DEL_RELOJ = 1000

const contenido = (): ReadonlyArray<Content> => [
  text(ID_COMPRA, "Compra semanal"),
  checkBox(ID_FRUTA, "Fruta", { children: [checkBox(ID_PERAS, "Peras")] }),
]

const nota = (): Note => ({
  id: ID_NOTA,
  name: "La compra",
  content: contenido(),
  updatedAt: HORA_INICIAL,
  revision: revision("rev-inicial"),
})

const otraNota = (): Note => ({
  id: ID_OTRA_NOTA,
  name: "Diario",
  content: [text(contentId("entrada"), "Hoy ha llovido")],
  updatedAt: HORA_INICIAL,
  revision: revision("rev-inicial"),
})

const estadoInicial = (): AppState => ({
  notes: { [ID_NOTA]: nota(), [ID_OTRA_NOTA]: otraNota() },
  plans: {},
  contexts: {},
})

/* Puertos de mentira. Una línea cada uno: eso es lo que compran los puertos. */

const relojFijo: Clock = { now: () => HORA_DEL_RELOJ }

const idsEnOrden = (): IdGenerator => {
  let n = 0
  return { next: () => `rev-${++n}` }
}

/* Ayudas para leer el árbol sin pelearse con `noUncheckedIndexedAccess`. */

const notaDe = (estado: AppState, id = ID_NOTA): Note => {
  const encontrada = estado.notes[id]
  if (encontrada === undefined) throw new Error(`No está la nota ${id}`)
  return encontrada
}

const perasDe = (estado: AppState): boolean => {
  const fruta = notaDe(estado).content[1]
  if (fruta === undefined || !isCheckBox(fruta)) throw new Error("No está 'Fruta'")
  const peras = fruta.children[0]
  if (peras === undefined) throw new Error("No está 'Peras'")
  return peras.checked
}

const accionMarcar = (id = ID_PERAS, checked = true) =>
  ({
    type: "set-checked",
    noteId: ID_NOTA,
    contentId: id,
    checked,
    meta: { now: HORA_DEL_RELOJ, revision: revision("rev-nueva") },
  }) as const

/* ══════════════════════════════ El reducer ══════════════════════════════ */

test("reduce: marca la casilla y estampa la hora y la revisión del meta", () => {
  const antes = estadoInicial()

  const despues = reduce(antes, accionMarcar())

  assert.equal(perasDe(despues), true)
  assert.equal(notaDe(despues).updatedAt, HORA_DEL_RELOJ)
  assert.equal(notaDe(despues).revision, revision("rev-nueva"))
})

test("reduce: es total — la nota que no existe no lanza, devuelve el estado", () => {
  const antes = estadoInicial()

  const despues = reduce(antes, {
    ...accionMarcar(),
    noteId: noteId("no-existe"),
  })

  assert.strictEqual(despues, antes)
})

test("reduce: es total — la casilla que no existe tampoco lanza", () => {
  const antes = estadoInicial()

  assert.strictEqual(reduce(antes, accionMarcar(ID_INEXISTENTE)), antes)
})

test("reduce: marcar un texto suelto no hace nada", () => {
  const antes = estadoInicial()

  assert.strictEqual(reduce(antes, accionMarcar(ID_COMPRA)), antes)
})

/* La que sostiene la cadena entera. */
test("reduce: marcar lo ya marcado devuelve EL MISMO estado y no ensucia updatedAt", () => {
  const marcado = reduce(estadoInicial(), accionMarcar())

  const otraVez = reduce(marcado, {
    ...accionMarcar(),
    meta: { now: 999_999, revision: revision("rev-que-no-debe-usarse") },
  })

  assert.strictEqual(otraVez, marcado, "el estado, intacto")
  assert.equal(notaDe(otraVez).updatedAt, HORA_DEL_RELOJ, "la hora, sin tocar")
  assert.equal(notaDe(otraVez).revision, revision("rev-nueva"), "la revisión, sin tocar")
})

test("reduce: no toca las demás notas", () => {
  const antes = estadoInicial()

  const despues = reduce(antes, accionMarcar())

  assert.strictEqual(
    notaDe(despues, ID_OTRA_NOTA),
    notaDe(antes, ID_OTRA_NOTA),
    "el diario es el mismo objeto",
  )
})

test("reduce: no muta el estado que recibe", () => {
  const antes = estadoInicial()

  reduce(antes, accionMarcar())

  assert.equal(perasDe(antes), false)
  assert.equal(notaDe(antes).updatedAt, HORA_INICIAL)
})

/* ══════════════════════════════ El Store ══════════════════════════════ */

test("Store: guarda el estado y avisa cuando algo cambia", () => {
  const store = createStore(estadoInicial())
  const avisos: AppState[] = []
  store.subscribe((estado) => avisos.push(estado))

  store.dispatch(accionMarcar())

  assert.equal(avisos.length, 1)
  assert.strictEqual(store.getState(), avisos[0], "avisa con el estado nuevo")
  assert.equal(perasDe(store.getState()), true)
})

/* El criterio de cierre de la fase. */
test("Store: una acción redundante NO avisa a nadie", () => {
  const store = createStore(estadoInicial())
  store.dispatch(accionMarcar())

  const avisos: AppState[] = []
  store.subscribe((estado) => avisos.push(estado))
  const antes = store.getState()

  store.dispatch(accionMarcar()) // ya estaba marcada

  assert.equal(avisos.length, 0, "nadie se ha enterado")
  assert.strictEqual(store.getState(), antes, "y el estado es el mismo objeto")
})

test("Store: darse de baja deja de recibir avisos", () => {
  const store = createStore(estadoInicial())
  let avisos = 0
  const baja = store.subscribe(() => avisos++)

  store.dispatch(accionMarcar())
  baja()
  store.dispatch(accionMarcar(ID_FRUTA))

  assert.equal(avisos, 1)
})

/* El bug clásico que sólo aparece en producción y de forma intermitente. */
test("Store: un suscriptor puede darse de baja durante su propio aviso", () => {
  const store = createStore(estadoInicial())
  const llamados: string[] = []

  const baja = store.subscribe(() => {
    llamados.push("primero")
    baja() // se da de baja mientras se está recorriendo la lista
  })
  store.subscribe(() => llamados.push("segundo"))

  store.dispatch(accionMarcar())

  assert.deepEqual(llamados, ["primero", "segundo"], "el segundo no se pierde")

  store.dispatch(accionMarcar(ID_FRUTA))
  assert.deepEqual(llamados, ["primero", "segundo", "segundo"], "y el primero ya no está")
})

test("Store: varios suscriptores reciben todos el aviso", () => {
  const store = createStore(estadoInicial())
  let a = 0
  let b = 0
  store.subscribe(() => a++)
  store.subscribe(() => b++)

  store.dispatch(accionMarcar())

  assert.equal(a, 1)
  assert.equal(b, 1)
})

/* ═════════════════════════ Los casos de uso ═════════════════════════ */

test("useCases: construye el meta con el reloj y el generador inyectados", () => {
  const store = createStore(estadoInicial())
  const useCases = createUseCases({ clock: relojFijo, ids: idsEnOrden(), store })

  useCases.setChecked(ID_NOTA, ID_PERAS, true)

  assert.equal(notaDe(store.getState()).updatedAt, HORA_DEL_RELOJ)
  assert.equal(notaDe(store.getState()).revision, revision("rev-1"))
})

test("useCases: cada acción que cambia algo estrena revisión", () => {
  const store = createStore(estadoInicial())
  const useCases = createUseCases({ clock: relojFijo, ids: idsEnOrden(), store })

  useCases.setChecked(ID_NOTA, ID_PERAS, true)
  useCases.setChecked(ID_NOTA, ID_FRUTA, true)

  assert.equal(notaDe(store.getState()).revision, revision("rev-2"))
})

/* ═══════════ La rebanada entera, que es el criterio de cierre ═══════════ */

test("de punta a punta: marcar lo ya marcado no notifica y no toca updatedAt", () => {
  const store = createStore(estadoInicial())
  const useCases = createUseCases({ clock: relojFijo, ids: idsEnOrden(), store })

  let avisos = 0
  store.subscribe(() => avisos++)

  useCases.setChecked(ID_NOTA, ID_PERAS, true) // 1: cambia
  useCases.setChecked(ID_NOTA, ID_PERAS, true) // 2: redundante
  useCases.setChecked(ID_NOTA, ID_PERAS, true) // 3: redundante

  assert.equal(avisos, 1, "tres despachos, un solo aviso")
  assert.equal(perasDe(store.getState()), true)
  assert.equal(
    notaDe(store.getState()).updatedAt,
    HORA_DEL_RELOJ,
    "la hora es la del primer despacho, no la de los otros dos",
  )
  assert.equal(
    notaDe(store.getState()).revision,
    revision("rev-1"),
    "y la revisión también: las revisiones 2 y 3 se generaron y se tiraron",
  )
})

test("de punta a punta: desmarcar y volver a marcar sí son dos cambios", () => {
  const store = createStore(estadoInicial())
  const useCases = createUseCases({ clock: relojFijo, ids: idsEnOrden(), store })

  let avisos = 0
  store.subscribe(() => avisos++)

  useCases.setChecked(ID_NOTA, ID_PERAS, true)
  useCases.setChecked(ID_NOTA, ID_PERAS, false)
  useCases.setChecked(ID_NOTA, ID_PERAS, true)

  assert.equal(avisos, 3)
  assert.equal(notaDe(store.getState()).revision, revision("rev-3"))
})
