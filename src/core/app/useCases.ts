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
 *
 * Todos devuelven **la entidad que han tocado, o `null` si no aplicó**. Así quien
 * llama distingue «hecho» de «no aplicaba», que de otro modo se ven igual: una
 * operación que no aplica no falla, no hace nada.
 */

import type { Day, Time } from "../domain/calendar.js"
import type { CalendarEvent } from "../domain/CalendarEvent.js"
import { checkBox, text } from "../domain/Content.js"
import type { Context, DefaultView } from "../domain/Context.js"
import type { Diagram } from "../domain/Diagram.js"
import type {
  ContentId,
  ContextId,
  DiagramId,
  DiagramNodeId,
  DiagramRelationId,
  EventId,
  ItemRef,
  NoteId,
  RoutineId,
} from "../domain/Ids.js"
import {
  contentId,
  contextId,
  diagramId,
  diagramNodeId,
  diagramRelationId,
  eventId,
  noteId,
  revision,
  routineId,
} from "../domain/Ids.js"
import type { Note } from "../domain/Note.js"
import type { Position } from "../domain/Position.js"
import type { Routine } from "../domain/Routine.js"
import type { Action, ActionMeta } from "./Action.js"
import type { Clock } from "../ports/Clock.js"
import type { IdGenerator } from "../ports/IdGenerator.js"
import type { Store } from "./Store.js"

export interface UseCases {
  readonly setChecked: (
    noteId: NoteId,
    contentId: ContentId,
    checked: boolean,
  ) => Note | null
  readonly setText: (
    noteId: NoteId,
    contentId: ContentId,
    value: string,
  ) => Note | null
  /**
   * Mete una línea de texto. El id lo genera **aquí**, no la UI: es esta capa la
   * que tiene el `IdGenerator`. Por eso hay dos casos de uso para una sola
   * acción —uno por clase de línea— en vez de uno que reciba el bloque hecho.
   */
  readonly insertText: (noteId: NoteId, value: string, at: Position) => Note | null
  readonly insertCheckBox: (
    noteId: NoteId,
    value: string,
    at: Position,
  ) => Note | null
  /** `null` también cuando la línea tiene hijas: ahí `remove` es no-op. */
  readonly remove: (noteId: NoteId, contentId: ContentId) => Note | null
  /** Parte una línea por `offset`. El id de la mitad nueva se genera aquí. */
  readonly split: (
    noteId: NoteId,
    contentId: ContentId,
    offset: number,
  ) => Note | null
  readonly merge: (noteId: NoteId, contentId: ContentId) => Note | null
  readonly convertToCheckBox: (
    noteId: NoteId,
    contentId: ContentId,
  ) => Note | null
  readonly convertToText: (noteId: NoteId, contentId: ContentId) => Note | null

  /**
   * Crea una nota vacía y la devuelve. El id se genera aquí y sale dentro de
   * ella, que es lo que quien la crea necesita para abrirla a continuación.
   *
   * ⚠️ Puede devolver `null`, y no es defensivo: `create-note` con un id que ya
   * existe es no-op en el reducer.
   */
  readonly createNote: (name: string) => Note | null
  readonly renameNote: (noteId: NoteId, name: string) => Note | null
  /**
   * ⚠️ Devuelve la nota borrada, pero **eso no es un undo**: al borrarla también
   * se limpian las referencias a ella de todos los contextos que la listaban, y
   * eso no vuelve. Reinsertarla la dejaría huérfana.
   */
  readonly deleteNote: (noteId: NoteId) => Note | null

  readonly createContext: (name: string) => Context | null
  readonly renameContext: (contextId: ContextId, name: string) => Context | null
  readonly deleteContext: (contextId: ContextId) => Context | null
  readonly addItem: (contextId: ContextId, item: ItemRef) => Context | null
  readonly removeItem: (contextId: ContextId, item: ItemRef) => Context | null
  /** Varios a la vez, en una sola acción: lo que se ocultó junto se escribe junto. */
  readonly hideItems: (contextId: ContextId, items: ReadonlyArray<ItemRef>) => Context | null
  readonly showItems: (contextId: ContextId, items: ReadonlyArray<ItemRef>) => Context | null
  /** Los pone juntos delante de `before`, o al final con `null`. Una acción para todos. */
  readonly reorderItems: (
    contextId: ContextId,
    items: ReadonlyArray<ItemRef>,
    before: ItemRef | null,
  ) => Context | null
  readonly setDefaultView: (
    contextId: ContextId,
    view: DefaultView,
  ) => Context | null

