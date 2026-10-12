/**
 * Lo que la configuración necesita para exportar e importar una copia: las dos
 * acciones, que pone quien sabe dónde se guarda, y lo que cada una responde.
 *
 * La UI no sabe qué hay dentro de una copia ni dónde acaba el fichero: sólo
 * pulsa, pregunta y cuenta lo que pasó.
 */

import type { MigrationError, StorageError } from "#core/index"

export type ExportResult =
  /** Escrita. `partial`: el guardado estaba detenido y lo último no va dentro. */
  | { readonly kind: "exported"; readonly partial: boolean }
  /** El usuario cerró el diálogo: no es un fallo y no se avisa. */
  | { readonly kind: "cancelled" }
  /** Con `error` si no se pudo leer lo guardado; sin él, si no se pudo escribir. */
  | { readonly kind: "failed"; readonly error: StorageError | null }

/** Lo que trae una copia, para preguntar antes de sustituir. */
export interface ImportSummary {
  readonly notes: number
  readonly diagrams: number
  readonly contexts: number
  /** Ficheros que no se pueden leer: entran igual, y se saltan como ahora. */
  readonly unreadable: number
}

export type ImportPreparation =
  /** Se puede importar. `apply` la apunta y recarga; `false` si no cabe. */
  | { readonly kind: "ready"; readonly summary: ImportSummary; readonly apply: () => boolean }
  | { readonly kind: "unreadable-file" }
  | { readonly kind: "not-a-backup" }
  | { readonly kind: "newer-backup" }
  /** Es una copia, pero la app no arrancaría con ella. */
  | { readonly kind: "wont-boot"; readonly error: StorageError | MigrationError }

export interface BackupActions {
  readonly exportAll: () => Promise<ExportResult>
  /** Lee el fichero elegido y lo ensaya, sin cambiar nada. */
  readonly prepareImport: (fichero: File) => Promise<ImportPreparation>
}
