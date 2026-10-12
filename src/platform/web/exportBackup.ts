/**
 * Exportar: junta lo guardado —los ficheros, las ventanas, el fósforo y los
 * encuadres de los diagramas— en una copia y la escribe donde diga el usuario.
 *
 * Primero se elige dónde, luego se guarda lo pendiente y se lee lo guardado. Si
 * el guardado está detenido, se exporta igualmente lo que hay y se dice. Dónde
 * acaba el fichero lo decide quien pasa `chooseDestination`.
 */

import type { BlobStore, Clock, Result, StorageError } from "#core/index"
import { err, ok } from "#core/index"
import type {
  ExportResult,
  FramingPersistence,
  PhosphorPersistence,
  WindowsPersistence,
} from "#ui/index"
import type { Backup } from "./backup.js"
import { backupFileName, makeBackup } from "./backup.js"

/** Dónde va la copia, ya elegido. `false` si no se pudo escribir. */
export interface Destination {
  readonly write: (texto: string) => Promise<boolean>
}

/** Pregunta dónde guardar. `null` si el usuario lo cancela. */
export type ChooseDestination = (nombre: string) => Promise<Destination | null>

export interface ExportDeps {
  readonly flush: () => Promise<Result<void, StorageError>>
  readonly blobs: BlobStore
  readonly windows: WindowsPersistence
  readonly phosphor: PhosphorPersistence
  readonly framing: FramingPersistence
  readonly clock: Clock
  readonly chooseDestination: ChooseDestination
}

/* Sin `fatal`: lo guardado lo escribió la app en UTF-8, y un fichero que no lo
   sea va igualmente, como mejor se pueda leer, en vez de quedarse fuera. */
const descodificador: TextDecoder = new TextDecoder("utf-8")

const aTexto = (bytes: Uint8Array): string | null => {
  try {
    return descodificador.decode(bytes)
  } catch {
    return null
  }
}

/**
 * Lo guardado ahora mismo, como copia. Los ficheros salen tal cual, también los
 * ilegibles. Si las ventanas, el fósforo o los encuadres no se pueden leer, van
 * a `null`: sólo se pierde cómo estaba montada la pantalla.
 */
export const collectBackup = async (
  {
    blobs,
    windows,
    phosphor,
    framing,
    clock,
  }: Pick<ExportDeps, "blobs" | "windows" | "phosphor" | "framing" | "clock">,
): Promise<Result<Backup, StorageError>> => {
  const caminos: Result<ReadonlyArray<string>, StorageError> = await blobs.list("")
  if (!caminos.ok) return caminos

  /* Acumulador local: se construye por partes y se entrega de una pieza. */
  const files: Record<string, string> = {}
  for (const camino of caminos.value) {
    const leido: Result<Uint8Array | null, StorageError> = await blobs.read(camino)
    if (!leido.ok) return leido
    /* Listado y ya no está: lo borró otra pestaña entre medias. No va. */
    if (leido.value === null) continue
    const texto: string | null = aTexto(leido.value)
    if (texto === null) {
      const ilegible: StorageError = { kind: "corrupt", path: camino, cause: null }
      return err(ilegible)
    }
    files[camino] = texto
  }

  const ventanas: Result<unknown, StorageError> = windows.load()
  const fosforo: Result<unknown, StorageError> = phosphor.load()
  const encuadres: Result<unknown, StorageError> = framing.load()
  return ok(
    makeBackup({
      exportedAt: clock.now(),
      files,
      windows: ventanas.ok ? ventanas.value : null,
      phosphor: fosforo.ok && typeof fosforo.value === "string" ? fosforo.value : null,
      framing: encuadres.ok ? encuadres.value : null,
    }),
  )
}

/** La copia como texto, legible si alguien la abre. `null` si no se puede. */
const serializar = (backup: Backup): string | null => {
  try {
    return `${JSON.stringify(backup, null, 2)}\n`
  } catch {
    return null
  }
}

/**
 * Se elige dónde ANTES de leer nada: el diálogo de «Guardar como» sólo se abre
 * justo después de la pulsación, y esperar al guardado podría hacerle perderla.
 */
export const exportBackup = async (deps: ExportDeps): Promise<ExportResult> => {
  const destino: Destination | null = await deps.chooseDestination(
    backupFileName(deps.clock.now()),
  )
  if (destino === null) return { kind: "cancelled" }

  const guardado: Result<void, StorageError> = await deps.flush()
  const copia: Result<Backup, StorageError> = await collectBackup(deps)
  if (!copia.ok) return { kind: "failed", error: copia.error }

  const texto: string | null = serializar(copia.value)
  if (texto === null || !(await destino.write(texto))) return { kind: "failed", error: null }
  return { kind: "exported", partial: !guardado.ok }
}
