/**
 * Las ocho acciones de contenido, en el reducer.
 *
 * Las operaciones que hay debajo ya tienen sus 62 pruebas en
 * `domain/operations.test.ts`, y aquí no se repiten: lo que se comprueba es
 * **la capa de arriba**, que es donde puede fallar algo distinto.
 *
 * Dos cosas por acción, y la segunda es la que importa:
 *
 *   1. que llegue a su operación con los argumentos correctos —si `split`
 *      recibiera el `offset` donde va el id, el estado saldría mal—;
 *   2. que un no-op devuelva **el MISMO estado** y no ensucie `updatedAt`.
 *
 * La (2) está garantizada por `onContent`, que tiene la comparación escrita una
 * sola vez. Aun así se prueba en las ocho: el día que alguien reduzca una acción
 * a mano, saltándose el helper, esa prueba es lo único que lo cazará.
 */

import { test } from "node:test"
import assert from "node:assert/strict"

import type { AppState } from "../domain/AppState"
import type { Content } from "../domain/Content"
import { checkBox, isCheckBox, isText, text } from "../domain/Content"
import { contentId, noteId, revision } from "../domain/Ids"
import type { Note } from "../domain/Note"
import { after, lastChildOf, rootEnd } from "../domain/Position"
import type { ActionMeta } from "./Action"
import { reduce } from "./reduce"

/* ────────────────────────────── El escenario ────────────────────────────── */

const ID_NOTA = noteId("compra")
const ID_TITULO = contentId("titulo")
const ID_FRUTA = contentId("fruta")
const ID_PERAS = contentId("peras")
const ID_NUEVO = contentId("nuevo")
const ID_FANTASMA = contentId("no-existe")

const HORA_INICIAL = 0
const META: ActionMeta = { now: 1000, revision: revision("rev-nueva") }

/**
 *   Compra semanal          (texto)
 *   ☐ Fruta                 (casilla, CON una hija)
 *     ☐ Peras
 *   ☐ Pan                   (casilla, sin hijas)
 */
const ID_PAN = contentId("pan")

const contenido = (): ReadonlyArray<Content> => [
  text(ID_TITULO, "Compra semanal"),
  checkBox(ID_FRUTA, "Fruta", { children: [checkBox(ID_PERAS, "Peras")] }),
  checkBox(ID_PAN, "Pan"),
]

const estado = (): AppState => ({
  notes: {
    [ID_NOTA]: {
      id: ID_NOTA,
      name: "Compra",
      content: contenido(),
      updatedAt: HORA_INICIAL,
      revision: revision("rev-inicial"),
    },
  },
  plans: {},
  contexts: {},
})

const nota = (s: AppState): Note => {
  const n = s.notes[ID_NOTA]
  if (n === undefined) throw new Error("la nota del escenario tiene que existir")
  return n
}

const lineas = (s: AppState): ReadonlyArray<Content> => nota(s).content

const buscar = (s: AppState, id: typeof ID_TITULO): Content | undefined =>
  lineas(s).find((c) => c.id === id)

/** Todo no-op tiene que cumplir las dos cosas, no sólo una. */
const esNoOp = (antes: AppState, despues: AppState, que: string): void => {
  assert.strictEqual(despues, antes, `${que}: ha devuelto un estado nuevo`)
  assert.equal(nota(despues).updatedAt, HORA_INICIAL, `${que}: ha ensuciado updatedAt`)
}

/* ──────────────────────────────── set-text ────────────────────────────────── */

test("set-text cambia el texto de la línea", () => {
  const s = reduce(estado(), {
    type: "set-text",
    noteId: ID_NOTA,
    contentId: ID_TITULO,
    value: "Compra del mes",
    meta: META,
  })

  const linea = buscar(s, ID_TITULO)
  assert.equal(linea !== undefined && isText(linea) && linea.text, "Compra del mes")
  assert.equal(nota(s).updatedAt, META.now)
  assert.equal(nota(s).revision, META.revision)
})

