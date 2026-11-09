/**
 * El editor, tecla a tecla y caso a caso, sobre el `Store` y los casos de uso de
 * verdad. Estas pruebas son la especificación del teclado.
 *
 * El contenido se dibuja como texto para que cada prueba se lea sola:
 *
 *     "T Leche"      un texto
 *     "C Pan"        una casilla          "X Pan"   una casilla marcada
 *     "  C Hija"     dos espacios por nivel de anidamiento
 *
 * y el cursor, con una barra: "T Le|che".
 */

import { test } from "node:test"
import assert from "node:assert/strict"

import type { AppState, CheckBox, Content, ContentId, IdGenerator, Note, NoteId, Store, UseCases } from "#core/index"
import { checkBox, text } from "#core/domain/Content"
import { contentId, createStore, createUseCases, isCheckBox, noteId } from "#core/index"
import { emptyAppState } from "#core/domain/AppState"
import { revision } from "#core/domain/Ids"
import type { Caret, EditResult, EditorDeps } from "#ui/editor"
import type { WritingMode } from "#ui/writingMode"
import { INITIAL_MODE, toggleNest } from "#ui/writingMode"
import { pasteLines, pressBackspaceAtStart, pressEnter, startWriting, toggleCheckbox, toggleChecked } from "#ui/editor"
import { pastedLines } from "#ui/pastedLines"

/* ─────────────────────────────── El escenario ───────────────────────────── */

const NOTA: NoteId = noteId("nota")

const APAGADA: WritingMode = INITIAL_MODE
const ENCENDIDA: WritingMode = { checkbox: true, nestArmed: false }
const ANIDAR: WritingMode = { checkbox: true, nestArmed: true }

interface Editor {
  readonly deps: EditorDeps
  readonly store: Store
}

const editor = (content: ReadonlyArray<Content>): Editor => {
  let n: number = 0
  const ids: IdGenerator = { next: (): string => `nuevo-${n++}` }
  const nota: Note = { id: NOTA, name: "Nota", content, updatedAt: 0, revision: revision("r") }
  const inicial: AppState = { ...emptyAppState(), notes: { [NOTA]: nota } }
  const store: Store = createStore(inicial)
  const useCases: UseCases = createUseCases({ clock: { now: (): number => 1 }, ids, store })
  return {
    store,
    deps: { useCases, noteId: NOTA, note: (): Note | undefined => store.getState().notes[NOTA] },
  }
}

const t = (id: string, valor: string): Content => text(contentId(id), valor)
const c = (id: string, valor: string, hijas: ReadonlyArray<CheckBox> = [], checked: boolean = false): CheckBox =>
  checkBox(contentId(id), valor, { children: hijas, checked })

/** El contenido como se lee, con el cursor marcado donde esté. */
const dibujo = (e: Editor, cursor: Caret | null = null): ReadonlyArray<string> => {
  const lineas = (lista: ReadonlyArray<Content>, nivel: number): ReadonlyArray<string> =>
    lista.flatMap((l: Content): ReadonlyArray<string> => {
      const valor: string =
        cursor !== null && cursor.line === l.id
          ? `${l.text.slice(0, cursor.offset)}|${l.text.slice(cursor.offset)}`
          : l.text
      const marca: string = isCheckBox(l) ? (l.checked ? "X" : "C") : "T"
      const propia: string = `${"  ".repeat(nivel)}${marca} ${valor}`
      return isCheckBox(l) ? [propia, ...lineas(l.children, nivel + 1)] : [propia]
    })
  return lineas(e.deps.note()?.content ?? [], 0)
}

const en = (id: string, offset: number): Caret => ({ line: contentId(id), offset })

/* ═══════════════════════════════════ Intro ═════════════════════════════════ */

test("Intro al final de un texto, casilla apagada: texto nuevo DEBAJO, no al final de la nota", (): void => {
  const e: Editor = editor([t("a", "Leche"), t("b", "Pan")])
  const r: EditResult = pressEnter(e.deps, en("a", 5), APAGADA)
  assert.deepEqual(dibujo(e, r.caret), ["T Leche", "T |", "T Pan"])
})

test("Intro al final de una casilla anidada, casilla apagada: texto debajo de su casilla de la raíz", (): void => {
  const e: Editor = editor([c("a", "Compra", [c("a1", "Leche")]), t("b", "Fin")])
  const r: EditResult = pressEnter(e.deps, en("a1", 5), APAGADA)
  assert.deepEqual(dibujo(e, r.caret), ["C Compra", "  C Leche", "T |", "T Fin"])
})

