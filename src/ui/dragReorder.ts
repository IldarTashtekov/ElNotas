/**
 * Reordenar arrastrando las fichas de una fila que se desliza: se mantiene
 * pulsada una ficha medio segundo, se levanta y se arrastra; al soltar, avisa de
 * dónde ha caído. Con dedo y con ratón por igual.
 *
 * Antes de levantarse, mover el dedo es deslizar la fila, no arrastrar. La fila
 * puede ser horizontal (las fichas de ⚙) o vertical (la lista de grupos).
 * Devuelve la función que lo suelta todo, para cuando se desmonta la fila.
 */

import { dropIndex } from "./dropIndex.js"

/** Lo que dura la pulsación que levanta una ficha, y cuánto se puede mover el dedo antes. */
const PULSACION_LARGA_MS: number = 500
const TOLERANCIA_PX: number = 10
/** Cerca de un borde la fila se desliza sola, para llegar a lo que no se ve. */
const BORDE_PX: number = 40
const PASO_PX: number = 10

export interface DragReorderOptions {
  /** Las fichas que se arrastran, dentro de la fila. Las demás ni se mueven ni cuentan. */
  readonly fichas: string
  /** Lo que, dentro de una ficha, no la levanta: sus botones. */
  readonly ignorar: string
  readonly onMove: (de: number, a: number) => void
  /** Hacia dónde se alinean las fichas; por omisión, horizontal. */
  readonly eje?: "x" | "y"
}

interface Arrastre {
  readonly el: HTMLElement
  readonly de: number
  readonly todas: ReadonlyArray<HTMLElement>
  /** Centros de las fichas al levantarla, medidos en el contenido de la fila (con su scroll). */
  readonly centros: ReadonlyArray<number>
  /** Lo que se corren las demás para hacerle hueco: su ancho más el espacio entre fichas. */
  readonly hueco: number
  readonly inicio: number
  a: number
}

