/**
 * Puerto del generador de identificadores.
 *
 * Mismo motivo que `Clock`: `crypto.randomUUID()` es una lectura del mundo, no
 * una función, y una operación que dependa de ella deja de ser comprobable. Una
 * prueba se fabrica el suyo en una línea:
 *
 *     let n = 0
 *     const ids: IdGenerator = { next: () => `id-${n++}` }
 *
 * A éste **sí lo protege el compilador**: `crypto` vive en las librerías del
 * navegador, que `src/core/tsconfig.json` no carga (`"types": []` y sin `DOM` en
 * `lib`). Dentro del core, `crypto.randomUUID()` no compila.
 *
 * ── Por qué devuelve un `string` pelado ────────────────────────────────────
 *
 * Los identificadores del proyecto van marcados (`NoteId`, `ContentId`,
 * `Revision`…): por dentro todos son texto, pero el compilador no deja
 * confundirlos. La marca se pone en los constructores de `Ids.ts`.
 *
 * Se descartó darle un método por cada clase de id, porque **el generador no
 * sabe ni le importa qué estás creando**: sólo fabrica cadenas únicas. Quién
 * decide que eso es un `ContentId` es quien llama, que es el que lo sabe. Queda
 * `contentId(ids.next())` en el sitio de la llamada —algo más largo— a cambio de
 * un puerto mínimo que no hay que tocar cada vez que aparezca un tipo de id
 * nuevo.
 *
 * Sin implementación en el repo, a propósito: viviría en `src/platform/`, que no
 * nace hasta la Fase 4.
 */
export interface IdGenerator {
  /** Una cadena única. Quien llama la marca con el constructor que toque. */
  readonly next: () => string
}
