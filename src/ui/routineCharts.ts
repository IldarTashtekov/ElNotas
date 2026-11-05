/**
 * La gráfica de una rutina, sin DOM: cuántos días se cumplieron cada semana,
 * desde la primera con alguno hasta la de hoy, y lo que se recuerda de ella en
 * este dispositivo: si en la pestaña Rutinas se ve el mes o la gráfica, y el
 * tramo que se miraba de cada rutina.
 *
 * Mientras se arrastra el tramo sólo cambia en memoria; se guarda al soltar. Es
 * de cada dispositivo: se guarda aparte de las notas y no viaja con ellas.
 */

import type { AppState, Day, Logger, Result, Routine, RoutineId, StorageError, Store } from "#core/index"
import { addDays, compareDays, dayOfWeek, daysBetween } from "#core/index"
import type { ChartAxis } from "./chartAxis.js"

/** Una semana de la gráfica: su lunes y los días cumplidos en ella, de 0 a 7. */
export interface WeekCount {
  readonly monday: Day
  readonly done: number
}

const lunesDe = (day: Day): Day | null => addDays(day, -dayOfWeek(day))

/**
 * Las semanas de la rutina, de la primera con algún día cumplido a la de hoy;
 * sin ninguno, sólo la de hoy. Las que no tienen ninguno cuentan 0.
 */
export const routineWeeks = (routine: Routine, hoy: Day): ReadonlyArray<WeekCount> => {
  const ultima: Day | null = lunesDe(hoy)
  if (ultima === null) return []
  const fin: Day | null = addDays(ultima, 6)
  const dias: ReadonlyArray<Day> = routine.days.filter((d: Day): boolean => fin !== null && compareDays(d, fin) <= 0)
  const primero: Day | undefined = dias.reduce<Day | undefined>(
    (min: Day | undefined, d: Day): Day => (min === undefined || compareDays(d, min) < 0 ? d : min),
    undefined,
  )
  const inicio: Day = (primero === undefined ? null : lunesDe(primero)) ?? ultima
  const semanas: number = Math.floor(daysBetween(inicio, ultima) / 7) + 1
  const deCadaDia: ReadonlyArray<number> = dias.map((d: Day): number => Math.floor(daysBetween(inicio, d) / 7))
  return Array.from({ length: semanas }, (_: unknown, i: number): number => i).flatMap(
    (i: number): ReadonlyArray<WeekCount> => {
      const monday: Day | null = addDays(inicio, 7 * i)
      if (monday === null) return []
      return [{ monday, done: deCadaDia.filter((s: number): boolean => s === i).length }]
    },
  )
}

/* ── Lo que se recuerda ── */

/** En la pestaña Rutinas, qué ocupa el sitio del mes. */
export type RoutineChartView = "month" | "chart"

export interface RoutineCharts {
  readonly view: RoutineChartView
  /** El tramo que se miraba de cada rutina, por su id. */
  readonly axes: Readonly<Record<string, ChartAxis>>
}

export const NO_ROUTINE_CHARTS: RoutineCharts = { view: "month", axes: {} }

/** Dónde se guarda. Lo pone `platform/`. Ninguno de los dos lanza. */
export interface RoutineChartsPersistence {
  /** Lo guardado tal cual, sin validar, o `null` si nunca se guardó nada. */
  readonly load: () => Result<unknown, StorageError>
  readonly save: (charts: RoutineCharts) => Result<void, StorageError>
}

type Registro = Record<string, unknown>

const esRegistro = (x: unknown): x is Registro => typeof x === "object" && x !== null && !Array.isArray(x)

const finito = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x)

/** Un tramo leído, o `null` si no tiene forma de serlo. Sus topes los pone la gráfica, que sabe cuántas semanas hay. */
const leerTramo = (x: unknown): ChartAxis | null => {
  if (!esRegistro(x)) return null
  const { span, fromEnd } = x
  if (!finito(span) || !finito(fromEnd) || span <= 0 || fromEnd < 0) return null
  return { span, fromEnd }
}

