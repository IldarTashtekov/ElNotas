/**
 * Falla si una llamada a algo que LANZA puede llegar a escaparse por una firma
 * que promete `Result` (`ARCHITECTURE.md` §6.5, principio 2).
 *
 * ── Por qué existe, y por qué no vale con vigilar `throw` ──────────────────
 *
 * En este repo **no hay ni un `throw`**, y aun así se encontraron dos sitios por
 * los que se escapaba una excepción: `encodeURIComponent` dentro de `caminoDe`
 * —lanza con un surrogate suelto— y `paso.migrate()` en el runner de
 * migraciones, que es código ajeno. Un guardián que buscara `throw` habría dado
 * verde con los dos ahí. El peligro no es lo que lanzamos nosotros: es **lo que
 * llamamos sin envolver**.
 *
 * ── Qué cuenta como cubierto, y por qué hacen falta las tres formas ────────
 *
 *   1. dentro del bloque `try` de un `try/catch`;
 *   2. dentro de una función que se le pasa a un envoltorio que ya tiene el
 *      `try` dentro — `frontera(...)` y `transaction(...)`;
 *   3. **transitivamente**: dentro de un ayudante local cuyas llamadas están
 *      todas cubiertas.
 *
 * La 3 no es un lujo. En `LocalStorageBlobStore`, `atob` vive dentro de
 * `deBase64`, que no tiene `try` ninguno: lo protege quien lo llama. Sin la
 * regla 3, este guardián marcaría seis ayudantes correctos y sería ruido.
 *
 * Y es justo esa forma de estar a salvo —depender del sitio de llamada— la que
 * falló en `caminoDe`: idéntico a los otros seis, pero llamado desde `get`,
 * `put` y `delete`, que no son frontera de nada. **Eso es lo que esto vigila.**
 *
 * ── Dos límites, dichos en voz alta ────────────────────────────────────────
 *
 * - **Sólo mira dentro de cada fichero.** Un ayudante exportado se da por NO
 *   cubierto, porque sus llamadas pueden estar en cualquier parte. Hoy los seis
 *   son locales, así que no hay falsos positivos; el día que uno se exporte,
 *   esto se queja, y quejarse es lo correcto.
 * - **La lista de lo peligroso se mantiene a mano.** No hay forma de saber por
 *   el tipo si algo lanza: TypeScript no tiene `throws`. Si añades una API de
 *   plataforma, añádela abajo.
 *
 * Recorre el AST y no el texto, al revés que `check-core-purity.mjs`: aquél
 * tuvo que borrar comentarios y cadenas porque los suyos mencionan `Date.now()`
 * a propósito. Un AST no lleva comentarios dentro, y además lo que hay que
 * reconocer aquí —"¿esta llamada está dentro de un try?"— es una forma de
 * árbol, no de texto. `typescript` ya está instalado: cero dependencias nuevas.
 */
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import ts from "typescript"

const DIRECTORIOS = ["src/core", "src/storage"]

/** Lo que puede lanzar. Se mantiene a mano: el tipo no lo dice. */
const PELIGROSAS = [
  [/^JSON\.parse$/, "JSON inválido → SyntaxError"],
  [/^JSON\.stringify$/, "ciclos o BigInt → TypeError"],
  [/^encodeURIComponent$/, "surrogate suelto → URIError"],
  [/^decodeURIComponent$/, "escape inválido → URIError"],
  [/^atob$/, "base64 inválido"],
  [/^btoa$/, "carácter fuera de latin1"],
  [/^String\.fromCharCode$/, "spread grande → RangeError"],
  [/\.decode$/, "TextDecoder con fatal → TypeError"],
  [/^almacen\.(getItem|setItem|removeItem|key)$/, "localStorage → Security/Quota"],
  [
    /\.(getFileHandle|getDirectoryHandle|removeEntry|getFile|createWritable)$/,
    "File System Access API",
  ],
  [/\.arrayBuffer$/, "lectura del File"],
  [/^flujo\.(write|close)$/, "escritura del fichero"],
  [/^paso\.migrate$/, "CÓDIGO AJENO: la migración"],
]

/** Envoltorios que llevan el `try` dentro: cubren la función que reciben. */
const ENVOLTORIOS = new Set(["frontera", "transaction"])

const ficherosTs = (dir, acc = []) => {
  for (const entrada of readdirSync(dir)) {
    const camino = join(dir, entrada)
    if (statSync(camino).isDirectory()) ficherosTs(camino, acc)
    else if (camino.endsWith(".ts")) acc.push(camino)
  }
  return acc
}

const esPeligrosa = (nombre) => PELIGROSAS.find(([patron]) => patron.test(nombre))

/** Cobertura directa: reglas 1 y 2. `null` si no la tiene. */
const cubiertaDirecta = (n) => {
  let hijo = n
  let p = n.parent
  while (p !== undefined) {
    if (ts.isTryStatement(p) && p.tryBlock === hijo) return "try"
    if (
      (ts.isArrowFunction(p) || ts.isFunctionExpression(p)) &&
      p.parent !== undefined &&
      ts.isCallExpression(p.parent) &&
      p.parent.arguments.includes(p)
    ) {
      const envoltorio = p.parent.expression.getText().split(".").pop()
      if (ENVOLTORIOS.has(envoltorio)) return envoltorio
    }
    hijo = p
    p = p.parent
  }
  return null
}

