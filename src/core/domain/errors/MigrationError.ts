/**
 * Lo que puede ir mal al llevar lo guardado de un esquema al siguiente
 * (`ARCHITECTURE.md` §6.5).
 *
 * Vive en `domain/errors/` porque un error es **una entidad del dominio más**, al
 * mismo nivel que `Note` o `Context`: forma parte de lo que la app sabe decir, no
 * del módulo que da la casualidad de producirlo. Por eso está junto a
 * `StorageError` y no dentro de `migrations/`, que es sólo quien lo emite.
 *
 * Que estén juntos no los confunde: éste **no es un fallo de entrada/salida**.
 * Nada se ha roto al hablar con el disco; es que **estos datos no se pueden leer
 * con este código**, y quien lo decide es el runner.
 *
 * ── Los tres, y por qué son error y no no-op ───────────────────────────────
 *
 *     schema-from-future  lo guardado es de un esquema MÁS NUEVO que el que este
 *                         código entiende. Pasa de verdad: alguien abre su
 *                         fichero con una versión nueva de la app y luego con una
 *                         vieja.
 *     missing-migration   falta un paso de la cadena. El runner sabe adónde tiene
 *                         que llegar pero no por dónde.
 *     migration-failed    el paso existe y REVENTÓ al ejecutarlo.
 *
 * **El tercero llegó después que los otros dos, y llegó por un agujero medido.**
 * Los dos primeros describen cosas que el runner comprueba *antes* de tocar
 * nada; éste describe lo único que el runner no controla: **`migrate` es código
 * ajeno**. Lo escribe quien migra, y trabaja justo sobre datos con forma vieja,
 * que es la situación en la que algo revienta. Sin este caso, una migración que
 * lanzara **se escapaba de `runMigrations` como excepción** —comprobado— y con
 * ella se iba abajo el arranque de la app, que es el peor momento posible.
 *
 * Lleva `from` por el mismo motivo que `missing-migration`: sin saber **qué
 * paso** falló no hay forma de arreglarlo. Y lleva `cause` con la excepción
 * original intacta, como los `StorageError`: es para depurar, no para enseñar.
 *
 * En los tres casos **seguir adelante corrompe los datos**, así que aquí no vale
 * la regla de "lo que no aplica no hace nada" (§9.3), que es de las operaciones y
 * del reducer: allí lo que llega raro es una acción del usuario, y no debe
 * llevarse la app por delante; aquí lo que llega raro son sus notas.
 *
 * Lo que sí cambia es **cómo** se dice: devolviéndolo, no lanzándolo. Con esto
 * `runMigrations` pasa de ser sólo **pura** a ser **pura y total**, que son dos
 * propiedades distintas y hasta ahora la segunda sólo la prometía el reducer.
 */
export type MigrationError =
  | { readonly kind: "schema-from-future"; readonly stored: number; readonly supported: number }
  | { readonly kind: "missing-migration"; readonly from: number }
  | { readonly kind: "migration-failed"; readonly from: number; readonly cause: unknown }
