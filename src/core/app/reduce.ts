/**
 * Recibe la foto actual de la app y una acción, y devuelve la foto siguiente. No
 * modifica la que recibe.
 *
 * No lee el reloj ni genera ids —le llegan puestos en la acción— y **no lanza
 * nunca**: una acción que no se puede aplicar devuelve el estado que recibió. Un
 * reducer que peta se lleva la app entera por delante, y «el usuario pulsó algo
 * raro» no es motivo para eso.
 *
 * ⚠️ La línea que lo sostiene todo es `content === note.content`: si el contenido
 * no cambió se devuelve el estado tal cual, sin tocar `updatedAt` ni `revision`.
 * Sin ella, marcar una casilla que ya estaba marcada redibuja y escribe en disco,
 * y no falla nada visible.
 */

import type { AppState } from "../domain/AppState.js"
import type { Content } from "../domain/Content.js"
import type { Context, DefaultView } from "../domain/Context.js"
import type { Diagram } from "../domain/Diagram.js"
import {
  addNode,
  addRelation,
  loseNote,
  removeNode,
  removeRelation,
  setNodeDone,
  setNodePosition,
  setNodeText,
  setRelationDirected,
  setRelationEnds,
  setRelationLabel,
} from "../domain/diagramOperations.js"
import type { ContextId, DiagramId, ItemRef, NoteId } from "../domain/Ids.js"
import type { Note } from "../domain/Note.js"
import type { Versioned } from "../domain/Versioned.js"
import {
  convertToCheckBox,
  convertToText,
  insert,
  merge,
  remove,
  setChecked,
  setText,
  split,
} from "../domain/operations.js"
import type { Action, ActionMeta } from "./Action.js"

/**
 * Aplica una operación al contenido de una nota y estampa los metadatos **sólo
 * si cambió algo**.
 *
 * ⚠️ **Esta función existe para que la comparación esté escrita UNA sola vez.**
 * Las ocho acciones de contenido se reducen igual —buscar la nota, llamar a la
 * operación, comparar, estampar—, y copiar esas catorce líneas ocho veces sería
 * dar ocho oportunidades de olvidarse del `===`. Olvidarlo no rompe nada
 * visible: la app funciona, sólo redibuja y escribe de más para siempre.
 *
 * Es el mismo razonamiento que hizo que la primitiva A del helper llevara la
 * recursión escrita una vez en lugar de dos.
 */
const onContent = (
  state: AppState,
  id: NoteId,
  meta: ActionMeta,
  operar: (content: ReadonlyArray<Content>) => ReadonlyArray<Content>,
): AppState => {
  const note: Note | undefined = state.notes[id]
  if (note === undefined) return state // total: la nota no existe, no pasa nada

  const content: ReadonlyArray<Content> = operar(note.content)
  if (content === note.content) return state // ← la línea que lo sostiene todo

  const updated: Note = {
    ...note,
    content,
    updatedAt: meta.now,
    revision: meta.revision,
  }
  return { ...state, notes: { ...state.notes, [id]: updated } }
}

/** Los metadatos de escritura, para no repetir las dos líneas en cada caso. */
const stamp = (meta: ActionMeta): Versioned => ({
  updatedAt: meta.now,
  revision: meta.revision,
})

/**
 * La versión para contextos de `onContent`: misma disciplina, misma comparación
 * escrita una sola vez. `transformar` devuelve **el contexto de entrada** si no
 * aplica, y entonces aquí no se toca el estado.
 */
const onContext = (
  state: AppState,
  id: ContextId,
  meta: ActionMeta,
  transformar: (ctx: Context) => Context,
): AppState => {
  const ctx: Context | undefined = state.contexts[id]
  if (ctx === undefined) return state

  const siguiente: Context = transformar(ctx)
  if (siguiente === ctx) return state

  return {
    ...state,
    contexts: { ...state.contexts, [id]: { ...siguiente, ...stamp(meta) } },
  }
}

