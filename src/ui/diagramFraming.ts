/**
 * Los encuadres de los diagramas: dónde se miraba cada uno y con cuánto zoom,
 * para que al volver se vea igual, en su vista o en una ventana.
 *
 * Mientras se mueve el lienzo sólo cambia en memoria; se guarda al salir del
 * diagrama y cuando la app pasa a segundo plano. Es de cada dispositivo: se
 * guarda aparte de las notas y no viaja con ellas.
 */

import type { AppState, DiagramId, Result, StorageError, Store } from "#core/index"
import { diagramId } from "#core/index"
import type { Framing } from "./viewport.js"
import { clampScale } from "./viewport.js"

/** El encuadre de cada diagrama, por su id. */
export type Framings = Readonly<Record<string, Framing>>

export const NO_FRAMINGS: Framings = {}

/** Dónde se guardan. Lo pone `platform/`. Ninguno de los dos lanza. */
export interface FramingPersistence {
  /** Lo guardado tal cual, sin validar, o `null` si nunca se guardó nada. */
  readonly load: () => Result<unknown, StorageError>
  readonly save: (framings: Framings) => Result<void, StorageError>
}

type Registro = Record<string, unknown>

const esRegistro = (x: unknown): x is Registro =>
  typeof x === "object" && x !== null && !Array.isArray(x)

const finito = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x)

/** Un encuadre leído, o `null` si no tiene forma de serlo. La escala, dentro de sus topes. */
const leerEncuadre = (x: unknown): Framing | null => {
  if (!esRegistro(x)) return null
  const { x: cx, y: cy, scale } = x
  if (!finito(cx) || !finito(cy) || !finito(scale)) return null
  return { x: cx, y: cy, scale: clampScale(scale) }
}

/** Lo guardado → los encuadres. Lo que no tenga forma se descarta, sin fallar. */
export const parseFramings = (guardado: unknown): Framings => {
  if (!esRegistro(guardado)) return NO_FRAMINGS
  return Object.fromEntries(
    Object.entries(guardado).flatMap(([id, valor]: [string, unknown]): ReadonlyArray<[string, Framing]> => {
      const encuadre: Framing | null = leerEncuadre(valor)
      return encuadre === null ? [] : [[id, encuadre]]
    }),
  )
}

/** Sin los de diagramas que ya no están. Los MISMOS encuadres si no sobra ninguno. */
export const guardFramings = (framings: Framings, state: AppState): Framings => {
  const ids: ReadonlyArray<string> = Object.keys(framings)
  const vivos: ReadonlyArray<string> = ids.filter(
    (id: string): boolean => state.diagrams[diagramId(id)] !== undefined,
  )
  if (vivos.length === ids.length) return framings
  return Object.fromEntries(
    vivos.flatMap((id: string): ReadonlyArray<[string, Framing]> => {
      const encuadre: Framing | undefined = framings[id]
      return encuadre === undefined ? [] : [[id, encuadre]]
    }),
  )
}

export interface DiagramFraming {
  /** El encuadre recordado de ese diagrama, o `null` si no hay. */
  readonly get: (id: DiagramId) => Framing | null
  /** Lo apunta en memoria. No escribe nada. */
  readonly remember: (id: DiagramId, framing: Framing) => void
  /** Escribe lo apuntado, si hay algo nuevo desde la última vez. */
  readonly save: () => void
}

export interface DiagramFramingDeps {
  readonly store: Store
  readonly persistence: FramingPersistence
}

export const createDiagramFraming = ({ store, persistence }: DiagramFramingDeps): DiagramFraming => {
  const leido: Result<unknown, StorageError> = persistence.load()
  /* Si no se puede leer, todos se abren centrados: sólo se pierde dónde se miraba. */
  let encuadres: Framings = guardFramings(
    leido.ok ? parseFramings(leido.value) : NO_FRAMINGS,
    store.getState(),
  )
  let sucio: boolean = false

  return {
    get: (id: DiagramId): Framing | null => encuadres[id] ?? null,
    remember: (id: DiagramId, framing: Framing): void => {
      encuadres = { ...encuadres, [id]: framing }
      sucio = true
    },
    save: (): void => {
      if (!sucio) return
      encuadres = guardFramings(encuadres, store.getState())
      sucio = false
      /* Un fallo al guardar se descarta a sabiendas, como el de las ventanas: el
         encuadre sigue en memoria y sólo se pierde al recargar. */
      void persistence.save(encuadres)
    },
  }
}
