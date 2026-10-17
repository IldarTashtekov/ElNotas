/**
 * Falla si un fichero de código de `src/`, `test/`, `tools/` o `.claude/hooks/`
 * señala un documento por su número de sección, con el signo de párrafo.
 *
 * Para señalar un documento se nombra el fichero, y si hace falta, el título de
 * la sección. Los `.md` no entran: son documentos y se remiten entre ellos.
 */
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"

const DIRECTORIOS = ["src", "test", "tools", ".claude/hooks"]
const CODIGO = /\.(ts|mjs|js|html|css|sh)$/

const ficheros = (dir, acc = []) => {
  for (const entrada of readdirSync(dir)) {
    const camino = join(dir, entrada)
    if (statSync(camino).isDirectory()) ficheros(camino, acc)
    else if (CODIGO.test(camino)) acc.push(camino)
  }
  return acc
}

const hallados = DIRECTORIOS.flatMap((dir) =>
  ficheros(dir).flatMap((fichero) =>
    readFileSync(fichero, "utf8")
      .split("\n")
      .flatMap((linea, i) => (linea.includes("\u00a7") ? [`  ${fichero}:${i + 1}  ${linea.trim()}`] : [])),
  ),
)

if (hallados.length > 0) {
  console.error(`\n✗ ${hallados.length} referencia(s) por número de sección en el código:\n`)
  console.error(hallados.join("\n"))
  console.error(
    [
      "",
      "  Los números de sección cambian al reorganizar un documento, y nadie relee",
      "  los comentarios buscando los que se han quedado señalando otra cosa.",
      "  Nombra el fichero y, si hace falta, el título de la sección.",
      "",
    ].join("\n"),
  )
  process.exit(1)
}

console.log("✓ ningún fichero de código señala un documento por número de sección")
