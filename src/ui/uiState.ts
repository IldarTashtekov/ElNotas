/**
 * El estado de la UI de este dispositivo, en un solo objeto: el fósforo, las
 * ventanas, los encuadres de los diagramas, el orden de las rutinas, la pestaña
 * del calendario y la gráfica de las rutinas. No viaja con las notas.
 *
 * Cada sección se da a quien la usa como la persistencia de siempre: su lectura
 * saca su parte, y su guardado cambia sólo su parte. Dónde se guarda el objeto
 * lo pone `platform/`. Las capas abiertas no van aquí: son dónde se está, no
 * cómo se ve.
 */

import type { Result, StorageError } from "#core/index"
import { err, ok } from "#core/index"
import type { CalendarOrder } from "./calendarOrder.js"
import { parseCalendarOrder } from "./calendarOrder.js"
import type { CalendarTab } from "./calendarTab.js"
import { parseCalendarTab } from "./calendarTab.js"
import type { Framings } from "./diagramFraming.js"
import { parseFramings } from "./diagramFraming.js"
import type { Phosphor } from "./phosphor.js"
import { parsePhosphor } from "./phosphor.js"
import type { RoutineCharts } from "./routineCharts.js"
import { parseRoutineCharts } from "./routineCharts.js"
import type { WindowsLayout } from "./windows.js"
import { parseWindowsLayout } from "./windows.js"

export interface UiState {
  readonly phosphor: Phosphor
  readonly windows: WindowsLayout
  readonly framings: Framings
  readonly calendarOrder: CalendarOrder
  readonly calendarTab: CalendarTab
  readonly routineCharts: RoutineCharts
}

/** Lo guardado, sección a sección y sin validar: cada una la valida quien la usa. */
export type StoredUiState = Readonly<Partial<Record<keyof UiState, unknown>>>

/** Dónde se guarda el objeto entero. Lo pone `platform/`. Ninguno de los dos lanza. */
export interface UiStatePersistence {
  /** Lo guardado tal cual, sin validar, o `null` si nunca se guardó nada. */
  readonly load: () => Result<unknown, StorageError>
  readonly save: (estado: StoredUiState) => Result<void, StorageError>
}

/** Una sección, con la forma de la persistencia que ya pide quien la usa. */
export interface UiStateSection<K extends keyof UiState> {
  /** Lo guardado de esta sección tal cual, o `null` si no hay. */
  readonly load: () => Result<unknown, StorageError>
  readonly save: (valor: UiState[K]) => Result<void, StorageError>
}

type Registro = Record<string, unknown>

const esRegistro = (x: unknown): x is Registro =>
  typeof x === "object" && x !== null && !Array.isArray(x)

/** Lo guardado → el estado. Cada sección pasa por su lector: una rota vuelve a lo de siempre sin tirar las otras. */
export const parseUiState = (guardado: unknown): UiState => {
  const r: Registro = esRegistro(guardado) ? guardado : {}
  return {
    phosphor: parsePhosphor(r["phosphor"]),
    windows: parseWindowsLayout(r["windows"]),
    framings: parseFramings(r["framings"]),
    calendarOrder: parseCalendarOrder(r["calendarOrder"]),
    calendarTab: parseCalendarTab(r["calendarTab"]),
    routineCharts: parseRoutineCharts(r["routineCharts"]),
  }
}

export const uiStateSection = <K extends keyof UiState>(
  persistence: UiStatePersistence,
  seccion: K,
): UiStateSection<K> => ({
  load: (): Result<unknown, StorageError> => {
    const leido: Result<unknown, StorageError> = persistence.load()
    if (!leido.ok) return leido
    return ok(esRegistro(leido.value) ? (leido.value[seccion] ?? null) : null)
  },

  save: (valor: UiState[K]): Result<void, StorageError> => {
    /* Se relee justo antes: así no se pisa lo que otra sección, u otra pestaña,
       guardó entretanto. */
    const leido: Result<unknown, StorageError> = persistence.load()
    /* Sin poder leer, no se escribe: se borrarían las demás secciones. Si lo
       guardado está roto ya no hay nada que salvar, y se empieza de cero. */
    if (!leido.ok && leido.error.kind !== "corrupt") return err(leido.error)
    const actual: StoredUiState = leido.ok && esRegistro(leido.value) ? leido.value : {}
    return persistence.save({ ...actual, [seccion]: valor })
  },
})
