/**
 * Las acciones: objetos planos que describen **qué ha pasado**.
 *
 * Una acción no es una función y no hace nada por sí misma. Es un dato, como un
 * apunte en un libro de cuentas. Y que sea un dato tiene consecuencias
 * prácticas: se puede registrar, guardar, comparar en una prueba, o mandar por
 * la red tal cual.
 *
 * El catálogo son **dieciséis** (`ARCHITECTURE.md` §9.7) y no están inventadas:
 * cada una sale de un campo del modelo que alguien tiene que poder cambiar, o de
 * una operación de la Fase 1 que ya existe y no tenía quien la despachara. Aquí
 * están las **ocho de contenido**; las de Nota y Contexto van abajo.
 *
 * Es una unión discriminada por `type`, y eso hace que el `switch` del reducer
 * **deje de compilar** en cuanto se añada una acción sin tratar.
 */

import type { Content } from "../domain/Content"
import type { DefaultView } from "../domain/Context"
import type { ContentId, ContextId, ItemRef, NoteId, Revision } from "../domain/Ids"
import type { Position } from "../domain/Position"

/**
 * La hora y la revisión, **ya calculadas**, que viajan dentro de la acción.
 *
 * Es lo peculiar de este proyecto y merece explicación: el reducer es puro, así
 * que no puede pedirle la hora al reloj ni una revisión al generador. Se las
 * tienen que dar hechas. Quien las construye es la capa de casos de uso, que es
 * la única con los puertos inyectados (`ARCHITECTURE.md` §2.1).
 *
 * De propina: como el `meta` se construye **una vez** por acción, todas las
 * entidades que esa acción toque reciben exactamente la misma marca de tiempo,
 * en vez de milisegundos ligeramente distintos según el orden de proceso.
 */
export interface ActionMeta {
  /** Milisegundos desde 1970, del puerto `Clock`. */
  readonly now: number
  /** Token nuevo, del puerto `IdGenerator`. */
  readonly revision: Revision
}

/* ─────────────────────────── Las ocho de contenido ────────────────────────────
    Todas llevan `noteId` —el contenido vive dentro de una nota— y todas se
    reducen igual: llamar a su operación y comparar. Ver `reduce.ts`. */

/** «Se marcó (o desmarcó) esta casilla». */
export interface SetChecked {
  readonly type: "set-checked"
  readonly noteId: NoteId
  readonly contentId: ContentId
  readonly checked: boolean
  readonly meta: ActionMeta
}

/** «Se cambió el texto de esta línea», sea texto suelto o casilla. */
export interface SetText {
  readonly type: "set-text"
  readonly noteId: NoteId
  readonly contentId: ContentId
  readonly value: string
  readonly meta: ActionMeta
}

/**
 * «Se metió una línea nueva aquí».
 *
 * El bloque llega **ya construido, con su id**, porque el dominio no genera
 * identificadores: lo hace el caso de uso, que es quien tiene el `IdGenerator`.
 * Y el "aquí" es un `Position`, que tiene tres casos y ni uno más (§9.4).
 */
export interface Insert {
  readonly type: "insert"
  readonly noteId: NoteId
  readonly block: Content
  readonly position: Position
  readonly meta: ActionMeta
}

/** «Se borró esta línea». No-op si es una casilla con hijas: se borra de abajo arriba. */
export interface Remove {
  readonly type: "remove"
  readonly noteId: NoteId
  readonly contentId: ContentId
  readonly meta: ActionMeta
}

/**
 * «Se partió esta línea por aquí» — Intro en medio de una línea.
 *
 * La **única** de las ocho que necesita un id nuevo: al partir nacen dos líneas,
 * y la segunda necesita el suyo. Llega hecho, como el de `insert`.
 */
export interface Split {
  readonly type: "split"
  readonly noteId: NoteId
  readonly contentId: ContentId
  readonly offset: number
  readonly newId: ContentId
  readonly meta: ActionMeta
}

/** «Se unió esta línea con la de arriba» — Retroceso al principio. */
export interface Merge {
  readonly type: "merge"
  readonly noteId: NoteId
  readonly contentId: ContentId
  readonly meta: ActionMeta
}

/** «Este texto pasa a ser casilla». Conserva su id: es la misma línea con otra pinta. */
export interface ConvertToCheckBox {
  readonly type: "convert-to-checkbox"
  readonly noteId: NoteId
  readonly contentId: ContentId
  readonly meta: ActionMeta
}

/** «Esta casilla pasa a ser texto». También conserva su id. */
export interface ConvertToText {
  readonly type: "convert-to-text"
  readonly noteId: NoteId
  readonly contentId: ContentId
  readonly meta: ActionMeta
}

/** Las que operan sobre el contenido de una nota. Ocho. */
export type ContentAction =
  | SetChecked
  | SetText
  | Insert
  | Remove
  | Split
  | Merge
  | ConvertToCheckBox
  | ConvertToText

/* ──────────────────────────── Las tres de Nota ────────────────────────────── */

/** «Se creó una nota vacía». El id llega hecho, del `IdGenerator`. */
export interface CreateNote {
  readonly type: "create-note"
  readonly noteId: NoteId
  readonly name: string
  readonly meta: ActionMeta
}

export interface RenameNote {
  readonly type: "rename-note"
  readonly noteId: NoteId
  readonly name: string
  readonly meta: ActionMeta
}

/**
 * «Se borró la nota».
 *
 * **La primera acción del proyecto que toca dos entidades a la vez:** hay que
 * quitarla también de todos los contextos que la listaban, o queda una `ItemRef`
 * apuntando a nada (§9.7).
 */
export interface DeleteNote {
  readonly type: "delete-note"
  readonly noteId: NoteId
  readonly meta: ActionMeta
}

export type NoteAction = CreateNote | RenameNote | DeleteNote

/* ────────────────────────── Las seis de Contexto ──────────────────────────── */

export interface CreateContext {
  readonly type: "create-context"
  readonly contextId: ContextId
  readonly name: string
  readonly meta: ActionMeta
}

export interface RenameContext {
  readonly type: "rename-context"
  readonly contextId: ContextId
  readonly name: string
  readonly meta: ActionMeta
}

/** Borrar un contexto **no borra lo que contenía**: sólo guardaba referencias. */
export interface DeleteContext {
  readonly type: "delete-context"
  readonly contextId: ContextId
  readonly meta: ActionMeta
}

/** «Se metió una nota o un plan en este contexto». No-op si no existe (§9.7). */
export interface AddItem {
  readonly type: "add-item"
  readonly contextId: ContextId
  readonly item: ItemRef
  readonly meta: ActionMeta
}

export interface RemoveItem {
  readonly type: "remove-item"
  readonly contextId: ContextId
  readonly item: ItemRef
  readonly meta: ActionMeta
}

/** Qué se ve al abrir el contexto: la lista, o directo a una nota o plan. */
export interface SetDefaultView {
  readonly type: "set-default-view"
  readonly contextId: ContextId
  readonly view: DefaultView
  readonly meta: ActionMeta
}

export type ContextAction =
  | CreateContext
  | RenameContext
  | DeleteContext
  | AddItem
  | RemoveItem
  | SetDefaultView

/** El catálogo entero: 8 + 3 + 6 = **dieciséis**. */
export type Action = ContentAction | NoteAction | ContextAction
