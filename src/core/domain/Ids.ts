/**
 * Identificadores marcados ("branded").
 *
 * Con un estado normalizado todo se referencia por ID, y todos los IDs son
 * string. Sin marcarlos, pasar un DiagramId donde se espera un NoteId compila
 * perfectamente y el fallo aparece en runtime como "esa nota no existe".
 * La marca sólo existe para el compilador: en runtime son strings normales y
 * no hay ningún coste.
 */

declare const brand: unique symbol

type Branded<T, B extends string> = T & { readonly [brand]: B }

export type NoteId = Branded<string, "NoteId">
export type DiagramId = Branded<string, "DiagramId">
export type ContextId = Branded<string, "ContextId">
export type DiagramNodeId = Branded<string, "DiagramNodeId">
export type DiagramRelationId = Branded<string, "DiagramRelationId">
export type EventId = Branded<string, "EventId">
export type EventGroupId = Branded<string, "EventGroupId">
export type RoutineId = Branded<string, "RoutineId">

/** ID de un bloque de contenido de una nota (texto o checkbox). */
export type ContentId = Branded<string, "ContentId">

/** Token opaco que identifica una versión de una entidad; cambia en cada escritura. */
export type Revision = Branded<string, "Revision">

/*
    Constructores. Son los ÚNICOS sitios donde se hace el cast, y existen para
    que el resto del código no tenga que usar "as". Quien los llama es la capa
    que tiene el IdGenerator inyectado (fuera del core), no el dominio.
*/
export const noteId = (raw: string): NoteId => raw as NoteId
export const diagramId = (raw: string): DiagramId => raw as DiagramId
export const contextId = (raw: string): ContextId => raw as ContextId
export const diagramNodeId = (raw: string): DiagramNodeId => raw as DiagramNodeId
export const diagramRelationId = (raw: string): DiagramRelationId =>
  raw as DiagramRelationId
export const eventId = (raw: string): EventId => raw as EventId
export const eventGroupId = (raw: string): EventGroupId => raw as EventGroupId
export const routineId = (raw: string): RoutineId => raw as RoutineId
export const contentId = (raw: string): ContentId => raw as ContentId
export const revision = (raw: string): Revision => raw as Revision

/**
 * Referencia a un elemento de un Contexto.
 *
 * Un Contexto guarda ESTO, no las entidades. Además de permitir que una nota
 * esté en varios contextos, "kind" hace la referencia discriminable en runtime,
 * cosa que Note y Diagram no son entre sí (los dos son { id, name, ... }).
 */
export type ItemRef =
  | { readonly kind: "note"; readonly id: NoteId }
  | { readonly kind: "diagram"; readonly id: DiagramId }

export const noteRef = (id: NoteId): ItemRef => ({ kind: "note", id })
export const diagramRef = (id: DiagramId): ItemRef => ({ kind: "diagram", id })
