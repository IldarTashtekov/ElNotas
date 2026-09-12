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
import type { Repository } from "./Repository"

export interface StorageAdapter {
  readonly notes: Repository<Note, NoteId>
  readonly plans: Repository<Plan, PlanId>
  readonly contexts: Repository<Context, ContextId>

  /**
   * Agrupa escrituras. **Best-effort según el adaptador** — ver arriba.
   * El `T` es el de la función que se le pasa, no el de ninguna entidad.
   */
  readonly transaction: <T>(fn: () => Promise<T>) => Promise<T>

  /** Versión del esquema de lo guardado. Un almacén vacío responde `0`. */
  readonly getSchemaVersion: () => Promise<number>
  readonly setSchemaVersion: (v: number) => Promise<void>
}
