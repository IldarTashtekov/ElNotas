/**
 * El lector de Markdown de una línea: la tabla de casos, los rangos exactos, la
 * identidad de los enlaces y las propiedades sobre la tabla y sobre entradas generadas.
 */

import { test } from "node:test"
import assert from "node:assert/strict"

import type { FormattedLine, LineLink, LineSpan } from "#ui/markdownLine"
import { rawOffset, readMarkdownLine, visibleText } from "#ui/markdownLine"

// Resume una línea en una cadena: marcas `m:"…"`, texto con prefijo B / I / L(destino).
const resumen = (linea: FormattedLine): string => {
  const tramos: ReadonlyArray<string> = linea.spans.map((s: LineSpan): string => {
    if (s.kind === "mark") return `m:${JSON.stringify(s.text)}`
    const enlace: string =
      s.link === null ? ""
      : s.link.target.kind === "web" ? `L(${s.link.target.href})`
      : `L(#${s.link.target.id})`
    const prefijo: string = `${s.bold ? "B" : ""}${s.italic ? "I" : ""}${enlace}`
    return `${prefijo === "" ? "t" : prefijo}:${JSON.stringify(s.text)}`
  })
  return (linea.heading ? "H " : "") + tramos.join(" ")
}

// Descripción, entrada cruda y resumen esperado.
const CASOS: ReadonlyArray<readonly [string, string, string]> = [
  ["1 vacía", "", ""],
  ["2 texto llano", "hola", "t:\"hola\""],
  ["3 negrita", "**negrita**", "m:\"**\" B:\"negrita\" m:\"**\""],
  ["4 cursiva", "*cursiva*", "m:\"*\" I:\"cursiva\" m:\"*\""],
  ["5 negrita en medio", "a **b** c", "t:\"a \" m:\"**\" B:\"b\" m:\"**\" t:\" c\""],
  ["6 cursiva en medio", "a *b* c", "t:\"a \" m:\"*\" I:\"b\" m:\"*\" t:\" c\""],
  ["7 cursiva entre letras", "a*b*c", "t:\"a\" m:\"*\" I:\"b\" m:\"*\" t:\"c\""],
  ["8 dos negritas", "**a** **b**", "m:\"**\" B:\"a\" m:\"**\" t:\" \" m:\"**\" B:\"b\" m:\"**\""],
  ["9 título", "# Título", "H m:\"# \" t:\"Título\""],
  ["10 título vacío", "# ", "H m:\"# \""],
  ["11 `#` solo", "#", "t:\"#\""],
  ["12 `#` sin espacio", "#tag", "t:\"#tag\""],
  ["13 `#` + tabulador", "#\tx", "t:\"#\\tx\""],
  ["14 `# ` + dos espacios", "#  dos", "H m:\"# \" t:\" dos\""],
  ["15 `##`", "## no", "t:\"## no\""],
  ["16 espacio delante", " # no", "t:\" # no\""],
  ["17 `#` escapado", "\\# no", "m:\"\\\\\" t:\"# no\""],
  ["18 título con negrita", "# **a** b", "H m:\"# \" m:\"**\" B:\"a\" m:\"**\" t:\" b\""],
  ["19 título con `#` escapado", "# \\# x", "H m:\"# \" m:\"\\\\\" t:\"# x\""],
  ["20 título con enlace", "# [a](#id)", "H m:\"# \" m:\"[\" L(#id):\"a\" m:\"](#id)\""],
  ["21 negrita sin cerrar", "**abierta", "t:\"**abierta\""],
  ["22 cursiva sin cerrar", "*abierta", "t:\"*abierta\""],
  ["23 `` vacío", "**", "t:\"**\""],
  ["24 ``", "****", "t:\"****\""],
  ["25 `* *`", "* *", "t:\"* *\""],
  ["26 asteriscos con espacios", "2 * 3 * 4", "t:\"2 * 3 * 4\""],
  ["27 `` suelto", "a ** b", "t:\"a ** b\""],
  ["28 cierre tras espacio", "**a **", "t:\"**a **\""],
  ["29 apertura antes de espacio", "** a**", "t:\"** a**\""],
  ["30 negrita dentro de cursiva", "*a **b** c*", "m:\"*\" I:\"a \" m:\"**\" BI:\"b\" m:\"**\" I:\" c\" m:\"*\""],
  ["31 cursiva dentro de negrita", "**a *b* c**", "m:\"**\" B:\"a \" m:\"*\" BI:\"b\" m:\"*\" B:\" c\" m:\"**\""],
  ["32 `*a*`", "***a***", "m:\"**\" m:\"*\" BI:\"a\" m:\"*\" m:\"**\""],
  ["33 `a*`", "**a*", "t:\"*\" m:\"*\" I:\"a\" m:\"*\""],
  ["34 `*a`", "*a**", "t:\"*a**\""],
  ["35 escapar asteriscos", "\\*no\\*", "m:\"\\\\\" t:\"*no\" m:\"\\\\\" t:\"*\""],
  ["36 escapar la apertura", "\\**no**", "m:\"\\\\\" t:\"**no**\""],
  ["37 escape dentro de cursiva", "*a\\*b*", "m:\"*\" I:\"a\" m:\"\\\\\" I:\"*b\" m:\"*\""],
  ["38 escape que rompe el cierre", "**a\\**", "t:\"*\" m:\"*\" I:\"a\" m:\"\\\\\" I:\"*\" m:\"*\""],
  ["39 barra doble", "a\\\\b", "t:\"a\" m:\"\\\\\" t:\"\\\\b\""],
  ["40 sólo barra doble", "\\\\", "m:\"\\\\\" t:\"\\\\\""],
  ["41 barra al final", "fin\\", "t:\"fin\\\\\""],
  ["42 sólo una barra", "\\", "t:\"\\\\\""],
  ["43 barra ante no escapable", "C:\\Users", "t:\"C:\\\\Users\""],
  ["44 barra ante `_`", "\\_x", "t:\"\\\\_x\""],
  ["45 enlace https", "[web](https://x.com)", "m:\"[\" L(https://x.com):\"web\" m:\"](https://x.com)\""],
  ["46 enlace http", "[web](http://x.com)", "m:\"[\" L(http://x.com):\"web\" m:\"](http://x.com)\""],
  ["47 enlace www", "[web](www.x.com)", "m:\"[\" L(https://www.x.com):\"web\" m:\"](www.x.com)\""],
  ["48 enlace interno", "[nota](#abc-123)", "m:\"[\" L(#abc-123):\"nota\" m:\"](#abc-123)\""],
  ["49 esquema en mayúsculas", "[a](HTTPS://X)", "m:\"[\" L(HTTPS://X):\"a\" m:\"](HTTPS://X)\""],
  ["50 id interno vacío", "[a](#)", "t:\"[a](#)\""],
  ["51 texto vacío", "[](https://x.com)", "t:\"[](\" L(https://x.com):\"https://x.com\" t:\")\""],
  ["52 `[a](` incompleto", "[a](", "t:\"[a](\""],
  ["53 sin `)`", "[a](https://x", "t:\"[a](\" L(https://x):\"https://x\""],
  ["54 espacio entre `]` y `(`", "[a] (https://x.com)", "t:\"[a] (\" L(https://x.com):\"https://x.com\" t:\")\""],
  ["55 destino que no vale", "[a](nota)", "t:\"[a](nota)\""],
  ["56 `javascript:`", "[a](javascript:alert(1))", "t:\"[a](javascript:alert(1))\""],
  ["57 `mailto:`", "[a](mailto:x@y.z)", "t:\"[a](mailto:x@y.z)\""],
  ["58 `https://` sin más", "[a](https://)", "t:\"[a](https://)\""],
  ["59 `www.` sin más", "[a](www.)", "t:\"[a](www.)\""],
  ["60 paréntesis en la URL", "[a](https://x.com/A_(b))", "m:\"[\" L(https://x.com/A_(b)):\"a\" m:\"](https://x.com/A_(b))\""],
  ["61 paréntesis en el id", "[a](#a(b))", "m:\"[\" L(#a(b)):\"a\" m:\"](#a(b))\""],
  ["62 espacio en el destino", "[a b](https://x.com/a b)", "t:\"[a b](\" L(https://x.com/a):\"https://x.com/a\" t:\" b)\""],
  ["63 marcas en el texto del enlace", "[**neg** y *cur*](#id)", "m:\"[\" m:\"**\" BL(#id):\"neg\" m:\"**\" L(#id):\" y \" m:\"*\" IL(#id):\"cur\" m:\"*\" m:\"](#id)\""],
  ["64 enlace dentro de negrita", "**[a](#id)**", "m:\"**\" m:\"[\" BL(#id):\"a\" m:\"](#id)\" m:\"**\""],
  ["65 `` en la URL, dentro de negrita", "**[a](https://x.com/**)**", "m:\"**\" m:\"[\" BL(https://x.com/**):\"a\" m:\"](https://x.com/**)\" m:\"**\""],
  ["66 `*` en el texto del enlace no cierra", "*[a*](#id)*", "m:\"*\" m:\"[\" IL(#id):\"a*\" m:\"](#id)\" m:\"*\""],
  ["67 `[` dentro del texto", "[a [b](#id)", "t:\"[a \" m:\"[\" L(#id):\"b\" m:\"](#id)\""],
  ["68 `]` escapado en el texto", "[a\\]b](#id)", "m:\"[\" L(#id):\"a\" m:\"\\\\\" L(#id):\"]b\" m:\"](#id)\""],
  ["69 URL como texto del enlace", "[https://y.com](#id)", "m:\"[\" L(#id):\"https://y.com\" m:\"](#id)\""],
  ["70 dos enlaces seguidos", "[a](#id)[b](#id2)", "m:\"[\" L(#id):\"a\" m:\"](#id)\" m:\"[\" L(#id2):\"b\" m:\"](#id2)\""],
  ["71 enlace + dirección pegada", "[a](#id)https://x.com", "m:\"[\" L(#id):\"a\" m:\"](#id)\" L(https://x.com):\"https://x.com\""],
  ["72 punto detrás de un enlace", "[a](#id).", "m:\"[\" L(#id):\"a\" m:\"](#id)\" t:\".\""],
  ["73 dirección sola", "https://x.com", "L(https://x.com):\"https://x.com\""],
  ["74 punto final", "ver http://x.com.", "t:\"ver \" L(http://x.com):\"http://x.com\" t:\".\""],
  ["75 www", "www.x.com", "L(https://www.x.com):\"www.x.com\""],
  ["76 dominio pelado", "x.com", "t:\"x.com\""],
  ["77 `www.` solo", "www.", "t:\"www.\""],
  ["78 `https://` solo", "https://", "t:\"https://\""],
  ["79 paréntesis en pareja", "(https://x.com/A_(b))", "t:\"(\" L(https://x.com/A_(b)):\"https://x.com/A_(b)\" t:\")\""],
  ["80 `)` sin pareja", "(ver https://x.com)", "t:\"(ver \" L(https://x.com):\"https://x.com\" t:\")\""],
  ["81 `)` sin pareja tras www", "www.x.com/a)", "L(https://www.x.com/a):\"www.x.com/a\" t:\")\""],
  ["82 `).` al final", "https://x.com).", "L(https://x.com):\"https://x.com\" t:\").\""],
  ["83 puntuación dentro y al final", "https://x.com/a,b?c=1;", "L(https://x.com/a,b?c=1):\"https://x.com/a,b?c=1\" t:\";\""],
  ["84 marcas dentro de una dirección", "https://x.com/**a**", "L(https://x.com/**a):\"https://x.com/**a\" t:\"**\""],
  ["85 dirección en negrita", "**https://x.com**", "m:\"**\" BL(https://x.com):\"https://x.com\" m:\"**\""],
  ["86 pegada a una letra", "xhttps://x.com", "t:\"xhttps://x.com\""],
  ["87 tras dos puntos", "ver:https://x.com", "t:\"ver:\" L(https://x.com):\"https://x.com\""],
  ["88 tras `_`", "_https://x.com", "t:\"_\" L(https://x.com):\"https://x.com\""],
  ["89 entre comillas", "'https://x.com'", "t:\"'\" L(https://x.com):\"https://x.com\" t:\"'\""],
  ["90 mayúsculas", "HTTPS://X.COM", "L(HTTPS://X.COM):\"HTTPS://X.COM\""],
  ["91 WWW en mayúsculas", "WWW.X.COM", "L(https://WWW.X.COM):\"WWW.X.COM\""],
  ["92 barra + enlace interno", "\\[a](#id)", "m:\"\\\\\" t:\"[a](#id)\""],
  ["93 barra + enlace web", "\\[a](https://x.com)", "m:\"\\\\\" t:\"[a](https://x.com)\""],
  ["94 barra + dirección", "\\https://x.com", "m:\"\\\\\" t:\"https://x.com\""],
  ["95 barra + www", "\\www.x.com", "m:\"\\\\\" t:\"www.x.com\""],
  ["96 barra doble + dirección", "\\\\https://x.com", "m:\"\\\\\" t:\"\\\\\" L(https://x.com):\"https://x.com\""],
  ["97 barra + enlace a medias", "\\[a](", "m:\"\\\\\" t:\"[a](\""],
  ["98 barra + enlace, en negrita", "**\\[a](#id)**", "m:\"**\" m:\"\\\\\" B:\"[a](#id)\" m:\"**\""],
  ["99 emoji (par sustituto)", "**😀**", "m:\"**\" B:\"😀\" m:\"**\""],
]

