/**
 * El contenido de una Nota: bloques de texto y checkboxes anidables.
 */

import type { ContentId } from "./Ids"

/** Bloque de texto suelto. */
export interface Text {
  readonly type: "text"
  readonly id: ContentId
  readonly text: string
}

/**
 * Casilla TODO. Es la entidad recursiva de la app: puede tener casillas hijas.
 *
 * Lleva `id` propio a propósito. La alternativa sería direccionar una casilla
 * anidada por su ruta de índices (`[0, 2, 1]`), pero esa ruta deja de ser válida
 * en cuanto se inserta o se borra un hermano. Con `id` la referencia es estable,
 * y de paso la UI ya tiene su clave de reconciliación.
 */
export interface CheckBox {
  readonly type: "checkbox"
  readonly id: ContentId
  readonly text: string
  readonly checked: boolean
  /** Sólo casillas: un texto no puede colgar de una casilla. */
  readonly children: ReadonlyArray<CheckBox>
}

/**
 * Unión discriminada por `type`.
 *
 * Nótese que NO hay una interfaz base `Content { type: string }` de la que
 * hereden, como en el prototipo: con `type: string` el compilador no puede
 * comprobar exhaustividad en un switch, y es justo lo que quieres que compruebe.
 */
export type Content = Text | CheckBox

export const isCheckBox = (content: Content): content is CheckBox =>
  content.type === "checkbox"

export const isText = (content: Content): content is Text =>
  content.type === "text"

/*
    Constructores. Reciben el id ya hecho: el dominio es puro y no genera IDs
    (eso viene del IdGenerator, que vive fuera del core).
*/
export const text = (id: ContentId, value: string): Text => ({
  type: "text",
  id,
  text: value,
})

export const checkBox = (
  id: ContentId,
  value: string,
  options: { readonly checked?: boolean; readonly children?: ReadonlyArray<CheckBox> } = {},
): CheckBox => ({
  type: "checkbox",
  id,
  text: value,
  checked: options.checked ?? false,
  children: options.children ?? [],
})