/**
 * El ayudante local que contiene a este nodo, si lo hay.
 *
 * Un ayudante es `const nombre = (…) => …` o `function nombre(…)` **a nivel de
 * módulo**. Un método de un objeto literal —el `get:` de un repositorio— NO lo
 * es: ahí es donde empieza la API pública, y una llamada suelta ahí es fuga.
 */
const ayudanteQueLoContiene = (n, sf) => {
  let p = n.parent
  while (p !== undefined) {
    if (ts.isFunctionDeclaration(p) && p.name !== undefined && p.parent === sf) {
      return { nombre: p.name.getText(sf), exportado: esExportado(p) }
    }
    if (ts.isArrowFunction(p) || ts.isFunctionExpression(p)) {
      const decl = p.parent
      if (
        decl !== undefined &&
        ts.isVariableDeclaration(decl) &&
        ts.isIdentifier(decl.name) &&
        decl.parent?.parent?.parent === sf
      ) {
        return {
          nombre: decl.name.getText(sf),
          exportado: esExportado(decl.parent.parent),
        }
      }
    }
    p = p.parent
  }
  return null
}

const esExportado = (n) =>
  n.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) === true

const infracciones = []

for (const fichero of DIRECTORIOS.flatMap((d) => ficherosTs(d))) {
  const sf = ts.createSourceFile(
    fichero,
    readFileSync(fichero, "utf8"),
    ts.ScriptTarget.ES2020,
    true,
  )

  /* Primera pasada: toda llamada interesante, con dónde está y si está tapada. */
  const llamadas = []
  const visitar = (n) => {
    if (ts.isCallExpression(n)) {
      const nombre = n.expression.getText(sf)
      const peligro = esPeligrosa(nombre)
      llamadas.push({
        nodo: n,
        nombre,
        motivo: peligro?.[1] ?? null,
        cubierta: cubiertaDirecta(n),
        dentroDe: ayudanteQueLoContiene(n, sf),
      })
    }
    ts.forEachChild(n, visitar)
  }
  visitar(sf)

  /*
      ── Qué contextos "se escapan" ───────────────────────────────────────────

      Un contexto se escapa si lo que salga de él puede llegar hasta una firma
      pública. Son tres casos, y el tercero es el punto fijo:

        - `null` —no estar dentro de ningún ayudante— se escapa siempre: eso ya
          ES la API pública, el `get:` de un repositorio;
        - un ayudante EXPORTADO se escapa: sus llamadas pueden venir de otro
          fichero y desde aquí no se ven. Conservador a propósito;
        - un ayudante se escapa si alguna de sus llamadas está sin tapar Y está
          en un contexto que ya se escapa.

      Al revés: un ayudante local al que sólo se llama desde dentro de fronteras
      NO se escapa, y por eso `deBase64` y los otros cinco no dan falso positivo.

      Termina porque el conjunto sólo crece y hay finitos ayudantes.
  */
  const seEscapa = new Set(
    llamadas.filter((ll) => ll.dentroDe?.exportado === true).map((ll) => ll.dentroDe.nombre),
  )
  let cambió = true
  while (cambió) {
    cambió = false
    for (const ll of llamadas) {
      const contextoSeEscapa = ll.dentroDe === null || seEscapa.has(ll.dentroDe.nombre)
      if (ll.cubierta === null && contextoSeEscapa && !seEscapa.has(ll.nombre)) {
        // `ll.nombre` puede no ser un ayudante de este fichero; da igual,
        // apuntarlo no hace daño y ahorra un índice aparte.
        seEscapa.add(ll.nombre)
        cambió = true
      }
    }
  }

  /*
      Y se informa de la CAUSA RAÍZ, en su propia línea: la llamada peligrosa
      sin tapar cuyo contexto se escapa. Informar del sitio por donde sale
      —tres líneas más abajo, en una factoría— era correcto y no servía para
      arreglarlo.
  */
  for (const ll of llamadas) {
    if (ll.motivo === null || ll.cubierta !== null) continue
    const contextoSeEscapa = ll.dentroDe === null || seEscapa.has(ll.dentroDe.nombre)
    if (!contextoSeEscapa) continue

    const { line } = sf.getLineAndCharacterOfPosition(ll.nodo.getStart(sf))
    infracciones.push({
      fichero,
      linea: line + 1,
      llamada: ll.nombre,
      motivo: ll.motivo,
      dentroDe: ll.dentroDe?.nombre ?? null,
    })
  }
}

if (infracciones.length > 0) {
  console.error(`\n✗ ${infracciones.length} excepción(es) pueden escaparse:\n`)
  for (const { fichero, linea, llamada, motivo, dentroDe } of infracciones) {
    const sitio = dentroDe === null ? "" : `  (en ${dentroDe})`
    console.error(`  ${fichero}:${linea}  ${llamada}()${sitio}\n      ${motivo}`)
  }
  console.error(
    [
      "",
      "  Los errores se DEVUELVEN, no se lanzan: lo que pueda fallar devuelve",
      "  Result<T, StorageError> y ninguna firma lanza. El try/catch no",
      "  desaparece, se CONFINA a la función frontera que habla con lo que",
      "  lanza, y ésta la traduce a err(...).",
      "",
      "  Mételo en un try, pásalo por frontera()/transaction(), o llámalo desde",
      "  un ayudante que ya esté cubierto. ARCHITECTURE.md §6.5.",
      "",
    ].join("\n"),
  )
  process.exit(1)
}

console.log("✓ ninguna excepción se escapa de su frontera")
