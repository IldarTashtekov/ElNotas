/**
 * `LocalStorageBlobStore`, entero y en Node.
 *
 * A diferencia de `MemoryStorageAdapter` —que no tiene ni una prueba propia
 * porque no tiene lógica propia— aquí sí hay tres cosas que probar, y son las
 * tres que este fichero inventa por encima del puerto:
 *
 *     el espacio de nombres   que no pise ni lea claves ajenas
 *     el base64               que los bytes vuelvan EXACTOS, sean los que sean
 *     la traducción de errores  que la cuota salga como `quota-exceeded`
 *
 * La tercera es la que de verdad importa, y por eso se prueba **caso por caso y
 * no con un representante**: es el mismo motivo por el que los cuatro `kind` no
 * reintentables del write-behind se prueban uno a uno. Con un solo ejemplo,
 * mover una excepción de lado no tumbaría nada.
 *
 * Que este `BlobStore` además **sirve de verdad para montar el adaptador de
 * ficheros encima** lo prueba `LocalStorageBlobStore.contract.test.ts`, que es
 * otra cosa y está aparte.
 */

import { test } from "node:test"
import assert from "node:assert/strict"

import type { BlobStore, Result, StorageError } from "#core/index"
import { ok } from "#core/index"

import type { FakeStorage } from "./FakeStorage"
import { createFakeStorage, excepcionDeCuota } from "./FakeStorage"
import { createLocalStorageBlobStore } from "#storage/blobs/LocalStorageBlobStore"

/* ───────────────────────────────── Utillaje ──────────────────────────────── */

/** El valor de un `Result` que **tenía** que haber ido bien. */
const valorDe = <T>(r: Result<T, StorageError>): T => {
  if (!r.ok) throw new Error(`se esperaba ok y vino err: ${r.error.kind}`)
  return r.value
}

/** Y el error del que tenía que haber ido mal. */
const errorDe = <T>(r: Result<T, StorageError>): StorageError => {
  if (r.ok) throw new Error(`se esperaba err y vino ok: ${JSON.stringify(r.value)}`)
  return r.error
}

/** El par almacén + `BlobStore` montado encima, que es lo que usa cada prueba. */
const montar = (): { readonly falso: FakeStorage; readonly blobs: BlobStore } => {
  const falso: FakeStorage = createFakeStorage()
  return { falso, blobs: createLocalStorageBlobStore(falso) }
}

const bytes = (...valores: ReadonlyArray<number>): Uint8Array => Uint8Array.from(valores)

/* ══════════════════════════ Los bytes van y vuelven ════════════════════════ */

test("lo escrito se relee byte a byte", async () => {
  const { blobs } = montar()
  const datos: Uint8Array = bytes(1, 2, 3, 250)

  assert.deepEqual(await blobs.write("notes/a.json", datos), ok(undefined))
  assert.deepEqual(valorDe(await blobs.read("notes/a.json")), datos)
})

test("sobreviven los bytes que NO son texto: el 0, el 255 y un UTF-8 inválido", async () => {
  const { blobs } = montar()
  /* `0xff 0xfe` no es una secuencia UTF-8 válida, y el 0 es el byte que trunca
     cualquier cosa que se trate como cadena de C. Si el sobre fuera texto en
     vez de base64, esto es lo primero que se rompería —y en silencio, que es
     lo peor: saldría un `U+FFFD` donde había un byte. */
  const datos: Uint8Array = bytes(0, 0xff, 0xfe, 0x80, 0x00, 127, 128)

  await blobs.write("raro", datos)
  assert.deepEqual(valorDe(await blobs.read("raro")), datos)
})

