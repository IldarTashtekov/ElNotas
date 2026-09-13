/**
 * El fallo como valor de retorno, no como excepción (`ARCHITECTURE.md` §6.5).
 *
 * Una excepción **no aparece en ninguna firma**: `put(entity: Note):
 * Promise<void>` es, leída, una función que promete no fallar nunca. TypeScript
 * no tiene `throws` en el tipo y no va a tenerlo, así que quien llama no se
 * entera de que hay un caso que tratar y el compilador tampoco puede avisarle.
 * `Result` mete ese caso **dentro del tipo**, que es donde el resto de la
 * arquitectura ya trabaja.
 *
 * ── Por qué unión discriminada ─────────────────────────────────────────────
 *
 * El mismo estilo que `Content` (por `type`) y `Position` (por `at`), aquí por
 * `ok`: al comprobar `if (r.ok)` el compilador estrecha, y **leer `r.value` sin
 * comprobar antes no compila**. Ésa es toda la fuerza del mecanismo; no hay más
 * maquinaria debajo.
 *
 * ── A mano, y sin helpers de más ───────────────────────────────────────────
 *
 * Veinte líneas y cero dependencias. Tampoco lleva `map`, `andThen` ni
 * `unwrapOr`: aquí no se construye lo que no tiene consumidor, y el día que uno
 * de ellos haga falta de verdad se añade entonces.
 */

export type Result<T, E> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E }

/*
    Los dos constructores, como en `Ids.ts`, `Content.ts` y `Position.ts`: quien
    llama no escribe el objeto literal a mano.

    El tipo devuelto lleva `never` en la mitad que no se construye —`ok` no puede
    fallar, `err` no trae valor— para que el otro parámetro lo ponga el sitio que
    lo recibe. Así `ok(null)` encaja en un `Result<Note | null, StorageError>`
    sin tener que decirle a la llamada qué error no ha ocurrido.
*/

/** Salió bien. El valor se devuelve **intacto**, no copiado. */
export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value })

/** Salió mal. El error también viaja intacto: `cause` es para depurar. */
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error })
