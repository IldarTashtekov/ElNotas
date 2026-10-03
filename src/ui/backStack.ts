/**
 * Lo que se cierra con el atrás del navegador: la configuración, una nota, el
 * modo selección y las hojas que suben desde abajo.
 *
 * Abrir una capa apunta una entrada en el historial; cerrarla, por el botón que
 * sea, es ir atrás. Así el atrás —también el del móvil— y los botones de salir
 * hacen siempre lo mismo. Las capas se apilan: una hoja puede abrirse encima del
 * modo selección, y el atrás cierra primero la de arriba.
 */

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

export const createBackStack = (): BackStack => {
  let capas: ReadonlyArray<() => void> = []
  /* Cuántas se han pedido cerrar y aún esperan su `popstate`. Entre el `back()`
     y su `popstate` pasa un rato, y un `back()` de más ahí se saldría de la
     página: se van pidiendo de una en una. */
  let porCerrar: number = 0

  /* Al recargar, lo que hubiera abierto no se recuerda. */
  window.history.replaceState(null, "")
  window.addEventListener("popstate", (): void => {
    const cerrar: (() => void) | undefined = capas[capas.length - 1]
    if (cerrar === undefined) {
      porCerrar = 0
      return
    }
    capas = capas.slice(0, -1)
    porCerrar = Math.max(0, porCerrar - 1)
    cerrar()
    if (porCerrar > 0) window.history.back()
  })

  return {
    open: (cerrar: () => void): void => {
      capas = [...capas, cerrar]
      window.history.pushState({ capa: capas.length }, "")
    },
    close: (): void => {
      if (porCerrar >= capas.length) return
      porCerrar += 1
      if (porCerrar === 1) window.history.back()
    },
    isOpen: (): boolean => capas.length > 0,
  }
}
