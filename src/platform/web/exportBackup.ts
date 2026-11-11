/**
 * Exportar: junta lo guardado —los ficheros y el estado de la pantalla— en una
 * copia y la escribe donde diga el usuario.
 *
 * Primero se elige dónde, luego se guarda lo pendiente y se lee lo guardado. Si
 * el guardado está detenido, se exporta igualmente lo que hay y se dice. Dónde
 * acaba el fichero lo decide quien pasa `chooseDestination`; en la app de Android
 * no se pregunta nada antes y la hoja de compartir sale al escribir, así que
 * cancelar puede llegar al elegir o al escribir.
 */

import type { BlobStore, Clock, Result, StorageError } from "#core/index"
import { err, ok } from "#core/index"
import type { ExportResult, UiStatePersistence } from "#ui/index"
import type { Backup } from "./backup.js"
import { backupFileName, makeBackup } from "./backup.js"

/**
 * Cómo acabó escribir: `shared` si se pasó a otra app (no se sabe si se guardó), y
 * `cancelled` si el usuario lo dejó a medias, como cerrar la hoja de compartir.
 */
export type Written = "written" | "shared" | "cancelled" | "failed"

/** Dónde va la copia, ya elegido. */
export interface Destination {
  readonly write: (texto: string) => Promise<Written>
}

/** Pregunta dónde guardar. `null` si el usuario lo cancela. */
export type ChooseDestination = (nombre: string) => Promise<Destination | null>

export interface ExportDeps {
  readonly flush: () => Promise<Result<void, StorageError>>
  readonly blobs: BlobStore
  readonly uiState: UiStatePersistence
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
 * ilegibles. Si el estado de la pantalla no se puede leer, va a `null`: sólo se
 * pierde cómo estaba montada la pantalla.
 */
export const collectBackup = async ({
  blobs,
  uiState,
  clock,
}: Pick<ExportDeps, "blobs" | "uiState" | "clock">): Promise<Result<Backup, StorageError>> => {
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

  const pantalla: Result<unknown, StorageError> = uiState.load()
  return ok(
    makeBackup({
      exportedAt: clock.now(),
      files,
      uiState: pantalla.ok ? pantalla.value : null,
    }),
  )
}

/** La copia como texto, legible si alguien la abre. `null` si no se puede. */
export const serializeBackup = (backup: Backup): string | null => {
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
  const destino: Destination | null = await deps.chooseDestination(backupFileName(deps.clock.now()))
  if (destino === null) return { kind: "cancelled" }

  const guardado: Result<void, StorageError> = await deps.flush()
  const copia: Result<Backup, StorageError> = await collectBackup(deps)
  if (!copia.ok) return { kind: "failed", error: copia.error }

  const texto: string | null = serializeBackup(copia.value)
  if (texto === null) return { kind: "failed", error: null }
  const escrita: Written = await destino.write(texto)
  if (escrita === "cancelled") return { kind: "cancelled" }
  if (escrita === "failed") return { kind: "failed", error: null }
  if (escrita === "shared") return { kind: "shared", partial: !guardado.ok }
  return { kind: "exported", partial: !guardado.ok }
}
