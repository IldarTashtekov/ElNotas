/**
 * El fallo como valor de retorno, no como excepción.
 *
 * Una excepción no aparece en ninguna firma: `put(nota): Promise<void>` es, leída,
 * una función que promete no fallar nunca, así que quien llama no se entera de que
 * hay un caso que tratar. Esto lo mete dentro del tipo, y **leer el valor sin
 * comprobar antes no compila**.
 *
 * Veinte líneas y cero dependencias. Sin `map` ni `andThen`: el día que uno haga
 * falta de verdad se añade entonces.
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
