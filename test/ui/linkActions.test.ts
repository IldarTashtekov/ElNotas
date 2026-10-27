/**
 * Los enlaces de una línea: a qué lleva uno interno, cuál hay bajo el cursor y
 * cómo se quita su marca, qué se puede enlazar, cómo se escribe un enlace y cómo
 * se cambia su destino, con los casos raros (ids que son propiedades de un
 * objeto, bordes, escapes, enlaces sueltos).
 */

import { test } from "node:test"
import assert from "node:assert/strict"

import type { Clock, Context, Diagram, IdGenerator, Note, Store, UseCases } from "#core/index"
import { createStore, createUseCases } from "#core/index"
import { emptyAppState } from "#core/domain/AppState"
import type { AppState } from "#core/index"
import type { FormattedLine, LineLink, LineSpan } from "#ui/markdownLine"
import { readMarkdownLine } from "#ui/markdownLine"
import type { LinkChoices } from "#ui/linkActions"
import {
  buildLink,
  changeLink,
  defaultLinkText,
  isWebAddress,
  linkAtCursor,
  linkChoices,
  removeLink,
  resolveLink,
} from "#ui/linkActions"

interface Escenario {
  readonly store: Store
  readonly useCases: UseCases
  readonly nota: Note
  readonly diagrama: Diagram
  readonly contexto: Context
}

const escenario = (): Escenario => {
  let n: number = 0
  const clock: Clock = { now: (): number => 1000 }
  const ids: IdGenerator = { next: (): string => `id-${n++}` }
  const store: Store = createStore(emptyAppState())
  const useCases: UseCases = createUseCases({ clock, ids, store })
  const nota: Note | null = useCases.createNote("Nota")
  const diagrama: Diagram | null = useCases.createDiagram("Plano")
  const contexto: Context | null = useCases.createContext("Contexto")
  if (nota === null || diagrama === null || contexto === null) assert.fail("tenían que crearse")
  return { store, useCases, nota, diagrama, contexto }
}

/* ── resolveLink ── */

test("resolveLink: una nota, un diagrama; un contexto o lo que no está, roto", (): void => {
  const { store, nota, diagrama, contexto }: Escenario = escenario()
  const estado: AppState = store.getState()
  assert.deepEqual(resolveLink(estado, nota.id), { kind: "note", id: nota.id })
  assert.deepEqual(resolveLink(estado, diagrama.id), { kind: "diagram", id: diagrama.id })
  assert.strictEqual(resolveLink(estado, contexto.id), null)
  assert.strictEqual(resolveLink(estado, "no-existe"), null)
  assert.strictEqual(resolveLink(estado, ""), null)
})

test("resolveLink: los nombres de las propiedades de un objeto no son ids", (): void => {
  const { store }: Escenario = escenario()
  for (const id of ["constructor", "__proto__", "toString", "hasOwnProperty", "valueOf"]) {
    assert.strictEqual(resolveLink(store.getState(), id), null, id)
  }
})

test("resolveLink: borrar lo enlazado lo rompe", (): void => {
  const { store, useCases, nota, diagrama }: Escenario = escenario()
  useCases.deleteNote(nota.id)
  useCases.deleteDiagram(diagrama.id)
  assert.strictEqual(resolveLink(store.getState(), nota.id), null)
  assert.strictEqual(resolveLink(store.getState(), diagrama.id), null)
})

/* ── linkAtCursor ── */

const enlace = (raw: string, offset: number): LineLink | null =>
  linkAtCursor(readMarkdownLine(raw), offset)

test("linkAtCursor: estrictamente dentro, en la cadena cruda", (): void => {
  const raw: string = "ab [cd](#x) ef"
  // El enlace ocupa [3, 11).
  assert.strictEqual(enlace(raw, 3), null)
  assert.notStrictEqual(enlace(raw, 4), null)
  assert.notStrictEqual(enlace(raw, 8), null)
  assert.notStrictEqual(enlace(raw, 10), null)
  assert.strictEqual(enlace(raw, 11), null)
  assert.strictEqual(enlace(raw, 0), null)
  assert.strictEqual(enlace(raw, raw.length), null)
})

