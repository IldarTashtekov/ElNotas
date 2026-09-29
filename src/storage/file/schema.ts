/**
 * La forma que tiene que tener lo que se lee del disco: una nota, un plan o un
 * contexto, campo a campo.
 *
 * Un fichero puede ser JSON válido y no ser una nota —lo ha tocado alguien, o lo
 * escribió una versión rota—. Aquí se dice qué le falta; quien lee lo trata como
 * un fichero ilegible. Los campos de más no molestan: se ignoran.
 */

/** `null` si tiene la forma; si no, qué le falta, para el aviso. */
export type Problem = string | null

type Registro = Record<string, unknown>

const esRegistro = (x: unknown): x is Registro =>
  typeof x === "object" && x !== null && !Array.isArray(x)

const esTexto = (x: unknown): x is string => typeof x === "string"

/** El primer problema de una lista de comprobaciones, o ninguno. */
const primero = (...comprobaciones: ReadonlyArray<() => Problem>): Problem => {
  for (const comprobar of comprobaciones) {
    const problema: Problem = comprobar()
    if (problema !== null) return problema
  }
  return null
}

const texto = (o: Registro, campo: string): Problem =>
  esTexto(o[campo]) ? null : `«${campo}» no es un texto`

const numero = (o: Registro, campo: string): Problem =>
  typeof o[campo] === "number" && Number.isFinite(o[campo]) ? null : `«${campo}» no es un número`

/** Comprueba cada elemento de una lista con `cada`, y se para en el primer problema. */
const cadaUno = (o: Registro, campo: string, cada: (x: unknown) => Problem): Problem => {
  const valores: unknown = o[campo]
  if (!Array.isArray(valores)) return `«${campo}» no es una lista`
  for (const valor of valores) {
    const problema: Problem = cada(valor)
    if (problema !== null) return problema
  }
  return null
}

/** Lo que llevan las tres entidades: id, nombre, cuándo y qué versión. */
const versionada = (o: Registro): Problem =>
  primero(
    (): Problem => texto(o, "id"),
    (): Problem => texto(o, "name"),
    (): Problem => numero(o, "updatedAt"),
    (): Problem => texto(o, "revision"),
  )

/* ───────────────────────────────── Notas ───────────────────────────────── */

/**
 * Una línea y, si es casilla, sus hijas. Los ids de una nota tienen que ser
 * únicos: con uno repetido, toda operación actuaría siempre sobre el primero.
 */
const linea = (x: unknown, anidada: boolean, vistos: Set<string>): Problem => {
  if (!esRegistro(x)) return "una línea no es un objeto"
  const id: unknown = x["id"]
  if (!esTexto(id)) return "«id» no es un texto"
  const propio: Problem = texto(x, "text")
  if (propio !== null) return propio
  if (vistos.has(id)) return `la línea «${id}» está repetida`
  /* Acumulador local de la validación: no es estado de nadie. */
  vistos.add(id)

  if (x["type"] === "text") {
    return anidada ? "hay un texto dentro de una casilla" : null
  }
  if (x["type"] !== "checkbox") return "una línea no es ni texto ni casilla"
  if (typeof x["checked"] !== "boolean") return "«checked» no es verdadero o falso"
  return cadaUno(x, "children", (hija: unknown): Problem => linea(hija, true, vistos))
}

export const noteProblem = (o: Registro): Problem => {
  const vistos: Set<string> = new Set<string>()
  return primero(
    (): Problem => versionada(o),
    (): Problem => cadaUno(o, "content", (l: unknown): Problem => linea(l, false, vistos)),
  )
}

/* ──────────────────────────────── Contextos ────────────────────────────── */

const referencia = (x: unknown): Problem =>
  esRegistro(x) && (x["kind"] === "note" || x["kind"] === "plan") && esTexto(x["id"])
    ? null
    : "una referencia no es a una nota ni a un plan"

const vistaPorDefecto = (x: unknown): Problem => {
  if (!esRegistro(x)) return "«defaultView» no es un objeto"
  if (x["type"] === "context") return null
  if ((x["type"] === "note" || x["type"] === "plan") && esTexto(x["id"])) return null
  return "«defaultView» no es una vista conocida"
}

export const contextProblem = (o: Registro): Problem =>
  primero(
    (): Problem => versionada(o),
    (): Problem => vistaPorDefecto(o["defaultView"]),
    (): Problem => cadaUno(o, "items", referencia),
  )

/* ───────────────────────────────── Planes ──────────────────────────────── */

const listaDeTextos = (o: Registro, campo: string): Problem =>
  cadaUno(o, campo, (x: unknown): Problem => (esTexto(x) ? null : `«${campo}» no es una lista de ids`))

const nodo = (x: unknown): Problem => {
  if (!esRegistro(x)) return "un nodo no es un objeto"
  const base: Problem = primero(
    (): Problem => texto(x, "id"),
    (): Problem => numero(x, "positionX"),
    (): Problem => numero(x, "positionY"),
    (): Problem => listaDeTextos(x, "parents"),
    (): Problem => listaDeTextos(x, "children"),
  )
  if (base !== null) return base
  if (x["type"] === "simple-node") return texto(x, "text")
  if (x["type"] === "note-node") return texto(x, "noteId")
  return "un nodo no es de un tipo conocido"
}

export const planProblem = (o: Registro): Problem =>
  primero(
    (): Problem => versionada(o),
    (): Problem => cadaUno(o, "nodes", nodo),
  )
