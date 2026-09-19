/**
 * Qué ha cambiado entre dos estados, para no escribir en disco lo que sigue igual.
 *
 * No compara campo por campo: compara **referencias**. Una nota que no se tocó es
 * literalmente el mismo objeto que antes, así que basta un `===`. Y como el estado
 * se copia por capas, dos comparaciones descartan una clase entera: mil notas no
 * cuestan más que una si lo único que cambió fue un contexto.
 *
 * ⚠️ De lo que depende: si alguna operación devuelve una copia equivalente cuando
 * no ha cambiado nada, esto dirá que **todo** está sucio, siempre. No falla
 * ninguna prueba obvia — sólo se escribe de más para siempre.
 */

import type { AppState } from "../domain/AppState"
import type { Context } from "../domain/Context"
import type { ContextId, NoteId, PlanId } from "../domain/Ids"
import type { Note } from "../domain/Note"
import type { Plan } from "../domain/Plan"

/** Lo que hay que hacerle a una clase de entidad para poner el disco al día. */
export interface EntityChanges<T, TId extends string> {
  /** Nuevas y modificadas: van a `put`. */
  readonly upserted: ReadonlyArray<T>
  /** Las que ya no están: van a `delete`. */
  readonly deleted: ReadonlyArray<TId>
}

export interface StateDiff {
  readonly notes: EntityChanges<Note, NoteId>
  readonly plans: EntityChanges<Plan, PlanId>
  readonly contexts: EntityChanges<Context, ContextId>
}

const NADA = { upserted: [], deleted: [] } as const

/**
 * El diff vacío, **compartido**. `diffState` devuelve esta misma constante
 * siempre que no haya nada que escribir, así que quien llama puede preguntarlo
 * con un `===` en vez de mirar seis arrays. Misma idea que "una operación que no
 * cambia nada devuelve su entrada".
 */
export const NO_CHANGES: StateDiff = {
  notes: NADA,
  plans: NADA,
  contexts: NADA,
}

/**
 * Compara dos mapas de entidades. Devuelve `null` —no un objeto vacío— cuando no
 * hay nada, para qu    e el de arriba pueda decidir de un vistazo si devolver
 * `NO_CHANGES`.
 *
 * Ni un `push` ni un cast: `Object.values` da las entidades ya tipadas, y el id
 * se saca de la propia entidad en vez de `Object.keys`, que devolvería `string[]`
 * y obligaría a castear a `NoteId`.
 */
const diffRecord = <TId extends string, T extends { readonly id: TId }>(
  prev: Readonly<Record<TId, T>>,
  next: Readonly<Record<TId, T>>,
): EntityChanges<T, TId> | null => {
  if (prev === next) return null // el atajo que lo hace barato

  const upserted: ReadonlyArray<T> = Object.values<T>(next).filter(
    (e: T): boolean => e !== prev[e.id],
  )
  const deleted: ReadonlyArray<TId> = Object.values<T>(prev)
    .filter((e: T): boolean => next[e.id] === undefined)
    .map((e: T): TId => e.id)

  return upserted.length === 0 && deleted.length === 0
    ? null
    : { upserted, deleted }
}

export const diffState = (prev: AppState, next: AppState): StateDiff => {
  if (prev === next) return NO_CHANGES

  const notes: EntityChanges<Note, NoteId> | null = diffRecord(prev.notes, next.notes)
  const plans: EntityChanges<Plan, PlanId> | null = diffRecord(prev.plans, next.plans)
  const contexts: EntityChanges<Context, ContextId> | null = diffRecord(
    prev.contexts,
    next.contexts,
  )

  /* Los tres a null significa que los mapas cambiaron de objeto pero no de
     contenido —posible si alguien copia sin cambiar nada— y sigue sin haber nada
     que escribir. */
  if (notes === null && plans === null && contexts === null) return NO_CHANGES

  return {
    notes: notes ?? NADA,
    plans: plans ?? NADA,
    contexts: contexts ?? NADA,
  }
}
