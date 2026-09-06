/**
 * Pruebas de la primitiva B.
 *
 * Como en toda esta capa: `assert.strictEqual` para las referencias, nunca
 * `deepStrictEqual`. Lo que se comprueba no es sólo que llegue al contenedor
 * correcto, sino que **no toque nada más por el camino**.
 */

import { test } from "node:test"
import assert from "node:assert/strict"

import type { CheckBox, Content } from "./Content"
import { checkBox, isCheckBox, text } from "./Content"
import type { ContentId } from "./Ids"
import { contentId } from "./Ids"
import type { ContainerTransform } from "./updateContainerOf"
import { updateContainerOf } from "./updateContainerOf"

/* ─────────────────────────── El árbol de pruebas ───────────────────────────
    La lista de la compra de §2.3, con una nieta añadida para poder comprobar
    que la búsqueda del contenedor baja más de un nivel:

        Text     "Compra semanal"
        CheckBox "Fruta"
          ├── CheckBox "Manzanas"
          │      └── CheckBox "Golden"     ← nieta
          └── CheckBox "Peras"
        CheckBox "Limpieza"
          └── CheckBox "Fregona"
*/

const ID_COMPRA = contentId("compra")
const ID_FRUTA = contentId("fruta")
const ID_MANZANAS = contentId("manzanas")
const ID_GOLDEN = contentId("golden")
const ID_PERAS = contentId("peras")
const ID_LIMPIEZA = contentId("limpieza")
const ID_INEXISTENTE = contentId("no-existe")

const listaDeLaCompra = (): ReadonlyArray<Content> => [
  text(ID_COMPRA, "Compra semanal"),
  checkBox(ID_FRUTA, "Fruta", {
    children: [
      checkBox(ID_MANZANAS, "Manzanas", {
        children: [checkBox(ID_GOLDEN, "Golden")],
      }),
      checkBox(ID_PERAS, "Peras"),
    ],
  }),
  checkBox(ID_LIMPIEZA, "Limpieza", {
    children: [checkBox(contentId("fregona"), "Fregona")],
  }),
]

/* ───────────────────────────── Transformaciones ───────────────────────────── */

/** No toca nada. Devuelve sus entradas tal cual, que es lo que exige el contrato. */
const NADA: ContainerTransform = {
  onRoot: (items) => items,
  onParent: (parent) => parent,
}

/** Quita esa línea de su contenedor. Es, en miniatura, lo que hará `remove`. */
const quitar = (id: ContentId): ContainerTransform => ({
  onRoot: (items) => items.filter((item) => item.id !== id),
  onParent: (parent) => ({
    ...parent,
    children: parent.children.filter((child) => child.id !== id),
  }),
})

/** Anota qué rama recibió la llamada, para comprobar a dónde llegó la búsqueda. */
const anotar = (destinos: string[]): ContainerTransform => ({
  onRoot: (items) => {
    destinos.push("raíz")
    return items
  },
  onParent: (parent) => {
    destinos.push(parent.text)
    return parent
  },
})

/* Ayudas para indexar sin pelearse con `noUncheckedIndexedAccess`. */

const bloqueEn = (items: ReadonlyArray<Content>, index: number): Content => {
  const item = items[index]
  if (item === undefined) throw new Error(`No hay bloque en el índice ${index}`)
  return item
}

const casillaEn = (items: ReadonlyArray<Content>, index: number): CheckBox => {
  const item = bloqueEn(items, index)
  if (!isCheckBox(item)) throw new Error(`El bloque ${index} no es una casilla`)
  return item
}

const hijaEn = (items: ReadonlyArray<CheckBox>, index: number): CheckBox => {
  const item = items[index]
  if (item === undefined) throw new Error(`No hay hija en el índice ${index}`)
  return item
}

/* ══════════════════ Llega al contenedor correcto ══════════════════ */

test("una línea de la raíz tiene por contenedor la lista raíz", () => {
  const destinos: string[] = []

  updateContainerOf(listaDeLaCompra(), ID_COMPRA, anotar(destinos))

  assert.deepEqual(destinos, ["raíz"])
})

test("una casilla de la raíz también: su contenedor es la lista raíz", () => {
  const destinos: string[] = []

  updateContainerOf(listaDeLaCompra(), ID_FRUTA, anotar(destinos))

  assert.deepEqual(destinos, ["raíz"])
})

test("una hija tiene por contenedor a su madre, no a la lista de hijas", () => {
  const destinos: string[] = []

  updateContainerOf(listaDeLaCompra(), ID_PERAS, anotar(destinos))

  assert.deepEqual(destinos, ["Fruta"])
})

test("la búsqueda baja más de un nivel", () => {
  const destinos: string[] = []

  updateContainerOf(listaDeLaCompra(), ID_GOLDEN, anotar(destinos))

  assert.deepEqual(destinos, ["Manzanas"], "el contenedor de 'Golden' es 'Manzanas'")
})

