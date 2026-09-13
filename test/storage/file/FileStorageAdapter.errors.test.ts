/**
 * Lo que el contrato no puede ver: **el esquema en disco y la traducción de
 * errores** de `FileStorageAdapter`.
 *
 * ── Por qué este fichero existe, si el adaptador de memoria no tiene ninguno ─
 *
 * La regla del proyecto es que un adaptador está terminado cuando pasa la suite
 * de contratos, y que escribirle pruebas propias suele ser la señal de que uno
 * se está apoyando en un detalle que los demás backends no cumplen. Esto no es
 * ese caso, y la diferencia importa:
 *
 * - la suite de contratos habla el idioma de **entidades e ids**, y no sabe que
 *   existe un `BlobStore`. No puede escribir «guarda una nota y comprueba que el
 *   fichero se llama `notes/compra.json`», ni «haz que la plataforma falle»;
 * - y eso deja sin probar justo las dos cosas que este adaptador tiene de suyo:
 *   **que el `err` de abajo se propague sin reempaquetar** y **que unos bytes
 *   que no son JSON salgan como `corrupt`**. Escribir la traducción y no
 *   probarla sería escribir media traducción.
 *
 * Dicho de otro modo: el contrato prueba que este adaptador es *un almacén*;
 * esto prueba que es *el de ficheros*.
 *
 * ── La identidad del error se comprueba con `strictEqual`, y a propósito ────
 *
 * La excepción razonada del `deepEqual` es la suite de contratos, que compara
 * entidades por valor porque un almacén no promete devolver el mismo objeto.
 * Aquí se compara **el objeto de error**, y ahí sí se exige identidad: lo que se
 * está probando es que el adaptador **no lo toca**. Con `deepEqual` pasaría
 * igual de verde uno que lo reconstruyera por el camino — y reconstruirlo es el
 * primer paso para deformarlo.
 */

import { test } from "node:test"
import assert from "node:assert/strict"

import type { Context, Note, Plan, StorageAdapter, StorageError } from "#core/index"
import { contextId, noteId, planId, revision } from "#core/index"

import type { FakeBlobStore } from "./FakeBlobStore"
import { createFakeBlobStore, errorDe, valorDe } from "./FakeBlobStore"
import { createFileStorageAdapter } from "#storage/file/FileStorageAdapter"

/* ───────────────────────────── Entidades y utillaje ───────────────────────── */

const COMPRA: Note = {
  id: noteId("compra"),
  name: "Compra semanal",
  content: [],
  updatedAt: 0,
  revision: revision("rev-compra"),
}

const MUDANZA: Plan = {
  id: planId("mudanza"),
  name: "Mudanza",
  nodes: [],
  updatedAt: 0,
  revision: revision("rev-mudanza"),
}

const CASA: Context = {
  id: contextId("casa"),
  name: "Casa",
  defaultView: { type: "context" },
  items: [],
  updatedAt: 0,
  revision: revision("rev-casa"),
}

interface Montaje {
  readonly blobs: FakeBlobStore
  readonly s: StorageAdapter
}

const montar = (): Montaje => {
  const blobs: FakeBlobStore = createFakeBlobStore()
  return { blobs, s: createFileStorageAdapter(blobs) }
}

/** Un error reconocible, para seguirle la pista objeto a objeto. */
const SIN_PERMISO: StorageError = { kind: "permission-denied" }

/* ═══════════════════ 1. El esquema: id → camino ═══════════════════════════ */

test("FileStorageAdapter: una nota se guarda en notes/<id>.json", async () => {
  const { blobs, s } = montar()
  await s.notes.put(COMPRA)

  assert.deepEqual(blobs.caminos(), ["notes/compra.json"])
})

test("FileStorageAdapter: cada clase de entidad va a su carpeta", async () => {
  const { blobs, s } = montar()
  await s.notes.put(COMPRA)
  await s.plans.put(MUDANZA)
  await s.contexts.put(CASA)

  assert.deepEqual([...blobs.caminos()].sort(), [
    "contexts/casa.json",
    "notes/compra.json",
    "plans/mudanza.json",
  ])
})

