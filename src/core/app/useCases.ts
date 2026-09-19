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
 *
 * Todos devuelven **la entidad que han tocado, o `null` si no aplicó**. Así quien
 * llama distingue «hecho» de «no aplicaba», que de otro modo se ven igual: una
 * operación que no aplica no falla, no hace nada.
 */

import { checkBox, text } from "../domain/Content"
import type { Context, DefaultView } from "../domain/Context"
import type { ContentId, ContextId, ItemRef, NoteId } from "../domain/Ids"
import { contentId, contextId, noteId, revision } from "../domain/Ids"
import type { Note } from "../domain/Note"
import type { Position } from "../domain/Position"
import type { Action, ActionMeta } from "./Action"
import type { Clock } from "../ports/Clock"
import type { IdGenerator } from "../ports/IdGenerator"
import type { Store } from "./Store"

export interface UseCases {
  readonly setChecked: (
    noteId: NoteId,
    contentId: ContentId,
    checked: boolean,
  ) => Note | null
  readonly setText: (
    noteId: NoteId,
    contentId: ContentId,
    value: string,
  ) => Note | null
  /**
   * Mete una línea de texto. El id lo genera **aquí**, no la UI: es esta capa la
   * que tiene el `IdGenerator`. Por eso hay dos casos de uso para una sola
   * acción —uno por clase de línea— en vez de uno que reciba el bloque hecho.
   */
  readonly insertText: (noteId: NoteId, value: string, at: Position) => Note | null
  readonly insertCheckBox: (
    noteId: NoteId,
    value: string,
    at: Position,
  ) => Note | null
  /** `null` también cuando la línea tiene hijas: ahí `remove` es no-op. */
  readonly remove: (noteId: NoteId, contentId: ContentId) => Note | null
  /** Parte una línea por `offset`. El id de la mitad nueva se genera aquí. */
  readonly split: (
    noteId: NoteId,
    contentId: ContentId,
    offset: number,
  ) => Note | null
  readonly merge: (noteId: NoteId, contentId: ContentId) => Note | null
  readonly convertToCheckBox: (
    noteId: NoteId,
    contentId: ContentId,
  ) => Note | null
  readonly convertToText: (noteId: NoteId, contentId: ContentId) => Note | null

  /**
   * Crea una nota vacía y la devuelve. El id se genera aquí y sale dentro de
   * ella, que es lo que quien la crea necesita para abrirla a continuación.
   *
   * ⚠️ Puede devolver `null`, y no es defensivo: `create-note` con un id que ya
   * existe es no-op en el reducer.
   */
  readonly createNote: (name: string) => Note | null
  readonly renameNote: (noteId: NoteId, name: string) => Note | null
  /**
   * ⚠️ Devuelve la nota borrada, pero **eso no es un undo**: al borrarla también
   * se limpian las referencias a ella de todos los contextos que la listaban, y
   * eso no vuelve. Reinsertarla la dejaría huérfana.
   */
  readonly deleteNote: (noteId: NoteId) => Note | null

  readonly createContext: (name: string) => Context | null
  readonly renameContext: (contextId: ContextId, name: string) => Context | null
  readonly deleteContext: (contextId: ContextId) => Context | null
  readonly addItem: (contextId: ContextId, item: ItemRef) => Context | null
  readonly removeItem: (contextId: ContextId, item: ItemRef) => Context | null
  readonly setDefaultView: (
    contextId: ContextId,
    view: DefaultView,
  ) => Context | null
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

  const trasNota = (id: NoteId, action: Action): Note | null => {
    const antes: Note | undefined = store.getState().notes[id]
    store.dispatch(action)
    return cambio(antes, store.getState().notes[id])
  }

  const trasContexto = (id: ContextId, action: Action): Context | null => {
    const antes: Context | undefined = store.getState().contexts[id]
    store.dispatch(action)
    return cambio(antes, store.getState().contexts[id])
  }

