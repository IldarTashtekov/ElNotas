/**
 * El lienzo de un diagrama: un corcho con los pósits encima, y por debajo las
 * líneas de sus relaciones, que los siguen cuando se mueven. El corcho se
 * arrastra con un dedo o con el ratón y se acerca con dos dedos o con la rueda;
 * al montarse vuelve a donde se miraba la última vez, o enseña su origen en el
 * centro si nunca se movió. La mira lo devuelve al origen: abajo a la derecha del
 * lienzo, o en la barra de quien lo monta.
 *
 * Doble toque —o clic derecho— en el fondo abre el menú para crear: un texto, o
 * un nodo de una nota que ya existe o de una nueva; en un pósit, el suyo:
 * conectar, editar, hecho, borrar. *Conectar* espera a que se toque el nodo de
 * destino, y el fondo lo cancela. Doble toque —o clic derecho— en una línea abre
 * el suyo: invertir, con o sin dirección, texto, borrar. El texto de una línea
 * la sigue, sin salir nunca boca abajo. Un toque en un nodo-nota entra en su nota, tras esperar un
 * instante por si llega el segundo toque. Un pósit se mueve arrastrándolo con el
 * ratón, o manteniéndolo pulsado y arrastrando con el dedo, y se guarda una vez,
 * al soltar; con el dedo junto a un borde, el corcho avanza hacia ese lado.
 *
 * El botón de seleccionar, junto a la mira, cambia de modo: arrastrar dibuja un
 * rectángulo que marca lo que toca, arrastrar un marcado mueve el grupo, un
 * toque marca o desmarca, y el corcho se desplaza con dos dedos o con la rueda.
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
  DiagramRelation,
  DiagramRelationId,
  Note,
  NoteId,
  Store,
  Unsubscribe,
  UseCases,
} from "#core/index"
import { diagramNodeId, diagramRelationId } from "#core/index"
import type { BackStack } from "./backStack.js"
import { crosshairButton, selectButton, svg } from "./canvasButtons.js"
import type { Rect } from "./canvasSelection.js"
import { EDGE_SPEED_PX_S, boxesTouching, edgeDirection, rectBetween } from "./canvasSelection.js"
import type { DiagramFraming } from "./diagramFraming.js"
import { elemento } from "./dom.js"
import type { Tap } from "./gestures.js"
import { DOUBLE_TAP_MS, LONG_PRESS_MS, isDoubleTap, movedBeyondTolerance } from "./gestures.js"
import { createNoteForDiagram } from "./noteActions.js"
import { paintOrder, raise } from "./paintOrder.js"
import { reconcile } from "./reconcile.js"
import type { Box, RelationCurve } from "./relationGeometry.js"
import {
  curveMidpoint,
  curvePath,
  fanOffsets,
  labelPath,
  relationCurve,
  relationsOf,
} from "./relationGeometry.js"
import type { Sheet } from "./sheet.js"
import { createSheet } from "./sheet.js"
import type { Framing, Point, Viewport } from "./viewport.js"
import {
  centeredViewport,
  framingOf,
  panBy,
  pinch,
  toCanvas,
  viewportFor,
  wheelFactor,
  zoomAround,
} from "./viewport.js"

export interface DiagramCanvasDeps {
  readonly store: Store
  readonly useCases: UseCases
  readonly back: BackStack
  readonly diagramId: DiagramId
  /** Dónde se miraba cada diagrama: se lee al montarlo y se guarda al soltarlo. */
  readonly framing: DiagramFraming
  /** Si pone su propia mira, flotando abajo a la derecha. Sin ella, quien lo monta usa `recenter`. */
  readonly floatingCrosshair: boolean
  /** Entrar en la nota de un nodo-nota. */
  readonly onOpenNote: (id: NoteId) => void
}

export interface DiagramCanvas {
  /** El lienzo y su hoja de menús. Va dentro de una columna que le da el alto. */
  readonly element: HTMLElement
  /** Vuelve al origen en el centro y a ×1, como un diagrama nuevo. Lo hace la mira. */
  readonly recenter: () => void
  /** El botón de seleccionar. Con la mira flotante ya va en el lienzo; si no, a la barra. */
  readonly selectButton: HTMLButtonElement
  /**
   * Cierra sus modos —seleccionar, conectar—, que son capas del atrás. Antes de
   * salir de la vista o de cambiar de ventana: si no, lo primero que cerraría el
   * exit sería el modo, o quedaría una capa sin lienzo.
   */
  readonly closeModes: () => void
  /** Suelta lo que escucha fuera del lienzo y guarda dónde se miraba. */
  readonly destroy: () => void
}

/** La separación de los puntos del fondo, en unidades del corcho. */
const REJILLA: number = 24
/** Lo que se deja entre un pósit que se edita y el teclado del móvil. */
const MARGEN_TECLADO_PX: number = 16
/** El `target` de un toque en el fondo, para distinguirlo de uno en un pósit. */
const FONDO: string = "fondo"

