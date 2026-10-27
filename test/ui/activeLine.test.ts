/**
 * La línea activa partida en partes: dónde hay bloque y dónde crudo, la etiqueta
 * de cada enlace, y el paso entre el DOM y la cadena cruda, con casos y con una
 * propiedad sobre cadenas generadas.
 */

import { test } from "node:test"
import assert from "node:assert/strict"

import type { ActivePart, DomPosition } from "#ui/activeLine"
import { activeParts, domToRaw, rawToDom, visibleLength } from "#ui/activeLine"

// Resume las partes: `t:"…"` el crudo, `L:"etiqueta"` un bloque.
const resumen = (raw: string): ReadonlyArray<string> =>
  activeParts(raw).map((p: ActivePart): string =>
    p.kind === "text" ? `t:${JSON.stringify(p.raw)}` : `L:${JSON.stringify(p.label)}`,
  )

test("activeParts: línea vacía, sin partes", (): void => {
  assert.deepEqual(activeParts(""), [])
})

test("activeParts: texto sin enlaces, una sola parte", (): void => {
  assert.deepEqual(resumen("hola **mundo**"), ['t:"hola **mundo**"'])
})

test("activeParts: enlaces pegados y con texto alrededor", (): void => {
  assert.deepEqual(resumen("a [uno](#x)[dos](https://e.com) b"), [
    't:"a "',
    'L:"uno"',
    'L:"dos"',
    't:" b"',
  ])
})

test("activeParts: la etiqueta no lleva marcas ni barras", (): void => {
  assert.deepEqual(resumen("[**negrita**](#x)"), ['L:"negrita"'])
  assert.deepEqual(resumen("[a\\]b](#x)"), ['L:"a]b"'])
  assert.deepEqual(resumen("[a *b* c](#x)"), ['L:"a b c"'])
})

test("activeParts: el bloque lleva su crudo entero y el mismo enlace que la línea", (): void => {
  const partes: ReadonlyArray<ActivePart> = activeParts("x [a](#y)")
  const p: ActivePart | undefined = partes[1]
  assert.ok(p !== undefined && p.kind === "link")
  assert.strictEqual(p.raw, "[a](#y)")
  assert.deepEqual([p.start, p.end], [2, 9])
  assert.deepEqual(p.link.target, { kind: "internal", id: "y" })
})

test("activeParts: una dirección suelta no es bloque", (): void => {
  assert.deepEqual(resumen("https://e.com"), ['t:"https://e.com"'])
  assert.deepEqual(resumen("ve a www.e.com ya"), ['t:"ve a www.e.com ya"'])
})

test("activeParts: la barra que escapa desactiva el enlace entero", (): void => {
  assert.deepEqual(resumen("\\[no](#x)"), ['t:"\\\\[no](#x)"'])
})

test("activeParts: un enlace mal formado no es bloque", (): void => {
  assert.deepEqual(resumen("[a]()"), ['t:"[a]()"'])
  assert.deepEqual(resumen("[](#x)"), ['t:"[](#x)"'])
  assert.deepEqual(resumen("[a](nada)"), ['t:"[a](nada)"'])
})

test("activeParts: un título conserva el `# ` en el crudo", (): void => {
  assert.deepEqual(resumen("# [t](#x)"), ['t:"# "', 'L:"t"'])
})

test("visibleLength: el crudo de un texto, la etiqueta de un bloque", (): void => {
  const partes: ReadonlyArray<ActivePart> = activeParts("ab [**xyz**](#x)")
  assert.deepEqual(partes.map(visibleLength), [3, 3])
})

/* ── domToRaw / rawToDom ── */

const POS = (partIndex: number, offset: number, side?: "before" | "after"): DomPosition =>
  side === undefined ? { partIndex, offset } : { partIndex, offset, side }

test("rawToDom: línea vacía", (): void => {
  assert.deepEqual(rawToDom([], 0), POS(0, 0))
  assert.deepEqual(rawToDom([], 5), POS(0, 0))
  assert.strictEqual(domToRaw([], POS(0, 0)), 0)
  assert.strictEqual(domToRaw([], POS(3, 9)), 0)
})

test("rawToDom: inicio y final de una línea de texto", (): void => {
  const partes: ReadonlyArray<ActivePart> = activeParts("hola")
  assert.deepEqual(rawToDom(partes, 0), POS(0, 0))
  assert.deepEqual(rawToDom(partes, 4), POS(0, 4))
  assert.deepEqual(rawToDom(partes, 99), POS(0, 4))
  assert.deepEqual(rawToDom(partes, -3), POS(0, 0))
})

test("rawToDom: una línea que es sólo un enlace", (): void => {
  const partes: ReadonlyArray<ActivePart> = activeParts("[a](#x)")
  assert.deepEqual(rawToDom(partes, 0), POS(0, 0, "before"))
  assert.deepEqual(rawToDom(partes, 7), POS(0, 1, "after"))
  assert.deepEqual(rawToDom(partes, 99), POS(0, 1, "after"))
})

