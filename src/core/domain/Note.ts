import type { Content } from "./Content"
import type { Versioned } from "./Versioned"
import type { NoteId } from "./Ids"

/** Donde viven los apuntes y las listas TODO. */
export interface Note extends Versioned {
  readonly id: NoteId
  readonly name: string
  readonly content: ReadonlyArray<Content>
}
