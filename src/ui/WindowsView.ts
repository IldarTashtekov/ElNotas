/**
 * La vista ventanas, la principal: arriba, las pestañas —en una fila que se
 * desliza y se reordena manteniendo pulsada una, la ✕ en la activa y un «+» al
 * final—; debajo, el
 * título de la activa —que se renombra tocándolo, salvo en el General—, sus
 * notas y el ⚙ de la configuración. Una ventana de nota enseña el mismo editor
 * que la vista nota, con su barra y sin exit; una de diagrama, el mismo lienzo
 * que la vista diagrama, también sin exit. Sin ventanas, una pantalla vacía.
 *
 * Lo que se enseña lo decide `windowView`; aquí sólo se pinta y se escucha.
 */

import type {
  AppState,
  Day,
  Logger,
  DiagramId,
  EventId,
  Note,
  NoteId,
  RoutineId,
  StorageError,
  Store,
  UseCases,
} from "#core/index"
import type { BackStack } from "./backStack.js"
import type { CalendarOrderPersistence } from "./calendarOrder.js"
import type { CalendarPanel } from "./CalendarPanel.js"
import type { CalendarTabSetting } from "./calendarTab.js"
import type { RoutineChartsSetting } from "./routineCharts.js"
import { createCalendarPanel } from "./CalendarPanel.js"
import type { DiagramCanvas } from "./DiagramCanvas.js"
import type { DiagramFraming } from "./diagramFraming.js"
import { createDiagramCanvas } from "./DiagramCanvas.js"
import { attachDragReorder } from "./dragReorder.js"
import type { Confirm, Sheet } from "./sheet.js"
import { corruptNotice, elemento } from "./dom.js"
import type { EditableTitle } from "./editableTitle.js"
import { createEditableTitle } from "./editableTitle.js"
import type { NoteEditor } from "./NoteEditor.js"
import { createNoteEditor } from "./NoteEditor.js"
import type { ItemList } from "./ItemList.js"
import { createItemList } from "./ItemList.js"
import { newWindowButtons } from "./newWindowButtons.js"
import { reconcile, setAttrIfChanged, setTextIfChanged } from "./reconcile.js"
import type { WindowRow } from "./settingsContent.js"
import { addWindowChoices, choiceGroupLabel } from "./settingsContent.js"
import { createSheet } from "./sheet.js"
import type { WindowTab, WindowView } from "./windowView.js"
import { windowTabs, windowView } from "./windowView.js"
import type { WindowRef, WindowsLayout } from "./windows.js"
import type { WindowsModel } from "./windowsModel.js"

export interface WindowsViewDeps {
  readonly store: Store
  readonly useCases: UseCases
  readonly windows: WindowsModel
  /** Dónde se miraba cada diagrama, para el lienzo de una ventana de diagrama. */
  readonly framing: DiagramFraming
  /** Los ficheros que no se pudieron leer al arrancar. Vacío es lo normal. */
  readonly corrupt: ReadonlyArray<StorageError>
  readonly onOpenSettings: () => void
  readonly onOpenCalendar: () => void
  readonly today: () => Day | null
  readonly calendarOrder: CalendarOrderPersistence
  /** La pestaña del calendario, compartida con su vista. */
  readonly calendarTab: CalendarTabSetting
  /** La gráfica de las rutinas, compartida con su vista. */
  readonly routineCharts: RoutineChartsSetting
  readonly logger: Logger
  readonly back: BackStack
  readonly confirm: Confirm
  readonly onOpenNote: (id: NoteId) => void
  readonly onOpenDiagram: (id: DiagramId, editName: boolean) => void
  readonly onOpenEvent: (id: EventId) => void
  readonly onOpenRoutine: (id: RoutineId) => void
}

const flecha = (texto: string, etiqueta: string): HTMLButtonElement => {
  const boton: HTMLButtonElement = elemento("button", texto)
  boton.type = "button"
  boton.className = "flecha"
  boton.setAttribute("aria-label", etiqueta)
  return boton
}

/** La clave de una pestaña: su puesto y lo que enseña. */
const claveDe = ({ index, ref }: WindowTab): string =>
  `${index}:${ref.kind === "general" || ref.kind === "calendar" ? ref.kind : `${ref.kind}:${ref.id}`}`

