/**
 * El contenido del calendario: el mes como rejilla con sus días marcados, mes
 * anterior y siguiente y «hoy», y en la pestaña Eventos, al pulsar un día, una
 * hoja con sus eventos, donde se crean, se editan y se borran.
 *
 * En la pestaña Rutinas, el sitio del mes lo puede ocupar la gráfica de la
 * rutina tocada.
 *
 * Lo que se enseña lo calcula `calendarMonth`; aquí sólo se pinta y se escucha.
 * Lo comparten la vista del icono y la ventana de la lista.
 */

import type {
  AppState,
  CalendarEvent,
  Day,
  EventId,
  Logger,
  RoutineId,
  Store,
  Time,
  Unsubscribe,
  UseCases,
} from "#core/index"
import type { BackStack } from "./backStack.js"
import type { CalendarOrderPersistence } from "./calendarOrder.js"
import type { CalendarTab, CalendarTabSetting } from "./calendarTab.js"
import type { ChartAxis } from "./chartAxis.js"
import { DEFAULT_CALENDAR_TAB, daysOpenSheet } from "./calendarTab.js"
import type { DayCell, MonthRef, MonthView } from "./calendarMonth.js"
import { dayTitle, eventsOfDay, monthOf, monthView, sameMonth, shiftMonth, WEEKDAYS } from "./calendarMonth.js"
import { elemento } from "./dom.js"
import type { EventFormResult } from "./eventForm.js"
import { parseEventForm } from "./eventForm.js"
import type { EventsPanel } from "./EventsPanel.js"
import { createEventsPanel } from "./EventsPanel.js"
import type { RoutineChart } from "./RoutineChart.js"
import { createRoutineChart } from "./RoutineChart.js"
import type { RoutineCharts, RoutineChartsSetting, RoutineChartView } from "./routineCharts.js"
import { NO_ROUTINE_CHARTS } from "./routineCharts.js"
import type { RoutinesPanel } from "./RoutinesPanel.js"
import { createRoutinesPanel } from "./RoutinesPanel.js"
import type { Confirm, Sheet } from "./sheet.js"
import { createSheet } from "./sheet.js"

/** Una pestaña que no se guarda: la del calendario que no la comparte con nadie. */
const enMemoria = (): CalendarTabSetting => {
  let actual: CalendarTab = DEFAULT_CALENDAR_TAB
  return {
    get: (): CalendarTab => actual,
    set: (tab: CalendarTab): void => {
      actual = tab
    },
  }
}

/** La gráfica sin guardar: la del calendario que no la comparte con nadie. */
const graficaEnMemoria = (): RoutineChartsSetting => {
  let actual: RoutineCharts = NO_ROUTINE_CHARTS
  return {
    view: (): RoutineChartView => actual.view,
    setView: (view: RoutineChartView): void => {
      actual = { ...actual, view }
    },
    axis: (id: string): ChartAxis | null => actual.axes[id] ?? null,
    rememberAxis: (id: string, axis: ChartAxis): void => {
      actual = { ...actual, axes: { ...actual.axes, [id]: axis } }
    },
    save: (): void => undefined,
  }
}

export interface CalendarPanelDeps {
  readonly store: Store
  readonly useCases: UseCases
  readonly back: BackStack
  readonly confirm: Confirm
  /** El día de hoy en este dispositivo; `null` si se sale del rango. */
  readonly today: () => Day | null
  /** El orden de las rutinas de la lista: es de este dispositivo. */
  readonly calendarOrder: CalendarOrderPersistence
  readonly logger: Logger
  /** Sin ella, cada calendario empieza en «Eventos». */
  readonly tabs?: CalendarTabSetting
  /** Sin ella, cada calendario empieza con el mes en Rutinas. */
  readonly routineCharts?: RoutineChartsSetting
}

/** Lo que una nota enlaza del calendario: un evento, o una rutina. */
export type CalendarTarget =
  | { readonly kind: "event"; readonly id: EventId }
  | { readonly kind: "routine"; readonly id: RoutineId }

export interface CalendarPanel {
  readonly element: HTMLElement
  /** Lleva el calendario a eso: el evento, con su hoja de edición, o la rutina, tocada. */
  readonly show: (target: CalendarTarget) => void
  readonly destroy: () => void
}

