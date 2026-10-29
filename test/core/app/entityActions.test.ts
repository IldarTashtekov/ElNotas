/**
 * Las doce acciones de entidad: tres de Nota y nueve de Contexto.
 *
 * A diferencia de las de contenido, éstas **no se apoyan en ninguna operación de
 * la Fase 1**: la lógica está aquí, y por eso hay más que probar.
 *
 * El centro de todo es `delete-note`, que es la primera acción del proyecto que
 * toca **dos entidades a la vez**. Tiene tres cosas que
 * hacer bien y las tres tienen su prueba:
 *
 *   1. limpiar los contextos que la listaban — o queda una `ItemRef` colgando;
 *   2. dar a todos los tocados **el mismo `meta`**;
 *   3. devolver **intactos, por referencia**, los que no la listaban.
 *
 * La (3) es la que no salta a la vista y la que más cuesta si se rompe: un `map`
 * sobre todos los contextos hace que borrar una nota reescriba en disco la app
 * entera, sin fallar nada visible.
 */

import { test } from "node:test"
import assert from "node:assert/strict"

import type { AppState } from "#core/domain/AppState"
import type { Context } from "#core/domain/Context"
import type { ItemRef } from "#core/domain/Ids"
import { contextId, diagramId, diagramRef, noteId, noteRef, revision } from "#core/domain/Ids"
import type { Note } from "#core/domain/Note"
import type { Diagram } from "#core/domain/Diagram"
import type { ActionMeta } from "#core/app/Action"
import { reduce } from "#core/app/reduce"

/* ────────────────────────────── El escenario ────────────────────────────── */

const ID_COMPRA = noteId("compra")
const ID_DIARIO = noteId("diario")
const ID_MUDANZA = diagramId("mudanza")
const ID_CASA = contextId("casa")
const ID_TRABAJO = contextId("trabajo")
const ID_VACIO = contextId("vacio")

const HORA_INICIAL = 0
const META: ActionMeta = { now: 1000, revision: revision("rev-nueva") }

const nota = (id: typeof ID_COMPRA, name: string): Note => ({
  id,
  name,
  content: [],
  updatedAt: HORA_INICIAL,
  revision: revision(`rev-${id}`),
})

const MUDANZA: Diagram = {
  id: ID_MUDANZA,
  name: "Mudanza",
  nodes: {},
  relations: {},
  updatedAt: HORA_INICIAL,
  revision: revision("rev-mudanza"),
}

const contexto = (
  id: typeof ID_CASA,
  name: string,
  items: Context["items"],
): Context => ({
  id,
  name,
  defaultView: { type: "context" },
  items,
  updatedAt: HORA_INICIAL,
  revision: revision(`rev-${id}`),
})

/**
 *   notas:     compra · diario          diagramas: mudanza
 *   contextos: casa    → [compra, diario]
 *              trabajo → [compra]
 *              vacio   → []
 */
const estado = (): AppState => ({
  notes: { [ID_COMPRA]: nota(ID_COMPRA, "Compra"), [ID_DIARIO]: nota(ID_DIARIO, "Diario") },
  diagrams: { [ID_MUDANZA]: MUDANZA },
  contexts: {
    [ID_CASA]: contexto(ID_CASA, "Casa", [noteRef(ID_COMPRA), noteRef(ID_DIARIO)]),
    [ID_TRABAJO]: contexto(ID_TRABAJO, "Trabajo", [noteRef(ID_COMPRA)]),
    [ID_VACIO]: contexto(ID_VACIO, "Vacío", []),
  },
  events: {},
  routines: {},
})

const ctx = (s: AppState, id: typeof ID_CASA): Context => {
  const c = s.contexts[id]
  if (c === undefined) throw new Error(`el contexto ${id} tiene que existir`)
  return c
}

/* ────────────────────────────────── Nota ──────────────────────────────────── */

