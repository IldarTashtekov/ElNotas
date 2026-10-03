/**
 * El lienzo de un diagrama: un corcho que se arrastra con un dedo o con el ratón,
 * se acerca con dos dedos o con la rueda, y al montarse enseña su origen en el
 * centro. Dónde se estaba mirando no se recuerda.
 *
 * Es el mismo en la vista diagrama y en una ventana de diagrama: cada una le pone
 * su marco alrededor.
 */

import type { DiagramId, Store } from "#core/index"
import { elemento } from "./dom.js"
import type { Point, Viewport } from "./viewport.js"
import { centeredViewport, panBy, pinch, wheelFactor, zoomAround } from "./viewport.js"

export interface DiagramCanvasDeps {
  readonly store: Store
  readonly diagramId: DiagramId
}

export interface DiagramCanvas {
  readonly element: HTMLElement
  /** Suelta lo que escucha fuera del lienzo. */
  readonly destroy: () => void
}

/** La separación de los puntos del fondo, en unidades del corcho. */
const REJILLA: number = 24

/** Dos dedos en el lienzo: cómo estaba todo al poner el segundo. */
interface Pellizco {
  readonly inicio: Viewport
  readonly a: number
  readonly b: number
  readonly a0: Point
  readonly b0: Point
}

export const createDiagramCanvas = (_deps: DiagramCanvasDeps): DiagramCanvas => {
  const capa: HTMLElement = elemento("div")
  capa.className = "capa"
  const lienzo: HTMLElement = elemento("div")
  lienzo.className = "lienzo"
  lienzo.setAttribute("aria-label", "Lienzo del diagrama")
  lienzo.append(capa)

  /* ── El encuadre ── */

  let vista: Viewport = { offsetX: 0, offsetY: 0, scale: 1 }
  /* Al montarlo todavía no se ve y no mide nada: se centra la primera vez que tiene tamaño. */
  let centrado: boolean = false

  const aplicar = (): void => {
    capa.style.transform = `translate(${vista.offsetX}px, ${vista.offsetY}px) scale(${vista.scale})`
    const paso: number = REJILLA * vista.scale
    lienzo.style.backgroundSize = `${paso}px ${paso}px`
    lienzo.style.backgroundPosition = `${vista.offsetX}px ${vista.offsetY}px`
  }

  const medida: ResizeObserver = new ResizeObserver((): void => {
    if (centrado || lienzo.clientWidth === 0) return
    centrado = true
    vista = centeredViewport(lienzo.clientWidth, lienzo.clientHeight)
    aplicar()
  })
  medida.observe(lienzo)

  /** Dónde cae un puntero, en píxeles desde la esquina del lienzo. */
  const enLienzo = (evento: PointerEvent | WheelEvent): Point => {
    const caja: DOMRect = lienzo.getBoundingClientRect()
    return { x: evento.clientX - caja.left, y: evento.clientY - caja.top }
  }

  /* ── Mover y acercar ── */

  const punteros: Map<number, Point> = new Map<number, Point>()
  let pellizco: Pellizco | null = null

  const empezarPellizco = (): void => {
    const [a, b] = [...punteros.entries()]
    if (a === undefined || b === undefined) return
    pellizco = { inicio: vista, a: a[0], b: b[0], a0: a[1], b0: b[1] }
  }

  lienzo.addEventListener("pointerdown", (evento: PointerEvent): void => {
    if (evento.pointerType === "mouse" && evento.button !== 0) return
    punteros.set(evento.pointerId, enLienzo(evento))
    if (punteros.size === 2) empezarPellizco()
    lienzo.classList.add("moviendo")
  })

  /* En la ventana y no en el lienzo: con el ratón se puede salir de él arrastrando. */
  const mover = (evento: PointerEvent): void => {
    const antes: Point | undefined = punteros.get(evento.pointerId)
    if (antes === undefined) return
    const ahora: Point = enLienzo(evento)
    punteros.set(evento.pointerId, ahora)

    if (pellizco !== null) {
      const p: Pellizco = pellizco
      const a1: Point | undefined = punteros.get(p.a)
      const b1: Point | undefined = punteros.get(p.b)
      if (a1 === undefined || b1 === undefined) return
      vista = pinch(p.inicio, p.a0, p.b0, a1, b1)
    } else if (punteros.size === 1) {
      vista = panBy(vista, ahora.x - antes.x, ahora.y - antes.y)
    }
    aplicar()
  }

  const soltar = (evento: PointerEvent): void => {
    if (!punteros.delete(evento.pointerId)) return
    /* Si queda un dedo, sigue arrastrando desde donde está; con dos o más, otro pellizco. */
    pellizco = null
    if (punteros.size >= 2) empezarPellizco()
    if (punteros.size === 0) lienzo.classList.remove("moviendo")
  }

  window.addEventListener("pointermove", mover)
  window.addEventListener("pointerup", soltar)
  window.addEventListener("pointercancel", soltar)

  /* No pasivo: uno pasivo no puede impedir que la rueda desplace la página. El
     pellizco del trackpad también llega por aquí, como rueda con Ctrl. */
  lienzo.addEventListener(
    "wheel",
    (evento: WheelEvent): void => {
      evento.preventDefault()
      vista = zoomAround(vista, enLienzo(evento), wheelFactor(evento.deltaY))
      aplicar()
    },
    { passive: false },
  )

  aplicar()

  return {
    element: lienzo,
    destroy: (): void => {
      medida.disconnect()
      window.removeEventListener("pointermove", mover)
      window.removeEventListener("pointerup", soltar)
      window.removeEventListener("pointercancel", soltar)
    },
  }
}