export const attachDragReorder = (fila: HTMLElement, opciones: DragReorderOptions): (() => void) => {
  let espera: ReturnType<typeof setTimeout> | null = null
  let origen: { readonly x: number; readonly y: number } = { x: 0, y: 0 }
  let candidata: HTMLElement | null = null
  let arrastre: Arrastre | null = null
  const vertical: boolean = opciones.eje === "y"

  const fichas = (): ReadonlyArray<HTMLElement> =>
    [...fila.querySelectorAll<HTMLElement>(opciones.fichas)]

  /** La posición del dedo a lo largo de la fila, dentro de su contenido: no cambia al deslizarla. */
  const enContenido = (evento: { readonly clientX: number; readonly clientY: number }): number =>
    vertical
      ? evento.clientY - fila.getBoundingClientRect().top + fila.scrollTop
      : evento.clientX - fila.getBoundingClientRect().left + fila.scrollLeft

  const cancelarEspera = (): void => {
    if (espera !== null) clearTimeout(espera)
    espera = null
  }

  const levantar = (el: HTMLElement): void => {
    const todas: ReadonlyArray<HTMLElement> = fichas()
    const de: number = todas.indexOf(el)
    if (de === -1) return
    const caja: DOMRect = fila.getBoundingClientRect()
    const origenFila: number = vertical ? caja.top - fila.scrollTop : caja.left - fila.scrollLeft
    const centros: ReadonlyArray<number> = todas.map((f: HTMLElement): number => {
      const r: DOMRect = f.getBoundingClientRect()
      return vertical ? r.top - origenFila + r.height / 2 : r.left - origenFila + r.width / 2
    })
    const estilo: CSSStyleDeclaration = getComputedStyle(fila)
    const separacion: number = Number.parseFloat(vertical ? estilo.rowGap : estilo.columnGap) || 0
    const medida: DOMRect = el.getBoundingClientRect()
    const hueco: number = (vertical ? medida.height : medida.width) + separacion
    arrastre = { el, de, todas, centros, hueco, inicio: enContenido({ clientX: origen.x, clientY: origen.y }), a: de }
    el.classList.add("levantada")
    fila.classList.add("arrastrando")
  }

  const soltar = (aplicar: boolean): void => {
    const a: Arrastre | null = arrastre
    arrastre = null
    candidata = null
    cancelarEspera()
    if (a === null) return
    for (const f of a.todas) f.style.transform = ""
    a.el.classList.remove("levantada")
    fila.classList.remove("arrastrando")
    /* Al soltar, el navegador da un clic en la ficha: no es de nadie. */
    const tragar = (evento: Event): void => evento.stopPropagation()
    fila.addEventListener("click", tragar, { capture: true, once: true })
    setTimeout((): void => fila.removeEventListener("click", tragar, { capture: true }), 0)
    if (aplicar && a.a !== a.de) opciones.onMove(a.de, a.a)
  }

  fila.addEventListener("pointerdown", (evento: PointerEvent): void => {
    if (evento.button !== 0 || !(evento.target instanceof Element)) return
    if (evento.target.closest(opciones.ignorar) !== null) return
    const el: HTMLElement | null = evento.target.closest<HTMLElement>(opciones.fichas)
    if (el === null) return
    origen = { x: evento.clientX, y: evento.clientY }
    candidata = el
    cancelarEspera()
    espera = setTimeout((): void => {
      espera = null
      if (candidata === el) levantar(el)
    }, PULSACION_LARGA_MS)
  })

  /* En la ventana y no en la fila: con el ratón se puede salir de ella arrastrando. */
  const mover = (evento: PointerEvent): void => {
    if (candidata === null && arrastre === null) return
    if (arrastre === null) {
      const lejos: boolean =
        Math.abs(evento.clientX - origen.x) > TOLERANCIA_PX ||
        Math.abs(evento.clientY - origen.y) > TOLERANCIA_PX
      if (lejos) {
        cancelarEspera()
        candidata = null
      }
      return
    }
    const caja: DOMRect = fila.getBoundingClientRect()
    if (vertical) {
      if (evento.clientY < caja.top + BORDE_PX) fila.scrollTop -= PASO_PX
      else if (evento.clientY > caja.bottom - BORDE_PX) fila.scrollTop += PASO_PX
    } else if (evento.clientX < caja.left + BORDE_PX) fila.scrollLeft -= PASO_PX
    else if (evento.clientX > caja.right - BORDE_PX) fila.scrollLeft += PASO_PX

    const x: number = enContenido(evento)
    const a: Arrastre = arrastre
    a.a = dropIndex(a.centros, a.de, x)
    const traslado = (px: number): string => (vertical ? `translateY(${px}px)` : `translateX(${px}px)`)
    a.el.style.transform = traslado(x - a.inicio)
    /* Las de en medio se corren un puesto hacia donde estaba la levantada. */
    a.todas.forEach((f: HTMLElement, j: number): void => {
      if (j === a.de) return
      const corre: number =
        a.de < a.a && j > a.de && j <= a.a ? -a.hueco : a.a < a.de && j >= a.a && j < a.de ? a.hueco : 0
      f.style.transform = corre === 0 ? "" : traslado(corre)
    })
  }
  const alSoltar = (): void => soltar(true)
  const alCancelar = (): void => soltar(false)
  window.addEventListener("pointermove", mover)
  window.addEventListener("pointerup", alSoltar)
  window.addEventListener("pointercancel", alCancelar)
  /* Con el ratón, la pulsación larga no saca el menú contextual: ése lo da ⋮. */
  fila.addEventListener("contextmenu", (evento: MouseEvent): void => {
    if (candidata !== null || arrastre !== null) evento.preventDefault()
  })
  /* Con la ficha levantada, el dedo arrastra y no desliza la fila. Tiene que ser
     no pasivo: uno pasivo no puede impedir el deslizamiento. */
  fila.addEventListener(
    "touchmove",
    (evento: TouchEvent): void => {
      if (arrastre !== null) evento.preventDefault()
    },
    { passive: false },
  )

  return (): void => {
    soltar(false)
    window.removeEventListener("pointermove", mover)
    window.removeEventListener("pointerup", alSoltar)
    window.removeEventListener("pointercancel", alCancelar)
  }
}
