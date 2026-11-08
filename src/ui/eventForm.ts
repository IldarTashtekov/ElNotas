/**
 * Lo que escribe el usuario en la hoja de un evento, convertido en lo que pide el
 * core: el día y la hora como textos del calendario, o por qué no vale.
 *
 * Puro: el DOM sólo le pasa los textos de los campos.
 */

import type { Day, Time } from "#core/index"
import { parseDay, parseTime } from "#core/index"
import { textos } from "./textos/idioma.js"

export interface EventInput {
  readonly day: Day
  /** `null` si se deja vacía: el evento es de todo el día. */
  readonly time: Time | null
  readonly title: string
}

export type EventFormResult =
  { readonly ok: true; readonly input: EventInput } | { readonly ok: false; readonly problem: string }

export const parseEventForm = (day: string, time: string, title: string): EventFormResult => {
  const dia: Day | null = parseDay(day.trim())
  if (dia === null) return { ok: false, problem: textos.eventos.diaInvalido }
  const hora: string = time.trim()
  const parsed: Time | null = hora === "" ? null : parseTime(hora)
  if (hora !== "" && parsed === null) return { ok: false, problem: textos.eventos.horaInvalida }
  /* El motivo es un texto de una línea: los saltos que se cuelen al escribirlo se vuelven espacios. */
  const motivo: string = title.replace(/\s+/g, " ").trim()
  return { ok: true, input: { day: dia, time: parsed, title: motivo === "" ? textos.nombres.evento : motivo } }
}
