/**
 * La forma que tiene que tener lo que se lee del disco: una nota, un diagrama, un
 * contexto, un evento o una rutina, campo a campo.
 *
 * Un fichero puede ser JSON válido y no ser una nota —lo ha tocado alguien, o lo
 * escribió una versión rota—. Aquí se dice qué le falta; quien lee lo trata como
 * un fichero ilegible. Los campos de más no molestan: se ignoran.
 */

import { isWeeklyGoal, parseDay, parseTime } from "#core/index"

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

/** Lo que llevan todas: id, cuándo y qué versión. */
const sellada = (o: Registro): Problem =>
  primero(
    (): Problem => texto(o, "id"),
    (): Problem => numero(o, "updatedAt"),
    (): Problem => texto(o, "revision"),
  )

/** Lo que llevan las tres primeras: id, nombre, cuándo y qué versión. */
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
  esRegistro(x) && (x["kind"] === "note" || x["kind"] === "diagram") && esTexto(x["id"])
    ? null
    : "una referencia no es a una nota ni a un diagrama"

const vistaPorDefecto = (x: unknown): Problem => {
  if (!esRegistro(x)) return "«defaultView» no es un objeto"
  if (x["type"] === "context") return null
  if ((x["type"] === "note" || x["type"] === "diagram") && esTexto(x["id"])) return null
  return "«defaultView» no es una vista conocida"
}

export const contextProblem = (o: Registro): Problem =>
  primero(
    (): Problem => versionada(o),
    (): Problem => vistaPorDefecto(o["defaultView"]),
    (): Problem => cadaUno(o, "items", referencia),
    /* Ausente es vacío: lo guardado antes de que existiera no lo lleva. */
    (): Problem => (o["hidden"] === undefined ? null : cadaUno(o, "hidden", referencia)),
  )

/* ────────────────────────────── Diagramas ──────────────────────────────── */

const booleano = (o: Registro, campo: string): Problem =>
  typeof o[campo] === "boolean" ? null : `«${campo}» no es verdadero o falso`

/**
 * Comprueba cada valor de un mapa por id con `cada`, y que su clave sea su propio
 * id: con otra clave, quien lo busque por id no lo encontraría.
 */
const cadaEntrada = (
  o: Registro,
  campo: string,
  cada: (x: unknown) => Problem,
): Problem => {
  const mapa: unknown = o[campo]
  if (!esRegistro(mapa)) return `«${campo}» no es un mapa por id`
  for (const [clave, valor] of Object.entries(mapa)) {
    const problema: Problem = cada(valor)
    if (problema !== null) return problema
    if (esRegistro(valor) && valor["id"] !== clave) return `en «${campo}», «${clave}» no es su id`
  }
  return null
}

const nodo = (x: unknown): Problem => {
  if (!esRegistro(x)) return "un nodo no es un objeto"
  const base: Problem = primero(
    (): Problem => texto(x, "id"),
    (): Problem => numero(x, "positionX"),
    (): Problem => numero(x, "positionY"),
    (): Problem => booleano(x, "done"),
  )
  if (base !== null) return base
  if (x["type"] === "simple-node") return texto(x, "text")
  if (x["type"] === "note-node") return texto(x, "noteId")
  return "un nodo no es de un tipo conocido"
}

/* Que los extremos existan no se mira aquí: eso lo limpia el arranque. */
const relacion = (x: unknown): Problem => {
  if (!esRegistro(x)) return "una relación no es un objeto"
  return primero(
    (): Problem => texto(x, "id"),
    (): Problem => texto(x, "from"),
    (): Problem => texto(x, "to"),
    (): Problem => booleano(x, "directed"),
    (): Problem => texto(x, "label"),
  )
}

export const diagramProblem = (o: Registro): Problem =>
  primero(
    (): Problem => versionada(o),
    (): Problem => cadaEntrada(o, "nodes", nodo),
    (): Problem => cadaEntrada(o, "relations", relacion),
  )

/* ──────────────────────────── Eventos ─────────────────────────────────────── */

/** El campo es texto y `valida` lo acepta: un día mal escrito es un fichero ilegible. */
const textoValido = (
  o: Registro,
  campo: string,
  valida: (raw: string) => unknown,
  esperado: string,
): Problem => {
  const valor: unknown = o[campo]
  if (!esTexto(valor)) return `«${campo}» no es un texto`
  return valida(valor) === null ? `«${campo}» no es ${esperado}` : null
}

export const eventProblem = (o: Registro): Problem =>
  primero(
    (): Problem => sellada(o),
    (): Problem => texto(o, "title"),
    (): Problem => textoValido(o, "day", parseDay, "un día válido"),
    /* Sin hora es de todo el día: la clave no existe. */
    (): Problem =>
      o["time"] === undefined ? null : textoValido(o, "time", parseTime, "una hora válida"),
    (): Problem => booleano(o, "done"),
  )

export const routineProblem = (o: Registro): Problem =>
  primero(
    (): Problem => sellada(o),
    (): Problem => texto(o, "name"),
    (): Problem =>
      cadaUno(o, "days", (d: unknown): Problem =>
        esTexto(d) && parseDay(d) !== null ? null : "un día de la rutina no es un día válido",
      ),
    /* Sin meta, la clave no existe. */
    (): Problem =>
      o["weeklyGoal"] === undefined ||
      (typeof o["weeklyGoal"] === "number" && isWeeklyGoal(o["weeklyGoal"]))
        ? null
        : "«weeklyGoal» no es un entero de 1 a 7",
  )
