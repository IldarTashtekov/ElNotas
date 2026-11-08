/**
 * Los textos en inglés: las frases con datos, con su plural y su orden, y que
 * ninguna frase se haya quedado en español por descuido.
 */

import { test } from "node:test"
import assert from "node:assert/strict"

import { en } from "#ui/textos/en"
import { es } from "#ui/textos/es"

/* ── El plural ── */

test("los recuentos llevan el singular con uno y el plural con los demás", (): void => {
  assert.equal(en.recuentos.notas(1), "1 note")
  assert.equal(en.recuentos.notas(0), "0 notes")
  assert.equal(en.recuentos.diagramas(2), "2 diagrams")
  assert.equal(en.recuentos.contextos(1), "1 context")
})

test("los recuentos se unen con comas y un «and» antes del último", (): void => {
  assert.equal(en.recuentos.unir(["2 notes"]), "2 notes")
  assert.equal(en.recuentos.unir(["2 notes", "1 context"]), "2 notes and 1 context")
  assert.equal(en.recuentos.unir(["2 notes", "1 diagram", "3 contexts"]), "2 notes, 1 diagram and 3 contexts")
})

test("los avisos de ficheros ilegibles distinguen uno de varios", (): void => {
  assert.equal(en.avisos.ficherosIlegibles(1), "One file couldn't be read and has been left out:")
  assert.equal(en.avisos.ficherosIlegibles(3), "3 files couldn't be read and have been left out:")
  assert.equal(en.avisos.ficherosSinTocar(1), "It's still saved, untouched. Everything else is fine.")
  assert.equal(en.avisos.ficherosSinTocar(2), "They're still saved, untouched. Everything else is fine.")
})

test("la pregunta de borrar líneas o nodos cuenta en singular y en plural", (): void => {
  assert.equal(en.nota.preguntaBorrarLineas(1), "Delete 1 line?")
  assert.equal(en.nota.preguntaBorrarLineas(4), "Delete 4 lines?")
  assert.equal(en.diagrama.preguntaBorrarNodos(1), "Delete 1 node?")
  assert.equal(en.diagrama.preguntaBorrarNodos(2), "Delete 2 nodes?")
})

test("borrar una rutina cuenta sus días marcados en singular y en plural", (): void => {
  assert.match(en.rutinas.preguntaBorrar("Read", 1), /^Delete the routine “Read”\? Its 1 checked day will be lost/)
  assert.match(en.rutinas.preguntaBorrar("Read", 12), /Its 12 checked days will be lost/)
})

/* ── La copia ── */

test("la pregunta de importar junta lo que trae y lo ilegible", (): void => {
  const trae: string = en.copia.trae(en.recuentos.unir([en.recuentos.notas(2), en.recuentos.contextos(1)]))
  assert.equal(en.copia.ilegibles(0), "")
  assert.equal(
    en.copia.preguntaImportar(trae, en.copia.ilegibles(0)),
    "The backup has 2 notes and 1 context. Replace everything in this browser with it? What's here now will be lost.",
  )
  assert.equal(
    en.copia.preguntaImportar(trae, en.copia.ilegibles(2)),
    "The backup has 2 notes and 1 context. 2 files can't be read: they come in anyway, but won't be shown. Replace everything in this browser with it? What's here now will be lost.",
  )
})

test("la importación a medias nombra el botón que la abandona", (): void => {
  const texto: string = en.fallos.importacionSinTerminar(en.fallos.sinSitio, en.arranque.abandonarImportacion)
  assert.match(texto, /There's no room left to save anything else\./)
  assert.match(texto, /“Abandon import” starts with whatever already got in\.$/)
})

/* ── El calendario ── */

test("lo que se lee de un día dice sus eventos y sus rutinas sólo si los hay", (): void => {
  assert.equal(en.calendario.diaAria("November 8, 2026", false, null, 3), "November 8, 2026")
  assert.equal(en.calendario.diaAria("November 8, 2026", true, null, 3), "November 8, 2026, with events")
  assert.equal(en.calendario.diaAria("November 8, 2026", false, 2, 3), "November 8, 2026, routines 2 of 3")
})

/* ── Nada sin traducir ── */

/** Las claves cuyo texto se escribe igual en los dos idiomas. */
const IGUALES: ReadonlyArray<string> = ["ventanas.general", "ajustes.fosforoMagenta"]

/**
 * Cada frase de un idioma, con el camino de su clave: `comun.borrar`, o
 * `grupo.lista.0` en un array. Una frase con datos va por su código.
 */
const frases = (objeto: object, camino: string): ReadonlyArray<readonly [string, string]> =>
  Object.entries(objeto).flatMap(([clave, valor]: [string, unknown]): ReadonlyArray<readonly [string, string]> => {
    const aqui: string = camino === "" ? clave : `${camino}.${clave}`
    if (typeof valor === "string") return [[aqui, valor]]
    if (typeof valor === "function") return [[aqui, String(valor)]]
    if (typeof valor === "object" && valor !== null) return frases(valor, aqui)
    return []
  })

test("ninguna frase de en se ha quedado como la de es", (): void => {
  const espanol: ReadonlyMap<string, string> = new Map(frases(es, ""))
  const iguales: ReadonlyArray<string> = frases(en, "")
    .filter(([clave, texto]: readonly [string, string]): boolean => espanol.get(clave) === texto)
    .map(([clave]: readonly [string, string]): string => clave)
    .filter((clave: string): boolean => !IGUALES.includes(clave))
  assert.deepEqual(iguales, [])
})

test("las frases se recorren todas, también las de fuera de un grupo y las que llevan datos", (): void => {
  const claves: ReadonlyArray<string> = frases(en, "").map(([clave]: readonly [string, string]): string => clave)
  assert.ok(claves.includes("nombreIdioma"))
  assert.ok(claves.includes("comun.borrar"))
  assert.ok(claves.includes("lista.seleccionadas"))
})
