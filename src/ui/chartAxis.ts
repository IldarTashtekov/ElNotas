/**
 * El eje del tiempo de la gráfica de una rutina: qué tramo de semanas se ve y
 * cómo lo cambian la rueda, el arrastre y el pellizco. Puro, sin DOM: la
 * gráfica le pasa dónde está el puntero, como fracción de su ancho.
 *
 * La semana `i` ocupa el hueco de `i` a `i + 1`. El tramo se cuenta desde el
 * final, desde la semana de hoy, para que la que va entrando siga a la vista.
 */

/** Lo que se ve: cuántas semanas caben en el ancho y cuántas quedan a la derecha, sin ver. */
export interface ChartAxis {
  readonly span: number
  readonly fromEnd: number
}

/** Lo más cerca que se puede ver: unas pocas semanas. Lo más lejos, toda la historia. */
export const MIN_SPAN_WEEKS: number = 4
/** Lo que se ve la primera vez: las últimas semanas. */
export const DEFAULT_SPAN_WEEKS: number = 12

const entre = (x: number, min: number, max: number): number => Math.min(max, Math.max(min, x))

const tramoDentro = (span: number, semanas: number): number =>
  entre(span, Math.min(MIN_SPAN_WEEKS, semanas), semanas)

/** El eje, dentro de sus topes para `semanas` semanas. El MISMO si ya lo estaba. */
export const clampAxis = (a: ChartAxis, semanas: number): ChartAxis => {
  const span: number = tramoDentro(a.span, semanas)
  const fromEnd: number = entre(a.fromEnd, 0, semanas - span)
  return span === a.span && fromEnd === a.fromEnd ? a : { span, fromEnd }
}

export const defaultAxis = (semanas: number): ChartAxis =>
  clampAxis({ span: DEFAULT_SPAN_WEEKS, fromEnd: 0 }, semanas)

/** Dónde empieza lo que se ve, en semanas desde la primera. */
export const axisStart = (a: ChartAxis, semanas: number): number => semanas - a.fromEnd - a.span

/** El eje que empieza en `inicio`, dentro de sus topes; `a` MISMO si queda como estaba. */
const conInicio = (a: ChartAxis, inicio: number, span: number, semanas: number): ChartAxis => {
  const nuevo: ChartAxis = clampAxis({ span, fromEnd: semanas - inicio - span }, semanas)
  return nuevo.span === a.span && nuevo.fromEnd === a.fromEnd ? a : nuevo
}

/** Acerca (`factor` > 1) o aleja sin que se mueva la semana que hay bajo `fraccion` del ancho. */
export const zoomAxis = (a: ChartAxis, semanas: number, fraccion: number, factor: number): ChartAxis => {
  const bajo: number = axisStart(a, semanas) + fraccion * a.span
  const span: number = tramoDentro(a.span / factor, semanas)
  return conInicio(a, bajo - fraccion * span, span, semanas)
}

/** Arrastrar `fraccion` del ancho: hacia la derecha se ven semanas más antiguas. */
export const panAxis = (a: ChartAxis, semanas: number, fraccion: number): ChartAxis =>
  conInicio(a, axisStart(a, semanas) - fraccion * a.span, a.span, semanas)

/**
 * El pellizco, siempre desde como estaba al poner el segundo dedo: `a0`/`b0`,
 * dónde estaban los dos dedos entonces, y `a1`/`b1`, dónde están ahora, como
 * fracciones del ancho. Sólo cuenta lo que se separan a lo ancho.
 */
export const pinchAxis = (
  inicio: ChartAxis,
  semanas: number,
  a0: number,
  b0: number,
  a1: number,
  b1: number,
): ChartAxis => {
  const antes: number = Math.abs(a0 - b0)
  const ahora: number = Math.abs(a1 - b1)
  const span: number =
    antes === 0 || ahora === 0 ? inicio.span : tramoDentro((inicio.span * antes) / ahora, semanas)
  const bajo: number = axisStart(inicio, semanas) + ((a0 + b0) / 2) * inicio.span
  return conInicio(inicio, bajo - ((a1 + b1) / 2) * span, span, semanas)
}

/** Dónde cae el centro de la semana `i`, en píxeles de un ancho `ancho`. */
export const weekX = (a: ChartAxis, semanas: number, i: number, ancho: number): number =>
  ((i + 0.5 - axisStart(a, semanas)) / a.span) * ancho
