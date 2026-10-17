/**
 * Falla si `ARCHITECTURE.md` deja de ser el fundamento y vuelve a ser anatomía o
 * crónica, o si un documento señala una sección suya que no existe.
 *
 * Anatomía: nombra un fichero de `src/` o de `test/`. Crónica: lleva una fecha
 * o una fase. Y tiene un tope de líneas. Las referencias por número de sección
 * se miran en `CLAUDE.md`, `TAREAS.md`, `README.md` y los `.md` de `test/`.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"

const FICHERO = "ARCHITECTURE.md"
const TOPE = 800
const QUE_SENALAN = ["CLAUDE.md", "TAREAS.md", "README.md"]
/* El signo de párrafo, por su código: check:paragrafos no lo deja escrito en el código. */
const PARRAFO = String.fromCharCode(0xa7)
const REFERENCIA = new RegExp(`${PARRAFO}(\\d+(?:\\.\\d+)*)`, "g")

const REGLAS = [
  {
    patron: /\b(src|test)\/[\w./*-]*/,
    porque: "nombra un fichero de src/ o de test/: es anatomía, y ya la cuentan el código y las pruebas",
  },
  {
    patron: /\b(?!index\.ts\b)[A-Za-z]\w*\.(ts|mjs)\b/,
    porque: "nombra un fichero de código: es anatomía, y ya la cuentan el código y las pruebas",
  },
  { patron: /\b\d{4}-\d{2}-\d{2}\b/, porque: "lleva una fecha: es crónica, y vive en TAREAS.md y git log" },
  { patron: /\bfases? \d/i, porque: "señala una fase: es crónica, y vive en TAREAS.md y git log" },
]

const mds = (dir, acc = []) => {
  for (const entrada of readdirSync(dir)) {
    const camino = join(dir, entrada)
    if (statSync(camino).isDirectory()) mds(camino, acc)
    else if (camino.endsWith(".md")) acc.push(camino)
  }
  return acc
}

const lineas = readFileSync(FICHERO, "utf8").split("\n")

const hallados = lineas.flatMap((linea, i) =>
  REGLAS.flatMap((r) => (r.patron.test(linea) ? [`  ${FICHERO}:${i + 1}  ${r.porque}\n      ${linea.trim().slice(0, 100)}`] : [])),
)
if (lineas.length > TOPE) {
  hallados.push(`  ${FICHERO}: ${lineas.length} líneas, y el tope es ${TOPE}: si crece, que cueste y se piense`)
}

const secciones = new Set(lineas.flatMap((l) => /^#{2,4} (\d+(?:\.\d+)*)\b/.exec(l)?.slice(1, 2) ?? []))
const senalan = [FICHERO, ...QUE_SENALAN.filter(existsSync), ...mds("test")]
const rotas = senalan.flatMap((fichero) =>
  readFileSync(fichero, "utf8")
    .split("\n")
    .flatMap((linea, i) =>
      [...linea.matchAll(REFERENCIA)]
        .filter((m) => !secciones.has(m[1]))
        .map((m) => `  ${fichero}:${i + 1}  ${PARRAFO}${m[1]} no es una sección de ${FICHERO}`),
    ),
)

const fallos = [...hallados, ...rotas]
if (fallos.length > 0) {
  console.error(`\n✗ ${fallos.length} problema(s) con ${FICHERO}:\n`)
  console.error(fallos.join("\n"))
  console.error(
    [
      "",
      `  ${FICHERO} es el fundamento: lo que seguiría siendo verdad si mañana se`,
      "  reescribe esa parte del código. Cómo está hecho cada trozo lo cuentan el",
      "  código y las pruebas; cuándo y quién decidió, TAREAS.md y git log.",
      "",
    ].join("\n"),
  )
  process.exit(1)
}

console.log(`✓ ${FICHERO}: ${lineas.length} líneas de fundamento, y ninguna sección señalada que no exista`)
