/**
 * Falla si un documento vigente nombra lo que no está: entre comillas de código,
 * un fichero o una carpeta del repo; en cualquier sitio, una orden `npm run …`
 * que no está en `package.json` o un alias `#…/` que no está en sus `imports`.
 *
 * Mira `CLAUDE.md`, `ARCHITECTURE.md`, `README.md` y los `.md` versionados de
 * `test/` y de `.claude/`. No `TAREAS.md` ni `TERMINADAS.md`, que nombran a
 * propósito lo que aún no existe o ya no existe.
 */
import { spawnSync } from "node:child_process"
import { readFileSync } from "node:fs"

const git = (...args) => spawnSync("git", args, { encoding: "utf8" })

const lista = git("ls-files")
if (lista.status !== 0) {
  console.error(`check:referencias: no se pudo listar lo versionado.\n${lista.stderr}`)
  process.exit(1)
}
/* Sólo lo versionado: lo que hay en el disco y no en git no cuenta como que existe. */
const versionados = lista.stdout.split("\n").filter((f) => f !== "")
const carpetas = new Set(
  versionados.flatMap((f) => {
    const partes = f.split("/").slice(0, -1)
    return partes.map((_, i) => `${partes.slice(0, i + 1).join("/")}/`)
  }),
)

const paquete = JSON.parse(readFileSync("package.json", "utf8"))
const scripts = new Set(Object.keys(paquete.scripts ?? {}))
const alias = new Set(Object.keys(paquete.imports ?? {}).map((a) => a.replace(/\/\*$/, "")))

const RAIZ = ["CLAUDE.md", "ARCHITECTURE.md", "README.md"]
const documentos = versionados.filter(
  (f) => RAIZ.includes(f) || (/^(test|\.claude)\//.test(f) && f.endsWith(".md")),
)

/* De código, no de datos: un `.json` suelto suele ser del almacén o de la copia, no del repo. */
const CODIGO = /[\w-]\.(ts|js|mjs|md|html|css|webmanifest|yml|sh)$/
/* Lo que no es una ruta del repo: órdenes, patrones, sitios, claves, rutas de fuera. */
const NO_ES_RUTA = /[\s<>*(){}[\]:=,"'|$~\\@…]|^(#|\/|-|https?\b)/
const PRIMER_NIVEL = new Set(versionados.filter((f) => f.includes("/")).map((f) => f.split("/")[0]))

/* Con `/`, si empieza por una carpeta del repo o es de código (`notes/` es del almacén); sin `/`, si es de código. */
const pareceRuta = (texto) =>
  !NO_ES_RUTA.test(texto) &&
  (texto.includes("/") ? PRIMER_NIVEL.has(texto.replace(/^(\.\.?\/)+/, "").split("/")[0]) || CODIGO.test(texto) : CODIGO.test(texto))

const ignorado = (camino) => git("check-ignore", "-q", "--no-index", camino).status === 0

const existe = (cita) => {
  const limpia = cita.replace(/^(\.\.?\/)+/, "")
  /* Los imports se escriben con `.js` aunque el fuente sea `.ts`. */
  const candidatas = limpia.endsWith(".js") ? [limpia, limpia.replace(/\.js$/, ".ts")] : [limpia]
  return candidatas.some((c) => {
    const comoCarpeta = c.endsWith("/") ? c : `${c}/`
    return (
      versionados.includes(c) ||
      carpetas.has(comoCarpeta) ||
      versionados.some((f) => f.endsWith(`/${c}`)) ||
      [...carpetas].some((d) => d.endsWith(`/${comoCarpeta}`)) ||
      ignorado(c)
    )
  })
}

const hallados = documentos.flatMap((doc) => {
  let enBloque = false
  return readFileSync(doc, "utf8")
    .split("\n")
    .flatMap((linea, i) => {
      const donde = `  ${doc}:${i + 1}`
      if (/^\s*```/.test(linea)) {
        enBloque = !enBloque
        return []
      }
      const ordenes = [...linea.matchAll(/npm run ([\w:.-]+)/g)]
        .filter(([, s]) => !scripts.has(s))
        .map(([, s]) => `${donde}  la orden \`npm run ${s}\` no está en package.json`)
      const aliasMalos = [...linea.matchAll(/(?<![\w&])(#[a-z]+)\//g)]
        .filter(([, a]) => !alias.has(a))
        .map(([, a]) => `${donde}  el alias \`${a}/\` no está en los imports de package.json`)
      /* Las rutas, sólo entre comillas de código y fuera de los bloques: dentro hay ejemplos. */
      const rutas = enBloque
        ? []
        : [...linea.matchAll(/`([^`\n]+)`/g)]
            .map(([, t]) => t)
            .filter((t) => pareceRuta(t) && !existe(t))
            .map((t) => `${donde}  nombra \`${t}\`, que no está en el repo`)
      return [...ordenes, ...aliasMalos, ...rutas]
    })
})

if (hallados.length > 0) {
  console.error(
    `✗ los documentos nombran lo que no está (${hallados.length}):\n${hallados.join("\n")}\n\n` +
      "Corrige la referencia o, si ya no existe, quítala del documento.",
  )
  process.exit(1)
}
console.log(`✓ ${documentos.length} documentos, sin referencias a ficheros, órdenes o alias que no existan`)
