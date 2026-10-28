/**
 * El contenido del calendario: el mes como rejilla con sus días marcados, mes
 * anterior y siguiente y «hoy», y al pulsar un día una hoja con sus eventos,
 * donde se crean, se editan, se marcan como hechos y se borran.
 *
 * Lo que se enseña lo calcula `calendarMonth`; aquí sólo se pinta y se escucha.
 * Lo comparten la vista del icono y la ventana de la lista.
 */

import type {
  AppState,
  CalendarEvent,
  Day,
  EventGroup,
  EventGroupId,
  EventId,
  Store,
  Time,
  Unsubscribe,
  UseCases,
} from "#core/index"
import { groupsOfEvent } from "#core/index"
import type { BackStack } from "./backStack.js"
import type { DayCell, MonthRef, MonthView } from "./calendarMonth.js"
import { dayTitle, eventsOfDay, monthOf, monthView, sameMonth, shiftMonth, WEEKDAYS } from "./calendarMonth.js"
import { elemento } from "./dom.js"
import type { EventFormResult } from "./eventForm.js"
import { parseEventForm } from "./eventForm.js"
import type { Confirm, Sheet } from "./sheet.js"
import { createSheet } from "./sheet.js"

export interface CalendarPanelDeps {
  readonly store: Store
  readonly useCases: UseCases
  readonly back: BackStack
  readonly confirm: Confirm
  /** El día de hoy en este dispositivo; `null` si se sale del rango. */
  readonly today: () => Day | null
}

export interface CalendarPanel {
  readonly element: HTMLElement
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

const campo = (rotulo: string, entrada: HTMLInputElement): HTMLLabelElement => {
  const l: HTMLLabelElement = elemento("label")
  l.className = "campo"
  l.append(elemento("span", rotulo), entrada)
  return l
}

export const createCalendarPanel = ({ store, useCases, back, confirm, today }: CalendarPanelDeps): CalendarPanel => {
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
    const b: HTMLButtonElement = boton(String(c.number), (): void => abrirDia(c.day), "dia")
    b.classList.toggle("fuera", !c.inMonth)
    b.classList.toggle("hoy", c.isToday)
    b.classList.toggle("marcado", c.marked)
    b.classList.toggle("hecho", c.allDone)
    b.setAttribute("aria-label", `${dayTitle(c.day)}${c.marked ? ", con eventos" : ""}`)
    return b
  }

  const pintarMes = (): void => {
    /* Sin grupos que elegir todavía: se pintan los días de todos los eventos. */
    const vista: MonthView | null = monthView(store.getState(), mes, hoy, null)
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
    hoja.open(dayTitle(day), [caja])
  }

  const fila = (e: CalendarEvent): HTMLElement => {
    const li: HTMLElement = elemento("div")
    li.className = "evento"
    li.classList.toggle("hecho", e.done)
    const marca: HTMLButtonElement = boton(e.done ? "☑" : "☐", (): void => {
      useCases.setEventDone(e.id, !e.done)
    }, "evento-hecho")
    marca.setAttribute("aria-label", e.done ? "Marcar sin hacer" : "Marcar hecho")
    const texto: HTMLButtonElement = boton(
      `${e.time === undefined ? "" : `${e.time} `}${e.title}`,
      (): void => {
        modo = { kind: "formulario", day: e.day, editando: e.id }
        pintarCaja()
      },
      "evento-texto",
    )
    li.append(marca, texto)
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
    caja.replaceChildren(lista, nuevo)
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
    const motivo: HTMLInputElement = elemento("input")
    motivo.placeholder = "Motivo"
    motivo.value = evento?.title ?? ""
    const nuevoGrupo: HTMLInputElement = elemento("input")
    nuevoGrupo.placeholder = "Grupo nuevo (opcional)"

    /* Los grupos: los que no están archivados, y los archivados en los que ya está. */
    const deEvento: ReadonlySet<EventGroupId> = new Set<EventGroupId>(
      evento === undefined ? [] : groupsOfEvent(estado, evento.id).map((g: EventGroup): EventGroupId => g.id),
    )
    const elegidos: Set<EventGroupId> = new Set<EventGroupId>(deEvento)
    const grupos: ReadonlyArray<EventGroup> = Object.values<EventGroup>(estado.eventGroups)
      .filter((g: EventGroup): boolean => g.archived !== true || deEvento.has(g.id))
      .sort((a: EventGroup, b: EventGroup): number => a.name.localeCompare(b.name))
    const opcionesGrupo: ReadonlyArray<HTMLButtonElement> = grupos.map((g: EventGroup): HTMLButtonElement => {
      const b: HTMLButtonElement = boton("", (): void => {
        if (elegidos.has(g.id)) elegidos.delete(g.id)
        else elegidos.add(g.id)
        marcar()
      }, "grupo-opcion")
      const marcar = (): void => {
        b.textContent = `${elegidos.has(g.id) ? "☑" : "☐"} ${g.name}`
        b.setAttribute("aria-pressed", elegidos.has(g.id) ? "true" : "false")
      }
      marcar()
      return b
    })
    const listaGrupos: HTMLElement = elemento("div")
    listaGrupos.className = "grupos-opciones"
    listaGrupos.append(...opcionesGrupo)

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
      const grupoNuevo: string = nuevoGrupo.value.trim()
      if (evento === undefined) {
        useCases.createEvent(elDia, time, title, [...elegidos], grupoNuevo === "" ? null : grupoNuevo)
      } else {
        useCases.updateEvent(evento.id, elDia, time, title)
        const nuevo: EventGroup | null = grupoNuevo === "" ? null : useCases.createEventGroup(grupoNuevo)
        useCases.setEventGroups(evento.id, nuevo === null ? [...elegidos] : [...elegidos, nuevo.id])
      }
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
      ...(grupos.length === 0 ? [] : [elemento("p", "Grupos"), listaGrupos]),
      campo("Grupo nuevo", nuevoGrupo),
      problema,
      acciones,
    )
  }

  const pintarCaja = (): void => {
    if (modo === null) return
    if (modo.kind === "lista") pintarLista(modo.day)
    else pintarFormulario(modo.day, modo.editando)
  }

  raiz.append(barra, cabeza, rejilla, hoja.element)
  pintarMes()

  /* Los cambios del almacén repintan el mes y, con la hoja abierta, la lista del día. */
  let pintadoEventos: AppState["events"] | null = null
  let pintadoGrupos: AppState["eventGroups"] | null = null
  const alCambiar: Unsubscribe = store.subscribe((estado: AppState): void => {
    if (estado.events === pintadoEventos && estado.eventGroups === pintadoGrupos) return
    pintadoEventos = estado.events
    pintadoGrupos = estado.eventGroups
    pintarMes()
    if (!hoja.element.hidden && modo?.kind === "lista") pintarCaja()
  })

  return { element: raiz, destroy: alCambiar }
}