test("linkAtCursor: devuelve el MISMO objeto que lista la línea", (): void => {
  const linea: FormattedLine = readMarkdownLine("[a](#x)")
  assert.strictEqual(linkAtCursor(linea, 3), linea.links[0])
})

test("linkAtCursor: una dirección suelta también, sin enlace fuera de ella", (): void => {
  const raw: string = "mira https://a.es ya"
  const dentro: LineLink | null = enlace(raw, 10)
  assert.ok(dentro !== null && !dentro.saved)
  assert.strictEqual(enlace(raw, 5), null)
  assert.strictEqual(enlace(raw, 17), null)
})

test("linkAtCursor: con dos enlaces, el que toca; sin enlaces, null; offsets fuera, null", (): void => {
  const raw: string = "[a](#x) [b](#y)"
  assert.deepEqual(enlace(raw, 2)?.target, { kind: "internal", id: "x" })
  assert.deepEqual(enlace(raw, 10)?.target, { kind: "internal", id: "y" })
  assert.strictEqual(enlace(raw, 7), null)
  assert.strictEqual(enlace(raw, 8), null)
  assert.strictEqual(enlace("sin nada", 3), null)
  assert.strictEqual(enlace("", 0), null)
  assert.strictEqual(enlace(raw, -1), null)
  assert.strictEqual(enlace(raw, 999), null)
})

test("linkAtCursor: un enlace escapado no es enlace", (): void => {
  assert.strictEqual(enlace("\\[a](#x)", 4), null)
})

/* ── removeLink ── */

const quitar = (raw: string, offset: number): { readonly text: string; readonly cursor: number } => {
  const linea: FormattedLine = readMarkdownLine(raw)
  const l: LineLink | null = linkAtCursor(linea, offset)
  if (l === null) assert.fail("tenía que haber enlace")
  return removeLink(raw, linea, l, offset)
}

test("removeLink: deja el texto y el cursor al final de él", (): void => {
  assert.deepEqual(quitar("[hola](#x)", 3), { text: "hola", cursor: 4 })
  assert.deepEqual(quitar("a [hola](https://b.es) c", 5), { text: "a hola c", cursor: 6 })
  assert.deepEqual(quitar("[a](#x) y [b](#y)", 12), { text: "[a](#x) y b", cursor: 11 })
})

test("removeLink: los escapes y las marcas de dentro se conservan tal cual", (): void => {
  assert.deepEqual(quitar("[a\\*b](#x)", 3), { text: "a\\*b", cursor: 4 })
  assert.deepEqual(quitar("[**a** b](#x)", 3), { text: "**a** b", cursor: 7 })
  assert.deepEqual(quitar("[a \\] b](#x)", 3), { text: "a \\] b", cursor: 6 })
})

test("removeLink: un destino con paréntesis se va entero", (): void => {
  assert.deepEqual(quitar("[w](https://a.es/x_(y))!", 2), { text: "w!", cursor: 1 })
})

test("removeLink: un enlace en un título conserva el `# `", (): void => {
  assert.deepEqual(quitar("# [t](#x)", 4), { text: "# t", cursor: 3 })
})

test("removeLink: una dirección suelta no cambia nada, ni el cursor", (): void => {
  const raw: string = "mira https://a.es"
  const linea: FormattedLine = readMarkdownLine(raw)
  const l: LineLink | null = linkAtCursor(linea, 10)
  if (l === null) assert.fail("tenía que haber enlace")
  assert.deepEqual(removeLink(raw, linea, l, 10), { text: raw, cursor: 10 })
})

test("removeLink: un enlace que no es de esa línea no cambia nada", (): void => {
  const ajeno: LineLink = readMarkdownLine("[a](#x)").links[0] as LineLink
  const linea: FormattedLine = readMarkdownLine("otra cosa distinta")
  assert.deepEqual(removeLink("otra cosa distinta", linea, ajeno, 3), {
    text: "otra cosa distinta",
    cursor: 3,
  })
})

test("removeLink: lo quitado ya no se lee como enlace", (): void => {
  const { text }: { readonly text: string } = quitar("ve a [aquí](#x) ya", 8)
  assert.strictEqual(readMarkdownLine(text).links.length, 0)
})

/* ── isWebAddress ── */

