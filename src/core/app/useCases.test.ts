/**
 * Los casos de uso: la frontera entre lo impuro y lo puro.
 *
 * Esta capa no tiene lógica —construye el `meta` y despacha— así que la
 * tentación es no probarla. Pero es la **única** que lee el mundo, y hay tres
 * cosas que sólo pasan aquí y que ninguna prueba del reducer puede ver:
 *
 *   1. **el cableado**: diecisiete bloques casi idénticos uno debajo de otro son
 *      justo donde se cuela un copy-paste, y un `renameNote` que despachara
 *      `delete-note` borraría notas al renombrarlas sin que fallara nada en el
 *      reducer, que haría exactamente lo que le piden;
 *   2. **los ids que se generan aquí**: `createNote` y `createContext` devuelven
 *      el suyo, y `insert` y `split` piden **dos** al generador —uno para la
 *      línea y otro para la revisión—, así que hay que comprobar que cada uno se
 *      queda con el que le toca;
 *   3. **que el reloj se lea una sola vez por acción**, que es lo que hace que
 *      todas las entidades que toca reciban la misma marca de tiempo.
 *
 * El `Store` es de mentira: sólo apunta lo que se le despacha. Lo que se
 * comprueba es la acción que sale, no lo que el reducer haga con ella.
 */

import { test } from "node:test"
import assert from "node:assert/strict"

import type { AppState } from "../domain/AppState"
import { isCheckBox, isText } from "../domain/Content"
import { contentId, contextId, noteId, noteRef } from "../domain/Ids"
import { rootEnd } from "../domain/Position"
import type { Clock } from "../ports/Clock"
import type { IdGenerator } from "../ports/IdGenerator"
import type { Action } from "./Action"
import type { Store } from "./Store"
import type { UseCases } from "./useCases"
import { createUseCases } from "./useCases"

/* ────────────────────────────── Utillaje ────────────────────────────────── */

const ID_NOTA = noteId("compra")
const ID_LINEA = contentId("fruta")
const ID_CONTEXTO = contextId("casa")

const VACIO: AppState = { notes: {}, plans: {}, contexts: {} }

const HORA = 1000

/** Un `Store` que no reduce nada: sólo apunta las acciones que recibe. */
const montar = () => {
  let acciones: ReadonlyArray<Action> = []
  let lecturasDelReloj = 0
  let idsGenerados = 0

  const clock: Clock = {
    now: () => {
      lecturasDelReloj += 1
      return HORA
    },
  }
  const ids: IdGenerator = { next: () => `id-${(idsGenerados += 1)}` }

  const store: Store = {
    getState: () => VACIO,
    dispatch: (accion) => {
      acciones = [...acciones, accion]
    },
    subscribe: () => () => undefined,
  }

  return {
    useCases: createUseCases({ clock, ids, store }),
    ultima: (): Action => {
      const a = acciones[acciones.length - 1]
      if (a === undefined) throw new Error("no se ha despachado ninguna acción")
      return a
    },
    cuantas: () => acciones.length,
    lecturasDelReloj: () => lecturasDelReloj,
    idsGenerados: () => idsGenerados,
  }
}

/* ──────────────────── (1) El cableado: los diecisiete ─────────────────────── */

/**
 * Cada caso de uso con el `type` que tiene que despachar. Si alguien añade uno y
 * no lo mete aquí, la última prueba del bloque lo canta.
 */