test("create-note crea una nota vacía con sus metadatos", () => {
  const nueva = noteId("recetas")
  const s = reduce(estado(), { type: "create-note", noteId: nueva, name: "Recetas", meta: META })

  const n = s.notes[nueva]
  assert.equal(n?.name, "Recetas")
  assert.deepEqual(n?.content, [])
  assert.equal(n?.updatedAt, META.now)
  assert.equal(n?.revision, META.revision)
})

test("create-note con un id que ya existe es no-op", () => {
  const antes = estado()
  const s = reduce(antes, { type: "create-note", noteId: ID_COMPRA, name: "Otra", meta: META })

  assert.strictEqual(s, antes)
  assert.equal(s.notes[ID_COMPRA]?.name, "Compra", "ha machacado la nota que había")
})

test("rename-note cambia el nombre y estampa", () => {
  const s = reduce(estado(), { type: "rename-note", noteId: ID_COMPRA, name: "Compra del mes", meta: META })

  assert.equal(s.notes[ID_COMPRA]?.name, "Compra del mes")
  assert.equal(s.notes[ID_COMPRA]?.updatedAt, META.now)
})

test("rename-note con el mismo nombre es no-op", () => {
  const antes = estado()
  assert.strictEqual(
    reduce(antes, { type: "rename-note", noteId: ID_COMPRA, name: "Compra", meta: META }),
    antes,
  )
})

test("rename-note sobre una nota inexistente es no-op", () => {
  const antes = estado()
  assert.strictEqual(
    reduce(antes, { type: "rename-note", noteId: noteId("no-existe"), name: "x", meta: META }),
    antes,
  )
})

test("rename-note NO toca los contextos", () => {
  const antes = estado()
  const s = reduce(antes, { type: "rename-note", noteId: ID_COMPRA, name: "Otra", meta: META })

  // El nombre vive en la nota; los contextos sólo guardan referencias.
  assert.strictEqual(s.contexts, antes.contexts)
})

/* ──────────── delete-note: la integridad referencial, que es el meollo ────── */

test("delete-note borra la nota", () => {
  const s = reduce(estado(), { type: "delete-note", noteId: ID_COMPRA, meta: META })
  assert.equal(s.notes[ID_COMPRA], undefined)
  assert.notEqual(s.notes[ID_DIARIO], undefined, "se ha llevado por delante otra nota")
})

test("delete-note la quita de TODOS los contextos que la listaban", () => {
  const s = reduce(estado(), { type: "delete-note", noteId: ID_COMPRA, meta: META })

  assert.deepEqual(ctx(s, ID_CASA).items, [noteRef(ID_DIARIO)])
  assert.deepEqual(ctx(s, ID_TRABAJO).items, [])
})

test("delete-note da a todos los contextos tocados el MISMO meta", () => {
  const s = reduce(estado(), { type: "delete-note", noteId: ID_COMPRA, meta: META })

  // Ni un milisegundo de diferencia entre ellos: el meta se construye una vez.
  assert.equal(ctx(s, ID_CASA).updatedAt, META.now)
  assert.equal(ctx(s, ID_TRABAJO).updatedAt, META.now)
  assert.equal(ctx(s, ID_CASA).revision, META.revision)
  assert.equal(ctx(s, ID_TRABAJO).revision, META.revision)
})

test("delete-note deja INTACTOS, por referencia, los contextos que no la listaban", () => {
  const antes = estado()
  const s = reduce(antes, { type: "delete-note", noteId: ID_COMPRA, meta: META })

  // ⚠️ La prueba que impide que borrar una nota reescriba la app entera en disco.
  assert.strictEqual(ctx(s, ID_VACIO), ctx(antes, ID_VACIO))
})

test("delete-note de una nota que no está en ningún contexto no toca ninguno", () => {
  const antes: AppState = {
    ...estado(),
    contexts: { [ID_VACIO]: contexto(ID_VACIO, "Vacío", []) },
  }
  const s = reduce(antes, { type: "delete-note", noteId: ID_COMPRA, meta: META })

  assert.strictEqual(s.contexts, antes.contexts, "ha copiado el mapa de contextos para nada")
})

