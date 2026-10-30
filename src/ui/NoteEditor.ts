/**
 * El editor de una nota en pantalla: cada línea se escribe en su sitio, Intro y
 * Retroceso hacen lo que dicen las tablas del teclado, las flechas saltan de una
 * línea a otra y la barra lleva el interruptor de casilla y anidar.
 *
 * Qué hace cada tecla lo decide `editor.ts`; aquí sólo se leen los eventos y se
 * pone el cursor donde toca. Sólo la línea que se está escribiendo es editable:
 * se ve en crudo, con sus marcas de negrita y cursiva escondidas salvo junto al
 * cursor y sus enlaces guardados como bloques con su texto; ahí manda lo que se
 * teclea, y sólo se repinta si su estructura cambia. Las demás, formateadas,
 * son texto que se selecciona de una a otra, y se copia como texto plano.
 */

import type {
  AppState,
  Content,
  ContentId,
  Day,
  DiagramId,
  EventId,
  Note,
  NoteId,
  RoutineId,
  UseCases,
} from "#core/index"
import { contentId, isCheckBox } from "#core/index"
import type { ActivePart, LinkPart } from "./activeLine.js"
import { activeLine, activeParts, domToRaw, rawToDom, visibleRuns } from "./activeLine.js"
import type { ActiveLine } from "./activeLine.js"
import { copiedText } from "./copyText.js"
import { briefNotice, elemento } from "./dom.js"
import type { Caret, EditResult, EditorDeps } from "./editor.js"
import {
  pressBackspaceAtStart,
  pressEnter,
  startWriting,
  toggleCheckbox,
  toggleChecked,
} from "./editor.js"
import type { LinkBubble } from "./linkBubble.js"
import { createLinkBubble } from "./linkBubble.js"
import type { LinkKind, ResolvedLink } from "./linkActions.js"
import {
  buildLink,
  changeLink,
  defaultLinkText,
  linkAtCursor,
  linkChoices,
  removeLink,
  resolveLink,
  routineShortcut,
} from "./linkActions.js"
import { openLinkSheet } from "./linkSheet.js"
import type { FormattedLine, LineLink, LineSpan, TextSpan } from "./markdownLine.js"
import { rawOffset, readMarkdownLine } from "./markdownLine.js"
import { lastLine, lineBeside, locate } from "./noteTree.js"
import { reconcile, setAttrIfChanged, setTextIfChanged } from "./reconcile.js"
import type { Sheet } from "./sheet.js"
import type { WritingMode } from "./writingMode.js"
import { INITIAL_MODE, toggleNest } from "./writingMode.js"

export interface NoteEditorDeps {
  readonly useCases: UseCases
  readonly noteId: NoteId
  readonly note: () => Note | undefined
  /** El estado entero: los enlaces internos se comprueban contra él. */
  readonly state: () => AppState
  /** Abrir lo que enlaza un enlace interno, apilado encima de esta nota. */
  readonly onOpenNote: (id: NoteId) => void
  readonly onOpenDiagram: (id: DiagramId) => void
  /** El calendario, abierto en ese evento, con su hoja de edición. */
  readonly onOpenEvent: (id: EventId) => void
  /** El calendario, en la pestaña de rutinas y con esa fila tocada. */
  readonly onOpenRoutine: (id: RoutineId) => void
  /** El día de hoy en este dispositivo; `null` si se sale del rango. */
  readonly today: () => Day | null
  /** La hoja donde se elige a qué enlazar. */
  readonly sheet: Sheet
}

/** Lo que dura «El enlace ya no existe». */
const AVISO_ROTO_MS: number = 1500

/** Un enlace con la burbuja: el elegido (un bloque) o el que tiene el cursor dentro (texto crudo). */
interface EnlaceVigente {
  readonly campo: HTMLElement
  /** Bajo qué elemento se coloca la burbuja: el bloque, o el campo. */
  readonly ancla: HTMLElement
  readonly id: ContentId
  readonly raw: string
  readonly linea: FormattedLine
  readonly link: LineLink
  readonly rawCursor: number
}

/** El bloque de enlace que se tocó, por su sitio en la cadena cruda de la línea activa. */
interface EnlaceElegido {
  readonly id: ContentId
  readonly start: number
  readonly end: number
}

/** Una selección dentro de una línea, en la cadena CRUDA de esa línea; sin texto elegido, `from === to`. */
interface Seleccion {
  readonly line: ContentId
  readonly from: number
  readonly to: number
}

export interface NoteEditor {
  /** Las líneas, o la invitación a escribir si la nota está vacía. */
  readonly element: HTMLElement
  /** Los botones del modo y de enlazar, para la barra de abajo. */
  readonly modeButtons: ReadonlyArray<HTMLElement>
  /** Repinta si la nota cambió. Lo llama quien escucha al `Store`. */
  readonly refresh: (nota: Note) => void
  /** Suelta lo que se enganchó fuera de sus elementos. */
  readonly destroy: () => void
}

/* ───────────────────────────── El cursor en el DOM ──────────────────────── */

/**
 * Lo que un nodo del campo aporta a la cadena cruda: un texto, el suyo; un bloque
 * de enlace, su `data-raw` (sin entrar); un `<br>`, nada; cualquier otro
 * elemento (el `span` de una palabra con formato o de una marca), lo que lleve dentro.
 */
const crudoDeNodo = (nodo: Node): string => {
  if (nodo.nodeType === Node.TEXT_NODE) return nodo.textContent ?? ""
  if (!(nodo instanceof Element)) return ""
  const bruto: string | null = nodo.getAttribute("data-raw")
  if (bruto !== null) return bruto
  if (nodo.tagName === "BR") return ""
  let crudo: string = ""
  for (const hijo of nodo.childNodes) crudo += crudoDeNodo(hijo)
  return crudo
}

/**
 * La cadena cruda de un campo (o de un trozo clonado de él): recorre sus hijos en
 * lugar de fiarse de la estructura, que el navegador puede fundir o partir al
 * teclear. En un campo formateado, sin bloques, es lo mismo que `textContent`.
 */
const crudoDelCampo = (raiz: Node): string => {
  let crudo: string = ""
  for (const nodo of raiz.childNodes) crudo += crudoDeNodo(nodo)
  return crudo
}

/** Si el campo lleva algún `span` (palabras con formato, marcas o bloques): sólo la activa con énfasis o enlaces. */
const esEstructurado = (campo: HTMLElement): boolean => campo.querySelector("span") !== null

/** Si la línea lleva algún bloque de enlace: sólo la activa los tiene. */
const tieneBloques = (campo: HTMLElement): boolean => campo.querySelector("[data-raw]") !== null

/** Los bloques de enlace del campo, en orden. */
const bloquesDe = (campo: HTMLElement): ReadonlyArray<HTMLElement> => [
  ...campo.querySelectorAll<HTMLElement>(":scope > [data-raw]"),
]

/** Dónde empieza, en la cadena cruda del campo, ese hijo suyo. */
const inicioCrudo = (campo: HTMLElement, hijo: Node): number => {
  let antes: number = 0
  for (const nodo of campo.childNodes) {
    if (nodo === hijo) return antes
    antes += crudoDeNodo(nodo).length
  }
  return antes
}

/**
 * Cuánto hay en el campo hasta ese punto, en la cadena cruda: el texto de dentro
 * de cualquier `span` cuenta aunque esté escondido, y un bloque entero o nada.
 */
const contarHasta = (campo: HTMLElement, nodo: Node, offset: number): number => {
  const hasta: Range = document.createRange()
  hasta.selectNodeContents(campo)
  hasta.setEnd(nodo, offset)
  return crudoDelCampo(hasta.cloneContents()).length
}

