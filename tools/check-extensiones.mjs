/**
 * Falla si un import relativo de `src/` no termina en `.js`.
 *
 * El navegador carga el JavaScript compilado tal cual, sin bundler, y no adivina
 * extensiones: `./domain/Note` es un 404. TypeScript lo acepta sin ella y las
 * pruebas de Node también —compilan a CommonJS, que sí la adivina—, así que sin
 * este guardián un import sin extensión sólo se notaría al abrir la app.
 *
 * Los alias (`#core/index`) no entran: ésos los resuelve el `importmap`.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import ts from "typescript"

const DIRECTORIOS = ["src/core", "src/storage", "src/platform", "src/ui"]

const ficherosTs = (dir, acc = []) => {
  for (const entrada of readdirSync(dir)) {
    const camino = join(dir, entrada)
    if (statSync(camino).isDirectory()) ficherosTs(camino, acc)
    else if (camino.endsWith(".ts")) acc.push(camino)
  }
  return acc
}

/** El especificador de un import, un export … from, o un `import("…")` de tipos. */
const especificadorDe = (n) => {
  if ((ts.isImportDeclaration(n) || ts.isExportDeclaration(n)) && n.moduleSpecifier) {
    return n.moduleSpecifier
  }
  if (ts.isImportTypeNode(n) && ts.isLiteralTypeNode(n.argument)) return n.argument.literal
  if (
    ts.isCallExpression(n) &&
    n.expression.kind === ts.SyntaxKind.ImportKeyword &&
    n.arguments[0] !== undefined
  ) {
    return n.arguments[0]
  }
  return null
}

const infracciones = []

for (const fichero of DIRECTORIOS.filter((d) => existsSync(d)).flatMap((d) => ficherosTs(d))) {
  const sf = ts.createSourceFile(fichero, readFileSync(fichero, "utf8"), ts.ScriptTarget.ES2020, true)

  const visitar = (n) => {
    const nodo = especificadorDe(n)
    if (nodo !== null && ts.isStringLiteral(nodo)) {
      const texto = nodo.text
      if ((texto.startsWith("./") || texto.startsWith("../")) && !texto.endsWith(".js")) {
        const { line } = sf.getLineAndCharacterOfPosition(nodo.getStart(sf))
        infracciones.push(`  ${fichero}:${line + 1}  "${texto}"`)
      }
    }
    ts.forEachChild(n, visitar)
  }
  visitar(sf)
}

if (infracciones.length > 0) {
  console.error("✗ imports relativos sin .js — el navegador no los encuentra:\n")
  console.error(infracciones.join("\n"))
  console.error('\n  Escríbelos con la extensión del JS emitido: "./domain/Note.js".')
  process.exit(1)
}

console.log("✓ todos los imports relativos de src/ llevan .js")
