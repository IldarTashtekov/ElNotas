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

import type { AppState } from "#core/domain/AppState"
import type { Content } from "#core/domain/Content"
import { checkBox, isCheckBox, isText, text } from "#core/domain/Content"
import type { Context } from "#core/domain/Context"
import type { ContextId, ItemRef, NoteId } from "#core/domain/Ids"
import { contentId, contextId, noteId, noteRef, revision } from "#core/domain/Ids"
import type { Note } from "#core/domain/Note"
import { after, rootEnd } from "#core/domain/Position"
import type { Clock } from "#core/ports/Clock"
import type { IdGenerator } from "#core/ports/IdGenerator"
import type { Action } from "#core/app/Action"
import type { Store } from "#core/app/Store"
import { createStore } from "#core/app/Store"
import type { UseCases } from "#core/app/useCases"
import { createUseCases } from "#core/app/useCases"

/* ────────────────────────────── Utillaje ────────────────────────────────── */

/*
    Hay DOS montajes a propósito, y la diferencia importa:

    montar()          un `Store` de mentira que sólo apunta acciones. Aísla esta
                      capa del reducer, y es con el que se comprueba el cableado.
    montarDeVerdad()  el `Store` real, con el reducer dentro. Hace falta para lo
                      que devuelven los casos de uso, que depende de si la acción
                      cambió algo — y eso sólo lo sabe el reducer.
*/

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

/** El `Store` de verdad, reducer incluido. Para ver qué devuelve cada caso de uso. */
const montarDeVerdad = (
  inicial: AppState = VACIO,
): { readonly store: Store; readonly useCases: UseCases } => {
  let idsGenerados: number = 0
  const clock: Clock = { now: (): number => HORA }
  const ids: IdGenerator = { next: (): string => `id-${(idsGenerados += 1)}` }
  const store: Store = createStore(inicial)

  return { store, useCases: createUseCases({ clock, ids, store }) }
}

const notaCon = (id: NoteId, contenido: ReadonlyArray<Content>): Note => ({
  id,
  name: "Compra",
  content: contenido,
  updatedAt: 0,
  revision: revision("r0"),
})

const conNotas = (...notas: ReadonlyArray<Note>): AppState => ({
  ...VACIO,
  notes: Object.fromEntries(notas.map((n: Note): [NoteId, Note] => [n.id, n])),
})

const contextoCon = (id: ContextId, items: ReadonlyArray<ItemRef>): Context => ({
  id,
  name: "Casa",
  defaultView: { type: "context" },
  items,
  updatedAt: 0,
  revision: revision("r0"),
})

const conContextos = (...ctxs: ReadonlyArray<Context>): AppState => ({
  ...VACIO,
  contexts: Object.fromEntries(ctxs.map((c: Context): [ContextId, Context] => [c.id, c])),
})

/* ──────────────────── (1) El cableado: los diecisiete ─────────────────────── */

/**
 * Cada caso de uso con el `type` que tiene que despachar. Si alguien añade uno y
 * no lo mete aquí, la última prueba del bloque lo canta.
 */
const CABLEADO: ReadonlyArray<
  readonly [string, (u: UseCases) => Note | Context | null]
