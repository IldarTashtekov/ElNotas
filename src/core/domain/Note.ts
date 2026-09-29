import type { Content } from "./Content.js"
import type { Versioned } from "./Versioned.js"
import type { NoteId } from "./Ids.js"

/** Donde viven los apuntes y las listas TODO. */
export interface Note extends Versioned {
  readonly id: NoteId
  readonly name: string
  readonly content: ReadonlyArray<Content>
}
