/**
 * Lo que se hace con los enlaces de una línea de nota: saber a qué lleva uno
 * interno, cuál hay bajo el cursor, cómo se quita su marca dejando el texto,
 * qué se puede enlazar, cómo se escribe un enlace, qué texto lleva por defecto y
 * cómo se cambia.
 * Puro: ni DOM ni core más allá de leer el estado.
 */

import type {
  AppState,
  CalendarEvent,
  Day,
  Diagram,
  DiagramId,
  EventId,
  Note,
  NoteId,
  Routine,
  RoutineId,
} from "#core/index"
import { diagramId, eventId, noteId, routineId } from "#core/index"
import type { FormattedLine, LineLink, LineSpan } from "./markdownLine.js"

/** Lo que hay detrás de un enlace interno, o `null` si está roto. */
export type ResolvedLink =
  | { readonly kind: "note"; readonly id: NoteId }
  | { readonly kind: "diagram"; readonly id: DiagramId }
  | { readonly kind: "event"; readonly id: EventId }
  | { readonly kind: "routine"; readonly id: RoutineId }
  | null

/** Los tipos de cosa a los que se puede enlazar. */
export type LinkKind = NonNullable<ResolvedLink>["kind"]

// `id` sale del texto de una nota: "constructor" o "__proto__" no son claves del almacén.
const tiene = (registro: object, id: string): boolean =>
  Object.prototype.hasOwnProperty.call(registro, id)

/**
 * A qué lleva el `#id` de un enlace: una nota, un diagrama, un evento o una
 * rutina. Un contexto, que por ahora no se puede enlazar, o lo que ya no
 * existe, es un enlace roto.
 */
export const resolveLink = (state: AppState, id: string): ResolvedLink => {
  if (tiene(state.notes, id)) return { kind: "note", id: noteId(id) }
  if (tiene(state.diagrams, id)) return { kind: "diagram", id: diagramId(id) }
  if (tiene(state.events, id)) return { kind: "event", id: eventId(id) }
  if (tiene(state.routines, id)) return { kind: "routine", id: routineId(id) }
  return null
}

/**
 * La rutina que una línea de casilla hace de atajo, y si hoy está marcada, o
 * `null` si la línea no lo es. Lo es sólo si TODO su texto es un enlace guardado
 * a una rutina que existe; con cualquier otra cosa al lado, es una casilla normal.
 * «Marcada» sale de los días de la rutina, no de la casilla: mañana se ve sin marcar.
 */
export const routineShortcut = (
  state: AppState,
  line: FormattedLine,
  raw: string,
  today: Day | null,
): { readonly id: RoutineId; readonly marked: boolean } | null => {
  const unico: LineLink | undefined = line.links[0]
  if (line.links.length !== 1 || unico === undefined) return null
  if (!unico.saved || unico.target.kind !== "internal") return null
  const ini: number = raw.length - raw.trimStart().length
  const fin: number = raw.trimEnd().length
  if (unico.start !== ini || unico.end !== fin) return null
  const destino: ResolvedLink = resolveLink(state, unico.target.id)
  if (destino === null || destino.kind !== "routine") return null
  const rutina: Routine | undefined = state.routines[destino.id]
  if (rutina === undefined) return null
  return { id: destino.id, marked: today !== null && rutina.days.includes(today) }
}

/** El enlace con el cursor ESTRICTAMENTE dentro (en la cadena cruda), o `null`. */
export const linkAtCursor = (line: FormattedLine, offset: number): LineLink | null =>
  line.links.find((l: LineLink): boolean => l.start < offset && offset < l.end) ?? null

/**
 * Quita la marca de un enlace guardado y deja su texto: `[texto](destino)` pasa
 * a `texto`, tal como se escribió (con sus escapes y sus marcas de dentro), y el
 * cursor queda al final de ese texto. Un enlace no guardado, o que no está en la
 * línea, no cambia nada.
 */
export const removeLink = (
  raw: string,
  line: FormattedLine,
  link: LineLink,
  cursor: number,
): { readonly text: string; readonly cursor: number } => {
  if (!link.saved) return { text: raw, cursor }
  /* La última marca del enlace es la que cierra `](destino)`: donde acaba su texto. */
  const cierre: LineSpan | undefined = line.spans.find(
    (s: LineSpan): boolean => s.kind === "mark" && s.start > link.start && s.end === link.end,
  )
  if (cierre === undefined) return { text: raw, cursor }
  const dentro: string = raw.slice(link.start + 1, cierre.start)
  return {
    text: raw.slice(0, link.start) + dentro + raw.slice(link.end),
    cursor: link.start + dentro.length,
  }
}

/** Si es una dirección web que se puede enlazar: `http://`, `https://` o `www.` y algo detrás, sin espacios. */
export const isWebAddress = (texto: string): boolean =>
  /^(https?:\/\/|www\.)\S+$/i.test(texto.trim())

/** Algo que se puede enlazar: su nombre (el texto por defecto del enlace) y, si lo hay, un detalle que se ve al lado. */
export interface LinkChoice<Id extends string> {
  readonly id: Id
  readonly name: string
  readonly detail?: string
}