const CABLEADO: ReadonlyArray<readonly [string, (u: UseCases) => void]> = [
  ["set-checked", (u) => u.setChecked(ID_NOTA, ID_LINEA, true)],
  ["set-text", (u) => u.setText(ID_NOTA, ID_LINEA, "hola")],
  ["insert", (u) => u.insertText(ID_NOTA, "hola", rootEnd)],
  ["insert", (u) => u.insertCheckBox(ID_NOTA, "hola", rootEnd)],
  ["remove", (u) => u.remove(ID_NOTA, ID_LINEA)],
  ["split", (u) => u.split(ID_NOTA, ID_LINEA, 3)],
  ["merge", (u) => u.merge(ID_NOTA, ID_LINEA)],
  ["convert-to-checkbox", (u) => u.convertToCheckBox(ID_NOTA, ID_LINEA)],
  ["convert-to-text", (u) => u.convertToText(ID_NOTA, ID_LINEA)],
  ["create-note", (u) => void u.createNote("Compra")],
  ["rename-note", (u) => u.renameNote(ID_NOTA, "Otra")],
  ["delete-note", (u) => u.deleteNote(ID_NOTA)],
  ["create-context", (u) => void u.createContext("Casa")],
  ["rename-context", (u) => u.renameContext(ID_CONTEXTO, "Otro")],
  ["delete-context", (u) => u.deleteContext(ID_CONTEXTO)],
  ["add-item", (u) => u.addItem(ID_CONTEXTO, noteRef(ID_NOTA))],
  ["remove-item", (u) => u.removeItem(ID_CONTEXTO, noteRef(ID_NOTA))],
  ["set-default-view", (u) => u.setDefaultView(ID_CONTEXTO, { type: "context" })],
]

test("cada caso de uso despacha la acción que le corresponde", () => {
  for (const [esperado, llamar] of CABLEADO) {
    const app = montar()
    llamar(app.useCases)
    assert.equal(app.ultima().type, esperado, `mal cableado: se esperaba ${esperado}`)
  }
})

test("un caso de uso despacha UNA acción, ni ninguna ni dos", () => {
  for (const [nombre, llamar] of CABLEADO) {
    const app = montar()
    llamar(app.useCases)
    assert.equal(app.cuantas(), 1, `${nombre} no ha despachado exactamente una`)
  }
})

test("la lista de cableado cubre TODOS los casos de uso", () => {
  /*
      Esta prueba ya se ha ganado el sitio: cazó que el catálogo eran diecisiete
      acciones y no dieciséis, que es lo que decían el código y los tres
      documentos. El error venía del planteamiento —se sumaron las SIETE de
      contenido que faltaban en vez de las OCHO que hay— y se arrastró sin que
      nada lo comprobara, porque ningún sitio contaba de verdad.

      Son **dieciocho casos de uso para diecisiete acciones**: `insert` tiene dos
      —`insertText` e `insertCheckBox`— porque el id de la línea se genera en esta
      capa y hay que saber qué clase de línea se está creando.
  */
  const app = montar()
  assert.equal(CABLEADO.length, 18, "faltan filas en la lista de cableado")
  assert.equal(Object.keys(app.useCases).length, 18, "hay casos de uso sin cablear aquí")

  // Y el ancla que no existía: cuántas acciones DISTINTAS hay de verdad.
  const tipos = new Set(CABLEADO.map(([tipo]) => tipo))
  assert.equal(tipos.size, 17, "el catálogo son DIECISIETE acciones: 8 + 3 + 6")
})

/* ────────────────── (2) Los ids que se generan en esta capa ───────────────── */

test("createNote devuelve el id de la nota que acaba de crear", () => {
  const app = montar()
  const id = app.useCases.createNote("Compra")
  const accion = app.ultima()

  assert.equal(accion.type, "create-note")
  // ⚠️ Lo que esto vigila: quien crea una nota la abre justo después, y si el id
  // devuelto no fuera el de la acción abriría otra cosa (o nada).
  assert.equal(accion.type === "create-note" && accion.noteId, id)
})

test("createContext devuelve el id del contexto que acaba de crear", () => {
  const app = montar()
  const id = app.useCases.createContext("Casa")
  const accion = app.ultima()

  assert.equal(accion.type === "create-context" && accion.contextId, id)
})

test("dos notas seguidas reciben ids DISTINTOS", () => {
  const app = montar()
  assert.notEqual(app.useCases.createNote("Una"), app.useCases.createNote("Otra"))
})

