/**
 * El `Store`: la caja que guarda el estado actual, recibe acciones y avisa a
 * quien esté escuchando.
 *
 * ── El único punto de mutabilidad de todo el sistema ───────────────────────
 *
 * Todo lo demás —dominio, operaciones, reducer— es puro: recibe valores y
 * devuelve valores nuevos, sin reasignar nada. Pero una app interactiva es, por
 * definición, algo que tiene un "ahora" distinto de su "antes", y registrar esa
 * diferencia **es** mutar. No se puede eliminar; sólo se puede decidir dónde
 * ponerla y cuánto ocupa.
 *
 * La decisión de este proyecto: **que ocupe este fichero, y ninguno más.**
 * Cuando algo vaya mal con el estado —se pierde un cambio, se avisa de más, se
 * avisa de menos— hay un solo sitio donde mirar.
 *
 * Nótese que los datos **sí** son inmutables. Lo que cambia es la variable que
 * señala cuál es el estado actual; el objeto al que señala no se toca jamás.
 *
 * ── Por qué una función y no una clase ─────────────────────────────────────
 *
 * `estado` vive en una **clausura**: queda encerrada aquí dentro y sólo la
 * alcanzan las tres funciones que se devuelven. Con una clase y `private state`
 * la privacidad la vigila el compilador y **desaparece al ejecutar** —
 * `store.state` existiría como propiedad normal—. Aquí no hay camino hasta la
 * variable. Y de paso encaja con el resto del proyecto, donde no hay ni una
 * clase.
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
  let state = initial

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
    getState: () => state,

    dispatch: (action) => {
      const next = reduce(state, action)
      if (next === state) return // nada cambió → nadie se entera

      state = next // ← LA mutación. Aquí, y en ningún otro sitio del proyecto.
      for (const listener of listeners) listener(next)
    },

    subscribe: (listener) => {
      listeners = [...listeners, listener]
      return () => {
        listeners = listeners.filter((suscrito) => suscrito !== listener)
      }
    },
  }
}