const cumpleLasPropiedades = (raw: string, linea: FormattedLine): void => {
  // 1. reconstrucción
  assert.equal(linea.spans.map((s: LineSpan): string => s.text).join(""), raw)
  // 2. contiguos y sin huecos
  let siguiente: number = 0
  for (const s of linea.spans) {
    assert.equal(s.start, siguiente)
    assert.ok(s.start < s.end)
    // 3. el texto es su rango
    assert.equal(s.text, raw.slice(s.start, s.end))
    siguiente = s.end
  }
  assert.equal(siguiente, raw.length)
  // 4. fusión
  for (let n: number = 1; n < linea.spans.length; n++) {
    const a: LineSpan | undefined = linea.spans[n - 1]
    const b: LineSpan | undefined = linea.spans[n]
    if (a === undefined || b === undefined) continue
    if (a.kind === "text" && b.kind === "text") {
      assert.ok(a.bold !== b.bold || a.italic !== b.italic || a.link !== b.link)
    }
  }
  // 5. enlaces
  for (let n: number = 1; n < linea.links.length; n++) {
    const a: LineLink | undefined = linea.links[n - 1]
    const b: LineLink | undefined = linea.links[n]
    if (a === undefined || b === undefined) continue
    assert.ok(b.start >= a.end)
  }
  for (const s of linea.spans) {
    if (s.kind === "text" && s.link !== null) {
      assert.ok(linea.links.includes(s.link))
      assert.ok(s.start >= s.link.start && s.end <= s.link.end)
    }
  }
  for (const enlace of linea.links) {
    assert.ok(
      linea.spans.some((s: LineSpan): boolean => s.kind === "text" && s.link === enlace),
    )
  }
  // 6. título
  assert.equal(linea.heading, raw.startsWith("# "))
  // 7. determinismo
  assert.deepEqual(readMarkdownLine(raw), linea)
}