/** Lo guardado → lo que se recuerda. Lo que no tenga forma se descarta, sin fallar. */
export const parseRoutineCharts = (guardado: unknown): RoutineCharts => {
  if (!esRegistro(guardado)) return NO_ROUTINE_CHARTS
  const axes: Registro = esRegistro(guardado["axes"]) ? guardado["axes"] : {}
  return {
    view: guardado["view"] === "chart" ? "chart" : "month",
    axes: Object.fromEntries(
      Object.entries(axes).flatMap(([id, valor]: [string, unknown]): ReadonlyArray<[string, ChartAxis]> => {
        const tramo: ChartAxis | null = leerTramo(valor)
        return tramo === null ? [] : [[id, tramo]]
      }),
    ),
  }
}

/** Sin los tramos de rutinas que ya no están. Lo MISMO si no sobra ninguno. */
export const guardRoutineCharts = (charts: RoutineCharts, state: AppState): RoutineCharts => {
  const ids: ReadonlyArray<string> = Object.keys(charts.axes)
  const vivos: ReadonlyArray<string> = ids.filter(
    (id: string): boolean => state.routines[id as RoutineId] !== undefined,
  )
  if (vivos.length === ids.length) return charts
  return {
    ...charts,
    axes: Object.fromEntries(
      vivos.flatMap((id: string): ReadonlyArray<[string, ChartAxis]> => {
        const tramo: ChartAxis | undefined = charts.axes[id]
        return tramo === undefined ? [] : [[id, tramo]]
      }),
    ),
  }
}

export interface RoutineChartsSetting {
  readonly view: () => RoutineChartView
  /** La guarda al momento. No hace nada si ya era ésa. */
  readonly setView: (view: RoutineChartView) => void
  /** El tramo recordado de esa rutina, o `null` si no hay. */
  readonly axis: (id: string) => ChartAxis | null
  /** Lo apunta en memoria. No escribe nada. */
  readonly rememberAxis: (id: string, axis: ChartAxis) => void
  /** Escribe lo apuntado, si hay algo nuevo desde la última vez. */
  readonly save: () => void
}

export interface RoutineChartsSettingDeps {
  readonly store: Store
  readonly persistence: RoutineChartsPersistence
  readonly logger: Logger
}

export const createRoutineChartsSetting = ({
  store,
  persistence,
  logger,
}: RoutineChartsSettingDeps): RoutineChartsSetting => {
  const leido: Result<unknown, StorageError> = persistence.load()
  /* Si no se puede leer, el mes y las últimas semanas: sólo se pierde lo que se miraba. */
  let actual: RoutineCharts = guardRoutineCharts(
    leido.ok ? parseRoutineCharts(leido.value) : NO_ROUTINE_CHARTS,
    store.getState(),
  )
  let sucio: boolean = false

  const escribir = (): void => {
    actual = guardRoutineCharts(actual, store.getState())
    sucio = false
    /* Un fallo al guardar no se avisa, como el del encuadre: se ve igual y sólo
       se pierde al recargar. Queda en la consola. */
    const guardado: Result<void, StorageError> = persistence.save(actual)
    if (!guardado.ok) logger.failure("no se guardó la gráfica de las rutinas", guardado.error)
  }

  return {
    view: (): RoutineChartView => actual.view,
    setView: (view: RoutineChartView): void => {
      if (view === actual.view) return
      actual = { ...actual, view }
      escribir()
    },
    axis: (id: string): ChartAxis | null => actual.axes[id] ?? null,
    rememberAxis: (id: string, axis: ChartAxis): void => {
      const antes: ChartAxis | undefined = actual.axes[id]
      if (antes !== undefined && antes.span === axis.span && antes.fromEnd === axis.fromEnd) return
      actual = { ...actual, axes: { ...actual.axes, [id]: axis } }
      sucio = true
    },
    save: (): void => {
      if (sucio) escribir()
    },
  }
}
