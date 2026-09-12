/**
 * El runner de migraciones.
 *
 * `schemaVersion` **es** el mecanismo de migración, y por eso llega con esto y
 * no antes: un número de versión que nadie lee no protege nada
 * (`ARCHITECTURE.md` §9.7). Vive en `StorageAdapter`, no en `AppState`, porque es
 * una propiedad de lo guardado.
 *
 * ── Qué es una migración aquí ──────────────────────────────────────────────
 *
 * Una función de **datos a datos**: recibe lo que había guardado con el esquema
 * `n` y devuelve lo mismo con el esquema `n+1`. Pura, sin tocar el almacén. Quien
 * escribe el resultado es quien llama, y por eso esto se puede probar sin
 * ficheros ni navegador.
 *
 * ── Por qué recibe `unknown` y no `StoredEntities` ─────────────────────────
 *
 * Porque es justo lo que **no** se puede dar por sabido. Una migración existe
 * precisamente porque lo guardado tiene una forma **vieja**, que ya no es la que
 * describen los tipos de hoy: tiparla como `StoredEntities` sería mentir, y la
 * mentira se descubriría en runtime leyendo un campo que no existe. El tipo
 * bueno aparece al final, cuando la cadena entera se ha ejecutado.
 *
 * ── La lista está vacía, y eso es correcto ─────────────────────────────────
 *
 * No hay ninguna migración porque **todavía no hay nada guardado con un esquema
 * viejo**: el primero es el primero. Escribir una de ejemplo sería inventarse un
 * pasado que no existe. Lo que sí hace falta es el runner, para que el día que
 * haga falta la primera sólo haya que añadir una fila.
 */

/** De un esquema al siguiente. Pura: no toca el almacén. */
export interface Migration {
  /** Versión de la que parte. Produce `from + 1`. */
  readonly from: number
  readonly migrate: (data: unknown) => unknown
}

/**
 * La versión de esquema que entiende esta versión del código.
 *
 * **1, no 0**, y la distinción importa: un almacén responde `0` cuando está
 * vacío —nunca se ha escrito nada— y ése es el caso de "primer arranque", no el
 * de "esquema viejo". Distinguirlos es lo que evita intentar migrar la nada.
 */
export const CURRENT_SCHEMA_VERSION = 1

/**
 * Lo que responde un almacén en el que **nunca se ha escrito nada**.
 *
 * Tiene su propia constante porque confundirlo con "esquema viejo" rompe el
 * primer arranque de la app: no existe —ni existirá— una migración del 0 al 1,
 * así que un runner que tratara el 0 como una versión más lanzaría la primera
 * vez que alguien abre la aplicación. No hay nada que migrar cuando no hay nada.
 */
export const EMPTY_STORE_VERSION = 0

/** Las migraciones conocidas, en orden. Vacía a propósito: ver arriba. */
export const MIGRATIONS: ReadonlyArray<Migration> = []

export interface MigrationResult {
  readonly data: unknown
  /** La versión a la que se ha llegado. */
  readonly version: number
  /** Cuántas se aplicaron. Cero es lo normal. */
  readonly applied: number
}

/**
 * Lleva lo guardado desde `version` hasta `CURRENT_SCHEMA_VERSION`.
 *
 * **Lanza** si no encuentra el paso que necesita, y es de los pocos sitios del
 * proyecto donde lanzar es lo correcto: la regla de "no lanzar" es del reducer y
 * de las operaciones, porque una acción rara del usuario no debe llevarse la app
 * por delante. Aquí es al revés — si los datos vienen de una versión que este
 * código no sabe leer, **seguir adelante los corrompe**. Ocurre de verdad cuando
 * alguien abre su fichero con una versión más nueva de la app y luego con una
 * vieja.
 */
/**
 * Lo inyectable, y por qué lo es.
 *
 * Con `CURRENT_SCHEMA_VERSION` valiendo 1 y el almacén vacío valiendo 0 **no
 * existe hoy ninguna versión intermedia**, así que dos de los caminos de esta
 * función —encadenar migraciones y avisar de que falta una— no son alcanzables
 * desde fuera y quedarían sin probar hasta el día que hicieran falta de verdad.
 * Que es el peor día para descubrir que están mal.
 *
 * Inyectarlos es la misma solución que el `schedule` del write-behind: en
 * producción nadie los pasa.
 */
export interface MigrationOptions {
  readonly migrations?: ReadonlyArray<Migration>
  readonly target?: number
}

export const runMigrations = (
  data: unknown,
  version: number,
  { migrations = MIGRATIONS, target = CURRENT_SCHEMA_VERSION }: MigrationOptions = {},
): MigrationResult => {
  /* Primer arranque: no hay nada guardado, así que no hay nada que migrar. Sin
     este corte, el 0 se trataría como "esquema viejo" y el runner buscaría una
     migración del 0 al 1 que no existe ni va a existir. */
  if (version === EMPTY_STORE_VERSION) {
    return { data, version: target, applied: 0 }
  }

  if (version > target) {
    throw new Error(
      `Lo guardado es del esquema ${version} y este código entiende hasta el ` +
        `${target}. Seguramente se abrió con una versión más nueva de la app.`,
    )
  }

  let actual = version
  let acumulado = data
  let applied = 0

  while (actual < target) {
    const paso = migrations.find((m) => m.from === actual)
    if (paso === undefined) {
      throw new Error(`Falta la migración del esquema ${actual} al ${actual + 1}.`)
    }
    acumulado = paso.migrate(acumulado)
    actual += 1
    applied += 1
  }

  return { data: acumulado, version: actual, applied }
}
