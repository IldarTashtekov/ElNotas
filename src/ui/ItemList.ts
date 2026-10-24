/**
 * La lista de una ventana —sus notas y sus diagramas—, con «+ Nota», «+ Diagrama»,
 * el modo selección y, en un contexto con algo oculto, la fila «Ocultos (n)».
 *
 * Se entra a seleccionar con una pulsación larga, con clic derecho, con
 * Ctrl/Cmd+clic o con la barra espaciadora; dentro, cada toque selecciona. Se
 * sale al quedarse sin nada, con Escape o con el atrás. Mientras dura, abajo
 * aparece la barra con la papelera, «Mover a…» y, en un contexto, «Ocultar».
 *
 * La fila de los ocultos abre su lista encima de la del contexto, y se cierra con
 * ella o con el atrás. Ahí se selecciona igual, y la barra dice «Mostrar».
 *
 * En la selección de un contexto, cada fila lleva un ⠿ al lado: arrastrarlo mueve
 * todo lo seleccionado —y esa fila, si no lo estaba— como un bloque, y al soltar
 * se sigue seleccionando. Ni en el General ni en los ocultos.
 */

import type {
  AppState,
  Context,
  Diagram,
  DiagramId,
  ItemRef,
  Note,
  NoteId,
  Store,
  UseCases,
} from "#core/index"
import type { BackStack } from "./backStack.js"
import type { Confirm } from "./sheet.js"
import { elemento } from "./dom.js"
import { dropIndex } from "./dropIndex.js"
import { reconcile, setAttrIfChanged, setTextIfChanged } from "./reconcile.js"
import {
  createDiagramIn,
  createNoteIn,
  deleteQuestion,
  moveItems,
  moveTargets,
  reorderBefore,
  trashDeletes,
  trashItems,
} from "./noteActions.js"
import type { Selection } from "./selection.js"
import { NO_SELECTION, itemKey, pruneSelected, toggleSelected } from "./selection.js"
import type { ListItem } from "./windowView.js"
import type { WindowRef } from "./windows.js"
import { sameWindow } from "./windows.js"

export interface ItemListDeps {
  readonly store: Store
  readonly useCases: UseCases
  readonly back: BackStack
  readonly confirm: Confirm
  /** Para que la cabecera apague ◀ ▶ y ⚙ mientras se selecciona. */
  readonly onSelectingChange: (seleccionando: boolean) => void
  readonly onOpenNote: (id: NoteId) => void
  /** `editName`: si llega con el nombre a punto de escribirse, como uno recién creado. */
  readonly onOpenDiagram: (id: DiagramId, editName: boolean) => void
}

export interface ItemList {
  readonly element: HTMLElement
  /** Lo que tiene que enseñar ahora, y lo oculto aparte. `null` en la pantalla vacía. */
  readonly update: (
    ventana: WindowRef | null,
    items: ReadonlyArray<ListItem>,
    ocultos: ReadonlyArray<ListItem>,
  ) => void
}

/** Lo que dura una pulsación larga, y cuánto se puede mover el dedo sin anularla. */
const PULSACION_LARGA_MS: number = 500
const TOLERANCIA_PX: number = 10
/** Arrastrando cerca del borde de arriba o de abajo, la página se desliza sola. */
const BORDE_PX: number = 40
const PASO_PX: number = 10

/** Lo que dura un arrastre del ⠿: medido al empezar, como en `dragReorder`. */
interface Arrastre {
  readonly el: HTMLElement
  readonly inicio: number
  /** Las filas que no se mueven, y sus centros en la página (con su scroll). */
  readonly quedan: ReadonlyArray<HTMLElement>
  readonly centros: ReadonlyArray<number>
  hueco: number
}

const boton = (texto: string, alPulsar: () => void, clase?: string): HTMLButtonElement => {
  const b: HTMLButtonElement = elemento("button", texto)
  b.type = "button"
  if (clase !== undefined) b.className = clase
  b.addEventListener("click", alPulsar)
  return b
}

