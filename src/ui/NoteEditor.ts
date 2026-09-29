/**
 * El editor de una nota en pantalla: cada línea se escribe en su sitio, Intro y
 * Retroceso hacen lo que dicen las tablas del teclado, las flechas saltan de una
 * línea a otra y la barra lleva el interruptor de casilla y anidar.
 *
 * Qué hace cada tecla lo decide `editor.ts`; aquí sólo se leen los eventos y se
 * pone el cursor donde toca. La línea que se está escribiendo no se repinta
 * nunca: ahí manda lo que se teclea.
 */

import type { Content, ContentId, Note, NoteId, UseCases } from "#core/index"
import { contentId, isCheckBox } from "#core/index"
import { elemento } from "./dom.js"
import type { Caret, EditResult, EditorDeps } from "./editor.js"
import {
  pressBackspaceAtStart,
  pressEnter,
  startWriting,
  toggleCheckbox,
  toggleChecked,
} from "./editor.js"
import { lineBeside, locate } from "./noteTree.js"
import { reconcile, setAttrIfChanged, setTextIfChanged } from "./reconcile.js"
import type { WritingMode } from "./writingMode.js"
import { INITIAL_MODE, toggleNest } from "./writingMode.js"

export interface NoteEditorDeps {
  readonly useCases: UseCases
  readonly noteId: NoteId
  readonly note: () => Note | undefined
}

export interface NoteEditor {
  /** Las líneas, o la invitación a escribir si la nota está vacía. */
  readonly element: HTMLElement
  /** Los dos botones del modo, para la barra de abajo. */
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

/** Si el cursor es un punto y no una selección de varios caracteres. */
const cursorColapsado = (): boolean => window.getSelection()?.isCollapsed ?? true

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

export const createNoteEditor = ({ useCases, noteId, note }: NoteEditorDeps): NoteEditor => {
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
  const empezar: HTMLParagraphElement = elemento("p", "Esta nota está vacía. Toca aquí para escribir.")
  empezar.className = "vacia empezar"
  empezar.tabIndex = 0
  empezar.setAttribute("role", "button")
  const element: HTMLElement = elemento("div")
  element.className = "contenido"
  element.append(lineas, empezar)

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
    const campo: HTMLSpanElement = elemento("span")
    campo.className = "texto"
    campo.contentEditable = textoPlano ? "plaintext-only" : "true"
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
        const campo: Element | null = fila.querySelector(":scope > .texto")
        /* ⚠️ La regla del editor: el campo con el foco no se toca, salvo que lo
           haya cambiado una orden. */
        if (campo !== null && (enOrden || campo !== document.activeElement)) {
          setTextIfChanged(campo, l.text)
        }
        if (!isCheckBox(l)) return
        const marca: Element | null = fila.querySelector(":scope > .marca")
        if (marca !== null) {
          setTextIfChanged(marca, l.checked ? "☑" : "☐")
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
  const refresh = (nota: Note): void => {
    /* La MISMA nota si nada cambió —un `set-checked` redundante incluido—: ni se mira el DOM. */
    if (nota === pintada) return
    pintada = nota
    pintarLista(lineas, nota.content)
    empezar.hidden = nota.content.length > 0
  }

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
    if (campo !== null) ponerCursorEn(campo, resultado.caret.offset)
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
    ponerCursorEn(campo, offset)
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
      ponerCursorEn(campo, caret.offset + 1)
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
    return id === null || offset === null ? null : { line: id, offset }
  }
  const recordarCursor = (): void => {
    const ahora: Caret | null = cursorEnVivo()
    if (ahora !== null) ultimo = ahora
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

  const casilla: HTMLButtonElement = botonDeBarra("☐ Casilla", (): void => {
    const caret: Caret | null = cursorRecordado()
    ordenar((): EditResult => toggleCheckbox(deps, caret, modo))
  })
  const anidar: HTMLButtonElement = botonDeBarra("↳ Anidar", (): void => {
    modo = toggleNest(modo)
    pintarBarra()
    const caret: Caret | null = cursorRecordado()
    const campo: HTMLElement | null = caret === null ? null : campoDe(caret.line)
    if (caret !== null && campo !== null) ponerCursorEn(campo, caret.offset)
  })

  const pintarBarra = (): void => {
    casilla.setAttribute("aria-pressed", modo.checkbox ? "true" : "false")
    casilla.classList.toggle("activo", modo.checkbox)
    casilla.textContent = modo.checkbox ? "☑ Casilla" : "☐ Casilla"
    anidar.disabled = !modo.checkbox
    anidar.setAttribute("aria-pressed", modo.nestArmed ? "true" : "false")
    /* ⚠️ El armado tiene que verse: actúa sobre una línea que todavía no existe. */
    anidar.classList.toggle("activo", modo.nestArmed)
    anidar.textContent = modo.nestArmed ? "↳ Anidar: la próxima, dentro" : "↳ Anidar"
  }
  pintarBarra()

  return {
    element,
    modeButtons: [casilla, anidar],
    refresh,
    destroy: (): void => document.removeEventListener("selectionchange", recordarCursor),
  }
}