> = [
  ["set-checked", (u) => u.setChecked(ID_NOTA, ID_LINEA, true)],
  ["set-text", (u) => u.setText(ID_NOTA, ID_LINEA, "hola")],
  ["insert", (u) => u.insertText(ID_NOTA, "hola", rootEnd)],
  ["insert", (u) => u.insertCheckBox(ID_NOTA, "hola", rootEnd)],
  ["remove", (u) => u.remove(ID_NOTA, ID_LINEA)],
  ["split", (u) => u.split(ID_NOTA, ID_LINEA, 3)],
  ["merge", (u) => u.merge(ID_NOTA, ID_LINEA)],
  ["convert-to-checkbox", (u) => u.convertToCheckBox(ID_NOTA, ID_LINEA)],
  ["convert-to-text", (u) => u.convertToText(ID_NOTA, ID_LINEA)],
  ["create-note", (u) => u.createNote("Compra")],
  ["rename-note", (u) => u.renameNote(ID_NOTA, "Otra")],
  ["delete-note", (u) => u.deleteNote(ID_NOTA)],
  ["create-context", (u) => u.createContext("Casa")],
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

test("createNote devuelve LA nota que acaba de crear, la misma que está en el estado", () => {
  const { store, useCases } = montarDeVerdad()
  const creada: Note | null = useCases.createNote("Compra")

  assert.ok(creada !== null, "crear sobre un estado vacío no puede ser no-op")
  // ⚠️ Lo que esto vigila: quien crea una nota la abre justo después. Si lo
  // devuelto no fuera lo que está guardado, abriría otra cosa (o nada).
  assert.strictEqual(creada, store.getState().notes[creada.id])
})

test("createContext devuelve EL contexto que acaba de crear", () => {
  const { store, useCases } = montarDeVerdad()
  const creado: Context | null = useCases.createContext("Casa")

  assert.ok(creado !== null)
  assert.strictEqual(creado, store.getState().contexts[creado.id])
})

test("dos notas seguidas reciben ids DISTINTOS", () => {
  const { useCases } = montarDeVerdad()
  const una: Note | null = useCases.createNote("Una")
  const otra: Note | null = useCases.createNote("Otra")

  assert.ok(una !== null && otra !== null)
  assert.notEqual(una.id, otra.id)
})

/* ────────── (2b) Qué devuelven: los cuatro caminos, uno por uno ──────────── */

test("⚠️ los DIECISÉIS que no crean devuelven null si no hay a qué aplicarlos", () => {
  /*
      Barrido sobre la lista entera, y por la misma razón que existe la lista:
      son dieciocho líneas casi idénticas, que es donde se cuela un copy-paste.
      Los tipos marcados impiden equivocarse de ayudante —`trasNota` no acepta un
      `ContextId`— pero no impiden olvidarse de pasar por él.

      Las dos de crear quedan fuera porque crear sobre un estado vacío SÍ aplica;
      van en la prueba de debajo, que es la otra mitad del barrido.
  */
  for (const [tipo, llamar] of CABLEADO) {
    if (tipo.startsWith("create-")) continue
    const { useCases } = montarDeVerdad()
    assert.equal(llamar(useCases), null, `${tipo} no devolvió null sobre un estado vacío`)
  }
})

test("y los DOS que crean devuelven la entidad recién creada", () => {
  for (const [tipo, llamar] of CABLEADO) {
    if (!tipo.startsWith("create-")) continue
    const { useCases } = montarDeVerdad()
    assert.notEqual(llamar(useCases), null, `${tipo} tenía que haber creado algo`)
  }
})

/**
 * Los de contenido cuya línea objetivo no existe, **con la nota sí existiendo**.
 *
 * ⚠️ Esta es la que tiene dientes, y el barrido de arriba no los tiene: si la
 * nota tampoco existe, un caso de uso que **se salte la comparación** y devuelva
 * `getState().notes[id]` a secas sale `null` igualmente y pasa en verde. Con la
 * nota presente, ése devuelve la nota y esto lo canta.
 *
 * Fuera quedan los dos `insert`, que sobre una nota vacía **sí aplican**: meten
 * la línea al final.
 */
const NO_OP_CON_NOTA: ReadonlyArray<readonly [string, (u: UseCases) => Note | null]> = [
  ["setChecked", (u) => u.setChecked(ID_NOTA, ID_LINEA, true)],
  ["setText", (u) => u.setText(ID_NOTA, ID_LINEA, "hola")],
  ["remove", (u) => u.remove(ID_NOTA, ID_LINEA)],
  ["split", (u) => u.split(ID_NOTA, ID_LINEA, 3)],
  ["merge", (u) => u.merge(ID_NOTA, ID_LINEA)],
  ["convertToCheckBox", (u) => u.convertToCheckBox(ID_NOTA, ID_LINEA)],
  ["convertToText", (u) => u.convertToText(ID_NOTA, ID_LINEA)],
  // Renombrar con el nombre que ya tiene: no-op. `notaCon` la llama "Compra".
  ["renameNote", (u) => u.renameNote(ID_NOTA, "Compra")],
  // Insertar TRAS una línea que no existe: no-op. Con `rootEnd` sí aplicaría.
  ["insertText", (u) => u.insertText(ID_NOTA, "hola", after(contentId("fantasma")))],
  ["insertCheckBox", (u) => u.insertCheckBox(ID_NOTA, "hola", after(contentId("fantasma")))],
]

test("⚠️ un no-op devuelve null AUNQUE la nota exista — los diez, uno por uno", () => {
  for (const [nombre, llamar] of NO_OP_CON_NOTA) {
    const nota: Note = notaCon(ID_NOTA, [])
    const { store, useCases } = montarDeVerdad(conNotas(nota))

    assert.equal(llamar(useCases), null, `${nombre} devolvió algo sin haber cambiado nada`)
    // Y de paso: no ha estampado `updatedAt` ni `revision` sobre la nota.
    assert.strictEqual(store.getState().notes[ID_NOTA], nota, `${nombre} tocó la nota`)
  }
})

/**
 * Lo mismo del lado del Contexto, y hace falta igual: el agujero es simétrico.
 *
 * Son las tres que pueden no aplicar con el contexto ya presente —meter una
 * referencia a algo que no existe, quitar lo que no estaba, poner la vista que ya
 * tenía—. `renameContext` y `deleteContext` siempre aplican si el contexto está.
 */
const NO_OP_CON_CONTEXTO: ReadonlyArray<
  readonly [string, (u: UseCases) => Context | null]
> = [
  ["addItem", (u) => u.addItem(ID_CONTEXTO, noteRef(noteId("fantasma")))],
  ["removeItem", (u) => u.removeItem(ID_CONTEXTO, noteRef(noteId("fantasma")))],
  ["setDefaultView", (u) => u.setDefaultView(ID_CONTEXTO, { type: "context" })],
  // `contextoCon` lo llama "Casa": renombrarlo igual es no-op.
  ["renameContext", (u) => u.renameContext(ID_CONTEXTO, "Casa")],
]

test("⚠️ un no-op devuelve null AUNQUE el contexto exista — las cuatro", () => {
  for (const [nombre, llamar] of NO_OP_CON_CONTEXTO) {
    const ctx: Context = contextoCon(ID_CONTEXTO, [])
    const { store, useCases } = montarDeVerdad(conContextos(ctx))

    assert.equal(llamar(useCases), null, `${nombre} devolvió algo sin haber cambiado nada`)
    assert.strictEqual(store.getState().contexts[ID_CONTEXTO], ctx, `${nombre} tocó el contexto`)
  }
})

test("deleteContext devuelve el contexto BORRADO, igual que deleteNote", () => {
  const ctx: Context = contextoCon(ID_CONTEXTO, [])
  const { store, useCases } = montarDeVerdad(conContextos(ctx))

  assert.strictEqual(useCases.deleteContext(ID_CONTEXTO), ctx)
  assert.equal(store.getState().contexts[ID_CONTEXTO], undefined)
})

test("una acción que cambia algo devuelve la entidad YA ACTUALIZADA", () => {
  const { store, useCases } = montarDeVerdad(conNotas(notaCon(ID_NOTA, [])))
  const antes: Note | undefined = store.getState().notes[ID_NOTA]
  const despues: Note | null = useCases.renameNote(ID_NOTA, "Compra semanal")

  assert.ok(despues !== null)
  assert.equal(despues.name, "Compra semanal")
  // No es la de antes: es la nueva. Devolver la vieja sería peor que no devolver.
  assert.notStrictEqual(despues, antes)
  assert.strictEqual(despues, store.getState().notes[ID_NOTA])
})

test("⚠️ un NO-OP devuelve null, que es lo que este retorno existe para poder decir", () => {
  /*
      Es la razón entera del cambio. Sin esto, «hecho» y «no aplicaba» se ven
      igual desde quien llama, porque una operación que no aplica no falla: no
      hace nada. El caso elegido es el de la decisión cerrada —`remove` sobre una
      casilla con hijas es no-op— y no uno inventado.
  */
  const madre: Content = checkBox(ID_LINEA, "Fruta", {
    children: [checkBox(contentId("manzana"), "Manzanas")],
  })
  const nota: Note = notaCon(ID_NOTA, [madre])
  const { store, useCases } = montarDeVerdad(conNotas(nota))

  assert.equal(useCases.remove(ID_NOTA, ID_LINEA), null)
  // Y no ha tocado nada: la nota guardada sigue siendo EL MISMO objeto, así que
  // ni `updatedAt` ni `revision` se han estampado.
  assert.strictEqual(store.getState().notes[ID_NOTA], nota)
})

test("renombrar una nota que no existe devuelve null", () => {
  const { useCases } = montarDeVerdad()
  assert.equal(useCases.renameNote(noteId("fantasma"), "Da igual"), null)
})

test("deleteNote devuelve la nota BORRADA, que ya no está en el estado", () => {
  const nota: Note = notaCon(ID_NOTA, [text(ID_LINEA, "Fruta")])
  const { store, useCases } = montarDeVerdad(conNotas(nota))
  const borrada: Note | null = useCases.deleteNote(ID_NOTA)

  // La que se devuelve es la que había, con su contenido: es lo único que queda
  // de ella. Devolver `null` aquí perdería la entidad para siempre.
  assert.strictEqual(borrada, nota)
  assert.equal(store.getState().notes[ID_NOTA], undefined)
})

test("borrar una nota que no existe devuelve null, no una entidad fantasma", () => {
  const { useCases } = montarDeVerdad()
  assert.equal(useCases.deleteNote(noteId("fantasma")), null)
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
     .
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
