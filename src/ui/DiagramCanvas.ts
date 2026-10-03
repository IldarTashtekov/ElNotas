/**
 * El lienzo de un diagrama: un corcho con los pósits encima. El corcho se
 * arrastra con un dedo o con el ratón y se acerca con dos dedos o con la rueda;
 * al montarse enseña su origen en el centro, y dónde se miraba no se recuerda.
 *
 * Doble toque —o clic derecho— en el fondo abre el menú para crear; en un pósit,
 * el suyo: editar, hecho, borrar. Un pósit se mueve arrastrándolo con el ratón, o
 * manteniéndolo pulsado y arrastrando con el dedo, y se guarda una vez, al soltar.
 *
 * Es el mismo en la vista diagrama y en una ventana de diagrama: cada una le pone
 * su marco alrededor.
 */

import type {
  AppState,
  Diagram,
  DiagramId,
  DiagramNode,
  DiagramNodeId,
  Store,
  Unsubscribe,
  UseCases,
} from "#core/index"
import { diagramNodeId } from "#core/index"
import type { BackStack } from "./backStack.js"
import { elemento } from "./dom.js"
import type { Tap } from "./gestures.js"
import { LONG_PRESS_MS, isDoubleTap, movedBeyondTolerance } from "./gestures.js"
import { paintOrder, raise } from "./paintOrder.js"
import { reconcile } from "./reconcile.js"
import type { Sheet } from "./sheet.js"
import { createSheet } from "./sheet.js"
import type { Point, Viewport } from "./viewport.js"
import { centeredViewport, panBy, pinch, toCanvas, wheelFactor, zoomAround } from "./viewport.js"

export interface DiagramCanvasDeps {
  readonly store: Store
  readonly useCases: UseCases
  readonly back: BackStack
  readonly diagramId: DiagramId
}

export interface DiagramCanvas {
  /** El lienzo y su hoja de menús. Va dentro de una columna que le da el alto. */
  readonly element: HTMLElement
  /** Suelta lo que escucha fuera del lienzo. */
  readonly destroy: () => void
}

/** La separación de los puntos del fondo, en unidades del corcho. */
const REJILLA: number = 24
/** Lo que se deja entre un pósit que se edita y el teclado del móvil. */
const MARGEN_TECLADO_PX: number = 16
/** El `target` de un toque en el fondo, para distinguirlo de uno en un pósit. */
const FONDO: string = "fondo"

/** Dos dedos en el lienzo: cómo estaba todo al poner el segundo. */
interface Pellizco {
  readonly inicio: Viewport
  readonly a: number
  readonly b: number
  readonly a0: Point
  readonly b0: Point
}

/** Lo que está haciendo el primer dedo (o el ratón) desde que bajó. */
interface Gesto {
  readonly puntero: number
  readonly tipo: string
  /** El pósit sobre el que bajó, o `null` si fue en el fondo. */
  readonly nodo: DiagramNodeId | null
  readonly origen: Point
  /** Dónde estaba el pósit al empezar, en el corcho. */
  readonly inicioNodo: Point
  /** Se movió más de la tolerancia: ya no es un toque. */
  movido: boolean
  /** El pósit va pegado al dedo. */
  levantado: boolean
  /** Arrastra el corcho, no el pósit. */
  arrastraFondo: boolean
  /** Dónde soltarlo, en el corcho. */
  destino: Point | null
}

