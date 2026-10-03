/**
 * La vista diagrama: la cabecera con el nombre —que se renombra tocándolo—, el
 * lienzo, y abajo la barra con el exit.
 *
 * Se sale con el exit o con el atrás. Un diagrama que es ventana enseña el mismo
 * lienzo en la vista ventanas, sin exit.
 */

import type { Diagram, DiagramId, Store, Unsubscribe, UseCases } from "#core/index"
import type { BackStack } from "./backStack.js"
import type { DiagramCanvas } from "./DiagramCanvas.js"
import { createDiagramCanvas } from "./DiagramCanvas.js"
import { elemento } from "./dom.js"
import type { EditableTitle } from "./editableTitle.js"
import { createEditableTitle } from "./editableTitle.js"

export interface DiagramViewDeps {
  readonly store: Store
  readonly useCases: UseCases
  readonly back: BackStack
  readonly diagramId: DiagramId
  /** Recién creado: llega con el nombre a punto de escribirse. */
  readonly editName: boolean
  readonly onExit: () => void
}

/** Devuelve la función que la desmonta. */
export const mountDiagramView = (
  raiz: HTMLElement,
  { store, useCases, back, diagramId, editName, onExit }: DiagramViewDeps,
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

  const lienzo: DiagramCanvas = createDiagramCanvas({ store, useCases, back, diagramId })

  const salir: HTMLButtonElement = elemento("button", "✕ Salir")
  salir.type = "button"
  salir.className = "salir"
  salir.addEventListener("click", onExit)
  const barra: HTMLElement = elemento("div")
  barra.className = "barra barra-diagrama"
  barra.append(salir)

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
