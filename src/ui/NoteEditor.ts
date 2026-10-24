/**
 * El editor de una nota en pantalla: cada línea se escribe en su sitio, Intro y
 * Retroceso hacen lo que dicen las tablas del teclado, las flechas saltan de una
 * línea a otra y la barra lleva el interruptor de casilla y anidar.
 *
 * Qué hace cada tecla lo decide `editor.ts`; aquí sólo se leen los eventos y se
 * pone el cursor donde toca. La línea que se está escribiendo no se repinta
 * nunca: ahí manda lo que se teclea. Sólo ella es editable, y se ve en crudo;
 * las demás, formateadas, son texto que se selecciona de una a otra, y se copia
 * como texto plano.
 */

import type { AppState, Content, ContentId, DiagramId, Note, NoteId, UseCases } from "#core/index"
import { contentId, isCheckBox } from "#core/index"
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
import type { ResolvedLink } from "./linkActions.js"
import {
  buildLink,
  changeLinkTarget,
  linkAtCursor,
  linkChoices,
  removeLink,
  resolveLink,
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
  /** La hoja donde se elige a qué enlazar. */
  readonly sheet: Sheet
}

/** Lo que dura «El enlace ya no existe». */
const AVISO_ROTO_MS: number = 1500

/** Donde está el cursor, dentro de un enlace de la línea activa. */
interface EnlaceBajoCursor {
  readonly campo: HTMLElement
  readonly id: ContentId
  readonly raw: string
  readonly linea: FormattedLine
  readonly link: LineLink
  readonly rawCursor: number
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

/** Dónde está el cursor dentro de ese campo, o `null` si no está en él. */
const leerCursor = (campo: HTMLElement): number | null => {
  const sel: Selection | null = window.getSelection()
  if (sel === null || sel.rangeCount === 0 || sel.focusNode === null) return null
  if (!campo.contains(sel.focusNode)) return null
  const hasta: Range = document.createRange()
  hasta.selectNodeContents(campo)
  hasta.setEnd(sel.focusNode, sel.focusOffset)
  return hasta.toString().length
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

const ponerCursorEn = (campo: HTMLElement, offset: number): void => {
  campo.focus()
  const sel: Selection | null = window.getSelection()
  if (sel === null) return
  const rango: Range = document.createRange()
  const nodo: Node | null = campo.firstChild
  if (nodo !== null && nodo.nodeType === Node.TEXT_NODE) {
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

const pintarEnCrudo = (campo: HTMLElement, raw: string): void => {
  campo.classList.remove("md-titulo")
  if (!muestraEnCrudo(campo, raw)) campo.textContent = raw
  rellenarSiVacia(campo)
}

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
      marca.addEventListener("click", (): void => toggleChecked(deps, content.id))
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
        if (marca !== null) {
          /* La caja la dibuja el CSS: aquí sólo va el ✓ de dentro. */
          setTextIfChanged(marca, l.checked ? "✓" : "")
          setAttrIfChanged(marca, "aria-pressed", l.checked ? "true" : "false")
          setAttrIfChanged(marca, "aria-label", l.checked ? "Desmarcar" : "Marcar")
        }
        if (fila.classList.contains("marcada") !== l.checked) fila.classList.toggle("marcada", l.checked)
        const hijas: Element | null = fila.querySelector(":scope > .hijas")
        if (hijas !== null) pintarLista(hijas, l.children)
      },
    })
  }

  let pintada: Note | null = null
  /* Los enlaces internos dependen de qué notas y diagramas hay: si cambian, se repinta. */
  let pintadasNotas: AppState["notes"] | null = null
  let pintadosDiagramas: AppState["diagrams"] | null = null
  const refresh = (nota: Note): void => {
    const estado: AppState = state()
    /* La MISMA nota si nada cambió —un `set-checked` redundante incluido—, y las mismas
       notas y diagramas contra los que se comprueban sus enlaces: ni se mira el DOM. */
    if (nota === pintada && estado.notes === pintadasNotas && estado.diagrams === pintadosDiagramas) return
    pintada = nota
    pintadasNotas = estado.notes
    pintadosDiagramas = estado.diagrams
    pintarLista(lineas, nota.content)
    empezar.hidden = nota.content.length > 0
    actualizarBurbuja()
  }

  /* ── La línea activa: la única editable, y en crudo ── */

  /* Una línea editable es un mundo aparte: la selección no sale de ella. Las
     demás son texto normal, que se selecciona de corrido y se copia. */
  const editable: string = textoPlano ? "plaintext-only" : "true"
  let activa: HTMLElement | null = null
  /**
   * Lo último que se pintó formateado en cada campo: la cadena cruda y si cada
   * enlace interno resolvía. Si no cambió, no se rehace.
   */
  const formateadoCon: WeakMap<HTMLElement, { readonly raw: string; readonly enlaces: string }> =
    new WeakMap<HTMLElement, { readonly raw: string; readonly enlaces: string }>()

  /** La activa, en crudo; las demás, formateadas. */
  const pintarCampo = (campo: HTMLElement, raw: string): void => {
    if (campo === activa) {
      formateadoCon.delete(campo)
      pintarEnCrudo(campo, raw)
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
    return linea?.text ?? campo.textContent ?? ""
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
    if (anterior !== null) apagar(anterior)
    /* Se pinta en crudo antes de hacerla editable y de poner el cursor: el
       offset que llega cuenta la cadena cruda. */
    pintarCampo(campo, crudoDe(campo))
    if (campo.getAttribute("contenteditable") !== editable) campo.contentEditable = editable
  }

  const desactivar = (): void => {
    const anterior: HTMLElement | null = activa
    activa = null
    if (anterior !== null) apagar(anterior)
    burbuja.hide()
  }

  /** Pone el cursor en esa línea, que pasa a ser la activa. */
  const ponerCursor = (campo: HTMLElement, offset: number): void => {
    activar(campo)
    ponerCursorEn(campo, offset)
    actualizarBurbuja()
  }

  /* ── La burbuja del enlace: sale con el cursor de la línea activa dentro de uno ── */

  /** El enlace bajo el cursor, si la línea activa se ve, el cursor es un punto y está dentro de uno. */
  const enlaceBajoCursor = (): EnlaceBajoCursor | null => {
    const campo: HTMLElement | null = activa
    /* Sin cajas, la línea está escondida bajo otra capa: no se ofrece nada. */
    if (campo === null || !campo.isConnected || campo.getClientRects().length === 0) return null
    if (!cursorColapsado()) return null
    const rawCursor: number | null = leerCursor(campo)
    const id: ContentId | null = idDe(campo)
    if (rawCursor === null || id === null) return null
    const raw: string = campo.textContent ?? ""
    const linea: FormattedLine = readMarkdownLine(raw)
    const link: LineLink | null = linkAtCursor(linea, rawCursor)
    return link === null ? null : { campo, id, raw, linea, link, rawCursor }
  }

  const actualizarBurbuja = (): void => {
    const e: EnlaceBajoCursor | null = enlaceBajoCursor()
    if (e === null) {
      burbuja.hide()
      return
    }
    const rectangulo: DOMRect | undefined = window.getSelection()?.getRangeAt(0).getClientRects()[0]
    burbuja.show(e.link.saved, e.campo, element, rectangulo?.left ?? e.campo.getBoundingClientRect().left)
  }

  const abrirEnlace = (): void => {
    const e: EnlaceBajoCursor | null = enlaceBajoCursor()
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
    else onOpenDiagram(destino.id)
  }

  /** La línea deja de ser lo que era: nuevo texto, línea activa en crudo y cursor en su sitio, con el foco. */
  const escribirLinea = (id: ContentId, texto: string, cursor: number): void => {
    const campo: HTMLElement | null = campoDe(id)
    if (campo === null) return
    /* Como el Tabulador: la línea activa no se repinta sola, se le pone el texto. */
    if (campo === activa) campo.textContent = texto
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
    const e: EnlaceBajoCursor | null = enlaceBajoCursor()
    if (e === null) return
    const nuevo: { readonly text: string; readonly cursor: number } = removeLink(
      e.raw,
      e.linea,
      e.link,
      e.rawCursor,
    )
    escribirLinea(e.id, nuevo.text, nuevo.cursor)
  }

  /** Abre la hoja y, al elegir otro destino, lo pone en el enlace con el texto que tenía. */
  const cambiarEnlace = (): void => {
    const e: EnlaceBajoCursor | null = enlaceBajoCursor()
    if (e === null || !e.link.saved) return
    const { id, raw, linea, link }: EnlaceBajoCursor = e
    const poner = (destino: string): void => {
      /* Si la línea cambió o ya no está, el enlace capturado no vale. */
      if (textoDe(id) !== raw) return
      if (destino.includes(")")) {
        briefNotice("Esa dirección no se puede enlazar", AVISO_ROTO_MS)
        return
      }
      const nuevo: { readonly text: string; readonly cursor: number } = changeLinkTarget(
        raw,
        linea,
        link,
        destino,
      )
      if (nuevo.text !== raw) escribirLinea(id, nuevo.text, nuevo.cursor)
    }
    openLinkSheet(sheet, {
      title: "Cambiar enlace",
      choices: linkChoices(state(), noteId),
      onPickAddress: poner,
      onPick: (_tipo: "note" | "diagram", destino: string): void => poner(`#${destino}`),
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
    const campo: HTMLElement | null =
      evento.target instanceof Element ? evento.target.closest<HTMLElement>(".texto") : null
    if (campo === null || campo === activa || arrastro(evento)) return
    /* Se toca lo formateado: la letra de lo que se ve se lleva a la cadena cruda. */
    const visto: number | null = offsetEnPunto(campo, evento.clientX, evento.clientY)
    ponerCursor(campo, visto === null ? crudoDe(campo).length : aCrudo(campo, visto))
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
      const hasta: Range = document.createRange()
      hasta.selectNodeContents(dentro)
      hasta.setEnd(nodo, offset)
      return id === null ? null : { line: id, offset: hasta.toString().length }
    }
    const campos: ReadonlyArray<HTMLElement> = [...lineas.querySelectorAll<HTMLElement>(".texto")]
    const campo: HTMLElement | undefined =
      cual === "inicio"
        ? campos.find((c: HTMLElement): boolean => rango.comparePoint(c, 0) >= 0)
        : [...campos].reverse().find((c: HTMLElement): boolean => rango.comparePoint(c, c.childNodes.length) <= 0)
    const id: ContentId | null = campo === undefined ? null : idDe(campo)
    if (campo === undefined || id === null) return null
    return { line: id, offset: cual === "inicio" ? 0 : (campo.textContent?.length ?? 0) }
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

  /** Retroceso: sólo si el cursor es un punto al principio; si no, lo hace el navegador. */
  const retroceso = (evento: Event): void => {
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
    const largo: number = campo?.textContent?.length ?? 0

    if (evento.key === "Enter" && (evento.ctrlKey || evento.metaKey)) {
      evento.preventDefault()
      toggleChecked(deps, caret.line)
      return
    }
    if (evento.key === "Enter") return intro(evento)
    if (evento.key === "Backspace") return retroceso(evento)
    if (evento.key === "Tab" && !evento.shiftKey && campo !== null) {
      /* El Tabulador mete un carácter, como en cualquier editor: no anida nada. */
      evento.preventDefault()
      const texto: string = campo.textContent ?? ""
      const nuevo: string = `${texto.slice(0, caret.offset)}\t${texto.slice(caret.offset)}`
      campo.textContent = nuevo
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
  })

  lineas.addEventListener("input", (evento: Event): void => {
    const id: ContentId | null = idDe(evento.target)
    const campo: HTMLElement | null = id === null ? null : campoDe(id)
    if (id === null || campo === null) return
    /* Cada tecla va al estado: el guardado diferido ya agrupa lo que va al disco. */
    useCases.setText(noteId, id, campo.textContent ?? "")
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
    const poner = (enlace: string): void => {
      /* Con la hoja abierta la línea pudo borrarse o cambiar: entonces no se escribe. */
      if (textoDe(sel.line) !== raw) return
      escribirLinea(sel.line, raw.slice(0, desde) + enlace + raw.slice(to), desde + enlace.length)
    }
    openLinkSheet(sheet, {
      title: "Enlazar",
      choices: linkChoices(state(), noteId),
      onPickAddress: (direccion: string): void =>
        poner((usable ? buildLink(elegido, direccion) : null) ?? direccion),
      onPick: (_tipo: "note" | "diagram", destino: string, nombre: string): void =>
        poner(buildLink(usable ? elegido : nombre, `#${destino}`) ?? nombre),
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