test("delete-note sobre una nota inexistente es no-op", () => {
  const antes = estado()
  assert.strictEqual(
    reduce(antes, { type: "delete-note", noteId: noteId("no-existe"), meta: META }),
    antes,
  )
})

/* ──────────────────────────────── Contexto ────────────────────────────────── */

test("create-context nace con la lista vacía y vista de contexto", () => {
  const nuevo = contextId("ocio")
  const s = reduce(estado(), { type: "create-context", contextId: nuevo, name: "Ocio", meta: META })

  assert.equal(ctx(s, nuevo).name, "Ocio")
  assert.deepEqual(ctx(s, nuevo).items, [])
  assert.deepEqual(ctx(s, nuevo).defaultView, { type: "context" })
})

test("delete-context NO borra las notas que contenía", () => {
  const antes = estado()
  const s = reduce(antes, { type: "delete-context", contextId: ID_CASA, meta: META })

  assert.equal(s.contexts[ID_CASA], undefined)
  // Sólo guardaba referencias: las notas siguen ahí, y en el otro contexto.
  assert.strictEqual(s.notes, antes.notes, "ha tocado el mapa de notas")
  assert.deepEqual(ctx(s, ID_TRABAJO).items, [noteRef(ID_COMPRA)])
})

test("rename-context con el mismo nombre es no-op", () => {
  const antes = estado()
  assert.strictEqual(
    reduce(antes, { type: "rename-context", contextId: ID_CASA, name: "Casa", meta: META }),
    antes,
  )
})

/* ──────────────── add-item: el otro lado de la integridad ─────────────────── */

test("add-item mete la referencia", () => {
  const s = reduce(estado(), { type: "add-item", contextId: ID_VACIO, item: noteRef(ID_COMPRA), meta: META })
  assert.deepEqual(ctx(s, ID_VACIO).items, [noteRef(ID_COMPRA)])
})

test("add-item admite diagramas, no sólo notas", () => {
  const s = reduce(estado(), { type: "add-item", contextId: ID_VACIO, item: diagramRef(ID_MUDANZA), meta: META })
  assert.deepEqual(ctx(s, ID_VACIO).items, [diagramRef(ID_MUDANZA)])
})

test("add-item de algo que NO EXISTE es no-op", () => {
  const antes = estado()
  assert.strictEqual(
    reduce(antes, {
      type: "add-item",
      contextId: ID_VACIO,
      item: noteRef(noteId("no-existe")),
      meta: META,
    }),
    antes,
  )
})

test("add-item de algo que ya estaba es no-op", () => {
  const antes = estado()
  assert.strictEqual(
    reduce(antes, { type: "add-item", contextId: ID_CASA, item: noteRef(ID_COMPRA), meta: META }),
    antes,
  )
})

test("add-item distingue una nota de un diagrama con el mismo id", () => {
  // `kind` existe justamente para esto: Note y Diagram no son discriminables entre
  // sí en runtime —los dos son { id, name, … }— pero sus referencias sí.
  const mismoTexto = diagramId("compra") // mismo string que ID_COMPRA, otra clase
  const conDiagrama: AppState = {
    ...estado(),
    diagrams: { [mismoTexto]: { ...MUDANZA, id: mismoTexto } },
  }
  const s = reduce(conDiagrama, {
    type: "add-item",
    contextId: ID_TRABAJO,
    item: diagramRef(mismoTexto),
    meta: META,
  })

  assert.deepEqual(ctx(s, ID_TRABAJO).items, [noteRef(ID_COMPRA), diagramRef(mismoTexto)])
})

/* ─────────────────────────────── remove-item ──────────────────────────────── */

test("remove-item quita la referencia", () => {
  const s = reduce(estado(), { type: "remove-item", contextId: ID_CASA, item: noteRef(ID_COMPRA), meta: META })
  assert.deepEqual(ctx(s, ID_CASA).items, [noteRef(ID_DIARIO)])
})