  /** Crea un diagrama vacío y lo devuelve, con su id dentro, como `createNote`. */
  readonly createDiagram: (name: string) => Diagram | null
  readonly renameDiagram: (diagramId: DiagramId, name: string) => Diagram | null
  /** Como `deleteNote`: devuelve el borrado, y tampoco sirve de undo. */
  readonly deleteDiagram: (diagramId: DiagramId) => Diagram | null
  /**
   * Pone un nodo en el lienzo, sin marcar. El id lo genera aquí, y por eso hay
   * dos, uno por clase de nodo, como `insertText` e `insertCheckBox`.
   */
  readonly addTextNode: (
    diagramId: DiagramId,
    text: string,
    positionX: number,
    positionY: number,
  ) => Diagram | null
  /** `null` también si la nota no existe. */
  readonly addNoteNode: (
    diagramId: DiagramId,
    noteId: NoteId,
    positionX: number,
    positionY: number,
  ) => Diagram | null
  readonly setNodeText: (
    diagramId: DiagramId,
    nodeId: DiagramNodeId,
    text: string,
  ) => Diagram | null
  readonly setNodePosition: (
    diagramId: DiagramId,
    nodeId: DiagramNodeId,
    positionX: number,
    positionY: number,
  ) => Diagram | null
  /** Desplaza lo mismo varios nodos, con una sola acción: el grupo arrastrado. */
  readonly shiftNodes: (
    diagramId: DiagramId,
    nodeIds: ReadonlyArray<DiagramNodeId>,
    dx: number,
    dy: number,
  ) => Diagram | null
  readonly setNodeDone: (
    diagramId: DiagramId,
    nodeId: DiagramNodeId,
    done: boolean,
  ) => Diagram | null
  readonly removeNode: (diagramId: DiagramId, nodeId: DiagramNodeId) => Diagram | null
  /** Une `from` con `to`, con flecha y sin texto. El id se genera aquí. */
  readonly addRelation: (
    diagramId: DiagramId,
    from: DiagramNodeId,
    to: DiagramNodeId,
  ) => Diagram | null
  readonly setRelationEnds: (
    diagramId: DiagramId,
    relationId: DiagramRelationId,
    from: DiagramNodeId,
    to: DiagramNodeId,
  ) => Diagram | null
  readonly setRelationDirected: (
    diagramId: DiagramId,
    relationId: DiagramRelationId,
    directed: boolean,
  ) => Diagram | null
  readonly setRelationLabel: (
    diagramId: DiagramId,
    relationId: DiagramRelationId,
    label: string,
  ) => Diagram | null
  readonly removeRelation: (
    diagramId: DiagramId,
    relationId: DiagramRelationId,
  ) => Diagram | null

  /**
   * Crea un evento y lo devuelve. El id se genera aquí. El motivo puede ir
   * vacío. `null` sólo si el id ya existía.
   */
  readonly createEvent: (day: Day, time: Time | null, title: string) => CalendarEvent | null
  readonly updateEvent: (
    eventId: EventId,
    day: Day,
    time: Time | null,
    title: string,
  ) => CalendarEvent | null
  readonly setEventDone: (eventId: EventId, done: boolean) => CalendarEvent | null
  /** Como `deleteNote`: devuelve el borrado, y tampoco sirve de undo. */
  readonly deleteEvent: (eventId: EventId) => CalendarEvent | null
  /** Crea una rutina. `null` si la meta no es de 1 a 7 (o el id ya existía). */
  readonly createRoutine: (name: string, weeklyGoal: number | null) => Routine | null
  readonly renameRoutine: (routineId: RoutineId, name: string) => Routine | null
  /**
   * Marca o desmarca un día. `today` es el de la plataforma: un día posterior no se
   * marca, y entonces devuelve `null`.
   */
  readonly setRoutineDay: (
    routineId: RoutineId,
    day: Day,
    done: boolean,
    today: Day,
  ) => Routine | null
  readonly setRoutineGoal: (routineId: RoutineId, weeklyGoal: number | null) => Routine | null
  readonly setRoutineArchived: (routineId: RoutineId, archived: boolean) => Routine | null
  /** Con todos sus días. Devuelve la borrada. */
  readonly deleteRoutine: (routineId: RoutineId) => Routine | null
}

export interface UseCaseDeps {
  readonly clock: Clock
  readonly ids: IdGenerator
  readonly store: Store
}

