/**
 * Lo que es un nodo del lienzo: un texto que se ve tal cual se escribió, o un
 * enlace entero que enseña el nombre de ahora de lo enlazado (o su texto, si es
 * una web o está roto). Y qué se guarda al cambiar lo que se ve, al enlazarlo y
 * al quitarle el enlace.
 */

import { test } from "node:test"
import assert from "node:assert/strict"

import type { AppState, CalendarEvent, Clock, Day, Diagram, IdGenerator, Note, Routine, Store, UseCases } from "#core/index"
import { buildLink, createStore, createUseCases } from "#core/index"
import { emptyAppState } from "#core/domain/AppState"
import type { NodeContent } from "#ui/nodeContent"
import {
  canEditNodeText,
  editedNodeText,
  linkNodeText,
  linkSheetAddress,
  linkSheetText,
  readNode,
  textNodeText,
  unlinkedNodeText,
} from "#ui/nodeContent"

interface Escenario {
  readonly store: Store
  readonly useCases: UseCases
  readonly nota: Note
  readonly diagrama: Diagram
  readonly evento: CalendarEvent
  readonly rutina: Routine
}

const escenario = (): Escenario => {
  let n: number = 0
  const clock: Clock = { now: (): number => 1000 }
  const ids: IdGenerator = { next: (): string => `id-${n++}` }
  const store: Store = createStore(emptyAppState())
  const useCases: UseCases = createUseCases({ clock, ids, store })
  const nota: Note | null = useCases.createNote("Compra")
  const diagrama: Diagram | null = useCases.createDiagram("Plano")
  const evento: CalendarEvent | null = useCases.createEvent("2026-11-03" as Day, null, "Dentista")
  const rutina: Routine | null = useCases.createRoutine("Leer", null)
  if (nota === null || diagrama === null || evento === null || rutina === null) assert.fail("tenían que crearse")
  return { store, useCases, nota, diagrama, evento, rutina }
}

/* ── readNode: texto ── */

test("readNode: un texto se ve tal cual se escribió, sin las barras de escape", (): void => {
  const { store }: Escenario = escenario()
  const s: AppState = store.getState()
  assert.deepEqual(readNode(s, "Cajas"), { kind: "text", text: "Cajas" })
  assert.deepEqual(readNode(s, textNodeText("2 * 3 [a](b) #1 \\")), { kind: "text", text: "2 * 3 [a](b) #1 \\" })
  assert.deepEqual(readNode(s, ""), { kind: "text", text: "" })
})

test("readNode: con texto al lado del enlace, dos enlaces, varias líneas o un enlace sin cerrar, es texto", (): void => {
  const { store, nota }: Escenario = escenario()
  const s: AppState = store.getState()
  assert.strictEqual(readNode(s, `ver [Compra](#${nota.id})`).kind, "text")
  assert.strictEqual(readNode(s, `[a](#${nota.id})[b](#${nota.id})`).kind, "text")
  assert.strictEqual(readNode(s, `[Compra](#${nota.id})\notra`).kind, "text")
  assert.deepEqual(readNode(s, "[Compra](#"), { kind: "text", text: "[Compra](#" })
})

/* ── readNode: enlace ── */

test("readNode: un enlace a algo de la app enseña su nombre de ahora y dice a qué lleva", (): void => {
  const { store, useCases, nota, diagrama, evento, rutina }: Escenario = escenario()
  const enlace = (texto: string, id: string): string => buildLink(texto, `#${id}`) ?? assert.fail("se construye")
  useCases.renameNote(nota.id, "Compra del sábado")
  const s: AppState = store.getState()
  assert.deepEqual(readNode(s, ` ${enlace("Compra", nota.id)} `), {
    kind: "link",
    text: "Compra del sábado",
    target: { kind: "internal", id: nota.id },
    resolved: { kind: "note", id: nota.id },
    broken: false,
    destination: `#${nota.id}`,
  })
  const texto = (raw: string): string => readNode(s, raw).text
  assert.strictEqual(texto(enlace("x", diagrama.id)), "Plano")
  assert.strictEqual(texto(enlace("x", evento.id)), "Dentista")
  assert.strictEqual(texto(enlace("x", rutina.id)), "Leer")
})

test("readNode: un enlace roto enseña su texto, sin escapes, y se marca roto", (): void => {
  const { store }: Escenario = escenario()
  const nodo: NodeContent = readNode(store.getState(), buildLink("Nota [vieja]", "#fantasma") ?? "")
  assert.deepEqual(nodo, {
    kind: "link",
    text: "Nota [vieja]",
    target: { kind: "internal", id: "fantasma" },
    resolved: null,
    broken: true,
    destination: "#fantasma",
  })
})