test("isWebAddress: http, https y www, sin distinguir mayúsculas, con algo detrás", (): void => {
  for (const ok of ["http://a.es", "https://a.es/x?y=1#z", "www.a.es", "HTTPS://A.ES", "WwW.a.es", "  https://a.es  "]) {
    assert.strictEqual(isWebAddress(ok), true, ok)
  }
})

test("isWebAddress: sin nada detrás del prefijo, con espacios dentro o sin prefijo, no", (): void => {
  for (const mal of ["", "  ", "https://", "http://", "www.", "a.es", "ftp://a.es", "https://a b", "mira https://a.es", "https:/a.es", "#id"]) {
    assert.strictEqual(isWebAddress(mal), false, mal)
  }
})

/* ── linkChoices ── */

test("linkChoices: las demás notas y todos los diagramas, por nombre, sin contextos", (): void => {
  const { store, useCases, nota, diagrama }: Escenario = escenario()
  const zeta: Note | null = useCases.createNote("zeta")
  const alfa: Note | null = useCases.createNote("Álamo")
  const otro: Diagram | null = useCases.createDiagram("Árbol")
  if (zeta === null || alfa === null || otro === null) assert.fail("tenían que crearse")
  const r: LinkChoices = linkChoices(store.getState(), nota.id)
  assert.deepEqual(r.notes.map((n: { readonly name: string }): string => n.name), ["Álamo", "zeta"])
  assert.deepEqual(r.diagrams.map((d: { readonly name: string }): string => d.name), ["Árbol", "Plano"])
  assert.ok(r.diagrams.some((d: { readonly id: string }): boolean => d.id === diagrama.id))
  assert.ok(!r.notes.some((n: { readonly id: string }): boolean => n.id === nota.id))
})

test("linkChoices: el orden ignora tildes y mayúsculas; sin nada que enlazar, listas vacías", (): void => {
  const { store, useCases, nota }: Escenario = escenario()
  useCases.createNote("b")
  useCases.createNote("Á")
  useCases.createNote("a")
  const nombres: ReadonlyArray<string> = linkChoices(store.getState(), nota.id).notes.map((n: { readonly name: string }): string => n.name)
  assert.strictEqual(nombres[2], "b")
  assert.deepEqual(linkChoices(emptyAppState(), nota.id), { notes: [], diagrams: [] })
})

/* ── buildLink ── */

test("buildLink: [texto](destino), con los destinos tal cual", (): void => {
  assert.strictEqual(buildLink("hola", "#id-1"), "[hola](#id-1)")
  assert.strictEqual(buildLink("a", "www.a.es"), "[a](www.a.es)")
  assert.strictEqual(buildLink("a", "https://a.es/x?y=1"), "[a](https://a.es/x?y=1)")
})

test("buildLink: escapa la barra, los corchetes y el asterisco del texto", (): void => {
  assert.strictEqual(buildLink("a\\b [c] *d*", "#x"), "[a\\\\b \\[c\\] \\*d\\*](#x)")
})

test("buildLink: un texto vacío o en blanco pasa a «enlace»", (): void => {
  assert.strictEqual(buildLink("", "#x"), "[enlace](#x)")
  assert.strictEqual(buildLink("  \t ", "#x"), "[enlace](#x)")
})

test("buildLink: un destino con `)` no se enlaza", (): void => {
  assert.strictEqual(buildLink("a", "https://a.es/x_(y)"), null)
  assert.strictEqual(buildLink("a", ")"), null)
})

test("buildLink: lo escrito se lee de vuelta con ese texto y ese destino", (): void => {
  const raw: string = buildLink("a]b[c\\d*e", "#x") ?? assert.fail("tenía que construirse")
  const linea: FormattedLine = readMarkdownLine(raw)
  assert.strictEqual(linea.links.length, 1)
  assert.deepEqual(linea.links[0]?.target, { kind: "internal", id: "x" })
  assert.strictEqual(linea.links[0]?.saved, true)
  const visto: string = linea.spans
    .map((s: LineSpan): string => (s.kind === "text" ? s.text : ""))
    .join("")
  assert.strictEqual(visto, "a]b[c\\d*e")
  const web: string = buildLink("w", "www.a.es") ?? assert.fail("tenía que construirse")
  assert.deepEqual(readMarkdownLine(web).links[0]?.target, { kind: "web", href: "https://www.a.es" })
})

/* ── defaultLinkText ── */

