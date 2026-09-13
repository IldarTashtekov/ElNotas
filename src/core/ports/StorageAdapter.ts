/**
 * Puerto del almacenamiento completo: **un backend entero**, con los tres
 * repositorios y los metadatos del esquema.
 *
 * Es lo que se le inyecta a la app cuando arranca, y el único sitio donde se
 * decide cuál es concretamente está en `platform/` (`ARCHITECTURE.md` §4). El
 * resto del proyecto conoce esta interfaz y nada más.
 *
 * **La definición de "un adaptador está terminado" es: pasa la suite de
 * contratos** (§6.3). No "funciona a su manera".
 *
 * ── Los Planes están aquí aunque no se operen ──────────────────────────────
 *
 * `plans` existe desde el primer día, igual que `AppState.plans`: un Plan se
 * guarda y se lee como cualquier otra entidad. Lo que **no** hay en la Fase 2 es
 * ni una acción de Plan, porque el editor de grafos está aparcado y no habría
 * quien las despachara (§9.7). Persistir y operar son cosas distintas, y sólo la
 * segunda necesita un consumidor.
 *
 * ── `transaction` es "lo mejor que pueda", y hay que saberlo ───────────────
 *
 * Agrupa varias escrituras en una. Un adaptador sobre una base de datos lo
 * cumplirá de verdad; **uno sobre ficheros sueltos no puede** —no hay forma de
 * escribir tres ficheros atómicamente— y lo único que hará es ejecutarlas
 * seguidas. Eso significa que un fallo a mitad **puede dejar el disco a medias**,
 * y quien lo use no debe suponer lo contrario. Está en el puerto porque la
 * alternativa —que cada llamante invente su propio agrupamiento— es peor.
 *
 * ── Todo devuelve `Result`, incluida `transaction` ─────────────────────────
 *
 * Las tres firmas de aquí y las cuatro de `Repository` van envueltas en
 * `Result<…, StorageError>` (§6.5): **ningún método de este puerto lanza**. El
 * `try/catch` no desaparece, se confina a la frontera de cada adaptador.
 *
 * `transaction` es la firma rara de las siete, porque es la única **genérica** y
 * la única que ejecuta código ajeno. Su función recibe ya el `Result` dentro:
 *
 *     <T>(fn: () => Promise<Result<T, StorageError>>) => Promise<Result<T, StorageError>>
 *
 * Y se lee así: *ejecuta `fn` agrupando sus escrituras y devuelve lo que ella
 * devuelva, o el fallo del agrupamiento en sí*. Las dos alternativas se
 * descartaron por lo mismo, que es que el envoltorio se duplicaría: si `fn`
 * devolviera una `T` pelada, el cuerpo real —que hace `put` tras `put`, y cada
 * `put` ya devuelve un `Result`— acabaría produciendo `Result<Result<T, …>, …>`,
 * dos sobres para un solo fallo. Aquí el aplanado es la firma.
 *
 * **`fn` que devuelve `err` corta la transacción**, y el adaptador devuelve ese
 * mismo error sin reempaquetarlo: quien llama necesita el `kind` original para
 * decidir si reintentar. Y si `fn` **lanza** —un bug, no un fallo previsto—, la
 * excepción tampoco escapa: se traduce a `io`, porque este puerto promete no
 * lanzar y la promesa no admite excepciones.
 *
 * ── Por qué `schemaVersion` vive aquí y no en `AppState` ───────────────────
 *
 * Porque es una propiedad de **lo guardado**, no del estado en memoria. En
 * `AppState` no significaría nada, no la leería nadie, y cada acción tendría que
 * arrastrarla intacta de un estado al siguiente. Quien la lee es el runner de
 * migraciones, al arrancar, antes de que haya `AppState` siquiera.
 */

import type { Context } from "../domain/Context"
import type { ContextId, NoteId, PlanId } from "../domain/Ids"
import type { Note } from "../domain/Note"
import type { Plan } from "../domain/Plan"
import type { Result } from "../domain/Result"
import type { StorageError } from "../domain/errors/StorageError"
import type { Repository } from "./Repository"

export interface StorageAdapter {
  readonly notes: Repository<Note, NoteId>
  readonly plans: Repository<Plan, PlanId>
  readonly contexts: Repository<Context, ContextId>

  /**
   * Agrupa escrituras. **Best-effort según el adaptador** — ver arriba.
   * El `T` es el de la función que se le pasa, no el de ninguna entidad.
   */
  readonly transaction: <T>(
    fn: () => Promise<Result<T, StorageError>>,
  ) => Promise<Result<T, StorageError>>

  /** Versión del esquema de lo guardado. Un almacén vacío responde `0`. */
  readonly getSchemaVersion: () => Promise<Result<number, StorageError>>
  readonly setSchemaVersion: (v: number) => Promise<Result<void, StorageError>>
}
