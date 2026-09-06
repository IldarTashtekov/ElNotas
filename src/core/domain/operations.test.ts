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
import { after, lastChildOf, rootEnd } from "./Position"
import {
  convertToCheckBox,
  convertToText,
  insert,
  remove,
  setChecked,
  setText,
} from "./operations"

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
const ID_FREGONA = contentId("fregona")
const ID_INEXISTENTE = contentId("no-existe")
const ID_NUEVO = contentId("nuevo")

const listaDeLaCompra = (): ReadonlyArray<Content> => [
  text(ID_COMPRA, "Compra semanal"),
  checkBox(ID_FRUTA, "Fruta", {
    children: [checkBox(ID_MANZANAS, "Manzanas"), checkBox(ID_PERAS, "Peras")],
  }),
  checkBox(ID_LIMPIEZA, "Limpieza", {
    children: [checkBox(ID_FREGONA, "Fregona")],
  }),
]

const casillaNueva = () => checkBox(ID_NUEVO, "Plátanos")
const textoNuevo = () => text(ID_NUEVO, "Nota al margen")

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

/* ══════════════════════════════ insert ══════════════════════════════ */

test("insert root-end: añade al final de la raíz, sea texto o casilla", () => {
  const antes = listaDeLaCompra()

  const conCasilla = insert(antes, casillaNueva(), rootEnd)
  assert.equal(conCasilla.length, 4)
  assert.equal(bloqueEn(conCasilla, 3).text, "Plátanos")

  const conTexto = insert(antes, textoNuevo(), rootEnd)
  assert.equal(bloqueEn(conTexto, 3).text, "Nota al margen")
})

test("insert root-end: no copia lo que ya estaba", () => {
  const antes = listaDeLaCompra()

  const despues = insert(antes, casillaNueva(), rootEnd)

  assert.strictEqual(bloqueEn(despues, 0), bloqueEn(antes, 0))
  assert.strictEqual(bloqueEn(despues, 1), bloqueEn(antes, 1))
  assert.strictEqual(bloqueEn(despues, 2), bloqueEn(antes, 2))
})

test("insert after: mete justo detrás, en la raíz", () => {
  const antes = listaDeLaCompra()

  const despues = insert(antes, casillaNueva(), after(ID_COMPRA))

  assert.equal(despues.length, 4)
  assert.equal(bloqueEn(despues, 1).text, "Plátanos", "detrás de 'Compra semanal'")
  assert.equal(bloqueEn(despues, 2).text, "Fruta", "y 'Fruta' se corre una posición")
})

test("insert after: mete justo detrás de una hermana, en profundidad", () => {
  const antes = listaDeLaCompra()

  const despues = insert(antes, casillaNueva(), after(ID_MANZANAS))

  const hijas = casillaEn(despues, 1).children
  assert.equal(hijas.length, 3)
  assert.equal(hijaEn(hijas, 1).text, "Plátanos")
  assert.strictEqual(casillaEn(despues, 2), casillaEn(antes, 2), "'Limpieza' intacta")
})

test("insert after: no hace nada si el destino no existe", () => {
  const antes = listaDeLaCompra()

  assert.strictEqual(insert(antes, casillaNueva(), after(ID_INEXISTENTE)), antes)
})

/* El caso que el compilador ya impide escribir mal, y que aquí se comprueba
   que además no hace nada en tiempo de ejecución. */
test("insert after: no hace nada al meter un texto suelto entre hijas", () => {
  const antes = listaDeLaCompra()

  assert.strictEqual(
    insert(antes, textoNuevo(), after(ID_MANZANAS)),
    antes,
    "un texto no cabe dentro de una casilla",
  )
})

test("insert last-child-of: añade como última hija", () => {
  const antes = listaDeLaCompra()

  const despues = insert(antes, casillaNueva(), lastChildOf(ID_FRUTA))

  const hijas = casillaEn(despues, 1).children
  assert.equal(hijas.length, 3)
  assert.equal(hijaEn(hijas, 2).text, "Plátanos", "la última")
})

test("insert last-child-of: funciona sobre una casilla que aún no tiene hijas", () => {
  const antes = listaDeLaCompra()

  const despues = insert(antes, casillaNueva(), lastChildOf(ID_PERAS))

  const peras = hijaEn(casillaEn(despues, 1).children, 1)
  assert.equal(peras.children.length, 1)
  assert.equal(hijaEn(peras.children, 0).text, "Plátanos")
})