const SVG = "http://www.w3.org/2000/svg" as const

/** Un ojo tachado, de trazo y en el color del texto: un emoji saldría a color. */
const iconoOculto = (): SVGSVGElement => {
  const icono: SVGSVGElement = document.createElementNS(SVG, "svg")
  icono.setAttribute("viewBox", "0 0 24 24")
  icono.setAttribute("aria-hidden", "true")
  icono.classList.add("icono")
  for (const d of ["M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z", "M4 4l16 16"]) {
    const trazo: SVGPathElement = document.createElementNS(SVG, "path")
    trazo.setAttribute("d", d)
    icono.append(trazo)
  }
  const pupila: SVGCircleElement = document.createElementNS(SVG, "circle")
  pupila.setAttribute("cx", "12")
  pupila.setAttribute("cy", "12")
  pupila.setAttribute("r", "3")
  icono.append(pupila)
  return icono
}

export const createItemList = ({
  store,
  useCases,
  back,
  confirm,
  onSelectingChange,
  onOpenNote,
  onOpenDiagram,
}: ItemListDeps): ItemList => {
  let ventana: WindowRef | null = null
  let items: ReadonlyArray<ListItem> = []
  let ocultos: ReadonlyArray<ListItem> = []
  let seleccion: Selection = NO_SELECTION
  let seleccionando: boolean = false
  let moviendo: boolean = false
  let viendoOcultos: boolean = false
  /* Ya se pidió cerrar la capa y su `popstate` no ha llegado: otro cierre
     cerraría la de debajo. */
  let saliendo: boolean = false
  let cerrandoOcultos: boolean = false

  /** Lo que enseña la lista ahora: lo del contexto, o lo oculto si está abierto. */
  const mostradas = (): ReadonlyArray<ListItem> => (viendoOcultos ? ocultos : items)

  const lista: HTMLUListElement = elemento("ul")
  lista.className = "notas"
  lista.setAttribute("role", "listbox")
  lista.setAttribute("aria-multiselectable", "true")
  const sinNotas: HTMLParagraphElement = elemento("p", "Esta ventana no tiene notas ni diagramas.")
  sinNotas.className = "vacia"
  /* «+ Nota» crea y entra: la nota nueva se abre para escribir en ella. */
  const mas: HTMLButtonElement = boton("+", (): void => {
    const nueva: Note | null = ventana === null ? null : createNoteIn(useCases, ventana)
    if (nueva !== null) onOpenNote(nueva.id)
  }, "mas")
  mas.setAttribute("aria-label", "Nueva nota")
  mas.title = "Nueva nota"
  /* «+ Diagrama», al lado: crea y entra, con el nombre a punto de escribirse. */
  const masDiagrama: HTMLButtonElement = boton("+", (): void => {
    const nuevo: Diagram | null = ventana === null ? null : createDiagramIn(useCases, ventana)
    if (nuevo !== null) onOpenDiagram(nuevo.id, true)
  }, "mas mas-diagrama")
  masDiagrama.setAttribute("aria-label", "Nuevo diagrama")
  masDiagrama.title = "Nuevo diagrama"

  const cuenta: HTMLSpanElement = elemento("span")
  const papelera: HTMLButtonElement = boton("", (): void => tirar())
  const mover: HTMLButtonElement = boton("Mover a…", (): void => {
    moviendo = !moviendo
    pintar()
  })
  const ocultar: HTMLButtonElement = boton("", (): void => alternarOcultos())
  const destinos: HTMLElement = elemento("div")
  destinos.className = "selector"
  const barra: HTMLElement = elemento("div")
  barra.className = "barra"
  barra.append(cuenta, papelera, mover, ocultar, destinos)

  /* Abierta, la fila hace de título de la lista, y la flecha dice que la cierra. */
  const flechaOcultos: HTMLSpanElement = elemento("span", "◀")
  flechaOcultos.setAttribute("aria-hidden", "true")
  const textoOcultos: HTMLSpanElement = elemento("span")
  const filaOcultos: HTMLButtonElement = boton("", (): void => {
    if (viendoOcultos) cerrarOcultos()
    else abrirOcultos()
  }, "fila-ocultos")
  filaOcultos.append(flechaOcultos, iconoOculto(), textoOcultos)

  const element: HTMLElement = elemento("div")
  element.append(filaOcultos, lista, sinNotas, masDiagrama, mas, barra)

  /* ── Entrar y salir del modo selección ── */

  const empezar = (clave: string): void => {
    seleccion = toggleSelected(NO_SELECTION, clave)
    seleccionando = true
    saliendo = false
    back.open((): void => {
      seleccion = NO_SELECTION
      seleccionando = false
      saliendo = false
      moviendo = false
      onSelectingChange(false)
      pintar()
    })
    onSelectingChange(true)
    pintar()
  }

  /* Salir es ir atrás: el `popstate` hace el resto, por el botón que sea. */
  const salir = (): void => {
    if (!seleccionando || saliendo) return
    saliendo = true
    back.close()
  }

  /* ── Abrir y cerrar la lista de los ocultos, encima de la del contexto ── */

  const abrirOcultos = (): void => {
    viendoOcultos = true
    cerrandoOcultos = false
    back.open((): void => {
      viendoOcultos = false
      cerrandoOcultos = false
      pintar()
    })
    pintar()
  }

  const cerrarOcultos = (): void => {
    if (!viendoOcultos || cerrandoOcultos) return
    cerrandoOcultos = true
    back.close()
  }

  const alternar = (clave: string): void => {
    seleccion = toggleSelected(seleccion, clave)
    if (seleccion.size === 0) salir()
    else pintar()
  }

  const elegida = (clave: string): void => (seleccionando ? alternar(clave) : empezar(clave))

  const seleccionadas = (): ReadonlyArray<ListItem> =>
    mostradas().filter((i: ListItem): boolean => seleccion.has(itemKey(i.ref)))

  const refsSeleccionadas = (): ReadonlyArray<ItemRef> =>
    seleccionadas().map((i: ListItem): ItemRef => i.ref)

  const tirar = (): void => {
    if (ventana === null) return
    const donde: WindowRef = ventana
    const refs: ReadonlyArray<ItemRef> = refsSeleccionadas()
    const hacer = (): void => {
      trashItems(useCases, donde, refs)
      salir()
    }
    /* Sólo confirma la papelera del General: es la única que borra de verdad. */
    if (trashDeletes(donde)) confirm(deleteQuestion(seleccionadas()), "Borrar", hacer)
    else hacer()
  }

  const moverA = (destino: Context): void => {
    if (ventana === null) return
    moveItems(useCases, ventana, destino.id, refsSeleccionadas())
    salir()
  }

  /** «Ocultar» en la lista del contexto, «Mostrar» en la de los ocultos. */
  const alternarOcultos = (): void => {
    if (ventana?.kind !== "context") return
    const refs: ReadonlyArray<ItemRef> = refsSeleccionadas()
    if (viendoOcultos) useCases.showItems(ventana.id, refs)
    else useCases.hideItems(ventana.id, refs)
    salir()
  }

  /* ── Los gestos sobre una fila ── */

  /** La clave de la fila sobre la que cayó el gesto, o `null` si no cayó en ninguna. */
  const claveDe = (objetivo: EventTarget | null): string | null => {
    const fila: HTMLElement | null =
      objetivo instanceof Element ? objetivo.closest<HTMLElement>("li[data-key]") : null
    return fila?.dataset["key"] ?? null
  }

  /** Abrir una fila: la nota en la vista nota, el diagrama en la vista diagrama. */
  const abrir = (clave: string): void => {
    const item: ListItem | undefined = mostradas().find(
      (i: ListItem): boolean => itemKey(i.ref) === clave,
    )
    if (item === undefined) return
    if (item.ref.kind === "note") onOpenNote(item.ref.id)
    else onOpenDiagram(item.ref.id, false)
  }

  let espera: ReturnType<typeof setTimeout> | null = null
  let origen: { readonly x: number; readonly y: number } = { x: 0, y: 0 }
  /** La pulsación larga ya actuó: el `click` que llega al soltar no cuenta. */
  let tragarClick: boolean = false
  let ultimoPuntero: string = "mouse"

  const cancelarEspera = (): void => {
    if (espera !== null) clearTimeout(espera)
    espera = null
  }

  /* ── Reordenar con el ⠿ ── */

  let arrastre: Arrastre | null = null
  /* El ⠿ pulsado que aún no se ha movido: un toque sin moverse no hace nada. */
  let asaPulsada: { readonly clave: string; readonly fila: HTMLElement; readonly y: number } | null =
    null

  const puedeReordenar = (): boolean =>
    seleccionando && ventana?.kind === "context" && !viendoOcultos

  const enAsa = (objetivo: EventTarget | null): boolean =>
    objetivo instanceof Element && objetivo.closest(".asa") !== null

  const marcarHueco = (a: Arrastre): void => {
    a.quedan.forEach((f: HTMLElement, j: number): void => {
      if (f.classList.contains("cae-antes") !== (j === a.hueco)) f.classList.toggle("cae-antes")
    })
    lista.classList.toggle("cae-al-final", a.hueco === a.quedan.length)
  }

  const levantar = (el: HTMLElement, y: number): void => {
    const filas: ReadonlyArray<HTMLElement> = [...lista.querySelectorAll<HTMLElement>("li[data-key]")]
    const quedan: ReadonlyArray<HTMLElement> = filas.filter(
      (f: HTMLElement): boolean => !seleccion.has(f.dataset["key"] ?? ""),
    )
    const centros: ReadonlyArray<number> = quedan.map((f: HTMLElement): number => {
      const r: DOMRect = f.getBoundingClientRect()
      return r.top + window.scrollY + r.height / 2
    })
    const a: Arrastre = { el, inicio: y + window.scrollY, quedan, centros, hueco: 0 }
    a.hueco = dropIndex(centros, -1, a.inicio)
    arrastre = a
    el.classList.add("levantada")
    lista.classList.add("arrastrando")
    marcarHueco(a)
  }

  const soltarArrastre = (aplicar: boolean): void => {
    asaPulsada = null
    const a: Arrastre | null = arrastre
    arrastre = null
    if (a === null) return
    a.el.style.transform = ""
    a.el.classList.remove("levantada")
    lista.classList.remove("arrastrando", "cae-al-final")
    for (const f of a.quedan) f.classList.remove("cae-antes")
    if (!aplicar || ventana?.kind !== "context") return
    const visibles: ReadonlyArray<ItemRef> = mostradas().map((i: ListItem): ItemRef => i.ref)
    const mueven: ReadonlyArray<ItemRef> = refsSeleccionadas()
    useCases.reorderItems(ventana.id, mueven, reorderBefore(visibles, mueven, a.hueco))
  }

  window.addEventListener("pointermove", (evento: PointerEvent): void => {
    const pulsada: typeof asaPulsada = asaPulsada
    if (arrastre === null && pulsada !== null) {
      if (Math.abs(evento.clientY - pulsada.y) <= TOLERANCIA_PX) return
      asaPulsada = null
      /* La fila que no estaba seleccionada se suma antes de arrastrar. */
      if (!seleccion.has(pulsada.clave)) {
        seleccion = toggleSelected(seleccion, pulsada.clave)
        pintar()
      }
      levantar(pulsada.fila, pulsada.y)
    }
    const a: Arrastre | null = arrastre
    if (a === null) return
    if (evento.clientY < BORDE_PX) window.scrollBy(0, -PASO_PX)
    else if (evento.clientY > window.innerHeight - BORDE_PX) window.scrollBy(0, PASO_PX)
    const y: number = evento.clientY + window.scrollY
    a.el.style.transform = `translateY(${y - a.inicio}px)`
    a.hueco = dropIndex(a.centros, -1, y)
    marcarHueco(a)
  })
  window.addEventListener("pointerup", (): void => soltarArrastre(true))
  window.addEventListener("pointercancel", (): void => soltarArrastre(false))
  /* Con el ⠿ levantado, el dedo arrastra y no desliza la página. No pasivo: uno
     pasivo no puede impedirlo. */
  lista.addEventListener(
    "touchmove",
    (evento: TouchEvent): void => {
      if (arrastre !== null) evento.preventDefault()
    },
    { passive: false },
  )

  lista.addEventListener("pointerdown", (evento: PointerEvent): void => {
    ultimoPuntero = evento.pointerType
    /* Cada pulsación empieza limpia: si la anterior repintó la fila, su `click`
       no llegó aquí, y sin esto se comería el del toque siguiente. */
    tragarClick = false
    const clave: string | null = claveDe(evento.target)
    if (clave === null || evento.button !== 0) return
    const objetivo: EventTarget | null = evento.target
    if (objetivo instanceof Element && enAsa(objetivo) && puedeReordenar()) {
      evento.preventDefault()
      cancelarEspera()
      const fila: HTMLElement | null = objetivo.closest<HTMLElement>("li[data-key]")
      if (fila !== null) asaPulsada = { clave, fila, y: evento.clientY }
      return
    }
    origen = { x: evento.clientX, y: evento.clientY }
    cancelarEspera()
    espera = setTimeout((): void => {
      espera = null
      tragarClick = true
      elegida(clave)
    }, PULSACION_LARGA_MS)
  })
  lista.addEventListener("pointermove", (evento: PointerEvent): void => {
    const lejos: boolean =
      Math.abs(evento.clientX - origen.x) > TOLERANCIA_PX ||
      Math.abs(evento.clientY - origen.y) > TOLERANCIA_PX
    if (lejos) cancelarEspera()
  })
  for (const fin of ["pointerup", "pointercancel", "pointerleave"]) {
    lista.addEventListener(fin, cancelarEspera)
  }

  lista.addEventListener("click", (evento: MouseEvent): void => {
    /* El ⠿ arrastra; tocarlo sin moverse no marca ni desmarca. */
    if (enAsa(evento.target)) return
    if (tragarClick) {
      tragarClick = false
      return
    }
    const clave: string | null = claveDe(evento.target)
    if (clave === null) return
    if (seleccionando) alternar(clave)
    else if (evento.ctrlKey || evento.metaKey) empezar(clave)
    else abrir(clave)
  })

  lista.addEventListener("contextmenu", (evento: MouseEvent): void => {
    const clave: string | null = claveDe(evento.target)
    if (clave === null) return
    evento.preventDefault()
    if (enAsa(evento.target)) return
    /* En táctil, el menú contextual llega con la pulsación larga, que ya actúa. */
    if (ultimoPuntero !== "touch") elegida(clave)
  })

  lista.addEventListener("keydown", (evento: KeyboardEvent): void => {
    const clave: string | null = claveDe(evento.target)
    if (clave === null) return
    /* Intro abre, como el toque; Espacio selecciona, como la pulsación larga. */
    if (evento.key === "Enter" && !seleccionando) abrir(clave)
    if (evento.key !== " ") return
    evento.preventDefault()
    elegida(clave)
  })

  window.addEventListener("keydown", (evento: KeyboardEvent): void => {
    if (seleccionando && evento.key === "Escape") salir()
  })

  /* ── Pintar ── */

  const pintar = (): void => {
    /* Por `data-key`: seleccionar una fila no rehace las demás. */
    reconcile<ListItem, Element>(lista, mostradas(), {
      key: (item: ListItem): string => itemKey(item.ref),
      keyOf: (el: Element): string | null => el.getAttribute("data-key"),
      create: (item: ListItem): Element => {
        const fila: HTMLLIElement = elemento("li")
        fila.dataset["key"] = itemKey(item.ref)
        fila.tabIndex = 0
        fila.setAttribute("role", "option")
        /* La clase no cambia: la clave lleva dentro si es nota o diagrama. */
        if (item.ref.kind === "diagram") fila.classList.add("diagrama")
        const nombre: HTMLSpanElement = elemento("span")
        nombre.className = "nombre"
        const asa: HTMLSpanElement = elemento("span", "⠿")
        asa.className = "asa"
        asa.setAttribute("aria-hidden", "true")
        fila.append(nombre, asa)
        return fila
      },
      update: (fila: Element, item: ListItem): void => {
        const marcada: boolean = seleccion.has(itemKey(item.ref))
        const nombre: Element | null = fila.querySelector(".nombre")
        if (nombre !== null) setTextIfChanged(nombre, item.name)
        setAttrIfChanged(fila, "aria-selected", marcada ? "true" : "false")
        if (fila.classList.contains("seleccionada") !== marcada) {
          fila.classList.toggle("seleccionada", marcada)
        }
      },
    })
    lista.classList.toggle("seleccionando", seleccionando)
    lista.classList.toggle("reordenable", puedeReordenar())
    sinNotas.hidden = mostradas().length > 0 || ventana === null
    mas.hidden = seleccionando || viendoOcultos || ventana === null
    masDiagrama.hidden = mas.hidden
    /* Sólo si hay alguno. Mientras se selecciona se queda, apagada: si se fuera,
       la lista subiría una fila bajo el dedo. */
    filaOcultos.hidden = ocultos.length === 0
    filaOcultos.disabled = seleccionando
    filaOcultos.setAttribute("aria-expanded", viendoOcultos ? "true" : "false")
    flechaOcultos.hidden = !viendoOcultos
    setTextIfChanged(textoOcultos, `Ocultos (${ocultos.length})`)

    barra.hidden = !seleccionando
    if (!seleccionando || ventana === null) return
    cuenta.textContent =
      seleccion.size === 1 ? "1 seleccionada" : `${seleccion.size} seleccionadas`
    papelera.textContent = trashDeletes(ventana) ? "Borrar" : "Quitar"
    ocultar.hidden = ventana.kind !== "context"
    ocultar.textContent = viendoOcultos ? "Mostrar" : "Ocultar"
    const estado: AppState = store.getState()
    const posibles: ReadonlyArray<Context> = moveTargets(estado, ventana)
    mover.disabled = posibles.length === 0
    destinos.hidden = !moviendo
    destinos.replaceChildren(
      ...(moviendo
        ? [
            ...posibles.map((ctx: Context): HTMLButtonElement =>
              boton(ctx.name, (): void => moverA(ctx)),
            ),
            boton("Cancelar", (): void => {
              moviendo = false
              pintar()
            }, "secundario"),
          ]
        : []),
    )
  }

  return {
    element,
    update: (
      nueva: WindowRef | null,
      nuevos: ReadonlyArray<ListItem>,
      nuevosOcultos: ReadonlyArray<ListItem>,
    ): void => {
      const otraVentana: boolean =
        nueva === null || ventana === null || !sameWindow(nueva, ventana)
      ventana = nueva
      items = nuevos
      ocultos = nuevosOcultos
      /* Lo que ya no está no sigue seleccionado; sin nada, se sale. */
      const quedan: Selection = otraVentana
        ? NO_SELECTION
        : pruneSelected(seleccion, mostradas().map((i: ListItem): string => itemKey(i.ref)))
      if (seleccionando && quedan.size === 0) {
        seleccion = NO_SELECTION
        salir()
      }
      seleccion = quedan
      /* En otra ventana, o sin nada oculto, la lista de los ocultos se cierra. */
      if (otraVentana || ocultos.length === 0) cerrarOcultos()
      pintar()
    },
  }
}
