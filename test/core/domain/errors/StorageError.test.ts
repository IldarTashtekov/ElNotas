/**
 * `StorageError`.
 *
 * Es un tipo sin runtime, así que aquí no hay lógica que probar: lo que hay es un
 * **ancla que los cuenta**, por el mismo motivo que hizo falta una que contara las
 * acciones —"son cinco" estaba escrito en tres documentos y no había nada que lo
 * comprobara—.
 *
 * El ancla salta por los dos lados y las dos veces **en compilación**, no en
 * runtime: si desaparece un caso, la lista de abajo deja de compilar; si aparece
 * uno nuevo, el `switch` exhaustivo se queda sin cubrirlo y el `never` del
 * `default` lo caza. Que salte al añadir es lo que importa, porque añadir un caso
 * sin decidir su respuesta a "¿reintentar sirve de algo?" es justo la forma en que
 * esta taxonomía se convertiría en un cajón de sastre.
 */

import { test } from "node:test"
import assert from "node:assert/strict"

import type { StorageError } from "#core/domain/errors/StorageError"

/** ¿Reintentar sirve de algo? Es el criterio con el que se eligió la taxonomía. */
const merecePenaReintentar = (fallo: StorageError): boolean => {
  switch (fallo.kind) {
    case "permission-denied":
      return false
    case "not-found":
      return false
    case "quota-exceeded":
      return false
    case "corrupt":
      return false
    case "io":
      return true
    default: {
      /* Si alguien añade un caso sin responder a la pregunta, esto no compila. */
      const noCubierto: never = fallo
      return noCubierto
    }
  }
}

const TODOS: ReadonlyArray<StorageError> = [
  { kind: "permission-denied" },
  { kind: "not-found", path: "notes/compra.json" },
  { kind: "quota-exceeded" },
  { kind: "corrupt", path: "notes/compra.json", cause: new Error("JSON roto") },
  { kind: "io", cause: new Error("el disco tosió") },
]

test("StorageError tiene CINCO casos y ninguno más", () => {
  assert.equal(TODOS.length, 5)
  assert.deepEqual(
    TODOS.map((f) => f.kind),
    ["permission-denied", "not-found", "quota-exceeded", "corrupt", "io"],
  )
})

test("sólo `io` se reintenta: los otros cuatro no tienen arreglo por insistir", () => {
  const reintentables: ReadonlyArray<StorageError["kind"]> = TODOS.filter(
    merecePenaReintentar,
  ).map((f) => f.kind)

  assert.deepEqual(reintentables, ["io"])
})

test("`corrupt` NO es `io`: perder una nota no es creer que las has perdido todas", () => {
  /*
      La razón de que sean casos separados, escrita como prueba. Si `corrupt`
      viviera dentro de `io`, la app reintentaría eternamente leer el fichero roto
      y parecería que está todo roto cuando sólo falla una nota. Por eso `corrupt`
      lleva `path`: para poder decir CUÁL se aparta y seguir con el resto.
  */
  const roto: StorageError = { kind: "corrupt", path: "notes/compra.json", cause: null }

  assert.equal(merecePenaReintentar(roto), false)
  assert.equal(roto.path, "notes/compra.json")
})
