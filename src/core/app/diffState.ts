/**
 * Qué ha cambiado entre dos estados: **la mitad pura del write-behind**.
 *
 * Es el eslabón ② de la cadena de identidad (`ARCHITECTURE.md` §3), el que
 * decide si algo llega a disco. Y está aquí, en el core, por una razón muy
 * concreta: **es la única mitad que puede equivocarse en silencio.** La otra
 * mitad —el temporizador, el debounce, llamar al adaptador— es fontanería y vive
 * en `src/storage/`, porque `setTimeout` ni siquiera compila dentro de la verja
 * (§6.4).
 *
 * Partido así, esto se comprueba con dos estados y ninguna espera.
 *
 * ── Todo se decide con `===`, y ahí está el truco ──────────────────────────
 *
 * No se comparan entidades campo por campo: se comparan **referencias**. Una
 * nota que no cambió es literalmente el mismo objeto que antes, porque el
 * reducer devuelve el estado intacto cuando una operación no aplica y sólo
 * reemplaza lo que de verdad tocó.
 *
 * El atajo de arriba es todavía mejor: al editar una nota, el reducer devuelve
 * `{ ...state, notes: { …nuevo… } }`, así que `plans` y `contexts` siguen siendo
 * **el mismo objeto**. Dos comparaciones de referencia y esas dos clases enteras
 * quedan descartadas sin recorrer nada. Mil notas no cuestan más que una si sólo
 * cambió un contexto.
 *
 * ⚠️ Y la cara fea: si alguien escribe una operación que devuelve una copia
 * equivalente cuando no cambió nada, esto empieza a decir que **todo** está
 * sucio, siempre. No falla ninguna prueba obvia — sólo se escribe a disco de más
 * para siempre. Por eso las pruebas de aquí son de identidad.
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
