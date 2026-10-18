/**
 * Los hooks de Claude Code: lanzan los checks sin que el agente se acuerde.
 *
 * `editar` (tras cada Edit o Write): si el fichero es de `src/`, `test/` o
 * `tools/`, los tipos y los guardianes, sin las pruebas; si es un `.md`, el de
 * `ARCHITECTURE.md`, y si es `TAREAS.md`, también el suyo.
 * `terminar` (antes de dar el turno por acabado): si hay cambios sin comitear
 * en esas carpetas, `npm run check` entero; en rojo, no deja terminar, pero
 * sólo una vez seguida.
 * `comitear` (antes de cada orden de Bash): bloquea un `git commit` en `main`,
 * o en la misma orden que cambia a `main`.
 * Un fallo sale con código 2 y el error en stderr, que es lo que lee el agente.
 */
import { spawnSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { relative, resolve } from "node:path"

const CARPETAS = ["src/", "test/", "tools/"]
const RAPIDOS = [
  "typecheck",
  "typecheck:core",
  "check:purity",
  "check:fronteras",
  "check:extensiones",
  "check:descartes",
  "check:paragrafos",
  "check:exportaciones",
]
const LINEAS = 60

const raiz = process.cwd()
const entrada = (() => {
  try {
    return JSON.parse(readFileSync(0, "utf8"))
  } catch {
    return {}
  }
})()

const vigilado = (camino) => CARPETAS.some((c) => camino.startsWith(c))

const lanzar = (script) => {
  const r = spawnSync("npm", ["run", script], { cwd: raiz, encoding: "utf8" })
  return { ok: r.status === 0, salida: `${r.stdout ?? ""}${r.stderr ?? ""}${r.error?.message ?? ""}` }
}

const fallar = (titulo, salida) => {
  const cola = salida.trimEnd().split("\n").slice(-LINEAS).join("\n")
  process.stderr.write(`${titulo}\n\n${cola}\n`)
  process.exit(2)
}

const editar = () => {
  const fichero = entrada.tool_input?.file_path
  if (typeof fichero !== "string") return
  const camino = relative(raiz, resolve(raiz, fichero)).split("\\").join("/")
  /* Los documentos tienen sus propios guardianes, y basta con ésos. */
  const scripts =
    camino === "TAREAS.md"
      ? ["check:tareas", "check:arquitectura"]
      : camino.endsWith(".md")
        ? ["check:arquitectura"]
        : vigilado(camino)
          ? RAPIDOS
          : []
  for (const script of scripts) {
    const r = lanzar(script)
    if (!r.ok) fallar(`Hook tras editar ${camino}: falla \`npm run ${script}\`.`, r.salida)
  }
}

const terminar = () => {
  if (entrada.stop_hook_active === true) return
  const estado = spawnSync("git", ["status", "--porcelain", "--", ...CARPETAS], { cwd: raiz, encoding: "utf8" })
  if (estado.status !== 0 || estado.stdout.trim() === "") return
  const r = lanzar("check")
  if (!r.ok) {
    fallar(
      "Hook al terminar: `npm run check` está en rojo con cambios sin comitear en src/, test/ o tools/. " +
        "Arréglalo; si de verdad hay que parar así, al volver a terminar se deja pasar, y se le dice al usuario.",
      r.salida,
    )
  }
}

/* Mira el texto de la orden: un patrón de permisos no distingue la rama. */
const comitear = () => {
  const orden = entrada.tool_input?.command
  if (typeof orden !== "string" || !/\bgit\b[^;&|\n]*\bcommit\b/.test(orden)) return
  const rama = spawnSync("git", ["branch", "--show-current"], { cwd: raiz, encoding: "utf8" })
  const enMain = rama.status === 0 && rama.stdout.trim() === "main"
  const vaAMain = /\bgit\s+(switch|checkout)\s+main\b/.test(orden)
  if (enMain || vaAMain) {
    fallar(
      "Hook antes de Bash: no se comitea en `main`. Comitea en la rama del bloque; juntar con `main` es del usuario.",
      "",
    )
  }
}

const modo = process.argv[2]
if (modo === "editar") editar()
else if (modo === "terminar") terminar()
else if (modo === "comitear") comitear()
else fallar(`checks.mjs: modo desconocido «${modo}»; se espera «editar», «terminar» o «comitear».`, "")