test("Intro al final de un texto, casilla encendida: casilla hermana debajo", (): void => {
  const e: Editor = editor([t("a", "Compra"), t("b", "Fin")])
  const r: EditResult = pressEnter(e.deps, en("a", 6), ENCENDIDA)
  assert.deepEqual(dibujo(e, r.caret), ["T Compra", "C |", "T Fin"])
})

test("Intro al final de una casilla, casilla encendida: hermana al mismo nivel", (): void => {
  const e: Editor = editor([c("a", "Compra", [c("a1", "Leche")])])
  const r: EditResult = pressEnter(e.deps, en("a1", 5), ENCENDIDA)
  assert.deepEqual(dibujo(e, r.caret), ["C Compra", "  C Leche", "  C |"])
})

test("Intro con anidar armado en una casilla: hija dentro de ella, y anidar se desarma", (): void => {
  const e: Editor = editor([c("a", "Compra")])
  const r: EditResult = pressEnter(e.deps, en("a", 6), ANIDAR)
  assert.deepEqual(dibujo(e, r.caret), ["C Compra", "  C |"])
  assert.deepEqual(r.mode, ENCENDIDA)
})

test("anidar no se acumula: dos Intros seguidos bajan UN nivel y luego van de hermanas", (): void => {
  const e: Editor = editor([c("a", "Compra")])
  const r1: EditResult = pressEnter(e.deps, en("a", 6), ANIDAR)
  if (r1.caret === null) assert.fail("tenía que quedar el cursor en la hija")
  const r2: EditResult = pressEnter(e.deps, r1.caret, r1.mode)
  assert.deepEqual(dibujo(e, r2.caret), ["C Compra", "  C ", "  C |"])
})

test("Intro con anidar armado en un TEXTO: casilla hermana, y anidar SIGUE armado", (): void => {
  const e: Editor = editor([t("a", "Compra")])
  const r: EditResult = pressEnter(e.deps, en("a", 6), ANIDAR)
  assert.deepEqual(dibujo(e, r.caret), ["T Compra", "C |"])
  assert.deepEqual(r.mode, ANIDAR)
})

test("Intro en medio de un texto, casilla apagada: lo parte, y la mitad nueva es texto", (): void => {
  const e: Editor = editor([t("a", "Leche y pan")])
  const r: EditResult = pressEnter(e.deps, en("a", 6), APAGADA)
  assert.deepEqual(dibujo(e, r.caret), ["T Leche ", "T |y pan"])
})

test("Intro en medio de un texto, casilla encendida: la mitad nueva nace casilla", (): void => {
  const e: Editor = editor([t("a", "Leche y pan")])
  const r: EditResult = pressEnter(e.deps, en("a", 6), ENCENDIDA)
  assert.deepEqual(dibujo(e, r.caret), ["T Leche ", "C |y pan"])
})

test("Intro en medio de una casilla de la raíz, casilla apagada: la mitad nueva es texto", (): void => {
  const e: Editor = editor([c("a", "Leche pan")])
  const r: EditResult = pressEnter(e.deps, en("a", 6), APAGADA)
  assert.deepEqual(dibujo(e, r.caret), ["C Leche ", "T |pan"])
})

test("Intro en medio de una casilla ANIDADA, casilla apagada: la mitad nueva es texto bajo su casilla de la raíz", (): void => {
  const e: Editor = editor([c("a", "Compra", [c("a1", "Leche pan")]), t("b", "Fin")])
  const r: EditResult = pressEnter(e.deps, en("a1", 6), APAGADA)
  assert.deepEqual(dibujo(e, r.caret), ["C Compra", "  C Leche ", "T |pan", "T Fin"])
})

test("partir una casilla anidada con hermanas detrás, casilla apagada: el texto sale debajo de todas", (): void => {
  const e: Editor = editor([c("a", "Compra", [c("a1", "Leche pan"), c("a2", "Huevos", [c("a21", "Docena")])])])
  const r: EditResult = pressEnter(e.deps, en("a1", 6), APAGADA)
  assert.deepEqual(dibujo(e, r.caret), ["C Compra", "  C Leche ", "  C Huevos", "    C Docena", "T |pan"])
})

test("Intro en medio de una casilla ANIDADA, casilla encendida: la mitad nueva es su hermana", (): void => {
  const e: Editor = editor([c("a", "Compra", [c("a1", "Leche pan")])])
  const r: EditResult = pressEnter(e.deps, en("a1", 6), ENCENDIDA)
  assert.deepEqual(dibujo(e, r.caret), ["C Compra", "  C Leche ", "  C |pan"])
})