export const createUseCases = ({ clock, ids, store }: UseCaseDeps): UseCases => {
  /* Aquí, y sólo aquí, se lee el mundo. Se construye uno por acción, así que
     todas las entidades que esa acción toque reciben la MISMA marca de tiempo. */
  const meta = (): ActionMeta => ({ now: clock.now(), revision: revision(ids.next()) })

  const trasNota = (id: NoteId, action: Action): Note | null => {
    const antes: Note | undefined = store.getState().notes[id]
    store.dispatch(action)
    return cambio(antes, store.getState().notes[id])
  }

  const trasContexto = (id: ContextId, action: Action): Context | null => {
    const antes: Context | undefined = store.getState().contexts[id]
    store.dispatch(action)
    return cambio(antes, store.getState().contexts[id])
  }

  const trasDiagrama = (id: DiagramId, action: Action): Diagram | null => {
    const antes: Diagram | undefined = store.getState().diagrams[id]
    store.dispatch(action)
    return cambio(antes, store.getState().diagrams[id])
  }

  const trasEvento = (id: EventId, action: Action): CalendarEvent | null => {
    const antes: CalendarEvent | undefined = store.getState().events[id]
    store.dispatch(action)
    return cambio(antes, store.getState().events[id])
  }

  const trasRutina = (id: RoutineId, action: Action): Routine | null => {
    const antes: Routine | undefined = store.getState().routines[id]
    store.dispatch(action)
    return cambio(antes, store.getState().routines[id])
  }

  return {
    setChecked: (
      noteId: NoteId,
      contentId: ContentId,
      checked: boolean,
    ): Note | null =>
      trasNota(noteId, { type: "set-checked", noteId, contentId, checked, meta: meta() }),

    setText: (noteId: NoteId, contentId: ContentId, value: string): Note | null =>
      trasNota(noteId, { type: "set-text", noteId, contentId, value, meta: meta() }),

    insertText: (noteId: NoteId, value: string, at: Position): Note | null =>
      trasNota(noteId, {
        type: "insert",
        noteId,
        block: text(contentId(ids.next()), value),
        position: at,
        meta: meta(),
      }),

    insertCheckBox: (noteId: NoteId, value: string, at: Position): Note | null =>
      trasNota(noteId, {
        type: "insert",
        noteId,
        block: checkBox(contentId(ids.next()), value),
        position: at,
        meta: meta(),
      }),

    remove: (noteId: NoteId, contentId: ContentId): Note | null =>
      trasNota(noteId, { type: "remove", noteId, contentId, meta: meta() }),

    split: (noteId: NoteId, contentId: ContentId, offset: number): Note | null =>
      trasNota(noteId, {
        type: "split",
        noteId,
        contentId,
        offset,
        newId: contentIdNuevo(ids),
        meta: meta(),
      }),

    merge: (noteId: NoteId, contentId: ContentId): Note | null =>
      trasNota(noteId, { type: "merge", noteId, contentId, meta: meta() }),

    convertToCheckBox: (noteId: NoteId, contentId: ContentId): Note | null =>
      trasNota(noteId, {
        type: "convert-to-checkbox",
        noteId,
        contentId,
        meta: meta(),
      }),

    convertToText: (noteId: NoteId, contentId: ContentId): Note | null =>
      trasNota(noteId, { type: "convert-to-text", noteId, contentId, meta: meta() }),

    /* ── Nota ── */

    createNote: (name: string): Note | null => {
      const id: NoteId = noteIdNuevo(ids)
      return trasNota(id, { type: "create-note", noteId: id, name, meta: meta() })
    },

    renameNote: (noteId: NoteId, name: string): Note | null =>
      trasNota(noteId, { type: "rename-note", noteId, name, meta: meta() }),

    deleteNote: (noteId: NoteId): Note | null =>
      trasNota(noteId, { type: "delete-note", noteId, meta: meta() }),

    /* ── Contexto ── */

    createContext: (name: string): Context | null => {
      const id: ContextId = contextIdNuevo(ids)
      return trasContexto(id, {
        type: "create-context",
        contextId: id,
        name,
        meta: meta(),
      })
    },

    renameContext: (contextId: ContextId, name: string): Context | null =>
      trasContexto(contextId, {
        type: "rename-context",
        contextId,
        name,
        meta: meta(),
      }),

    deleteContext: (contextId: ContextId): Context | null =>
      trasContexto(contextId, { type: "delete-context", contextId, meta: meta() }),

    addItem: (contextId: ContextId, item: ItemRef): Context | null =>
      trasContexto(contextId, { type: "add-item", contextId, item, meta: meta() }),

    removeItem: (contextId: ContextId, item: ItemRef): Context | null =>
      trasContexto(contextId, { type: "remove-item", contextId, item, meta: meta() }),

    hideItems: (contextId: ContextId, items: ReadonlyArray<ItemRef>): Context | null =>
      trasContexto(contextId, { type: "hide-items", contextId, items, meta: meta() }),

    showItems: (contextId: ContextId, items: ReadonlyArray<ItemRef>): Context | null =>
      trasContexto(contextId, { type: "show-items", contextId, items, meta: meta() }),

    reorderItems: (
      contextId: ContextId,
      items: ReadonlyArray<ItemRef>,
      before: ItemRef | null,
    ): Context | null =>
      trasContexto(contextId, { type: "reorder-items", contextId, items, before, meta: meta() }),

    setDefaultView: (contextId: ContextId, view: DefaultView): Context | null =>
      trasContexto(contextId, {
        type: "set-default-view",
        contextId,
        view,
        meta: meta(),
      }),

    /* ── Diagrama ── */

    createDiagram: (name: string): Diagram | null => {
      const id: DiagramId = diagramIdNuevo(ids)
      return trasDiagrama(id, { type: "create-diagram", diagramId: id, name, meta: meta() })
    },

    renameDiagram: (diagramId: DiagramId, name: string): Diagram | null =>
      trasDiagrama(diagramId, { type: "rename-diagram", diagramId, name, meta: meta() }),

    deleteDiagram: (diagramId: DiagramId): Diagram | null =>
      trasDiagrama(diagramId, { type: "delete-diagram", diagramId, meta: meta() }),

    addTextNode: (
      diagramId: DiagramId,
      text: string,
      positionX: number,
      positionY: number,
    ): Diagram | null =>
      trasDiagrama(diagramId, {
        type: "add-node",
        diagramId,
        node: {
          type: "simple-node",
          id: diagramNodeIdNuevo(ids),
          text,
          positionX,
          positionY,
          done: false,
        },
        meta: meta(),
      }),

    addNoteNode: (
      diagramId: DiagramId,
      noteId: NoteId,
      positionX: number,
      positionY: number,
    ): Diagram | null =>
      trasDiagrama(diagramId, {
        type: "add-node",
        diagramId,
        node: {
          type: "note-node",
          id: diagramNodeIdNuevo(ids),
          noteId,
          positionX,
          positionY,
          done: false,
        },
        meta: meta(),
      }),

    setNodeText: (diagramId: DiagramId, nodeId: DiagramNodeId, text: string): Diagram | null =>
      trasDiagrama(diagramId, { type: "set-node-text", diagramId, nodeId, text, meta: meta() }),

    setNodePosition: (
      diagramId: DiagramId,
      nodeId: DiagramNodeId,
      positionX: number,
      positionY: number,
    ): Diagram | null =>
      trasDiagrama(diagramId, {
        type: "set-node-position",
        diagramId,
        nodeId,
        positionX,
        positionY,
        meta: meta(),
      }),

    shiftNodes: (
      diagramId: DiagramId,
      nodeIds: ReadonlyArray<DiagramNodeId>,
      dx: number,
      dy: number,
    ): Diagram | null =>
      trasDiagrama(diagramId, { type: "shift-nodes", diagramId, nodeIds, dx, dy, meta: meta() }),

    setNodeDone: (diagramId: DiagramId, nodeId: DiagramNodeId, done: boolean): Diagram | null =>
      trasDiagrama(diagramId, { type: "set-node-done", diagramId, nodeId, done, meta: meta() }),

    removeNode: (diagramId: DiagramId, nodeId: DiagramNodeId): Diagram | null =>
      trasDiagrama(diagramId, { type: "remove-node", diagramId, nodeId, meta: meta() }),

    addRelation: (diagramId: DiagramId, from: DiagramNodeId, to: DiagramNodeId): Diagram | null =>
      trasDiagrama(diagramId, {
        type: "add-relation",
        diagramId,
        relation: { id: diagramRelationIdNuevo(ids), from, to, directed: true, label: "" },
        meta: meta(),
      }),

    setRelationEnds: (
      diagramId: DiagramId,
      relationId: DiagramRelationId,
      from: DiagramNodeId,
      to: DiagramNodeId,
    ): Diagram | null =>
      trasDiagrama(diagramId, {
        type: "set-relation-ends",
        diagramId,
        relationId,
        from,
        to,
        meta: meta(),
      }),

    setRelationDirected: (
      diagramId: DiagramId,
      relationId: DiagramRelationId,
      directed: boolean,
    ): Diagram | null =>
      trasDiagrama(diagramId, {
        type: "set-relation-directed",
        diagramId,
        relationId,
        directed,
        meta: meta(),
      }),

    setRelationLabel: (
      diagramId: DiagramId,
      relationId: DiagramRelationId,
      label: string,
    ): Diagram | null =>
      trasDiagrama(diagramId, {
        type: "set-relation-label",
        diagramId,
        relationId,
        label,
        meta: meta(),
      }),

    removeRelation: (diagramId: DiagramId, relationId: DiagramRelationId): Diagram | null =>
      trasDiagrama(diagramId, { type: "remove-relation", diagramId, relationId, meta: meta() }),

    /* ── Calendario ── */

    createEvent: (day: Day, time: Time | null, title: string): CalendarEvent | null => {
      const id: EventId = eventIdNuevo(ids)
      return trasEvento(id, {
        type: "create-event",
        eventId: id,
        day,
        time,
        title,
        meta: meta(),
      })
    },

    updateEvent: (eventId: EventId, day: Day, time: Time | null, title: string): CalendarEvent | null =>
      trasEvento(eventId, { type: "update-event", eventId, day, time, title, meta: meta() }),

    setEventDone: (eventId: EventId, done: boolean): CalendarEvent | null =>
      trasEvento(eventId, { type: "set-event-done", eventId, done, meta: meta() }),

    deleteEvent: (eventId: EventId): CalendarEvent | null =>
      trasEvento(eventId, { type: "delete-event", eventId, meta: meta() }),

    /* ── Rutinas ── */

    createRoutine: (name: string, weeklyGoal: number | null): Routine | null => {
      const id: RoutineId = routineIdNuevo(ids)
      return trasRutina(id, { type: "create-routine", routineId: id, name, weeklyGoal, meta: meta() })
    },

    renameRoutine: (routineId: RoutineId, name: string): Routine | null =>
      trasRutina(routineId, { type: "rename-routine", routineId, name, meta: meta() }),

    setRoutineDay: (routineId: RoutineId, day: Day, done: boolean, today: Day): Routine | null =>
      trasRutina(routineId, { type: "set-routine-day", routineId, day, done, today, meta: meta() }),

    setRoutineGoal: (routineId: RoutineId, weeklyGoal: number | null): Routine | null =>
      trasRutina(routineId, { type: "set-routine-goal", routineId, weeklyGoal, meta: meta() }),

    setRoutineArchived: (routineId: RoutineId, archived: boolean): Routine | null =>
      trasRutina(routineId, { type: "set-routine-archived", routineId, archived, meta: meta() }),

    deleteRoutine: (routineId: RoutineId): Routine | null =>
      trasRutina(routineId, { type: "delete-routine", routineId, meta: meta() }),
  }
}