export const createDiagramCanvas = ({
  store,
  useCases,
  back,
  diagramId,
}: DiagramCanvasDeps): DiagramCanvas => {
  const diagrama = (): Diagram | undefined => store.getState().diagrams[diagramId]

  const capa: HTMLElement = elemento("div")
  capa.className = "capa"
  const lienzo: HTMLElement = elemento("div")
  lienzo.className = "lienzo"
  lienzo.setAttribute("aria-label", "Lienzo del diagrama")
  lienzo.append(capa)
  const menu: Sheet = createSheet(back)
  /* Transparente para la columna: el lienzo es el que ocupa el sitio. */
  const marco: HTMLElement = elemento("div")
  marco.className = "lienzo-marco"
  marco.append(lienzo, menu.element)

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
  const enLienzo = (evento: MouseEvent): Point => {
    const caja: DOMRect = lienzo.getBoundingClientRect()
    return { x: evento.clientX - caja.left, y: evento.clientY - caja.top }
  }

  /* ── Los pósits ── */

  /** Los levantados en esta visita, para pintarlos encima. No se guarda. */
  let levantados: ReadonlyArray<string> = []
  /** El que se está editando: mientras dura, su texto no se repinta. */
  let editando: DiagramNodeId | null = null

  const textoDe = (nodo: DiagramNode, estado: AppState): string => {
    if (nodo.type === "simple-node") return nodo.text
    return estado.notes[nodo.noteId]?.name ?? "Nota ilegible"
  }

  const positDe = (id: DiagramNodeId): HTMLElement | null =>
    capa.querySelector<HTMLElement>(`.posit[data-id="${CSS.escape(id)}"]`)

  const colocar = (el: HTMLElement, p: Point): void => {
    el.style.left = `${p.x}px`
    el.style.top = `${p.y}px`
  }

  const pintar = (): void => {
    const actual: Diagram | undefined = diagrama()
    if (actual === undefined) return
    const estado: AppState = store.getState()
    const orden: ReadonlyArray<string> = paintOrder(Object.keys(actual.nodes), levantados)
    const nodos: ReadonlyArray<DiagramNode> = orden.flatMap(
      (id: string): ReadonlyArray<DiagramNode> => {
        const nodo: DiagramNode | undefined = actual.nodes[diagramNodeId(id)]
        return nodo === undefined ? [] : [nodo]
      },
    )
    reconcile<DiagramNode, Element>(capa, nodos, {
      key: (nodo: DiagramNode): string => nodo.id,
      keyOf: (el: Element): string | null => el.getAttribute("data-id"),
      create: (nodo: DiagramNode): Element => {
        const el: HTMLElement = elemento("div")
        el.className = "posit"
        el.dataset["id"] = nodo.id
        el.append(elemento("div"))
        el.firstElementChild?.classList.add("texto")
        return el
      },
      update: (el: Element, nodo: DiagramNode): void => {
        if (!(el instanceof HTMLElement)) return
        /* El que se arrastra lo coloca el dedo, no el estado. */
        if (gesto?.nodo !== nodo.id || !gesto.levantado) {
          colocar(el, { x: nodo.positionX, y: nodo.positionY })
        }
        el.classList.toggle("hecho", nodo.done)
        el.classList.toggle("nota", nodo.type === "note-node")
        const texto: Element | null = el.querySelector(".texto")
        const nuevo: string = textoDe(nodo, estado)
        if (texto !== null && editando !== nodo.id && texto.textContent !== nuevo) {
          texto.textContent = nuevo
        }
      },
    })
  }

  /* ── Editar el texto dentro del pósit ── */

  /** Que el teclado del móvil no tape el pósit que se edita: si lo tapa, sube el corcho. */
  const asomar = (): void => {
    if (editando === null) return
    const el: HTMLElement | null = positDe(editando)
    if (el === null) return
    const caja: DOMRect = el.getBoundingClientRect()
    const visible: VisualViewport | null = window.visualViewport
    const abajo: number =
      (visible === null ? window.innerHeight : visible.offsetTop + visible.height) -
      MARGEN_TECLADO_PX
    if (caja.bottom > abajo) {
      vista = panBy(vista, 0, abajo - caja.bottom)
      aplicar()
    }
  }
  window.visualViewport?.addEventListener("resize", asomar)

  const editar = (id: DiagramNodeId): void => {
    const nodo: DiagramNode | undefined = diagrama()?.nodes[id]
    const el: HTMLElement | null = positDe(id)
    const texto: HTMLElement | null = el?.querySelector<HTMLElement>(".texto") ?? null
    if (nodo?.type !== "simple-node" || el === null || texto === null || editando !== null) return

    const campo: HTMLTextAreaElement = elemento("textarea")
    campo.className = "posit-campo"
    campo.value = nodo.text
    campo.setAttribute("aria-label", "Texto del nodo")
    const ajustarAlto = (): void => {
      campo.style.height = "auto"
      campo.style.height = `${campo.scrollHeight}px`
    }
    let hecho: boolean = false
    const terminar = (guardar: boolean): void => {
      if (hecho) return
      /* Antes de tocar el DOM: quitar el campo dispara su `blur`, que vuelve aquí. */
      hecho = true
      editando = null
      const valor: string = campo.value
      campo.replaceWith(texto)
      if (guardar) useCases.setNodeText(diagramId, id, valor)
      pintar()
    }
    campo.addEventListener("input", ajustarAlto)
    campo.addEventListener("keydown", (evento: KeyboardEvent): void => {
      /* Intro guarda; Mayúsculas+Intro, otra línea. */
      if (evento.key === "Enter" && !evento.shiftKey) {
        evento.preventDefault()
        terminar(true)
      }
      if (evento.key === "Escape") terminar(false)
    })
    campo.addEventListener("blur", (): void => terminar(true))

    editando = id
    texto.replaceWith(campo)
    ajustarAlto()
    campo.focus()
    asomar()
  }

  /* ── Los menús ── */

  /** Las opciones de un menú, una debajo de otra, como las de ⋮ en la configuración. */
  const acciones = (...botones: ReadonlyArray<HTMLButtonElement>): ReadonlyArray<HTMLElement> => {
    const caja: HTMLElement = elemento("div")
    caja.className = "hoja-acciones"
    caja.append(...botones)
    return [caja]
  }

  const opcion = (texto: string, alPulsar: () => void, clase?: string): HTMLButtonElement => {
    const b: HTMLButtonElement = elemento("button", texto)
    b.type = "button"
    if (clase !== undefined) b.className = clase
    b.addEventListener("click", (): void => {
      menu.close()
      alPulsar()
    })
    return b
  }

  /** Crear en el sitio donde se pidió. */
  const menuFondo = (donde: Point): void => {
    const p: Point = toCanvas(vista, donde)
    menu.open("Añadir al diagrama", acciones(
      opcion("Texto", (): void => {
        const antes: ReadonlySet<string> = new Set<string>(Object.keys(diagrama()?.nodes ?? {}))
        const despues: Diagram | null = useCases.addTextNode(diagramId, "", p.x, p.y)
        const nuevo: string | undefined = Object.keys(despues?.nodes ?? {}).find(
          (id: string): boolean => !antes.has(id),
        )
        if (nuevo === undefined) return
        levantados = raise(levantados, nuevo)
        pintar()
        editar(diagramNodeId(nuevo))
      }),
    ))
  }

  const menuNodo = (id: DiagramNodeId): void => {
    const nodo: DiagramNode | undefined = diagrama()?.nodes[id]
    if (nodo === undefined) return
    const titulo: string = textoDe(nodo, store.getState())
    menu.open(titulo === "" ? "Nodo" : titulo, acciones(
      ...(nodo.type === "simple-node" ? [opcion("Editar", (): void => editar(id))] : []),
      opcion(nodo.done ? "Desmarcar hecho" : "Marcar hecho", (): void => {
        useCases.setNodeDone(diagramId, id, !nodo.done)
      }),
      opcion("Borrar", (): void => {
        useCases.removeNode(diagramId, id)
      }, "peligro"),
    ))
  }

  /* ── Los gestos ── */

  const punteros: Map<number, Point> = new Map<number, Point>()
  let pellizco: Pellizco | null = null
  let gesto: Gesto | null = null
  let espera: ReturnType<typeof setTimeout> | null = null
  /** El último toque suelto, para reconocer el segundo de un doble toque. */
  let toqueAnterior: Tap | null = null

  const cancelarEspera = (): void => {
    if (espera !== null) clearTimeout(espera)
    espera = null
  }

  const levantar = (g: Gesto): void => {
    if (g.nodo === null) return
    g.levantado = true
    levantados = raise(levantados, g.nodo)
    pintar()
    positDe(g.nodo)?.classList.add("levantado")
  }

  const empezarPellizco = (): void => {
    const [a, b] = [...punteros.entries()]
    if (a === undefined || b === undefined) return
    pellizco = { inicio: vista, a: a[0], b: b[0], a0: a[1], b0: b[1] }
  }

  /** El pósit sobre el que cayó un evento, o `null` si fue en el fondo. */
  const nodoDe = (objetivo: EventTarget | null): DiagramNodeId | null => {
    const el: HTMLElement | null =
      objetivo instanceof Element ? objetivo.closest<HTMLElement>(".posit[data-id]") : null
    const id: string | undefined = el?.dataset["id"]
    return id === undefined ? null : diagramNodeId(id)
  }

  lienzo.addEventListener("pointerdown", (evento: PointerEvent): void => {
    if (evento.pointerType === "mouse" && evento.button !== 0) return
    /* Dentro del campo que se edita, el dedo es del campo. */
    if (evento.target instanceof Element && evento.target.closest(".posit-campo") !== null) return
    const donde: Point = enLienzo(evento)
    punteros.set(evento.pointerId, donde)

    if (punteros.size === 2) {
      /* El segundo dedo es un pellizco: lo que hiciera el primero se olvida. */
      cancelarEspera()
      if (gesto?.levantado === true && gesto.nodo !== null) {
        positDe(gesto.nodo)?.classList.remove("levantado")
        pintar()
      }
      gesto = null
      empezarPellizco()
      return
    }
    if (punteros.size !== 1) return

    const nodo: DiagramNodeId | null = nodoDe(evento.target)
    const n: DiagramNode | undefined = nodo === null ? undefined : diagrama()?.nodes[nodo]
    const g: Gesto = {
      puntero: evento.pointerId,
      tipo: evento.pointerType,
      nodo,
      origen: donde,
      inicioNodo: { x: n?.positionX ?? 0, y: n?.positionY ?? 0 },
      movido: false,
      levantado: false,
      arrastraFondo: nodo === null,
      destino: null,
    }
    gesto = g
    /* Con el dedo, el pósit se levanta manteniéndolo pulsado; con el ratón, arrastrando. */
    if (nodo !== null && evento.pointerType !== "mouse") {
      espera = setTimeout((): void => {
        espera = null
        if (gesto === g && !g.movido) levantar(g)
      }, LONG_PRESS_MS)
    }
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
      aplicar()
      return
    }

    const g: Gesto | null = gesto
    if (g === null || g.puntero !== evento.pointerId) return
    if (!g.movido && movedBeyondTolerance(g.origen, ahora)) {
      g.movido = true
      cancelarEspera()
      /* Con el ratón, arrastrar un pósit lo levanta; con el dedo sin esperar, arrastra el corcho. */
      if (g.nodo !== null && !g.levantado) {
        if (g.tipo === "mouse") levantar(g)
        else g.arrastraFondo = true
      }
      if (g.arrastraFondo) lienzo.classList.add("moviendo")
    }
    if (!g.movido) return

    if (g.levantado && g.nodo !== null) {
      g.destino = {
        x: g.inicioNodo.x + (ahora.x - g.origen.x) / vista.scale,
        y: g.inicioNodo.y + (ahora.y - g.origen.y) / vista.scale,
      }
      const el: HTMLElement | null = positDe(g.nodo)
      if (el !== null) colocar(el, g.destino)
    } else if (g.arrastraFondo) {
      vista = panBy(vista, ahora.x - antes.x, ahora.y - antes.y)
      aplicar()
    }
  }

  /** Un toque suelto, sin moverse: puede ser el segundo de un doble toque. */
  const tocado = (g: Gesto, donde: Point, cuando: number): void => {
    const toque: Tap = { x: donde.x, y: donde.y, time: cuando, target: g.nodo ?? FONDO }
    if (isDoubleTap(toqueAnterior, toque)) {
      toqueAnterior = null
      if (g.nodo === null) menuFondo(donde)
      else menuNodo(g.nodo)
      return
    }
    toqueAnterior = toque
  }

  const soltar = (evento: PointerEvent): void => {
    const donde: Point | undefined = punteros.get(evento.pointerId)
    if (!punteros.delete(evento.pointerId) || donde === undefined) return
    if (pellizco !== null) {
      /* Si quedan dos o más dedos, otro pellizco; con uno, ni toque ni arrastre. */
      pellizco = null
      if (punteros.size >= 2) empezarPellizco()
      if (punteros.size === 0) lienzo.classList.remove("moviendo")
      return
    }

    const g: Gesto | null = gesto
    cancelarEspera()
    gesto = null
    lienzo.classList.remove("moviendo")
    if (g === null || g.puntero !== evento.pointerId) return

    if (g.levantado && g.nodo !== null) {
      positDe(g.nodo)?.classList.remove("levantado")
      /* Se guarda una vez, al soltar. Si no se movió, no hay nada que guardar. */
      if (g.destino !== null) useCases.setNodePosition(diagramId, g.nodo, g.destino.x, g.destino.y)
      pintar()
      return
    }
    if (!g.movido && evento.type === "pointerup") tocado(g, donde, evento.timeStamp)
  }

  window.addEventListener("pointermove", mover)
  window.addEventListener("pointerup", soltar)
  window.addEventListener("pointercancel", soltar)

  /* El clic derecho abre los mismos menús. En táctil este evento llega con la
     pulsación larga, que ya es levantar el pósit: ahí no hace nada. */
  lienzo.addEventListener("contextmenu", (evento: MouseEvent): void => {
    evento.preventDefault()
    if (evento instanceof PointerEvent && evento.pointerType !== "mouse") return
    if (gesto?.levantado === true) return
    const nodo: DiagramNodeId | null = nodoDe(evento.target)
    if (nodo === null) menuFondo(enLienzo(evento))
    else menuNodo(nodo)
  })

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
  pintar()
  const baja: Unsubscribe = store.subscribe((): void => pintar())

  return {
    element: marco,
    destroy: (): void => {
      baja()
      cancelarEspera()
      medida.disconnect()
      window.visualViewport?.removeEventListener("resize", asomar)
      window.removeEventListener("pointermove", mover)
      window.removeEventListener("pointerup", soltar)
      window.removeEventListener("pointercancel", soltar)
    },
  }
}
