/**
 * La lista de notas de una ventana, con «+ Nota» y el modo selección.
 *
 * Se entra a seleccionar con una pulsación larga, con clic derecho, con
 * Ctrl/Cmd+clic o con la barra espaciadora; dentro, cada toque selecciona. Se
 * sale al quedarse sin nada, con Escape o con el atrás. Mientras dura, abajo
 * aparece la barra con la papelera y «Mover a…».
 */

import type { AppState, Context, Note, NoteId, Store, UseCases } from "#core/index"
import { noteId } from "#core/index"
import type { BackStack } from "./backStack.js"
import type { Confirm } from "./sheet.js"
import { elemento } from "./dom.js"
import { reconcile, setAttrIfChanged, setTextIfChanged } from "./reconcile.js"
import {
  createNoteIn,
  deleteQuestion,
  moveNotes,
  moveTargets,
  trashDeletes,
  trashNotes,
} from "./noteActions.js"
import type { Selection } from "./selection.js"
import { NO_SELECTION, pruneSelected, toggleSelected } from "./selection.js"
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
}

export interface NoteList {
  readonly element: HTMLElement
  /** Lo que tiene que enseñar ahora. `null` en la pantalla vacía. */
  readonly update: (ventana: WindowRef | null, notas: ReadonlyArray<Note>) => void
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
}: NoteListDeps): NoteList => {
  let ventana: WindowRef | null = null
  let notas: ReadonlyArray<Note> = []
  let seleccion: Selection = NO_SELECTION
  let seleccionando: boolean = false
  let moviendo: boolean = false

  const lista: HTMLUListElement = elemento("ul")
  lista.className = "notas"
  lista.setAttribute("role", "listbox")
  lista.setAttribute("aria-multiselectable", "true")
  const sinNotas: HTMLParagraphElement = elemento("p", "Esta ventana no tiene notas.")
  sinNotas.className = "vacia"
  /* «+ Nota» crea y entra: la nota nueva se abre para escribir en ella. */
  const mas: HTMLButtonElement = boton("+", (): void => {
    const nueva: Note | null = ventana === null ? null : createNoteIn(useCases, ventana)
    if (nueva !== null) onOpenNote(nueva.id)
  }, "mas")
  mas.setAttribute("aria-label", "Nueva nota")
  mas.title = "Nueva nota"

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
  element.append(lista, sinNotas, mas, barra)

  /* ── Entrar y salir del modo selección ── */

  const empezar = (id: NoteId): void => {
    seleccion = toggleSelected(NO_SELECTION, id)
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

  const alternar = (id: NoteId): void => {
    seleccion = toggleSelected(seleccion, id)
    if (seleccion.size === 0) salir()
    else pintar()
  }

  const elegida = (id: NoteId): void => (seleccionando ? alternar(id) : empezar(id))

  const seleccionadas = (): ReadonlyArray<Note> =>
    notas.filter((n: Note): boolean => seleccion.has(n.id))

  const tirar = (): void => {
    if (ventana === null) return
    const donde: WindowRef = ventana
    const ids: ReadonlyArray<NoteId> = seleccionadas().map((n: Note): NoteId => n.id)
    const hacer = (): void => {
      trashNotes(useCases, donde, ids)
      salir()
    }
    /* Sólo confirma la papelera del General: es la única que borra de verdad. */
    if (trashDeletes(donde)) confirm(deleteQuestion(seleccionadas()), "🗑 Borrar", hacer)
    else hacer()
  }

  const moverA = (destino: Context): void => {
    if (ventana === null) return
    moveNotes(useCases, ventana, destino.id, seleccionadas().map((n: Note): NoteId => n.id))
    salir()
  }

  /* ── Los gestos sobre una fila ── */

  const idDe = (objetivo: EventTarget | null): NoteId | null => {
    const fila: HTMLElement | null =
      objetivo instanceof Element ? objetivo.closest<HTMLElement>("li[data-id]") : null
    const bruto: string | undefined = fila?.dataset["id"]
    return bruto === undefined ? null : noteId(bruto)
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
    const id: NoteId | null = idDe(evento.target)
    if (id === null || evento.button !== 0) return
    origen = { x: evento.clientX, y: evento.clientY }
    cancelarEspera()
    espera = setTimeout((): void => {
      espera = null
      tragarClick = true
      elegida(id)
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
    const id: NoteId | null = idDe(evento.target)
    if (id === null) return
    if (seleccionando) alternar(id)
    else if (evento.ctrlKey || evento.metaKey) empezar(id)
    else onOpenNote(id)
  })

  lista.addEventListener("contextmenu", (evento: MouseEvent): void => {
    const id: NoteId | null = idDe(evento.target)
    if (id === null) return
    evento.preventDefault()
    /* En táctil, el menú contextual llega con la pulsación larga, que ya actúa. */
    if (ultimoPuntero !== "touch") elegida(id)
  })

  lista.addEventListener("keydown", (evento: KeyboardEvent): void => {
    const id: NoteId | null = idDe(evento.target)
    if (id === null) return
    /* Intro abre, como el toque; Espacio selecciona, como la pulsación larga. */
    if (evento.key === "Enter" && !seleccionando) onOpenNote(id)
    if (evento.key !== " ") return
    evento.preventDefault()
    elegida(id)
  })

  window.addEventListener("keydown", (evento: KeyboardEvent): void => {
    if (seleccionando && evento.key === "Escape") salir()
  })

  /* ── Pintar ── */

  const pintar = (): void => {
    /* Por `data-id`: seleccionar una fila no rehace las demás. */
    reconcile<Note, Element>(lista, notas, {
      key: (nota: Note): string => nota.id,
      keyOf: (el: Element): string | null => el.getAttribute("data-id"),
      create: (nota: Note): Element => {
        const fila: HTMLLIElement = elemento("li")
        fila.dataset["id"] = nota.id
        fila.tabIndex = 0
        fila.setAttribute("role", "option")
        return fila
      },
      update: (fila: Element, nota: Note): void => {
        const marcada: boolean = seleccion.has(nota.id)
        setTextIfChanged(fila, nota.name)
        setAttrIfChanged(fila, "aria-selected", marcada ? "true" : "false")
        if (fila.classList.contains("seleccionada") !== marcada) {
          fila.classList.toggle("seleccionada", marcada)
        }
      },
    })
    lista.classList.toggle("seleccionando", seleccionando)
    sinNotas.hidden = notas.length > 0 || ventana === null
    mas.hidden = seleccionando || ventana === null

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
    update: (nueva: WindowRef | null, nuevas: ReadonlyArray<Note>): void => {
      const otraVentana: boolean =
        nueva === null || ventana === null || !sameWindow(nueva, ventana)
      ventana = nueva
      notas = nuevas
      /* Una nota que ya no está no sigue seleccionada; sin ninguna, se sale. */
      const quedan: Selection = otraVentana
        ? NO_SELECTION
        : pruneSelected(seleccion, nuevas.map((n: Note): NoteId => n.id))
      if (seleccionando && quedan.size === 0) {
        seleccion = NO_SELECTION
        salir()
      }
      seleccion = quedan
      pintar()
    },
  }
}
