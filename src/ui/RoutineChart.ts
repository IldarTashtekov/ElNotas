/**
 * La gráfica de la rutina tocada, en el sitio del mes: un punto por semana con
 * los días cumplidos en ella, de 0 a 7, unidos por una línea, y la meta como una
 * línea discontinua. Se acerca y se aleja a lo ancho con la rueda o con dos
 * dedos, y se arrastra para ir a otras semanas.
 *
 * Qué semanas hay lo calcula `routineWeeks`; qué tramo se ve, `chartAxis`; aquí
 * sólo se pinta y se escucha.
 */

import type { Day, Routine, RoutineId, Store } from "#core/index"
import { partsOf } from "#core/index"
import { svg } from "./canvasButtons.js"
import type { ChartAxis } from "./chartAxis.js"
import { axisStart, clampAxis, defaultAxis, panAxis, pinchAxis, weekX, zoomAxis } from "./chartAxis.js"
import { elemento } from "./dom.js"
import type { RoutineChartsSetting, WeekCount } from "./routineCharts.js"
import { routineWeeks } from "./routineCharts.js"
import { wheelFactor } from "./viewport.js"
import { shortDateName } from "./dateNames.js"
import { textos } from "./textos/idioma.js"

export interface RoutineChartDeps {
  readonly store: Store
  readonly today: () => Day | null
  readonly charts: RoutineChartsSetting
}

export interface RoutineChart {
  readonly element: HTMLElement
  /** Enseña esa rutina, o el aviso si no hay ninguna tocada. */
  readonly show: (id: string | null) => void
  /** Repinta con lo que haya en el almacén. */
  readonly update: () => void
  readonly destroy: () => void
}

/* Los márgenes del dibujo, en píxeles: a la izquierda los días, abajo las semanas. */
const IZQUIERDA: number = 22
const DERECHA: number = 8
const ARRIBA: number = 10
const ABAJO: number = 22
/** Lo que mide como poco cada rótulo de semana: si no caben todos, se salta alguno. */
const ROTULO_PX: number = 44
const MAX_DIAS: number = 7

/** Un pellizco en marcha: cómo estaba el eje y dónde estaban los dos dedos al empezar. */
interface Pellizco {
  readonly eje: ChartAxis
  readonly a: number
  readonly b: number
  readonly idA: number
  readonly idB: number
}

