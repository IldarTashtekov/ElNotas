/**
 * La lista de una ventana —sus notas y sus diagramas—, con «+ Nota», «+ Diagrama»
 * y el modo selección.
 *
 * Se entra a seleccionar con una pulsación larga, con clic derecho, con
 * Ctrl/Cmd+clic o con la barra espaciadora; dentro, cada toque selecciona. Se
 * sale al quedarse sin nada, con Escape o con el atrás. Mientras dura, abajo
 * aparece la barra con la papelera y «Mover a…».
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
import { reconcile, setAttrIfChanged, setTextIfChanged } from "./reconcile.js"
import {
  createDiagramIn,
  createNoteIn,
  deleteQuestion,
  moveItems,
  moveTargets,
  trashDeletes,
  trashItems,
} from "./noteActions.js"
import type { Selection } from "./selection.js"
import { NO_SELECTION, itemKey, pruneSelected, toggleSelected } from "./selection.js"
import type { ListItem } from "./windowView.js"
import type { WindowRef } from "./windows.js"
import { sameWindow } from "./windows.js"

export interface NoteListDeps {
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

export interface NoteList {
  readonly element: HTMLElement
  /** Lo que tiene que enseñar ahora. `null` en la pantalla vacía. */
  readonly update: (ventana: WindowRef | null, items: ReadonlyArray<ListItem>) => void
}

/** Lo que dura una pulsación larga, y cuánto se puede mover el dedo sin anularla. */
const PULSACION_LARGA_MS: number = 500
const TOLERANCIA_PX: number = 10

const boton = (texto: string, alPulsar: () => void, clase?: string): HTMLButtonElement => {
  const b: HTMLButtonElement = elemento("button", texto)
  b.type = "button"
  if (clase !== undefined) b.className = clase
  b.addEventListener("click", alPulsar)
  return b
}

export const createNoteList = ({
  store,
  useCases,
  back,
  confirm,
  onSelectingChange,
  onOpenNote,
  onOpenDiagram,
}: NoteListDeps): NoteList => {
  let ventana: WindowRef | null = null
  let items: ReadonlyArray<ListItem> = []
  let seleccion: Selection = NO_SELECTION
  let seleccionando: boolean = false
  let moviendo: boolean = false

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
  const destinos: HTMLElement = elemento("div")
  destinos.className = "selector"
  const barra: HTMLElement = elemento("div")
  barra.className = "barra"
  barra.append(cuenta, papelera, mover, destinos)

  const element: HTMLElement = elemento("div")
  element.append(lista, sinNotas, masDiagrama, mas, barra)

  /* ── Entrar y salir del modo selección ── */

  const empezar = (clave: string): void => {
    seleccion = toggleSelected(NO_SELECTION, clave)
    seleccionando = true
    back.open((): void => {
      seleccion = NO_SELECTION
      seleccionando = false
      moviendo = false
      onSelectingChange(false)
      pintar()
    })
    onSelectingChange(true)
    pintar()
  }

  /* Salir es ir atrás: el `popstate` hace el resto, por el botón que sea. */
  const salir = (): void => back.close()

  const alternar = (clave: string): void => {
    seleccion = toggleSelected(seleccion, clave)
    if (seleccion.size === 0) salir()
    else pintar()
  }

  const elegida = (clave: string): void => (seleccionando ? alternar(clave) : empezar(clave))

  const seleccionadas = (): ReadonlyArray<ListItem> =>
    items.filter((i: ListItem): boolean => seleccion.has(itemKey(i.ref)))

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
    if (trashDeletes(donde)) confirm(deleteQuestion(seleccionadas()), "🗑 Borrar", hacer)
    else hacer()
  }

  const moverA = (destino: Context): void => {
    if (ventana === null) return
    moveItems(useCases, ventana, destino.id, refsSeleccionadas())
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
    const item: ListItem | undefined = items.find(
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

  lista.addEventListener("pointerdown", (evento: PointerEvent): void => {
    ultimoPuntero = evento.pointerType
    /* Cada pulsación empieza limpia: si la anterior repintó la fila, su `click`
       no llegó aquí, y sin esto se comería el del toque siguiente. */
    tragarClick = false
    const clave: string | null = claveDe(evento.target)
    if (clave === null || evento.button !== 0) return
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
    reconcile<ListItem, Element>(lista, items, {
      key: (item: ListItem): string => itemKey(item.ref),
      keyOf: (el: Element): string | null => el.getAttribute("data-key"),
      create: (item: ListItem): Element => {
        const fila: HTMLLIElement = elemento("li")
        fila.dataset["key"] = itemKey(item.ref)
        fila.tabIndex = 0
        fila.setAttribute("role", "option")
        /* La clase no cambia: la clave lleva dentro si es nota o diagrama. */
        if (item.ref.kind === "diagram") fila.classList.add("diagrama")
        return fila
      },
      update: (fila: Element, item: ListItem): void => {
        const marcada: boolean = seleccion.has(itemKey(item.ref))
        setTextIfChanged(fila, item.name)
        setAttrIfChanged(fila, "aria-selected", marcada ? "true" : "false")
        if (fila.classList.contains("seleccionada") !== marcada) {
          fila.classList.toggle("seleccionada", marcada)
        }
      },
    })
    lista.classList.toggle("seleccionando", seleccionando)
    sinNotas.hidden = items.length > 0 || ventana === null
    mas.hidden = seleccionando || ventana === null
    masDiagrama.hidden = mas.hidden

    barra.hidden = !seleccionando
    if (!seleccionando || ventana === null) return
    cuenta.textContent =
      seleccion.size === 1 ? "1 seleccionada" : `${seleccion.size} seleccionadas`
    papelera.textContent = trashDeletes(ventana) ? "🗑 Borrar" : "🗑 Quitar"
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
    update: (nueva: WindowRef | null, nuevos: ReadonlyArray<ListItem>): void => {
      const otraVentana: boolean =
        nueva === null || ventana === null || !sameWindow(nueva, ventana)
      ventana = nueva
      items = nuevos
      /* Lo que ya no está no sigue seleccionado; sin nada, se sale. */
      const quedan: Selection = otraVentana
        ? NO_SELECTION
        : pruneSelected(seleccion, nuevos.map((i: ListItem): string => itemKey(i.ref)))
      if (seleccionando && quedan.size === 0) {
        seleccion = NO_SELECTION
        salir()
      }
      seleccion = quedan
      pintar()
    },
  }
}