test("defaultLinkText: de una web, el host sin www, sin puerto ni ruta", (): void => {
  assert.strictEqual(defaultLinkText("https://www.wikipedia.org/wiki/X"), "wikipedia.org")
  assert.strictEqual(defaultLinkText("http://a.es:8080/x?y=1#z"), "a.es")
  assert.strictEqual(defaultLinkText("www.a.es"), "a.es")
  assert.strictEqual(defaultLinkText("HTTPS://WWW.A.ES"), "A.ES")
  assert.strictEqual(defaultLinkText("https://usuario@a.es/x"), "a.es")
  assert.strictEqual(defaultLinkText("  https://a.es  "), "a.es")
  assert.strictEqual(defaultLinkText("https://a.es?q=1"), "a.es")
})

test("defaultLinkText: una web de la que no sale host, «enlace»", (): void => {
  for (const raro of ["https://", "https:///x", "www.", "https://:80", "http://www./x"]) {
    assert.strictEqual(defaultLinkText(raro), "enlace", raro)
  }
})

test("defaultLinkText: un enlace interno, el nombre si lo hay; si no, «enlace»", (): void => {
  assert.strictEqual(defaultLinkText("#id-1", "Mi nota"), "Mi nota")
  assert.strictEqual(defaultLinkText("#id-1"), "enlace")
  assert.strictEqual(defaultLinkText("#id-1", ""), "enlace")
  assert.strictEqual(defaultLinkText("#id-1", "  \t"), "enlace")
})

/* ── changeLink ── */

const reescribir = (
  raw: string,
  offset: number,
  texto: string,
  destino: string,
): { readonly text: string; readonly cursor: number } => {
  const linea: FormattedLine = readMarkdownLine(raw)
  const l: LineLink | null = linkAtCursor(linea, offset)
  if (l === null) assert.fail("tenía que haber enlace")
  return changeLink(raw, linea, l, texto, destino)
}

test("changeLink: cambia texto y destino, y el cursor queda tras el enlace", (): void => {
  assert.deepEqual(reescribir("[hola](#x)", 3, "adiós", "#y"), { text: "[adiós](#y)", cursor: 11 })
  assert.deepEqual(reescribir("a [b](https://b.es) c", 4, "w", "www.c.es"), {
    text: "a [w](www.c.es) c",
    cursor: 15,
  })
  assert.deepEqual(reescribir("# [t](#x)", 4, "u", "#z"), { text: "# [u](#z)", cursor: 9 })
})

test("changeLink: el texto se escapa y uno en blanco pasa a «enlace»", (): void => {
  assert.deepEqual(reescribir("[a](#x)", 2, "b*c", "#x"), { text: "[b\\*c](#x)", cursor: 10 })
  assert.deepEqual(reescribir("[a](#x)", 2, " ", "#x"), { text: "[enlace](#x)", cursor: 12 })
})

test("changeLink: lo escrito se lee de vuelta como un enlace guardado", (): void => {
  const { text }: { readonly text: string } = reescribir("ve a [aquí](#x) ya", 8, "allí", "https://b.es")
  const l: LineLink | undefined = readMarkdownLine(text).links[0]
  assert.deepEqual(l?.target, { kind: "web", href: "https://b.es" })
  assert.strictEqual(l?.saved, true)
})

test("changeLink: suelta, ajeno o con `)` en el destino, no cambia nada", (): void => {
  const suelta: string = "mira https://a.es"
  const ls: FormattedLine = readMarkdownLine(suelta)
  const s: LineLink | null = linkAtCursor(ls, 10)
  if (s === null) assert.fail("tenía que haber enlace")
  assert.deepEqual(changeLink(suelta, ls, s, "t", "#y"), { text: suelta, cursor: s.end })

  const ajeno: LineLink = readMarkdownLine("[a](#x)").links[0] as LineLink
  const otra: FormattedLine = readMarkdownLine("otra cosa distinta")
  assert.deepEqual(changeLink("otra cosa distinta", otra, ajeno, "t", "#y"), {
    text: "otra cosa distinta",
    cursor: ajeno.end,
  })

  assert.deepEqual(reescribir("[a](#x)", 2, "t", "https://a.es/x_(y)"), { text: "[a](#x)", cursor: 7 })
})