test("remove-item de algo que no estaba es no-op", () => {
  const antes = estado()
  // `filter` SIEMPRE devuelve un array nuevo: sin la comparación de longitud,
  // esto ensuciaría el contexto y lo reescribiría en disco.
  assert.strictEqual(
    reduce(antes, { type: "remove-item", contextId: ID_VACIO, item: noteRef(ID_COMPRA), meta: META }),
    antes,
  )
})

test("remove-item NO borra la nota, sólo la saca del contexto", () => {
  const s = reduce(estado(), { type: "remove-item", contextId: ID_CASA, item: noteRef(ID_COMPRA), meta: META })

  assert.notEqual(s.notes[ID_COMPRA], undefined)
  assert.deepEqual(ctx(s, ID_TRABAJO).items, [noteRef(ID_COMPRA)], "la ha sacado de otro contexto")
})

/* ────────────────────────────── set-default-view ──────────────────────────── */

test("set-default-view cambia a entrar directo en una nota", () => {
  const s = reduce(estado(), {
    type: "set-default-view",
    contextId: ID_CASA,
    view: { type: "note", id: ID_COMPRA },
    meta: META,
  })

  assert.deepEqual(ctx(s, ID_CASA).defaultView, { type: "note", id: ID_COMPRA })
})

test("set-default-view con la vista que ya tenía es no-op", () => {
  const antes = estado()
  assert.strictEqual(
    reduce(antes, {
      type: "set-default-view",
      contextId: ID_CASA,
      view: { type: "context" },
      meta: META,
    }),
    antes,
  )
})

test("set-default-view a la misma nota que ya apuntaba es no-op", () => {
  const conVista: AppState = {
    ...estado(),
    contexts: {
      ...estado().contexts,
      [ID_CASA]: { ...ctx(estado(), ID_CASA), defaultView: { type: "note", id: ID_COMPRA } },
    },
  }

  assert.strictEqual(
    reduce(conVista, {
      type: "set-default-view",
      contextId: ID_CASA,
      view: { type: "note", id: ID_COMPRA },
      meta: META,
    }),
    conVista,
  )
})

/* ──────────── hide-items y show-items: lo oculto, siempre dentro de items ──── */

/** Casa, con Diario oculto. */
const conOculto = (): AppState => {
  const s: AppState = estado()
  return {
    ...s,
    contexts: { ...s.contexts, [ID_CASA]: { ...ctx(s, ID_CASA), hidden: [noteRef(ID_DIARIO)] } },
  }
}

test("hide-items oculta lo del contexto, sin sacarlo de items", (): void => {
  const s: AppState = reduce(estado(), {
    type: "hide-items",
    contextId: ID_CASA,
    items: [noteRef(ID_COMPRA)],
    meta: META,
  })

  assert.deepEqual(ctx(s, ID_CASA).hidden, [noteRef(ID_COMPRA)])
  assert.deepEqual(ctx(s, ID_CASA).items, [noteRef(ID_COMPRA), noteRef(ID_DIARIO)])
  assert.equal(ctx(s, ID_CASA).updatedAt, META.now)
})

test("hide-items oculta varios a la vez, y cada uno una sola vez", (): void => {
  const s: AppState = reduce(estado(), {
    type: "hide-items",
    contextId: ID_CASA,
    items: [noteRef(ID_DIARIO), noteRef(ID_COMPRA), noteRef(ID_DIARIO)],
    meta: META,
  })
  assert.deepEqual(ctx(s, ID_CASA).hidden, [noteRef(ID_DIARIO), noteRef(ID_COMPRA)])
})

test("hide-items de lo que NO está en el contexto es no-op", (): void => {
  const antes: AppState = estado()
  // Compra está en Trabajo, pero el diagrama no: ocultarlo dejaría `hidden` fuera de `items`.
  assert.strictEqual(
    reduce(antes, { type: "hide-items", contextId: ID_TRABAJO, items: [diagramRef(ID_MUDANZA)], meta: META }),
    antes,
  )
})