  return {
    setChecked: (
      noteId: NoteId,
      contentId: ContentId,
      checked: boolean,
    ): Note | null =>
      trasNota(noteId, { type: "set-checked", noteId, contentId, checked, meta: meta() }),

    setText: (noteId: NoteId, contentId: ContentId, value: string): Note | null =>
      trasNota(noteId, { type: "set-text", noteId, contentId, value, meta: meta() }),

    insertText: (noteId: NoteId, value: string, at: Position): Note | null =>
      trasNota(noteId, {
        type: "insert",
        noteId,
        block: text(contentId(ids.next()), value),
        position: at,
        meta: meta(),
      }),

    insertCheckBox: (noteId: NoteId, value: string, at: Position): Note | null =>
      trasNota(noteId, {
        type: "insert",
        noteId,
        block: checkBox(contentId(ids.next()), value),
        position: at,
        meta: meta(),
      }),

    remove: (noteId: NoteId, contentId: ContentId): Note | null =>
      trasNota(noteId, { type: "remove", noteId, contentId, meta: meta() }),

    split: (noteId: NoteId, contentId: ContentId, offset: number): Note | null =>
      trasNota(noteId, {
        type: "split",
        noteId,
        contentId,
        offset,
        newId: contentIdNuevo(ids),
        meta: meta(),
      }),

    merge: (noteId: NoteId, contentId: ContentId): Note | null =>
      trasNota(noteId, { type: "merge", noteId, contentId, meta: meta() }),

    convertToCheckBox: (noteId: NoteId, contentId: ContentId): Note | null =>
      trasNota(noteId, {
        type: "convert-to-checkbox",
        noteId,
        contentId,
        meta: meta(),
      }),

    convertToText: (noteId: NoteId, contentId: ContentId): Note | null =>
      trasNota(noteId, { type: "convert-to-text", noteId, contentId, meta: meta() }),

    /* ── Nota ── */

    createNote: (name: string): Note | null => {
      const id: NoteId = noteIdNuevo(ids)
      return trasNota(id, { type: "create-note", noteId: id, name, meta: meta() })
    },

    renameNote: (noteId: NoteId, name: string): Note | null =>
      trasNota(noteId, { type: "rename-note", noteId, name, meta: meta() }),

    deleteNote: (noteId: NoteId): Note | null =>
      trasNota(noteId, { type: "delete-note", noteId, meta: meta() }),

    /* ── Contexto ── */

    createContext: (name: string): Context | null => {
      const id: ContextId = contextIdNuevo(ids)
      return trasContexto(id, {
        type: "create-context",
        contextId: id,
        name,
        meta: meta(),
      })
    },

    renameContext: (contextId: ContextId, name: string): Context | null =>
      trasContexto(contextId, {
        type: "rename-context",
        contextId,
        name,
        meta: meta(),
      }),

    deleteContext: (contextId: ContextId): Context | null =>
      trasContexto(contextId, { type: "delete-context", contextId, meta: meta() }),

    addItem: (contextId: ContextId, item: ItemRef): Context | null =>
      trasContexto(contextId, { type: "add-item", contextId, item, meta: meta() }),

    removeItem: (contextId: ContextId, item: ItemRef): Context | null =>
      trasContexto(contextId, { type: "remove-item", contextId, item, meta: meta() }),

    setDefaultView: (contextId: ContextId, view: DefaultView): Context | null =>
      trasContexto(contextId, {
        type: "set-default-view",
        contextId,
        view,
        meta: meta(),
      }),
  }
}

/**
 * Qué salió de despachar: la entidad como ha quedado, o `null` si no aplicó.
 *
 * Los cuatro casos salen de una sola expresión, y sale gratis porque la
 * invariante de identidad garantiza que un no-op devuelve **el mismo objeto**:
 *
 *     cambió       antes ≠ después            → la entidad nueva
 *     no aplicó    antes === después          → null
 *     se borró     después es undefined       → la que se leyó antes
 *     no existía   los dos son undefined      → null
 *
 * ⚠️ De lo que depende: si alguna operación devolviera una copia equivalente en
 * vez de su entrada, esto diría «cambió» siempre. Es la misma invariante de la
 * que vive `diffState`, y se rompe igual de callada.
 */
const cambio = <T>(antes: T | undefined, despues: T | undefined): T | null =>
  despues === antes ? null : (despues ?? antes ?? null)

/*
    El generador devuelve una cadena pelada: no sabe ni le importa qué clase de
    id estás creando. Quien lo marca es quien llama, que sí lo sabe. De ahí estos
    tres envoltorios de una línea en vez de un método por tipo en el puerto.
*/
const contentIdNuevo = (ids: IdGenerator): ContentId => contentId(ids.next())
const noteIdNuevo = (ids: IdGenerator): NoteId => noteId(ids.next())
const contextIdNuevo = (ids: IdGenerator): ContextId => contextId(ids.next())