test("Intro en medio con anidar armado: parte sin anidar, y anidar sigue armado", (): void => {
  const e: Editor = editor([c("a", "Leche pan")])
  const r: EditResult = pressEnter(e.deps, en("a", 6), ANIDAR)
  assert.deepEqual(dibujo(e, r.caret), ["C Leche ", "C |pan"])
  assert.deepEqual(r.mode, ANIDAR)
})

test("partir una casilla con hijas: las hijas se quedan con la PRIMERA mitad", (): void => {
  const e: Editor = editor([c("a", "Compra semanal", [c("a1", "Leche")])])
  const r: EditResult = pressEnter(e.deps, en("a", 6), ENCENDIDA)
  assert.deepEqual(dibujo(e, r.caret), ["C Compra", "  C Leche", "C | semanal"])
})

test("Intro al principio de una línea con texto la parte por el principio: queda una vacía encima", (): void => {
  const e: Editor = editor([t("a", "Leche")])
  const r: EditResult = pressEnter(e.deps, en("a", 0), APAGADA)
  assert.deepEqual(dibujo(e, r.caret), ["T ", "T |Leche"])
})

/* ═════════════════════════ Retroceso al principio ══════════════════════════ */

test("Retroceso en una casilla de la raíz: 1ª quita la casilla, 2ª une con la de arriba", (): void => {
  const e: Editor = editor([c("a", "Leche"), c("b", "Pan")])
  const r1: EditResult = pressBackspaceAtStart(e.deps, en("b", 0), APAGADA)
  assert.deepEqual(dibujo(e, r1.caret), ["C Leche", "T |Pan"])
  if (r1.caret === null) assert.fail("tenía que quedar el cursor")
  const r2: EditResult = pressBackspaceAtStart(e.deps, r1.caret, APAGADA)
  assert.deepEqual(dibujo(e, r2.caret), ["C Leche|Pan"])
})

test("Retroceso en una casilla anidada: une directamente con la hermana de arriba", (): void => {
  const e: Editor = editor([c("a", "Compra", [c("a1", "Leche"), c("a2", "Pan")])])
  const r: EditResult = pressBackspaceAtStart(e.deps, en("a2", 0), APAGADA)
  assert.deepEqual(dibujo(e, r.caret), ["C Compra", "  C Leche|Pan"])
})

test("Retroceso en un texto bajo una casilla con hijas: une con la ÚLTIMA hija, la que se ve encima", (): void => {
  const e: Editor = editor([c("a", "Compra", [c("a1", "Leche"), c("a2", "Pan")]), t("b", " integral")])
  const r: EditResult = pressBackspaceAtStart(e.deps, en("b", 0), APAGADA)
  assert.deepEqual(dibujo(e, r.caret), ["C Compra", "  C Leche", "  C Pan| integral"])
})

test("Retroceso en la primera hija: une con su madre", (): void => {
  const e: Editor = editor([c("a", "Compra", [c("a1", "Leche")])])
  const r: EditResult = pressBackspaceAtStart(e.deps, en("a1", 0), APAGADA)
  assert.deepEqual(dibujo(e, r.caret), ["C Compra|Leche"])
})

test("Retroceso en un texto: une con la de arriba, también entre dos textos normales", (): void => {
  const e: Editor = editor([t("a", "Hola "), t("b", "mundo")])
  const r: EditResult = pressBackspaceAtStart(e.deps, en("b", 0), APAGADA)
  assert.deepEqual(dibujo(e, r.caret), ["T Hola |mundo"])
})

test("Retroceso en la primera línea de la nota: no hace nada", (): void => {
  const e: Editor = editor([t("a", "Leche")])
  const antes: Note | undefined = e.deps.note()
  const r: EditResult = pressBackspaceAtStart(e.deps, en("a", 0), APAGADA)
  assert.strictEqual(e.deps.note(), antes)
  assert.deepEqual(r.caret, en("a", 0))
})

test("Retroceso en una casilla con hijas: ni la quita ni la une", (): void => {
  const e: Editor = editor([t("a", "Arriba"), c("b", "Compra", [c("b1", "Leche")])])
  const antes: Note | undefined = e.deps.note()
  const r: EditResult = pressBackspaceAtStart(e.deps, en("b", 0), APAGADA)
  assert.strictEqual(e.deps.note(), antes)
  assert.deepEqual(r.caret, en("b", 0))
})

/* ═══════════════════════════ El interruptor de casilla ══════════════════════ */

test("encender con el cursor al principio de un texto: la línea entera pasa a casilla", (): void => {
  const e: Editor = editor([t("a", "Leche")])
  const r: EditResult = toggleCheckbox(e.deps, en("a", 0), APAGADA)
  assert.deepEqual(dibujo(e, r.caret), ["C |Leche"])
  assert.deepEqual(r.mode, ENCENDIDA)
})

