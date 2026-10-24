/**
 * Lo que se copia de una nota: una línea por renglón, en el orden en que se
 * leen, sin marcas de casilla y cortando la primera y la última donde empieza y
 * acaba la selección.
 */

import { test } from "node:test"
import assert from "node:assert/strict"

import type { Content } from "#core/index"
import { checkBox, text } from "#core/domain/Content"
import { contentId } from "#core/index"
import type { Caret } from "#ui/editor"
import { copiedText } from "#ui/copyText"

/*
    T Intro del día
    C Compra          (marcada)
      C Leche
      C Pan
    T
    T Fin
*/
const NOTA: ReadonlyArray<Content> = [
  text(contentId("intro"), "Intro del día"),
  checkBox(contentId("compra"), "Compra", {
    checked: true,
    children: [checkBox(contentId("leche"), "Leche"), checkBox(contentId("pan"), "Pan")],
  }),
  text(contentId("vacia"), ""),
  text(contentId("fin"), "Fin"),
]

const en = (id: string, offset: number): Caret => ({ line: contentId(id), offset })

test("dentro de una línea, sólo lo seleccionado", (): void => {
  assert.equal(copiedText(NOTA, en("intro", 6), en("intro", 9)), "del")
})

test("de una línea a otra: la primera desde donde empieza, la última hasta donde acaba", (): void => {
  assert.equal(copiedText(NOTA, en("intro", 6), en("compra", 3)), "del día\nCom")
})

test("las hijas van detrás de su casilla, y ninguna lleva su marca", (): void => {
  assert.equal(copiedText(NOTA, en("compra", 0), en("pan", 3)), "Compra\nLeche\nPan")
})

test("una línea vacía en medio es un renglón vacío", (): void => {
  assert.equal(copiedText(NOTA, en("pan", 0), en("fin", 3)), "Pan\n\nFin")
})

test("al revés, o con una línea que no está, no se copia nada", (): void => {
  assert.equal(copiedText(NOTA, en("fin", 0), en("intro", 3)), "")
  assert.equal(copiedText(NOTA, en("no-esta", 0), en("fin", 3)), "")
})
