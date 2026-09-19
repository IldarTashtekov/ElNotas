/**
 * LA SUITE DE CONTRATOS: una sola especificación que **todos** los adaptadores
 * tienen que pasar.
 *
 * En vez de escribir pruebas para cada adaptador por separado —lo que garantiza
 * que cada uno funcione *a su manera*— se escribe una sola suite contra la
 * interfaz y se ejecuta contra cada implementación. Un adaptador está terminado
 * cuando pasa el contrato:
 *
 *     runStorageContract("MemoryStorageAdapter", createMemoryStorageAdapter)
 *
 * ⚠️ Aquí SÍ se compara con `deepEqual`, al revés que en el resto del proyecto, y
 * es deliberado: un almacén no promete devolver el mismo objeto —el de fichero
 * devolverá uno recién salido de un `JSON.parse`—, así que exigir `strictEqual`
 * sería exigir algo que sólo el de memoria puede cumplir. **No lo "arregles".**
 */

import { test } from "node:test"
import assert from "node:assert/strict"

import type { Context, Note, Plan, Result, StorageAdapter, StorageError } from "#core/index"
import { contextId, err, noteId, noteRef, ok, planId, revision } from "#core/index"

/* ──────────────────── Abrir el sobre, fallando si no toca ─────────────────── */

/**
 * El valor de un `Result` que **tenía** que haber ido bien.
 *
 * Existe para que cada prueba diga una sola cosa. Sin esto, cada `get` de la
 * suite se llevaría por delante tres líneas de comprobar el sobre antes de
 * llegar a lo que de verdad está probando. El `throw` es legítimo: esto es
 * código de prueba, y un fallo aquí ES el fallo de la prueba.
 */
const valorDe = <T>(r: Result<T, StorageError>): T => {
  if (!r.ok) throw new Error(`se esperaba ok y vino err: ${r.error.kind}`)
  return r.value
}

/** El error de un `Result` que tenía que haber ido mal. */
const errorDe = <T>(r: Result<T, StorageError>): StorageError => {
  if (r.ok) throw new Error(`se esperaba err y vino ok: ${JSON.stringify(r.value)}`)
  return r.error
}

/* ───────────────────────────── Entidades de ejemplo ───────────────────────── */

const nota = (id: string, name: string): Note => ({
  id: noteId(id),
  name,
  content: [],
  updatedAt: 0,
  revision: revision(`rev-${id}`),
})

const plan = (id: string, name: string): Plan => ({
  id: planId(id),
  name,
  nodes: [],
  updatedAt: 0,
  revision: revision(`rev-${id}`),
})

const contexto = (id: string, name: string): Context => ({
  id: contextId(id),
  name,
  defaultView: { type: "context" },
  items: [],
  updatedAt: 0,
  revision: revision(`rev-${id}`),
})

const COMPRA = nota("compra", "Compra semanal")
const DIARIO = nota("diario", "Diario")
const MUDANZA = plan("mudanza", "Mudanza")
const CASA = contexto("casa", "Casa")

/** `getAll` no promete orden, así que se compara ordenado. */
const porId = <T extends { readonly id: string }>(
  xs: ReadonlyArray<T>,
): ReadonlyArray<T> => [...xs].sort((a, b) => a.id.localeCompare(b.id))

/* ──────────────────────────────── El contrato ─────────────────────────────── */

