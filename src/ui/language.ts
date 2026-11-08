/**
 * El idioma de la app, español o inglés: cuáles hay, cómo se lee lo guardado y
 * el ajuste que lo elige al arrancar y lo cambia desde la configuración.
 *
 * Mientras no se elija, sigue al del navegador. Cambiarlo lo guarda y recarga la
 * app, que arranca ya en el nuevo.
 */

import type { Logger, Result, StorageError } from "#core/index"
import { en } from "./textos/en.js"
import { es } from "./textos/es.js"
import { usarIdioma } from "./textos/idioma.js"
import type { Textos } from "./textos/Textos.js"

export type Language = Textos["codigo"]

export interface LanguageChoice {
  readonly value: Language
  /** Escrito en su propio idioma, no en el de la app. */
  readonly label: string
}

/** En el orden en que salen en la configuración. */
export const languageChoices = (): ReadonlyArray<LanguageChoice> => [
  { value: "es", label: es.nombreIdioma },
  { value: "en", label: en.nombreIdioma },
]

/** Lo guardado, o `null` si no es un idioma: entonces manda el del navegador. */
export const parseLanguage = (guardado: unknown): Language | null =>
  guardado === "es" || guardado === "en" ? guardado : null

/** El del navegador («en-GB», «es-ES»…): inglés si es inglés; si no, español. */
export const browserLanguage = (etiqueta: string): Language => (etiqueta.toLowerCase().startsWith("en") ? "en" : "es")

const textosDe = (idioma: Language): Textos => (idioma === "en" ? en : es)

/** Dónde se guarda. Lo pone `platform/`. Ninguno de los dos lanza. */
export interface LanguagePersistence {
  /** Lo guardado tal cual, o `null` si nunca se eligió. */
  readonly load: () => Result<unknown, StorageError>
  readonly save: (idioma: Language) => Result<void, StorageError>
}

export interface LanguageSetting {
  readonly get: () => Language
  /** Lo guarda y recarga. No hace nada si ya era ese. */
  readonly set: (idioma: Language) => void
}

export interface LanguageSettingDeps {
  readonly persistence: LanguagePersistence
  /** El idioma del navegador, como lo da `navigator.language`. */
  readonly browser: string
  /** Lo pinta en la página. Se llama al crearlo. */
  readonly apply: (idioma: Language) => void
  readonly reload: () => void
  readonly logger: Logger
}

/** Elige el idioma de los textos al crearse: se crea al arrancar, antes de pintar nada. */
export const createLanguageSetting = ({
  persistence,
  browser,
  apply,
  reload,
  logger,
}: LanguageSettingDeps): LanguageSetting => {
  const leido: Result<unknown, StorageError> = persistence.load()
  /* Si no se puede leer, el del navegador: lo único que se pierde es la elección. */
  const actual: Language = (leido.ok ? parseLanguage(leido.value) : null) ?? browserLanguage(browser)
  usarIdioma(textosDe(actual))
  apply(actual)
  return {
    get: (): Language => actual,
    set: (idioma: Language): void => {
      if (idioma === actual) return
      /* Sin guardar, recargar volvería al mismo: no se recarga. Queda en la consola. */
      const guardado: Result<void, StorageError> = persistence.save(idioma)
      if (!guardado.ok) return logger.failure("no se guardó el idioma", guardado.error)
      reload()
    },
  }
}
