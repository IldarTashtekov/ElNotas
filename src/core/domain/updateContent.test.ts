/**
 * Pruebas del helper de copia por camino.
 *
 * ⚠️ Aquí se comprueban REFERENCIAS, no valores. Por eso `assert.strictEqual` y
 * nunca `deepStrictEqual`: un `deepEqual` pasa igual de verde con una
 * implementación que rompe la invariante de identidad, porque el contenido sería
 * correcto y sólo las referencias estarían mal. Es la clase de prueba que da
 * confianza sin dar garantía (`ARCHITECTURE.md` §2.3).
 */

import { test } from "node:test"
import assert from "node:assert/strict"

import type { CheckBox, Content } from "./Content"
import { checkBox, isCheckBox, text } from "./Content"
import { contentId } from "./Ids"
import type { NodeTransform } from "./updateContent"
import { mapPreservingIdentity, updateContent } from "./updateContent"

/* ────────────────────────── El árbol de pruebas ──────────────────────────
    Es la lista de la compra de ARCHITECTURE.md §2.3, para que el ejemplo del
    documento y el de las pruebas sean literalmente el mismo:

        Text     "Compra semanal"
        CheckBox "Fruta"
          ├── CheckBox "Manzanas"
          └── CheckBox "Peras"      ← la que se marca
        CheckBox "Limpieza"
          └── CheckBox "Fregona"
*/

const ID_COMPRA = contentId("compra")
const ID_FRUTA = contentId("fruta")
const ID_MANZANAS = contentId("manzanas")
const ID_PERAS = contentId("peras")
const ID_LIMPIEZA = contentId("limpieza")
const ID_FREGONA = contentId("fregona")
const ID_INEXISTENTE = contentId("no-existe")

const listaDeLaCompra = (): ReadonlyArray<Content> => [
  text(ID_COMPRA, "Compra semanal"),
  checkBox(ID_FRUTA, "Fruta", {
    children: [
      checkBox(ID_MANZANAS, "Manzanas"),
      checkBox(ID_PERAS, "Peras"),
    ],
  }),
  checkBox(ID_LIMPIEZA, "Limpieza", {
    children: [checkBox(ID_FREGONA, "Fregona")],
  }),
]

/** Transformación que no toca nada. La usan las pruebas de no-op. */
const SIN_CAMBIOS: NodeTransform = { onText: (t) => t, onCheckBox: (c) => c }