test("no llama a ninguna transformación si el id no existe", () => {
  const destinos: string[] = []

  updateContainerOf(listaDeLaCompra(), ID_INEXISTENTE, anotar(destinos))

  assert.deepEqual(destinos, [])
})

/* ══════════════════════════ Identidad ══════════════════════════ */

test("devuelve el array de entrada intacto si el id no existe", () => {
  const antes = listaDeLaCompra()

  assert.strictEqual(updateContainerOf(antes, ID_INEXISTENTE, quitar(ID_PERAS)), antes)
})

test("devuelve el array de entrada intacto si la transformación no cambia nada", () => {
  const antes = listaDeLaCompra()

  assert.strictEqual(updateContainerOf(antes, ID_COMPRA, NADA), antes, "en la raíz")
  assert.strictEqual(updateContainerOf(antes, ID_PERAS, NADA), antes, "en una hija")
  assert.strictEqual(updateContainerOf(antes, ID_GOLDEN, NADA), antes, "en una nieta")
})

/* ═════════════════════ Reescribe, y sólo el camino ═════════════════════ */

test("quita una línea de la raíz", () => {
  const antes = listaDeLaCompra()

  const despues = updateContainerOf(antes, ID_COMPRA, quitar(ID_COMPRA))

  assert.equal(despues.length, 2)
  assert.strictEqual(bloqueEn(despues, 0), bloqueEn(antes, 1), "'Fruta' es el mismo objeto")
  assert.strictEqual(bloqueEn(despues, 1), bloqueEn(antes, 2), "'Limpieza' también")
})

test("quita una hija, y no toca ninguna otra rama", () => {
  const antes = listaDeLaCompra()

  const despues = updateContainerOf(antes, ID_PERAS, quitar(ID_PERAS))

  const frutaDespues = casillaEn(despues, 1)
  assert.equal(frutaDespues.children.length, 1)
  assert.equal(hijaEn(frutaDespues.children, 0).text, "Manzanas")

  /* Lo que NO se tocó sigue siendo el mismo objeto */
  assert.strictEqual(bloqueEn(despues, 0), bloqueEn(antes, 0), "'Compra semanal' intacto")
  assert.strictEqual(casillaEn(despues, 2), casillaEn(antes, 2), "'Limpieza' intacta")
  assert.strictEqual(
    hijaEn(frutaDespues.children, 0),
    hijaEn(casillaEn(antes, 1).children, 0),
    "'Manzanas' intacta, con su nieta dentro",
  )
})

test("quita una nieta copiando sólo el camino: raíz, Fruta y Manzanas", () => {
  const antes = listaDeLaCompra()

  const despues = updateContainerOf(antes, ID_GOLDEN, quitar(ID_GOLDEN))

  const frutaDespues = casillaEn(despues, 1)
  const manzanasDespues = hijaEn(frutaDespues.children, 0)
  assert.equal(manzanasDespues.children.length, 0)

  /* Nuevos: los tres del camino */
  assert.notStrictEqual(despues, antes)
  assert.notStrictEqual(frutaDespues, casillaEn(antes, 1))
  assert.notStrictEqual(manzanasDespues, hijaEn(casillaEn(antes, 1).children, 0))

  /* Compartidos: todo lo demás */
  assert.strictEqual(bloqueEn(despues, 0), bloqueEn(antes, 0), "'Compra semanal' intacto")
  assert.strictEqual(casillaEn(despues, 2), casillaEn(antes, 2), "'Limpieza' intacta")
  assert.strictEqual(
    hijaEn(frutaDespues.children, 1),
    hijaEn(casillaEn(antes, 1).children, 1),
    "'Peras' intacta",
  )
})

test("no muta el árbol original", () => {
  const antes = listaDeLaCompra()

  updateContainerOf(antes, ID_PERAS, quitar(ID_PERAS))

  assert.equal(casillaEn(antes, 1).children.length, 2)
})

/* ══════════════ La madre entera, no sólo su lista de hijas ══════════════
    Es lo que necesitará `merge` para absorber a su primera hija: cambiar de
    texto Y perder una hija en la misma operación. */

test("onParent puede cambiar la madre y sus hijas a la vez", () => {
  const antes = listaDeLaCompra()

  const despues = updateContainerOf(antes, ID_PERAS, {
    onRoot: (items) => items,
    onParent: (parent) => ({
      ...parent,
      text: `${parent.text}Peras`,
      children: parent.children.filter((child) => child.id !== ID_PERAS),
    }),
  })

  const frutaDespues = casillaEn(despues, 1)
  assert.equal(frutaDespues.text, "FrutaPeras")
  assert.equal(frutaDespues.children.length, 1)
})