test("set-text con el mismo texto es no-op", () => {
  const antes = estado()
  esNoOp(
    antes,
    reduce(antes, {
      type: "set-text",
      noteId: ID_NOTA,
      contentId: ID_TITULO,
      value: "Compra semanal",
      meta: META,
    }),
    "set-text",
  )
})

/* ───────────────────────────────── insert ─────────────────────────────────── */

test("insert mete la línea al final de la raíz", () => {
  const s = reduce(estado(), {
    type: "insert",
    noteId: ID_NOTA,
    block: text(ID_NUEVO, "Leche"),
    position: rootEnd,
    meta: META,
  })

  assert.equal(lineas(s).length, 4)
  assert.equal(lineas(s)[3]?.id, ID_NUEVO)
})

test("insert coloca detrás de una línea concreta", () => {
  const s = reduce(estado(), {
    type: "insert",
    noteId: ID_NOTA,
    block: checkBox(ID_NUEVO, "Leche"),
    position: after(ID_TITULO),
    meta: META,
  })

  assert.equal(lineas(s)[1]?.id, ID_NUEVO)
})

test("insert mete como última hija de una casilla", () => {
  const s = reduce(estado(), {
    type: "insert",
    noteId: ID_NOTA,
    block: checkBox(ID_NUEVO, "Manzanas"),
    position: lastChildOf(ID_FRUTA),
    meta: META,
  })

  const fruta = buscar(s, ID_FRUTA)
  assert.equal(fruta !== undefined && isCheckBox(fruta) && fruta.children.length, 2)
})

test("insert con un id que ya existe es no-op", () => {
  const antes = estado()
  esNoOp(
    antes,
    reduce(antes, {
      type: "insert",
      noteId: ID_NOTA,
      block: text(ID_TITULO, "Duplicada"),
      position: rootEnd,
      meta: META,
    }),
    "insert",
  )
})

/* ───────────────────────────────── remove ─────────────────────────────────── */

test("remove quita una línea sin hijas", () => {
  const s = reduce(estado(), {
    type: "remove",
    noteId: ID_NOTA,
    contentId: ID_PAN,
    meta: META,
  })

  assert.equal(lineas(s).length, 2)
  assert.equal(buscar(s, ID_PAN), undefined)
})

test("remove sobre una casilla CON hijas es no-op", () => {
  const antes = estado()
  esNoOp(
    antes,
    reduce(antes, { type: "remove", noteId: ID_NOTA, contentId: ID_FRUTA, meta: META }),
    "remove con hijas",
  )
})

/* ────────────────────────────────── split ─────────────────────────────────── */

test("split parte la línea y la mitad nueva recibe el id de la acción", () => {
  const s = reduce(estado(), {
    type: "split",
    noteId: ID_NOTA,
    contentId: ID_TITULO,
    offset: 6,
    newId: ID_NUEVO,
    meta: META,
  })

  const primera = lineas(s)[0]
  const segunda = lineas(s)[1]
  assert.equal(primera !== undefined && isText(primera) && primera.text, "Compra")
  assert.equal(segunda?.id, ID_NUEVO)
  assert.equal(segunda !== undefined && isText(segunda) && segunda.text, " semanal")
})

test("split con el punto de corte fuera de la línea es no-op", () => {
  const antes = estado()
  esNoOp(
    antes,
    reduce(antes, {
      type: "split",
      noteId: ID_NOTA,
      contentId: ID_TITULO,
      offset: 999,
      newId: ID_NUEVO,
      meta: META,
    }),
    "split fuera de rango",
  )
})

/* ────────────────────────────────── merge ─────────────────────────────────── */

test("merge sube el texto a la línea de arriba", () => {
  const s = reduce(estado(), {
    type: "merge",
    noteId: ID_NOTA,
    contentId: ID_PAN,
    meta: META,
  })

  assert.equal(buscar(s, ID_PAN), undefined)
  const fruta = buscar(s, ID_FRUTA)
  assert.equal(fruta !== undefined && isCheckBox(fruta) && fruta.text, "FrutaPan")
})

test("merge sobre la primera línea de la nota es no-op", () => {
  const antes = estado()
  esNoOp(
    antes,
    reduce(antes, { type: "merge", noteId: ID_NOTA, contentId: ID_TITULO, meta: META }),
    "merge de la primera",
  )
})