for (const [descripcion, entrada, esperado] of CASOS) {
  test(`caso ${descripcion}`, (): void => {
    const linea: FormattedLine = readMarkdownLine(entrada)
    assert.equal(resumen(linea), esperado)
    cumpleLasPropiedades(entrada, linea)
  })
}

const rangos = (linea: FormattedLine): ReadonlyArray<readonly [string, number, number]> =>
  linea.spans.map((s: LineSpan): readonly [string, number, number] => [s.kind, s.start, s.end])

test("rangos: título, negrita y enlace interno", (): void => {
  const linea: FormattedLine = readMarkdownLine("# a **b** [c](#id)")
  assert.deepEqual(rangos(linea), [
    ["mark", 0, 2], ["text", 2, 4], ["mark", 4, 6], ["text", 6, 7], ["mark", 7, 9],
    ["text", 9, 10], ["mark", 10, 11], ["text", 11, 12], ["mark", 12, 18],
  ])
  assert.deepEqual(linea.links, [
    { target: { kind: "internal", id: "id" }, saved: true, start: 10, end: 18 },
  ])
})

test("rangos: barra que escapa", (): void => {
  const linea: FormattedLine = readMarkdownLine("\\*x")
  assert.deepEqual(rangos(linea), [["mark", 0, 1], ["text", 1, 3]])
  assert.deepEqual(linea.links, [])
})

