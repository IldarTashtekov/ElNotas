/**
 * El primer tiempo de importar: lee el fichero elegido, comprueba que es una
 * copia, la ensaya y, si vale, deja preparado apuntarla y recargar.
 *
 * Hasta que se confirma no cambia nada; lo que dice va a la configuración.
 */

import type { Clock, IdGenerator, Logger, Result } from "#core/index"
import type { ImportPreparation, ImportSummary } from "#ui/index"
import type { Backup, BackupProblem } from "./backup.js"
import { readBackup } from "./backup.js"
import type { BootError } from "./boot.js"
import { requestImport } from "./importStorage.js"
import { rehearseImport } from "./rehearseImport.js"

export interface PrepareImportDeps {
  readonly almacen: Storage
  readonly clock: Clock
  readonly ids: IdGenerator
  readonly logger: Logger
  /** Recarga la página: es al arrancar cuando se sustituye. */
  readonly reload: () => void
}

/** El texto del fichero, o `null` si no se puede leer. */
const leer = async (fichero: Blob): Promise<string | null> => {
  try {
    return await fichero.text()
  } catch {
    return null
  }
}

/** Lo leído como JSON, o `undefined` si no lo es: `null` es JSON válido. */
const comoJson = (texto: string): unknown => {
  try {
    return JSON.parse(texto) as unknown
  } catch {
    return undefined
  }
}

export const prepareImport = async (
  fichero: Blob,
  { almacen, clock, ids, logger, reload }: PrepareImportDeps,
): Promise<ImportPreparation> => {
  const texto: string | null = await leer(fichero)
  if (texto === null) return { kind: "unreadable-file" }

  const copia: Result<Backup, BackupProblem> = readBackup(comoJson(texto))
  if (!copia.ok) {
    return copia.error.kind === "newer-backup" ? { kind: "newer-backup" } : { kind: "not-a-backup" }
  }

  const ensayo: Result<ImportSummary, BootError> = await rehearseImport(copia.value, { clock, ids, logger })
  if (!ensayo.ok) return { kind: "wont-boot", error: ensayo.error }

  return {
    kind: "ready",
    summary: ensayo.value,
    apply: (): boolean => {
      if (!requestImport(almacen, copia.value)) return false
      reload()
      return true
    },
  }
}