export const createRoutineChart = ({ store, today, charts }: RoutineChartDeps): RoutineChart => {
  let id: string | null = null
  let semanas: ReadonlyArray<WeekCount> = []
  let meta: number | null = null
  let eje: ChartAxis = defaultAxis(1)
  /* Dónde está cada puntero que toca la gráfica, en x de la ventana. */
  let dedos: Readonly<Record<number, number>> = {}
  let pellizco: Pellizco | null = null

  const raiz: HTMLElement = elemento("div")
  raiz.className = "rutina-grafica"
  const aviso: HTMLParagraphElement = elemento("p", textos.rutinas.eligeUna)
  aviso.className = "rutina-grafica-aviso"
  const dibujo: SVGSVGElement = svg("svg")
  dibujo.setAttribute("aria-hidden", "true")
  raiz.append(aviso, dibujo)

  const anchoUtil = (): number => Math.max(1, raiz.clientWidth - IZQUIERDA - DERECHA)
  /** Dónde cae una x de la ventana, como fracción del ancho del dibujo. */
  const fraccion = (x: number): number => (x - raiz.getBoundingClientRect().left - IZQUIERDA) / anchoUtil()

  const linea = (x1: number, y1: number, x2: number, y2: number, clase: string): SVGLineElement => {
    const l: SVGLineElement = svg("line")
    l.setAttribute("x1", String(x1))
    l.setAttribute("y1", String(y1))
    l.setAttribute("x2", String(x2))
    l.setAttribute("y2", String(y2))
    l.setAttribute("class", clase)
    return l
  }
  const texto = (x: number, y: number, contenido: string, clase: string): SVGTextElement => {
    const t: SVGTextElement = svg("text")
    t.setAttribute("x", String(x))
    t.setAttribute("y", String(y))
    t.setAttribute("class", clase)
    t.textContent = contenido
    return t
  }

  const pintar = (): void => {
    const sinRutina: boolean = id === null || semanas.length === 0
    aviso.hidden = !sinRutina
    dibujo.style.display = sinRutina ? "none" : ""
    const ancho: number = raiz.clientWidth
    const alto: number = raiz.clientHeight
    if (sinRutina || ancho === 0 || alto === 0) return
    dibujo.setAttribute("viewBox", `0 0 ${ancho} ${alto}`)
    const util: number = anchoUtil()
    const fondo: number = alto - ABAJO
    const y = (dias: number): number => fondo - (dias / MAX_DIAS) * (fondo - ARRIBA)
    const n: number = semanas.length

    const fijos: ReadonlyArray<SVGElement> = [
      linea(IZQUIERDA, y(0), ancho - DERECHA, y(0), "grafica-eje"),
      linea(IZQUIERDA, y(MAX_DIAS), ancho - DERECHA, y(MAX_DIAS), "grafica-rejilla"),
      texto(IZQUIERDA - 6, y(0) + 4, "0", "grafica-dias"),
      texto(IZQUIERDA - 6, y(MAX_DIAS) + 4, String(MAX_DIAS), "grafica-dias"),
      ...(meta === null
        ? []
        : [
            linea(IZQUIERDA, y(meta), ancho - DERECHA, y(meta), "grafica-meta"),
            texto(IZQUIERDA - 6, y(meta) + 4, String(meta), "grafica-dias grafica-dias-meta"),
          ]),
    ]

    /* Lo de dentro va en su propio lienzo, que recorta lo que se sale por los lados. */
    const dentro: SVGSVGElement = svg("svg")
    dentro.setAttribute("x", String(IZQUIERDA))
    dentro.setAttribute("y", "0")
    dentro.setAttribute("width", String(util))
    dentro.setAttribute("height", String(alto))
    const desde: number = Math.max(0, Math.floor(axisStart(eje, n)) - 1)
    const hasta: number = Math.min(n - 1, Math.ceil(axisStart(eje, n) + eje.span))
    const visibles: ReadonlyArray<number> = Array.from(
      { length: Math.max(0, hasta - desde + 1) },
      (_: unknown, k: number): number => desde + k,
    )
    const puntos: ReadonlyArray<readonly [number, number, WeekCount]> = visibles.flatMap(
      (i: number): ReadonlyArray<readonly [number, number, WeekCount]> => {
        const s: WeekCount | undefined = semanas[i]
        return s === undefined ? [] : [[i, weekX(eje, n, i, util), s]]
      },
    )
    const recorrido: SVGPolylineElement = svg("polyline")
    recorrido.setAttribute("class", "grafica-linea")
    recorrido.setAttribute(
      "points",
      puntos.map(([, x, s]: readonly [number, number, WeekCount]): string => `${x},${y(s.done)}`).join(" "),
    )
    const marcas: ReadonlyArray<SVGElement> = puntos.map(
      ([, x, s]: readonly [number, number, WeekCount]): SVGElement => {
        const punto: SVGCircleElement = svg("circle")
        punto.setAttribute("cx", String(x))
        punto.setAttribute("cy", String(y(s.done)))
        punto.setAttribute("r", "3")
        punto.setAttribute("class", meta !== null && s.done >= meta ? "grafica-punto cumplida" : "grafica-punto")
        return punto
      },
    )
    dentro.replaceChildren(recorrido, ...marcas)

    /* Los rótulos de las semanas, en otro lienzo de todo el ancho: van bajo los
       de los días, así que pueden salirse del dibujo sin cortarse. Cada cuántas
       semanas cabe uno; la de hoy, siempre. */
    const rotulos: SVGSVGElement = svg("svg")
    rotulos.setAttribute("width", String(ancho))
    rotulos.setAttribute("height", String(alto))
    const cada: number = Math.max(1, Math.ceil(ROTULO_PX / (util / eje.span)))
    rotulos.replaceChildren(
      ...puntos.flatMap(([i, x, s]: readonly [number, number, WeekCount]): ReadonlyArray<SVGElement> => {
        if ((n - 1 - i) % cada !== 0) return []
        const { day, month } = partsOf(s.monday)
        return [texto(IZQUIERDA + x, alto - 6, shortDateName(month, day), "grafica-semana")]
      }),
    )
    dibujo.replaceChildren(...fijos, dentro, rotulos)
  }

  const cargar = (): void => {
    const rutina: Routine | undefined = id === null ? undefined : store.getState().routines[id as RoutineId]
    const hoy: Day | null = today()
    semanas = rutina === undefined || hoy === null ? [] : routineWeeks(rutina, hoy)
    meta = rutina?.weeklyGoal ?? null
    const n: number = Math.max(1, semanas.length)
    const recordado: ChartAxis | null = id === null ? null : charts.axis(id)
    eje = recordado === null ? defaultAxis(n) : clampAxis(recordado, n)
  }

  const mover = (nuevo: ChartAxis): void => {
    if (nuevo === eje || id === null) return
    eje = nuevo
    charts.rememberAxis(id, eje)
    pintar()
  }

  /* ── La rueda: acercar y alejar, o ir de lado con la del portátil ── */

  const alGirar = (e: WheelEvent): void => {
    if (id === null) return
    e.preventDefault()
    const n: number = Math.max(1, semanas.length)
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) mover(panAxis(eje, n, -e.deltaX / anchoUtil()))
    else mover(zoomAxis(eje, n, fraccion(e.clientX), wheelFactor(e.deltaY)))
    charts.save()
  }

  /* ── Arrastrar con un dedo o el ratón, pellizcar con dos ── */

  const alPulsar = (e: PointerEvent): void => {
    if (id === null || (e.pointerType === "mouse" && e.button !== 0)) return
    dedos = { ...dedos, [e.pointerId]: e.clientX }
    const ids: ReadonlyArray<number> = Object.keys(dedos).map(Number)
    const [idA, idB] = ids
    if (ids.length === 2 && idA !== undefined && idB !== undefined) {
      pellizco = { eje, a: dedos[idA] ?? 0, b: dedos[idB] ?? 0, idA, idB }
    }
  }

  const alMover = (e: PointerEvent): void => {
    const antes: number | undefined = dedos[e.pointerId]
    if (antes === undefined) return
    dedos = { ...dedos, [e.pointerId]: e.clientX }
    const n: number = Math.max(1, semanas.length)
    if (pellizco !== null) {
      const a1: number | undefined = dedos[pellizco.idA]
      const b1: number | undefined = dedos[pellizco.idB]
      if (a1 === undefined || b1 === undefined) return
      mover(pinchAxis(pellizco.eje, n, fraccion(pellizco.a), fraccion(pellizco.b), fraccion(a1), fraccion(b1)))
      return
    }
    mover(panAxis(eje, n, (e.clientX - antes) / anchoUtil()))
  }

  const alSoltar = (e: PointerEvent): void => {
    if (dedos[e.pointerId] === undefined) return
    dedos = Object.fromEntries(
      Object.entries(dedos).filter(([p]: [string, number]): boolean => Number(p) !== e.pointerId),
    )
    /* Con un dedo menos se sigue arrastrando con el que queda, desde donde está. */
    pellizco = null
    if (Object.keys(dedos).length === 0) charts.save()
  }

  raiz.addEventListener("wheel", alGirar, { passive: false })
  raiz.addEventListener("pointerdown", alPulsar)
  window.addEventListener("pointermove", alMover)
  window.addEventListener("pointerup", alSoltar)
  window.addEventListener("pointercancel", alSoltar)
  const medida: ResizeObserver = new ResizeObserver((): void => pintar())
  medida.observe(raiz)

  return {
    element: raiz,
    show: (nueva: string | null): void => {
      if (nueva !== id) {
        charts.save()
        id = nueva
      }
      cargar()
      pintar()
    },
    update: (): void => {
      cargar()
      pintar()
    },
    destroy: (): void => {
      charts.save()
      medida.disconnect()
      window.removeEventListener("pointermove", alMover)
      window.removeEventListener("pointerup", alSoltar)
      window.removeEventListener("pointercancel", alSoltar)
    },
  }
}