test("rangos: dirección suelta con punto final", (): void => {
  const linea: FormattedLine = readMarkdownLine("ver www.x.com.")
  assert.deepEqual(rangos(linea), [["text", 0, 4], ["text", 4, 13], ["text", 13, 14]])
  assert.deepEqual(linea.links, [
    { target: { kind: "web", href: "https://www.x.com" }, saved: false, start: 4, end: 13 },
  ])
})

test("identidad: los tramos de un enlace señalan el mismo objeto que links", (): void => {
  const linea: FormattedLine = readMarkdownLine("[**neg** y *cur*](#id)")
  const conEnlace: ReadonlyArray<LineSpan> = linea.spans.filter(
    (s: LineSpan): boolean => s.kind === "text" && s.link !== null,
  )
  assert.equal(conEnlace.length, 3)
  for (const s of conEnlace) {
    if (s.kind === "text") assert.strictEqual(s.link, linea.links[0])
  }
  const dos: FormattedLine = readMarkdownLine("[a](#id)[b](#id2)")
  const s1: LineSpan | undefined = dos.spans[1]
  const s4: LineSpan | undefined = dos.spans[4]
  assert.ok(s1 !== undefined && s1.kind === "text")
  assert.ok(s4 !== undefined && s4.kind === "text")
  if (s1.kind === "text") assert.strictEqual(s1.link, dos.links[0])
  if (s4.kind === "text") assert.strictEqual(s4.link, dos.links[1])
})