test("sobrevive un blob más grande que el trozo del codificador", async () => {
  const { blobs } = montar()
  /* 200 000 bytes, y el número está elegido: es el tamaño a partir del cual
     `String.fromCharCode(...bytes)` **revienta la pila de verdad** en el Node
     con el que corren estas pruebas (a 100 000 todavía aguanta). Así, quitar el
     troceado del codificador tumba esta prueba en vez de pasar en verde hasta
     que alguien pegue una imagen en una nota.

     Y como 200 000 no es múltiplo de 32 768, cualquier desalineación del bucle
     —un trozo que se pise o se salte— sale también por aquí. */
  const datos: Uint8Array = Uint8Array.from({ length: 200_000 }, (_, i) => i % 256)

  await blobs.write("grande", datos)
  const vuelta: Uint8Array = valorDe(await blobs.read("grande")) ?? bytes()

  assert.equal(vuelta.length, datos.length)
  assert.deepEqual(vuelta, datos)
})

test("write reemplaza lo que hubiera", async () => {
  const { blobs } = montar()

  await blobs.write("x", bytes(1))
  await blobs.write("x", bytes(2, 2))

  assert.deepEqual(valorDe(await blobs.read("x")), bytes(2, 2))
})

/* ═════════════════════════ Ausencia no es fallo ════════════════════════════ */

test("read de un camino que no existe devuelve ok(null)", async () => {
  const { blobs } = montar()
  /* El sobre entero, no sólo el `null` de dentro: un `err(not-found)` aquí
     estaría colapsando "no está" con "no he podido mirar". */
  assert.deepEqual(await blobs.read("no/existe.json"), ok(null))
})

test("delete de lo que no está no es un error", async () => {
  const { blobs } = montar()
  assert.deepEqual(await blobs.delete("no/existe.json"), ok(undefined))
})

test("delete borra de verdad", async () => {
  const { blobs } = montar()

  await blobs.write("x", bytes(1))
  await blobs.delete("x")

  assert.deepEqual(await blobs.read("x"), ok(null))
})

/* ═══════════════════ El espacio de nombres: no pisar a nadie ═══════════════ */

test("las claves de verdad llevan el espacio de nombres delante", async () => {
  const { falso, blobs } = montar()

  await blobs.write("notes/a.json", bytes(1))

  assert.deepEqual(falso.claves(), ["elnotas:blob:notes/a.json"])
})

test("no se lee una clave ajena que se llame igual que un camino", async () => {
  const { falso, blobs } = montar()
  falso.escribirCrudo("notes/a.json", "esto es de otro programa")

  /* Sin prefijo, esto habría devuelto los bytes de otro y `FileStorageAdapter`
     se habría puesto a parsearlos. */
  assert.deepEqual(await blobs.read("notes/a.json"), ok(null))
})

test("no se pisa una clave ajena que se llame igual que un camino", async () => {
  const { falso, blobs } = montar()
  falso.escribirCrudo("notes/a.json", "esto es de otro programa")

  await blobs.write("notes/a.json", bytes(1))

  assert.equal(falso.getItem("notes/a.json"), "esto es de otro programa")
})

test("list no ve las claves ajenas, ni siquiera con prefijo vacío", async () => {
  const { falso, blobs } = montar()
  falso.escribirCrudo("una-cookie-de-otro", "x")
  falso.escribirCrudo("elnotas:ajustes", "x") // parecida, pero no es un blob
  await blobs.write("notes/a.json", bytes(1))

  assert.deepEqual(valorDe(await blobs.list("")), ["notes/a.json"])
})

test("list devuelve los caminos SIN prefijo y sólo los del prefijo pedido", async () => {
  const { blobs } = montar()
  await blobs.write("notes/a.json", bytes(1))
  await blobs.write("notes/b.json", bytes(2))
  await blobs.write("plans/c.json", bytes(3))
  await blobs.write("manifest.json", bytes(4))

  assert.deepEqual([...valorDe(await blobs.list("notes/"))].sort(), [
    "notes/a.json",
    "notes/b.json",
  ])
})

test("list de un prefijo sin nada devuelve una lista vacía, no un error", async () => {
  const { blobs } = montar()
  assert.deepEqual(await blobs.list("plans/"), ok([]))
})

/* ═══════════ La traducción de excepciones: uno por uno, no un ejemplo ══════ */

