/**
 * El reducer: `(estado, acción) => estado`.
 *
 * Recibe la foto actual de la app y una acción, y devuelve la foto siguiente.
 * **No modifica la que recibe.** Tiene la forma exacta del callback de
 * `Array.reduce`, y la analogía no es decorativa: la app entera es un `reduce`
 * sobre la secuencia de acciones que ha hecho el usuario.
 *
 * Dos exigencias, y las dos se comprueban:
 *
 * - **Puro** — no lee el reloj, no genera ids, no toca disco ni DOM. Sólo mira
 *   sus dos argumentos. La hora y la revisión le llegan puestas en `meta`. Por
 *   eso sus pruebas son deterministas sin simular nada.
 * - **Total** — **no lanza excepciones nunca**. Una acción que no se puede
 *   aplicar (marcar una casilla que no existe) devuelve el estado que recibió.
 *   Un reducer que peta se lleva la app entera por delante, y "el usuario pulsó
 *   algo raro" no es motivo para eso.
 *
 * ⚠️ **La línea que sostiene toda la cadena** es la comparación
 * `content === note.content`. Si el contenido no cambió, se devuelve el estado
 * **tal cual** y no se estampan ni `updatedAt` ni `revision`. Sin ella, marcar
 * una casilla que ya estaba marcada ensucia la nota, hace que el `Store` avise,
 * que el render redibuje y que la persistencia escriba (§3). Y no falla nada
 * visible: la app funciona, sólo va más lenta por un motivo invisible.
 */

import type { AppState } from "../domain/AppState"
import type { Note } from "../domain/Note"
import { setChecked } from "../domain/operations"
import type { Action } from "./Action"

export const reduce = (state: AppState, action: Action): AppState => {
  switch (action.type) {
    case "set-checked": {
      const note = state.notes[action.noteId]
      if (note === undefined) return state // total: la nota no existe, no pasa nada

      const content = setChecked(note.content, action.contentId, action.checked)
      if (content === note.content) return state // ← la línea que lo sostiene todo

      const updated: Note = {
        ...note,
        content,
        updatedAt: action.meta.now,
        revision: action.meta.revision,
      }
      return { ...state, notes: { ...state.notes, [action.noteId]: updated } }
    }
  }
}

/*
    ⚠️ La ausencia de `default` NO es un olvido: es la comprobación de
    exhaustividad.

    TypeScript ve que `action.type` sólo puede valer `"set-checked"` y que ese
    caso siempre devuelve, así que da el `switch` por completo y no exige un
    `return` final. En cuanto la Fase 2 añada una acción más, el `switch` deja de
    cubrirlas todas y esto **deja de compilar** con «Function lacks ending return
    statement» hasta que se trate la nueva.

    El truco habitual —un `default` con `const nunca: never = action`— aquí no
    sirve: `Action` tiene un solo miembro, así que no es una unión y no hay nada
    que agotar. Sí funciona en `insert`, donde `Position` sí es una unión de tres.
*/
