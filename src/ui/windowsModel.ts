/**
 * La lista de ventanas viva: la carga al arrancar, le pasa la guarda cada vez que
 * cambia el estado, la guarda cuando cambia y avisa a quien la pinte.
 *
 * Así una ventana de un contexto borrado desaparece en la misma sesión, y al
 * recargar se vuelve a la ventana en la que se estaba.
 */

import type { AppState, Logger, Result, StorageError, Store, Unsubscribe } from "#core/index"
import type { WindowRef, WindowsLayout } from "./windows.js"
import {
  DEFAULT_LAYOUT,
  addWindow,
  closeWindowAt,
  guardWindows,
  parseWindowsLayout,
  moveWindow,
  sameWindow,
  windowExists,
} from "./windows.js"

/** Dónde se guarda la lista. Lo pone `platform/`. Ninguno de los dos lanza. */
export interface WindowsPersistence {
  /** Lo guardado tal cual, sin validar, o `null` si nunca se guardó nada. */
  readonly load: () => Result<unknown, StorageError>
  readonly save: (layout: WindowsLayout) => Result<void, StorageError>
}

export type WindowsListener = (layout: WindowsLayout) => void

export interface WindowsModel {
  readonly getLayout: () => WindowsLayout
  /** No hace nada si esa ventana no está entre las visibles o ya era la activa. */
  readonly setActive: (ref: WindowRef) => void
  /** Añade una ventana y la deja activa; si ya estaba, sólo pasa a ella. Las
      ediciones pasan por la guarda antes de quedarse. */
  readonly add: (ref: WindowRef) => void
  /** Cierra la ventana `i`; si era la activa, pasa a la de al lado. */
  readonly close: (i: number) => void
  /** Lleva la ventana `de` al puesto `a`: es lo que hace arrastrar una pestaña. */
  readonly move: (de: number, a: number) => void
  readonly subscribe: (listener: WindowsListener) => Unsubscribe
}

export interface WindowsModelDeps {
  readonly store: Store
  readonly persistence: WindowsPersistence
  readonly logger: Logger
}

export const createWindowsModel = ({ store, persistence, logger }: WindowsModelDeps): WindowsModel => {
  const leido: Result<unknown, StorageError> = persistence.load()
  /* Si no se puede leer se empieza como la primera vez: sin la lista se pierde
     el orden de las ventanas, no ninguna nota. */
  const inicial: WindowsLayout = leido.ok && leido.value !== null ? parseWindowsLayout(leido.value) : DEFAULT_LAYOUT

  let layout: WindowsLayout = guardWindows(inicial, store.getState())
  let listeners: ReadonlyArray<WindowsListener> = []

  /* Un fallo al guardar no se avisa: lo único que se pierde es el orden de las
     ventanas. Avisar de fallos de guardado llega con `onError`. Queda en la
     consola. */
  const guardar = (): void => {
    const guardado: Result<void, StorageError> = persistence.save(layout)
    if (!guardado.ok) logger.failure("no se guardaron las ventanas", guardado.error)
  }

  const cambiar = (siguiente: WindowsLayout): void => {
    if (siguiente === layout) return
    layout = siguiente
    guardar()
    for (const listener of listeners) listener(layout)
  }

  /* Lo leído venía con referencias rotas, o desordenado: se arregla también en el almacén. */
  if (layout !== inicial && leido.ok && leido.value !== null) guardar()

  store.subscribe((state: AppState): void => cambiar(guardWindows(layout, state)))

  const editar = (siguiente: WindowsLayout): void => cambiar(guardWindows(siguiente, store.getState()))

  return {
    getLayout: (): WindowsLayout => layout,

    setActive: (ref: WindowRef): void => {
      const visible: WindowRef | undefined = layout.windows.find((w: WindowRef): boolean => sameWindow(w, ref))
      if (visible === undefined) return
      if (layout.active !== null && sameWindow(layout.active, visible)) return
      cambiar({ ...layout, active: visible })
    },

    /* Una ventana a algo que no existe no se llega a meter: la guarda la
       quitaría, pero devolviendo una lista nueva, y se guardaría sin cambios. */
    add: (ref: WindowRef): void => {
      if (windowExists(ref, store.getState())) editar(addWindow(layout, ref))
    },
    close: (i: number): void => editar(closeWindowAt(layout, i)),
    move: (de: number, a: number): void => editar(moveWindow(layout, de, a)),

    subscribe: (listener: WindowsListener): Unsubscribe => {
      listeners = [...listeners, listener]
      return (): void => {
        listeners = listeners.filter((l: WindowsListener): boolean => l !== listener)
      }
    },
  }
}