test("encender en medio de un texto: se parte, y la segunda mitad es casilla", (): void => {
  const e: Editor = editor([t("a", "Leche y pan")])
  const r: EditResult = toggleCheckbox(e.deps, en("a", 6), APAGADA)
  assert.deepEqual(dibujo(e, r.caret), ["T Leche ", "C |y pan"])
})

test("encender al final de un texto: queda una casilla vacía debajo", (): void => {
  const e: Editor = editor([t("a", "Compra")])
  const r: EditResult = toggleCheckbox(e.deps, en("a", 6), APAGADA)
  assert.deepEqual(dibujo(e, r.caret), ["T Compra", "C |"])
})

test("encender en una casilla: la línea no cambia", (): void => {
  const e: Editor = editor([c("a", "Leche")])
  const antes: Note | undefined = e.deps.note()
  const r: EditResult = toggleCheckbox(e.deps, en("a", 2), APAGADA)
  assert.strictEqual(e.deps.note(), antes)
  assert.deepEqual(r.mode, ENCENDIDA)
})

test("apagar en una casilla de la raíz: pasa a texto, y se desarma anidar", (): void => {
  const e: Editor = editor([c("a", "Leche")])
  const r: EditResult = toggleCheckbox(e.deps, en("a", 2), ANIDAR)
  assert.deepEqual(dibujo(e, r.caret), ["T Le|che"])
  assert.deepEqual(r.mode, APAGADA)
})

test("apagar en una casilla anidada: sigue siendo casilla, pero el interruptor se apaga", (): void => {
  const e: Editor = editor([c("a", "Compra", [c("a1", "Leche")])])
  const antes: Note | undefined = e.deps.note()
  const r: EditResult = toggleCheckbox(e.deps, en("a1", 0), ENCENDIDA)
  assert.strictEqual(e.deps.note(), antes)
  assert.deepEqual(r.mode, APAGADA)
})

test("sin cursor, el interruptor sólo cambia el modo", (): void => {
  const e: Editor = editor([t("a", "Leche")])
  const antes: Note | undefined = e.deps.note()
  assert.deepEqual(toggleCheckbox(e.deps, null, APAGADA).mode, ENCENDIDA)
  assert.strictEqual(e.deps.note(), antes)
})

/* ═════════════════════════════ Anidar y marcar ═════════════════════════════ */

test("anidar se arma y se desarma, y con la casilla apagada no hace nada", (): void => {
  assert.deepEqual(toggleNest(ENCENDIDA), ANIDAR)
  assert.deepEqual(toggleNest(ANIDAR), ENCENDIDA)
  assert.strictEqual(toggleNest(APAGADA), APAGADA)
})

test("marcar alterna la casilla, y NO arrastra a sus hijas", (): void => {
  const e: Editor = editor([c("a", "Compra", [c("a1", "Leche")])])
  toggleChecked(e.deps, contentId("a"))
  assert.deepEqual(dibujo(e), ["X Compra", "  C Leche"])
  toggleChecked(e.deps, contentId("a"))
  assert.deepEqual(dibujo(e), ["C Compra", "  C Leche"])
})

test("marcar un texto no hace nada", (): void => {
  const e: Editor = editor([t("a", "Leche")])
  const antes: Note | undefined = e.deps.note()
  toggleChecked(e.deps, contentId("a"))
  assert.strictEqual(e.deps.note(), antes)
})

/* ═════════════════════════════ La nota vacía ═══════════════════════════════ */

test("empezar a escribir en una nota vacía crea la primera línea, de la clase del interruptor", (): void => {
  const texto: Editor = editor([])
  assert.deepEqual(dibujo(texto, startWriting(texto.deps, APAGADA).caret), ["T |"])
  const casilla: Editor = editor([])
  assert.deepEqual(dibujo(casilla, startWriting(casilla.deps, ENCENDIDA).caret), ["C |"])
})

test("la línea nueva lleva un id nuevo, no reutiliza ninguno", (): void => {
  const e: Editor = editor([t("a", "Leche")])
  const r: EditResult = pressEnter(e.deps, en("a", 5), APAGADA)
  const ids: ReadonlyArray<ContentId> = (e.deps.note()?.content ?? []).map((l: Content): ContentId => l.id)
  assert.equal(new Set<ContentId>(ids).size, ids.length)
  assert.notEqual(r.caret?.line, contentId("a"))
})

/* ═══════════════════════════════ Pegar líneas ══════════════════════════════ */

