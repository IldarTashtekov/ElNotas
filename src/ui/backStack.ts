/**
 * Lo que se cierra con el atrás del navegador: la configuración, una nota, el
 * modo selección y las hojas que suben desde abajo.
 *
 * Abrir una capa apunta una entrada en el historial; cerrarla, por el botón que
 * sea, es ir atrás. Así el atrás —también el del móvil— y los botones de salir
 * hacen siempre lo mismo. Las capas se apilan: una hoja puede abrirse encima del
 * modo selección, y el atrás cierra primero la de arriba.
 */

import type { Logger } from "#core/index"

export interface BackStack {
  /** Abre una capa encima de las que haya. */
  readonly open: (alCerrar: () => void) => void
  /**
   * Cierra la de arriba, yendo atrás. Llamarla otra vez antes de que se cierre
   * pide cerrar también la de debajo, pero nunca más capas de las que hay.
   */
  readonly close: () => void
  readonly isOpen: () => boolean
}

interface Capa {
  readonly cerrar: () => void
  /** Si llegó a tener su entrada en el historial: sin ella, se cierra sin ir atrás. */
  readonly conEntrada: boolean
}

export const createBackStack = (logger: Logger): BackStack => {
  let capas: ReadonlyArray<Capa> = []
  /* Cuántas se han pedido cerrar y aún esperan su `popstate`. Entre el `back()`
     y su `popstate` pasa un rato, y un `back()` de más ahí se saldría de la
     página: se van pidiendo de una en una. */
  let porCerrar: number = 0
  /* Las que se abren mientras quedan cierres por llegar esperan a que lleguen: si
     se apuntaran ya, el `popstate` pendiente cerraría la nueva y no la vieja. Pasa
     al elegir en una hoja algo que abre otra capa. */
  let pendientes: ReadonlyArray<() => void> = []

  /* `pushState` LANZA si se llama demasiado deprisa (Safari: unas cien veces cada
     treinta segundos). La capa se abre igual; sólo el atrás no la cerrará. */
  const entrarEnHistorial = (capa: number): boolean => {
    try {
      window.history.pushState({ capa }, "")
      return true
    } catch (fallo: unknown) {
      logger.failure("no se pudo apuntar la capa en el historial", fallo)
      return false
    }
  }

  const apuntar = (cerrar: () => void): void => {
    const conEntrada: boolean = entrarEnHistorial(capas.length + 1)
    capas = [...capas, { cerrar, conEntrada }]
  }

  /* Al recargar, lo que hubiera abierto no se recuerda. */
  try {
    window.history.replaceState(null, "")
  } catch (fallo: unknown) {
    logger.failure("no se pudo limpiar la entrada del historial", fallo)
  }
  window.addEventListener("popstate", (): void => {
    const arriba: Capa | undefined = capas[capas.length - 1]
    if (arriba === undefined) {
      porCerrar = 0
    } else {
      capas = capas.slice(0, -1)
      porCerrar = Math.max(0, porCerrar - 1)
      arriba.cerrar()
    }
    if (porCerrar > 0) {
      window.history.back()
      return
    }
    const esperan: ReadonlyArray<() => void> = pendientes
    pendientes = []
    for (const abrir of esperan) abrir()
  })

  return {
    open: (cerrar: () => void): void => {
      if (porCerrar > 0) pendientes = [...pendientes, (): void => apuntar(cerrar)]
      else apuntar(cerrar)
    },
    close: (): void => {
      /* Sin entrada que deshacer, ir atrás se saldría de la página: se cierra aquí. */
      const arriba: Capa | undefined = capas[capas.length - 1]
      if (porCerrar === 0 && arriba !== undefined && !arriba.conEntrada) {
        capas = capas.slice(0, -1)
        arriba.cerrar()
        return
      }
      if (porCerrar >= capas.length) return
      porCerrar += 1
      if (porCerrar === 1) window.history.back()
    },
    isOpen: (): boolean => capas.length > 0,
  }
}
