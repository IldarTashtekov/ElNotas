/**
 * Falla si no hay ni un fichero de prueba compilado en tmp-test/.
 *
 * Por qué existe: `node --test` sobre un directorio sin ficheros de prueba imprime
 * `1..0` y **sale con código 0**. Sin esta comprobación, `npm run check` pasaría
 * entero sin verificar ni un comportamiento, y "los tests pasan" no significaría
 * nada. Es el punto 6 del criterio de cierre de la Fase 1 (`ARCHITECTURE.md` §9.5).
 *
 * Mira la salida compilada y no las fuentes **a propósito**: así caza los dos
 * fallos, el de no haber escrito pruebas y el de haberlas escrito pero no llegar a
 * compilarse adonde el runner las busca. El segundo es el traicionero, porque deja
 * el proyecto en verde con las pruebas escritas y sin ejecutar.
 *
 * Sin dependencias: sólo `node:fs`, como el resto del proyecto.
 */
import { readdirSync } from "node:fs"

const DIRECTORIO = "tmp-test"

/** La convención del proyecto: `*.test.ts` en src/, que compila a `*.test.js`. */
const ES_PRUEBA = /\.test\.[cm]?js$/

let ficheros = []
try {
  ficheros = readdirSync(DIRECTORIO, { recursive: true, encoding: "utf8" })
} catch {
  // El directorio no existe: tsc no llegó a emitir nada. Se trata igual que vacío.
}

const pruebas = ficheros.filter((fichero) => ES_PRUEBA.test(fichero))

if (pruebas.length === 0) {
  console.error(
    [
      "",
      `✗ No hay ninguna prueba en ${DIRECTORIO}/.`,
      "",
      "  `node --test` sin ficheros sale con código 0, así que sin esta",
      "  comprobación `npm run check` pasaría en verde sin verificar nada.",
      "",
      "  Se esperan ficheros `*.test.ts` dentro de src/.",
      "",
    ].join("\n"),
  )
  process.exit(1)
}

console.log(`✓ ${pruebas.length} fichero(s) de prueba en ${DIRECTORIO}/`)