/** Lo que enseña la hoja: los eventos de un día, o el formulario de uno. */
type Modo =
  | { readonly kind: "lista"; readonly day: Day }
  | { readonly kind: "formulario"; readonly day: Day; readonly editando: EventId | null }

const boton = (texto: string, alPulsar: () => void, clase?: string): HTMLButtonElement => {
  const b: HTMLButtonElement = elemento("button", texto)
  b.type = "button"
  if (clase !== undefined) b.className = clase
  b.addEventListener("click", alPulsar)
  return b
}

const campo = (rotulo: string, entrada: HTMLInputElement | HTMLTextAreaElement): HTMLLabelElement => {
  const l: HTMLLabelElement = elemento("label")
  l.className = "campo"
  l.append(elemento("span", rotulo), entrada)
  return l
}

export const createCalendarPanel = ({
  store,
  useCases,
  back,
  confirm,
  today,
  calendarOrder,
  logger,
  tabs = enMemoria(),
  routineCharts = graficaEnMemoria(),
}: CalendarPanelDeps): CalendarPanel => {
  const hoy: Day | null = today()
  let mes: MonthRef = monthOf(hoy ?? ("2026-01-01" as Day))
  let modo: Modo | null = null

  const raiz: HTMLElement = elemento("div")
  raiz.className = "calendario"
  const hoja: Sheet = createSheet(back)
  const caja: HTMLElement = elemento("div")
  caja.className = "evento-hoja"

  /* ── El mes ── */

  const titulo: HTMLSpanElement = elemento("span")
  titulo.className = "mes-titulo"
  const anterior: HTMLButtonElement = boton("‹", (): void => ir(-1), "flecha")
  anterior.setAttribute("aria-label", "Mes anterior")
  const siguiente: HTMLButtonElement = boton("›", (): void => ir(1), "flecha")
  siguiente.setAttribute("aria-label", "Mes siguiente")
  const irAHoy: HTMLButtonElement = boton("hoy", (): void => {
    if (hoy === null) return
    mes = monthOf(hoy)
    pintarMes()
  }, "secundario mes-hoy")
  const barra: HTMLElement = elemento("div")
  barra.className = "mes-barra"
  barra.append(anterior, titulo, siguiente, irAHoy)

  const cabeza: HTMLElement = elemento("div")
  cabeza.className = "mes-semana mes-dias"
  cabeza.append(...WEEKDAYS.map((d: string): HTMLSpanElement => elemento("span", d)))
  const rejilla: HTMLElement = elemento("div")
  rejilla.className = "mes-rejilla"

  const ir = (n: number): void => {
    const otro: MonthRef | null = shiftMonth(mes, n)
    if (otro === null) return
    mes = otro
    pintarMes()
  }

  const celda = (c: DayCell): HTMLButtonElement => {
    const b: HTMLButtonElement = boton(String(c.number), (): void => {
      if (daysOpenSheet(tabs.get())) abrirDia(c.day)
    }, "dia")
    /* En Rutinas el día se ve igual pero no reacciona: ni cursor de mano ni foco con el tabulador. */
    const quieto: boolean = !daysOpenSheet(tabs.get())
    b.classList.toggle("quieto", quieto)
    b.tabIndex = quieto ? -1 : 0
    if (quieto) b.setAttribute("aria-disabled", "true")
    b.classList.toggle("fuera", !c.inMonth)
    b.classList.toggle("hoy", c.isToday)
    /* Cada pestaña pinta lo suyo en el mes: * los eventos, el borde brillante las rutinas marcadas. */
    const conEventos: boolean = tabs.get() === "events" && c.marked
    const conRutinas: boolean = tabs.get() === "routines" && c.routinesDone > 0
    b.classList.toggle("marcado", conEventos)
    b.classList.toggle("cumplido", conRutinas)
    const rutinas: string = !conRutinas ? "" : `, rutinas ${c.routinesDone} de ${c.routinesTotal}`
    b.setAttribute("aria-label", `${dayTitle(c.day)}${conEventos ? ", con eventos" : ""}${rutinas}`)
    if (conEventos) {
      const marca: HTMLElement = elemento("i")
      marca.className = "dia-marca asterisco"
      marca.textContent = "*"
      b.append(marca)
    }
    return b
  }

  const pintarMes = (): void => {
    const vista: MonthView | null = monthView(store.getState(), mes, hoy, rutinas.touched())
    if (vista === null) return
    titulo.textContent = vista.title
    anterior.disabled = shiftMonth(mes, -1) === null
    siguiente.disabled = shiftMonth(mes, 1) === null
    irAHoy.disabled = hoy === null || sameMonth(mes, monthOf(hoy))
    rejilla.replaceChildren(...vista.weeks.flat().map(celda))
  }

  /* ── La hoja: los eventos de un día ── */

  const abrirDia = (day: Day): void => {
    modo = { kind: "lista", day }
    pintarCaja()
    hoja.open("", [caja])
  }

  const fila = (e: CalendarEvent): HTMLElement => {
    const li: HTMLElement = elemento("div")
    li.className = "evento"
    const texto: HTMLButtonElement = boton(
      `${e.time === undefined ? "" : `${e.time} `}${e.title}`,
      (): void => {
        modo = { kind: "formulario", day: e.day, editando: e.id }
        pintarCaja()
      },
      "evento-texto",
    )
    li.append(texto)
    return li
  }

  const pintarLista = (day: Day): void => {
    const eventos: ReadonlyArray<CalendarEvent> = eventsOfDay(store.getState(), day)
    const lista: HTMLElement = elemento("div")
    lista.className = "eventos"
    lista.append(...(eventos.length === 0 ? [elemento("p", "Sin eventos este día.")] : eventos.map(fila)))
    const nuevo: HTMLButtonElement = boton("+ Evento", (): void => {
      modo = { kind: "formulario", day, editando: null }
      pintarCaja()
    }, "hoja-nuevo")
    /* El día va dentro del contenido, no como título de la hoja: al mover un evento a otro día cambia. */
    const cabecera: HTMLHeadingElement = elemento("h2", dayTitle(day))
    caja.replaceChildren(cabecera, lista, nuevo)
  }

  /* ── La hoja: crear o editar un evento ── */

  const pintarFormulario = (day: Day, editando: EventId | null): void => {
    const estado: AppState = store.getState()
    const evento: CalendarEvent | undefined = editando === null ? undefined : estado.events[editando]
    if (editando !== null && evento === undefined) {
      /* Lo borró otra cosa mientras se editaba. */
      modo = { kind: "lista", day }
      pintarCaja()
      return
    }

    const dia: HTMLInputElement = elemento("input")
    dia.type = "date"
    dia.value = evento?.day ?? day
    const hora: HTMLInputElement = elemento("input")
    hora.type = "time"
    hora.value = evento?.time ?? ""
    /* Un área de texto, no una línea: un motivo largo salta de línea en vez de esconderse. */
    const motivo: HTMLTextAreaElement = elemento("textarea")
    motivo.rows = 2
    motivo.placeholder = "Motivo"
    motivo.value = evento?.title ?? ""

    const problema: HTMLParagraphElement = elemento("p")
    problema.className = "problema"
    problema.setAttribute("role", "alert")
    problema.hidden = true

    const guardar = (): void => {
      const leido: EventFormResult = parseEventForm(dia.value, hora.value, motivo.value)
      if (!leido.ok) {
        problema.textContent = leido.problem
        problema.hidden = false
        return
      }
      const { day: elDia, time, title }: { day: Day; time: Time | null; title: string } = leido.input
      if (evento === undefined) useCases.createEvent(elDia, time, title)
      else useCases.updateEvent(evento.id, elDia, time, title)
      modo = { kind: "lista", day: elDia }
      pintarCaja()
    }

    const acciones: HTMLElement = elemento("div")
    acciones.className = "hoja-nuevos"
    acciones.append(boton("Guardar", guardar, "hoja-nuevo"))
    if (evento !== undefined) {
      acciones.append(
        boton("Borrar", (): void => {
          confirm("¿Borrar este evento? No se puede deshacer.", "Borrar", (): void => {
            useCases.deleteEvent(evento.id)
            modo = { kind: "lista", day: evento.day }
            pintarCaja()
          })
        }, "hoja-peligro"),
      )
    }

    const volver: HTMLButtonElement = boton("‹ Volver al día", (): void => {
      modo = { kind: "lista", day }
      pintarCaja()
    }, "secundario")
    caja.replaceChildren(
      volver,
      elemento("p", evento === undefined ? "Evento nuevo" : "Editar evento"),
      campo("Día", dia),
      campo("Hora", hora),
      campo("Motivo", motivo),
      problema,
      acciones,
    )
  }

  const pintarCaja = (): void => {
    if (modo === null) return
    if (modo.kind === "lista") pintarLista(modo.day)
    else pintarFormulario(modo.day, modo.editando)
  }

  /* Un evento de la lista se abre para editarlo, en la hoja; «+ Evento», para crear uno hoy. */
  const abrirEvento = (e: CalendarEvent): void => {
    modo = { kind: "formulario", day: e.day, editando: e.id }
    pintarCaja()
    hoja.open("", [caja])
  }
  const eventos: EventsPanel = createEventsPanel({
    store,
    today,
    onOpenEvent: abrirEvento,
    onNewEvent: (): void => {
      modo = { kind: "formulario", day: hoy ?? ("2026-01-01" as Day), editando: null }
      pintarCaja()
      hoja.open("", [caja])
    },
  })

  const rutinas: RoutinesPanel = createRoutinesPanel({
    store,
    useCases,
    back,
    confirm,
    today,
    calendarOrder,
    logger,
    onTouched: (): void => {
      pintarMes()
      ponerModo()
    },
    chartView: (): RoutineChartView => routineCharts.view(),
    onToggleView: (): void => {
      routineCharts.setView(routineCharts.view() === "chart" ? "month" : "chart")
      ponerModo()
    },
  })

  /* ── La gráfica, en el sitio del mes ── */

  const grafica: RoutineChart = createRoutineChart({ store, today, charts: routineCharts })
  /** En Rutinas, con tabla y la gráfica elegida, ésta ocupa el sitio del mes; si no, el mes. */
  const ponerModo = (): void => {
    const conGrafica: boolean =
      tabs.get() === "routines" && routineCharts.view() === "chart" && rutinas.hasTable()
    barra.hidden = conGrafica
    cabeza.hidden = conGrafica
    rejilla.hidden = conGrafica
    grafica.element.hidden = !conGrafica
    if (conGrafica) grafica.show([...rutinas.touched()][0] ?? null)
  }

  /* Las dos listas comparten el sitio: una pestaña elige cuál se ve. */
  const pestanas: HTMLElement = elemento("div")
  pestanas.className = "pestanas"
  pestanas.setAttribute("role", "tablist")
  const elegirPestana = (cual: CalendarTab): void => {
    tabs.set(cual)
    pintarMes()
    ponerModo()
    eventos.element.hidden = cual !== "events"
    rutinas.element.hidden = cual !== "routines"
    for (const b of Array.from(pestanas.children)) {
      b.setAttribute("aria-selected", b.getAttribute("data-pestana") === tabs.get() ? "true" : "false")
    }
  }
  for (const [cual, texto] of [["events", "Eventos"], ["routines", "Rutinas"]] as const) {
    const b: HTMLButtonElement = boton(texto, (): void => elegirPestana(cual), "pestana")
    b.setAttribute("role", "tab")
    b.setAttribute("data-pestana", cual)
    pestanas.append(b)
  }
  elegirPestana(tabs.get())

  raiz.append(barra, cabeza, rejilla, grafica.element, pestanas, eventos.element, rutinas.element, hoja.element)
  pintarMes()

  /* Los cambios del almacén repintan el mes y, con la hoja abierta, la lista del día. */
  let pintadoEventos: AppState["events"] | null = null
  let pintadoRutinas: AppState["routines"] | null = null
  const alCambiar: Unsubscribe = store.subscribe((estado: AppState): void => {
    if (
      estado.events === pintadoEventos &&
      estado.routines === pintadoRutinas
    ) {
      return
    }
    pintadoEventos = estado.events
    pintadoRutinas = estado.routines
    pintarMes()
    eventos.update()
    rutinas.update()
    ponerModo()
    if (!hoja.element.hidden && modo?.kind === "lista") pintarCaja()
  })

  return {
    element: raiz,
    show: (target: CalendarTarget): void => {
      if (target.kind === "routine") {
        elegirPestana("routines")
        rutinas.touch(target.id)
        return
      }
      const evento: CalendarEvent | undefined = store.getState().events[target.id]
      if (evento === undefined) return
      elegirPestana("events")
      mes = monthOf(evento.day)
      pintarMes()
      abrirEvento(evento)
    },
    destroy: (): void => {
      alCambiar()
      rutinas.destroy()
      grafica.destroy()
    },
  }
}
