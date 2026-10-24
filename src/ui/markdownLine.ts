/**
 * Lee una línea de una nota como Markdown, del subconjunto de la app: negrita,
 * cursiva, título, enlaces guardados (web e internos) y direcciones sueltas. No
 * cambia el texto: lo parte en tramos, visibles o marcas, cada uno con su sitio
 * en la cadena cruda, para pintar la línea y para llevar un toque al cursor.
 * Puro: ni DOM ni core.
 */

/** Adónde lleva un enlace: una dirección web lista para abrir, o el id de algo de la app. */
export type LinkTarget =
  | { readonly kind: "web"; readonly href: string }
  | { readonly kind: "internal"; readonly id: string }

/** Un enlace de la línea, con su sitio en la cadena cruda, marcas incluidas. */
export interface LineLink {
  readonly target: LinkTarget
  /** `true` si se escribió `[texto](destino)`; `false` si es una dirección detectada sola. */
  readonly saved: boolean
  readonly start: number
  readonly end: number
}

/** Texto que se ve. */
export interface TextSpan {
  readonly kind: "text"
  readonly start: number
  readonly end: number
  /** Siempre `raw.slice(start, end)`. */
  readonly text: string
  readonly bold: boolean
  readonly italic: boolean
  /** El enlace al que pertenece (el MISMO objeto que en `links`), o `null`. */
  readonly link: LineLink | null
}

/** Lo que en la vista formateada no se ve: `**`, `*`, `# `, `[`, `](destino)` o la barra que escapa. */
export interface MarkSpan {
  readonly kind: "mark"
  readonly start: number
  readonly end: number
  /** Siempre `raw.slice(start, end)`. */
  readonly text: string
}

export type LineSpan = TextSpan | MarkSpan

export interface FormattedLine {
  /** La línea empieza por `# `. */
  readonly heading: boolean
  /** De 0 a `raw.length`, seguidos, sin huecos ni solapes, ninguno vacío. */
  readonly spans: ReadonlyArray<LineSpan>
  /** Los enlaces, en el orden en que aparecen. */
  readonly links: ReadonlyArray<LineLink>
}

interface Estilo {
  readonly bold: boolean
  readonly italic: boolean
  readonly link: LineLink | null
}

interface Hallazgo {
  readonly end: number
  readonly link: LineLink
}

interface HallazgoGuardado extends Hallazgo {
  readonly textEnd: number
}

const ESCAPABLES: ReadonlySet<string> = new Set<string>(["\\", "*", "[", "]", "(", ")", "#"])
const PREFIJOS_DIRECCION: ReadonlyArray<string> = ["https://", "http://", "www."]
const FINAL_RECORTABLE: string = ".,;:!?*'\""

const esBlanco = (c: string | undefined): boolean => c !== undefined && /\s/.test(c)

const esPalabra = (c: string | undefined): boolean => c !== undefined && /[\p{L}\p{N}]/u.test(c)

const esEscapable = (c: string | undefined): boolean => c !== undefined && ESCAPABLES.has(c)

const empiezaSinMayus = (cadena: string, i: number, prefijo: string): boolean =>
  cadena.slice(i, i + prefijo.length).toLowerCase() === prefijo

const contar = (cadena: string, c: string): number => {
  let n: number = 0
  for (const x of cadena) if (x === c) n++
  return n
}

// Dirección suelta que empieza en `i`, o null.
const direccionSuelta = (raw: string, i: number, hasta: number): Hallazgo | null => {
  if (i > 0 && esPalabra(raw[i - 1])) return null
  const prefijo: string | undefined = PREFIJOS_DIRECCION.find((p: string): boolean =>
    empiezaSinMayus(raw, i, p),
  )
  if (prefijo === undefined) return null
  let fin: number = i
  while (fin < hasta && !esBlanco(raw[fin])) fin++
  for (;;) {
    const ultimo: string | undefined = raw[fin - 1]
    if (fin > i && ultimo !== undefined && FINAL_RECORTABLE.includes(ultimo)) {
      fin--
      continue
    }
    if (ultimo === ")") {
      const trozo: string = raw.slice(i, fin)
      if (contar(trozo, ")") > contar(trozo, "(")) {
        fin--
        continue
      }
    }
    break
  }
  if (fin - i <= prefijo.length) return null
  const texto: string = raw.slice(i, fin)
  const href: string = prefijo === "www." ? "https://" + texto : texto
  return { end: fin, link: { target: { kind: "web", href }, saved: false, start: i, end: fin } }
}

