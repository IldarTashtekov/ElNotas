/**
 * Lo que se copia de una nota: una línea por renglón, en el orden en que se
 * leen, sin marcas de casilla ni de formato y cortando la primera y la última
 * donde empieza y acaba la selección, contando lo que se ve.
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
  assert.equal(copiedText(NOTA, en("intro", 6), en("intro", 9), null), "del")
})

test("de una línea a otra: la primera desde donde empieza, la última hasta donde acaba", (): void => {
  assert.equal(copiedText(NOTA, en("intro", 6), en("compra", 3), null), "del día\nCom")
})

test("las hijas van detrás de su casilla, y ninguna lleva su marca", (): void => {
  assert.equal(copiedText(NOTA, en("compra", 0), en("pan", 3), null), "Compra\nLeche\nPan")
})

test("una línea vacía en medio es un renglón vacío", (): void => {
  assert.equal(copiedText(NOTA, en("pan", 0), en("fin", 3), null), "Pan\n\nFin")
})

test("al revés, o con una línea que no está, no se copia nada", (): void => {
  assert.equal(copiedText(NOTA, en("fin", 0), en("intro", 3), null), "")
  assert.equal(copiedText(NOTA, en("no-esta", 0), en("fin", 3), null), "")
})

/*
    T # Título
    T a **b** [web](https://x.com)
    T *c* \*d
*/
const CON_FORMATO: ReadonlyArray<Content> = [
  text(contentId("titulo"), "# Título"),
  text(contentId("medio"), "a **b** [web](https://x.com)"),
  text(contentId("cola"), "*c* \\*d"),
]

test("sin las marcas de formato: los enlaces, como su texto visible", (): void => {
  assert.equal(
    copiedText(CON_FORMATO, en("titulo", 0), en("cola", 4), null),
    "Título\na b web\nc *d",
  )
})

test("los offset cuentan lo que se ve, no la cadena cruda", (): void => {
  /* Lo que se ve de la del medio es «a b web»: de la 2 a la 7, «b web». */
  assert.equal(copiedText(CON_FORMATO, en("medio", 2), en("medio", 7), null), "b web")
  assert.equal(copiedText(CON_FORMATO, en("titulo", 3), en("medio", 3), null), "ulo\na b")
})

test("la línea que se ve en crudo se copia en crudo", (): void => {
  assert.equal(copiedText(CON_FORMATO, en("medio", 2), en("medio", 7), contentId("medio")), "**b**")
  assert.equal(
    copiedText(CON_FORMATO, en("titulo", 0), en("medio", 7), contentId("titulo")),
    "# Título\na b web",
  )
})
