/**
 * Los casos de uso: **la frontera entre lo impuro y lo puro**.
 *
 * Es la única capa con los puertos inyectados, y su trabajo es construir el
 * `meta` de la acción —la hora y la revisión— antes de despacharla. De esta
 * línea hacia dentro (reducer, operaciones, dominio) todo es puro y se prueba
 * sin simular nada; de esta línea hacia fuera, plataforma.
 *
 * Ojo a algo que despista al leerlo: **la revisión se pide siempre, aunque no se
 * acabe usando.** El caso de uso no sabe todavía si la acción va a cambiar algo
 * —eso lo decide el reducer—, así que la construye igualmente y, si la acción
 * resulta ser inocua, se descarta. Generar una cadena es gratis; darle al
 * reducer capacidad de generar ids costaría su pureza.
 */

import type { ContentId, NoteId } from "../domain/Ids"
import { revision } from "../domain/Ids"
import type { Clock } from "../ports/Clock"
import type { IdGenerator } from "../ports/IdGenerator"
import type { Store } from "./Store"

export interface UseCases {
  readonly setChecked: (
    noteId: NoteId,
    contentId: ContentId,
    checked: boolean,
  ) => void
}

export interface UseCaseDeps {
  readonly clock: Clock
  readonly ids: IdGenerator
  readonly store: Store
}

export const createUseCases = ({ clock, ids, store }: UseCaseDeps): UseCases => ({
  setChecked: (noteId, contentId, checked) =>
    store.dispatch({
      type: "set-checked",
      noteId,
      contentId,
      checked,
      // Aquí, y sólo aquí, se lee el mundo.
      meta: { now: clock.now(), revision: revision(ids.next()) },
    }),
})
