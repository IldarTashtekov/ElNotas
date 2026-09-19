/**
 * Los casos de uso: **la frontera entre lo impuro y lo puro**.
 *
 * Es la única capa con los puertos inyectados, y su trabajo es construir el
 * `meta` de la acción —la hora y la revisión— antes de despacharla. De esta
 * línea hacia dentro (reducer, operaciones, dominio) todo es puro y se prueba
 * sin simular nada; de esta línea hacia fuera, plataforma.
 *
 * Ojo a algo que despista al leerlo: **la revisión se pide siempre, aunque no se
 * acabe usando.** El caso de uso no sabe todavía si la acción va a cambiar algo
 * —eso lo decide el reducer—, así que la construye igualmente y, si la acción
 * resulta ser inocua, se descarta. Generar una cadena es gratis; darle al
 * reducer capacidad de generar ids costaría su pureza.
 */

import { checkBox, text } from "../domain/Content"
import type { DefaultView } from "../domain/Context"
import type { ContentId, ContextId, ItemRef, NoteId } from "../domain/Ids"
import { contentId, contextId, noteId, revision } from "../domain/Ids"
import type { Position } from "../domain/Position"
import type { ActionMeta } from "./Action"
import type { Clock } from "../ports/Clock"
import type { IdGenerator } from "../ports/IdGenerator"
import type { Store } from "./Store"

export interface UseCases {
  readonly setChecked: (
    noteId: NoteId,
    contentId: ContentId,
    checked: boolean,
  ) => void
  readonly setText: (noteId: NoteId, contentId: ContentId, value: string) => void
  /**
   * Mete una línea de texto. El id lo genera **aquí**, no la UI: es esta capa la
   * que tiene el `IdGenerator`. Por eso hay dos casos de uso para una sola
   * acción —uno por clase de línea— en vez de uno que reciba el bloque hecho.
   */
  readonly insertText: (noteId: NoteId, value: string, at: Position) => void
  readonly insertCheckBox: (noteId: NoteId, value: string, at: Position) => void
  readonly remove: (noteId: NoteId, contentId: ContentId) => void
  /** Parte una línea por `offset`. El id de la mitad nueva se genera aquí. */
  readonly split: (noteId: NoteId, contentId: ContentId, offset: number) => void
  readonly merge: (noteId: NoteId, contentId: ContentId) => void
  readonly convertToCheckBox: (noteId: NoteId, contentId: ContentId) => void
  readonly convertToText: (noteId: NoteId, contentId: ContentId) => void

  /**
   * Crea una nota vacía y **devuelve su id**, que se genera aquí.
   *
   * Es el único caso de uso que devuelve algo, y hace falta: quien la crea
   * necesita el id para abrirla a continuación, y si no lo devolviera tendría que
   * buscarla en el estado adivinando cuál es la nueva.
   */
  readonly createNote: (name: string) => NoteId
  readonly renameNote: (noteId: NoteId, name: string) => void
  readonly deleteNote: (noteId: NoteId) => void

  readonly createContext: (name: string) => ContextId
  readonly renameContext: (contextId: ContextId, name: string) => void
  readonly deleteContext: (contextId: ContextId) => void
  readonly addItem: (contextId: ContextId, item: ItemRef) => void
  readonly removeItem: (contextId: ContextId, item: ItemRef) => void
  readonly setDefaultView: (contextId: ContextId, view: DefaultView) => void
}

export interface UseCaseDeps {
  readonly clock: Clock
  readonly ids: IdGenerator
  readonly store: Store
}

export const createUseCases = ({ clock, ids, store }: UseCaseDeps): UseCases => {
  /* Aquí, y sólo aquí, se lee el mundo. Se construye uno por acción, así que
     todas las entidades que esa acción toque reciben la MISMA marca de tiempo. */
  const meta = (): ActionMeta => ({ now: clock.now(), revision: revision(ids.next()) })

  return {
    setChecked: (noteId: NoteId, contentId: ContentId, checked: boolean): void =>
      store.dispatch({ type: "set-checked", noteId, contentId, checked, meta: meta() }),

    setText: (noteId: NoteId, contentId: ContentId, value: string): void =>
      store.dispatch({ type: "set-text", noteId, contentId, value, meta: meta() }),

    insertText: (noteId: NoteId, value: string, at: Position): void =>
      store.dispatch({
        type: "insert",
        noteId,
        block: text(contentId(ids.next()), value),
        position: at,
        meta: meta(),
      }),

    insertCheckBox: (noteId: NoteId, value: string, at: Position): void =>
      store.dispatch({
        type: "insert",
        noteId,
        block: checkBox(contentId(ids.next()), value),
        position: at,
        meta: meta(),
      }),

    remove: (noteId: NoteId, contentId: ContentId): void =>
      store.dispatch({ type: "remove", noteId, contentId, meta: meta() }),

    split: (noteId: NoteId, contentId: ContentId, offset: number): void =>
      store.dispatch({
        type: "split",
        noteId,
        contentId,
        offset,
        newId: contentIdNuevo(ids),
        meta: meta(),
      }),

    merge: (noteId: NoteId, contentId: ContentId): void =>
      store.dispatch({ type: "merge", noteId, contentId, meta: meta() }),

    convertToCheckBox: (noteId: NoteId, contentId: ContentId): void =>
      store.dispatch({ type: "convert-to-checkbox", noteId, contentId, meta: meta() }),

    convertToText: (noteId: NoteId, contentId: ContentId): void =>
      store.dispatch({ type: "convert-to-text", noteId, contentId, meta: meta() }),

    /* ── Nota ── */

    createNote: (name: string): NoteId => {
      const id: NoteId = noteIdNuevo(ids)
      store.dispatch({ type: "create-note", noteId: id, name, meta: meta() })
      return id
    },

    renameNote: (noteId: NoteId, name: string): void =>
      store.dispatch({ type: "rename-note", noteId, name, meta: meta() }),

    deleteNote: (noteId: NoteId): void =>
      store.dispatch({ type: "delete-note", noteId, meta: meta() }),

    /* ── Contexto ── */

    createContext: (name: string): ContextId => {
      const id: ContextId = contextIdNuevo(ids)
      store.dispatch({ type: "create-context", contextId: id, name, meta: meta() })
      return id
    },

    renameContext: (contextId: ContextId, name: string): void =>
      store.dispatch({ type: "rename-context", contextId, name, meta: meta() }),

    deleteContext: (contextId: ContextId): void =>
      store.dispatch({ type: "delete-context", contextId, meta: meta() }),

    addItem: (contextId: ContextId, item: ItemRef): void =>
      store.dispatch({ type: "add-item", contextId, item, meta: meta() }),

    removeItem: (contextId: ContextId, item: ItemRef): void =>
      store.dispatch({ type: "remove-item", contextId, item, meta: meta() }),

    setDefaultView: (contextId: ContextId, view: DefaultView): void =>
      store.dispatch({ type: "set-default-view", contextId, view, meta: meta() }),
  }
}

/*
    El generador devuelve una cadena pelada: no sabe ni le importa qué clase de
    id estás creando. Quien lo marca es quien llama, que sí lo sabe. De ahí estos
    tres envoltorios de una línea en vez de un método por tipo en el puerto.
*/
const contentIdNuevo = (ids: IdGenerator): ContentId => contentId(ids.next())
const noteIdNuevo = (ids: IdGenerator): NoteId => noteId(ids.next())
const contextIdNuevo = (ids: IdGenerator): ContextId => contextId(ids.next())