/** Lo que se puede enlazar, por grupos. */
export interface LinkChoices {
  readonly notes: ReadonlyArray<LinkChoice<NoteId>>
  readonly diagrams: ReadonlyArray<LinkChoice<DiagramId>>
  readonly events: ReadonlyArray<LinkChoice<EventId>>
  readonly routines: ReadonlyArray<LinkChoice<RoutineId>>
}

const porNombre = (a: { readonly name: string }, b: { readonly name: string }): number =>
  a.name.localeCompare(b.name, "es", { sensitivity: "base" })

/** Los eventos de hoy en adelante, del más próximo al más lejano, y luego los pasados, del más reciente atrás. */
const eventosParaEnlazar = (
  eventos: ReadonlyArray<CalendarEvent>,
  hoy: Day | null,
): ReadonlyArray<CalendarEvent> => {
  const orden = (a: CalendarEvent, b: CalendarEvent): number =>
    a.day === b.day ? (a.time ?? "").localeCompare(b.time ?? "") : a.day.localeCompare(b.day)
  const todos: ReadonlyArray<CalendarEvent> = [...eventos].sort(orden)
  if (hoy === null) return todos
  const futuros: ReadonlyArray<CalendarEvent> = todos.filter((e: CalendarEvent): boolean => e.day >= hoy)
  const pasados: ReadonlyArray<CalendarEvent> = todos.filter((e: CalendarEvent): boolean => e.day < hoy).reverse()
  return [...futuros, ...pasados]
}

/**
 * A qué se puede enlazar desde la nota `excluding`: las demás notas, los
 * diagramas, los eventos (con su día y su hora al lado) y las rutinas no
 * archivadas. Los contextos, por ahora, no.
 */
export const linkChoices = (state: AppState, excluding: NoteId, today: Day | null): LinkChoices => ({
  notes: Object.values(state.notes)
    .filter((n: Note): boolean => n.id !== excluding)
    .map((n: Note): LinkChoice<NoteId> => ({ id: n.id, name: n.name }))
    .sort(porNombre),
  diagrams: Object.values(state.diagrams)
    .map((d: Diagram): LinkChoice<DiagramId> => ({ id: d.id, name: d.name }))
    .sort(porNombre),
  events: eventosParaEnlazar(Object.values<CalendarEvent>(state.events), today).map(
    (e: CalendarEvent): LinkChoice<EventId> => ({
      id: e.id,
      name: e.title,
      detail: e.time === undefined ? e.day : `${e.day} ${e.time}`,
    }),
  ),
  routines: Object.values<Routine>(state.routines)
    .filter((r: Routine): boolean => r.archived !== true)
    .map((r: Routine): LinkChoice<RoutineId> => ({ id: r.id, name: r.name }))
    .sort(porNombre),
})

/**
 * `[texto](destino)`, con el texto escapado (`\`, `[`, `]` y `*` llevan una barra
 * delante) y «enlace» si el texto está en blanco. El destino se escribe tal cual:
 * quien llama lo da bien (un id, o una dirección que pasó `isWebAddress`). Un `)`
 * en el destino lo cerraría antes de tiempo: no se enlaza y vuelve `null`.
 */
export const buildLink = (texto: string, destino: string): string | null => {
  if (destino.includes(")")) return null
  const visible: string = texto.trim() === "" ? "enlace" : texto
  return `[${visible.replace(/[\\[\]*]/g, "\\$&")}](${destino})`
}

/**
 * El texto que lleva un enlace nuevo si nadie escribe otro. Una web, su host sin
 * `www.` ni puerto ni ruta; un enlace interno, el nombre de lo enlazado. Lo que no
 * se puede sacar, «enlace».
 */
export const defaultLinkText = (destino: string, nombre?: string): string => {
  const limpio: string = destino.trim()
  if (/^(https?:\/\/|www\.)/i.test(limpio)) {
    const host: string =
      /^(?:https?:\/\/)?(?:[^\s/?#@]*@)?([^\s/?#:]*)/i.exec(limpio)?.[1]?.replace(/^www\./i, "") ?? ""
    return host === "" ? "enlace" : host
  }
  return nombre !== undefined && nombre.trim() !== "" ? nombre : "enlace"
}

/**
 * Reescribe un enlace guardado con otro texto y otro destino (`buildLink`) y deja
 * el cursor justo tras él. Un enlace no guardado, que no está en la línea, o que
 * no se puede construir (un `)` en el destino), no cambia nada.
 */
export const changeLink = (
  raw: string,
  line: FormattedLine,
  link: LineLink,
  texto: string,
  destino: string,
): { readonly text: string; readonly cursor: number } => {
  const sinCambios: { readonly text: string; readonly cursor: number } = { text: raw, cursor: link.end }
  const enLinea: boolean = line.links.some(
    (l: LineLink): boolean => l.saved && l.start === link.start && l.end === link.end,
  )
  if (!link.saved || !enLinea) return sinCambios
  const nuevo: string | null = buildLink(texto, destino)
  if (nuevo === null) return sinCambios
  return {
    text: raw.slice(0, link.start) + nuevo + raw.slice(link.end),
    cursor: link.start + nuevo.length,
  }
}
