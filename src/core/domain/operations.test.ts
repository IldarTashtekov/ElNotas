/**
 * Pruebas de las operaciones de contenido.
 *
 * Cada operación se prueba por **valor** (hace lo que dice) y por **identidad**
 * (y no hace nada más). Los casos de "no hace nada" son la mitad de la
 * especificación, así que cada fila de la tabla de `ARCHITECTURE.md` §9.3 tiene
 * aquí su prueba, con `assert.strictEqual` y nunca `deepStrictEqual`.
 */

import { test } from "node:test"
import assert from "node:assert/strict"

import type { CheckBox, Content } from "./Content"
import { checkBox, isCheckBox, text } from "./Content"
import { contentId } from "./Ids"
import { setChecked, setText } from "./operations"

/* ─────────────────────────── El árbol de pruebas ───────────────────────────
    La misma lista de la compra de ARCHITECTURE.md §2.3:

        Text     "Compra semanal"
        CheckBox "Fruta"
          ├── CheckBox "Manzanas"
          └── CheckBox "Peras"
        CheckBox "Limpieza"
          └── CheckBox "Fregona"
*/

const ID_COMPRA = contentId("compra")
const ID_FRUTA = contentId("fruta")
const ID_MANZANAS = contentId("manzanas")
const ID_PERAS = contentId("peras")
const ID_LIMPIEZA = contentId("limpieza")
const ID_INEXISTENTE = contentId("no-existe")

const listaDeLaCompra = (): ReadonlyArray<Content> => [
  text(ID_COMPRA, "Compra semanal"),
  checkBox(ID_FRUTA, "Fruta", {
    children: [checkBox(ID_MANZANAS, "Manzanas"), checkBox(ID_PERAS, "Peras")],
  }),
  checkBox(ID_LIMPIEZA, "Limpieza", {
    children: [checkBox(contentId("fregona"), "Fregona")],
  }),
]

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

/* ══════════════════════════════ setText ══════════════════════════════ */

test("setText: no hace nada si el id no existe", () => {
  const antes = listaDeLaCompra()

  assert.strictEqual(setText(antes, ID_INEXISTENTE, "Lo que sea"), antes)
})

test("setText: no hace nada si el texto ya es ese", () => {
  const antes = listaDeLaCompra()

  assert.strictEqual(setText(antes, ID_FRUTA, "Fruta"), antes)
  assert.strictEqual(setText(antes, ID_COMPRA, "Compra semanal"), antes)
})

test("setText: cambia el texto de un texto suelto", () => {
  const antes = listaDeLaCompra()

  const despues = setText(antes, ID_COMPRA, "Compra del sábado")

  assert.equal(bloqueEn(despues, 0).text, "Compra del sábado")
})

test("setText: cambia el texto de una casilla sin tocar su marca ni sus hijas", () => {
  const antes = listaDeLaCompra()
  const frutaAntes = casillaEn(antes, 1)

  const despues = setText(antes, ID_FRUTA, "Fruta y verdura")
  const frutaDespues = casillaEn(despues, 1)

  assert.equal(frutaDespues.text, "Fruta y verdura")
  assert.equal(frutaDespues.checked, false)
  assert.strictEqual(
    frutaDespues.children,
    frutaAntes.children,
    "las hijas no se han copiado siquiera",
  )
})

test("setText: no toca las ramas que no van en el camino", () => {
  const antes = listaDeLaCompra()

  const despues = setText(antes, ID_PERAS, "Peras conferencia")

  assert.strictEqual(bloqueEn(despues, 0), bloqueEn(antes, 0), "'Compra semanal' intacto")
  assert.strictEqual(casillaEn(despues, 2), casillaEn(antes, 2), "'Limpieza' intacta")
  assert.strictEqual(
    hijaEn(casillaEn(despues, 1).children, 0),
    hijaEn(casillaEn(antes, 1).children, 0),
    "'Manzanas' intacta",
  )
})

/* ═════════════════════════════ setChecked ═════════════════════════════ */

test("setChecked: no hace nada si el id no existe", () => {
  const antes = listaDeLaCompra()

  assert.strictEqual(setChecked(antes, ID_INEXISTENTE, true), antes)
})

test("setChecked: no hace nada si el id es un texto suelto", () => {
  const antes = listaDeLaCompra()

  assert.strictEqual(
    setChecked(antes, ID_COMPRA, true),
    antes,
    "un texto no tiene marca que poner",
  )
})

test("setChecked: no hace nada si ya está en ese valor", () => {
  const antes = listaDeLaCompra()

  assert.strictEqual(setChecked(antes, ID_PERAS, false), antes)

  const marcada = setChecked(antes, ID_PERAS, true)
  assert.strictEqual(
    setChecked(marcada, ID_PERAS, true),
    marcada,
    "marcar lo ya marcado tampoco",
  )
})

test("setChecked: marca una casilla anidada", () => {
  const antes = listaDeLaCompra()

  const despues = setChecked(antes, ID_PERAS, true)

  assert.equal(hijaEn(casillaEn(despues, 1).children, 1).checked, true)
})

test("setChecked: desmarca igual que marca", () => {
  const marcada = setChecked(listaDeLaCompra(), ID_PERAS, true)

  const despues = setChecked(marcada, ID_PERAS, false)

  assert.equal(hijaEn(casillaEn(despues, 1).children, 1).checked, false)
})

/* La decisión cerrada más fácil de romper sin darse cuenta. */
test("setChecked: NO arrastra a las hijas", () => {
  const antes = listaDeLaCompra()
  const frutaAntes = casillaEn(antes, 1)

  const despues = setChecked(antes, ID_FRUTA, true)
  const frutaDespues = casillaEn(despues, 1)

  assert.equal(frutaDespues.checked, true, "la madre sí se marca")
  assert.equal(hijaEn(frutaDespues.children, 0).checked, false, "'Manzanas' sigue sin marcar")
  assert.equal(hijaEn(frutaDespues.children, 1).checked, false, "'Peras' sigue sin marcar")
  assert.strictEqual(
    frutaDespues.children,
    frutaAntes.children,
    "y ni siquiera se han copiado: es el mismo array",
  )
})

test("setChecked: no muta el árbol original", () => {
  const antes = listaDeLaCompra()

  setChecked(antes, ID_PERAS, true)

  assert.equal(hijaEn(casillaEn(antes, 1).children, 1).checked, false)
})
