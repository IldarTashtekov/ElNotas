/**
 * El reducer: `(estado, acción) => estado`.
 *
 * Recibe la foto actual de la app y una acción, y devuelve la foto siguiente.
 * **No modifica la que recibe.** Tiene la forma exacta del callback de
 * `Array.reduce`, y la analogía no es decorativa: la app entera es un `reduce`
 * sobre la secuencia de acciones que ha hecho el usuario.
 *
 * Dos exigencias, y las dos se comprueban:
 *
 * - **Puro** — no lee el reloj, no genera ids, no toca disco ni DOM. Sólo mira
 *   sus dos argumentos. La hora y la revisión le llegan puestas en `meta`. Por
 *   eso sus pruebas son deterministas sin simular nada.
 * - **Total** — **no lanza excepciones nunca**. Una acción que no se puede
 *   aplicar (marcar una casilla que no existe) devuelve el estado que recibió.
 *   Un reducer que peta se lleva la app entera por delante, y "el usuario pulsó
 *   algo raro" no es motivo para eso.
 *
 * ⚠️ **La línea que sostiene toda la cadena** es la comparación
 * `content === note.content`. Si el contenido no cambió, se devuelve el estado
 * **tal cual** y no se estampan ni `updatedAt` ni `revision`. Sin ella, marcar
 * una casilla que ya estaba marcada ensucia la nota, hace que el `Store` avise,
 * que el render redibuje y que la persistencia escriba (§3). Y no falla nada
 * visible: la app funciona, sólo va más lenta por un motivo invisible.
 */

import type { AppState } from "../domain/AppState"
import type { Content } from "../domain/Content"
import type { Context, DefaultView } from "../domain/Context"
import type { ContextId, ItemRef, NoteId } from "../domain/Ids"
import type { Note } from "../domain/Note"
import type { Versioned } from "../domain/Versioned"
import {
  convertToCheckBox,
  convertToText,
  insert,
  merge,
  remove,
  setChecked,
  setText,
  split,
} from "../domain/operations"
import type { Action, ActionMeta } from "./Action"

/**
 * Aplica una operación al contenido de una nota y estampa los metadatos **sólo
 * si cambió algo**.
 *
 * ⚠️ **Esta función existe para que la comparación esté escrita UNA sola vez.**
 * Las ocho acciones de contenido se reducen igual —buscar la nota, llamar a la
 * operación, comparar, estampar—, y copiar esas catorce líneas ocho veces sería
 * dar ocho oportunidades de olvidarse del `===`. Olvidarlo no rompe nada
 * visible: la app funciona, sólo redibuja y escribe de más para siempre (§3).
 *
 * Es el mismo razonamiento que hizo que la primitiva A del helper llevara la
 * recursión escrita una vez en lugar de dos (§5.4).
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

/** Dos referencias son la misma si coinciden clase e id. */
const mismoItem = (a: ItemRef, b: ItemRef): boolean =>
  a.kind === b.kind && a.id === b.id

/** ¿Existe de verdad lo que esta referencia señala? */
const existeItem = (state: AppState, item: ItemRef): boolean =>
  item.kind === "note"
    ? state.notes[item.id] !== undefined
    : state.plans[item.id] !== undefined

const mismaVista = (a: DefaultView, b: DefaultView): boolean =>
  a.type === b.type && (a.type === "context" || b.type === "context" || a.id === b.id)

/**
 * Quita una referencia de **todos** los contextos que la listaban.
 *
 * ⚠️ Las dos mitades de esto importan por igual, y la segunda es la que se
 * olvida: los contextos que **no** la listaban se devuelven **intactos, por
 * referencia**. Un `map` que copiara todos haría que borrar una nota reescribiera
 * en disco cada contexto de la app (§3). Y si ninguno la listaba, se devuelve el
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
    (ctx: Context): boolean => ctx.items.some((i: ItemRef): boolean => mismoItem(i, item)),
  )
  if (afectados.length === 0) return contexts

  const limpios: ReadonlyArray<Context> = afectados.map((ctx: Context): Context => ({
    ...ctx,
    items: ctx.items.filter((i: ItemRef): boolean => !mismoItem(i, item)),
    ...stamp(meta),
  }))

  return {
    ...contexts,
    ...Object.fromEntries(
      limpios.map((ctx: Context): readonly [ContextId, Context] => [ctx.id, ctx]),
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
        if (ctx.items.some((i: ItemRef): boolean => mismoItem(i, action.item))) return ctx
        return { ...ctx, items: [...ctx.items, action.item] }
      })

    case "remove-item":
      return onContext(state, action.contextId, action.meta, (ctx: Context): Context => {
        const items: ReadonlyArray<ItemRef> = ctx.items.filter(
          (i: ItemRef): boolean => !mismoItem(i, action.item),
        )
        // `filter` SIEMPRE devuelve array nuevo: sin esta comparación, quitar
        // algo que no estaba ensuciaría el contexto y lo reescribiría en disco.
        return items.length === ctx.items.length ? ctx : { ...ctx, items }
      })

    case "set-default-view":
      return onContext(state, action.contextId, action.meta, (ctx: Context): Context =>
        mismaVista(ctx.defaultView, action.view)
          ? ctx
          : { ...ctx, defaultView: action.view },
      )

    default: {
      /* ⚠️ Esto NO es un caso por defecto que trague acciones desconocidas: es la
         comprobación de exhaustividad. Si se añade una acción y no se trata
         arriba, `action` deja de ser `never` aquí y **no compila**.

         Con una sola acción en el catálogo este truco no servía —una unión de un
         miembro no es una unión— y hacía el trabajo la ausencia de `default`.
         Ahora que son ocho, ésta es la forma que da un mensaje de error legible. */
      const nunca: never = action
      return nunca
    }
  }
}
