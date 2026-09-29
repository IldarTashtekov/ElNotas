/**
 * Lo que se cierra con el atrás del navegador: la configuración y el modo
 * selección.
 *
 * Abrir una capa apunta una entrada en el historial; cerrarla, por el botón que
 * sea, es ir atrás. Así el atrás —también el del móvil— y los botones de salir
 * hacen siempre lo mismo. Hay una capa como mucho: la app no tiene más niveles.
 */

export interface BackStack {
  /** Abre una capa. No hace nada si ya hay una abierta. */
  readonly open: (alCerrar: () => void) => void
  /** Cierra la que haya, yendo atrás. Llamarla dos veces seguidas cierra una. */
  readonly close: () => void
  readonly isOpen: () => boolean
}

export const createBackStack = (): BackStack => {
  let alCerrar: (() => void) | null = null
  /* Entre el `back()` y su `popstate` pasa un rato: un segundo `back()` ahí
     no cerraría nada, se saldría de la página. */
  let cerrando: boolean = false

  /* Al recargar, lo que hubiera abierto no se recuerda. */
  window.history.replaceState(null, "")
  window.addEventListener("popstate", (): void => {
    const cerrar: (() => void) | null = alCerrar
    alCerrar = null
    cerrando = false
    if (cerrar !== null) cerrar()
  })

  return {
    open: (cerrar: () => void): void => {
      if (alCerrar !== null) return
      alCerrar = cerrar
      window.history.pushState({ capa: true }, "")
    },
    close: (): void => {
      if (alCerrar === null || cerrando) return
      cerrando = true
      window.history.back()
    },
    isOpen: (): boolean => alCerrar !== null,
  }
}