export const runStorageContract = (
  nombre: string,
  crear: () => StorageAdapter,
): void => {
  const caso = (que: string, fn: (s: StorageAdapter) => Promise<void>): void => {
    test(`${nombre}: ${que}`, () => fn(crear()))
  }

  /* ── Repository: lo básico ── */

  caso("get de un id que no está guardado devuelve ok(null)", async (s) => {
    /* AUSENCIA NO ES FALLO, y por eso se comprueba el sobre entero y no sólo el
       `null` de dentro: un adaptador que devolviera `err({kind:"not-found"})`
       aquí estaría colapsando "no está" con "no he podido mirar". */
    assert.deepEqual(await s.notes.get(COMPRA.id), ok(null))
  })

  caso("lo que se guarda se recupera igual", async (s) => {
    assert.deepEqual(await s.notes.put(COMPRA), ok(undefined))
    assert.deepEqual(valorDe(await s.notes.get(COMPRA.id)), COMPRA)
  })

  caso("put con un id que ya estaba REEMPLAZA, no duplica", async (s) => {
    await s.notes.put(COMPRA)
    const renombrada: Note = { ...COMPRA, name: "Compra del mes" }
    await s.notes.put(renombrada)

    assert.deepEqual(valorDe(await s.notes.get(COMPRA.id)), renombrada)
    assert.equal(valorDe(await s.notes.getAll()).length, 1)
  })

  caso("getAll de un almacén vacío devuelve una lista vacía", async (s) => {
    assert.deepEqual(valorDe(await s.notes.getAll()), [])
  })

  caso("getAll devuelve todas las guardadas", async (s) => {
    await s.notes.put(COMPRA)
    await s.notes.put(DIARIO)
    assert.deepEqual(porId(valorDe(await s.notes.getAll())), porId([COMPRA, DIARIO]))
  })

  caso("delete quita la entidad de get y de getAll", async (s) => {
    await s.notes.put(COMPRA)
    await s.notes.put(DIARIO)
    assert.deepEqual(await s.notes.delete(COMPRA.id), ok(undefined))

    assert.deepEqual(await s.notes.get(COMPRA.id), ok(null))
    assert.deepEqual(valorDe(await s.notes.getAll()), [DIARIO])
  })

  caso("delete de algo que no está guardado devuelve ok", async (s) => {
    // Ni lanza ni devuelve `err`: no había nada que hacer, y eso no es fracasar.
    assert.deepEqual(await s.notes.delete(COMPRA.id), ok(undefined))
    assert.deepEqual(valorDe(await s.notes.getAll()), [])
  })

  /* ── Repository: los tres están aislados ──
     Sin esto, un adaptador que guardara las tres clases en el mismo saco pasaría
     todo lo de arriba. Y el fallo sería de los buenos: un Plan y una Nota con el
     mismo id, y uno de los dos desaparece. */

  caso("los tres repositorios no se pisan entre sí", async (s) => {
    await s.notes.put(COMPRA)
    await s.plans.put(MUDANZA)
    await s.contexts.put(CASA)

    assert.deepEqual(valorDe(await s.notes.getAll()), [COMPRA])
    assert.deepEqual(valorDe(await s.plans.getAll()), [MUDANZA])
    assert.deepEqual(valorDe(await s.contexts.getAll()), [CASA])
  })

  caso("borrar en un repositorio no toca a los otros", async (s) => {
    await s.notes.put(COMPRA)
    await s.plans.put(MUDANZA)
    await s.notes.delete(COMPRA.id)

    assert.deepEqual(valorDe(await s.plans.getAll()), [MUDANZA])
  })

  /* ── Las entidades se guardan enteras ──
     Un adaptador que serialice mal —que se deje `items` o `revision` por el
     camino— pasaría todo lo de arriba con entidades vacías. */

  caso("una entidad con contenido sobrevive entera", async (s) => {
    const conNota: Context = {
      ...CASA,
      items: [noteRef(COMPRA.id)],
      defaultView: { type: "note", id: COMPRA.id },
    }
    await s.contexts.put(conNota)
    assert.deepEqual(valorDe(await s.contexts.get(CASA.id)), conNota)
  })

  /* ── schemaVersion ── */

  caso("un almacén vacío responde versión de esquema 0", async (s) => {
    // El 0 va dentro del `ok`: "nunca se ha escrito nada" es una respuesta
    // válida, y es justo la que el runner de migraciones necesita distinguir de
    // "esquema viejo". Un `err` aquí rompería el primer arranque de la app.
    assert.deepEqual(await s.getSchemaVersion(), ok(0))
  })

  caso("la versión de esquema se guarda y se recupera", async (s) => {
    assert.deepEqual(await s.setSchemaVersion(3), ok(undefined))
    assert.equal(valorDe(await s.getSchemaVersion()), 3)
  })

  /* ── transaction ──
     OJO con lo que NO se exige: **atomicidad**. El puerto la declara
     "best-effort", y un adaptador sobre ficheros sueltos no puede deshacer lo ya
     escrito. Exigir rollback aquí sería exigir algo que sólo el de memoria podría
     cumplir. Lo que sí se exige es que las escrituras se apliquen, que el fallo
     de dentro salga **entero** y que nada escape como excepción. */

  caso("transaction devuelve lo que devuelve su función", async (s) => {
    assert.deepEqual(await s.transaction(async () => ok(42)), ok(42))
  })

  caso("las escrituras de dentro de transaction quedan aplicadas", async (s) => {
    await s.transaction(async () => {
      await s.notes.put(COMPRA)
      await s.contexts.put(CASA)
      return ok(undefined)
    })

    assert.deepEqual(valorDe(await s.notes.get(COMPRA.id)), COMPRA)
    assert.deepEqual(valorDe(await s.contexts.get(CASA.id)), CASA)
  })

  caso("transaction devuelve el err de su función SIN reempaquetar", async (s) => {
    /* Lo que se exige es el `kind` de origen. Si el adaptador envolviera este
       error en uno suyo —en `io`, pongamos—, quien llama creería que reintentar
       sirve de algo cuando el permiso está revocado: exactamente el fallo que
       toda la taxonomía existe para evitar. */
    const sinPermiso: StorageError = { kind: "permission-denied" }
    const r: Result<number, StorageError> = await s.transaction(async () =>
      err(sinPermiso),
    )

    assert.deepEqual(errorDe(r), sinPermiso)
  })

  caso("una excepción de la función NO escapa: se traduce a io", async (s) => {
    /* La frontera del adaptador. `transaction` ejecuta código ajeno, y ese
       código puede lanzar aunque el puerto diga que no; lo que no puede es
       romper la firma de `transaction`, que promete un `Result` y no un rechazo.
       Si escapara, este `await` reventaría la prueba en vez de devolver nada. */
    const fallo: StorageError = errorDe(
      await s.transaction(async () => {
        throw new Error("fallo a mitad")
      }),
    )

    if (fallo.kind !== "io") throw new Error(`se esperaba io y vino ${fallo.kind}`)
    // `cause` guarda lo que vino de abajo, intacto y para depurar.
    assert.match(String(fallo.cause), /fallo a mitad/)
  })

  caso("tampoco escapa un fallo SÍNCRONO de la función", async (s) => {
    // Un `transaction` sin `async` dejaría escapar esta excepción antes de
    // devolver promesa siquiera, y no habría `catch` que pudiera traducirla.
    const fallo: StorageError = errorDe(
      await s.transaction(() => {
        throw new Error("fallo antes de empezar")
      }),
    )

    if (fallo.kind !== "io") throw new Error(`se esperaba io y vino ${fallo.kind}`)
    assert.match(String(fallo.cause), /fallo antes de empezar/)
  })
}