// El destino de un enlace guardado, ya convertido en LinkTarget, o null si no vale.
const destinoDeEnlace = (destino: string): LinkTarget | null => {
  if (destino.startsWith("#")) {
    return destino.length < 2 ? null : { kind: "internal", id: destino.slice(1) }
  }
  if (
    (empiezaSinMayus(destino, 0, "https://") && destino.length > 8) ||
    (empiezaSinMayus(destino, 0, "http://") && destino.length > 7)
  ) {
    return { kind: "web", href: destino }
  }
  if (empiezaSinMayus(destino, 0, "www.") && destino.length > 4) {
    return { kind: "web", href: "https://" + destino }
  }
  return null
}

// Enlace guardado `[texto](destino)` que empieza en `i`, o null.
const enlaceGuardado = (raw: string, i: number, hasta: number): HallazgoGuardado | null => {
  if (raw[i] !== "[") return null
  let k: number = i + 1
  for (;;) {
    if (k >= hasta) return null
    const c: string | undefined = raw[k]
    if (c === "\\" && k + 1 < hasta && esEscapable(raw[k + 1])) {
      k += 2
      continue
    }
    if (c === "[") return null
    if (c === "]") break
    k++
  }
  if (k === i + 1) return null
  if (raw[k + 1] !== "(" || k + 1 >= hasta) return null
  let p: number = k + 2
  let profundidad: number = 0
  for (;;) {
    if (p >= hasta) return null
    const c: string | undefined = raw[p]
    if (esBlanco(c)) return null
    if (c === "(") profundidad++
    else if (c === ")") {
      if (profundidad === 0) break
      profundidad--
    }
    p++
  }
  const target: LinkTarget | null = destinoDeEnlace(raw.slice(k + 2, p))
  if (target === null) return null
  return { end: p + 1, textEnd: k, link: { target, saved: true, start: i, end: p + 1 } }
}

// Un enlace (guardado o suelto) que empieza en `i`, o null.
const enlaceEn = (raw: string, i: number, hasta: number): Hallazgo | null =>
  enlaceGuardado(raw, i, hasta) ?? direccionSuelta(raw, i, hasta)

// Dónde empieza la siguiente unidad que no se parte al buscar un cierre.
const siguienteUnidad = (
  raw: string,
  k: number,
  hasta: number,
  conEnlaces: boolean,
  saltarDoble: boolean,
): number => {
  const c: string | undefined = raw[k]
  if (c === "\\" && k + 1 < hasta) {
    if (conEnlaces) {
      const e: Hallazgo | null = enlaceEn(raw, k + 1, hasta)
      if (e !== null) return e.end
    }
    return esEscapable(raw[k + 1]) ? k + 2 : k + 1
  }
  if (conEnlaces) {
    if (c === "[") {
      const g: Hallazgo | null = enlaceGuardado(raw, k, hasta)
      if (g !== null) return g.end
    }
    const d: Hallazgo | null = direccionSuelta(raw, k, hasta)
    if (d !== null) return d.end
  }
  if (saltarDoble && c === "*" && raw[k + 1] === "*" && k + 1 < hasta) return k + 2
  return k + 1
}

// Dónde cierra la negrita abierta con `**` en `i`; -1 si no cierra.
const cierreNegrita = (raw: string, i: number, hasta: number, conEnlaces: boolean): number => {
  let k: number = i + 2
  while (k < hasta) {
    if (
      raw[k] === "*" &&
      raw[k + 1] === "*" &&
      k + 1 < hasta &&
      k >= i + 3 &&
      !esBlanco(raw[k - 1])
    ) {
      let j: number = k
      if (raw[i + 2] === "*") while (j + 2 < hasta && raw[j + 2] === "*") j++
      return j
    }
    k = siguienteUnidad(raw, k, hasta, conEnlaces, false)
  }
  return -1
}

// Dónde cierra la cursiva abierta con `*` en `i`; -1 si no cierra.
const cierreCursiva = (raw: string, i: number, hasta: number, conEnlaces: boolean): number => {
  let k: number = i + 1
  while (k < hasta) {
    if (
      raw[k] === "*" &&
      !(raw[k + 1] === "*" && k + 1 < hasta) &&
      k >= i + 2 &&
      !esBlanco(raw[k - 1])
    ) {
      return k
    }
    k = siguienteUnidad(raw, k, hasta, conEnlaces, true)
  }
  return -1
}

