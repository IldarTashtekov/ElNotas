/**
 * El color del fósforo de la pantalla, ámbar o verde: cuál hay, cómo se lee lo
 * guardado y el ajuste vivo que lo aplica y lo guarda al cambiarlo.
 *
 * Es de cada dispositivo: se guarda aparte de las notas y no viaja con ellas.
 */

import type { Logger, Result, StorageError } from "#core/index"

export type Phosphor = "amber" | "green"

export interface PhosphorChoice {
  readonly value: Phosphor
  readonly label: string
}

/** En el orden en que salen en la configuración. */
export const PHOSPHORS: ReadonlyArray<PhosphorChoice> = [
  { value: "amber", label: "Ámbar" },
  { value: "green", label: "Verde" },
]

export const DEFAULT_PHOSPHOR: Phosphor = "amber"

/** Cualquier cosa que no sea un fósforo conocido es el de siempre. */
export const parsePhosphor = (guardado: unknown): Phosphor =>
  PHOSPHORS.find((opcion: PhosphorChoice): boolean => opcion.value === guardado)?.value ??
  DEFAULT_PHOSPHOR

/** Dónde se guarda. Lo pone `platform/`. Ninguno de los dos lanza. */
export interface PhosphorPersistence {
  /** Lo guardado tal cual, o `null` si nunca se guardó nada. */
  readonly load: () => Result<unknown, StorageError>
  readonly save: (phosphor: Phosphor) => Result<void, StorageError>
}

export interface PhosphorSetting {
  readonly get: () => Phosphor
  /** No hace nada si ya era ese. */
  readonly set: (phosphor: Phosphor) => void
}

export interface PhosphorSettingDeps {
  readonly persistence: PhosphorPersistence
  /** Lo pinta en pantalla. Se llama al crearlo y en cada cambio. */
  readonly apply: (phosphor: Phosphor) => void
  readonly logger: Logger
}

export const createPhosphorSetting = ({
  persistence,
  apply,
  logger,
}: PhosphorSettingDeps): PhosphorSetting => {
  const leido: Result<unknown, StorageError> = persistence.load()
  /* Si no se puede leer, el de siempre: lo único que se pierde es un color. */
  let actual: Phosphor = leido.ok ? parsePhosphor(leido.value) : DEFAULT_PHOSPHOR
  apply(actual)
  return {
    get: (): Phosphor => actual,
    set: (phosphor: Phosphor): void => {
      if (phosphor === actual) return
      actual = phosphor
      apply(actual)
      /* Un fallo al guardar no se avisa, como el de las ventanas: el color se
         ve igual y sólo se pierde al recargar. Queda en la consola. */
      const guardado: Result<void, StorageError> = persistence.save(actual)
      if (!guardado.ok) logger.failure("no se guardó el fósforo", guardado.error)
    },
  }
}
