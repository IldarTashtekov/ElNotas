/**
 * La vista diagrama: la cabecera con el nombre —que se renombra tocándolo—, el
 * lienzo, y abajo la barra con la mira, que lo devuelve al inicio, el botón de
 * seleccionar nodos y el exit.
 *
 * Se sale con el exit o con el atrás. Un nodo-enlace abre encima lo que enlaza,
 * y al salir de ello se vuelve aquí. Un diagrama que es ventana enseña el mismo
 * lienzo en la vista ventanas, sin exit.
 */

import type { Day, Diagram, DiagramId, EventId, NoteId, RoutineId, Store, Unsubscribe, UseCases } from "#core/index"
import type { BackStack } from "./backStack.js"
import type { DiagramCanvas } from "./DiagramCanvas.js"
import type { DiagramFraming } from "./diagramFraming.js"
import { crosshairButton } from "./canvasButtons.js"
import { createDiagramCanvas } from "./DiagramCanvas.js"
import { elemento } from "./dom.js"
import type { EditableTitle } from "./editableTitle.js"
import { createEditableTitle } from "./editableTitle.js"

export interface DiagramViewDeps {
  readonly store: Store
  readonly useCases: UseCases
  readonly back: BackStack
  readonly diagramId: DiagramId
  /** Dónde se miraba cada diagrama: el lienzo vuelve allí. */
  readonly framing: DiagramFraming
  /** Recién creado: llega con el nombre a punto de escribirse. */
  readonly editName: boolean
  readonly onExit: () => void
  /** Abrir lo que enlaza un nodo: se abre encima, y al salir se vuelve aquí. */
  readonly onOpenNote: (id: NoteId) => void
  readonly onOpenDiagram: (id: DiagramId) => void
  readonly onOpenEvent: (id: EventId) => void
  readonly onOpenRoutine: (id: RoutineId) => void
  /** El día de hoy, para la hoja de enlazar un nodo. */
  readonly today: () => Day | null
}

/** Devuelve la función que la desmonta. */
export const mountDiagramView = (
  raiz: HTMLElement,
  {
    store,
    useCases,
    back,
    diagramId,
    framing,
    editName,
    onExit,
    onOpenNote,
    onOpenDiagram,
    onOpenEvent,
    onOpenRoutine,
    today,
  }: DiagramViewDeps,
): (() => void) => {
  const diagrama = (): Diagram | undefined => store.getState().diagrams[diagramId]

  const titulo: EditableTitle = createEditableTitle(
    "Nombre del diagrama",
    (nombre: string): void => {
      useCases.renameDiagram(diagramId, nombre)
    },
  )
  const cabecera: HTMLElement = elemento("header")
  cabecera.className = "cabecera"
  cabecera.append(titulo.element)

  const lienzo: DiagramCanvas = createDiagramCanvas({
    store,
    useCases,
    back,
    diagramId,
    framing,
    /* La mira va en la barra, con el exit. */
    floatingCrosshair: false,
    onOpenNote,
    onOpenDiagram,
    onOpenEvent,
    onOpenRoutine,
    today,
  })

  const salir: HTMLButtonElement = elemento("button", "✕ Salir")
  salir.type = "button"
  salir.className = "salir"
  salir.addEventListener("click", (): void => {
    lienzo.closeModes()
    onExit()
  })
  const barra: HTMLElement = elemento("div")
  barra.className = "barra barra-diagrama"
  barra.append(crosshairButton(lienzo.recenter), lienzo.selectButton, lienzo.trashButton, salir)

  const pintar = (): void => {
    const actual: Diagram | undefined = diagrama()
    /* Si el diagrama deja de existir mientras se mira, se sale. */
    if (actual === undefined) {
      onExit()
      return
    }
    titulo.show(actual.name, true)
  }

  /* Una columna que llena la pantalla: el lienzo ocupa lo que dejan cabecera y barra. */
  const vista: HTMLElement = elemento("div")
  vista.className = "vista-diagrama"
  vista.append(cabecera, lienzo.element, barra)
  raiz.replaceChildren(vista)
  pintar()
  if (editName) titulo.edit()
  const baja: Unsubscribe = store.subscribe((): void => pintar())

  return (): void => {
    baja()
    lienzo.destroy()
    raiz.replaceChildren()
  }
}
