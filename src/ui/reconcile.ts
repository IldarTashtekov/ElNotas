/**
 * Pone una lista del DOM al día con la lista nueva sin recrear lo que no cambió.
 *
 * Cada elemento se reconoce por su clave —el `data-id`—: el que ya estaba se
 * reutiliza y sólo se actualiza, se coloca en su sitio, se crea el que falta y
 * se quita el que sobra. Así seleccionar una nota o renombrar un contexto no
 * rehace las demás filas.
 *
 * No depende del DOM: pide lo mínimo de un contenedor, y se prueba en Node con
 * uno falso.
 */

/** Lo que se usa del contenedor. Un `HTMLElement` lo cumple tal cual. */
export interface KeyedContainer<E> {
  readonly children: ArrayLike<E>
  readonly insertBefore: (nuevo: E, referencia: E | null) => unknown
  readonly removeChild: (hijo: E) => unknown
}

export interface ReconcileSteps<T, E> {
  /** La clave de un dato: la que acaba en el `data-id`. */
  readonly key: (item: T) => string
  /** La clave de un elemento que ya está, o `null` si no tiene. */
  readonly keyOf: (el: E) => string | null
  readonly create: (item: T) => E
  /** Tiene que tocar sólo lo que cambió: se llama también con los que siguen. */
  readonly update: (el: E, item: T) => void
}

export const reconcile = <T, E>(
  contenedor: KeyedContainer<E>,
  items: ReadonlyArray<T>,
  { key, keyOf, create, update }: ReconcileSteps<T, E>,
): void => {
  /* Índice local de lo que ya hay. Lo que quede en él al final, sobra. */
  const existentes: Map<string, E> = new Map<string, E>()
  for (const el of Array.from(contenedor.children)) {
    const clave: string | null = keyOf(el)
    if (clave !== null) existentes.set(clave, el)
  }

  items.forEach((item: T, i: number): void => {
    const clave: string = key(item)
    const el: E = existentes.get(clave) ?? create(item)
    existentes.delete(clave)
    update(el, item)
    /* Sólo se mueve si no está ya en su sitio: mover un nodo es recrearlo a ojos
       del foco y de la selección de texto. */
    if (contenedor.children[i] !== el) contenedor.insertBefore(el, contenedor.children[i] ?? null)
  })

  for (const sobra of existentes.values()) contenedor.removeChild(sobra)
}

/** Para los `update`: escribe el texto sólo si es otro. */
export const setTextIfChanged = (el: Node, texto: string): void => {
  if (el.textContent !== texto) el.textContent = texto
}

/** Para los `update`: escribe un atributo sólo si cambia. */
export const setAttrIfChanged = (el: Element, nombre: string, valor: string): void => {
  if (el.getAttribute(nombre) !== valor) el.setAttribute(nombre, valor)
}