// Lee `[desde, hasta)` añadiendo tramos a `salida` y enlaces a `enlaces`.
const leer = (
  raw: string,
  desde: number,
  hasta: number,
  estilo: Estilo,
  conEnlaces: boolean,
  salida: LineSpan[],
  enlaces: LineLink[],
): void => {
  const texto = (s: number, e: number, link: LineLink | null): void => {
    const previo: LineSpan | undefined = salida[salida.length - 1]
    if (
      previo !== undefined &&
      previo.kind === "text" &&
      previo.end === s &&
      previo.bold === estilo.bold &&
      previo.italic === estilo.italic &&
      previo.link === link
    ) {
      salida[salida.length - 1] = { ...previo, end: e, text: raw.slice(previo.start, e) }
    } else {
      salida.push({
        kind: "text",
        start: s,
        end: e,
        text: raw.slice(s, e),
        bold: estilo.bold,
        italic: estilo.italic,
        link,
      })
    }
  }
  const marca = (s: number, e: number): void => {
    salida.push({ kind: "mark", start: s, end: e, text: raw.slice(s, e) })
  }

  let i: number = desde
  while (i < hasta) {
    const c: string | undefined = raw[i]
    if (c === "\\") {
      if (i + 1 < hasta && conEnlaces) {
        const e: Hallazgo | null = enlaceEn(raw, i + 1, hasta)
        if (e !== null) {
          marca(i, i + 1)
          texto(i + 1, e.end, null)
          i = e.end
          continue
        }
      }
      if (i + 1 < hasta && esEscapable(raw[i + 1])) {
        marca(i, i + 1)
        texto(i + 1, i + 2, estilo.link)
        i += 2
        continue
      }
      texto(i, i + 1, estilo.link)
      i++
      continue
    }
    if (conEnlaces && c === "[") {
      const g: HallazgoGuardado | null = enlaceGuardado(raw, i, hasta)
      if (g !== null) {
        enlaces.push(g.link)
        marca(i, i + 1)
        leer(raw, i + 1, g.textEnd, { ...estilo, link: g.link }, false, salida, enlaces)
        marca(g.textEnd, g.end)
        i = g.end
        continue
      }
    }
    if (conEnlaces) {
      const d: Hallazgo | null = direccionSuelta(raw, i, hasta)
      if (d !== null) {
        enlaces.push(d.link)
        texto(i, d.end, d.link)
        i = d.end
        continue
      }
    }
    if (c === "*") {
      if (raw[i + 1] === "*" && i + 1 < hasta) {
        if (!estilo.bold && i + 2 < hasta && !esBlanco(raw[i + 2])) {
          const j: number = cierreNegrita(raw, i, hasta, conEnlaces)
          if (j !== -1) {
            marca(i, i + 2)
            leer(raw, i + 2, j, { ...estilo, bold: true }, conEnlaces, salida, enlaces)
            marca(j, j + 2)
            i = j + 2
            continue
          }
        }
        texto(i, i + 1, estilo.link)
        i++
        continue
      }
      if (!estilo.italic && i + 1 < hasta && !esBlanco(raw[i + 1])) {
        const j: number = cierreCursiva(raw, i, hasta, conEnlaces)
        if (j !== -1) {
          marca(i, i + 1)
          leer(raw, i + 1, j, { ...estilo, italic: true }, conEnlaces, salida, enlaces)
          marca(j, j + 1)
          i = j + 1
          continue
        }
      }
      texto(i, i + 1, estilo.link)
      i++
      continue
    }
    texto(i, i + 1, estilo.link)
    i++
  }
}

export const readMarkdownLine = (raw: string): FormattedLine => {
  const salida: LineSpan[] = []
  const enlaces: LineLink[] = []
  const heading: boolean = raw.startsWith("# ")
  if (heading) salida.push({ kind: "mark", start: 0, end: 2, text: "# " })
  leer(raw, heading ? 2 : 0, raw.length, { bold: false, italic: false, link: null }, true, salida, enlaces)
  return { heading, spans: salida, links: enlaces }
}

/* ───────────────────── De lo que se ve a la cadena cruda ───────────────────── */

const tramosDeTexto = (line: FormattedLine): ReadonlyArray<TextSpan> =>
  line.spans.filter((s: LineSpan): s is TextSpan => s.kind === "text")

/** Lo que se ve de la línea formateada: sus tramos de texto, sin las marcas. */
export const visibleText = (line: FormattedLine): string =>
  tramosDeTexto(line)
    .map((s: TextSpan): string => s.text)
    .join("")

/**
 * Dónde cae en la cadena cruda la posición `visible` de lo que se ve (cuántos
 * caracteres visibles quedan a su izquierda). Al principio, tras el `# ` si es
 * título; al final, el final de la cadena. En medio, pegada al carácter de su
 * izquierda: entre dos tramos, antes de las marcas que los separan.
 */
export const rawOffset = (line: FormattedLine, visible: number): number => {
  const ultimo: LineSpan | undefined = line.spans[line.spans.length - 1]
  const largo: number = ultimo === undefined ? 0 : ultimo.end
  if (visible <= 0) return line.heading ? 2 : 0
  if (visible >= visibleText(line).length) return largo
  let antes: number = 0
  for (const s of tramosDeTexto(line)) {
    const tramo: number = s.end - s.start
    if (visible <= antes + tramo) return s.start + (visible - antes)
    antes += tramo
  }
  return largo
}