/** Pega lo que diga el portapapeles, leído como lo lee el editor. */
const pegar = (e: Editor, caret: Caret, portapapeles: string): EditResult =>
  pasteLines(e.deps, caret, pastedLines(portapapeles), APAGADA)

const LISTA: string = "- [x] Fruta\n  - [ ] Peras\nFin"

test("pegar al final de una línea: debajo, con marca y anidado, y el cursor al final de la última", (): void => {
  const e: Editor = editor([t("a", "Compra"), t("b", "Otra")])
  const r: EditResult = pegar(e, en("a", 6), LISTA)
  assert.deepEqual(dibujo(e, r.caret), ["T Compra", "X Fruta", "  C Peras", "T Fin|", "T Otra"])
})

test("pegar en medio de una línea: se parte, y lo pegado entra entre las dos mitades", (): void => {
  const e: Editor = editor([t("a", "Compra")])
  const r: EditResult = pegar(e, en("a", 3), LISTA)
  assert.deepEqual(dibujo(e, r.caret), ["T Com", "X Fruta", "  C Peras", "T Fin|", "T pra"])
})

test("pegar al principio de una línea: encima de ella", (): void => {
  const e: Editor = editor([t("a", "Compra")])
  const r: EditResult = pegar(e, en("a", 0), "- [ ] Pan")
  assert.deepEqual(dibujo(e, r.caret), ["C Pan|", "T Compra"])
})

test("pegar en una línea vacía: lo pegado ocupa su sitio", (): void => {
  const e: Editor = editor([t("a", "Arriba"), t("b", ""), t("c", "Abajo")])
  const r: EditResult = pegar(e, en("b", 0), "uno\ndos")
  assert.deepEqual(dibujo(e, r.caret), ["T Arriba", "T uno", "T dos|", "T Abajo"])
})

test("pegar en una casilla vacía con hijas: no la quita", (): void => {
  const e: Editor = editor([c("a", "", [c("a1", "Hija")])])
  const r: EditResult = pegar(e, en("a", 0), "- [ ] Pan")
  assert.deepEqual(dibujo(e, r.caret), ["C ", "  C Hija", "C Pan|"])
})

test("pegar casillas en una anidada: entran como hermanas suyas", (): void => {
  const e: Editor = editor([c("a", "Compra", [c("a1", "Leche"), c("a2", "Pan")])])
  const r: EditResult = pegar(e, en("a1", 5), "- [ ] Huevos\n- [x] Sal")
  assert.deepEqual(dibujo(e, r.caret), ["C Compra", "  C Leche", "  C Huevos", "  X Sal|", "  C Pan"])
})

test("pegar algún texto en una anidada: entra debajo de su casilla de la raíz", (): void => {
  const e: Editor = editor([c("a", "Compra", [c("a1", "Leche")]), t("b", "Fin")])
  const r: EditResult = pegar(e, en("a1", 5), "uno\n- [ ] dos")
  assert.deepEqual(dibujo(e, r.caret), ["C Compra", "  C Leche", "T uno", "C dos|", "T Fin"])
})

test("pegar algún texto en medio de una anidada: no la parte, y entra debajo de su casilla de la raíz", (): void => {
  const e: Editor = editor([c("a", "Compra", [c("a1", "Leche")])])
  const r: EditResult = pegar(e, en("a1", 2), "uno\ndos")
  assert.deepEqual(dibujo(e, r.caret), ["C Compra", "  C Leche", "T uno", "T dos|"])
})

test("pegar nada en medio de una línea: no la parte", (): void => {
  const e: Editor = editor([t("a", "Compra")])
  const r: EditResult = pasteLines(e.deps, en("a", 3), [], APAGADA)
  assert.deepEqual(dibujo(e, r.caret), ["T Com|pra"])
})

test("pegar en una línea que ya no está: no hace nada", (): void => {
  const e: Editor = editor([t("a", "Compra")])
  const r: EditResult = pegar(e, en("no-esta", 0), LISTA)
  assert.deepEqual(dibujo(e, r.caret), ["T Compra"])
  assert.deepEqual(r.caret, en("no-esta", 0))
})

test("pegar es una sola acción, más la de partir si hace falta", (): void => {
  const e: Editor = editor([t("a", "Compra")])
  let acciones: number = 0
  e.store.subscribe((): void => {
    acciones += 1
  })
  pegar(e, en("a", 6), LISTA)
  assert.equal(acciones, 1, "al final, sólo insertar")
  pegar(e, en("a", 3), LISTA)
  assert.equal(acciones, 3, "en medio, partir e insertar")
})
