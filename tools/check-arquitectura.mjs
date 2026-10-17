/**
 * Falla si `ARCHITECTURE.md` deja de ser el fundamento y vuelve a ser anatomía o
 * crónica, si `CLAUDE.md` se llena de lo que caduca, o si un documento señala
 * una sección de `ARCHITECTURE.md` que no existe.
 *
 * `ARCHITECTURE.md`: ni ficheros de código, ni fechas, ni fases. `CLAUDE.md`: ni
 * fechas ni recuentos de pruebas. Los dos, con un tope de líneas. Las referencias
 * por número de sección se miran en `CLAUDE.md`, `TAREAS.md`, `README.md` y los
 * `.md` de `test/`.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"

const FICHERO = "ARCHITECTURE.md"
const QUE_SENALAN = ["CLAUDE.md", "TAREAS.md", "README.md"]
/* El signo de párrafo, por su código: check:paragrafos no lo deja escrito en el código. */
const PARRAFO = String.fromCharCode(0xa7)
const REFERENCIA = new RegExp(`${PARRAFO}(\\d+(?:\\.\\d+)*)`, "g")

const FECHA = { patron: /\b\d{4}-\d{2}-\d{2}\b/, porque: "lleva una fecha: es crónica, y vive en TAREAS.md y git log" }

const REGLAS_ARQUITECTURA = [
  {
    patron: /\b(src|test)\/[\w./*-]*/,
    porque: "nombra un fichero de src/ o de test/: es anatomía, y ya la cuentan el código y las pruebas",
  },
  {
    patron: /\b(?!index\.ts\b)[A-Za-z]\w*\.(ts|mjs)\b/,
    porque: "nombra un fichero de código: es anatomía, y ya la cuentan el código y las pruebas",
  },
  FECHA,
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

const REGLAS_CLAUDE = [
  FECHA,
  {
    patron: /\b\d[\d.]*\s+pruebas\b/i,
    porque: "cuenta las pruebas: se queda viejo en el siguiente commit, y lo dice npm test",
  },
]

const DOCUMENTOS = [
  { fichero: FICHERO, tope: 800, reglas: REGLAS_ARQUITECTURA },
  { fichero: "CLAUDE.md", tope: 300, reglas: REGLAS_CLAUDE },
]

const leer = (fichero) => readFileSync(fichero, "utf8").split("\n")

const hallados = DOCUMENTOS.flatMap(({ fichero, tope, reglas }) => {
  const suyas = leer(fichero)
  const malas = suyas.flatMap((linea, i) =>
    reglas.flatMap((r) => (r.patron.test(linea) ? [`  ${fichero}:${i + 1}  ${r.porque}\n      ${linea.trim().slice(0, 100)}`] : [])),
  )
  return suyas.length > tope
    ? [...malas, `  ${fichero}: ${suyas.length} líneas, y el tope es ${tope}: si crece, que cueste y se piense`]
    : malas
})

const lineas = leer(FICHERO)
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
  console.error(`\n✗ ${fallos.length} problema(s) con ${FICHERO} o CLAUDE.md:\n`)
  console.error(fallos.join("\n"))
  console.error(
    [
      "",
      `  ${FICHERO} es el fundamento: lo que seguiría siendo verdad si mañana se`,
      "  reescribe esa parte del código. Cómo está hecho cada trozo lo cuentan el",
      "  código y las pruebas; cuándo y quién decidió, TAREAS.md y git log.",
      "  CLAUDE.md se carga en cada sesión: corto, y sin datos que caducan solos.",
      "",
    ].join("\n"),
  )
  process.exit(1)
}

console.log(
  `✓ ${FICHERO} (${lineas.length} líneas) y CLAUDE.md, sin lo que caduca, y ninguna sección señalada que no exista`,
)