test("insert last-child-of: no hace nada si el destino es un texto suelto", () => {
  const antes = listaDeLaCompra()

  assert.strictEqual(
    insert(antes, casillaNueva(), lastChildOf(ID_COMPRA)),
    antes,
    "un texto no tiene hijas",
  )
})

test("insert last-child-of: no hace nada al meter un texto suelto dentro", () => {
  const antes = listaDeLaCompra()

  assert.strictEqual(insert(antes, textoNuevo(), lastChildOf(ID_FRUTA)), antes)
})

test("insert last-child-of: no hace nada si el destino no existe", () => {
  const antes = listaDeLaCompra()

  assert.strictEqual(insert(antes, casillaNueva(), lastChildOf(ID_INEXISTENTE)), antes)
})

/* La fila que no estaba en la tabla y se añadió al implementar. */
test("insert: no hace nada si ya existe una línea con ese id", () => {
  const antes = listaDeLaCompra()
  const repetida = checkBox(ID_PERAS, "Peras impostoras")

  assert.strictEqual(insert(antes, repetida, rootEnd), antes, "en la raíz")
  assert.strictEqual(insert(antes, repetida, after(ID_COMPRA)), antes, "detrás de otra")
  assert.strictEqual(insert(antes, repetida, lastChildOf(ID_FRUTA)), antes, "como hija")
})

test("insert: detecta el id repetido esté a la profundidad que esté", () => {
  const antes = listaDeLaCompra()

  assert.strictEqual(
    insert(antes, checkBox(ID_FREGONA, "Otra fregona"), rootEnd),
    antes,
    "'Fregona' vive anidada, y aun así se detecta",
  )
})

/* ══════════════════════════════ remove ══════════════════════════════ */

test("remove: saca una línea de la raíz", () => {
  const antes = listaDeLaCompra()

  const despues = remove(antes, ID_COMPRA)

  assert.equal(despues.length, 2)
  assert.strictEqual(bloqueEn(despues, 0), bloqueEn(antes, 1), "'Fruta' es el mismo objeto")
})

test("remove: saca una hija sin hijas propias", () => {
  const antes = listaDeLaCompra()

  const despues = remove(antes, ID_PERAS)

  const hijas = casillaEn(despues, 1).children
  assert.equal(hijas.length, 1)
  assert.equal(hijaEn(hijas, 0).text, "Manzanas")
  assert.strictEqual(casillaEn(despues, 2), casillaEn(antes, 2), "'Limpieza' intacta")
})

test("remove: no hace nada si el id no existe", () => {
  const antes = listaDeLaCompra()

  assert.strictEqual(remove(antes, ID_INEXISTENTE), antes)
})

/* La decisión (b), y la que más cambia cómo se siente la app. */
test("remove: NO borra una casilla con hijas", () => {
  const antes = listaDeLaCompra()

  assert.strictEqual(remove(antes, ID_FRUTA), antes, "'Fruta' tiene dos hijas")
  assert.strictEqual(remove(antes, ID_LIMPIEZA), antes, "'Limpieza' tiene una")
})

test("remove: sí borra la casilla una vez vaciada de hijas, de abajo arriba", () => {
  let arbol = listaDeLaCompra()

  arbol = remove(arbol, ID_MANZANAS)
  arbol = remove(arbol, ID_PERAS)
  arbol = remove(arbol, ID_FRUTA)

  assert.equal(arbol.length, 2)
  assert.equal(bloqueEn(arbol, 0).text, "Compra semanal")
  assert.equal(bloqueEn(arbol, 1).text, "Limpieza")
})

test("remove: no muta el árbol original", () => {
  const antes = listaDeLaCompra()

  remove(antes, ID_PERAS)

  assert.equal(casillaEn(antes, 1).children.length, 2)
})

/* ═══════════════════════ convertToCheckBox ═══════════════════════ */

test("convertToCheckBox: un texto suelto pasa a casilla sin marcar y sin hijas", () => {
  const antes = listaDeLaCompra()

  const despues = convertToCheckBox(antes, ID_COMPRA)

  const convertida = casillaEn(despues, 0)
  assert.equal(convertida.text, "Compra semanal", "el texto se conserva")
  assert.equal(convertida.checked, false)
  assert.equal(convertida.children.length, 0)
})

