/**
 * Lo que se copia de una nota. Dentro de una línea, el trozo, contando lo que se
 * ve. De una línea a otra, las líneas enteras como se guardan, en el orden en que
 * se leen, cada casilla con su marca y las hijas sangradas.
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

test("de una línea a otra van las líneas enteras, aunque la selección empiece o acabe en medio", (): void => {
  assert.equal(copiedText(NOTA, en("intro", 6), en("compra", 3), null), "Intro del día\n- [x] Compra")
})

test("cada casilla con su marca, y las hijas detrás de su casilla, sangradas dos espacios", (): void => {
  assert.equal(copiedText(NOTA, en("compra", 0), en("pan", 3), null), "- [x] Compra\n  - [ ] Leche\n  - [ ] Pan")
})

test("la sangría cuenta desde la menos honda de las copiadas", (): void => {
  assert.equal(copiedText(NOTA, en("leche", 2), en("pan", 1), null), "- [ ] Leche\n- [ ] Pan")
})

test("una línea vacía en medio es un renglón vacío; con un texto, la hija sigue sangrada", (): void => {
  assert.equal(copiedText(NOTA, en("pan", 0), en("fin", 3), null), "  - [ ] Pan\n\nFin")
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

test("de una línea a otra, el formato y los enlaces van como se guardan", (): void => {
  assert.equal(
    copiedText(CON_FORMATO, en("titulo", 0), en("cola", 4), null),
    "# Título\na **b** [web](https://x.com)\n*c* \\*d",
  )
})

test("dentro de una línea, los offset cuentan lo que se ve, y sale sin marcas", (): void => {
  /* Lo que se ve de la del medio es «a b web»: de la 2 a la 7, «b web». */
  assert.equal(copiedText(CON_FORMATO, en("medio", 2), en("medio", 7), null), "b web")
})

test("dentro de la línea que se ve en crudo, se copia en crudo", (): void => {
  assert.equal(copiedText(CON_FORMATO, en("medio", 2), en("medio", 7), contentId("medio")), "**b**")
})
