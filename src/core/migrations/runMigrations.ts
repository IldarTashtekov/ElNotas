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

import { err, ok } from "../domain/Result"
import type { Result } from "../domain/Result"
import type { MigrationError } from "../domain/errors/MigrationError"

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
export const CURRENT_SCHEMA_VERSION: number = 1

/**
 * Lo que responde un almacén en el que **nunca se ha escrito nada**.
 *
 * Tiene su propia constante porque confundirlo con "esquema viejo" rompe el
 * primer arranque de la app: no existe —ni existirá— una migración del 0 al 1,
 * así que un runner que tratara el 0 como una versión más lanzaría la primera
 * vez que alguien abre la aplicación. No hay nada que migrar cuando no hay nada.
 */
export const EMPTY_STORE_VERSION: number = 0

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
 * **Devuelve** un `MigrationError` si los datos vienen de un esquema que este
 * código no sabe leer, o si falta el paso que necesita para llegar. Sigue siendo
 * un error y no un no-op —seguir adelante corrompería las notas—, pero viaja en
 * el valor de retorno en lugar de lanzarse, así que quien llama lo ve en la firma
 * y el compilador le obliga a mirarlo (`ARCHITECTURE.md` §6.5).
 *
 * Con esto la función es **pura y total**: nunca lanza, pase lo que pase.
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
): Result<MigrationResult, MigrationError> => {
  /* Primer arranque: no hay nada guardado, así que no hay nada que migrar. Sin
     este corte, el 0 se trataría como "esquema viejo" y el runner buscaría una
     migración del 0 al 1 que no existe ni va a existir. */
  if (version === EMPTY_STORE_VERSION) {
    return ok({ data, version: target, applied: 0 })
  }

  if (version > target) {
    /* Se abrió con una versión más nueva de la app y ahora con una vieja. */
    const desdeElFuturo: MigrationError = {
      kind: "schema-from-future",
      stored: version,
      supported: target,
    }
    return err(desdeElFuturo)
  }

  let actual: number = version
  let acumulado: unknown = data
  let applied: number = 0

  while (actual < target) {
    const paso: Migration | undefined = migrations.find(
      (m: Migration): boolean => m.from === actual,
    )
    if (paso === undefined) {
      const falta: MigrationError = { kind: "missing-migration", from: actual }
      return err(falta)
    }
    acumulado = paso.migrate(acumulado)
    actual += 1
    applied += 1
  }

  return ok({ data: acumulado, version: actual, applied })
}
