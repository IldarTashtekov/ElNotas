/**
 * Falla si una tarea abierta de `TAREAS.md` (`- [ ]`) no dice cómo se cierra, o si
 * lo terminado no ha salido de ahí a `TERMINADAS.md`.
 *
 * Una tarea va desde su casilla hasta la línea en blanco, el título o la entrada
 * siguiente, y en ese trozo tiene que estar «Se cierra». En `TAREAS.md` no puede
 * quedar una fase cerrada, ni una casilla marcada o un tachado fuera de la fase en
 * curso (la que lleva «EN CURSO» en el título). En `TERMINADAS.md`, cada fase cabe
 * en 20 líneas sin contar el título.
 */
import { readFileSync } from "node:fs"

const FICHERO = "TAREAS.md"
const TERMINADAS = "TERMINADAS.md"
const TOPE_FASE = 20
const lineas = readFileSync(FICHERO, "utf8").split("\n")

const sangria = (linea) => /^\s*/.exec(linea)[0].length
const nivel = (linea) => /^(#+) /.exec(linea)?.[1].length ?? 0

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

/* Lo terminado que sigue en TAREAS.md: fases cerradas, y casillas marcadas o tachados fuera de la fase en curso. */
const esFase = (linea) => /^#{2,4} (Fase|Versión)\b/.test(linea)
const cerrada = (linea) => esFase(linea) && /✅|CERRADA|TERMINADA/i.test(linea)

let enCurso = false
let nivelEnCurso = 0
const sobran = []
for (let i = 0; i < lineas.length; i++) {
  const l = lineas[i]
  const n = nivel(l)
  if (n > 0 && enCurso && n <= nivelEnCurso) enCurso = false
  if (n > 0 && /\bEN CURSO\b/.test(l)) {
    enCurso = true
    nivelEnCurso = n
  }
  if (cerrada(l)) sobran.push(`  ${FICHERO}:${i + 1}  una fase cerrada: su resumen va a ${TERMINADAS}\n      ${l.slice(0, 90)}`)
  if (enCurso) continue
  if (/^\s*- \[x\]/i.test(l)) sobran.push(`  ${FICHERO}:${i + 1}  una casilla marcada fuera de la fase en curso\n      ${l.trim().slice(0, 90)}`)
  if (l.includes("~~")) sobran.push(`  ${FICHERO}:${i + 1}  un tachado fuera de la fase en curso\n      ${l.trim().slice(0, 90)}`)
}

/* Las fases de TERMINADAS.md, resumidas: de su título al siguiente, sin las líneas en blanco del final. */
const terminadas = readFileSync(TERMINADAS, "utf8").split("\n")
for (let i = 0; i < terminadas.length; i++) {
  if (!/^### Fase\b/.test(terminadas[i])) continue
  let fin = i + 1
  while (fin < terminadas.length && nivel(terminadas[fin]) === 0 && terminadas[fin] !== "---") fin++
  while (fin > i + 1 && terminadas[fin - 1].trim() === "") fin--
  const largo = fin - i - 1
  if (largo > TOPE_FASE) {
    sobran.push(`  ${TERMINADAS}:${i + 1}  ${largo} líneas, y el tope es ${TOPE_FASE}\n      ${terminadas[i].slice(0, 90)}`)
  }
}

if (sobran.length > 0) {
  console.error(`\n✗ ${sobran.length} cosa(s) terminada(s) fuera de su sitio:\n`)
  console.error(sobran.join("\n"))
  console.error(
    [
      "",
      `  ${FICHERO} es lo que aún pide algo a alguien. Lo terminado va a ${TERMINADAS},`,
      "  entrada a entrada: una tarea suelta en una línea; una fase, resumida en 20",
      "  líneas como mucho, y lo que dejó sin hacer, a *Deuda de las fases cerradas*.",
      "",
    ].join("\n"),
  )
  process.exit(1)
}

console.log(
  `✓ las ${abiertas.length} tareas abiertas de ${FICHERO} dicen cómo se cierran, y lo terminado está en ${TERMINADAS}`,
)