/** Marca una casilla, preservando la identidad si ya estaba en ese valor. */
const marcar = (checked: boolean): NodeTransform => ({
  onText: (t) => t,
  onCheckBox: (c) => (c.checked === checked ? c : { ...c, checked }),
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

/* ───────────────────── 1. Identidad: el id no existe ───────────────────── */

test("devuelve el array de entrada intacto si el id no existe", () => {
  const antes = listaDeLaCompra()

  const despues = updateContent(antes, ID_INEXISTENTE, marcar(true))

  assert.strictEqual(despues, antes)
})

/* ──────── 2. Identidad: el id existe pero la transformación no cambia ────────
    Éste es el que se olvida: el id SÍ está, se llega hasta él, y aun así no
    puede salir un array nuevo. */

test("devuelve el array de entrada intacto si la transformación no cambia nada", () => {
  const antes = listaDeLaCompra()

  const despues = updateContent(antes, ID_PERAS, marcar(false))

  assert.strictEqual(despues, antes, "Peras ya estaba sin marcar: no debía cambiar nada")
})

test("intacto también cuando el objetivo está en la raíz", () => {
  const antes = listaDeLaCompra()

  const despues = updateContent(antes, ID_COMPRA, SIN_CAMBIOS)

  assert.strictEqual(despues, antes)
})

/* ─────────────── 3. Copia por camino: exactamente tres objetos ───────────────
    Al marcar "Peras" se reconstruye sólo raíz → Fruta → Peras. Todo lo demás
    sigue siendo literalmente el mismo objeto en memoria. */

test("al marcar Peras se reconstruye sólo el camino hasta ella", () => {
  const antes = listaDeLaCompra()

  const despues = updateContent(antes, ID_PERAS, marcar(true))

  /* Valor: la casilla quedó marcada */
  const frutaDespues = casillaEn(despues, 1)
  assert.equal(hijaEn(frutaDespues.children, 1).checked, true)

  /* Identidad — lo que SÍ es nuevo: los tres del camino */
  assert.notStrictEqual(despues, antes, "el array raíz es nuevo")
  assert.notStrictEqual(frutaDespues, casillaEn(antes, 1), "Fruta es nueva")
  assert.notStrictEqual(
    hijaEn(frutaDespues.children, 1),
    hijaEn(casillaEn(antes, 1).children, 1),
    "Peras es nueva",
  )

  /* Identidad — lo que NO se tocó: sigue siendo el mismo objeto */
  assert.strictEqual(bloqueEn(despues, 0), bloqueEn(antes, 0), "'Compra semanal' intacto")
  assert.strictEqual(
    casillaEn(despues, 2),
    casillaEn(antes, 2),
    "'Limpieza' intacta, y con ella todo su subárbol",
  )
  assert.strictEqual(
    hijaEn(frutaDespues.children, 0),
    hijaEn(casillaEn(antes, 1).children, 0),
    "'Manzanas' intacta",
  )
})

test("el árbol de antes sigue intacto: nada se modificó en el sitio", () => {
  const antes = listaDeLaCompra()

  updateContent(antes, ID_PERAS, marcar(true))

  assert.equal(
    hijaEn(casillaEn(antes, 1).children, 1).checked,
    false,
    "marcar no debe mutar el árbol original",
  )
})

/* ──────────────── 4. La discriminación entre texto y casilla ──────────────── */

test("un bloque de la raíz usa onText, y una casilla usa onCheckBox", () => {
  const antes = listaDeLaCompra()
  const llamadas: string[] = []

  updateContent(antes, ID_COMPRA, {
    onText: (t) => {
      llamadas.push("onText")
      return t
    },
    onCheckBox: (c) => {
      llamadas.push("onCheckBox")
      return c
    },
  })
  updateContent(antes, ID_FREGONA, {
    onText: (t) => {
      llamadas.push("onText")
      return t
    },
    onCheckBox: (c) => {
      llamadas.push("onCheckBox")
      return c
    },
  })

  assert.deepEqual(llamadas, ["onText", "onCheckBox"])
})

test("cambia el texto de un bloque de la raíz", () => {
  const antes = listaDeLaCompra()

  const despues = updateContent(antes, ID_COMPRA, {
    onText: (t) => ({ ...t, text: "Compra del sábado" }),
    onCheckBox: (c) => c,
  })

  const bloque = bloqueEn(despues, 0)
  assert.equal(bloque.text, "Compra del sábado")
  assert.strictEqual(bloqueEn(despues, 1), bloqueEn(antes, 1), "el resto, intacto")
})

/* ───────────── 5. El envoltorio, probado por separado ─────────────
    Es la pieza que carga con la invariante: merece sus propias pruebas y no
    sólo llegar probada de rebote. */

test("mapPreservingIdentity devuelve la entrada si nada cambió", () => {
  const items = [{ n: 1 }, { n: 2 }]

  assert.strictEqual(mapPreservingIdentity(items, (x) => x), items)
})

test("mapPreservingIdentity devuelve array nuevo si cambió un solo elemento", () => {
  const primero = { n: 1 }
  const segundo = { n: 2 }
  const items = [primero, segundo]

  const next = mapPreservingIdentity(items, (x) => (x.n === 2 ? { n: 20 } : x))

  assert.notStrictEqual(next, items)
  assert.strictEqual(next[0], primero, "el que no cambió sigue siendo el mismo objeto")
})
