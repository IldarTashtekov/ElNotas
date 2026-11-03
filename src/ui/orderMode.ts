/**
 * El modo Ordenar de una nota en pantalla: con él puesto no se escribe, tocar una
 * línea la elige o la suelta, y el ⠿ de cada una la arrastra —con las elegidas,
 * si lo está— hasta donde enseña la raya. La profundidad la da lo a la derecha
 * que vaya el dedo, y junto al borde de la pantalla la nota se desplaza sola.
 *
 * Qué se lleva y dónde cae lo decide `lineOrder`; aquí se mide y se pinta.
 */

import type { Content, ContentId, Position } from "#core/index"
import { contentId } from "#core/index"
import { elemento } from "./dom.js"
import type { DropTarget, FlatLine } from "./lineOrder.js"
import { dropTarget, flatLines, linesToMove, movesText, remainingLines } from "./lineOrder.js"

/** Lo que se mueve el dedo antes de que un toque en el ⠿ sea un arrastre. */
const ARRASTRE_PX: number = 5
/** Cerca de un borde de la pantalla la nota se desplaza sola, a paso fijo. */
const BORDE_PX: number = 48
const PASO_PX: number = 8
/** La sangría de las hijas si no hay ninguna que medir: la de `.hijas`. */
const SANGRIA_REM: number = 1.6

export interface OrderModeDeps {
  /** El contenido de la nota, donde se pinta la raya. */
  readonly element: HTMLElement
  /** Las líneas, cada una con su `data-id` y su ⠿. */
  readonly lines: HTMLElement
  readonly content: () => ReadonlyArray<Content> | null
  readonly onMove: (ids: ReadonlyArray<ContentId>, at: Position) => void
  /** Al entrar o salir del modo: el editor deja de escribir y apaga su barra. */
  readonly onToggle: (on: boolean) => void
}

export interface OrderMode {
  /** «⠿», Ordenar, para la barra de la nota. */
  readonly button: HTMLButtonElement
  readonly active: () => boolean
  /** Tras repintar las líneas: olvida las elegidas que ya no están y las marca. */
  readonly refresh: () => void
  readonly destroy: () => void
}

interface Arrastre {
  readonly mueve: ReadonlyArray<ContentId>
  readonly resto: ReadonlyArray<FlatLine>
  readonly soloRaiz: boolean
  readonly inicioX: number
  readonly inicioY: number
  readonly hondura: number
  readonly sangria: number
  readonly raya: HTMLElement
  x: number
  y: number
  movido: boolean
  destino: DropTarget | null
  velocidad: number
  marco: number | null
}