test("FileStorageAdapter: el JSON va indentado, que es para lo que §6.2 parte por entidad", async () => {
  const { blobs, s } = montar()
  await s.notes.put(COMPRA)

  const texto: string | null = blobs.leerTexto("notes/compra.json")
  if (texto === null) throw new Error("no se escribió el fichero")

  /* Un JSON en una sola línea haría que cambiar una palabra reescribiera la
     línea entera, que es justo el diff grande que el formato quiere evitar. */
  assert.ok(texto.includes("\n  \"name\": \"Compra semanal\""), texto)
  assert.ok(texto.endsWith("\n"))
})

test("FileStorageAdapter: un id con barra dentro NO escapa de su carpeta", async () => {
  const { blobs, s } = montar()
  await s.notes.put({ ...COMPRA, id: noteId("../secretos/x") })

  const caminos: ReadonlyArray<string> = blobs.caminos()
  assert.equal(caminos.length, 1)

  // `noUncheckedIndexedAccess`: indexar da `string | undefined`, y se trata.
  const camino: string | undefined = caminos[0]
  if (camino === undefined) throw new Error("no se escribió ningún fichero")

  assert.ok(camino.startsWith("notes/"), camino)
  assert.ok(!camino.slice("notes/".length).includes("/"), camino)
})

test("FileStorageAdapter: delete borra el fichero, no lo deja vacío", async () => {
  const { blobs, s } = montar()
  await s.notes.put(COMPRA)
  await s.notes.delete(COMPRA.id)

  assert.deepEqual(blobs.caminos(), [])
})

test("FileStorageAdapter: setSchemaVersion escribe manifest.json", async () => {
  const { blobs, s } = montar()
  await s.setSchemaVersion(7)

  assert.deepEqual(blobs.caminos(), ["manifest.json"])
  assert.match(String(blobs.leerTexto("manifest.json")), /"schemaVersion": 7/)
})

/* ═══════════ 2. El err del BlobStore se propaga SIN reempaquetar ══════════ */

/*
    Los siete caminos por los que un fallo de la plataforma puede entrar. Se
    prueban uno a uno y no con un representante por el mismo motivo por el que
    `esReintentable` prueba sus cinco casos sueltos: con un solo ejemplo, envolver
    uno de los otros seis en un `io` no tumbaría nada.
*/

test("FileStorageAdapter: get propaga el err de read intacto", async () => {
  const { blobs, s } = montar()
  blobs.fallarEn("read", SIN_PERMISO)

  assert.strictEqual(errorDe(await s.notes.get(COMPRA.id)), SIN_PERMISO)
})

test("FileStorageAdapter: put propaga el err de write intacto", async () => {
  const { blobs, s } = montar()
  blobs.fallarEn("write", SIN_PERMISO)

  assert.strictEqual(errorDe(await s.notes.put(COMPRA)), SIN_PERMISO)
})

test("FileStorageAdapter: delete propaga el err de delete intacto", async () => {
  const { blobs, s } = montar()
  blobs.fallarEn("delete", SIN_PERMISO)

  assert.strictEqual(errorDe(await s.notes.delete(COMPRA.id)), SIN_PERMISO)
})

test("FileStorageAdapter: getAll propaga el err de list intacto", async () => {
  const { blobs, s } = montar()
  blobs.fallarEn("list", SIN_PERMISO)

  assert.strictEqual(errorDe(await s.notes.getAll()), SIN_PERMISO)
})

test("FileStorageAdapter: getAll propaga el err del read de una entidad", async () => {
  const { blobs, s } = montar()
  await s.notes.put(COMPRA)
  blobs.fallarEn("read", SIN_PERMISO)

  assert.strictEqual(errorDe(await s.notes.getAll()), SIN_PERMISO)
})

