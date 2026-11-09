/**
 * Lo pegado, leído como líneas: las casillas por su marca, anidadas por su
 * sangría, y el resto como textos sueltos, tal cual.
 */

import { test } from "node:test"
import assert from "node:assert/strict"

import type { ContentDraft } from "#core/index"
import { isInlinePaste, pastedLines } from "#ui/pastedLines"

const t = (texto: string): ContentDraft => ({ type: "text", text: texto })
const c = (texto: string, hijas: ReadonlyArray<ContentDraft> = [], checked: boolean = false): ContentDraft => ({
  type: "checkbox",
  text: texto,
  checked,
  children: hijas.flatMap((h: ContentDraft): ReadonlyArray<ContentDraft & { type: "checkbox" }> =>
    h.type === "checkbox" ? [h] : [],
  ),
})

test("un renglón sin marca es un texto, tal cual, con su sangría y su Markdown", (): void => {
  assert.deepEqual(pastedLines("  **hola** [x](#n)"), [t("  **hola** [x](#n)")])
})

test("las casillas, por su marca: con guion o asterisco, y la x en minúscula o mayúscula", (): void => {
  assert.deepEqual(pastedLines("- [ ] a\n- [x] b\n* [X] c\n- [ ]"), [c("a"), c("b", [], true), c("c", [], true), c("")])
})

test("lo que se parece pero no es casilla, es texto", (): void => {
  assert.deepEqual(pastedLines("-[ ] a\n- [y] b\n- [ ]a"), [t("-[ ] a"), t("- [y] b"), t("- [ ]a")])
})

test("una casilla más sangrada que la de encima es su hija, a cualquier profundidad", (): void => {
  assert.deepEqual(pastedLines("- [ ] a\n  - [x] a1\n    - [ ] a11\n  - [ ] a2\n- [ ] b"), [
    c("a", [c("a1", [c("a11")], true), c("a2")]),
    c("b"),
  ])
})

test("la sangría se compara, no se cuenta: con cuatro espacios o con tabuladores, igual", (): void => {
  const esperado: ReadonlyArray<ContentDraft> = [c("a", [c("a1")]), c("b")]
  assert.deepEqual(pastedLines("- [ ] a\n    - [ ] a1\n- [ ] b"), esperado)
  assert.deepEqual(pastedLines("- [ ] a\n\t- [ ] a1\n- [ ] b"), esperado)
})

test("una casilla sangrada sin casilla encima va a la raíz", (): void => {
  assert.deepEqual(pastedLines("    - [ ] a\n- [ ] b"), [c("a"), c("b")])
})

test("un texto corta el anidado: la casilla sangrada de debajo va a la raíz", (): void => {
  assert.deepEqual(pastedLines("- [ ] a\nmedio\n  - [ ] b"), [c("a"), t("medio"), c("b")])
})

test("los renglones vacíos del final no cuentan; los de en medio, y el retorno de Windows, sí", (): void => {
  assert.deepEqual(pastedLines("a\r\n\r\nb\r\n\n"), [t("a"), t(""), t("b")])
})

test("un solo texto entra dentro de la línea; una casilla o varias líneas, no", (): void => {
  assert.equal(isInlinePaste(pastedLines("hola")), true)
  assert.equal(isInlinePaste(pastedLines("hola\n")), true)
  assert.equal(isInlinePaste(pastedLines("- [ ] hola")), false)
  assert.equal(isInlinePaste(pastedLines("a\nb")), false)
})

test("un pegado de miles de renglones se lee sin agotar la pila", (): void => {
  const muchos: string = Array.from({ length: 20000 }, (_: unknown, i: number): string =>
    i % 2 === 0 ? `- [ ] ${i}` : `linea ${i}`,
  ).join("\n")
  assert.equal(pastedLines(muchos).length, 20000)
  const hermanas: string = Array.from({ length: 20000 }, (_: unknown, i: number): string => `  - [ ] ${i}`).join("\n")
  const [madre] = pastedLines(`- [ ] madre\n${hermanas}`)
  assert.equal(madre?.type === "checkbox" && madre.children.length, 20000)
})