export const mountWindowsView = (
  raiz: HTMLElement,
  {
    store,
    useCases,
    windows,
    framing,
    corrupt,
    onOpenSettings,
    onOpenCalendar,
    today,
    calendarOrder,
    calendarTab,
    routineCharts,
    logger,
    back,
    confirm,
    onOpenNote,
    onOpenDiagram,
    onOpenEvent,
    onOpenRoutine,
  }: WindowsViewDeps,
): void => {
  /* La fila de pestañas: todas en su carril, que se desliza, y el «+». */
  const carril: HTMLOListElement = elemento("ol")
  carril.className = "pestanas-carril"
  const agregar: HTMLButtonElement = flecha("+", "Añadir ventana")
  agregar.classList.add("agregar")
  const pestanas: HTMLElement = elemento("nav")
  pestanas.className = "pestanas"
  pestanas.setAttribute("aria-label", "Ventanas")
  pestanas.append(carril, agregar)
  const titulo: EditableTitle = createEditableTitle("Nombre", (nombre: string): void => {
    /* Se lee al guardar: es la ventana en la que se empezó a escribir. */
    if (vista.kind !== "window") return
    if (vista.editsNote !== null) useCases.renameNote(vista.editsNote, nombre)
    else if (vista.editsDiagram !== null) useCases.renameDiagram(vista.editsDiagram, nombre)
    else if (vista.renames !== null) useCases.renameContext(vista.renames, nombre)
  })
  const cabecera: HTMLElement = elemento("header")
  cabecera.className = "cabecera"
  const engranaje = (): HTMLButtonElement => {
    const boton: HTMLButtonElement = flecha("⚙", "Configuración")
    boton.addEventListener("click", onOpenSettings)
    return boton
  }
  const ajustes: HTMLButtonElement = engranaje()
  const calendario: HTMLButtonElement = flecha("▦", "Calendario")
  calendario.classList.add("icono-calendario")
  calendario.addEventListener("click", onOpenCalendar)
  cabecera.append(titulo.element, calendario, ajustes)

  /* Mientras se selecciona se apagan las pestañas, el + y ⚙: no se sale de la lista a medias. */
  const apagar = (seleccionando: boolean): void => {
    pestanas.classList.toggle("apagadas", seleccionando)
    for (const b of [agregar, calendario, ajustes]) {
      b.disabled = seleccionando
      b.classList.toggle("apagado", seleccionando)
    }
  }
  const notas: ItemList = createItemList({
    store,
    useCases,
    back,
    confirm,
    onSelectingChange: apagar,
    onOpenNote,
    onOpenDiagram,
  })
  /* Sin ventanas no hay cabecera, pero el ⚙ tiene que seguir: es la salida. Las
     pestañas, con su «+», también. */
  const sinVentanas: HTMLElement = elemento("div")
  sinVentanas.className = "vacia"
  sinVentanas.append(elemento("p", "No hay ninguna ventana."), engranaje())

  let vista: WindowView = { kind: "empty" }

  /* La ventana del calendario: el mismo contenido que su vista, sin ✕. */
  const panelCalendario: CalendarPanel = createCalendarPanel({
    store,
    useCases,
    back,
    confirm,
    today,
    calendarOrder,
    logger,
    tabs: calendarTab,
    routineCharts,
  })
  const zonaCalendario: HTMLElement = panelCalendario.element
  zonaCalendario.hidden = true

  /* ── La ventana de nota: el mismo editor que la vista nota, en otro marco ── */

  const zonaEditor: HTMLElement = elemento("div")
  zonaEditor.className = "vista-nota en-ventana"
  /** El editor montado, y de qué nota. Uno a la vez: cambiar de ventana lo rehace. */
  let editor: { readonly nota: NoteId; readonly instancia: NoteEditor } | null = null

  const soltarEditor = (): void => {
    editor?.instancia.destroy()
    editor = null
    zonaEditor.replaceChildren()
  }

  const montarEditor = (id: NoteId, nota: Note): void => {
    if (editor === null || editor.nota !== id) {
      /* El modo de escritura nace aquí y muere al salir de la ventana, como en la vista nota. */
      soltarEditor()
      const instancia: NoteEditor = createNoteEditor({
        useCases,
        noteId: id,
        note: (): Note | undefined => store.getState().notes[id],
        state: store.getState,
        onOpenNote,
        onOpenDiagram: (otro: DiagramId): void => onOpenDiagram(otro, false),
        onOpenEvent,
        onOpenRoutine,
        today,
        sheet: hoja,
      })
      const barra: HTMLElement = elemento("div")
      barra.className = "barra barra-modo"
      /* Sin exit: de una ventana no se sale, se pasa a otra. */
      barra.append(...instancia.modeButtons)
      zonaEditor.append(instancia.element, barra)
      editor = { nota: id, instancia }
    }
    editor.instancia.refresh(nota)
  }

  /* ── La ventana de diagrama: el mismo lienzo que la vista diagrama, en otro marco ── */

  const zonaLienzo: HTMLElement = elemento("div")
  zonaLienzo.className = "vista-diagrama en-ventana"
  /** El lienzo montado, y de qué diagrama. Uno a la vez: cambiar de ventana lo rehace. */
  let lienzo: { readonly diagrama: DiagramId; readonly instancia: DiagramCanvas } | null = null

  const soltarLienzo = (): void => {
    lienzo?.instancia.destroy()
    lienzo = null
    zonaLienzo.replaceChildren()
  }

  const montarLienzo = (id: DiagramId): void => {
    if (lienzo !== null && lienzo.diagrama === id) return
    soltarLienzo()
    const instancia: DiagramCanvas = createDiagramCanvas({
      store,
      useCases,
      back,
      diagramId: id,
      framing,
      /* Una ventana no tiene barra: la mira va sobre el lienzo. */
      floatingCrosshair: true,
      onOpenNote,
    })
    zonaLienzo.append(instancia.element)
    lienzo = { diagrama: id, instancia }
  }

  /* ── Las pestañas: tocar una lleva a ella; su ✕, sólo en la activa, la cierra ── */

  /** La pestaña que se pintó en cada `li`, para saber cuál se toca. */
  const pintadas: WeakMap<Element, WindowTab> = new WeakMap<Element, WindowTab>()

  /* Cambiar de ventana rehace el lienzo: los modos del que se va, cerrados antes. */
  const alTocarPestana = (evento: MouseEvent): void => {
    if (!(evento.target instanceof Element) || pestanas.classList.contains("apagadas")) return
    const li: Element | null = evento.target.closest("li.pestana-ventana")
    const tab: WindowTab | undefined = li === null ? undefined : pintadas.get(li)
    if (tab === undefined) return
    lienzo?.instancia.closeModes()
    /* Sin confirmar: sólo quita la referencia, y se vuelve a abrir con el «+». */
    if (evento.target.closest(".cerrar") !== null) windows.close(tab.index)
    else windows.setActive(tab.ref)
  }
  pestanas.addEventListener("click", alTocarPestana)

  const crearPestana = (tab: WindowTab): Element => {
    const li: HTMLLIElement = elemento("li")
    li.className = "pestana-ventana"
    li.dataset["key"] = claveDe(tab)
    li.setAttribute("role", "tab")
    const simbolo: HTMLSpanElement = elemento("span", tab.symbol)
    simbolo.className = "simbolo"
    simbolo.setAttribute("aria-hidden", "true")
    const nombre: HTMLSpanElement = elemento("span")
    nombre.className = "nombre"
    const cerrar: HTMLButtonElement = elemento("button", "✕")
    cerrar.type = "button"
    cerrar.className = "cerrar"
    li.append(simbolo, nombre, cerrar)
    return li
  }

  const ponerPestana = (li: Element, tab: WindowTab): void => {
    pintadas.set(li, tab)
    const nombre: Element | null = li.querySelector(".nombre")
    if (nombre !== null) setTextIfChanged(nombre, tab.title)
    setAttrIfChanged(li, "title", tab.title)
    setAttrIfChanged(li, "aria-label", tab.title)
    setAttrIfChanged(li, "aria-selected", tab.active ? "true" : "false")
    if (li.classList.contains("activa") !== tab.active) li.classList.toggle("activa", tab.active)
    const cerrar: HTMLElement | null = li.querySelector<HTMLElement>(".cerrar")
    if (cerrar !== null) {
      cerrar.hidden = !tab.active
      setAttrIfChanged(cerrar, "aria-label", `Cerrar «${tab.title}»`)
    }
  }

  /* Reordenar: mantener pulsada una pestaña. */
  attachDragReorder(carril, {
    fichas: "li.pestana-ventana",
    ignorar: ".cerrar",
    onMove: (de: number, a: number): void => {
      if (!pestanas.classList.contains("apagadas")) windows.move(de, a)
    },
  })

  /** La activa, siempre a la vista: si se sale del carril, se desliza hasta ella. */
  const mostrarActiva = (): void => {
    const activa: HTMLElement | null = carril.querySelector<HTMLElement>("li.pestana-ventana.activa")
    if (activa === null) return
    const caja: DOMRect = carril.getBoundingClientRect()
    const suya: DOMRect = activa.getBoundingClientRect()
    if (suya.left < caja.left) carril.scrollLeft -= caja.left - suya.left
    else if (suya.right > caja.right) carril.scrollLeft += suya.right - caja.right
  }

  /* ── El «+»: añadir una ventana al final, e ir a ella ── */

  const hoja: Sheet = createSheet(back)

  const anadir = (ref: WindowRef): void => {
    hoja.close()
    lienzo?.instancia.closeModes()
    windows.add(ref)
  }

  /** El rótulo de un grupo del selector, si a esa opción le toca uno. */
  const rotulo = (texto: string | null): ReadonlyArray<HTMLElement> => {
    if (texto === null) return []
    const grupo: HTMLElement = elemento("span", texto)
    grupo.className = "grupo"
    return [grupo]
  }

  const opcion = (texto: string, alPulsar: () => void): HTMLButtonElement => {
    const b: HTMLButtonElement = elemento("button", texto)
    b.type = "button"
    b.addEventListener("click", alPulsar)
    return b
  }

  agregar.addEventListener("click", (): void => {
    const opciones: ReadonlyArray<WindowRow> = addWindowChoices(windows.getLayout(), store.getState())
    const lista: HTMLElement = elemento("div")
    lista.className = "selector"
    /* Las notas y los diagramas, detrás de su rótulo, como en la configuración. */
    lista.append(
      ...opciones.flatMap((o: WindowRow, i: number): ReadonlyArray<HTMLElement> => [
        ...rotulo(choiceGroupLabel(opciones, i)),
        opcion(o.title, (): void => anadir(o.ref)),
      ]),
    )
    const nuevos: HTMLElement = newWindowButtons(useCases, (ref: WindowRef): void => {
      anadir(ref)
      /* Nace con el título a punto de escribir su nombre. */
      titulo.edit()
    })
    hoja.open("Añadir ventana", opciones.length > 0 ? [nuevos, lista] : [nuevos])
  })

  /* ── Pintar ── */

  let pintadoEstado: AppState | null = null
  let pintadoLayout: WindowsLayout | null = null

  const pintar = (forzar: boolean = false): void => {
    const estado: AppState = store.getState()
    const layout: WindowsLayout = windows.getLayout()
    /* El core y la guarda devuelven el MISMO objeto si nada cambió: con eso basta
       para no tocar el DOM. */
    if (!forzar && estado === pintadoEstado && layout === pintadoLayout) return
    pintadoEstado = estado
    pintadoLayout = layout
    vista = windowView(layout, estado)

    reconcile<WindowTab, Element>(carril, windowTabs(layout, estado), {
      key: claveDe,
      keyOf: (el: Element): string | null => el.getAttribute("data-key"),
      create: crearPestana,
      update: ponerPestana,
    })

    if (vista.kind === "empty") {
      cabecera.hidden = true
      notas.update(null, [], [])
      soltarEditor()
      soltarLienzo()
      zonaCalendario.hidden = true
      sinVentanas.hidden = false
      return
    }

    cabecera.hidden = false
    sinVentanas.hidden = true

    titulo.show(
      vista.title,
      vista.renames !== null || vista.editsNote !== null || vista.editsDiagram !== null,
    )

    const nota: Note | undefined =
      vista.editsNote === null ? undefined : estado.notes[vista.editsNote]
    zonaCalendario.hidden = !vista.showsCalendar
    if (vista.showsCalendar) {
      notas.element.hidden = true
      notas.update(null, [], [])
      soltarEditor()
      soltarLienzo()
    } else if (vista.editsNote !== null && nota !== undefined) {
      notas.element.hidden = true
      notas.update(null, [], [])
      soltarLienzo()
      montarEditor(vista.editsNote, nota)
    } else if (vista.editsDiagram !== null) {
      notas.element.hidden = true
      notas.update(null, [], [])
      soltarEditor()
      montarLienzo(vista.editsDiagram)
    } else {
      soltarEditor()
      soltarLienzo()
      notas.element.hidden = false
      notas.update(vista.ref, vista.items, vista.hidden)
    }
    /* Al final: lo montado debajo puede cambiar el ancho de la fila. */
    mostrarActiva()
  }

  raiz.replaceChildren(
    ...(corrupt.length > 0 ? [corruptNotice(corrupt)] : []),
    pestanas,
    cabecera,
    notas.element,
    zonaEditor,
    zonaLienzo,
    zonaCalendario,
    sinVentanas,
    hoja.element,
  )
  pintar()
  store.subscribe((): void => pintar())
  windows.subscribe((): void => pintar())
}