test("FileStorageAdapter: getSchemaVersion propaga el err de read intacto", async () => {
  const { blobs, s } = montar()
  blobs.fallarEn("read", SIN_PERMISO)

  assert.strictEqual(errorDe(await s.getSchemaVersion()), SIN_PERMISO)
})

test("FileStorageAdapter: setSchemaVersion propaga el err de write intacto", async () => {
  const { blobs, s } = montar()
  blobs.fallarEn("write", SIN_PERMISO)

  assert.strictEqual(errorDe(await s.setSchemaVersion(2)), SIN_PERMISO)
})

test("FileStorageAdapter: un quota-exceeded tampoco se convierte en io", async () => {
  /* El caso concreto que motivó la taxonomía: si esto saliera como `io`, el
     write-behind lo daría por reintentable y se pasaría la sesión escribiendo
     en un disco lleno. No basta con probar un `kind`: hay que probar que no se
     traduce NINGUNO. */
  const { blobs, s } = montar()
  const discoLleno: StorageError = { kind: "quota-exceeded" }
  blobs.fallarEn("write", discoLleno)

  assert.strictEqual(errorDe(await s.notes.put(COMPRA)), discoLleno)
})

/* ════════════ 3. Lo que este adaptador SÍ inventa: corrupt ═══════════════ */

test("FileStorageAdapter: bytes que no son JSON salen como corrupt, con su path", async () => {
  const { blobs, s } = montar()
  blobs.escribirTexto("notes/compra.json", "{ esto no es json")

  const fallo: StorageError = errorDe(await s.notes.get(COMPRA.id))

  /* `corrupt` y no `io`, que es toda la razón de que sean casos distintos: con
     `io` la app reintentaría leer eternamente un fichero que no va a cambiar, y
     parecería que está todo roto cuando sólo falla una nota (§6.5). */
  if (fallo.kind !== "corrupt") throw new Error(`se esperaba corrupt y vino ${fallo.kind}`)
  // El camino viaja dentro: `corrupt` existe para poder DECIR CUÁL.
  assert.equal(fallo.path, "notes/compra.json")
  assert.match(String(fallo.cause), /JSON/)
})

test("FileStorageAdapter: JSON válido que no es un objeto también es corrupt", async () => {
  /* Los tres valores no son intercambiables, y el que importa es `null`: es
     JSON perfectamente válido, y sin la comprobación de «esto es un objeto» el
     siguiente paso sería leerle el `id` a un `null` — un `TypeError` que se
     escaparía POR ENCIMA de la frontera, rompiendo la promesa de que ninguna
     firma lanza. `42` y `[]` sólo se cuelan como entidades vacías. */
  for (const basura of ["null", "42", "[]"]) {
    const { blobs, s } = montar()
    blobs.escribirTexto("notes/compra.json", basura)

    const fallo: StorageError = errorDe(await s.notes.get(COMPRA.id))
    assert.equal(fallo.kind, "corrupt", basura)
  }
})

test("FileStorageAdapter: un objeto sin id es corrupt, no una entidad a medias", async () => {
  const { blobs, s } = montar()
  blobs.escribirTexto("notes/compra.json", "{\"name\":\"sin id\"}")

  const fallo: StorageError = errorDe(await s.notes.get(COMPRA.id))
  assert.equal(fallo.kind, "corrupt")
})

test("FileStorageAdapter: bytes que no son UTF-8 válido son corrupt", async () => {
  /* ⚠️ Los bytes de esta prueba están elegidos, no son basura cualquiera: al
     descodificarlos **a la mala** —sustituyendo lo inválido por U+FFFD, que es
     lo que hace un `TextDecoder` por defecto— sale un JSON PERFECTAMENTE
     VÁLIDO, con su id y todo. O sea que sin `fatal: true` esto no daría ningún
     error: devolvería una nota con el nombre silenciosamente estropeado, y el
     siguiente guardado escribiría esa versión encima de la buena.

     Con basura que tampoco es JSON, la prueba pasaría igual sin `fatal` —la
     cazaría el `JSON.parse`— y no estaría probando nada de esto. */
  const { blobs, s } = montar()
  const codificador: TextEncoder = new TextEncoder()
  const rotos: Uint8Array = new Uint8Array([
    ...codificador.encode("{\"id\":\"compra\",\"name\":\"Compra"),
    0xff, // ← no es UTF-8 válido en ninguna posición
    ...codificador.encode("\"}"),
  ])
  await blobs.write("notes/compra.json", rotos)

  const fallo: StorageError = errorDe(await s.notes.get(COMPRA.id))
  assert.equal(fallo.kind, "corrupt")
})