test("propiedades sobre 20 000 cadenas generadas con semilla fija", (): void => {
  const alfabeto: ReadonlyArray<string> = [
    "*", "*", "\\", "[", "]", "(", ")", "#", " ", "a", "b", "https://", "www.", ".", ",", ")",
    "😀", "\t", "#id", "x.com",
  ]
  let semilla: number = 12345
  const siguiente = (): number => {
    semilla = (semilla * 1103515245 + 12345) & 0x7fffffff
    return semilla
  }
  for (let n: number = 0; n < 20000; n++) {
    const piezas: number = siguiente() % 25
    let raw: string = ""
    for (let p: number = 0; p < piezas; p++) {
      raw += alfabeto[siguiente() % alfabeto.length] ?? ""
    }
    cumpleLasPropiedades(raw, readMarkdownLine(raw))
  }
})

/* ── De lo que se ve a la cadena cruda ── */

test("lo que se ve: sin marcas, con los escapes resueltos", (): void => {
  assert.equal(visibleText(readMarkdownLine("# a **b** [c](#id) \\*")), "a b c *")
  assert.equal(visibleText(readMarkdownLine("")), "")
  assert.equal(visibleText(readMarkdownLine("# ")), "")
})

// Entrada cruda, posición en lo que se ve y posición esperada en la cruda.
const POSICIONES: ReadonlyArray<readonly [string, string, number, number]> = [
  ["vacía", "", 0, 0],
  ["texto llano, en medio", "hola", 2, 2],
  ["texto llano, al final", "hola", 4, 4],
  ["al principio, antes de las marcas", "**b**", 0, 0],
  ["dentro de la negrita", "**bc**", 1, 3],
  ["al final, tras las marcas que cierran", "**b**", 1, 5],
  ["entre dos tramos, pegada a la izquierda", "a **b** c", 2, 2],
  ["tras la negrita, antes de su cierre", "a **b** c", 3, 5],
  ["en el texto de un enlace", "ver [web](#id)", 5, 6],
  ["un enlace al final: el final de la cadena", "ver [web](#id)", 7, 14],
  ["título: el principio va tras el «# »", "# Título", 0, 2],
  ["título vacío", "# ", 0, 2],
  ["un escape: lo visible salta la barra", "\\*x", 1, 2],
  ["más allá de lo que se ve, el final", "a*b*", 9, 4],
  ["antes del principio, el principio", "a", -1, 0],
  ["emoji (par sustituto), antes del cierre", "**😀**x", 2, 4],
]

for (const [que, raw, visible, esperado] of POSICIONES) {
  test(`posición cruda: ${que}`, (): void => {
    assert.equal(rawOffset(readMarkdownLine(raw), visible), esperado)
  })
}

test("posición cruda: llevar cada posición visible y volver da la misma, en toda la tabla", (): void => {
  for (const [, raw] of CASOS) {
    const linea: FormattedLine = readMarkdownLine(raw)
    const visible: string = visibleText(linea)
    for (let v: number = 1; v < visible.length; v++) {
      const crudo: number = rawOffset(linea, v)
      /* Lo que se ve a la izquierda de la posición cruda es lo de antes de v. */
      const izquierda: string = linea.spans
        .filter((s: LineSpan): boolean => s.kind === "text" && s.start < crudo)
        .map((s: LineSpan): string => s.text.slice(0, crudo - s.start))
        .join("")
      assert.equal(izquierda, visible.slice(0, v), `${JSON.stringify(raw)} en ${v}`)
    }
  }
})