test("hide-items de lo que ya estaba oculto es no-op", (): void => {
  const antes: AppState = conOculto()
  assert.strictEqual(
    reduce(antes, { type: "hide-items", contextId: ID_CASA, items: [noteRef(ID_DIARIO)], meta: META }),
    antes,
  )
})

test("show-items lo devuelve a la lista", (): void => {
  const s: AppState = reduce(conOculto(), {
    type: "show-items",
    contextId: ID_CASA,
    items: [noteRef(ID_DIARIO)],
    meta: META,
  })
  assert.deepEqual(ctx(s, ID_CASA).hidden, [])
  assert.deepEqual(ctx(s, ID_CASA).items, [noteRef(ID_COMPRA), noteRef(ID_DIARIO)])
})

test("show-items de lo que no estaba oculto es no-op, también sin hidden guardado", (): void => {
  const antes: AppState = conOculto()
  assert.strictEqual(
    reduce(antes, { type: "show-items", contextId: ID_CASA, items: [noteRef(ID_COMPRA)], meta: META }),
    antes,
  )
  const sinHidden: AppState = estado()
  assert.strictEqual(
    reduce(sinHidden, { type: "show-items", contextId: ID_CASA, items: [noteRef(ID_COMPRA)], meta: META }),
    sinHidden,
  )
})

test("remove-item lo saca también de hidden", (): void => {
  const s: AppState = reduce(conOculto(), {
    type: "remove-item",
    contextId: ID_CASA,
    item: noteRef(ID_DIARIO),
    meta: META,
  })
  assert.deepEqual(ctx(s, ID_CASA).items, [noteRef(ID_COMPRA)])
  assert.deepEqual(ctx(s, ID_CASA).hidden, [])
})

test("delete-note la saca también de hidden", (): void => {
  const s: AppState = reduce(conOculto(), { type: "delete-note", noteId: ID_DIARIO, meta: META })
  assert.deepEqual(ctx(s, ID_CASA).items, [noteRef(ID_COMPRA)])
  assert.deepEqual(ctx(s, ID_CASA).hidden, [])
})

test("remove-item de lo que no estaba es no-op, también con algo oculto", (): void => {
  const antes: AppState = conOculto()
  assert.strictEqual(
    reduce(antes, { type: "remove-item", contextId: ID_CASA, item: diagramRef(ID_MUDANZA), meta: META }),
    antes,
  )
})

test("remove-item de un contexto sin hidden guardado no se lo inventa", (): void => {
  const s: AppState = reduce(estado(), {
    type: "remove-item",
    contextId: ID_CASA,
    item: noteRef(ID_COMPRA),
    meta: META,
  })
  assert.equal("hidden" in ctx(s, ID_CASA), false, "ha escrito un hidden que no había")
})

/* ─────────────── reorder-items: varios, como un bloque, en su orden ────────── */

const ID_PAN = noteId("pan")

/** Casa con cuatro: compra · diario · pan · mudanza. */
const conCuatro = (): AppState => {
  const s: AppState = estado()
  return {
    ...s,
    notes: { ...s.notes, [ID_PAN]: nota(ID_PAN, "Pan") },
    contexts: {
      ...s.contexts,
      [ID_CASA]: {
        ...ctx(s, ID_CASA),
        items: [noteRef(ID_COMPRA), noteRef(ID_DIARIO), noteRef(ID_PAN), diagramRef(ID_MUDANZA)],
      },
    },
  }
}

const reordenar = (
  s: AppState,
  items: ReadonlyArray<ItemRef>,
  before: ItemRef | null,
): AppState => reduce(s, { type: "reorder-items", contextId: ID_CASA, items, before, meta: META })

