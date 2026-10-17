/**
 * Falla si una tarea abierta de `TAREAS.md` (`- [ ]`) no dice cómo se cierra.
 *
 * Una tarea va desde su casilla hasta la línea en blanco, el título o la entrada
 * siguiente, y en ese trozo tiene que estar «Se cierra»: qué prueba, guardián,
 * lista o decisión demuestra que está hecha.
 */
import { readFileSync } from "node:fs"

const FICHERO = "TAREAS.md"
const lineas = readFileSync(FICHERO, "utf8").split("\n")

const sangria = (linea) => /^\s*/.exec(linea)[0].length

const abiertas = []
for (let i = 0; i < lineas.length; i++) {
  const casilla = /^(\s*)- \[ \]/.exec(lineas[i])
  if (casilla === null) continue
  let texto = lineas[i]
  for (let j = i + 1; j < lineas.length; j++) {
    const l = lineas[j]
    const otraEntrada = /^\s*- /.test(l) && sangria(l) <= casilla[1].length
    if (l.trim() === "" || l.startsWith("#") || l.startsWith("|") || otraEntrada) break
    texto += ` ${l.trim()}`
  }
  abiertas.push({ linea: i + 1, texto })
}

const sinCierre = abiertas.filter((t) => !t.texto.includes("Se cierra"))

if (sinCierre.length > 0) {
  console.error(`\n✗ ${sinCierre.length} tarea(s) abierta(s) de ${FICHERO} sin «Se cierra cuando…»:\n`)
  for (const t of sinCierre) console.error(`  ${FICHERO}:${t.linea}  ${t.texto.trim().slice(0, 90)}`)
  console.error(
    [
      "",
      "  Sin decir qué lo demuestra, «hecho» es una opinión. Añade qué prueba o",
      "  guardián pasa, qué lista queda anotada o dónde se escribe la decisión.",
      "  Si no tiene cierre posible, es una idea: va a *Ideas aparcadas*.",
      "",
    ].join("\n"),
  )
  process.exit(1)
}

console.log(`✓ las ${abiertas.length} tareas abiertas de ${FICHERO} dicen cómo se cierran`)