/** Dónde está el cursor dentro de ese campo (en su cadena cruda si es la activa), o `null` si no está en él. */
const leerCursor = (campo: HTMLElement): number | null => {
  const sel: Selection | null = window.getSelection()
  if (sel === null || sel.rangeCount === 0 || sel.focusNode === null) return null
  if (!campo.contains(sel.focusNode)) return null
  return contarHasta(campo, sel.focusNode, sel.focusOffset)
}

/** Lo que `[` y `]` rompen: una selección que los lleve no sirve de texto de un enlace. */
const sirveDeTexto = (elegido: string): boolean => elegido.trim() !== "" && !/[[\]]/.test(elegido)

/** Si el cursor es un punto y no una selección de varios caracteres. */
const cursorColapsado = (): boolean => window.getSelection()?.isCollapsed ?? true

/** Lo que puede moverse el dedo en un toque antes de que cuente como arrastre. */
const ARRASTRE_PX: number = 5

/** Una línea vacía lleva un `<br>`: sin nada dentro, la selección no la pinta y salta por encima. */
const rellenarSiVacia = (campo: Element): void => {
  if (campo.firstChild === null) campo.append(document.createElement("br"))
}

/**
 * Las hojas del campo, en orden: sus nodos de texto, también los de dentro de
 * un `span` de formato o de marca, y sus bloques de enlace (sin entrar en ellos).
 */
const hojasDe = (nodo: Node): ReadonlyArray<Node> => {
  const hojas: Node[] = []
  for (const hijo of nodo.childNodes) {
    if (hijo.nodeType === Node.TEXT_NODE) hojas.push(hijo)
    else if (hijo instanceof Element) {
      if (hijo.hasAttribute("data-raw")) hojas.push(hijo)
      else hojas.push(...hojasDe(hijo))
    }
  }
  return hojas
}

/**
 * Muestra las marcas de los pares con el cursor (posición cruda) en su intervalo
 * y esconde las demás. Sin cursor, no toca nada. Va SIEMPRE antes de colocar el
 * cursor en el DOM: no puede caer en una marca que siga escondida.
 */
const marcarVivas = (campo: HTMLElement, cursor: number | null): void => {
  if (cursor === null) return
  const marcas: ReadonlyArray<HTMLElement> = [...campo.querySelectorAll<HTMLElement>(":scope > .md-marca")]
  if (marcas.length === 0) return
  const raw: string = crudoDelCampo(campo)
  const linea: ActiveLine = activeLine(raw)
  const vivos: ReadonlySet<number> = visibleRuns(linea.partes, linea.runs, Math.min(cursor, raw.length))
  for (const marca of marcas) marca.classList.toggle("md-viva", vivos.has(Number(marca.dataset["run"])))
}

/**
 * Pone el rango en la posición cruda `offset` de un campo con `span`s. Nunca
 * dentro de un bloque: al borde más cercano. En el límite entre dos nodos de
 * texto, al final del de la izquierda. Si el cursor queda junto a un bloque sin
 * texto al lado, se le crea un nodo de texto vacío donde vivir.
 */
const colocarEnEstructura = (rango: Range, campo: HTMLElement, destino: number): void => {
  let antes: number = 0
  for (const nodo of hojasDe(campo)) {
    const largo: number = crudoDeNodo(nodo).length
    if (nodo.nodeType === Node.TEXT_NODE) {
      if (destino <= antes + largo) {
        rango.setStart(nodo, destino - antes)
        return
      }
    } else if (destino <= antes) {
      const vacio: Text = document.createTextNode("")
      nodo.parentNode?.insertBefore(vacio, nodo)
      rango.setStart(vacio, 0)
      return
    }
    antes += largo
  }
  const vacio: Text = document.createTextNode("")
  campo.append(vacio)
  rango.setStart(vacio, 0)
}

const ponerCursorEn = (campo: HTMLElement, offset: number): void => {
  campo.focus()
  const sel: Selection | null = window.getSelection()
  if (sel === null) return
  const rango: Range = document.createRange()
  const nodo: Node | null = campo.firstChild
  if (esEstructurado(campo)) {
    const partes: ReadonlyArray<ActivePart> = activeParts(crudoDelCampo(campo))
    const destino: number = domToRaw(partes, rawToDom(partes, offset))
    marcarVivas(campo, destino)
    colocarEnEstructura(rango, campo, destino)
  } else if (nodo !== null && nodo.nodeType === Node.TEXT_NODE) {
    rango.setStart(nodo, Math.min(offset, nodo.textContent?.length ?? 0))
  } else {
    rango.setStart(campo, 0)
  }
  rango.collapse(true)
  sel.removeAllRanges()
  sel.addRange(rango)
}

/** El punto del texto que cae bajo (x, y), con lo que tenga el navegador. */
const puntoDeTexto = (x: number, y: number): { readonly nodo: Node; readonly offset: number } | null => {
  if (typeof document.caretPositionFromPoint === "function") {
    const p: CaretPosition | null = document.caretPositionFromPoint(x, y)
    return p === null ? null : { nodo: p.offsetNode, offset: p.offset }
  }
  /* Safari antiguo sólo tiene el de antes, con otro nombre. */
  const r: Range | null =
    typeof document.caretRangeFromPoint === "function" ? document.caretRangeFromPoint(x, y) : null
  return r === null ? null : { nodo: r.startContainer, offset: r.startOffset }
}

/** La letra de lo que se ve en el campo donde cayó el dedo, o `null` si no se sabe. */
const offsetEnPunto = (campo: HTMLElement, x: number, y: number): number | null => {
  const punto: { readonly nodo: Node; readonly offset: number } | null = puntoDeTexto(x, y)
  if (punto === null || !campo.contains(punto.nodo)) return null
  const hasta: Range = document.createRange()
  hasta.selectNodeContents(campo)
  hasta.setEnd(punto.nodo, punto.offset)
  return hasta.toString().length
}

/* ────────────────────────── Crudo o formateado ──────────────────────────── */

/**
 * Pinta la línea formateada: un `span` por tramo visible, con su estilo; las
 * marcas no se pintan. Un enlace roto lleva `md-roto` en todos sus tramos.
 */
const pintarFormateada = (
  campo: HTMLElement,
  linea: FormattedLine,
  rotos: ReadonlySet<LineLink>,
): void => {
  const visibles: ReadonlyArray<TextSpan> = linea.spans.filter(
    (s: LineSpan): s is TextSpan => s.kind === "text",
  )
  const tramos: ReadonlyArray<HTMLSpanElement> = visibles
    .map((s: TextSpan): HTMLSpanElement => {
      const el: HTMLSpanElement = elemento("span", s.text)
      el.classList.toggle("md-negrita", s.bold)
      el.classList.toggle("md-cursiva", s.italic)
      /* Sólo el aspecto: abrirlo es de la burbuja. Un `<a>` se iría al tocarlo. */
      el.classList.toggle("md-enlace", s.link !== null)
      /* Roto: sólo cambia el color, el texto es el mismo. */
      el.classList.toggle("md-roto", s.link !== null && rotos.has(s.link))
      return el
    })
  campo.replaceChildren(...tramos)
  campo.classList.toggle("md-titulo", linea.heading)
  rellenarSiVacia(campo)
}

/** Si el campo ya muestra esa cadena en crudo, en un solo nodo de texto. */
const muestraEnCrudo = (campo: HTMLElement, raw: string): boolean =>
  raw === ""
    ? campo.textContent === "" && campo.querySelector("span") === null
    : campo.childNodes.length === 1 &&
      campo.firstChild?.nodeType === Node.TEXT_NODE &&
      campo.textContent === raw

