/**
 * Falla si el `index.ts` de un módulo de `src/` exporta algo que ningún otro
 * módulo de `src/` importa.
 *
 * El `index.ts` es el escaparate: lo que dice que el módulo ofrece a los demás.
 * Lo que sólo usan su propio módulo o las pruebas no va ahí; las pruebas lo
 * importan por su fichero (`#ui/noteActions`).
 */
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import ts from "typescript"

const ficherosTs = (dir, acc = []) => {
  for (const entrada of readdirSync(dir)) {
    const camino = join(dir, entrada)
    if (statSync(camino).isDirectory()) ficherosTs(camino, acc)
    else if (camino.endsWith(".ts")) acc.push(camino)
  }
  return acc
}

const leer = (fichero) =>
  ts.createSourceFile(fichero, readFileSync(fichero, "utf8"), ts.ScriptTarget.Latest, true)

const MODULOS = readdirSync("src").filter((m) => {
  try {
    return statSync(join("src", m, "index.ts")).isFile()
  } catch {
    return false
  }
})

/** Lo que pide cada módulo a los demás: `{ core: Set(["Note", …]), … }`. */
const pedido = Object.fromEntries(MODULOS.map((m) => [m, new Set()]))
for (const fichero of ficherosTs("src")) {
  leer(fichero).forEachChild((n) => {
    if (!ts.isImportDeclaration(n) && !ts.isExportDeclaration(n)) return
    const modulo = /^#(\w+)\/index$/.exec(n.moduleSpecifier?.text ?? "")?.[1]
    if (modulo === undefined || pedido[modulo] === undefined) return
    if (fichero.startsWith(join("src", modulo) + "/")) return
    const lista = ts.isImportDeclaration(n) ? n.importClause?.namedBindings : n.exportClause
    if (lista === undefined || !(ts.isNamedImports(lista) || ts.isNamedExports(lista))) return
    for (const e of lista.elements) pedido[modulo].add((e.propertyName ?? e.name).text)
  })
}

const sobran = []
for (const modulo of MODULOS) {
  const fichero = join("src", modulo, "index.ts")
  const sf = leer(fichero)
  sf.forEachChild((n) => {
    if (!ts.isExportDeclaration(n) || n.exportClause === undefined || !ts.isNamedExports(n.exportClause)) {
      if (ts.isExportDeclaration(n)) {
        const { line } = sf.getLineAndCharacterOfPosition(n.getStart(sf))
        sobran.push(`  ${fichero}:${line + 1}  \`export *\`: di uno a uno lo que sale`)
      }
      return
    }
    for (const e of n.exportClause.elements) {
      if (pedido[modulo].has(e.name.text)) continue
      const { line } = sf.getLineAndCharacterOfPosition(e.getStart(sf))
      sobran.push(`  ${fichero}:${line + 1}  ${e.name.text}`)
    }
  })
}

if (sobran.length > 0) {
  console.error(`\n✗ ${sobran.length} exportación(es) que ningún otro módulo de src/ importa:\n`)
  console.error(sobran.join("\n"))
  console.error(
    [
      "",
      "  El index.ts dice qué ofrece el módulo a los demás. Si nadie de fuera lo",
      "  usa, quítalo de ahí: dentro del módulo se importa relativo, y las",
      "  pruebas, por su fichero (#ui/noteActions, no #ui/index).",
      "",
    ].join("\n"),
  )
  process.exit(1)
}

console.log(`✓ los index.ts de ${MODULOS.join(", ")} sólo exportan lo que otro módulo usa`)
