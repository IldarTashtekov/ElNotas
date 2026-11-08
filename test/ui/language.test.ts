/**
 * El idioma: qué se lee de lo guardado, que al arrancar mande lo elegido o, sin
 * elegir, el del navegador, y que cambiarlo lo guarde y recargue sólo si cambia
 * y se pudo guardar.
 */

import { afterEach, test } from "node:test"
import assert from "node:assert/strict"

import type { Result, StorageError } from "#core/index"
import { err, ok } from "#core/index"
import type { Language, LanguageSetting } from "#ui/index"
import { createLanguageSetting } from "#ui/index"
import { browserLanguage, languageChoices, parseLanguage } from "#ui/language"
import { es } from "#ui/textos/es"
import { textos, usarIdioma } from "#ui/textos/idioma"
import type { RecordingLogger } from "../core/ports/FakeLogger"
import { createRecordingLogger, silentLogger } from "../core/ports/FakeLogger"

/* Crear el ajuste cambia el idioma de todo el proceso: cada prueba deja el de partida. */
afterEach((): void => {
  usarIdioma(es)
})

/* ── Leer ── */

test("parseLanguage reconoce los dos idiomas y lo demás es null", (): void => {
  assert.equal(parseLanguage("es"), "es")
  assert.equal(parseLanguage("en"), "en")
  for (const raro of [null, undefined, "", "EN", "en-GB", "fr", 1, {}]) {
    assert.equal(parseLanguage(raro), null)
  }
})

test("el del navegador: inglés si es inglés, y español todo lo demás", (): void => {
  assert.equal(browserLanguage("en-GB"), "en")
  assert.equal(browserLanguage("EN-us"), "en")
  assert.equal(browserLanguage("es-ES"), "es")
  assert.equal(browserLanguage("fr"), "es")
  assert.equal(browserLanguage(""), "es")
})

test("cada idioma se ofrece escrito en sí mismo", (): void => {
  assert.deepEqual(languageChoices(), [
    { value: "es", label: "Español" },
    { value: "en", label: "English" },
  ])
})

/* ── El ajuste ── */

interface Escenario {
  readonly setting: LanguageSetting
  readonly aplicados: () => ReadonlyArray<Language>
  readonly guardados: () => ReadonlyArray<Language>
  readonly recargas: () => number
}

const escenario = (
  leido: Result<unknown, StorageError>,
  navegador: string,
  guardar: Result<void, StorageError> = ok(undefined),
  registro: RecordingLogger | null = null,
): Escenario => {
  let aplicados: ReadonlyArray<Language> = []
  let guardados: ReadonlyArray<Language> = []
  let recargas: number = 0
  const setting: LanguageSetting = createLanguageSetting({
    persistence: {
      load: (): Result<unknown, StorageError> => leido,
      save: (idioma: Language): Result<void, StorageError> => {
        guardados = [...guardados, idioma]
        return guardar
      },
    },
    browser: navegador,
    apply: (idioma: Language): void => {
      aplicados = [...aplicados, idioma]
    },
    reload: (): void => {
      recargas = recargas + 1
    },
    logger: registro?.logger ?? silentLogger,
  })
  return {
    setting,
    aplicados: (): ReadonlyArray<Language> => aplicados,
    guardados: (): ReadonlyArray<Language> => guardados,
    recargas: (): number => recargas,
  }
}

test("sin nada elegido sigue al navegador, y los textos ya salen en ese idioma", (): void => {
  const e: Escenario = escenario(ok(null), "en-US")
  assert.equal(e.setting.get(), "en")
  assert.deepEqual(e.aplicados(), ["en"])
  assert.equal(textos.codigo, "en")
  assert.deepEqual(e.guardados(), [])
})

test("lo elegido manda sobre el navegador", (): void => {
  const e: Escenario = escenario(ok("es"), "en-US")
  assert.equal(e.setting.get(), "es")
  assert.equal(textos.codigo, "es")
})

test("si no se puede leer lo guardado, sigue al navegador", (): void => {
  const fallo: StorageError = { kind: "io", cause: new Error("bloqueado") }
  const e: Escenario = escenario(err(fallo), "en")
  assert.equal(e.setting.get(), "en")
})

test("cambiarlo lo guarda y recarga, sin tocar los textos de antes de recargar", (): void => {
  const e: Escenario = escenario(ok(null), "es-ES")
  e.setting.set("en")
  assert.deepEqual(e.guardados(), ["en"])
  assert.equal(e.recargas(), 1)
  assert.equal(textos.codigo, "es")
})

test("elegir el que ya está no guarda ni recarga", (): void => {
  const e: Escenario = escenario(ok("en"), "es-ES")
  e.setting.set("en")
  assert.deepEqual(e.guardados(), [])
  assert.equal(e.recargas(), 0)
})

test("si no se guarda, no recarga y queda en el registro", (): void => {
  const registro: RecordingLogger = createRecordingLogger()
  const e: Escenario = escenario(ok(null), "es-ES", err({ kind: "io", cause: "lleno" }), registro)
  e.setting.set("en")
  assert.equal(e.recargas(), 0)
  assert.deepEqual(registro.logged(), ["no se guardó el idioma"])
})
