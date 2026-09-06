/**
 * Las acciones: objetos planos que describen **qué ha pasado**.
 *
 * Una acción no es una función y no hace nada por sí misma. Es un dato, como un
 * apunte en un libro de cuentas. Y que sea un dato tiene consecuencias
 * prácticas: se puede registrar, guardar, comparar en una prueba, o mandar por
 * la red tal cual.
 *
 * Hoy hay **una sola**, la de la rebanada vertical. En la Fase 2 esto pasa a ser
 * una unión discriminada con el catálogo entero, y el `switch` del reducer
 * dejará de compilar hasta que se traten todas.
 */

import type { ContentId, NoteId, Revision } from "../domain/Ids"

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

/** «Se marcó (o desmarcó) esta casilla de esta nota». */
export interface SetChecked {
  readonly type: "set-checked"
  readonly noteId: NoteId
  readonly contentId: ContentId
  readonly checked: boolean
  readonly meta: ActionMeta
}

export type Action = SetChecked