test("insertText da al bloque su propio id, distinto del de la revisión", () => {
  const app = montar()
  app.useCases.insertText(ID_NOTA, "Leche", rootEnd)
  const accion = app.ultima()

  assert.ok(accion.type === "insert")
  assert.equal(app.idsGenerados(), 2, "hacen falta dos ids: el del bloque y el de la revisión")
  // ⚠️ Aquí es donde el orden de evaluación del objeto literal deja de ser un
  // detalle: si se invirtiera, el bloque nacería con el id de la revisión.
  assert.notEqual(accion.block.id, accion.meta.revision)
  assert.ok(isText(accion.block), "insertText tiene que meter un texto")
  assert.equal(isText(accion.block) && accion.block.text, "Leche")
})

test("insertCheckBox mete una casilla, no un texto", () => {
  const app = montar()
  app.useCases.insertCheckBox(ID_NOTA, "Pan", rootEnd)
  const accion = app.ultima()

  assert.ok(accion.type === "insert")
  assert.ok(isCheckBox(accion.block), "ha metido un texto en vez de una casilla")
  assert.equal(isCheckBox(accion.block) && accion.block.checked, false, "nace marcada")
})

test("split pide un id para la mitad nueva, distinto del de la revisión", () => {
  const app = montar()
  app.useCases.split(ID_NOTA, ID_LINEA, 3)
  const accion = app.ultima()

  assert.ok(accion.type === "split")
  assert.equal(app.idsGenerados(), 2)
  assert.notEqual(accion.newId, accion.meta.revision)
  assert.notEqual(accion.newId, accion.contentId, "la mitad nueva reusa el id de la vieja")
  assert.equal(accion.offset, 3)
})

test("las acciones que NO crean nada piden un solo id: el de la revisión", () => {
  const sinIdNuevo: ReadonlyArray<(u: UseCases) => void> = [
    (u) => u.setChecked(ID_NOTA, ID_LINEA, true),
    (u) => u.setText(ID_NOTA, ID_LINEA, "x"),
    (u) => u.remove(ID_NOTA, ID_LINEA),
    (u) => u.merge(ID_NOTA, ID_LINEA),
    (u) => u.convertToCheckBox(ID_NOTA, ID_LINEA),
    (u) => u.convertToText(ID_NOTA, ID_LINEA),
    (u) => u.renameNote(ID_NOTA, "x"),
    (u) => u.deleteNote(ID_NOTA),
  ]

  for (const llamar of sinIdNuevo) {
    const app = montar()
    llamar(app.useCases)
    assert.equal(app.idsGenerados(), 1)
  }
})

/* ─────────────── (3) El reloj se lee una sola vez por acción ──────────────── */

test("cada acción lee el reloj exactamente UNA vez", () => {
  /*
      No es una micro-optimización. Es lo que garantiza que `delete-note`, que
      toca la nota y todos los contextos que la listaban, les ponga a todos la
      MISMA marca de tiempo y no milisegundos distintos según el orden del bucle
      (`ARCHITECTURE.md` §9.7).
  */
  for (const [nombre, llamar] of CABLEADO) {
    const app = montar()
    llamar(app.useCases)
    assert.equal(app.lecturasDelReloj(), 1, `${nombre} ha leído el reloj más de una vez`)
  }
})

test("la hora del reloj llega tal cual al meta de la acción", () => {
  const app = montar()
  app.useCases.setChecked(ID_NOTA, ID_LINEA, true)

  assert.equal(app.ultima().meta.now, HORA)
})

test("dos acciones seguidas reciben revisiones DISTINTAS", () => {
  const app = montar()
  app.useCases.setChecked(ID_NOTA, ID_LINEA, true)
  const primera = app.ultima().meta.revision
  app.useCases.setChecked(ID_NOTA, ID_LINEA, false)

  assert.notEqual(app.ultima().meta.revision, primera)
})