test("rawToDom: dentro de un enlace, al borde más cercano; el empate, al final", (): void => {
  // "[abc](#x)" ocupa [0, 9): el medio es 4,5.
  const partes: ReadonlyArray<ActivePart> = activeParts("[abc](#x)")
  assert.deepEqual(rawToDom(partes, 1), POS(0, 0, "before"))
  assert.deepEqual(rawToDom(partes, 4), POS(0, 0, "before"))
  assert.deepEqual(rawToDom(partes, 5), POS(0, 1, "after"))
  assert.deepEqual(rawToDom(partes, 8), POS(0, 1, "after"))
  // Empate exacto: "[a](#x)" mide 7... y "[ab](#x)" mide 8, medio 4.
  const par: ReadonlyArray<ActivePart> = activeParts("[ab](#x)")
  assert.deepEqual(rawToDom(par, 4), POS(0, 1, "after"))
})

test("rawToDom: entre dos enlaces pegados, el final del de la izquierda", (): void => {
  const partes: ReadonlyArray<ActivePart> = activeParts("[a](#x)[b](#y)")
  assert.deepEqual(rawToDom(partes, 7), POS(0, 1, "after"))
  assert.strictEqual(domToRaw(partes, POS(0, 1, "after")), 7)
  assert.strictEqual(domToRaw(partes, POS(1, 0, "before")), 7)
})

test("rawToDom: en el límite entre texto y enlace, manda la izquierda", (): void => {
  const partes: ReadonlyArray<ActivePart> = activeParts("ab [c](#x) de")
  assert.deepEqual(rawToDom(partes, 3), POS(0, 3))
  assert.deepEqual(rawToDom(partes, 10), POS(1, 1, "after"))
  assert.deepEqual(rawToDom(partes, 11), POS(2, 1))
  assert.deepEqual(rawToDom(partes, 13), POS(2, 3))
})

test("domToRaw: texto con su desplazamiento, bloque con sus dos bordes", (): void => {
  const partes: ReadonlyArray<ActivePart> = activeParts("ab [c](#x) de")
  assert.strictEqual(domToRaw(partes, POS(0, 2)), 2)
  assert.strictEqual(domToRaw(partes, POS(1, 0)), 3)
  assert.strictEqual(domToRaw(partes, POS(1, 1)), 10)
  assert.strictEqual(domToRaw(partes, POS(2, 1)), 11)
})

test("domToRaw: lo que se sale se recorta", (): void => {
  const partes: ReadonlyArray<ActivePart> = activeParts("ab [c](#x) de")
  assert.strictEqual(domToRaw(partes, POS(-1, 0)), 0)
  assert.strictEqual(domToRaw(partes, POS(9, 0)), 13)
  assert.strictEqual(domToRaw(partes, POS(0, 99)), 3)
  assert.strictEqual(domToRaw(partes, POS(0, -4)), 0)
})

/* ── Propiedades ── */

test("propiedades sobre 20 000 cadenas generadas con semilla fija", (): void => {
  const alfabeto: ReadonlyArray<string> = [
    "[", "[", "]", "]", "(", ")", "(#x)", "](#x)", "](https://e.com)", "*", "**", "\\", "#", "# ",
    " ", "a", "b", "https://", "www.", "e.com", "😀",
  ]
  let semilla: number = 777
  const siguiente = (): number => {
    semilla = (semilla * 1103515245 + 12345) & 0x7fffffff
    return semilla
  }
  for (let n: number = 0; n < 20000; n++) {
    const piezas: number = siguiente() % 20
    let raw: string = ""
    for (let p: number = 0; p < piezas; p++) raw += alfabeto[siguiente() % alfabeto.length] ?? ""
    const partes: ReadonlyArray<ActivePart> = activeParts(raw)
    const dado: string = JSON.stringify(raw)
    assert.strictEqual(partes.map((p: ActivePart): string => p.raw).join(""), raw, dado)
    let fin: number = 0
    for (const p of partes) {
      assert.ok(p.end > p.start, `vacía en ${dado}`)
      assert.strictEqual(p.start, fin, `hueco o solape en ${dado}`)
      assert.strictEqual(p.raw, raw.slice(p.start, p.end), dado)
      fin = p.end
    }
    assert.strictEqual(fin, partes.length === 0 ? 0 : raw.length, dado)
    for (let x: number = 0; x <= raw.length; x++) {
      const vuelta: number = domToRaw(partes, rawToDom(partes, x))
      const dentro: ActivePart | undefined = partes.find(
        (p: ActivePart): boolean => p.kind === "link" && p.start < x && x < p.end,
      )
      if (dentro === undefined) assert.strictEqual(vuelta, x, `${dado} en ${x}`)
      else assert.ok(vuelta === dentro.start || vuelta === dentro.end, `${dado} en ${x}`)
    }
  }
})