/* La regla de identidad: es la MISMA línea con otra pinta. */
test("convertToCheckBox: conserva el id de la línea", () => {
  const antes = listaDeLaCompra()

  const despues = convertToCheckBox(antes, ID_COMPRA)

  assert.equal(casillaEn(despues, 0).id, ID_COMPRA)
})

test("convertToCheckBox: no hace nada si el id no existe", () => {
  const antes = listaDeLaCompra()

  assert.strictEqual(convertToCheckBox(antes, ID_INEXISTENTE), antes)
})

test("convertToCheckBox: no hace nada si ya es una casilla", () => {
  const antes = listaDeLaCompra()

  assert.strictEqual(convertToCheckBox(antes, ID_FRUTA), antes, "en la raíz")
  assert.strictEqual(convertToCheckBox(antes, ID_PERAS), antes, "anidada")
})

test("convertToCheckBox: no toca el resto del árbol", () => {
  const antes = listaDeLaCompra()

  const despues = convertToCheckBox(antes, ID_COMPRA)

  assert.strictEqual(bloqueEn(despues, 1), bloqueEn(antes, 1), "'Fruta' intacta")
  assert.strictEqual(bloqueEn(despues, 2), bloqueEn(antes, 2), "'Limpieza' intacta")
})

/* ═══════════════════════ convertToText ═══════════════════════ */

test("convertToText: una casilla de la raíz sin hijas pasa a texto suelto", () => {
  const soloCasilla: ReadonlyArray<Content> = [checkBox(ID_NUEVO, "Plátanos")]

  const despues = convertToText(soloCasilla, ID_NUEVO)

  const convertida = bloqueEn(despues, 0)
  assert.equal(isCheckBox(convertida), false, "ya no es casilla")
  assert.equal(convertida.text, "Plátanos")
  assert.equal(convertida.id, ID_NUEVO, "conserva el id")
})

test("convertToText: no hace nada si el id no existe", () => {
  const antes = listaDeLaCompra()

  assert.strictEqual(convertToText(antes, ID_INEXISTENTE), antes)
})

test("convertToText: no hace nada si ya es un texto", () => {
  const antes = listaDeLaCompra()

  assert.strictEqual(convertToText(antes, ID_COMPRA), antes)
})

/* Misma regla que `remove`: nada que haga desaparecer estructura se lleva por
   delante lo que cuelga de ella. */
test("convertToText: NO convierte una casilla con hijas", () => {
  const antes = listaDeLaCompra()

  assert.strictEqual(
    convertToText(antes, ID_FRUTA),
    antes,
    "las hijas se quedarían colgando de nada",
  )
})

/* La decisión del Hueco 1: un texto sólo cabe en la raíz. */
test("convertToText: NO convierte una casilla anidada, ni aunque no tenga hijas", () => {
  const antes = listaDeLaCompra()

  assert.strictEqual(convertToText(antes, ID_PERAS), antes, "'Peras' no tiene hijas, pero está dentro")
  assert.strictEqual(convertToText(antes, ID_FREGONA), antes, "'Fregona' igual")
})

test("convertToText: sí convierte una casilla una vez vaciada de hijas", () => {
  let arbol = listaDeLaCompra()

  arbol = remove(arbol, ID_FREGONA)
  arbol = convertToText(arbol, ID_LIMPIEZA)

  assert.equal(isCheckBox(bloqueEn(arbol, 2)), false)
  assert.equal(bloqueEn(arbol, 2).text, "Limpieza")
})

/* ═══════════ Las dos juntas: ida y vuelta ═══════════ */

test("texto → casilla → texto devuelve una línea equivalente, y con el mismo id", () => {
  const antes = listaDeLaCompra()

  const ida = convertToCheckBox(antes, ID_COMPRA)
  const vuelta = convertToText(ida, ID_COMPRA)

  const original = bloqueEn(antes, 0)
  const final = bloqueEn(vuelta, 0)
  assert.equal(final.type, original.type)
  assert.equal(final.id, original.id)
  assert.equal(final.text, original.text)
})
