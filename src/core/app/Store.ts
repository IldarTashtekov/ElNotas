/**
 * La caja que guarda el estado actual, recibe acciones y avisa a quien escuche.
 *
 * Es **el único sitio mutable de todo el sistema**, y a propósito: una app
 * interactiva tiene un «ahora» distinto de su «antes», y registrar esa diferencia
 * es mutar. No se puede eliminar, sólo decidir dónde vive. Vive aquí y en ningún
 * otro fichero, así que cuando algo vaya mal con el estado hay un solo sitio donde
 * mirar.
 *
 * Los datos sí son inmutables: lo que cambia es la variable que señala cuál es el
 * estado actual, nunca el objeto al que señala.
 */

import type { AppState } from "../domain/AppState"
import type { Action } from "./Action"
import { reduce } from "./reduce"

export type Listener = (state: AppState) => void

/** Deshace la suscripción. Llamarla dos veces no hace nada la segunda. */
export type Unsubscribe = () => void

export interface Store {
  readonly getState: () => AppState
  readonly dispatch: (action: Action) => void
  readonly subscribe: (listener: Listener) => Unsubscribe
}

export const createStore = (initial: AppState): Store => {
  let state: AppState = initial

  /*
      La lista se REEMPLAZA, nunca se muta en el sitio (nada de `push` ni
      `splice`), y eso resuelve gratis un bug clásico: un suscriptor que se da de
      baja durante su propio aviso.

      El `for...of` de abajo se queda iterando el array que había al empezar. Si
      alguien se da de baja a mitad, `listeners` pasa a apuntar a un array NUEVO
      y el recorrido en curso ni se entera. Con `push`/`splice` el recorrido se
      corrompería, y es la clase de fallo que sólo aparece en producción y de
      forma intermitente.
  */
  let listeners: ReadonlyArray<Listener> = []

  return {
    getState: (): AppState => state,

    dispatch: (action: Action): void => {
      const next: AppState = reduce(state, action)
      if (next === state) return // nada cambió → nadie se entera

      state = next // ← LA mutación. Aquí, y en ningún otro sitio del proyecto.
      for (const listener of listeners) listener(next)
    },

    subscribe: (listener: Listener): Unsubscribe => {
      listeners = [...listeners, listener]
      return (): void => {
        listeners = listeners.filter(
          (suscrito: Listener): boolean => suscrito !== listener,
        )
      }
    },
  }
}