test("reorder-items mueve varios juntos, en el orden en que los lista el contexto", (): void => {
  // Pedidos al revés: se quedan en su orden relativo, no en el de la petición.
  const s: AppState = reordenar(conCuatro(), [diagramRef(ID_MUDANZA), noteRef(ID_COMPRA)], noteRef(ID_PAN))
  assert.deepEqual(ctx(s, ID_CASA).items, [
    noteRef(ID_DIARIO),
    noteRef(ID_COMPRA),
    diagramRef(ID_MUDANZA),
    noteRef(ID_PAN),
  ])
  assert.equal(ctx(s, ID_CASA).updatedAt, META.now)
})

test("reorder-items con before null los pone al final", (): void => {
  const s: AppState = reordenar(conCuatro(), [noteRef(ID_COMPRA), noteRef(ID_DIARIO)], null)
  assert.deepEqual(ctx(s, ID_CASA).items, [
    noteRef(ID_PAN),
    diagramRef(ID_MUDANZA),
    noteRef(ID_COMPRA),
    noteRef(ID_DIARIO),
  ])
})

test("reorder-items que los suelta donde estaban es no-op", (): void => {
  const antes: AppState = conCuatro()
  // Diario y Pan, delante de Mudanza: ya estaban ahí, juntos.
  assert.strictEqual(reordenar(antes, [noteRef(ID_DIARIO), noteRef(ID_PAN)], diagramRef(ID_MUDANZA)), antes)
  assert.strictEqual(reordenar(antes, [diagramRef(ID_MUDANZA)], null), antes)
})

test("reorder-items con un before que no está, o que se mueve, es no-op", (): void => {
  const antes: AppState = conCuatro()
  assert.strictEqual(reordenar(antes, [noteRef(ID_COMPRA)], noteRef(noteId("no-existe"))), antes)
  assert.strictEqual(reordenar(antes, [noteRef(ID_COMPRA), noteRef(ID_PAN)], noteRef(ID_PAN)), antes)
})

test("reorder-items de lo que no está en el contexto es no-op, y lo que no está no cuenta", (): void => {
  const antes: AppState = conCuatro()
  assert.strictEqual(reordenar(antes, [noteRef(noteId("no-existe"))], null), antes)

  const s: AppState = reordenar(antes, [noteRef(noteId("no-existe")), noteRef(ID_COMPRA)], null)
  assert.deepEqual(ctx(s, ID_CASA).items[3], noteRef(ID_COMPRA))
  assert.equal(ctx(s, ID_CASA).items.length, 4)
})

test("reorder-items no toca lo oculto", (): void => {
  const oculto: AppState = reduce(conCuatro(), {
    type: "hide-items",
    contextId: ID_CASA,
    items: [noteRef(ID_PAN)],
    meta: META,
  })
  const s: AppState = reordenar(oculto, [noteRef(ID_PAN)], noteRef(ID_COMPRA))
  assert.strictEqual(ctx(s, ID_CASA).hidden, ctx(oculto, ID_CASA).hidden)
  assert.deepEqual(ctx(s, ID_CASA).items[0], noteRef(ID_PAN))
})

/* ────────────────────── Lo transversal: contexto inexistente ──────────────── */

test("todas las acciones de Contexto sobre uno inexistente son no-op", () => {
  const antes = estado()
  const fantasma = contextId("no-existe")

  const todas = [
    { type: "rename-context", contextId: fantasma, name: "x", meta: META },
    { type: "delete-context", contextId: fantasma, meta: META },
    { type: "add-item", contextId: fantasma, item: noteRef(ID_COMPRA), meta: META },
    { type: "remove-item", contextId: fantasma, item: noteRef(ID_COMPRA), meta: META },
    { type: "set-default-view", contextId: fantasma, view: { type: "context" }, meta: META },
    { type: "hide-items", contextId: fantasma, items: [noteRef(ID_COMPRA)], meta: META },
    { type: "show-items", contextId: fantasma, items: [noteRef(ID_COMPRA)], meta: META },
    { type: "reorder-items", contextId: fantasma, items: [noteRef(ID_COMPRA)], before: null, meta: META },
  ] as const

  for (const accion of todas) {
    assert.strictEqual(reduce(antes, accion), antes, `${accion.type} ha tocado el estado`)
  }
})
