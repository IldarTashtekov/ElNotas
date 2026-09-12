/**
 * LA SUITE DE CONTRATOS: una sola especificación que **todos** los adaptadores
 * tienen que pasar (`ARCHITECTURE.md` §6.3).
 *
 * La idea, que es lo importante: en vez de escribir pruebas para cada adaptador
 * por separado —lo que garantiza que cada uno funcione *a su manera*— se escribe
 * **una sola suite contra la interfaz**, y se ejecuta contra cada
 * implementación. Un adaptador está terminado cuando pasa el contrato. Si un
 * backend nuevo se comporta distinto, el contrato lo cantea el primer día y no
 * seis meses después.
 *
 * Se usa así, y la Fase 3 hará exactamente lo mismo con el de fichero:
 *
 *     runStorageContract("MemoryStorageAdapter", createMemoryStorageAdapter)
 *
 * ── Por qué este fichero se llama `.test.ts` si no tiene ni una prueba ─────
 *
 * Porque las tres configuraciones de TypeScript tratan a los `*.test.ts` como
 * código de pruebas, y esto lo es: importa `node:test` y `node:assert`, que
 * `tsconfig.json` no typechequea (va sin los tipos de Node). La alternativa era
 * añadir una exclusión a mano en la config de la app; se prefiere el nombre a
 * tocar la infraestructura. `node --test` lo carga y no encuentra pruebas de
 * nivel superior, que es inocuo: las define quien llama a `runStorageContract`.
 *
 * ── Por qué aquí SÍ se usa `deepEqual` ────────────────────────────────────
 *
 * El proyecto dice `strictEqual`, nunca `deepEqual`, y con razón: en el dominio
 * lo que se comprueba es la **identidad** de los objetos, y un `deepEqual` pasa
 * igual de verde con una implementación que la rompe (§3).
 *
 * **Aquí es al revés, y es deliberado.** Un almacén no promete devolver el mismo
 * objeto: el de memoria lo hace porque no serializa nada, y el de fichero
 * devolverá uno equivalente recién salido de un `JSON.parse`. Si el contrato
 * exigiera `strictEqual`, estaría exigiendo algo que **ningún adaptador real
 * puede cumplir**, y lo pasaría sólo el de memoria — justo lo contrario de para
 * lo que existe. Comparar por valor no es aquí una relajación: es el contrato.
 */

import { test } from "node:test"
import assert from "node:assert/strict"

import type { Context, Note, Plan, StorageAdapter } from "#core/index"
import { contextId, noteId, noteRef, planId, revision } from "#core/index"

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

  caso("get de un id que no está guardado devuelve null", async (s) => {
    assert.equal(await s.notes.get(COMPRA.id), null)
  })

  caso("lo que se guarda se recupera igual", async (s) => {
    await s.notes.put(COMPRA)
    assert.deepEqual(await s.notes.get(COMPRA.id), COMPRA)
  })

  caso("put con un id que ya estaba REEMPLAZA, no duplica", async (s) => {
    await s.notes.put(COMPRA)
    const renombrada: Note = { ...COMPRA, name: "Compra del mes" }
    await s.notes.put(renombrada)

    assert.deepEqual(await s.notes.get(COMPRA.id), renombrada)
    assert.equal((await s.notes.getAll()).length, 1)
  })

  caso("getAll de un almacén vacío devuelve una lista vacía", async (s) => {
    assert.deepEqual(await s.notes.getAll(), [])
  })

  caso("getAll devuelve todas las guardadas", async (s) => {
    await s.notes.put(COMPRA)
    await s.notes.put(DIARIO)
    assert.deepEqual(porId(await s.notes.getAll()), porId([COMPRA, DIARIO]))
  })

  caso("delete quita la entidad de get y de getAll", async (s) => {
    await s.notes.put(COMPRA)
    await s.notes.put(DIARIO)
    await s.notes.delete(COMPRA.id)

    assert.equal(await s.notes.get(COMPRA.id), null)
    assert.deepEqual(await s.notes.getAll(), [DIARIO])
  })

  caso("delete de algo que no está guardado NO lanza", async (s) => {
    await s.notes.delete(COMPRA.id)
    assert.deepEqual(await s.notes.getAll(), [])
  })

  /* ── Repository: los tres están aislados ──
     Sin esto, un adaptador que guardara las tres clases en el mismo saco pasaría
     todo lo de arriba. Y el fallo sería de los buenos: un Plan y una Nota con el
     mismo id, y uno de los dos desaparece. */

  caso("los tres repositorios no se pisan entre sí", async (s) => {
    await s.notes.put(COMPRA)
    await s.plans.put(MUDANZA)
    await s.contexts.put(CASA)

    assert.deepEqual(await s.notes.getAll(), [COMPRA])
    assert.deepEqual(await s.plans.getAll(), [MUDANZA])
    assert.deepEqual(await s.contexts.getAll(), [CASA])
  })

  caso("borrar en un repositorio no toca a los otros", async (s) => {
    await s.notes.put(COMPRA)
    await s.plans.put(MUDANZA)
    await s.notes.delete(COMPRA.id)

    assert.deepEqual(await s.plans.getAll(), [MUDANZA])
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
    assert.deepEqual(await s.contexts.get(CASA.id), conNota)
  })

  /* ── schemaVersion ── */

  caso("un almacén vacío responde versión de esquema 0", async (s) => {
    assert.equal(await s.getSchemaVersion(), 0)
  })

  caso("la versión de esquema se guarda y se recupera", async (s) => {
    await s.setSchemaVersion(3)
    assert.equal(await s.getSchemaVersion(), 3)
  })

  /* ── transaction ──
     OJO con lo que NO se exige: **atomicidad**. El puerto la declara
     "best-effort", y un adaptador sobre ficheros sueltos no puede deshacer lo ya
     escrito. Exigir rollback aquí sería exigir algo que sólo el de memoria podría
     cumplir. Lo que sí se exige es que las escrituras se apliquen y que un fallo
     se propague en vez de tragarse. */

  caso("transaction devuelve lo que devuelve su función", async (s) => {
    assert.equal(await s.transaction(async () => 42), 42)
  })

  caso("las escrituras de dentro de transaction quedan aplicadas", async (s) => {
    await s.transaction(async () => {
      await s.notes.put(COMPRA)
      await s.contexts.put(CASA)
    })

    assert.deepEqual(await s.notes.get(COMPRA.id), COMPRA)
    assert.deepEqual(await s.contexts.get(CASA.id), CASA)
  })

  caso("transaction propaga la excepción de su función", async (s) => {
    await assert.rejects(
      s.transaction(async () => {
        throw new Error("fallo a mitad")
      }),
      /fallo a mitad/,
    )
  })

  caso("transaction propaga también un fallo SÍNCRONO", async (s) => {
    // Un `transaction` sin `async` dejaría escapar esta excepción antes de
    // devolver promesa, y `assert.rejects` ni llegaría a verla.
    await assert.rejects(
      s.transaction(() => {
        throw new Error("fallo antes de empezar")
      }),
      /fallo antes de empezar/,
    )
  })
}
