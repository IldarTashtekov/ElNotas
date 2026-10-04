/**
 * Borrar todo lo de la app en `localStorage` —notas, diagramas, contextos y
 * ventanas— y dejarla en blanco.
 *
 * Se hace en dos tiempos: el botón sólo apunta que se quiere borrar y recarga, y
 * es al arrancar, antes de leer nada, cuando se borra. Así lo que el guardado
 * escriba al salir de la página también se va. Sólo se tocan las claves de la
 * app, las que empiezan por `elnotas:`.
 */

/** La marca que pide el borrado en el próximo arranque. */
export const RESET_KEY: string = "elnotas:borrar-todo"

const PREFIJO: string = "elnotas:"

/** Pide el borrado para el próximo arranque. `false` si no se pudo apuntar. */
export const requestReset = (almacen: Storage): boolean => {
  try {
    almacen.setItem(RESET_KEY, "1")
    return true
  } catch {
    return false
  }
}

/**
 * Al arrancar: si se pidió el borrado, quita todas las claves de la app y
 * devuelve `true`. La marca se quita la última: si algo falla a medias, el
 * próximo arranque lo vuelve a intentar. Un fallo no tumba el arranque.
 */
export const resetIfRequested = (almacen: Storage): boolean => {
  try {
    if (almacen.getItem(RESET_KEY) === null) return false
    const claves: ReadonlyArray<string> = Array.from(
      { length: almacen.length },
      (_: unknown, i: number): string | null => almacen.key(i),
    ).filter(
      (k: string | null): k is string => k !== null && k.startsWith(PREFIJO) && k !== RESET_KEY,
    )
    for (const clave of claves) almacen.removeItem(clave)
    almacen.removeItem(RESET_KEY)
    return true
  } catch {
    return false
  }
}