test("readNode: un enlace a una web enseña su texto y no está roto", (): void => {
  const { store }: Escenario = escenario()
  const nodo: NodeContent = readNode(store.getState(), "[El *tiempo*](https://aemet.es/x)")
  assert.deepEqual(nodo, {
    kind: "link",
    text: "El tiempo",
    target: { kind: "web", href: "https://aemet.es/x" },
    resolved: null,
    broken: false,
    destination: "https://aemet.es/x",
  })
})

/* ── editedNodeText ── */

test("editedNodeText: un texto se guarda escapado, y se vuelve a leer tal cual", (): void => {
  const { store }: Escenario = escenario()
  const s: AppState = store.getState()
  const guardado: string = editedNodeText(s, "Cajas", "**no** es [negrita](#x)")
  assert.strictEqual(guardado, "\\*\\*no\\*\\* es \\[negrita\\]\\(\\#x\\)")
  assert.deepEqual(readNode(s, guardado), { kind: "text", text: "**no** es [negrita](#x)" })
})

test("editedNodeText: una web conserva su destino con el texto nuevo", (): void => {
  const { store }: Escenario = escenario()
  const s: AppState = store.getState()
  const guardado: string = editedNodeText(s, "[tiempo](https://aemet.es)", "El [tiempo]")
  assert.strictEqual(guardado, buildLink("El [tiempo]", "https://aemet.es"))
  assert.strictEqual(readNode(s, guardado).text, "El [tiempo]")
})

test("editedNodeText: un enlace a algo de la app no cambia, y «Editar» no se ofrece", (): void => {
  const { store, nota }: Escenario = escenario()
  const s: AppState = store.getState()
  const raw: string = `[Compra](#${nota.id})`
  assert.strictEqual(editedNodeText(s, raw, "otro"), raw)
  assert.strictEqual(canEditNodeText(readNode(s, raw)), false)
  assert.strictEqual(canEditNodeText(readNode(s, "[x](#fantasma)")), false)
  assert.strictEqual(canEditNodeText(readNode(s, "[t](https://a.es)")), true)
  assert.strictEqual(canEditNodeText(readNode(s, "Cajas")), true)
})

/* ── Enlazar y quitar el enlace ── */

test("linkNodeText: con el texto escrito, o sin él el nombre o el host; un destino con «)», null", (): void => {
  const { store, nota }: Escenario = escenario()
  const s: AppState = store.getState()
  assert.strictEqual(linkNodeText("Mi [lista]", `#${nota.id}`, "Compra"), buildLink("Mi [lista]", `#${nota.id}`))
  assert.strictEqual(readNode(s, linkNodeText(" ", `#${nota.id}`, "Compra") ?? "").text, "Compra")
  assert.strictEqual(linkNodeText("", "https://www.aemet.es/x"), "[aemet.es](https://www.aemet.es/x)")
  assert.strictEqual(linkNodeText("x", "https://a.es/(b)"), null)
})

test("unlinkedNodeText: se queda lo que se veía, como texto; uno de texto no cambia", (): void => {
  const { store, useCases, nota }: Escenario = escenario()
  useCases.renameNote(nota.id, "Compra *ya*")
  const s: AppState = store.getState()
  const sinEnlace: string = unlinkedNodeText(s, `[x](#${nota.id})`)
  assert.deepEqual(readNode(s, sinEnlace), { kind: "text", text: "Compra *ya*" })
  assert.deepEqual(readNode(s, unlinkedNodeText(s, "[El tiempo](https://aemet.es)")), { kind: "text", text: "El tiempo" })
  const texto: string = textNodeText("a * b")
  assert.strictEqual(unlinkedNodeText(s, texto), texto)
})

test("la hoja de enlazar: el texto de uno de texto o de una web, y su dirección; vacía en uno de la app", (): void => {
  const { store, nota }: Escenario = escenario()
  const s: AppState = store.getState()
  const web: NodeContent = readNode(s, "[El tiempo](https://aemet.es)")
  assert.strictEqual(linkSheetText(web), "El tiempo")
  assert.strictEqual(linkSheetAddress(web), "https://aemet.es")
  const interno: NodeContent = readNode(s, `[x](#${nota.id})`)
  assert.strictEqual(linkSheetText(interno), "")
  assert.strictEqual(linkSheetAddress(interno), "")
  const texto: NodeContent = readNode(s, textNodeText("2 * 3"))
  assert.strictEqual(linkSheetText(texto), "2 * 3")
  assert.strictEqual(linkSheetAddress(texto), "")
})