/** Si el cursor está en la primera (o la última) fila visual del campo. */
const enBordeVisual = (campo: HTMLElement, hacia: "prev" | "next"): boolean => {
  const sel: Selection | null = window.getSelection()
  if (sel === null || sel.rangeCount === 0) return true
  const cursor: DOMRect | undefined = sel.getRangeAt(0).getClientRects()[0]
  /* Un campo vacío no da rectángulo: está en los dos bordes a la vez. */
  if (cursor === undefined) return true
  const caja: DOMRect = campo.getBoundingClientRect()
  const alto: number = cursor.height || 16
  return hacia === "prev" ? cursor.top - caja.top < alto / 2 : caja.bottom - cursor.bottom < alto / 2
}

/* ────────────────────────────────── Botones ─────────────────────────────── */

/** Un botón de la barra que no le quita el foco a la línea: el teclado del móvil no se cierra. */
const botonDeBarra = (texto: string, alPulsar: () => void): HTMLButtonElement => {
  const b: HTMLButtonElement = elemento("button", texto)
  b.type = "button"
  b.addEventListener("pointerdown", (evento: PointerEvent): void => evento.preventDefault())
  b.addEventListener("click", alPulsar)
  return b
}

/* ───────────────────────────────── El editor ────────────────────────────── */

/** Firefox antiguo no entiende `plaintext-only`: ahí se pega como texto a mano. */
const soportaTextoPlano = (): boolean => {
  const prueba: HTMLElement = document.createElement("span")
  prueba.contentEditable = "plaintext-only"
  return prueba.contentEditable === "plaintext-only"
}