/** Para que la punta de flecha de cada lienzo tenga su id: puede haber dos montados. */
let lienzosCreados: number = 0

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
  /** El pósit sobre el que bajó, o `null` si fue en el fondo o en una línea. */
  readonly nodo: DiagramNodeId | null
  /** La línea sobre la que bajó, o `null`. Arrastrarla arrastra el corcho. */
  readonly relacion: DiagramRelationId | null
  readonly origen: Point
  /** Los pósits que se mueven si se levanta: el suyo, o los marcados si es uno de ellos. */
  readonly grupo: ReadonlyArray<DiagramNodeId>
  /** Dibuja el rectángulo de seleccionar, en vez de mover nada. */
  readonly rectangulo: boolean
  /** Se movió más de la tolerancia: ya no es un toque. */
  movido: boolean
  /** El grupo va pegado al dedo. */
  levantado: boolean
  /** Arrastra el corcho, no el pósit. */
  arrastraFondo: boolean
  /** Lo que ha avanzado el corcho por los bordes mientras tanto, en píxeles. */
  avance: Point
  /** Cuánto se ha desplazado el grupo, en el corcho. */
  desplazamiento: Point | null
}

export const createDiagramCanvas = ({
  store,
  useCases,
  back,
  diagramId,
  framing,
  floatingCrosshair,
  onOpenNote,
}: DiagramCanvasDeps): DiagramCanvas => {
  const diagrama = (): Diagram | undefined => store.getState().diagrams[diagramId]

  /* La punta de flecha, una sola definida, que usan todas las líneas con dirección. */
  lienzosCreados += 1
  const idFlecha: string = `flecha-${lienzosCreados}`
  /** El id del trazado que sigue el texto de una relación, único en la página. */
  const idGuia = (relacion: string): string => `guia-${lienzosCreados}-${relacion}`
  const punta: SVGPathElement = svg("path")
  punta.setAttribute("d", "M 0 0 L 10 5 L 0 10 z")
  const marcador: SVGMarkerElement = svg("marker")
  marcador.id = idFlecha
  marcador.setAttribute("viewBox", "0 0 10 10")
  marcador.setAttribute("refX", "10")
  marcador.setAttribute("refY", "5")
  marcador.setAttribute("markerWidth", "9")
  marcador.setAttribute("markerHeight", "9")
  marcador.setAttribute("orient", "auto")
  marcador.append(punta)
  const definiciones: SVGDefsElement = svg("defs")
  definiciones.append(marcador)
  /* Las líneas, debajo de los pósits, en su propia capa: el `reconcile` de los
     pósits no la mueve de sitio. */
  const lineas: SVGSVGElement = svg("svg")
  lineas.classList.add("relaciones")
  lineas.append(definiciones)
  const nodosCapa: HTMLElement = elemento("div")

  const capa: HTMLElement = elemento("div")
  capa.className = "capa"
  capa.append(lineas, nodosCapa)
  const lienzo: HTMLElement = elemento("div")
  lienzo.className = "lienzo"
  lienzo.setAttribute("aria-label", "Lienzo del diagrama")
  lienzo.append(capa)
  const menu: Sheet = createSheet(back)
  /* Transparente para la columna: el lienzo es el que ocupa el sitio. */
  const marco: HTMLElement = elemento("div")
  marco.className = "lienzo-marco"
  /* El aviso de *Conectar*, sobre el lienzo y fuera de la capa: no se mueve con el corcho. */
  const avisoConectar: HTMLElement = elemento("p", "Toca el nodo de destino")
  avisoConectar.className = "aviso-conectar"
  avisoConectar.setAttribute("role", "status")
  avisoConectar.hidden = true
  lienzo.append(avisoConectar)
  marco.append(lienzo, menu.element)

  /* ── El encuadre ── */

  let vista: Viewport = { offsetX: 0, offsetY: 0, scale: 1 }
  /* Al montarlo todavía no se ve y no mide nada: se encuadra la primera vez que tiene tamaño. */
  let centrado: boolean = false

  const aplicar = (): void => {
    capa.style.transform = `translate(${vista.offsetX}px, ${vista.offsetY}px) scale(${vista.scale})`
    const paso: number = REJILLA * vista.scale
    lienzo.style.backgroundSize = `${paso}px ${paso}px`
    lienzo.style.backgroundPosition = `${vista.offsetX}px ${vista.offsetY}px`
  }

  /** Aplica un encuadre nuevo, movido por quien usa el lienzo, y lo apunta. */
  const encuadrar = (nueva: Viewport): void => {
    if (nueva === vista) return
    vista = nueva
    aplicar()
    const ancho: number = lienzo.clientWidth
    if (centrado && ancho > 0) framing.remember(diagramId, framingOf(vista, ancho, lienzo.clientHeight))
  }

  const recenter = (): void => encuadrar(centeredViewport(lienzo.clientWidth, lienzo.clientHeight))
  /* La flotante, sobre el lienzo y fuera de la capa, como el aviso. */
  if (floatingCrosshair) lienzo.append(crosshairButton(recenter))

  const medida: ResizeObserver = new ResizeObserver((): void => {
    if (centrado || lienzo.clientWidth === 0) return
    centrado = true
    const recordado: Framing | null = framing.get(diagramId)
    vista =
      recordado === null
        ? centeredViewport(lienzo.clientWidth, lienzo.clientHeight)
        : viewportFor(recordado, lienzo.clientWidth, lienzo.clientHeight)
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

  /** Dónde se ve un pósit: donde está, o donde lo lleva el dedo si va en el grupo arrastrado. */
  const dondeSeVe = (nodo: DiagramNode): Point => {
    const d: Point | null =
      gesto !== null && gesto.levantado && gesto.grupo.includes(nodo.id)
        ? gesto.desplazamiento
        : null
    return { x: nodo.positionX + (d?.x ?? 0), y: nodo.positionY + (d?.y ?? 0) }
  }

  const pintar = (): void => {
    const actual: Diagram | undefined = diagrama()
    if (actual === undefined) return
    /* Un marcado que se borra deja de estarlo. */
    if ([...marcados].some((id: DiagramNodeId): boolean => actual.nodes[id] === undefined)) {
      marcados = new Set<DiagramNodeId>(
        [...marcados].filter((id: DiagramNodeId): boolean => actual.nodes[id] !== undefined),
      )
    }
    const estado: AppState = store.getState()
    const orden: ReadonlyArray<string> = paintOrder(Object.keys(actual.nodes), levantados)
    const nodos: ReadonlyArray<DiagramNode> = orden.flatMap(
      (id: string): ReadonlyArray<DiagramNode> => {
        const nodo: DiagramNode | undefined = actual.nodes[diagramNodeId(id)]
        return nodo === undefined ? [] : [nodo]
      },
    )
    reconcile<DiagramNode, Element>(nodosCapa, nodos, {
      key: (nodo: DiagramNode): string => nodo.id,
      keyOf: (el: Element): string | null => el.getAttribute("data-id"),
      create: (nodo: DiagramNode): Element => {
        const el: HTMLElement = elemento("div")
        el.className = "posit"
        el.dataset["id"] = nodo.id
        el.append(elemento("div"))
        el.firstElementChild?.classList.add("texto")
        tamanos.observe(el)
        return el
      },
      /* Si no, el lienzo lo seguiría vigilando hasta cerrarse. */
      remove: (el: Element): void => tamanos.unobserve(el),
      update: (el: Element, nodo: DiagramNode): void => {
        if (!(el instanceof HTMLElement)) return
        colocar(el, dondeSeVe(nodo))
        el.classList.toggle("hecho", nodo.done)
        el.classList.toggle("marcado", marcados.has(nodo.id))
        el.classList.toggle("nota", nodo.type === "note-node")
        const texto: Element | null = el.querySelector(".texto")
        const nuevo: string = textoDe(nodo, estado)
        if (texto !== null && editando !== nodo.id && texto.textContent !== nuevo) {
          texto.textContent = nuevo
        }
      },
    })
    pintarRelaciones()
    /* Si el nodo de origen se borra mientras se conecta, no hay de dónde salir. */
    if (conectando !== null && actual.nodes[conectando] === undefined) terminarDeConectar(null)
    else marcarOrigen()
  }

  /* ── Las líneas ── */

  /** Cómo se dibujó cada relación la última vez: de ahí sale dónde se edita su texto. */
  let trazadas: Map<string, RelationCurve> = new Map<string, RelationCurve>()

  /* Las líneas salen del borde de cada pósit, y un pósit no mide nada hasta que se
     ve: al montarse, al cambiar su texto o al crecer mientras se escribe, se
     vuelven a pintar. */
  const tamanos: ResizeObserver = new ResizeObserver((): void => pintarRelaciones())

  /**
   * El pósit tal como se ve: su centro —el del dedo, si se está arrastrando— y lo
   * que mide. Las medidas de `offset*` no cuentan la escala del corcho: son ya
   * unidades del corcho. `null` si todavía no está pintado.
   */
  const cajaDe = (nodo: DiagramNode, el: HTMLElement): Box => {
    const centro: Point = dondeSeVe(nodo)
    return { x: centro.x, y: centro.y, width: el.offsetWidth, height: el.offsetHeight }
  }

  /** Lo ya pintado en `contenedor`, por su `data-id`: una pasada, no una búsqueda por cada uno. */
  const porId = (contenedor: Element): Map<string, Element> => {
    const mapa: Map<string, Element> = new Map<string, Element>()
    for (const el of Array.from(contenedor.children)) {
      const id: string | null = el.getAttribute("data-id")
      if (id !== null) mapa.set(id, el)
    }
    return mapa
  }

  /** Escribe en el DOM la línea de una relación, ya calculada. */
  const trazar = (grupo: Element, r: DiagramRelation, c: RelationCurve): void => {
    const linea: Element | null = grupo.querySelector(".linea")
    const toque: Element | null = grupo.querySelector(".toque")
    if (linea === null || toque === null) return
    trazadas.set(r.id, c)
    linea.setAttribute("d", curvePath(c))
    toque.setAttribute("d", curvePath(c))
    grupo.querySelector(".guia")?.setAttribute("d", labelPath(c))
    const recorrido: Element | null = grupo.querySelector("textPath")
    if (recorrido !== null && recorrido.textContent !== r.label) recorrido.textContent = r.label
    if (r.directed) linea.setAttribute("marker-end", `url(#${idFlecha})`)
    else linea.removeAttribute("marker-end")
  }

  /**
   * Redibuja las líneas; con `soloDe`, sólo las de esos nodos, que es lo único que
   * se mueve mientras se arrastra. Primero se mide todo y después se escribe:
   * alternar haría que el navegador recalculase la página antes de cada medida.
   */
  const pintarRelaciones = (soloDe: ReadonlyArray<DiagramNodeId> | null = null): void => {
    const actual: Diagram | undefined = diagrama()
    if (actual === undefined) return
    const relaciones: ReadonlyArray<DiagramRelation> = Object.values<DiagramRelation>(
      actual.relations,
    )
    /* El abanico se reparte con todas, aunque sólo se redibujen unas. */
    const curvas: ReadonlyMap<string, number> = fanOffsets(relaciones)
    /* Una línea entre dos del grupo sale dos veces: el `Set` la deja en una. */
    const afectadas: ReadonlyArray<DiagramRelation> =
      soloDe === null
        ? relaciones
        : [
            ...new Set<DiagramRelation>(
              soloDe.flatMap((id: DiagramNodeId): ReadonlyArray<DiagramRelation> =>
                relationsOf(relaciones, id),
              ),
            ),
          ]

    /* Medir. Una caja por nodo y no por relación: un nodo con muchas se mide una vez. */
    const posits: Map<string, Element> = porId(nodosCapa)
    const cajas: Map<string, Box | null> = new Map<string, Box | null>()
    const caja = (id: DiagramNodeId): Box | null => {
      if (!cajas.has(id)) {
        const nodo: DiagramNode | undefined = actual.nodes[id]
        const el: Element | undefined = posits.get(id)
        cajas.set(id, nodo === undefined || !(el instanceof HTMLElement) ? null : cajaDe(nodo, el))
      }
      return cajas.get(id) ?? null
    }
    const nuevas: Map<string, RelationCurve> = new Map<string, RelationCurve>()
    for (const r of afectadas) {
      const desde: Box | null = caja(r.from)
      const hasta: Box | null = caja(r.to)
      if (desde !== null && hasta !== null) {
        nuevas.set(r.id, relationCurve(desde, hasta, r.from, r.to, curvas.get(r.id) ?? 0))
      }
    }

    /* Escribir. Arrastrando no nace ni muere ninguna línea: basta con moverlas. */
    if (soloDe !== null) {
      const grupos: Map<string, Element> = porId(lineas)
      for (const r of afectadas) {
        const grupo: Element | undefined = grupos.get(r.id)
        const c: RelationCurve | undefined = nuevas.get(r.id)
        if (grupo !== undefined && c !== undefined) trazar(grupo, r, c)
      }
      return
    }
    trazadas = new Map<string, RelationCurve>()
    reconcile<DiagramRelation, Element>(lineas, relaciones, {
      key: (r: DiagramRelation): string => r.id,
      keyOf: (el: Element): string | null => el.getAttribute("data-id"),
      create: (r: DiagramRelation): Element => {
        const grupo: SVGGElement = svg("g")
        grupo.classList.add("relacion")
        grupo.setAttribute("data-id", r.id)
        const linea: SVGPathElement = svg("path")
        linea.classList.add("linea")
        /* Debajo, el mismo trazo, invisible y grueso: es el que recibe el dedo. */
        const toque: SVGPathElement = svg("path")
        toque.classList.add("toque")
        /* El texto sigue su propio trazado, que va al revés si la línea va a la izquierda. */
        const guia: SVGPathElement = svg("path")
        guia.classList.add("guia")
        guia.id = idGuia(r.id)
        const recorrido: SVGTextPathElement = svg("textPath")
        recorrido.setAttribute("href", `#${idGuia(r.id)}`)
        recorrido.setAttribute("startOffset", "50%")
        const etiqueta: SVGTextElement = svg("text")
        etiqueta.classList.add("etiqueta")
        etiqueta.setAttribute("dy", "-5")
        etiqueta.append(recorrido)
        grupo.append(toque, linea, guia, etiqueta)
        return grupo
      },
      update: (grupo: Element, r: DiagramRelation): void => {
        const c: RelationCurve | undefined = nuevas.get(r.id)
        if (c !== undefined) trazar(grupo, r, c)
      },
    })
    /* `reconcile` deja las definiciones donde estaban, al final: se vuelven arriba. */
    if (lineas.firstChild !== definiciones) lineas.prepend(definiciones)
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

  /**
   * Pone un nodo y devuelve su id: el que no estaba antes. `poner` es el caso de
   * uso que lo añade; el nuevo queda encima de los demás.
   */
  const ponerNodo = (poner: () => Diagram | null): DiagramNodeId | null => {
    const antes: ReadonlySet<string> = new Set<string>(Object.keys(diagrama()?.nodes ?? {}))
    const despues: Diagram | null = poner()
    const nuevo: string | undefined = Object.keys(despues?.nodes ?? {}).find(
      (id: string): boolean => !antes.has(id),
    )
    if (nuevo === undefined) return null
    levantados = raise(levantados, nuevo)
    pintar()
    return diagramNodeId(nuevo)
  }

  /** Las notas que se pueden poner, por nombre, para elegir una en la misma hoja. */
  const elegirNota = (caja: HTMLElement, p: Point): void => {
    const notas: ReadonlyArray<Note> = [...Object.values<Note>(store.getState().notes)].sort(
      (a: Note, b: Note): number => a.name.localeCompare(b.name),
    )
    const lista: HTMLElement = elemento("div")
    lista.className = "selector"
    lista.append(
      ...notas.map((nota: Note): HTMLButtonElement =>
        opcion(nota.name, (): void => {
          ponerNodo((): Diagram | null => useCases.addNoteNode(diagramId, nota.id, p.x, p.y))
        }),
      ),
    )
    caja.replaceChildren(lista)
  }

  /** Crear en el sitio donde se pidió. */
  const menuFondo = (donde: Point): void => {
    const p: Point = toCanvas(vista, donde)
    const caja: HTMLElement = elemento("div")
    caja.className = "hoja-acciones"
    /* Ésta no cierra la hoja: la lista de notas sustituye a las opciones, en la misma. */
    const existente: HTMLButtonElement = elemento("button", "Nota existente")
    existente.type = "button"
    existente.addEventListener("click", (): void => elegirNota(caja, p))
    caja.append(
      opcion("Texto", (): void => {
        const nuevo: DiagramNodeId | null = ponerNodo((): Diagram | null =>
          useCases.addTextNode(diagramId, "", p.x, p.y),
        )
        if (nuevo !== null) editar(nuevo)
      }),
      ...(Object.keys(store.getState().notes).length > 0 ? [existente] : []),
      opcion("Nota nueva", (): void => {
        const nota: Note | null = createNoteForDiagram(useCases, store.getState(), diagramId)
        if (nota === null) return
        ponerNodo((): Diagram | null => useCases.addNoteNode(diagramId, nota.id, p.x, p.y))
        onOpenNote(nota.id)
      }),
    )
    menu.open("Añadir al diagrama", [caja])
  }

  /* ── Conectar: el nodo de origen espera al de destino ── */

  /** El nodo del que sale la relación que se está tirando, o `null` si no se tira ninguna. */
  let conectando: DiagramNodeId | null = null

  const marcarOrigen = (): void => {
    for (const el of nodosCapa.querySelectorAll(".posit.origen")) el.classList.remove("origen")
    if (conectando !== null) positDe(conectando)?.classList.add("origen")
    avisoConectar.hidden = conectando === null
  }

  /* Como el resto de capas, se sale con el atrás: el modo es la capa, y salir es ir atrás. */
  const empezarAConectar = (desde: DiagramNodeId): void => {
    conectando = desde
    marcarOrigen()
    back.open((): void => {
      conectando = null
      marcarOrigen()
    })
  }

  /** Termina el modo: con un destino, une; sin él, sólo cancela. */
  const terminarDeConectar = (hasta: DiagramNodeId | null): void => {
    const desde: DiagramNodeId | null = conectando
    if (desde === null) return
    conectando = null
    marcarOrigen()
    back.close()
    if (hasta !== null && hasta !== desde) useCases.addRelation(diagramId, desde, hasta)
  }

  /* ── Seleccionar: un modo, con su botón junto a la mira ── */

  let seleccionando: boolean = false
  /** Los marcados. Sólo hay mientras dura el modo. */
  let marcados: ReadonlySet<DiagramNodeId> = new Set<DiagramNodeId>()

  /** El rectángulo que se dibuja con el dedo, sobre el lienzo y fuera de la capa. */
  const rectangulo: HTMLElement = elemento("div")
  rectangulo.className = "rectangulo"
  rectangulo.hidden = true
  lienzo.append(rectangulo)

  const marcar = (siguientes: ReadonlySet<DiagramNodeId>): void => {
    marcados = siguientes
    for (const el of nodosCapa.querySelectorAll<HTMLElement>(".posit[data-id]")) {
      const id: string | undefined = el.dataset["id"]
      el.classList.toggle("marcado", id !== undefined && marcados.has(diagramNodeId(id)))
    }
  }

  const pintarModo = (): void => {
    botonSeleccion.setAttribute("aria-pressed", String(seleccionando))
    lienzo.classList.toggle("seleccionando", seleccionando)
  }

  /* Como *Conectar*, es una capa: el atrás sale del modo, y el botón también. */
  const alternarSeleccion = (): void => {
    if (seleccionando) {
      back.close()
      return
    }
    if (conectando !== null) terminarDeConectar(null)
    seleccionando = true
    pintarModo()
    back.open((): void => {
      seleccionando = false
      marcar(new Set<DiagramNodeId>())
      pintarModo()
    })
  }

  const botonSeleccion: HTMLButtonElement = selectButton(alternarSeleccion)
  /* Con la mira flotante, junto a ella; si no, quien monta el lienzo lo pone en su barra. */
  if (floatingCrosshair) lienzo.append(botonSeleccion)

  const dibujarRectangulo = (a: Point, b: Point): void => {
    const r: Rect = rectBetween(a, b)
    rectangulo.hidden = false
    rectangulo.style.left = `${r.left}px`
    rectangulo.style.top = `${r.top}px`
    rectangulo.style.width = `${r.right - r.left}px`
    rectangulo.style.height = `${r.bottom - r.top}px`
  }

  /** Marca lo que toca el rectángulo entre `a` y `b`, en píxeles del lienzo; lo de antes se va. */
  const marcarEnRectangulo = (a: Point, b: Point): void => {
    rectangulo.hidden = true
    const actual: Diagram | undefined = diagrama()
    if (actual === undefined) return
    const posits: Map<string, Element> = porId(nodosCapa)
    const cajas: Map<string, Box> = new Map<string, Box>()
    for (const nodo of Object.values<DiagramNode>(actual.nodes)) {
      const el: Element | undefined = posits.get(nodo.id)
      if (el instanceof HTMLElement) cajas.set(nodo.id, cajaDe(nodo, el))
    }
    const tocados: ReadonlyArray<string> = boxesTouching(
      cajas,
      rectBetween(toCanvas(vista, a), toCanvas(vista, b)),
    )
    marcar(new Set<DiagramNodeId>(tocados.map((id: string): DiagramNodeId => diagramNodeId(id))))
  }

  /** Un toque en el modo: marca o desmarca el pósit. En el fondo no hace nada. */
  const tocadoSeleccionando = (g: Gesto): void => {
    const id: DiagramNodeId | null = g.nodo
    if (id === null) return
    marcar(
      new Set<DiagramNodeId>(
        marcados.has(id)
          ? [...marcados].filter((m: DiagramNodeId): boolean => m !== id)
          : [...marcados, id],
      ),
    )
  }

  /** Escribir el texto de una línea: un campo en su punto medio. Vacío, sin texto. */
  const editarTexto = (id: DiagramRelationId): void => {
    const r: DiagramRelation | undefined = diagrama()?.relations[id]
    const c: RelationCurve | undefined = trazadas.get(id)
    if (r === undefined || c === undefined) return
    const campo: HTMLInputElement = elemento("input")
    campo.className = "etiqueta-campo"
    campo.value = r.label
    campo.setAttribute("aria-label", "Texto de la relación")
    const medio: Point = curveMidpoint(c)
    campo.style.left = `${medio.x}px`
    campo.style.top = `${medio.y}px`
    let hecho: boolean = false
    const terminar = (guardar: boolean): void => {
      if (hecho) return
      /* Antes de tocar el DOM: quitar el campo dispara su `blur`, que vuelve aquí. */
      hecho = true
      const valor: string = campo.value.trim()
      campo.remove()
      if (guardar) useCases.setRelationLabel(diagramId, id, valor)
    }
    campo.addEventListener("keydown", (evento: KeyboardEvent): void => {
      if (evento.key === "Enter") terminar(true)
      if (evento.key === "Escape") terminar(false)
    })
    campo.addEventListener("blur", (): void => terminar(true))
    nodosCapa.append(campo)
    campo.focus()
    campo.select()
  }

  /** El menú de una línea: lo que se puede cambiar de ella, según tenga o no flecha. */
  const menuRelacion = (id: DiagramRelationId): void => {
    const actual: Diagram | undefined = diagrama()
    const r: DiagramRelation | undefined = actual?.relations[id]
    if (actual === undefined || r === undefined) return
    const nombre = (n: DiagramNodeId): string => {
      const nodo: DiagramNode | undefined = actual.nodes[n]
      return nodo === undefined ? "?" : textoDe(nodo, store.getState()) || "Sin texto"
    }
    menu.open(`${nombre(r.from)} ${r.directed ? "→" : "—"} ${nombre(r.to)}`, acciones(
      /* Sin flecha no hay sentido que invertir: la opción ni sale. */
      ...(r.directed
        ? [
            opcion("Invertir dirección", (): void => {
              useCases.setRelationEnds(diagramId, id, r.to, r.from)
            }),
            opcion("Sin dirección", (): void => {
              useCases.setRelationDirected(diagramId, id, false)
            }),
          ]
        : [
            opcion("Con dirección", (): void => {
              useCases.setRelationDirected(diagramId, id, true)
            }),
          ]),
      opcion("Texto", (): void => editarTexto(id)),
      opcion("Borrar", (): void => {
        useCases.removeRelation(diagramId, id)
      }, "peligro"),
    ))
  }

  const menuNodo = (id: DiagramNodeId): void => {
    const nodo: DiagramNode | undefined = diagrama()?.nodes[id]
    if (nodo === undefined) return
    const titulo: string = textoDe(nodo, store.getState())
    menu.open(titulo === "" ? "Nodo" : titulo, acciones(
      opcion("Conectar", (): void => empezarAConectar(id)),
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
  /** La nota que se abrirá si no llega el segundo toque. */
  let abrirLuego: ReturnType<typeof setTimeout> | null = null

  const cancelarApertura = (): void => {
    if (abrirLuego !== null) clearTimeout(abrirLuego)
    abrirLuego = null
  }

  const cancelarEspera = (): void => {
    if (espera !== null) clearTimeout(espera)
    espera = null
  }

  const levantar = (g: Gesto): void => {
    if (g.grupo.length === 0) return
    g.levantado = true
    levantados = g.grupo.reduce(
      (orden: ReadonlyArray<string>, id: DiagramNodeId): ReadonlyArray<string> => raise(orden, id),
      levantados,
    )
    pintar()
    for (const id of g.grupo) positDe(id)?.classList.add("levantado")
  }

  /** Suelta el grupo sin guardar nada: vuelve a pintarse donde está. */
  const posar = (g: Gesto): void => {
    for (const id of g.grupo) positDe(id)?.classList.remove("levantado")
  }

  /** Lleva el grupo bajo el dedo, en `ahora`, descontando lo que ha avanzado el corcho. */
  const arrastrar = (g: Gesto, ahora: Point): void => {
    g.desplazamiento = {
      x: (ahora.x - g.origen.x - g.avance.x) / vista.scale,
      y: (ahora.y - g.origen.y - g.avance.y) / vista.scale,
    }
    const actual: Diagram | undefined = diagrama()
    for (const id of g.grupo) {
      const nodo: DiagramNode | undefined = actual?.nodes[id]
      const el: HTMLElement | null = positDe(id)
      if (nodo !== undefined && el !== null) colocar(el, dondeSeVe(nodo))
    }
    pintarRelaciones(g.grupo)
  }

  /* ── El avance por los bordes, mientras se arrastran pósits ── */

  let avanceFrame: number | null = null
  /** La hora del fotograma anterior, para avanzar lo mismo por segundo a cualquier refresco. */
  let ultimoFrame: number | null = null

  const pararAvance = (): void => {
    if (avanceFrame !== null) cancelAnimationFrame(avanceFrame)
    avanceFrame = null
    ultimoFrame = null
  }

  const avanzar = (ahora: number): void => {
    avanceFrame = null
    const g: Gesto | null = gesto
    const dedo: Point | undefined = g === null ? undefined : punteros.get(g.puntero)
    if (g === null || !g.levantado || dedo === undefined) {
      ultimoFrame = null
      return
    }
    const hacia: Point = edgeDirection(dedo, lienzo.clientWidth, lienzo.clientHeight)
    if (hacia.x === 0 && hacia.y === 0) {
      ultimoFrame = null
      return
    }
    /* Tras una pausa larga —la pestaña en segundo plano—, no da un salto. */
    const ms: number = ultimoFrame === null ? 16 : Math.min(ahora - ultimoFrame, 50)
    ultimoFrame = ahora
    const paso: number = (EDGE_SPEED_PX_S * ms) / 1000
    encuadrar(panBy(vista, hacia.x * paso, hacia.y * paso))
    g.avance = { x: g.avance.x + hacia.x * paso, y: g.avance.y + hacia.y * paso }
    arrastrar(g, dedo)
    avanceFrame = requestAnimationFrame(avanzar)
  }

  /** Con el grupo levantado, si el dedo está en una franja, el corcho empieza a avanzar. */
  const quizaAvanzar = (): void => {
    if (avanceFrame === null) avanceFrame = requestAnimationFrame(avanzar)
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

  /** La línea sobre la que cayó un evento, o `null`. */
  const relacionDe = (objetivo: EventTarget | null): DiagramRelationId | null => {
    const el: Element | null =
      objetivo instanceof Element ? objetivo.closest(".relacion[data-id]") : null
    const id: string | null = el?.getAttribute("data-id") ?? null
    return id === null ? null : diagramRelationId(id)
  }

  /** El toque que acaba de abrir un menú: su `click` fantasma no tiene que llegar. */
  let tragarClick: boolean = false

  /* El `touchend` llega después del `pointerup` que abrió el menú, y cancelarlo es
     lo único que impide el `click` que el navegador manda detrás. No pasivo: uno
     pasivo no puede cancelarlo. */
  lienzo.addEventListener(
    "touchend",
    (evento: TouchEvent): void => {
      if (!tragarClick) return
      tragarClick = false
      evento.preventDefault()
    },
    { passive: false },
  )

  lienzo.addEventListener("pointerdown", (evento: PointerEvent): void => {
    tragarClick = false
    if (evento.pointerType === "mouse" && evento.button !== 0) return
    /* Dentro del campo que se edita, el dedo es del campo. */
    if (
      evento.target instanceof Element &&
      evento.target.closest(".posit-campo, .etiqueta-campo") !== null
    ) {
      return
    }
    const donde: Point = enLienzo(evento)
    punteros.set(evento.pointerId, donde)

    if (punteros.size === 2) {
      /* El segundo dedo es un pellizco: lo que hiciera el primero se olvida. */
      cancelarEspera()
      pararAvance()
      rectangulo.hidden = true
      const antes: Gesto | null = gesto
      gesto = null
      if (antes?.levantado === true) {
        posar(antes)
        pintar()
      }
      empezarPellizco()
      return
    }
    if (punteros.size !== 1) return

    const nodo: DiagramNodeId | null = nodoDe(evento.target)
    /* En el modo, un marcado arrastra a todos los marcados; lo demás, el rectángulo. */
    const deGrupo: boolean = seleccionando && nodo !== null && marcados.has(nodo)
    const g: Gesto = {
      puntero: evento.pointerId,
      tipo: evento.pointerType,
      nodo,
      relacion: nodo === null ? relacionDe(evento.target) : null,
      origen: donde,
      grupo: deGrupo ? [...marcados] : nodo === null || seleccionando ? [] : [nodo],
      rectangulo: seleccionando && !deGrupo,
      movido: false,
      levantado: false,
      arrastraFondo: nodo === null && !seleccionando,
      avance: { x: 0, y: 0 },
      desplazamiento: null,
    }
    gesto = g
    /* Con el dedo, el pósit se levanta manteniéndolo pulsado; con el ratón, arrastrando.
       En el modo, el grupo marcado se arrastra sin esperar, con los dos. */
    if (nodo !== null && evento.pointerType !== "mouse" && !seleccionando) {
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
      encuadrar(pinch(p.inicio, p.a0, p.b0, a1, b1))
      return
    }

    const g: Gesto | null = gesto
    if (g === null || g.puntero !== evento.pointerId) return
    if (!g.movido && movedBeyondTolerance(g.origen, ahora)) {
      g.movido = true
      cancelarEspera()
      /* Con el ratón, arrastrar un pósit lo levanta; con el dedo sin esperar, arrastra el
         corcho. En el modo, el grupo se levanta con los dos. */
      if (g.grupo.length > 0 && !g.levantado) {
        if (g.tipo === "mouse" || seleccionando) levantar(g)
        else g.arrastraFondo = true
      }
      if (g.arrastraFondo) lienzo.classList.add("moviendo")
    }
    if (!g.movido) return

    if (g.rectangulo) {
      dibujarRectangulo(g.origen, ahora)
    } else if (g.levantado) {
      arrastrar(g, ahora)
      quizaAvanzar()
    } else if (g.arrastraFondo) {
      encuadrar(panBy(vista, ahora.x - antes.x, ahora.y - antes.y))
    }
  }

  /** Un toque suelto, sin moverse: puede ser el segundo de un doble toque. */
  const tocado = (g: Gesto, donde: Point, cuando: number): void => {
    /* Conectando, un toque es el destino —el fondo cancela— y nada más: ni abre la
       nota ni cuenta para un doble toque. */
    if (conectando !== null) {
      toqueAnterior = null
      terminarDeConectar(g.nodo)
      return
    }
    const toque: Tap = {
      x: donde.x,
      y: donde.y,
      time: cuando,
      target: g.nodo ?? (g.relacion === null ? FONDO : `relacion:${g.relacion}`),
    }
    if (isDoubleTap(toqueAnterior, toque)) {
      toqueAnterior = null
      cancelarApertura()
      /* Con el dedo, el navegador manda después un `click` al punto donde estaba, y
         ahí ya está la hoja: la cerraría, o elegiría lo que hubiera debajo. */
      tragarClick = g.tipo !== "mouse"
      if (g.nodo !== null) menuNodo(g.nodo)
      else if (g.relacion !== null) menuRelacion(g.relacion)
      else menuFondo(donde)
      return
    }
    toqueAnterior = toque
    /* Un toque en un nodo-nota entra en la nota, pero espera lo que tarda el
       segundo toque de un doble: si llega, era el menú. Una nota ilegible no se abre. */
    cancelarApertura()
    const nodo: DiagramNode | undefined = g.nodo === null ? undefined : diagrama()?.nodes[g.nodo]
    if (nodo?.type !== "note-node" || store.getState().notes[nodo.noteId] === undefined) return
    const nota: NoteId = nodo.noteId
    abrirLuego = setTimeout((): void => {
      abrirLuego = null
      onOpenNote(nota)
    }, DOUBLE_TAP_MS)
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
    pararAvance()
    gesto = null
    lienzo.classList.remove("moviendo")
    if (g === null || g.puntero !== evento.pointerId) return

    if (g.rectangulo && g.movido) {
      if (evento.type === "pointerup") marcarEnRectangulo(g.origen, donde)
      rectangulo.hidden = true
      return
    }
    if (g.levantado) {
      posar(g)
      /* Se guarda una vez, al soltar, con una sola acción. Si no se movió, nada. */
      const d: Point | null = g.desplazamiento
      const [solo] = g.grupo
      const n: DiagramNode | undefined = solo === undefined ? undefined : diagrama()?.nodes[solo]
      if (d !== null && seleccionando) useCases.shiftNodes(diagramId, g.grupo, d.x, d.y)
      else if (d !== null && solo !== undefined && n !== undefined) {
        useCases.setNodePosition(diagramId, solo, n.positionX + d.x, n.positionY + d.y)
      }
      pintar()
      return
    }
    if (g.movido || evento.type !== "pointerup") return
    if (seleccionando) tocadoSeleccionando(g)
    else tocado(g, donde, evento.timeStamp)
  }

  window.addEventListener("pointermove", mover)
  window.addEventListener("pointerup", soltar)
  window.addEventListener("pointercancel", soltar)

  /* El clic derecho abre los mismos menús. En táctil este evento llega con la
     pulsación larga, que ya es levantar el pósit: ahí no hace nada. */
  lienzo.addEventListener("contextmenu", (evento: MouseEvent): void => {
    evento.preventDefault()
    if (evento instanceof PointerEvent && evento.pointerType !== "mouse") return
    /* En el modo de seleccionar no hay menús. */
    if (gesto?.levantado === true || seleccionando) return
    const nodo: DiagramNodeId | null = nodoDe(evento.target)
    cancelarApertura()
    /* Conectando, el clic derecho cancela, como un toque en el fondo. */
    if (conectando !== null) {
      terminarDeConectar(null)
      return
    }
    const relacion: DiagramRelationId | null = nodo === null ? relacionDe(evento.target) : null
    if (nodo !== null) menuNodo(nodo)
    else if (relacion !== null) menuRelacion(relacion)
    else menuFondo(enLienzo(evento))
  })

  /* No pasivo: uno pasivo no puede impedir que la rueda desplace la página. El
     pellizco del trackpad también llega por aquí, como rueda con Ctrl. En el modo
     de seleccionar, sin Ctrl, la rueda desplaza el corcho, que el ratón no puede
     arrastrar: arrastrar dibuja el rectángulo. */
  lienzo.addEventListener(
    "wheel",
    (evento: WheelEvent): void => {
      evento.preventDefault()
      if (seleccionando && !evento.ctrlKey) {
        /* Hay ratones que cuentan la rueda en líneas, no en píxeles. */
        const linea: number = evento.deltaMode === WheelEvent.DOM_DELTA_LINE ? 16 : 1
        encuadrar(panBy(vista, -evento.deltaX * linea, -evento.deltaY * linea))
        return
      }
      encuadrar(zoomAround(vista, enLienzo(evento), wheelFactor(evento.deltaY)))
    },
    { passive: false },
  )

  aplicar()
  pintar()
  const baja: Unsubscribe = store.subscribe((): void => pintar())

  return {
    element: marco,
    recenter,
    selectButton: botonSeleccion,
    /* Los dos no pueden estar a la vez: entrar a seleccionar acaba con *Conectar*. */
    closeModes: (): void => {
      if (seleccionando || conectando !== null) back.close()
    },
    destroy: (): void => {
      framing.save()
      baja()
      cancelarEspera()
      cancelarApertura()
      pararAvance()
      medida.disconnect()
      tamanos.disconnect()
      window.visualViewport?.removeEventListener("resize", asomar)
      window.removeEventListener("pointermove", mover)
      window.removeEventListener("pointerup", soltar)
      window.removeEventListener("pointercancel", soltar)
    },
  }
}
