/**
 * El recorrido del contenido de una nota: el orden en que se lee y la línea de
 * al lado, que es lo que usan las flechas para saltar de una línea a otra.
 */

import { test } from "node:test"
import assert from "node:assert/strict"

import type { Content } from "#core/index"
import { checkBox, text } from "#core/domain/Content"
import { contentId } from "#core/index"
import { inReadingOrder, lastLine, lineBeside, mergeTarget, rootAncestor } from "#ui/noteTree"

/*
    T intro
    C compra
      C leche
        C entera
      C pan
    T fin
*/
const NOTA: ReadonlyArray<Content> = [
  text(contentId("intro"), "Intro"),
  checkBox(contentId("compra"), "Compra", {
    children: [
      checkBox(contentId("leche"), "Leche", { children: [checkBox(contentId("entera"), "Entera")] }),
      checkBox(contentId("pan"), "Pan"),
    ],
  }),
  text(contentId("fin"), "Fin"),
]

const ids = (lineas: ReadonlyArray<Content>): ReadonlyArray<string> =>
  lineas.map((l: Content): string => l.id)

test("se lee de arriba abajo: cada casilla y, detrás, sus hijas", (): void => {
  assert.deepEqual(ids(inReadingOrder(NOTA)), ["intro", "compra", "leche", "entera", "pan", "fin"])
})

test("la línea de al lado cruza niveles, hacia arriba y hacia abajo", (): void => {
  assert.equal(lineBeside(NOTA, contentId("entera"), "next")?.id, "pan")
  assert.equal(lineBeside(NOTA, contentId("pan"), "prev")?.id, "entera")
  assert.equal(lineBeside(NOTA, contentId("compra"), "prev")?.id, "intro")
})

test("en los bordes de la nota no hay línea de al lado", (): void => {
  assert.equal(lineBeside(NOTA, contentId("intro"), "prev"), null)
  assert.equal(lineBeside(NOTA, contentId("fin"), "next"), null)
})

test("la última línea que se ve, aunque sea una hija honda; ninguna si la nota está vacía", (): void => {
  assert.equal(lastLine(NOTA)?.id, "fin")
  /* Sin «Fin», la de más abajo es «Pan», la hija de «Compra», no «Compra». */
  assert.equal(lastLine(NOTA.slice(0, 2))?.id, "pan")
  assert.equal(lastLine([]), null)
})

test("la casilla de la raíz de una anidada, por hondo que esté", (): void => {
  assert.equal(rootAncestor(NOTA, contentId("entera"))?.id, "compra")
  assert.equal(rootAncestor(NOTA, contentId("fin"))?.id, "fin")
})

test("quién recibe el texto al unir: la línea que se ve encima, o la madre si es la primera", (): void => {
  /* Encima de «Pan» se ve «Entera», la hija de «Leche»: es ella, no «Leche». */
  assert.equal(mergeTarget(NOTA, contentId("pan"))?.id, "entera")
  assert.equal(mergeTarget(NOTA, contentId("leche"))?.id, "compra")
  assert.equal(mergeTarget(NOTA, contentId("intro")), null)
})