/**
 * La versión para diagramas: misma disciplina, misma comparación escrita una sola
 * vez. `transformar` es una operación de `diagramOperations.ts`, que devuelve el
 * diagrama de entrada si no aplica.
 */
const onDiagram = (
  state: AppState,
  id: DiagramId,
  meta: ActionMeta,
  transformar: (diagram: Diagram) => Diagram,
): AppState => {
  const diagram: Diagram | undefined = state.diagrams[id]
  if (diagram === undefined) return state

  const siguiente: Diagram = transformar(diagram)
  if (siguiente === diagram) return state

  return {
    ...state,
    diagrams: { ...state.diagrams, [id]: { ...siguiente, ...stamp(meta) } },
  }
}

/** Dos referencias son la misma si coinciden clase e id. */
const mismoItem = (a: ItemRef, b: ItemRef): boolean =>
  a.kind === b.kind && a.id === b.id

/** ¿Existe de verdad lo que esta referencia señala? */
const existeItem = (state: AppState, item: ItemRef): boolean =>
  item.kind === "note"
    ? state.notes[item.id] !== undefined
    : state.diagrams[item.id] !== undefined

const contiene = (lista: ReadonlyArray<ItemRef>, item: ItemRef): boolean =>
  lista.some((i: ItemRef): boolean => mismoItem(i, item))

/** Lo oculto de un contexto: ausente es vacío. */
const ocultos = (ctx: Context): ReadonlyArray<ItemRef> => ctx.hidden ?? []

/**
 * El contexto sin esta referencia, en `items` y en `hidden`: lo que sale del
 * contexto no puede seguir oculto en él. Si no estaba, el MISMO contexto.
 */
const sinItem = (ctx: Context, item: ItemRef): Context => {
  const items: ReadonlyArray<ItemRef> = ctx.items.filter(
    (i: ItemRef): boolean => !mismoItem(i, item),
  )
  const hidden: ReadonlyArray<ItemRef> = ocultos(ctx).filter(
    (i: ItemRef): boolean => !mismoItem(i, item),
  )
  // `filter` SIEMPRE devuelve array nuevo: sin esta comparación, quitar algo
  // que no estaba ensuciaría el contexto y lo reescribiría en disco.
  if (items.length === ctx.items.length && hidden.length === ocultos(ctx).length) return ctx
  return ctx.hidden === undefined ? { ...ctx, items } : { ...ctx, items, hidden }
}

const mismaVista = (a: DefaultView, b: DefaultView): boolean =>
  a.type === b.type && (a.type === "context" || b.type === "context" || a.id === b.id)

/**
 * Quita una referencia de **todos** los contextos que la listaban.
 *
 * ⚠️ Las dos mitades de esto importan por igual, y la segunda es la que se
 * olvida: los contextos que **no** la listaban se devuelven **intactos, por
 * referencia**. Un `map` que copiara todos haría que borrar una nota reescribiera
 * en disco cada contexto de la app. Y si ninguno la listaba, se devuelve el
 * mismo objeto `contexts` de entrada.
 *
 * Los que sí la listaban reciben todos el MISMO `meta`, que por eso se construye
 * una sola vez por acción y no uno por entidad.
 */
const sinReferenciasA = (
  contexts: AppState["contexts"],
  item: ItemRef,
  meta: ActionMeta,
): AppState["contexts"] => {
  const afectados: ReadonlyArray<Context> = Object.values<Context>(contexts).filter(
    (ctx: Context): boolean => contiene(ctx.items, item),
  )
  if (afectados.length === 0) return contexts

  const limpios: ReadonlyArray<Context> = afectados.map((ctx: Context): Context => ({
    ...sinItem(ctx, item),
    ...stamp(meta),
  }))

  return {
    ...contexts,
    ...Object.fromEntries(
      limpios.map((ctx: Context): readonly [ContextId, Context] => [ctx.id, ctx]),
    ),
  }
}

