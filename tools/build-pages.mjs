/**
 * Arma dist/pages/, la carpeta que se publica en GitHub Pages: sólo lo que el
 * navegador carga, con las mismas rutas que en el repo. Va después de
 * `npm run build:web`, con `npm run build:pages`.
 *
 * Calcula la huella del contenido, escribe sw.js a partir de pwa/sw.js y añade al
 * index.html copiado la versión y el registro del service worker: en desarrollo
 * no hay service worker, porque el index.html del repo no lo registra.
 * Se niega a terminar si index.html o el manifiesto piden algo con ruta absoluta
 * o algo que no se publica: es el fallo que sólo se notaría en el móvil.
 */
import { createHash } from "node:crypto"
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs"
import { dirname, join, posix, sep } from "node:path"

const DESTINO = "dist/pages"

/** Lo que se publica, con su ruta del repo: ficheros sueltos y carpetas enteras. */
const FICHEROS = [
  "index.html",
  "manifest.webmanifest",
  "assets/icono/icono-192.png",
  "assets/icono/icono-512.png",
]
const CARPETAS = ["dist/web", "src/ui/styles"]

/** El service worker, que no se copia tal cual: se le pone delante la huella y la lista. */
const SERVICE_WORKER = "pwa/sw.js"

/** Una ruta que no es relativa: empieza por «/» o lleva esquema («https:», «data:»…). */
const ABSOLUTA = /^(?:\/|[a-z][a-z0-9+.-]*:)/i

function fallar([primera, ...resto]) {
  console.error(["", `✗ ${primera}`, ...resto, ""].join("\n"))
  process.exit(1)
}

if (!existsSync("dist/web")) {
  fallar(["No existe dist/web/: antes hay que lanzar `npm run build:web`."])
}

/** Los ficheros de una carpeta, a cualquier profundidad, con «/» como separador. */
function ficherosDe(carpeta) {
  return readdirSync(carpeta, { recursive: true, encoding: "utf8" })
    .map((ruta) => posix.join(carpeta, ruta.split(sep).join("/")))
    .filter((ruta) => statSync(ruta).isFile())
}

const publicados = [...FICHEROS, ...CARPETAS.flatMap(ficherosDe)].sort()
const sePublica = new Set(publicados)

// Lo que piden index.html —sus href y src, y el importmap— y el manifiesto, sus
// iconos. Los dos están en la raíz, así que sus rutas se leen desde ahí.
const indexHtml = readFileSync("index.html", "utf8")
const delHtml = [...indexHtml.matchAll(/\b(?:href|src)="([^"]*)"/g)].map((m) => m[1])
const mapa = indexHtml.match(/<script type="importmap">([\s\S]*?)<\/script>/)
const delMapa = mapa === null ? [] : Object.values(JSON.parse(mapa[1]).imports)
const manifiesto = JSON.parse(readFileSync("manifest.webmanifest", "utf8"))
const delManifiesto = manifiesto.icons.map((icono) => icono.src)

const absolutas = []
const ausentes = []
for (const ruta of [...delHtml, ...delMapa, ...delManifiesto]) {
  if (ABSOLUTA.test(ruta)) absolutas.push(ruta)
  else if (!sePublica.has(posix.normalize(ruta))) ausentes.push(ruta)
}
if (absolutas.length > 0) {
  fallar([
    "Rutas absolutas en index.html o en el manifiesto. GitHub Pages sirve la app",
    "  en una subcarpeta, y desde ahí no se encuentran. Tienen que empezar por «./»:",
    ...absolutas.map((ruta) => `    ${ruta}`),
  ])
}
if (ausentes.length > 0) {
  fallar([
    "index.html o el manifiesto piden ficheros que no se publican:",
    ...ausentes.map((ruta) => `    ${ruta}`),
    "  O no existen, o falta añadirlos a FICHEROS o CARPETAS en tools/build-pages.mjs.",
  ])
}

// La huella: cambia un byte de cualquier fichero, o cambia uno de nombre, y cambia.
const hash = createHash("sha256")
for (const ruta of [...publicados, SERVICE_WORKER]) {
  hash.update(ruta)
  hash.update("\0")
  hash.update(readFileSync(ruta))
}
const huella = hash.digest("hex").slice(0, 8)
const version = `${new Date().toISOString().slice(0, 10)} · ${huella}`

rmSync(DESTINO, { recursive: true, force: true })
for (const ruta of publicados) {
  mkdirSync(dirname(join(DESTINO, ruta)), { recursive: true })
  copyFileSync(ruta, join(DESTINO, ruta))
}

const cabecera = [
  `const HUELLA = ${JSON.stringify(huella)}`,
  `const FICHEROS = ${JSON.stringify(publicados, null, 2)}`,
].join("\n")
writeFileSync(join(DESTINO, "sw.js"), `${cabecera}\n\n${readFileSync(SERVICE_WORKER, "utf8")}`)

// La versión y el registro, sólo en la copia: el index.html del repo no los lleva.
if (indexHtml.split("</head>").length !== 2) {
  fallar(["index.html tiene que tener exactamente un </head>, para escribir la versión."])
}
const añadido = [
  `  <meta name="elnotas-version" content="${version}" />`,
  `    <script>`,
  `      if ("serviceWorker" in navigator) {`,
  `        navigator.serviceWorker.register("./sw.js").catch((error) => {`,
  `          console.error("No se pudo registrar el service worker:", error)`,
  `        })`,
  `      }`,
  `    </script>`,
  `  </head>`,
].join("\n")
writeFileSync(join(DESTINO, "index.html"), indexHtml.replace("</head>", añadido))

console.log(`✓ ${DESTINO}/: ${publicados.length} ficheros, versión ${version}`)
