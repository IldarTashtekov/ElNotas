/**
 * Falla si en `src/` se descarta un `Result` o una promesa sin mirarlos.
 *
 * Cuenta como mirado: esperarlo y comprobarlo, devolverlo o guardarlo en una
 * variable; una promesa que nadie espera, si termina en `.catch(…)` y no lleva un
 * `Result` dentro. `void` no tapa nada. Tampoco vale pasar una función que
 * devuelve uno de los dos donde se espera una que no devuelve nada.
 * Lee los tipos con el analizador de TypeScript, sobre `tsconfig.json`.
 */
import ts from "typescript"

const raiz = process.cwd()
const config = ts.getParsedCommandLineOfConfigFile("tsconfig.json", {}, {
  ...ts.sys,
  onUnRecoverableConfigFileDiagnostic: (d) => {
    console.error(ts.flattenDiagnosticMessageText(d.messageText, "\n"))
    process.exit(1)
  },
})
const programa = ts.createProgram(config.fileNames, config.options)
const tipos = programa.getTypeChecker()

const esPromesa = (t) => {
  if (t.isUnion()) return t.types.some(esPromesa)
  const then = t.getProperty("then")
  return then !== undefined && tipos.getTypeOfSymbol(then).getCallSignatures().length > 0
}

/** Un `Result` es lo que tiene `ok` y, además, `value` o `error`. */
const llevaResult = (t) => {
  if (t.isUnion()) return t.types.some(llevaResult)
  return t.getProperty("ok") !== undefined &&
    (t.getProperty("value") !== undefined || t.getProperty("error") !== undefined)
}

const peligroso = (t) => esPromesa(t) || llevaResult(t)

const quePasa = (t) => (llevaResult(t) ? "un Result" : "una promesa")

/** Lo que vuelve de la promesa, una vez resuelta. */
const resuelto = (t) => tipos.getAwaitedType(t) ?? t

const sinParentesis = (n) => (ts.isParenthesizedExpression(n) ? sinParentesis(n.expression) : n)

const acabaEnCatch = (n) =>
  ts.isCallExpression(n) &&
  ts.isPropertyAccessExpression(n.expression) &&
  n.expression.name.text === "catch"

const esAsignacion = (n) =>
  ts.isBinaryExpression(n) &&
  n.operatorToken.kind >= ts.SyntaxKind.FirstAssignment &&
  n.operatorToken.kind <= ts.SyntaxKind.LastAssignment

/** ¿Se espera aquí una función que no devuelve nada? */
const esperaVoid = (n) => {
  const contexto = tipos.getContextualType(n)
  const firmas = contexto?.getCallSignatures() ?? []
  return firmas.length > 0 &&
    firmas.every((f) => (tipos.getReturnTypeOfSignature(f).flags & ts.TypeFlags.Void) !== 0)
}

const esFuncion = (n) => ts.isArrowFunction(n) || ts.isFunctionExpression(n)

/** Una función ya hecha pasada por su nombre: `boton("x", app.flush)`. */
const esReferenciaPasada = (n) =>
  (ts.isIdentifier(n) || ts.isPropertyAccessExpression(n)) &&
  n.parent !== undefined &&
  ts.isCallExpression(n.parent) &&
  n.parent.arguments.includes(n)

/** Lo que devuelve la función que es `n`, si lo es; si no, null. */
const devuelve = (n) => {
  const firmas = tipos.getTypeAtLocation(n).getCallSignatures()
  return firmas.length === 0 ? null : tipos.getReturnTypeOfSignature(firmas[0])
}

const infracciones = []

for (const sf of programa.getSourceFiles()) {
  if (sf.isDeclarationFile || !sf.fileName.startsWith(`${raiz}/src/`)) continue
  const fichero = sf.fileName.slice(raiz.length + 1)
  const apuntar = (nodo, que) => {
    const { line } = sf.getLineAndCharacterOfPosition(nodo.getStart(sf))
    infracciones.push({ fichero, linea: line + 1, codigo: nodo.getText(sf).split("\n")[0].slice(0, 70), que })
  }

  const visitar = (n) => {
    if (ts.isVoidExpression(n)) {
      const t = tipos.getTypeAtLocation(n.expression)
      if (peligroso(t)) apuntar(n, `\`void\` tira ${quePasa(t)}`)
    } else if (ts.isExpressionStatement(n)) {
      const e = sinParentesis(n.expression)
      if (!ts.isVoidExpression(e) && !esAsignacion(e)) {
        const t = tipos.getTypeAtLocation(e)
        if (ts.isAwaitExpression(e)) {
          if (llevaResult(t)) apuntar(e, "se espera, pero el Result se tira")
        } else if (llevaResult(t)) {
          apuntar(e, "el Result se tira")
        } else if (esPromesa(t)) {
          if (!acabaEnCatch(e)) apuntar(e, "la promesa se suelta sin `.catch(…)`")
          else if (llevaResult(resuelto(t))) apuntar(e, "el `.catch(…)` no mira el Result que trae")
        }
      }
    } else if ((esFuncion(n) || esReferenciaPasada(n)) && esperaVoid(n)) {
      const r = devuelve(n)
      if (r !== null && peligroso(r)) apuntar(n, `devuelve ${quePasa(r)} donde se espera que no devuelva nada`)
    }
    ts.forEachChild(n, visitar)
  }
  visitar(sf)
}

if (infracciones.length > 0) {
  console.error(`\n✗ ${infracciones.length} Result(s) o promesa(s) se descartan sin mirarlos:\n`)
  for (const { fichero, linea, codigo, que } of infracciones) {
    console.error(`  ${fichero}:${linea}  ${que}\n      ${codigo}`)
  }
  console.error(
    [
      "",
      "  Un fallo que nadie mira se pierde. Espera y comprueba el Result,",
      "  devuélvelo, o al menos regístralo con el Logger (#core/index); una",
      "  promesa que no se espera termina en .catch(…).",
      "",
    ].join("\n"),
  )
  process.exit(1)
}

console.log("✓ ningún Result ni promesa se descarta sin mirarlo")