test("la excepción de cuota del estándar sale como quota-exceeded", async () => {
  const { falso, blobs } = montar()
  falso.lanzarEn("setItem", excepcionDeCuota())

  assert.deepEqual(errorDe(await blobs.write("x", bytes(1))), { kind: "quota-exceeded" })
})

test("la de Firefox, por su nombre propio, también", async () => {
  const { falso, blobs } = montar()
  falso.lanzarEn("setItem", { name: "NS_ERROR_DOM_QUOTA_REACHED", code: 1014 })

  assert.deepEqual(errorDe(await blobs.write("x", bytes(1))), { kind: "quota-exceeded" })
})

test("la de Safari viejo, por su nombre heredado, también", async () => {
  const { falso, blobs } = montar()
  falso.lanzarEn("setItem", { name: "QUOTA_EXCEEDED_ERR" })

  assert.deepEqual(errorDe(await blobs.write("x", bytes(1))), { kind: "quota-exceeded" })
})

test("y una que sólo trae el código 22, sin nombre, también", async () => {
  const { falso, blobs } = montar()
  /* El caso de los navegadores antiguos: `name` vacío y sólo el `code`
     heredado. Si sólo se mirara el nombre, esto acabaría en `io` y la app se
     pondría a reintentar contra un almacén lleno. */
  falso.lanzarEn("setItem", { name: "", code: 22 })

  assert.deepEqual(errorDe(await blobs.write("x", bytes(1))), { kind: "quota-exceeded" })
})

test("SecurityError sale como permission-denied, no como io", async () => {
  const { falso, blobs } = montar()
  /* Es lo que lanza el navegador cuando el almacenamiento del sitio está
     bloqueado. Reintentar no sirve: hace falta que el usuario cambie un
     ajuste, que es exactamente la línea que separa este caso de `io`. */
  falso.lanzarEn("getItem", new DOMException("bloqueado", "SecurityError"))

  assert.deepEqual(errorDe(await blobs.read("x")), { kind: "permission-denied" })
})

test("lo que no se sabe clasificar cae en io, y la causa viaja INTACTA", async () => {
  const { falso, blobs } = montar()
  const raro: Error = new Error("algo que no habíamos visto")
  falso.lanzarEn("removeItem", raro)

  const fallo: StorageError = errorDe(await blobs.delete("x"))

  assert.equal(fallo.kind, "io")
  /* `strictEqual`: lo que se comprueba es que nadie reconstruye el error por el
     camino, y reconstruirlo es el primer paso para deformarlo. */
  assert.strictEqual(fallo.kind === "io" ? fallo.cause : null, raro)
})

test("un almacén que revienta al recorrerlo tampoco lanza: list devuelve err", async () => {
  const { falso, blobs } = montar()
  /* Leer `length` es lo primero que hace `list`, y en un contexto bloqueado
     lanza igual que `getItem`. La prueba es que **no escapa**. */
  falso.lanzarEn("length", new DOMException("bloqueado", "SecurityError"))

  assert.deepEqual(errorDe(await blobs.list("notes/")), { kind: "permission-denied" })
})

test("un base64 ilegible sale como corrupt, con su camino", async () => {
  const { falso, blobs } = montar()
  /* Alguien tocó el valor a mano, u otro programa pisó la clave. Los bytes que
     hay ahí ya no son los que se guardaron, y `atob` va a fallar igual la vez
     siguiente: `io` diría "reintenta" y sería mentira. */
  falso.escribirCrudo("elnotas:blob:notes/a.json", "esto no es base64 ni de lejos %%%")

  const fallo: StorageError = errorDe(await blobs.read("notes/a.json"))

  assert.equal(fallo.kind, "corrupt")
  assert.equal(fallo.kind === "corrupt" ? fallo.path : null, "notes/a.json")
})

test("la excepción armada se consume: la llamada siguiente va bien", async () => {
  const { falso, blobs } = montar()
  falso.lanzarEn("setItem", excepcionDeCuota())

  assert.equal(errorDe(await blobs.write("x", bytes(1))).kind, "quota-exceeded")
  assert.deepEqual(await blobs.write("x", bytes(1)), ok(undefined))
})
