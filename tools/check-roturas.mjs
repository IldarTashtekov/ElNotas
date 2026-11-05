/**
 * Pasa las roturas a propósito de `roturas.mjs`: aplica cada una, lanza lo que
 * tiene que cazarla, exige que falle y deja el fichero como estaba.
 *
 * Las que cazan las pruebas no recompilan el proyecto: se compila una vez al
 * empezar, y en cada rotura sólo se traduce a JS el fichero roto y se pasa sólo
 * su fichero de pruebas (el espejo, o el que diga `pruebasEn`).
 *
 * Falla si una sobrevive (nada la caza), si caducó (su texto ya no está, o está
 * dos veces), si no se puede traducir o si no tiene fichero de pruebas.
 * `npm run check:roturas -- fósforo` pasa sólo las que lo lleven en el nombre.
 *
 * No toca el proyecto: rompe y compila en una copia, `tmp-roturas/<pid>/`, hecha
 * al empezar con lo que hay en el disco, versionado o nuevo (lo ignorado, no), y
 * borrada al acabar. Así puede correr a la vez que `npm run check` o que otra
 * pasada, y lo que se edite mientras tanto no se pisa.
 */
import { spawn, spawnSync } from "node:child_process"
import { copyFileSync, existsSync, lstatSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import ts from "typescript"
import { ROTURAS } from "./roturas.mjs"

const COPIA = resolve(`tmp-roturas/${process.pid}`)
const SALIDA = "tmp-test"

const git = (...args) => spawnSync("git", args, { encoding: "utf8" })
const lista = git("ls-files", "-z", "--cached", "--others", "--exclude-standard")
const gitDir = git("rev-parse", "--absolute-git-dir")
if (lista.status !== 0 || gitDir.status !== 0) {
  console.error(`✗ no se pudo preguntar a git qué copiar:\n${lista.stderr}${gitDir.stderr}`)
  process.exit(1)
}
/* Una copia por pasada: dos pasadas a la vez no se la pisan. Se borra al salir, también si se corta. */
process.on("exit", () => rmSync(COPIA, { recursive: true, force: true }))
for (const fichero of lista.stdout.split("\0")) {
  /* Lo borrado sin comitear sigue en el índice, y el sandbox tapa rutas con dispositivos: sólo ficheros. */
  if (fichero === "" || !existsSync(fichero) || !lstatSync(fichero).isFile()) continue
  mkdirSync(dirname(join(COPIA, fichero)), { recursive: true })
  copyFileSync(fichero, join(COPIA, fichero))
}
symlinkSync(resolve("node_modules"), join(COPIA, "node_modules"), "dir")
/* check:referencias pregunta a git qué está versionado: el del proyecto, con la copia como árbol y con
   una copia de su índice, para que nada de lo que se lance aquí refresque el de verdad. */
const indice = join(COPIA, ".indice-git")
copyFileSync(join(gitDir.stdout.trim(), "index"), indice)
process.env.GIT_DIR = gitDir.stdout.trim()
process.env.GIT_WORK_TREE = COPIA
process.env.GIT_INDEX_FILE = indice
process.chdir(COPIA)

/* Ctrl-C para la pasada entera, no sólo las pruebas en curso. Lo roto sólo estaba en la copia. */
let enCurso = null
for (const senal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.on(senal, () => {
    enCurso?.kill(senal)
    console.error(`\n✗ cortada: el proyecto no se ha tocado`)
    process.exit(130)
  })
}

const lanzar = (orden, args) =>
  new Promise((listo) => {
    let salida = ""
    enCurso = spawn(orden, args)
    enCurso.stdout.on("data", (trozo) => (salida += trozo))
    enCurso.stderr.on("data", (trozo) => (salida += trozo))
    enCurso.on("close", (codigo) => {
      enCurso = null
      listo({ ok: codigo === 0, salida })
    })
  })

const npm = (script) => lanzar("npm", ["run", script])
const pruebas = (ficheros) =>
  lanzar(process.execPath, ["--conditions=compiled", "--test", ...ficheros.map(compilado)])

/* Las opciones de tsconfig.test.json, para traducir un fichero igual que lo compila `npm test`. */
const config = ts.getParsedCommandLineOfConfigFile("tsconfig.test.json", {}, {
  ...ts.sys,
  onUnRecoverableConfigFileDiagnostic: (d) => {
    console.error(ts.flattenDiagnosticMessageText(d.messageText, "\n"))
    process.exit(1)
  },
})
const compilado = (fichero) => `${SALIDA}/${fichero.replace(/\.ts$/, ".js")}`
/** El JS de un fichero, sin mirar los tipos, o `null` si ni siquiera se puede leer como TypeScript. */
const traducir = (fichero, codigo) => {
  const r = ts.transpileModule(codigo, {
    compilerOptions: config.options,
    fileName: resolve(fichero),
    reportDiagnostics: true,
  })
  /* Los avisos sin fichero son de las opciones, no del código. */
  return r.diagnostics?.some((d) => d.file !== undefined) ? null : r.outputText
}

/** El fichero de pruebas de una rotura: el que diga `pruebasEn`, o el espejo del roto en test/. */
const ficherosDePruebas = ({ fichero, pruebasEn }) => {
  if (pruebasEn !== undefined) return [pruebasEn].flat()
  if (fichero.startsWith("test/")) return [fichero]
  const espejo = fichero.replace(/^src\//, "test/").replace(/\.ts$/, ".test.ts")
  return existsSync(espejo) ? [espejo] : []
}

const veces = (texto, trozo) => texto.split(trozo).length - 1

const filtro = process.argv[2]?.toLowerCase() ?? ""
const elegidas = ROTURAS.filter((r) => r.nombre.toLowerCase().includes(filtro))
if (elegidas.length === 0) {
  console.error(`✗ ninguna rotura lleva «${filtro}» en el nombre`)
  process.exit(1)
}

/* Con la base en rojo, cualquier rotura «caería»: no probaría nada. `npm test` deja compilado tmp-test/. */
const cazadores = new Set(elegidas.map((r) => r.caza))
/* dist/ no se copia, y build:pages arma lo publicado a partir de dist/web/. */
if (cazadores.has("build:pages") && !(await npm("build:web")).ok) {
  console.error("✗ la copia no compila con `npm run build:web`")
  process.exit(1)
}
for (const caza of cazadores) {
  if (!(await npm(caza === "pruebas" ? "test" : caza)).ok) {
    console.error(`✗ la base no pasa \`npm run ${caza === "pruebas" ? "test" : caza}\`: arréglala antes de romper nada`)
    process.exit(1)
  }
}

const fallos = []
for (const rotura of elegidas) {
  const { nombre, fichero, buscar, poner, caza, prueba } = rotura
  const original = readFileSync(fichero, "utf8")
  const n = veces(original, buscar)
  if (n !== 1) {
    fallos.push(`caducada (${n === 0 ? "su texto ya no está" : `su texto está ${n} veces`}): ${nombre}`)
    console.log(`✗ caducada  ${nombre}`)
    continue
  }
  const enPruebas = caza === "pruebas" ? ficherosDePruebas(rotura) : []
  if (caza === "pruebas" && enPruebas.length === 0) {
    fallos.push(`sin fichero de pruebas: no tiene espejo en test/; apunta \`pruebasEn\`: ${nombre}`)
    console.log(`✗ sin pruebas ${nombre}`)
    continue
  }

  const roto = original.replace(buscar, poner)
  writeFileSync(fichero, roto)
  let r
  if (caza === "pruebas") {
    const js = traducir(fichero, roto)
    if (js === null) {
      writeFileSync(fichero, original)
      fallos.push(`no compila: no se puede traducir a JS: ${nombre}`)
      console.log(`✗ no compila ${nombre}`)
      continue
    }
    const jsOriginal = readFileSync(compilado(fichero), "utf8")
    writeFileSync(compilado(fichero), js)
    r = await pruebas(enPruebas)
    writeFileSync(compilado(fichero), jsOriginal)
  } else {
    r = await npm(caza)
  }
  writeFileSync(fichero, original)

  if (r.ok) {
    fallos.push(`SOBREVIVE, nada la caza: ${nombre}`)
    console.log(`✗ SOBREVIVE ${nombre}`)
  } else if (caza === "pruebas" && !/^ℹ fail [1-9]/m.test(r.salida)) {
    fallos.push(`no corren las pruebas (¿falla al cargar?): ${nombre}`)
    console.log(`✗ no corren ${nombre}`)
  } else if (prueba !== undefined && !r.salida.includes(`✖ ${prueba}`)) {
    fallos.push(`cae otra prueba, no «${prueba}»: ${nombre}`)
    console.log(`✗ otra      ${nombre}`)
  } else {
    const caidas = [
      ...new Set((r.salida.match(/^✖ (?!failing tests).*$/gm) ?? []).map((c) => c.replace(/ \([\d.]+ms\)$/, ""))),
    ]
    const vistas = caidas.slice(0, 3).map((c) => `\n             ${c}`).join("")
    const mas = caidas.length > 3 ? `\n             … y ${caidas.length - 3} más` : ""
    console.log(`✓ cazada    ${nombre}${vistas}${mas}`)
  }
}

if (fallos.length > 0) {
  console.error(`\n✗ ${fallos.length} de ${elegidas.length} rotura(s) no se comportan como deben:\n`)
  for (const f of fallos) console.error(`  ${f}`)
  console.error(
    [
      "",
      "  Una que sobrevive es una guarda que ya no vigila ninguna prueba: escribe",
      "  la prueba (o, si la caza otro fichero que el espejo, apúntalo en",
      "  `pruebasEn`). Una caducada es código que cambió: pon al día la rotura en",
      "  tools/roturas.mjs, y mira si su prueba sigue sirviendo.",
      "",
    ].join("\n"),
  )
  process.exit(1)
}

console.log(`\n✓ las ${elegidas.length} roturas a propósito caen`)
