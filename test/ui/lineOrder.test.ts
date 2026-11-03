/**
 * El modo Ordenar sin DOM: qué se lleva al arrastrar y dónde cae cada hueco.
 */

import { describe, it } from "node:test"
import assert from "node:assert/strict"

import type { Content, ContentId } from "#core/index"
import { after, before, contentId, lastChildOf, rootEnd } from "#core/index"
import { checkBox, text } from "#core/domain/Content"
import type { FlatLine } from "#ui/lineOrder"
import { dropTarget, flatLines, linesToMove, movesText, remainingLines } from "#ui/lineOrder"

/*
    Texto    "Compra"
    Casilla  "Fruta"
      ├── Casilla "Manzanas"
      └── Casilla "Peras"
    Casilla  "Limpieza"
*/
const COMPRA: ContentId = contentId("compra")
const FRUTA: ContentId = contentId("fruta")
const MANZANAS: ContentId = contentId("manzanas")
const PERAS: ContentId = contentId("peras")
const LIMPIEZA: ContentId = contentId("limpieza")

const nota: ReadonlyArray<Content> = [
  text(COMPRA, "Compra"),
  checkBox(FRUTA, "Fruta", { children: [checkBox(MANZANAS, "Manzanas"), checkBox(PERAS, "Peras")] }),
  checkBox(LIMPIEZA, "Limpieza"),
]

const ids = (lineas: ReadonlyArray<FlatLine>): ReadonlyArray<string> =>
  lineas.map((l: FlatLine): string => `${l.id}@${l.depth}`)

describe("lo que se lleva", (): void => {
  it("las líneas en orden de lectura, con su profundidad", (): void => {
    assert.deepEqual(ids(flatLines(nota)), ["compra@0", "fruta@0", "manzanas@1", "peras@1", "limpieza@0"])
  })

  it("arrastrar una elegida lleva todas las elegidas, en orden de lectura", (): void => {
    assert.deepEqual(linesToMove(nota, new Set([LIMPIEZA, MANZANAS]), LIMPIEZA), [MANZANAS, LIMPIEZA])
  })

  it("arrastrar una sin elegir lleva sólo ésa", (): void => {
    assert.deepEqual(linesToMove(nota, new Set([LIMPIEZA]), PERAS), [PERAS])
  })

  it("las que se quedan no llevan las que se mueven ni sus hijas", (): void => {
    assert.deepEqual(ids(remainingLines(nota, [FRUTA])), ["compra@0", "limpieza@0"])
  })

  it("si va un texto entre las que se mueven, lo dice", (): void => {
    assert.equal(movesText(nota, [FRUTA, COMPRA]), true)
    assert.equal(movesText(nota, [FRUTA, PERAS]), false)
  })
})

describe("dónde caen", (): void => {
  /* Se mueve Limpieza: quedan compra@0, fruta@0, manzanas@1, peras@1. */
  const resto: ReadonlyArray<FlatLine> = remainingLines(nota, [LIMPIEZA])

  it("arriba del todo, delante de la primera y sólo en la raíz", (): void => {
    assert.deepEqual(dropTarget(resto, 0, 3, false), { depth: 0, position: before(COMPRA) })
  })

  it("debajo de un texto, sin poder meterse en él", (): void => {
    assert.deepEqual(dropTarget(resto, 1, 1, false), { depth: 0, position: after(COMPRA) })
  })

  it("entre una casilla y su primera hija: la primera hija, nunca afuera", (): void => {
    assert.deepEqual(dropTarget(resto, 2, 0, false), { depth: 1, position: before(MANZANAS) })
  })

  it("al final: hija de la última, nieta, o sacada del árbol", (): void => {
    assert.deepEqual(dropTarget(resto, 4, 1, false), { depth: 1, position: after(PERAS) })
    assert.deepEqual(dropTarget(resto, 4, 2, false), { depth: 2, position: lastChildOf(PERAS) })
    assert.deepEqual(dropTarget(resto, 4, 0, false), { depth: 0, position: after(FRUTA) })
    assert.deepEqual(dropTarget(resto, 4, 9, false), { depth: 2, position: lastChildOf(PERAS) })
  })

  it("con texto, sólo en la raíz: entre hijas no cabe", (): void => {
    assert.equal(dropTarget(resto, 3, 1, true), null)
    assert.deepEqual(dropTarget(resto, 4, 2, true), { depth: 0, position: after(FRUTA) })
  })

  it("sin nada que se quede, al final de la nota", (): void => {
    assert.deepEqual(dropTarget([], 0, 0, false), { depth: 0, position: rootEnd })
  })
})