/**
 * Pasa a «Nota perdida» los nodos-nota de una nota en **todos** los diagramas.
 *
 * Misma disciplina que `sinReferenciasA`: los diagramas que no la usaban salen
 * intactos, por referencia, y si no la usaba ninguno, el mismo objeto `diagrams`.
 * Los tocados reciben todos el MISMO `meta`.
 */
const sinNotaEnDiagramas = (
  diagrams: AppState["diagrams"],
  noteId: NoteId,
  meta: ActionMeta,
): AppState["diagrams"] => {
  const tocados: ReadonlyArray<Diagram> = Object.values<Diagram>(diagrams).flatMap(
    (d: Diagram): ReadonlyArray<Diagram> => {
      const siguiente: Diagram = loseNote(d, noteId)
      return siguiente === d ? [] : [{ ...siguiente, ...stamp(meta) }]
    },
  )
  if (tocados.length === 0) return diagrams

  return {
    ...diagrams,
    ...Object.fromEntries(
      tocados.map((d: Diagram): readonly [DiagramId, Diagram] => [d.id, d]),
    ),
  }
}

export const reduce = (state: AppState, action: Action): AppState => {
  switch (action.type) {
    case "set-checked":
      return onContent(
        state,
        action.noteId,
        action.meta,
        (c: ReadonlyArray<Content>): ReadonlyArray<Content> =>
          setChecked(c, action.contentId, action.checked),
      )

    case "set-text":
      return onContent(
        state,
        action.noteId,
        action.meta,
        (c: ReadonlyArray<Content>): ReadonlyArray<Content> =>
          setText(c, action.contentId, action.value),
      )

    case "insert":
      return onContent(
        state,
        action.noteId,
        action.meta,
        (c: ReadonlyArray<Content>): ReadonlyArray<Content> =>
          insert(c, action.block, action.position),
      )

    case "remove":
      return onContent(
        state,
        action.noteId,
        action.meta,
        (c: ReadonlyArray<Content>): ReadonlyArray<Content> => remove(c, action.contentId),
      )

    case "split":
      return onContent(
        state,
        action.noteId,
        action.meta,
        (c: ReadonlyArray<Content>): ReadonlyArray<Content> =>
          split(c, action.contentId, action.offset, action.newId),
      )

    case "merge":
      return onContent(
        state,
        action.noteId,
        action.meta,
        (c: ReadonlyArray<Content>): ReadonlyArray<Content> => merge(c, action.contentId),
      )

    case "convert-to-checkbox":
      return onContent(
        state,
        action.noteId,
        action.meta,
        (c: ReadonlyArray<Content>): ReadonlyArray<Content> =>
          convertToCheckBox(c, action.contentId),
      )

    case "convert-to-text":
      return onContent(
        state,
        action.noteId,
        action.meta,
        (c: ReadonlyArray<Content>): ReadonlyArray<Content> =>
          convertToText(c, action.contentId),
      )

    /* ───────────────────────────── Nota ───────────────────────────── */

    case "create-note": {
      if (state.notes[action.noteId] !== undefined) return state // id repetido

      const nueva: Note = {
        id: action.noteId,
        name: action.name,
        content: [],
        updatedAt: action.meta.now,
        revision: action.meta.revision,
      }
      return { ...state, notes: { ...state.notes, [action.noteId]: nueva } }
    }

    case "rename-note": {
      const note: Note | undefined = state.notes[action.noteId]
      if (note === undefined || note.name === action.name) return state

      return {
        ...state,
        notes: {
          ...state.notes,
          [action.noteId]: { ...note, name: action.name, ...stamp(action.meta) },
        },
      }
    }

    case "delete-note": {
      if (state.notes[action.noteId] === undefined) return state

      const { [action.noteId]: _fuera, ...quedan } = state.notes
      return {
        ...state,
        notes: quedan,
        // Integridad referencial: los contextos que la listaban se limpian.
        contexts: sinReferenciasA(
          state.contexts,
          { kind: "note", id: action.noteId },
          action.meta,
        ),
        // Y en los diagramas, sus nodos-nota pasan a «Nota perdida».
        diagrams: sinNotaEnDiagramas(state.diagrams, action.noteId, action.meta),
      }
    }

    /* ─────────────────────────── Contexto ─────────────────────────── */

    case "create-context": {
      if (state.contexts[action.contextId] !== undefined) return state

      const nuevo: Context = {
        id: action.contextId,
        name: action.name,
        defaultView: { type: "context" },
        items: [],
        updatedAt: action.meta.now,
        revision: action.meta.revision,
      }
      return { ...state, contexts: { ...state.contexts, [action.contextId]: nuevo } }
    }

    case "rename-context":
      return onContext(state, action.contextId, action.meta, (ctx: Context): Context =>
        ctx.name === action.name ? ctx : { ...ctx, name: action.name },
      )

    case "delete-context": {
      /* Borrar un contexto NO borra lo que contenía: sólo guardaba referencias.
         Y por eso tampoco hay nada que limpiar en ningún otro sitio — nadie
         referencia a un contexto. */
      if (state.contexts[action.contextId] === undefined) return state

      const { [action.contextId]: _fuera, ...quedan } = state.contexts
      return { ...state, contexts: quedan }
    }

    case "add-item":
      return onContext(state, action.contextId, action.meta, (ctx: Context): Context => {
        // El otro lado de la integridad referencial: no se mete una referencia
        // a algo que no existe.
        if (!existeItem(state, action.item)) return ctx
        if (contiene(ctx.items, action.item)) return ctx
        return { ...ctx, items: [...ctx.items, action.item] }
      })

    case "remove-item":
      return onContext(state, action.contextId, action.meta, (ctx: Context): Context =>
        sinItem(ctx, action.item),
      )

    case "hide-items":
      return onContext(state, action.contextId, action.meta, (ctx: Context): Context => {
        const ya: ReadonlyArray<ItemRef> = ocultos(ctx)
        /* Sólo lo del contexto que aún se ve, y cada uno una vez. */
        const nuevos: ReadonlyArray<ItemRef> = action.items.filter(
          (i: ItemRef, n: number, todos: ReadonlyArray<ItemRef>): boolean =>
            contiene(ctx.items, i) &&
            !contiene(ya, i) &&
            todos.findIndex((otro: ItemRef): boolean => mismoItem(otro, i)) === n,
        )
        return nuevos.length === 0 ? ctx : { ...ctx, hidden: [...ya, ...nuevos] }
      })

    case "show-items":
      return onContext(state, action.contextId, action.meta, (ctx: Context): Context => {
        const ya: ReadonlyArray<ItemRef> = ocultos(ctx)
        const quedan: ReadonlyArray<ItemRef> = ya.filter(
          (i: ItemRef): boolean => !contiene(action.items, i),
        )
        return quedan.length === ya.length ? ctx : { ...ctx, hidden: quedan }
      })

    case "reorder-items":
      return onContext(state, action.contextId, action.meta, (ctx: Context): Context => {
        const mueven: ReadonlyArray<ItemRef> = ctx.items.filter(
          (i: ItemRef): boolean => contiene(action.items, i),
        )
        if (mueven.length === 0) return ctx
        const quedan: ReadonlyArray<ItemRef> = ctx.items.filter(
          (i: ItemRef): boolean => !contiene(action.items, i),
        )
        const antes: ItemRef | null = action.before
        const donde: number =
          antes === null
            ? quedan.length
            : quedan.findIndex((i: ItemRef): boolean => mismoItem(i, antes))
        if (donde === -1) return ctx
        const items: ReadonlyArray<ItemRef> = [
          ...quedan.slice(0, donde),
          ...mueven,
          ...quedan.slice(donde),
        ]
        /* Soltarlos donde estaban da el mismo orden en un array nuevo: el mismo contexto. */
        const igual: boolean = items.every((i: ItemRef, n: number): boolean => i === ctx.items[n])
        return igual ? ctx : { ...ctx, items }
      })

    case "set-default-view":
      return onContext(state, action.contextId, action.meta, (ctx: Context): Context =>
        mismaVista(ctx.defaultView, action.view)
          ? ctx
          : { ...ctx, defaultView: action.view },
      )

    /* ─────────────────────────── Diagrama ─────────────────────────── */

    case "create-diagram": {
      if (state.diagrams[action.diagramId] !== undefined) return state // id repetido

      const nuevo: Diagram = {
        id: action.diagramId,
        name: action.name,
        nodes: {},
        relations: {},
        updatedAt: action.meta.now,
        revision: action.meta.revision,
      }
      return { ...state, diagrams: { ...state.diagrams, [action.diagramId]: nuevo } }
    }

    case "rename-diagram":
      return onDiagram(state, action.diagramId, action.meta, (d: Diagram): Diagram =>
        d.name === action.name ? d : { ...d, name: action.name },
      )

    case "delete-diagram": {
      if (state.diagrams[action.diagramId] === undefined) return state

      const { [action.diagramId]: _fuera, ...quedan } = state.diagrams
      return {
        ...state,
        diagrams: quedan,
        // Integridad referencial, como al borrar una nota. Sus notas se quedan.
        contexts: sinReferenciasA(
          state.contexts,
          { kind: "diagram", id: action.diagramId },
          action.meta,
        ),
      }
    }

    case "add-node":
      // Lo único que la operación no puede mirar: que la nota exista.
      if (action.node.type === "note-node" && state.notes[action.node.noteId] === undefined) {
        return state
      }
      return onDiagram(state, action.diagramId, action.meta, (d: Diagram): Diagram =>
        addNode(d, action.node),
      )

    case "set-node-text":
      return onDiagram(state, action.diagramId, action.meta, (d: Diagram): Diagram =>
        setNodeText(d, action.nodeId, action.text),
      )

    case "set-node-position":
      return onDiagram(state, action.diagramId, action.meta, (d: Diagram): Diagram =>
        setNodePosition(d, action.nodeId, action.positionX, action.positionY),
      )

    case "set-node-done":
      return onDiagram(state, action.diagramId, action.meta, (d: Diagram): Diagram =>
        setNodeDone(d, action.nodeId, action.done),
      )

    case "remove-node":
      return onDiagram(state, action.diagramId, action.meta, (d: Diagram): Diagram =>
        removeNode(d, action.nodeId),
      )

    case "add-relation":
      return onDiagram(state, action.diagramId, action.meta, (d: Diagram): Diagram =>
        addRelation(d, action.relation),
      )

    case "set-relation-ends":
      return onDiagram(state, action.diagramId, action.meta, (d: Diagram): Diagram =>
        setRelationEnds(d, action.relationId, action.from, action.to),
      )

    case "set-relation-directed":
      return onDiagram(state, action.diagramId, action.meta, (d: Diagram): Diagram =>
        setRelationDirected(d, action.relationId, action.directed),
      )

    case "set-relation-label":
      return onDiagram(state, action.diagramId, action.meta, (d: Diagram): Diagram =>
        setRelationLabel(d, action.relationId, action.label),
      )

    case "remove-relation":
      return onDiagram(state, action.diagramId, action.meta, (d: Diagram): Diagram =>
        removeRelation(d, action.relationId),
      )

    default:
      /* ⚠️ Esto es, ante todo, la comprobación de exhaustividad. Si se añade una
         acción y no se trata arriba, `action` deja de ser `never` aquí y **no
         compila**.

         Con una sola acción en el catálogo este truco no servía —una unión de un
         miembro no es una unión— y hacía el trabajo la ausencia de `default`.
         Ahora que son ocho, ésta es la forma que da un mensaje de error legible.

         Y una acción que llega sin tipos (la consola con `?depurar`) no hace
         nada: devolverla a ella dejaba la acción en el sitio del estado. */
      action satisfies never
      return state
  }
}