/* ─────────────────────────────── conversiones ─────────────────────────────── */

test("convert-to-checkbox convierte el texto CONSERVANDO su id", () => {
  const s = reduce(estado(), {
    type: "convert-to-checkbox",
    noteId: ID_NOTA,
    contentId: ID_TITULO,
    meta: META,
  })

  const linea = buscar(s, ID_TITULO)
  assert.ok(linea !== undefined && isCheckBox(linea), "no se ha convertido")
  assert.equal(linea.id, ID_TITULO, "la línea ha cambiado de id")
})

test("convert-to-checkbox sobre algo que ya es casilla es no-op", () => {
  const antes = estado()
  esNoOp(
    antes,
    reduce(antes, {
      type: "convert-to-checkbox",
      noteId: ID_NOTA,
      contentId: ID_PAN,
      meta: META,
    }),
    "convert-to-checkbox",
  )
})

test("convert-to-text convierte la casilla sin hijas, conservando su id", () => {
  const s = reduce(estado(), {
    type: "convert-to-text",
    noteId: ID_NOTA,
    contentId: ID_PAN,
    meta: META,
  })

  const linea = buscar(s, ID_PAN)
  assert.ok(linea !== undefined && isText(linea), "no se ha convertido")
  assert.equal(linea.id, ID_PAN)
})

test("convert-to-text sobre una casilla CON hijas es no-op", () => {
  const antes = estado()
  esNoOp(
    antes,
    reduce(antes, {
      type: "convert-to-text",
      noteId: ID_NOTA,
      contentId: ID_FRUTA,
      meta: META,
    }),
    "convert-to-text con hijas",
  )
})

/* ──────────────── Lo transversal: la nota que no existe ──────────────────── */

test("todas las acciones de contenido sobre una nota inexistente son no-op", () => {
  const antes = estado()
  const fantasma = noteId("no-existe")

  const todas = [
    { type: "set-checked", noteId: fantasma, contentId: ID_FRUTA, checked: true, meta: META },
    { type: "set-text", noteId: fantasma, contentId: ID_TITULO, value: "x", meta: META },
    {
      type: "insert",
      noteId: fantasma,
      block: text(ID_NUEVO, "x"),
      position: rootEnd,
      meta: META,
    },
    { type: "remove", noteId: fantasma, contentId: ID_PAN, meta: META },
    { type: "split", noteId: fantasma, contentId: ID_TITULO, offset: 1, newId: ID_NUEVO, meta: META },
    { type: "merge", noteId: fantasma, contentId: ID_PAN, meta: META },
    { type: "convert-to-checkbox", noteId: fantasma, contentId: ID_TITULO, meta: META },
    { type: "convert-to-text", noteId: fantasma, contentId: ID_PAN, meta: META },
  ] as const

  for (const accion of todas) {
    assert.strictEqual(reduce(antes, accion), antes, `${accion.type} ha tocado el estado`)
  }
  assert.equal(todas.length, 8, "el catálogo de contenido son OCHO")
})

test("todas las acciones de contenido sobre una línea inexistente son no-op", () => {
  const antes = estado()

  const todas = [
    { type: "set-checked", noteId: ID_NOTA, contentId: ID_FANTASMA, checked: true, meta: META },
    { type: "set-text", noteId: ID_NOTA, contentId: ID_FANTASMA, value: "x", meta: META },
    { type: "remove", noteId: ID_NOTA, contentId: ID_FANTASMA, meta: META },
    { type: "split", noteId: ID_NOTA, contentId: ID_FANTASMA, offset: 1, newId: ID_NUEVO, meta: META },
    { type: "merge", noteId: ID_NOTA, contentId: ID_FANTASMA, meta: META },
    { type: "convert-to-checkbox", noteId: ID_NOTA, contentId: ID_FANTASMA, meta: META },
    { type: "convert-to-text", noteId: ID_NOTA, contentId: ID_FANTASMA, meta: META },
  ] as const

  for (const accion of todas) {
    esNoOp(antes, reduce(antes, accion), accion.type)
  }
})