/**
 * Qué salió de despachar: la entidad como ha quedado, o `null` si no aplicó.
 *
 * Los cuatro casos salen de una sola expresión, y sale gratis porque la
 * invariante de identidad garantiza que un no-op devuelve **el mismo objeto**:
 *
 *     cambió       antes ≠ después            → la entidad nueva
 *     no aplicó    antes === después          → null
 *     se borró     después es undefined       → la que se leyó antes
 *     no existía   los dos son undefined      → null
 *
 * ⚠️ De lo que depende: si alguna operación devolviera una copia equivalente en
 * vez de su entrada, esto diría «cambió» siempre. Es la misma invariante de la
 * que vive `diffState`, y se rompe igual de callada.
 */
const cambio = <T>(antes: T | undefined, despues: T | undefined): T | null =>
  despues === antes ? null : (despues ?? antes ?? null)

/*
    El generador devuelve una cadena pelada: no sabe ni le importa qué clase de
    id estás creando. Quien lo marca es quien llama, que sí lo sabe. De ahí estos
    envoltorios de una línea en vez de un método por tipo en el puerto.
*/
const contentIdNuevo = (ids: IdGenerator): ContentId => contentId(ids.next())
const noteIdNuevo = (ids: IdGenerator): NoteId => noteId(ids.next())
const contextIdNuevo = (ids: IdGenerator): ContextId => contextId(ids.next())
const diagramIdNuevo = (ids: IdGenerator): DiagramId => diagramId(ids.next())
const eventIdNuevo = (ids: IdGenerator): EventId => eventId(ids.next())
const routineIdNuevo = (ids: IdGenerator): RoutineId => routineId(ids.next())
const diagramNodeIdNuevo = (ids: IdGenerator): DiagramNodeId => diagramNodeId(ids.next())
const diagramRelationIdNuevo = (ids: IdGenerator): DiagramRelationId =>
  diagramRelationId(ids.next())
