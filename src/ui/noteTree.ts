/**
 * Cómo se recorre el contenido de una nota: buscar una línea, saber de quién
 * cuelga, cuál va antes y cuál después.
 *
 * Es lo que el editor necesita para decidir adónde va el cursor. Puro: sólo lee.
 */

import type { CheckBox, Content, ContentId } from "#core/index"
import { isCheckBox } from "#core/index"

/** Una línea con dónde está: de quién cuelga y en qué lista. */
export interface Located {
  readonly line: Content
  /** La casilla de la que cuelga, o `null` si está en la raíz. */
  readonly parent: CheckBox | null
  /** La lista en la que está: la raíz de la nota o las hijas de `parent`. */
  readonly siblings: ReadonlyArray<Content>
  readonly index: number
}

export const locate = (content: ReadonlyArray<Content>, id: ContentId): Located | null => {
  const buscar = (
    lista: ReadonlyArray<Content>,
    parent: CheckBox | null,
  ): Located | null => {
    for (const [index, line] of lista.entries()) {
      if (line.id === id) return { line, parent, siblings: lista, index }
      if (isCheckBox(line)) {
        const dentro: Located | null = buscar(line.children, line)
        if (dentro !== null) return dentro
      }
    }
    return null
  }
  return buscar(content, null)
}

/** Todas las líneas en el orden en que se leen: cada casilla y, detrás, sus hijas. */
export const inReadingOrder = (content: ReadonlyArray<Content>): ReadonlyArray<Content> =>
  content.flatMap((line: Content): ReadonlyArray<Content> =>
    isCheckBox(line) ? [line, ...inReadingOrder(line.children)] : [line],
  )

/** La línea de antes o de después, leyendo de arriba abajo. Para las flechas. */
export const lineBeside = (
  content: ReadonlyArray<Content>,
  id: ContentId,
  hacia: "prev" | "next",
): Content | null => {
  const todas: ReadonlyArray<Content> = inReadingOrder(content)
  const i: number = todas.findIndex((l: Content): boolean => l.id === id)
  if (i === -1) return null
  return todas[hacia === "prev" ? i - 1 : i + 1] ?? null
}

/** La de la raíz de la que cuelga, o ella misma si ya está en la raíz. */
export const rootAncestor = (content: ReadonlyArray<Content>, id: ContentId): Content | null =>
  content.find((raiz: Content): boolean =>
    inReadingOrder([raiz]).some((l: Content): boolean => l.id === id),
  ) ?? null

/** La hermana que viene justo detrás, que es donde nace la mitad nueva de un `split`. */
export const nextSibling = (content: ReadonlyArray<Content>, id: ContentId): Content | null => {
  const donde: Located | null = locate(content, id)
  return donde === null ? null : (donde.siblings[donde.index + 1] ?? null)
}

/**
 * Quién se queda con el texto al unir esta línea con la de arriba: la hermana
 * anterior, o la madre si es la primera hija. `null` si es la primera de la nota.
 * Es la regla de `merge`, leída antes de ejecutarlo para saber adónde va el cursor.
 */
export const mergeTarget = (content: ReadonlyArray<Content>, id: ContentId): Content | null => {
  const donde: Located | null = locate(content, id)
  if (donde === null) return null
  return donde.siblings[donde.index - 1] ?? donde.parent
}