export const createNoteEditor = ({
  useCases,
  noteId,
  note,
  state,
  onOpenNote,
  onOpenDiagram,
  onOpenEvent,
  onOpenRoutine,
  today,
  sheet,
}: NoteEditorDeps): NoteEditor => {
  const deps: EditorDeps = { useCases, noteId, note }
  /* Nace apagado al abrir la nota y muere con ella: no se guarda en ningún sitio. */
  let modo: WritingMode = INITIAL_MODE
  /** Lo último que se supo del cursor: los botones de la barra lo necesitan. */
  let ultimo: Caret | null = null
  /**
   * Durante una orden —partir, unir, convertir— se pinta también la línea con el
   * foco: su texto lo acaba de cambiar la orden, no quien teclea.
   */
  let enOrden: boolean = false
  /** Entre `compositionstart` y `compositionend`: el teclado del móvil escribe por su cuenta. */
  let componiendo: boolean = false
  const textoPlano: boolean = soportaTextoPlano()

  const lineas: HTMLElement = elemento("div")
  lineas.className = "lineas"
  const empezar: HTMLParagraphElement = elemento("p", "Esta nota está vacía. Toca para escribir.")
  empezar.className = "vacia empezar"
  empezar.tabIndex = 0
  empezar.setAttribute("role", "button")
  const element: HTMLElement = elemento("div")
  element.className = "contenido"
  const burbuja: LinkBubble = createLinkBubble({
    onOpen: (): void => abrirEnlace(),
    onChange: (): void => cambiarEnlace(),
    onRemove: (): void => quitarEnlace(),
  })
  element.append(lineas, empezar, burbuja.element)

  /* ── Las líneas ── */

  const campoDe = (id: ContentId): HTMLElement | null =>
    lineas.querySelector<HTMLElement>(`[data-id="${CSS.escape(id)}"] > .texto`)

  const idDe = (objetivo: EventTarget | null): ContentId | null => {
    const fila: Element | null =
      objetivo instanceof Element ? objetivo.closest("[data-id]") : null
    const bruto: string | null = fila?.getAttribute("data-id") ?? null
    return bruto === null ? null : contentId(bruto)
  }

  /** Si ese texto de casilla es un atajo a una rutina, cuál y si hoy está marcada. */
  const atajoDe = (texto: string): ReturnType<typeof routineShortcut> =>
    texto.includes("](#") ? routineShortcut(state(), readMarkdownLine(texto), texto, today()) : null

  const crearLinea = (content: Content): Element => {
    const fila: HTMLElement = elemento("div")
    fila.dataset["id"] = content.id
    fila.className = isCheckBox(content) ? "linea casilla" : "linea"
    /* Nace sin editar: sólo lo es la línea activa, y lo pone `activar`. */
    const campo: HTMLSpanElement = elemento("span")
    campo.className = "texto"
    campo.spellcheck = true
    if (isCheckBox(content)) {
      const marca: HTMLButtonElement = elemento("button")
      marca.type = "button"
      marca.className = "marca"
      marca.addEventListener("click", (): void => {
        /* Una casilla cuyo texto es el enlace a una rutina marca la rutina de hoy, no la casilla. */
        const hoy: Day | null = today()
        const texto: string | undefined = textoDe(content.id)
        const atajo: ReturnType<typeof atajoDe> = texto === undefined ? null : atajoDe(texto)
        if (atajo !== null && hoy !== null) void useCases.setRoutineDay(atajo.id, hoy, !atajo.marked, hoy)
        else toggleChecked(deps, content.id)
      })
      const hijas: HTMLElement = elemento("div")
      hijas.className = "hijas"
      fila.append(marca, campo, hijas)
    } else {
      fila.append(campo)
    }
    return fila
  }

  const pintarLista = (contenedor: Element, lista: ReadonlyArray<Content>): void => {
    /* La clave lleva la clase: una línea que cambia de texto a casilla cambia de
       forma, y se rehace entera. El cursor lo repone quien hizo el cambio. */
    reconcile<Content, Element>(contenedor, lista, {
      key: (l: Content): string => `${l.type}:${l.id}`,
      keyOf: (el: Element): string | null => {
        const id: string | null = el.getAttribute("data-id")
        const tipo: string = el.classList.contains("casilla") ? "checkbox" : "text"
        return id === null ? null : `${tipo}:${id}`
      },
      create: crearLinea,
      update: (fila: Element, l: Content): void => {
        const campo: HTMLElement | null = fila.querySelector<HTMLElement>(":scope > .texto")
        /* ⚠️ La regla del editor: el campo con el foco no se toca, salvo que lo
           haya cambiado una orden. */
        if (campo !== null && (enOrden || campo !== document.activeElement)) pintarCampo(campo, l.text)
        if (!isCheckBox(l)) return
        const marca: Element | null = fila.querySelector(":scope > .marca")
        /* Un atajo a una rutina se ve marcado según los días de la rutina, no según `checked`. */
        const atajo: ReturnType<typeof atajoDe> = atajoDe(l.text)
        const marcada: boolean = atajo === null ? l.checked : atajo.marked
        if (marca !== null) {
          /* La caja la dibuja el CSS: aquí sólo va el ✓ de dentro. */
          setTextIfChanged(marca, marcada ? "✓" : "")
          setAttrIfChanged(marca, "aria-pressed", marcada ? "true" : "false")
          setAttrIfChanged(marca, "aria-label", `${marcada ? "Desmarcar" : "Marcar"}${atajo === null ? "" : " hoy"}`)
        }
        if (fila.classList.contains("marcada") !== marcada) fila.classList.toggle("marcada", marcada)
        const hijas: Element | null = fila.querySelector(":scope > .hijas")
        if (hijas !== null) pintarLista(hijas, l.children)
      },
    })
  }

  let pintada: Note | null = null
  /* Los enlaces internos dependen de qué notas, diagramas, eventos y rutinas hay: si cambian, se repinta. */
  let pintadasNotas: AppState["notes"] | null = null
  let pintadosDiagramas: AppState["diagrams"] | null = null
  let pintadosEventos: AppState["events"] | null = null
  let pintadasRutinas: AppState["routines"] | null = null
  const refresh = (nota: Note): void => {
    const estado: AppState = state()
    /* La MISMA nota si nada cambió —un `set-checked` redundante incluido—, y las mismas
       notas y diagramas contra los que se comprueban sus enlaces: ni se mira el DOM. */
    if (
      nota === pintada &&
      estado.notes === pintadasNotas &&
      estado.diagrams === pintadosDiagramas &&
      estado.events === pintadosEventos &&
      estado.routines === pintadasRutinas
    ) {
      return
    }
    pintada = nota
    pintadasNotas = estado.notes
    pintadosDiagramas = estado.diagrams
    pintadosEventos = estado.events
    pintadasRutinas = estado.routines
    pintarLista(lineas, nota.content)
    empezar.hidden = nota.content.length > 0
    actualizarBurbuja()
  }

  /* ── La línea activa: la única editable, y en crudo ── */

  /* Una línea editable es un mundo aparte: la selección no sale de ella. Las
     demás son texto normal, que se selecciona de corrido y se copia. */
  const editable: string = textoPlano ? "plaintext-only" : "true"
  let activa: HTMLElement | null = null
  /** El bloque de enlace tocado, con la burbuja a la vista; se quita al mover la selección, teclear o apagar la línea. */
  let enlaceElegido: EnlaceElegido | null = null
  /**
   * Lo último que se pintó formateado en cada campo: la cadena cruda y si cada
   * enlace interno resolvía. Si no cambió, no se rehace.
   */
  const formateadoCon: WeakMap<HTMLElement, { readonly raw: string; readonly enlaces: string }> =
    new WeakMap<HTMLElement, { readonly raw: string; readonly enlaces: string }>()

  /** Si ese enlace es interno y su destino ya no está. */
  const estaRoto = (link: LineLink): boolean =>
    link.target.kind === "internal" && resolveLink(state(), link.target.id) === null

  /** El bloque de un enlace guardado: no se edita por dentro, y lleva su cadena cruda. */
  const bloqueDe = (parte: LinkPart): HTMLElement => {
    const bloque: HTMLSpanElement = elemento("span", parte.label)
    bloque.className = "md-enlace"
    bloque.contentEditable = "false"
    bloque.dataset["raw"] = parte.raw
    bloque.classList.toggle("md-roto", estaRoto(parte.link))
    return bloque
  }

  /** El nodo de una parte de la línea activa; ver `pintarActiva`. */
  const nodoDeParte = (parte: ActivePart): Node => {
    if (parte.kind === "link") return bloqueDe(parte)
    if (parte.kind === "mark") {
      const marca: HTMLSpanElement = elemento("span", parte.raw)
      marca.className = "md-marca"
      marca.dataset["run"] = String(parte.run)
      return marca
    }
    if (!parte.bold && !parte.italic && parte.run === null) return document.createTextNode(parte.raw)
    const tramo: HTMLSpanElement = elemento("span", parte.raw)
    tramo.classList.toggle("md-negrita", parte.bold)
    tramo.classList.toggle("md-cursiva", parte.italic)
    if (parte.run !== null) tramo.dataset["run"] = String(parte.run)
    return tramo
  }

  /** Si ese nodo es lo que `nodoDeParte` pintaría para esa parte, sin mirar `md-viva`. */
  const nodoCoincide = (nodo: Node, parte: ActivePart): boolean => {
    if (parte.kind === "text" && !parte.bold && !parte.italic && parte.run === null) {
      return nodo.nodeType === Node.TEXT_NODE && nodo.textContent === parte.raw
    }
    if (!(nodo instanceof HTMLElement) || nodo.tagName !== "SPAN") return false
    if (parte.kind === "link") {
      return nodo.getAttribute("data-raw") === parte.raw && nodo.textContent === parte.label
    }
    if (nodo.hasAttribute("data-raw")) return false
    const esMarca: boolean = parte.kind === "mark"
    const run: number | null = parte.run
    return (
      nodo.classList.contains("md-marca") === esMarca &&
      nodo.classList.contains("md-negrita") === (parte.kind === "text" && parte.bold) &&
      nodo.classList.contains("md-cursiva") === (parte.kind === "text" && parte.italic) &&
      nodo.getAttribute("data-run") === (run === null ? null : String(run)) &&
      nodo.textContent === parte.raw
    )
  }

  /** Si el campo ya tiene, hijo a hijo, la estructura de esas partes. */
  const estructuraCoincide = (campo: HTMLElement, partes: ReadonlyArray<ActivePart>): boolean => {
    const hijos: ReadonlyArray<ChildNode> = [...campo.childNodes]
    return (
      hijos.length === partes.length &&
      partes.every((p: ActivePart, i: number): boolean => nodoCoincide(hijos[i] as ChildNode, p))
    )
  }

  /**
   * La línea activa: en crudo, con las palabras en negrita o cursiva ya con su
   * estilo y sus marcas (`*`, `**`) escondidas, y cada enlace guardado como un
   * bloque con su texto. Sin enlaces ni énfasis, un solo nodo de texto; y si ya
   * muestra eso, no se toca.
   */
  const pintarActiva = (campo: HTMLElement, raw: string): void => {
    campo.classList.remove("md-titulo")
    const { partes, runs }: ActiveLine = activeLine(raw)
    const enlaces: ReadonlyArray<LinkPart> = partes.filter((p: ActivePart): p is LinkPart => p.kind === "link")
    if (enlaces.length === 0 && runs.length === 0) {
      if (!muestraEnCrudo(campo, raw)) campo.textContent = raw
      rellenarSiVacia(campo)
      return
    }
    if (estructuraCoincide(campo, partes)) {
      /* Ya está pintada: sólo se pone al día cuáles están rotos, sin mover el cursor. */
      bloquesDe(campo).forEach((bloque: HTMLElement, i: number): void => {
        const parte: LinkPart | undefined = enlaces[i]
        bloque.classList.toggle("md-roto", parte !== undefined && estaRoto(parte.link))
      })
      return
    }
    campo.replaceChildren(...partes.map(nodoDeParte))
  }

  /**
   * Tras teclear: si lo que el navegador dejó en la activa ya es lo que se
   * pintaría (la regla, comparar y no repintar en cada tecla), sólo se ponen al
   * día las marcas a la vista; si no —se cerró un par, una letra cayó en una
   * marca, se rompió un par—, se repinta y el cursor vuelve a su sitio.
   */
  const sincronizarActiva = (campo: HTMLElement): void => {
    const raw: string = crudoDelCampo(campo)
    const { partes, runs }: ActiveLine = activeLine(raw)
    const plano: boolean = runs.length === 0 && !partes.some((p: ActivePart): boolean => p.kind === "link")
    const cursor: number | null = leerCursor(campo)
    if (plano ? !esEstructurado(campo) : estructuraCoincide(campo, partes)) {
      marcarVivas(campo, cursor)
      return
    }
    pintarActiva(campo, raw)
    if (cursor !== null) ponerCursorEn(campo, cursor)
  }

  /** La activa, en crudo y con sus enlaces en bloques; las demás, formateadas. */
  const pintarCampo = (campo: HTMLElement, raw: string): void => {
    if (campo === activa) {
      formateadoCon.delete(campo)
      pintarActiva(campo, raw)
      return
    }
    /* Sólo una línea con `](#` puede llevar un enlace interno: las demás ni se leen aquí. */
    const linea: FormattedLine = readMarkdownLine(raw)
    const rotos: Set<LineLink> = new Set<LineLink>()
    let enlaces: string = ""
    if (raw.includes("](#")) {
      const estado: AppState = state()
      for (const l of linea.links) {
        if (l.target.kind !== "internal") continue
        const roto: boolean = resolveLink(estado, l.target.id) === null
        if (roto) rotos.add(l)
        enlaces += roto ? "0" : "1"
      }
    }
    const previo: { readonly raw: string; readonly enlaces: string } | undefined = formateadoCon.get(campo)
    if (previo !== undefined && previo.raw === raw && previo.enlaces === enlaces) return
    formateadoCon.set(campo, { raw, enlaces })
    pintarFormateada(campo, linea, rotos)
  }

  /** La cadena cruda de la línea de ese campo, según la nota; si ya no está, lo que se ve. */
  const crudoDe = (campo: HTMLElement): string => {
    const id: ContentId | null = idDe(campo)
    const nota: Note | undefined = deps.note()
    const linea: Content | undefined =
      id === null || nota === undefined ? undefined : locate(nota.content, id)?.line
    return linea?.text ?? crudoDelCampo(campo)
  }

  /** De una letra de lo que se ve en el campo a su sitio en la cadena cruda. */
  const aCrudo = (campo: HTMLElement, mostrado: number): number =>
    campo === activa ? mostrado : rawOffset(readMarkdownLine(crudoDe(campo)), mostrado)

  /** Deja de editar ese campo y lo vuelve a pintar formateado, si sigue en la nota. */
  const apagar = (campo: HTMLElement): void => {
    campo.removeAttribute("contenteditable")
    if (campo.isConnected) pintarCampo(campo, crudoDe(campo))
  }

  const activar = (campo: HTMLElement): void => {
    if (activa === campo) return
    const anterior: HTMLElement | null = activa
    activa = campo
    enlaceElegido = null
    if (anterior !== null) apagar(anterior)
    /* Se pinta en crudo antes de hacerla editable y de poner el cursor: el
       offset que llega cuenta la cadena cruda. */
    pintarCampo(campo, crudoDe(campo))
    if (campo.getAttribute("contenteditable") !== editable) campo.contentEditable = editable
  }

  const desactivar = (): void => {
    const anterior: HTMLElement | null = activa
    activa = null
    enlaceElegido = null
    if (anterior !== null) apagar(anterior)
    burbuja.hide()
  }

  /** Pone el cursor en esa línea, que pasa a ser la activa. */
  const ponerCursor = (campo: HTMLElement, offset: number): void => {
    activar(campo)
    ponerCursorEn(campo, offset)
    actualizarBurbuja()
  }

  /* ── La burbuja del enlace: sale al tocar un bloque, o con el cursor dentro de un enlace en crudo ── */

  /**
   * El enlace que enseña la burbuja, si la línea activa se ve y el cursor es un
   * punto: el bloque tocado mientras el cursor siga pegado a él; si no, el enlace
   * en texto crudo (una dirección suelta, o uno recién escrito) con el cursor
   * estrictamente dentro. Si el elegido ya no vale, se quita.
   */
  const enlaceVigente = (): EnlaceVigente | null => {
    const campo: HTMLElement | null = activa
    /* Sin cajas, la línea está escondida bajo otra capa: no se ofrece nada. */
    if (campo === null || !campo.isConnected || campo.getClientRects().length === 0) return null
    const rawCursor: number | null = cursorColapsado() ? leerCursor(campo) : null
    const id: ContentId | null = idDe(campo)
    if (rawCursor === null || id === null) {
      enlaceElegido = null
      return null
    }
    const raw: string = crudoDelCampo(campo)
    const linea: FormattedLine = readMarkdownLine(raw)
    const elegido: EnlaceElegido | null = enlaceElegido
    if (elegido !== null) {
      const link: LineLink | undefined =
        elegido.id !== id
          ? undefined
          : linea.links.find(
              (l: LineLink): boolean => l.saved && l.start === elegido.start && l.end === elegido.end,
            )
      /* Pegado a él por uno de sus dos lados: el navegador a veces deja el cursor antes. */
      if (link !== undefined && (rawCursor === link.start || rawCursor === link.end)) {
        const bloque: HTMLElement | undefined = bloquesDe(campo).find(
          (b: HTMLElement): boolean => inicioCrudo(campo, b) === link.start,
        )
        return { campo, ancla: bloque ?? campo, id, raw, linea, link, rawCursor }
      }
      enlaceElegido = null
    }
    const link: LineLink | null = linkAtCursor(linea, rawCursor)
    return link === null ? null : { campo, ancla: campo, id, raw, linea, link, rawCursor }
  }

  const actualizarBurbuja = (): void => {
    const e: EnlaceVigente | null = enlaceVigente()
    if (e === null) {
      burbuja.hide()
      return
    }
    const rectangulo: DOMRect | undefined = window.getSelection()?.getRangeAt(0).getClientRects()[0]
    /* Bajo el bloque, a su izquierda; en un enlace en crudo, bajo la línea, donde está el cursor. */
    const x: number =
      e.ancla !== e.campo
        ? e.ancla.getBoundingClientRect().left
        : (rectangulo?.left ?? e.campo.getBoundingClientRect().left)
    burbuja.show(e.link.saved, e.ancla, element, x)
  }

  const abrirEnlace = (): void => {
    const e: EnlaceVigente | null = enlaceVigente()
    if (e === null) return
    if (e.link.target.kind === "web") {
      window.open(e.link.target.href, "_blank", "noopener,noreferrer")
      return
    }
    const destino: ResolvedLink = resolveLink(state(), e.link.target.id)
    if (destino === null) {
      briefNotice("El enlace ya no existe", AVISO_ROTO_MS)
      return
    }
    /* Lo que se abre encima esconde esta nota: su burbuja no se queda colgada. */
    burbuja.hide()
    if (destino.kind === "note") onOpenNote(destino.id)
    else if (destino.kind === "diagram") onOpenDiagram(destino.id)
    else if (destino.kind === "event") onOpenEvent(destino.id)
    else onOpenRoutine(destino.id)
  }

  /** La línea deja de ser lo que era: nuevo texto, línea activa en crudo y cursor en su sitio, con el foco. */
  const escribirLinea = (id: ContentId, texto: string, cursor: number): void => {
    const campo: HTMLElement | null = campoDe(id)
    if (campo === null) return
    enlaceElegido = null
    /* Como el Tabulador: la línea activa no se repinta sola, se le pone el texto. */
    if (campo === activa) pintarActiva(campo, texto)
    useCases.setText(noteId, id, texto)
    ponerCursor(campo, cursor)
  }

  /** El texto de esa línea según la nota, o `undefined` si ya no está. */
  const textoDe = (id: ContentId): string | undefined => {
    const nota: Note | undefined = deps.note()
    return nota === undefined ? undefined : locate(nota.content, id)?.line.text
  }

  /** Quita las marcas del enlace guardado y deja su texto, como el Tabulador cambia el de la línea. */
  const quitarEnlace = (): void => {
    const e: EnlaceVigente | null = enlaceVigente()
    if (e === null) return
    const nuevo: { readonly text: string; readonly cursor: number } = removeLink(
      e.raw,
      e.linea,
      e.link,
      e.rawCursor,
    )
    escribirLinea(e.id, nuevo.text, nuevo.cursor)
  }

  /** El texto de un enlace: el escrito; si está en blanco, el que le toca por su destino. */
  const textoDelEnlace = (escrito: string, destino: string, nombre?: string): string =>
    escrito.trim() !== "" ? escrito : defaultLinkText(destino, nombre)

  /** Abre la hoja y, al elegir, reescribe el enlace con el texto y el destino de ahí. */
  const cambiarEnlace = (): void => {
    const e: EnlaceVigente | null = enlaceVigente()
    if (e === null || !e.link.saved) return
    const { id, raw, linea, link }: EnlaceVigente = e
    const poner = (destino: string, escrito: string, nombre?: string): void => {
      /* Si la línea cambió o ya no está, el enlace capturado no vale. */
      if (textoDe(id) !== raw) return
      if (destino.includes(")")) {
        briefNotice("Esa dirección no se puede enlazar", AVISO_ROTO_MS)
        return
      }
      const nuevo: { readonly text: string; readonly cursor: number } = changeLink(
        raw,
        linea,
        link,
        textoDelEnlace(escrito, destino, nombre),
        destino,
      )
      if (nuevo.text !== raw) escribirLinea(id, nuevo.text, nuevo.cursor)
    }
    const actual: ActivePart | undefined = activeParts(raw).find(
      (p: ActivePart): boolean => p.kind === "link" && p.start === link.start && p.end === link.end,
    )
    openLinkSheet(sheet, {
      title: "Cambiar enlace",
      choices: linkChoices(state(), noteId, today()),
      initialText: actual?.kind === "link" ? actual.label : "",
      initialAddress: link.target.kind === "web" ? link.target.href : "",
      onPickAddress: (direccion: string, texto: string): void => poner(direccion, texto),
      onPick: (_tipo: LinkKind, destino: string, nombre: string, texto: string): void =>
        poner(`#${destino}`, texto, nombre),
    })
  }

  /* Bajar el dedo fuera de la activa la apaga: si arrastra, selecciona de corrido. */
  lineas.addEventListener("pointerdown", (evento: PointerEvent): void => {
    if (activa === null) return
    if (evento.target instanceof Node && activa.contains(evento.target)) return
    desactivar()
  })

  /* Dónde bajó el dedo: un `click` lejos de ahí acaba un arrastre. No basta con
     mirar si queda selección: al tocar encima de una, el navegador la quita
     después del `click`. */
  let bajada: { readonly x: number; readonly y: number } | null = null
  element.addEventListener("pointerdown", (evento: PointerEvent): void => {
    bajada = { x: evento.clientX, y: evento.clientY }
  })
  const arrastro = (evento: MouseEvent): boolean =>
    bajada !== null && Math.hypot(evento.clientX - bajada.x, evento.clientY - bajada.y) > ARRASTRE_PX

  /* Un toque sin arrastrar en otra línea la activa, con el cursor donde cayó. Tras
     arrastrar para seleccionar también llega un `click`: ése no edita nada. */
  lineas.addEventListener("click", (evento: MouseEvent): void => {
    const objetivo: Element | null = evento.target instanceof Element ? evento.target : null
    const campo: HTMLElement | null = objetivo?.closest<HTMLElement>(".texto") ?? null
    if (campo === null || arrastro(evento)) return
    if (campo === activa) {
      /* Tocar un bloque de la activa: el cursor tras él y la burbuja de ese enlace. */
      const bloque: HTMLElement | null = objetivo?.closest<HTMLElement>("[data-raw]") ?? null
      const id: ContentId | null = idDe(campo)
      if (bloque === null || id === null || !campo.contains(bloque)) return
      const start: number = inicioCrudo(campo, bloque)
      const end: number = start + crudoDeNodo(bloque).length
      enlaceElegido = { id, start, end }
      ponerCursorEn(campo, end)
      actualizarBurbuja()
      return
    }
    /* Se toca lo formateado: la letra de lo que se ve se lleva a la cadena cruda. */
    const visto: number | null = offsetEnPunto(campo, evento.clientX, evento.clientY)
    const crudo: string = crudoDe(campo)
    const donde: number = visto === null ? crudo.length : aCrudo(campo, visto)
    /* Si cae en un enlace guardado, ése es el elegido: el cursor queda tras su bloque. */
    const tocado: LineLink | null =
      visto === null
        ? null
        : (readMarkdownLine(crudo).links.find(
            (l: LineLink): boolean => l.saved && l.start <= donde && donde < l.end,
          ) ?? null)
    activar(campo)
    const id: ContentId | null = idDe(campo)
    enlaceElegido = tocado === null || id === null ? null : { id, start: tocado.start, end: tocado.end }
    ponerCursorEn(campo, tocado === null ? donde : tocado.end)
    actualizarBurbuja()
  })

  /* ── Copiar: texto plano, una línea por renglón, como se ve ── */

  /**
   * Dónde empieza o acaba la selección, en una línea, contando lo que se ve; si
   * cae entre líneas, en la más cercana de dentro.
   */
  const extremo = (rango: Range, cual: "inicio" | "fin"): Caret | null => {
    const nodo: Node = cual === "inicio" ? rango.startContainer : rango.endContainer
    const offset: number = cual === "inicio" ? rango.startOffset : rango.endOffset
    const el: Element | null = nodo instanceof Element ? nodo : nodo.parentElement
    const dentro: HTMLElement | null = el?.closest<HTMLElement>(".texto") ?? null
    if (dentro !== null && lineas.contains(dentro)) {
      const id: ContentId | null = idDe(dentro)
      return id === null ? null : { line: id, offset: contarHasta(dentro, nodo, offset) }
    }
    const campos: ReadonlyArray<HTMLElement> = [...lineas.querySelectorAll<HTMLElement>(".texto")]
    const campo: HTMLElement | undefined =
      cual === "inicio"
        ? campos.find((c: HTMLElement): boolean => rango.comparePoint(c, 0) >= 0)
        : [...campos].reverse().find((c: HTMLElement): boolean => rango.comparePoint(c, c.childNodes.length) <= 0)
    const id: ContentId | null = campo === undefined ? null : idDe(campo)
    if (campo === undefined || id === null) return null
    return { line: id, offset: cual === "inicio" ? 0 : crudoDelCampo(campo).length }
  }

  const copiar = (evento: ClipboardEvent): void => {
    const sel: Selection | null = window.getSelection()
    if (sel === null || sel.rangeCount === 0 || sel.isCollapsed || evento.clipboardData === null) return
    const rango: Range = sel.getRangeAt(0)
    if (!lineas.contains(rango.commonAncestorContainer)) return
    const nota: Note | undefined = deps.note()
    const desde: Caret | null = extremo(rango, "inicio")
    const hasta: Caret | null = extremo(rango, "fin")
    if (nota === undefined || desde === null || hasta === null) return
    /* Dentro de la activa con bloques, copia el navegador: sale la etiqueta de cada enlace. */
    if (desde.line === hasta.line && activa !== null && idDe(activa) === desde.line && tieneBloques(activa)) return
    const enCrudo: ContentId | null = activa === null ? null : idDe(activa)
    evento.clipboardData.setData("text/plain", copiedText(nota.content, desde, hasta, enCrudo))
    evento.preventDefault()
  }
  document.addEventListener("copy", copiar)

  /* ── Aplicar lo que decide el editor ── */

  /** Ejecuta una orden del editor y pone el cursor y el modo que devuelva. */
  const ordenar = (orden: () => EditResult): void => {
    enOrden = true
    const resultado: EditResult = orden()
    enOrden = false
    aplicar(resultado)
  }

  const aplicar = (resultado: EditResult): void => {
    modo = resultado.mode
    pintarBarra()
    ultimo = resultado.caret
    if (resultado.caret === null) return
    const campo: HTMLElement | null = campoDe(resultado.caret.line)
    if (campo !== null) ponerCursor(campo, resultado.caret.offset)
  }

  const cursorActual = (evento: Event): Caret | null => {
    const id: ContentId | null = idDe(evento.target)
    const campo: HTMLElement | null = id === null ? null : campoDe(id)
    const offset: number | null = campo === null ? null : leerCursor(campo)
    return id === null || offset === null ? null : { line: id, offset }
  }

  const intro = (evento: Event): void => {
    const caret: Caret | null = cursorActual(evento)
    if (caret === null) return
    evento.preventDefault()
    ordenar((): EditResult => pressEnter(deps, caret, modo))
  }

  /**
   * Retroceso o Suprimir con el cursor, un punto, pegado a un bloque de enlace: lo
   * quita entero y el cursor queda donde estaba. No se deja al navegador, que en
   * `plaintext-only` no lo hace igual en todos. Dice si actuó.
   */
  const quitarBloquePegado = (evento: Event, hacia: "atras" | "adelante"): boolean => {
    const caret: Caret | null = cursorActual(evento)
    const campo: HTMLElement | null = caret === null ? null : campoDe(caret.line)
    if (caret === null || campo === null || campo !== activa || !cursorColapsado()) return false
    const raw: string = crudoDelCampo(campo)
    const parte: ActivePart | undefined = activeParts(raw).find(
      (p: ActivePart): boolean =>
        p.kind === "link" && (hacia === "atras" ? p.end === caret.offset : p.start === caret.offset),
    )
    if (parte === undefined) return false
    evento.preventDefault()
    escribirLinea(caret.line, raw.slice(0, parte.start) + raw.slice(parte.end), parte.start)
    return true
  }

  /**
   * Teclear con el cursor fuera de un nodo de texto de la línea (junto a un bloque,
   * sin texto al lado): se inserta aquí, para que no caiga dentro del bloque ni se
   * pierda el cursor. Si el cursor está en un texto, escribe el navegador.
   */
  const escribirJuntoABloque = (evento: InputEvent, datos: string): void => {
    const campo: HTMLElement | null = activa
    const foco: Node | null = window.getSelection()?.focusNode ?? null
    if (campo === null || foco === null || !tieneBloques(campo) || !cursorColapsado()) return
    if (!campo.contains(foco)) return
    /* En un texto fuera de los bloques (también dentro de un `span` de formato) escribe el navegador. */
    if (foco.nodeType === Node.TEXT_NODE && foco.parentElement?.closest("[data-raw]") === null) return
    const id: ContentId | null = idDe(evento.target)
    const cursor: number | null = leerCursor(campo)
    if (id === null || id !== idDe(campo) || cursor === null) return
    evento.preventDefault()
    const raw: string = crudoDelCampo(campo)
    escribirLinea(id, raw.slice(0, cursor) + datos + raw.slice(cursor), cursor + datos.length)
  }

  /** Retroceso: quita un bloque pegado; si no, sólo con el cursor, un punto, al principio; si no, lo hace el navegador. */
  const retroceso = (evento: Event): void => {
    if (quitarBloquePegado(evento, "atras")) return
    const caret: Caret | null = cursorActual(evento)
    if (caret === null || caret.offset !== 0 || !cursorColapsado()) return
    evento.preventDefault()
    ordenar((): EditResult => pressBackspaceAtStart(deps, caret, modo))
  }

  const saltar = (evento: KeyboardEvent, hacia: "prev" | "next", alBorde: boolean): void => {
    const caret: Caret | null = cursorActual(evento)
    const nota: Note | undefined = deps.note()
    if (caret === null || nota === undefined) return
    const otra: Content | null = lineBeside(nota.content, caret.line, hacia)
    const campo: HTMLElement | null = otra === null ? null : campoDe(otra.id)
    if (otra === null || campo === null) return
    evento.preventDefault()
    /* Con ↑ ↓ se conserva la columna si cabe; con ← → se va al borde de la otra. */
    const offset: number = alBorde ? (hacia === "prev" ? otra.text.length : 0) : caret.offset
    ponerCursor(campo, offset)
  }

  lineas.addEventListener("keydown", (evento: KeyboardEvent): void => {
    if (evento.isComposing) return
    const caret: Caret | null = cursorActual(evento)
    if (caret === null) return
    const campo: HTMLElement | null = campoDe(caret.line)
    const largo: number = campo === null ? 0 : crudoDelCampo(campo).length

    if (evento.key === "Enter" && (evento.ctrlKey || evento.metaKey)) {
      evento.preventDefault()
      toggleChecked(deps, caret.line)
      return
    }
    if (evento.key === "Enter") return intro(evento)
    if (evento.key === "Backspace") return retroceso(evento)
    if (evento.key === "Delete") {
      quitarBloquePegado(evento, "adelante")
      return
    }
    if (evento.key === "Tab" && !evento.shiftKey && campo !== null) {
      /* El Tabulador mete un carácter, como en cualquier editor: no anida nada. */
      evento.preventDefault()
      const texto: string = crudoDelCampo(campo)
      const nuevo: string = `${texto.slice(0, caret.offset)}\t${texto.slice(caret.offset)}`
      if (campo === activa) pintarActiva(campo, nuevo)
      useCases.setText(noteId, caret.line, nuevo)
      ponerCursor(campo, caret.offset + 1)
      return
    }
    if (campo === null || !cursorColapsado()) return
    if (evento.key === "ArrowUp" && enBordeVisual(campo, "prev")) saltar(evento, "prev", false)
    if (evento.key === "ArrowDown" && enBordeVisual(campo, "next")) saltar(evento, "next", false)
    if (evento.key === "ArrowLeft" && caret.offset === 0) saltar(evento, "prev", true)
    if (evento.key === "ArrowRight" && caret.offset === largo) saltar(evento, "next", true)
  })

  /* El respaldo del móvil: hay teclados que no dan un Intro reconocible en
     `keydown`, pero todos dicen en `beforeinput` qué van a hacer. */
  lineas.addEventListener("beforeinput", (evento: InputEvent): void => {
    if (evento.isComposing) return
    if (evento.inputType === "insertParagraph" || evento.inputType === "insertLineBreak") intro(evento)
    else if (evento.inputType === "deleteContentBackward") retroceso(evento)
    else if (evento.inputType === "deleteContentForward") quitarBloquePegado(evento, "adelante")
    else if (evento.inputType === "insertText" && evento.data !== null) escribirJuntoABloque(evento, evento.data)
  })

  lineas.addEventListener("input", (evento: Event): void => {
    const id: ContentId | null = idDe(evento.target)
    const campo: HTMLElement | null = id === null ? null : campoDe(id)
    if (id === null || campo === null) return
    /* Cada tecla va al estado: el guardado diferido ya agrupa lo que va al disco. */
    useCases.setText(noteId, id, crudoDelCampo(campo))
    /* Teclear suelta el enlace elegido, y con él su burbuja. */
    enlaceElegido = null
    /* En plena composición no se repinta nunca: el teclado del móvil se rompería. */
    const componiendoAhora: boolean = componiendo || (evento instanceof InputEvent && evento.isComposing)
    if (campo === activa && !componiendoAhora) sincronizarActiva(campo)
    actualizarBurbuja()
  })

  /* Acabada la composición se hace lo que se aplazó: repintar si la estructura cambió. */
  lineas.addEventListener("compositionstart", (): void => {
    componiendo = true
  })
  lineas.addEventListener("compositionend", (): void => {
    componiendo = false
    if (activa !== null) sincronizarActiva(activa)
    actualizarBurbuja()
  })

  if (!textoPlano) {
    /* Sin `plaintext-only`, pegar traería formato: se pega sólo el texto. */
    lineas.addEventListener("paste", (evento: ClipboardEvent): void => {
      const texto: string = (evento.clipboardData?.getData("text/plain") ?? "").replace(/\n/g, " ")
      evento.preventDefault()
      document.execCommand("insertText", false, texto)
    })
  }

  /* Recordar el cursor para cuando se pulse la barra, que no tiene foco propio. */
  /** El cursor según la selección de ahora mismo, si está en una línea de esta nota. */
  const cursorEnVivo = (): Caret | null => {
    const nodo: Node | null = window.getSelection()?.focusNode ?? null
    const id: ContentId | null = idDe(nodo instanceof Element ? nodo : (nodo?.parentElement ?? null))
    const campo: HTMLElement | null = id === null ? null : campoDe(id)
    const offset: number | null = campo === null ? null : leerCursor(campo)
    /* Si cae en una formateada —tras seleccionar—, la letra vista se lleva a la cruda. */
    return id === null || campo === null || offset === null ? null : { line: id, offset: aCrudo(campo, offset) }
  }
  const recordarCursor = (): void => {
    const ahora: Caret | null = cursorEnVivo()
    if (ahora !== null) ultimo = ahora
    if (activa !== null && !componiendo) marcarVivas(activa, leerCursor(activa))
    actualizarBurbuja()
  }
  document.addEventListener("selectionchange", recordarCursor)

  const empezarAEscribir = (): void => ordenar((): EditResult => startWriting(deps, modo))
  empezar.addEventListener("click", empezarAEscribir)
  empezar.addEventListener("keydown", (evento: KeyboardEvent): void => {
    if (evento.key === "Enter" || evento.key === " ") {
      evento.preventDefault()
      empezarAEscribir()
    }
  })

  /* Tocar el hueco que no es ninguna línea: en una nota vacía, empezar a
     escribir; si tiene líneas, al final de la última que se ve. */
  element.addEventListener("click", (evento: MouseEvent): void => {
    if (evento.target !== element && evento.target !== lineas) return
    /* Arrastrar de una línea a otra acaba en un `click` sobre las líneas: es una selección. */
    if (arrastro(evento)) return
    const nota: Note | undefined = deps.note()
    if (nota === undefined) return
    const ultima: Content | null = lastLine(nota.content)
    if (ultima === null) return empezarAEscribir()
    const campo: HTMLElement | null = campoDe(ultima.id)
    if (campo !== null) ponerCursor(campo, ultima.text.length)
  })

  /* ── La barra: el interruptor de casilla y anidar ── */

  /**
   * Dónde actúa la barra. Sus botones no roban el foco, así que la selección
   * suele seguir en la línea: manda la de ahora. La recordada es el respaldo,
   * para cuando el móvil ya cerró el teclado; y sólo si su línea sigue ahí.
   */
  const cursorRecordado = (): Caret | null => {
    const ahora: Caret | null = cursorEnVivo()
    if (ahora !== null) return ahora
    const nota: Note | undefined = deps.note()
    return ultimo !== null && nota !== undefined && locate(nota.content, ultimo.line) !== null
      ? ultimo
      : null
  }

  /** Lo elegido en la línea de ahora; si el móvil ya cerró el teclado, el último cursor, sin selección. */
  const seleccionRecordada = (): Seleccion | null => {
    const sel: Selection | null = window.getSelection()
    if (sel !== null && sel.rangeCount > 0) {
      const rango: Range = sel.getRangeAt(0)
      const inicio: Caret | null = extremo(rango, "inicio")
      const fin: Caret | null = extremo(rango, "fin")
      const campo: HTMLElement | null = fin === null ? null : campoDe(fin.line)
      if (lineas.contains(rango.commonAncestorContainer) && inicio !== null && fin !== null && campo !== null) {
        const hasta: number = aCrudo(campo, fin.offset)
        /* Varias líneas: se trata como un cursor en su extremo final. */
        const desde: number = inicio.line === fin.line ? aCrudo(campo, inicio.offset) : hasta
        return { line: fin.line, from: desde, to: hasta }
      }
    }
    const caret: Caret | null = cursorRecordado()
    return caret === null ? null : { line: caret.line, from: caret.offset, to: caret.offset }
  }

  const enlazar: HTMLButtonElement = botonDeBarra("Enlazar…", (): void => {
    const sel: Seleccion | null = seleccionRecordada()
    const raw: string | undefined = sel === null ? undefined : textoDe(sel.line)
    /* Sin cursor no hay dónde escribirlo, como en «☐ Casilla»: no hace nada. */
    if (sel === null || raw === undefined) return
    const from: number = Math.min(sel.from, raw.length)
    const to: number = Math.min(sel.to, raw.length)
    const elegido: string = raw.slice(from, to)
    /* Una selección que no sirve de texto no se pierde: el enlace va tras ella. */
    const usable: boolean = sirveDeTexto(elegido)
    const desde: number = usable ? from : to
    const poner = (enlace: string | null): void => {
      /* Con la hoja abierta la línea pudo borrarse o cambiar: entonces no se escribe. */
      if (textoDe(sel.line) !== raw) return
      if (enlace === null) {
        briefNotice("Esa dirección no se puede enlazar", AVISO_ROTO_MS)
        return
      }
      escribirLinea(sel.line, raw.slice(0, desde) + enlace + raw.slice(to), desde + enlace.length)
    }
    openLinkSheet(sheet, {
      title: "Enlazar",
      choices: linkChoices(state(), noteId, today()),
      initialText: usable ? elegido : "",
      onPickAddress: (direccion: string, texto: string): void =>
        poner(buildLink(textoDelEnlace(texto, direccion), direccion)),
      onPick: (_tipo: LinkKind, destino: string, nombre: string, texto: string): void =>
        poner(buildLink(textoDelEnlace(texto, `#${destino}`, nombre), `#${destino}`)),
    })
  })

  const casilla: HTMLButtonElement = botonDeBarra("☐ Casilla", (): void => {
    const caret: Caret | null = cursorRecordado()
    ordenar((): EditResult => toggleCheckbox(deps, caret, modo))
  })
  const anidar: HTMLButtonElement = botonDeBarra("↳ Anidar", (): void => {
    modo = toggleNest(modo)
    pintarBarra()
    const caret: Caret | null = cursorRecordado()
    const campo: HTMLElement | null = caret === null ? null : campoDe(caret.line)
    if (caret !== null && campo !== null) ponerCursor(campo, caret.offset)
  })
  anidar.classList.add("anidar")

  const pintarBarra = (): void => {
    casilla.setAttribute("aria-pressed", modo.checkbox ? "true" : "false")
    casilla.classList.toggle("activo", modo.checkbox)
    casilla.textContent = modo.checkbox ? "☑ Casilla" : "☐ Casilla"
    anidar.disabled = !modo.checkbox
    anidar.setAttribute("aria-pressed", modo.nestArmed ? "true" : "false")
    /* ⚠️ El armado tiene que verse: actúa sobre una línea que todavía no existe. */
    anidar.classList.toggle("activo", modo.nestArmed)
    anidar.textContent = modo.nestArmed ? "↳ Anidar armado" : "↳ Anidar"
  }
  pintarBarra()

  return {
    element,
    modeButtons: [casilla, anidar, enlazar],
    refresh,
    destroy: (): void => {
      document.removeEventListener("selectionchange", recordarCursor)
      document.removeEventListener("copy", copiar)
    },
  }
}