test("FileStorageAdapter: ⚠️ un fichero corrupto tumba el getAll ENTERO (decisión 3)", async () => {
  /* Está puesto por escrito porque CONTRADICE a §6.5, que pide aislar esa
     entidad y seguir con el resto. La firma del puerto es todo o nada, y las
     otras salidas son peores: saltárselo en silencio dejaría `ItemRef`
     colgando. Si algún día se añade el `onCorrupt` del adaptador, esta prueba
     es la que hay que cambiar — y se verá en el diff, que es el objetivo. */
  const { blobs, s } = montar()
  await s.notes.put(COMPRA)
  blobs.escribirTexto("notes/rota.json", "no")

  const fallo: StorageError = errorDe(await s.notes.getAll())

  if (fallo.kind !== "corrupt") throw new Error(`se esperaba corrupt y vino ${fallo.kind}`)
  assert.equal(fallo.path, "notes/rota.json")
})

test("FileStorageAdapter: un manifiesto ilegible es corrupt, no versión 0", async () => {
  /* Confundir «ilegible» con «vacío» haría que el runner de migraciones creyera
     estar ante un almacén nuevo y migrara desde cero sobre datos que sí están. */
  const { blobs, s } = montar()
  blobs.escribirTexto("manifest.json", "{{{")

  const fallo: StorageError = errorDe(await s.getSchemaVersion())
  assert.equal(fallo.kind, "corrupt")
  if (fallo.kind === "corrupt") assert.equal(fallo.path, "manifest.json")
})

test("FileStorageAdapter: un manifiesto sin schemaVersion numérico es corrupt", async () => {
  const { blobs, s } = montar()
  blobs.escribirTexto("manifest.json", "{\"schemaVersion\":\"tres\"}")

  assert.equal(errorDe(await s.getSchemaVersion()).kind, "corrupt")
})

/* ═══════════ 4. Ausencia no es fallo, ni siquiera en los bordes ═══════════ */

test("FileStorageAdapter: el ok(null) del read NO se convierte en not-found", async () => {
  /* El contrato ya exige `ok(null)`, pero desde arriba no puede distinguir «el
     BlobStore dijo que no está» de cualquier otra vía. Aquí sí: el falso
     devuelve `ok(null)` y se comprueba que el adaptador no lo asciende a error. */
  const { s } = montar()
  assert.equal(valorDe(await s.notes.get(COMPRA.id)), null)
})

test("FileStorageAdapter: un fichero que desaparece entre el list y el read no rompe getAll", async () => {
  const { blobs, s } = montar()
  await s.notes.put(COMPRA)
  blobs.fantasma("notes/borrada-en-medio.json")

  assert.deepEqual(valorDe(await s.notes.getAll()), [COMPRA])
})

test("FileStorageAdapter: un fichero ajeno en la carpeta no rompe getAll", async () => {
  /* Una carpeta de verdad la comparten el sistema operativo y el usuario. Si un
     `.DS_Store` convirtiera el arranque en un `corrupt`, la app sería
     inservible en medio equipo. */
  const { blobs, s } = montar()
  await s.notes.put(COMPRA)
  blobs.escribirTexto("notes/.DS_Store", "basura del sistema")
  blobs.escribirTexto("notes/sub/anidada.json", "{\"id\":\"x\"}")

  assert.deepEqual(valorDe(await s.notes.getAll()), [COMPRA])
})
