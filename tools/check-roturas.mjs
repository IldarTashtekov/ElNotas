/**
 * Pasa las roturas a propósito de `roturas.mjs`: aplica cada una, lanza lo que
 * tiene que cazarla, exige que falle y deja el fichero como estaba.
 *
 * Falla si una sobrevive (nada la caza), si caducó (su texto ya no está, o está
 * dos veces) o si no compila cuando la tienen que cazar las pruebas. Lo roto se
 * apunta en `.rotura-en-curso.json`: si se corta a medias, la siguiente pasada
 * lo restaura antes de nada. `npm run check:roturas -- fósforo` pasa sólo las
 * que lo lleven en el nombre.
 */
import { spawn } from "node:child_process"
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { ROTURAS } from "./roturas.mjs"

const DIARIO = ".rotura-en-curso.json"

const restaurar = () => {
  if (!existsSync(DIARIO)) return null
  const { fichero, original } = JSON.parse(readFileSync(DIARIO, "utf8"))
  writeFileSync(fichero, original)
  rmSync(DIARIO)
  return fichero
}

const quedaba = restaurar()
if (quedaba !== null) console.warn(`⚠ ${quedaba} se quedó roto de una pasada cortada: restaurado.\n`)
/* Ctrl-C para la pasada entera, no sólo las pruebas en curso. */
let enCurso = null
process.on("exit", restaurar)
for (const senal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.on(senal, () => {
    enCurso?.kill(senal)
    restaurar()
    console.error(`\n✗ cortada: lo roto está restaurado`)
    process.exit(130)
  })
}

const lanzar = (caza) =>
  new Promise((listo) => {
    let salida = ""
    enCurso = spawn("npm", ["run", caza === "pruebas" ? "test" : caza])
    enCurso.stdout.on("data", (trozo) => (salida += trozo))
    enCurso.stderr.on("data", (trozo) => (salida += trozo))
    enCurso.on("close", (codigo) => {
      enCurso = null
      listo({ ok: codigo === 0, salida })
    })
  })

const veces = (texto, trozo) => texto.split(trozo).length - 1

const filtro = process.argv[2]?.toLowerCase() ?? ""
const elegidas = ROTURAS.filter((r) => r.nombre.toLowerCase().includes(filtro))
if (elegidas.length === 0) {
  console.error(`✗ ninguna rotura lleva «${filtro}» en el nombre`)
  process.exit(1)
}

/* Con la base en rojo, cualquier rotura «caería»: no probaría nada. */
for (const caza of new Set(elegidas.map((r) => r.caza))) {
  if (!(await lanzar(caza)).ok) {
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

  writeFileSync(DIARIO, JSON.stringify({ fichero, original }))
  writeFileSync(fichero, original.replace(buscar, poner))
  const r = await lanzar(caza)
  restaurar()

  if (r.ok) {
    fallos.push(`SOBREVIVE, nada la caza: ${nombre}`)
    console.log(`✗ SOBREVIVE ${nombre}`)
  } else if (caza === "pruebas" && !/^ℹ fail [1-9]/m.test(r.salida)) {
    fallos.push(`no compila: la caza el compilador, no las pruebas: ${nombre}`)
    console.log(`✗ no compila ${nombre}`)
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
      "  la prueba. Una caducada es código que cambió: pon al día la rotura en",
      "  tools/roturas.mjs, y mira si su prueba sigue sirviendo.",
      "",
    ].join("\n"),
  )
  process.exit(1)
}

console.log(`\n✓ las ${elegidas.length} roturas a propósito caen`)