export const createOrderMode = ({ element, lines, content, onMove, onToggle }: OrderModeDeps): OrderMode => {
  let activo: boolean = false
  let elegidas: ReadonlySet<ContentId> = new Set<ContentId>()
  let arrastre: Arrastre | null = null
  /** Tras arrastrar llega un `click` sobre el ⠿: ése no elige. */
  let tragarClick: boolean = false

  const button: HTMLButtonElement = elemento("button", "⠿")
  button.type = "button"
  button.setAttribute("aria-label", "Ordenar")
  button.title = "Ordenar"
  button.className = "ordenar"
  button.addEventListener("pointerdown", (evento: PointerEvent): void => evento.preventDefault())

  const idDe = (objetivo: EventTarget | null): ContentId | null => {
    const fila: Element | null = objetivo instanceof Element ? objetivo.closest(".linea[data-id]") : null
    const bruto: string | null = fila !== null && lines.contains(fila) ? fila.getAttribute("data-id") : null
    return bruto === null ? null : contentId(bruto)
  }

  const filaDe = (id: ContentId): HTMLElement | null =>
    lines.querySelector<HTMLElement>(`.linea[data-id="${CSS.escape(id)}"]`)

  /** El renglón propio de una línea, sin sus hijas: su texto. */
  const renglonDe = (id: ContentId): DOMRect | null =>
    filaDe(id)?.querySelector<HTMLElement>(":scope > .texto")?.getBoundingClientRect() ?? null

  const refresh = (): void => {
    const nota: ReadonlyArray<Content> | null = content()
    const existen: ReadonlySet<ContentId> = new Set<ContentId>(
      (nota === null ? [] : flatLines(nota)).map((l: FlatLine): ContentId => l.id),
    )
    if ([...elegidas].some((id: ContentId): boolean => !existen.has(id))) {
      elegidas = new Set<ContentId>([...elegidas].filter((id: ContentId): boolean => existen.has(id)))
    }
    for (const fila of lines.querySelectorAll<HTMLElement>(".linea[data-id]")) {
      const id: string | null = fila.getAttribute("data-id")
      const elegida: boolean = activo && id !== null && elegidas.has(contentId(id))
      if (fila.classList.contains("elegida") !== elegida) fila.classList.toggle("elegida", elegida)
    }
  }

  const poner = (on: boolean): void => {
    if (activo === on) return
    activo = on
    elegidas = new Set<ContentId>()
    element.classList.toggle("ordenando", on)
    button.classList.toggle("activo", on)
    button.setAttribute("aria-pressed", on ? "true" : "false")
    onToggle(on)
    refresh()
  }
  button.setAttribute("aria-pressed", "false")
  button.addEventListener("click", (): void => poner(!activo))

  /* ── Elegir: en el modo, cualquier toque en la nota es para esto, y no llega al editor ── */

  const alTocar = (evento: MouseEvent): void => {
    if (!activo) return
    evento.stopPropagation()
    evento.preventDefault()
    if (tragarClick) {
      tragarClick = false
      return
    }
    const id: ContentId | null = idDe(evento.target)
    if (id === null) return
    elegidas = elegidas.has(id)
      ? new Set<ContentId>([...elegidas].filter((e: ContentId): boolean => e !== id))
      : new Set<ContentId>([...elegidas, id])
    refresh()
  }
  element.addEventListener("click", alTocar, true)

  const alBajar = (evento: PointerEvent): void => {
    if (!activo) return
    /* El editor no se entera: ni apaga ni enciende líneas. */
    evento.stopPropagation()
    tragarClick = false
    if (evento.target instanceof Element && evento.target.closest(".asa") !== null) empezar(evento)
  }
  element.addEventListener("pointerdown", alBajar, true)

  /* ── Arrastrar desde el ⠿ ── */

  const medirSangria = (): number => {
    const hijas: HTMLElement | null = lines.querySelector<HTMLElement>(".hijas")
    const medida: number = hijas === null ? Number.NaN : Number.parseFloat(getComputedStyle(hijas).paddingLeft)
    return Number.isFinite(medida) && medida > 0
      ? medida
      : SANGRIA_REM * Number.parseFloat(getComputedStyle(document.documentElement).fontSize)
  }

  const empezar = (evento: PointerEvent): void => {
    const nota: ReadonlyArray<Content> | null = content()
    const id: ContentId | null = idDe(evento.target)
    if (nota === null || id === null) return
    evento.preventDefault()
    const mueve: ReadonlyArray<ContentId> = linesToMove(nota, elegidas, id)
    const hondura: number = flatLines(nota).find((l: FlatLine): boolean => l.id === id)?.depth ?? 0
    const raya: HTMLElement = elemento("div")
    raya.className = "raya-orden"
    raya.hidden = true
    element.append(raya)
    arrastre = {
      mueve,
      resto: remainingLines(nota, mueve),
      soloRaiz: movesText(nota, mueve),
      inicioX: evento.clientX,
      inicioY: evento.clientY,
      hondura,
      sangria: medirSangria(),
      raya,
      x: evento.clientX,
      y: evento.clientY,
      movido: false,
      destino: null,
      velocidad: 0,
      marco: null,
    }
    document.addEventListener("pointermove", mover)
    document.addEventListener("pointerup", soltar)
    document.addEventListener("pointercancel", cancelar)
  }

  /** El hueco bajo el dedo, la profundidad que pide y dónde se pinta la raya. */
  const situar = (a: Arrastre): void => {
    const hueco: number = a.resto.filter((l: FlatLine): boolean => {
      const r: DOMRect | null = renglonDe(l.id)
      return r !== null && r.top + r.height / 2 < a.y
    }).length
    a.destino = dropTarget(a.resto, hueco, a.hondura + (a.x - a.inicioX) / a.sangria, a.soloRaiz)
    const encima: FlatLine | undefined = a.resto[hueco - 1]
    const debajo: FlatLine | undefined = a.resto[hueco]
    const renglon: DOMRect | null =
      encima !== undefined ? renglonDe(encima.id) : debajo !== undefined ? renglonDe(debajo.id) : null
    if (a.destino === null || renglon === null) {
      a.raya.hidden = true
      return
    }
    const caja: DOMRect = element.getBoundingClientRect()
    const izquierda: number = lines.getBoundingClientRect().left - caja.left + a.destino.depth * a.sangria
    a.raya.hidden = false
    a.raya.style.top = `${(encima !== undefined ? renglon.bottom : renglon.top) - caja.top}px`
    a.raya.style.left = `${izquierda}px`
    a.raya.style.width = `${Math.max(0, caja.width - izquierda)}px`
  }

  /* Junto al borde, la nota se desplaza sola mientras el dedo siga ahí. */
  const desplazar = (): void => {
    const a: Arrastre | null = arrastre
    if (a === null || a.velocidad === 0) {
      if (a !== null) a.marco = null
      return
    }
    window.scrollBy(0, a.velocidad)
    situar(a)
    a.marco = requestAnimationFrame(desplazar)
  }

  const mover = (evento: PointerEvent): void => {
    const a: Arrastre | null = arrastre
    if (a === null) return
    a.x = evento.clientX
    a.y = evento.clientY
    /* Hasta que el dedo se aleja, aún puede ser un toque: el ⠿ también elige. */
    if (!a.movido && Math.hypot(a.x - a.inicioX, a.y - a.inicioY) <= ARRASTRE_PX) return
    if (!a.movido) {
      a.movido = true
      for (const id of a.mueve) filaDe(id)?.classList.add("moviendo")
      element.classList.add("arrastrando")
    }
    situar(a)
    a.velocidad = a.y < BORDE_PX ? -PASO_PX : a.y > window.innerHeight - BORDE_PX ? PASO_PX : 0
    if (a.velocidad !== 0 && a.marco === null) a.marco = requestAnimationFrame(desplazar)
  }

  const acabar = (): Arrastre | null => {
    const a: Arrastre | null = arrastre
    arrastre = null
    document.removeEventListener("pointermove", mover)
    document.removeEventListener("pointerup", soltar)
    document.removeEventListener("pointercancel", cancelar)
    if (a === null) return null
    if (a.marco !== null) cancelAnimationFrame(a.marco)
    a.raya.remove()
    element.classList.remove("arrastrando")
    for (const fila of lines.querySelectorAll(".moviendo")) fila.classList.remove("moviendo")
    return a
  }

  const soltar = (): void => {
    const a: Arrastre | null = acabar()
    if (a === null || !a.movido) return
    tragarClick = true
    if (a.destino !== null) onMove(a.mueve, a.destino.position)
  }

  const cancelar = (): void => {
    const a: Arrastre | null = acabar()
    if (a !== null && a.movido) tragarClick = true
  }

  return {
    button,
    active: (): boolean => activo,
    refresh,
    destroy: (): void => {
      acabar()
      element.removeEventListener("click", alTocar, true)
      element.removeEventListener("pointerdown", alBajar, true)
    },
  }
}
