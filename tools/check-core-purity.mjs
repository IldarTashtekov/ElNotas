/**
 * Tapa el hueco de la verja de pureza: falla si el core lee el reloj o el azar.
 *
 * Por qué existe: `src/core/tsconfig.json` deja fuera las librerías de
 * plataforma, así que `document.` o `crypto.randomUUID()` **no compilan** dentro
 * del core. Pero `Date` y `Math` viven en `lib.es5.d.ts`, o sea dentro de
 * `lib: ["ES2020"]`, y **sí compilan**. Comprobado a mano, no supuesto.
 *
 * Resultado: al `IdGenerator` lo protege el compilador y al `Clock` no lo
 * protegía nadie. Esto es lo que lo protege.
 *
 * ── El detalle que obliga a no usar `grep` a secas ─────────────────────────
 *
 * Los comentarios del proyecto **mencionan `Date.now()` a propósito**, porque son
 * justo los que explican esta regla. Un `grep` daría positivo en `Clock.ts` y en
 * este mismo fichero. Así que hay que mirar sólo el código, y para eso hay que
 * quitar antes los comentarios y las cadenas.
 *
 * Se sustituyen por espacios en vez de borrarlos, para que los números de línea
 * y de columna del informe sigan siendo los de verdad.
 *
 * Sin dependencias: sólo `node:fs`, como el resto de `tools/`.
 */
import { readdirSync, readFileSync } from "node:fs"

const DIRECTORIO = "src/core"

/** Lo que el core no puede leer, porque cambia entre dos llamadas. */
const PROHIBIDO = [
  { patron: /\bDate\s*\.\s*now\s*\(/g, puerto: "Clock" },
  { patron: /\bnew\s+Date\s*\(/g, puerto: "Clock" },
  { patron: /\bMath\s*\.\s*random\s*\(/g, puerto: "IdGenerator" },
]

/**
 * Devuelve el mismo texto con comentarios y cadenas convertidos en espacios.
 *
 * Es un recorrido carácter a carácter y no una expresión regular a propósito:
 * una regular no distingue un `//` dentro de una cadena de uno que abre
 * comentario, y aquí equivocarse significa dejar pasar una violación.
 */
const soloCodigo = (fuente) => {
  const salida = Array.from(fuente)
  let estado = "codigo" // codigo | linea | bloque | cadena | plantilla
  let comilla = ""

  // Una plantilla puede llevar `${...}` dentro, y eso SÍ es código: un
  // `note-${Date.now()}` es de las formas más plausibles de colarlo sin querer.
  // La pila lleva, por cada `${` abierto, cuántas llaves anidadas van dentro.
  const plantillas = []

  const borra = (indice) => {
    if (fuente[indice] !== "\n") salida[indice] = " "
  }

  for (let i = 0; i < fuente.length; i++) {
    const actual = fuente[i]
    const siguiente = fuente[i + 1]

    if (estado === "codigo") {
      if (actual === "/" && siguiente === "/") {
        estado = "linea"
        borra(i)
      } else if (actual === "/" && siguiente === "*") {
        estado = "bloque"
        borra(i)
      } else if (actual === '"' || actual === "'") {
        estado = "cadena"
        comilla = actual
      } else if (actual === "`") {
        estado = "plantilla"
      } else if (plantillas.length > 0) {
        // Estamos dentro de un `${...}`: hay que saber cuándo se cierra.
        if (actual === "{") plantillas[plantillas.length - 1] += 1
        else if (actual === "}") {
          if (plantillas[plantillas.length - 1] === 0) {
            plantillas.pop()
            estado = "plantilla"
          } else plantillas[plantillas.length - 1] -= 1
        }
      }
      continue
    }

    if (estado === "linea") {
      if (actual === "\n") estado = "codigo"
      else borra(i)
      continue
    }

    if (estado === "bloque") {
      borra(i)
      if (actual === "*" && siguiente === "/") {
        borra(i + 1)
        i += 1
        estado = "codigo"
      }
      continue
    }

    if (estado === "plantilla") {
      if (actual === "\\") {
        borra(i)
        borra(i + 1)
        i += 1
        continue
      }
      if (actual === "$" && siguiente === "{") {
        plantillas.push(0)
        estado = "codigo"
        borra(i)
        borra(i + 1)
        i += 1
        continue
      }
      if (actual === "`") {
        estado = "codigo"
        continue
      }
      borra(i)
      continue
    }

    // cadena entre comillas: se borra entera
    if (actual === "\\") {
      borra(i)
      borra(i + 1)
      i += 1
      continue
    }
    if (actual === comilla) {
      estado = "codigo"
      continue
    }
    borra(i)
  }

  return salida.join("")
}

const ficherosDe = (directorio) => {
  let entradas = []
  try {
    entradas = readdirSync(directorio, { recursive: true, encoding: "utf8" })
  } catch {
    return []
  }
  return entradas
    .filter((nombre) => nombre.endsWith(".ts") && !nombre.endsWith(".test.ts"))
    .map((nombre) => `${directorio}/${nombre}`)
}

const infracciones = []

for (const fichero of ficherosDe(DIRECTORIO)) {
  const codigo = soloCodigo(readFileSync(fichero, "utf8"))

  for (const { patron, puerto } of PROHIBIDO) {
    patron.lastIndex = 0
    let encontrado
    while ((encontrado = patron.exec(codigo)) !== null) {
      const linea = codigo.slice(0, encontrado.index).split("\n").length
      infracciones.push({ fichero, linea, texto: encontrado[0].trim(), puerto })
    }
  }
}

if (infracciones.length > 0) {
  console.error(`\n✗ El core lee el mundo en ${infracciones.length} sitio(s):\n`)
  for (const { fichero, linea, texto, puerto } of infracciones) {
    console.error(`  ${fichero}:${linea}  ${texto}  → inyéctalo por el puerto ${puerto}`)
  }
  console.error(
    [
      "",
      "  El core es puro: lo que cambia entre dos llamadas entra por un puerto,",
      "  no se lee directamente. `Date` y `Math` compilan aquí dentro porque",
      "  están en lib.es5, así que el compilador NO los caza. Por eso existe",
      "  esta comprobación.",
      "",
    ].join("\n"),
  )
  process.exit(1)
}

console.log(`✓ ${DIRECTORIO}/ no lee el reloj ni el azar`)
