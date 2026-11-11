/**
 * Lo de fuera de la copia automática en la app de Android: dónde se apunta qué
 * copias son de esta instalación (en `localStorage`) y la carpeta donde se
 * escriben, `Documentos/ElNotas/`, por el puente de Capacitor.
 */

import type { Logger } from "#core/index"
import type { AutoBackupState } from "./autoBackup.js"
import { SIN_COPIAS, readAutoBackupState } from "./autoBackup.js"

export const AUTO_BACKUP_KEY: string = "elnotas:copias"

/** La carpeta, dentro de Documentos. */
const CARPETA: string = "ElNotas"

type MetodoDePlugin = (opciones: object) => Promise<unknown>

/** Lo que usa del puente de la app; TypeScript no lo trae. */
interface ConPuente {
  readonly Capacitor?: {
    readonly Plugins?: {
      readonly Filesystem?: { readonly writeFile?: MetodoDePlugin; readonly deleteFile?: MetodoDePlugin }
    }
  }
}

export interface AutoBackupStatePersistence {
  readonly load: () => AutoBackupState
  readonly save: (estado: AutoBackupState) => boolean
}

/** Si no se lee, como si no hubiera copias: lo peor es que no se borre alguna vieja. */
export const createLocalStorageAutoBackupState = (almacen: Storage, logger: Logger): AutoBackupStatePersistence => ({
  load: (): AutoBackupState => {
    try {
      const texto: string | null = almacen.getItem(AUTO_BACKUP_KEY)
      return texto === null ? SIN_COPIAS : readAutoBackupState(JSON.parse(texto) as unknown)
    } catch (fallo: unknown) {
      logger.failure("no se leyó el estado de la copia automática", fallo)
      return SIN_COPIAS
    }
  },
  save: (estado: AutoBackupState): boolean => {
    try {
      almacen.setItem(AUTO_BACKUP_KEY, JSON.stringify(estado))
      return true
    } catch (fallo: unknown) {
      logger.failure("no se apuntó el estado de la copia automática", fallo)
      return false
    }
  },
})

export interface DocumentsFolder {
  readonly write: (nombre: string, texto: string) => Promise<boolean>
  readonly remove: (nombre: string) => Promise<boolean>
}

const filesystem = (ventana: Window): NonNullable<NonNullable<ConPuente["Capacitor"]>["Plugins"]>["Filesystem"] =>
  (ventana as unknown as ConPuente).Capacitor?.Plugins?.Filesystem

/** `Documentos/ElNotas/`: crea la carpeta si no está. Cada fallo se registra y responde `false`. */
export const documentsFolder = (ventana: Window, logger: Logger): DocumentsFolder => ({
  write: async (nombre: string, texto: string): Promise<boolean> => {
    const pluginEscribir: MetodoDePlugin | undefined = filesystem(ventana)?.writeFile
    if (pluginEscribir === undefined) {
      logger.failure("el puente de la app no trae Filesystem.writeFile", null)
      return false
    }
    try {
      await pluginEscribir({
        path: `${CARPETA}/${nombre}`,
        data: texto,
        directory: "DOCUMENTS",
        encoding: "utf8",
        recursive: true,
      })
      return true
    } catch (fallo: unknown) {
      logger.failure(`no se escribió la copia automática ${nombre}`, fallo)
      return false
    }
  },
  remove: async (nombre: string): Promise<boolean> => {
    const pluginBorrar: MetodoDePlugin | undefined = filesystem(ventana)?.deleteFile
    if (pluginBorrar === undefined) {
      logger.failure("el puente de la app no trae Filesystem.deleteFile", null)
      return false
    }
    try {
      await pluginBorrar({ path: `${CARPETA}/${nombre}`, directory: "DOCUMENTS" })
      return true
    } catch (fallo: unknown) {
      logger.failure(`no se borró la copia automática ${nombre}`, fallo)
      return false
    }
  },
})
