/**
 * Lo que escribe el usuario en la hoja de un evento, convertido en lo que pide el
 * core: el día y la hora como textos del calendario, o por qué no vale.
 *
 * Puro: el DOM sólo le pasa los textos de los campos.
 */

import type { Day, Time } from "#core/index"
import { parseDay, parseTime } from "#core/index"

export interface EventInput {
  readonly day: Day
  /** `null` si se deja vacía: el evento es de todo el día. */
  readonly time: Time | null
  readonly title: string
}

export type EventFormResult =
  | { readonly ok: true; readonly input: EventInput }
  | { readonly ok: false; readonly problem: string }

/** El motivo que se le pone a un evento sin motivo, como «Nueva Nota» a una nota. */
export const NEW_EVENT_TITLE: string = "Evento"

export const parseEventForm = (day: string, time: string, title: string): EventFormResult => {
  const dia: Day | null = parseDay(day.trim())
  if (dia === null) return { ok: false, problem: "Pon un día válido." }
  const hora: string = time.trim()
  const parsed: Time | null = hora === "" ? null : parseTime(hora)
  if (hora !== "" && parsed === null) return { ok: false, problem: "Pon una hora válida, como 18:00." }
  const motivo: string = title.trim()
  return { ok: true, input: { day: dia, time: parsed, title: motivo === "" ? NEW_EVENT_TITLE : motivo } }
}
