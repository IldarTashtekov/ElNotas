/**
 * La copia de seguridad: qué lleva el `.json` que se exporta, cómo se arma y
 * cómo se comprueba que lo que se importa es una.
 *
 * Lleva los ficheros guardados tal cual, cada uno con su camino y como texto,
 * más el estado de la pantalla de este dispositivo. Aquí sólo hay datos: leer
 * y escribir el fichero, y el almacén, son de quien llama.
 */

import type { Result } from "#core/index"
import { err, ok } from "#core/index"

/**
 * La versión del formato de la copia. Sube si cambia su forma, no la de las notas.
 * La 1 llevaba las ventanas, el fósforo, los encuadres y el orden del calendario
 * sueltos; la 2, el estado de la pantalla en un objeto.
 */
export const BACKUP_VERSION: number = 2

/** Lo que dice en `app`: distingue una copia de cualquier otro `.json`. */
const MARCA: string = "elnotas"

export interface Backup {
  readonly app: string
  readonly backupVersion: number
  /** Milisegundos epoch: cuándo se exportó. Sólo para quien la mire. */
  readonly exportedAt: number
  /** camino → contenido, los mismos caminos que ve un `BlobStore`. */
  readonly files: Readonly<Record<string, string>>
  /** El estado de la pantalla tal cual estaba guardado, o `null`. Lo valida quien lo carga. */
  readonly uiState: unknown
}

/** Por qué no se puede importar. */
export type BackupProblem =
  /** No es una copia, o le falta algo: el texto es para el aviso. */
  | { readonly kind: "not-a-backup"; readonly detail: string }
  /** La hizo una versión de la app más nueva que ésta. */
  | { readonly kind: "newer-backup"; readonly version: number }

export interface BackupParts {
  readonly exportedAt: number
  readonly files: Readonly<Record<string, string>>
  readonly uiState: unknown
}

export const makeBackup = ({ exportedAt, files, uiState }: BackupParts): Backup => ({
  app: MARCA,
  backupVersion: BACKUP_VERSION,
  exportedAt,
  files,
  uiState,
})

type Registro = Record<string, unknown>

const esRegistro = (x: unknown): x is Registro => typeof x === "object" && x !== null && !Array.isArray(x)

const noEs = (detail: string): Result<never, BackupProblem> => {
  const problema: BackupProblem = { kind: "not-a-backup", detail }
  return err(problema)
}

/**
 * Lo leído de un `.json`, ya parseado → la copia, o por qué no lo es.
 *
 * Mira la forma del sobre, no la de las notas: eso lo hacen después la
 * validación y las migraciones del arranque, igual que con lo guardado.
 * El estado de la pantalla no hace fallar nada: si falta, `null`. Una copia de
 * la versión 1 lo traía en piezas sueltas, que se ignoran: entran sus notas, y
 * la pantalla empieza de cero.
 */
export const readBackup = (datos: unknown): Result<Backup, BackupProblem> => {
  if (!esRegistro(datos) || datos["app"] !== MARCA) return noEs("no es una copia de ElNotas")

  const version: unknown = datos["backupVersion"]
  if (typeof version !== "number" || !Number.isInteger(version) || version < 1) {
    return noEs("«backupVersion» no es una versión")
  }
  if (version > BACKUP_VERSION) {
    const nueva: BackupProblem = { kind: "newer-backup", version }
    return err(nueva)
  }

  const exportedAt: unknown = datos["exportedAt"]
  if (typeof exportedAt !== "number" || !Number.isFinite(exportedAt)) {
    return noEs("«exportedAt» no es un número")
  }

  const files: unknown = datos["files"]
  if (!esRegistro(files)) return noEs("«files» no es un objeto")
  const ajeno: string | undefined = Object.keys(files).find(
    (camino: string): boolean => typeof files[camino] !== "string",
  )
  if (ajeno !== undefined) return noEs(`el fichero «${ajeno}» no es un texto`)

  const backup: Backup = {
    app: MARCA,
    backupVersion: version,
    exportedAt,
    files: files as Readonly<Record<string, string>>,
    uiState: version >= 2 ? (datos["uiState"] ?? null) : null,
  }
  return ok(backup)
}

const codificador: TextEncoder = new TextEncoder()

/** Los ficheros de la copia como bytes, que es lo que guarda un `BlobStore`. */
export const backupBytes = (backup: Backup): ReadonlyArray<readonly [string, Uint8Array]> =>
  Object.entries(backup.files).map(([camino, texto]: [string, string]): readonly [string, Uint8Array] => [
    camino,
    codificador.encode(texto),
  ])

const dosCifras = (n: number): string => String(n).padStart(2, "0")

/** `elnotas-backup-AAAA-MM-DD.json`, con la fecha de este dispositivo. */
export const backupFileName = (now: number): string => {
  const fecha: Date = new Date(now)
  const dia: string = [String(fecha.getFullYear()), dosCifras(fecha.getMonth() + 1), dosCifras(fecha.getDate())].join(
    "-",
  )
  return `elnotas-backup-${dia}.json`
}
