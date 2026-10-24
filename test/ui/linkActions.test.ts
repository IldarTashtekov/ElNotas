/**
 * Los enlaces de una línea: a qué lleva uno interno, cuál hay bajo el cursor y
 * cómo se quita su marca, con los casos raros (ids que son propiedades de un
 * objeto, bordes, escapes, enlaces sueltos).
 */

import { test } from "node:test"
import assert from "node:assert/strict"

import type { Clock, Context, Diagram, IdGenerator, Note, Store, UseCases } from "#core/index"
import { createStore, createUseCases } from "#core/index"
import { emptyAppState } from "#core/domain/AppState"
import type { AppState } from "#core/index"
import type { FormattedLine, LineLink } from "#ui/markdownLine"
import { readMarkdownLine } from "#ui/markdownLine"
import { linkAtCursor, removeLink, resolveLink } from "#ui/linkActions"

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
