/**
 * LA CADENA ENTERA, de la pulsación al disco.
 *
 * La rebanada vertical de la Fase 1 (`core/app/slice.test.ts`) demostró tres de
 * los cuatro eslabones de `ARCHITECTURE.md` §3: que el reducer no ensucia, que
 * el `Store` no avisa y que la operación devuelve su entrada. Faltaba el ②, que
 * no existía todavía. Esto lo cierra:
 *
 *     marcar una casilla que YA estaba marcada
 *     no avisa a nadie, no ensucia `updatedAt`, y NO LLEGA A DISCO.
 *
 * Es el punto 3 del criterio de cierre de la Fase 2 (§9.8), y la primera vez que
 * `core` y `storage` se montan juntos: `Store` → `createWriteBehind` →
 * `MemoryStorageAdapter`, con los puertos `Clock` e `IdGenerator` fabricados
 * aquí mismo en dos líneas.
 *
 * Por qué importa que sea de punta a punta y no por piezas: cada mitad ya tiene
 * sus pruebas, y las dos pasan. Lo que ninguna de ellas puede ver es si están
 * bien **enchufadas** — si el escritor arranca con el estado equivocado, o si
 * nadie lo suscribe, todo sigue verde por separado.
 */

import { test } from "node:test"
import assert from "node:assert/strict"

import type {
  AppState,
  Clock,
  Content,
  IdGenerator,
  Note,
  Result,
  StorageAdapter,
  StorageError,
} from "#core/index"
import {
  checkBox,
  contentId,
  createStore,
  createUseCases,
  isCheckBox,
  noteId,
  revision,
  text,
} from "#core/index"

import { createMemoryStorageAdapter } from "./memory/MemoryStorageAdapter"
import { createWriteBehind } from "./writeBehind"

/* ────────────────────────────── El escenario ────────────────────────────── */

const ID_NOTA = noteId("compra")
const ID_TITULO = contentId("titulo")
const ID_FRUTA = contentId("fruta")

const HORA_INICIAL = 0
const HORA_DEL_RELOJ = 1000

const contenido = (): ReadonlyArray<Content> => [
  text(ID_TITULO, "Compra semanal"),
  // Nace MARCADA: así "marcarla" es el no-op que hay que cazar.
  checkBox(ID_FRUTA, "Fruta", { checked: true }),
]

const NOTA: Note = {
  id: ID_NOTA,
  name: "Compra",
  content: contenido(),
  updatedAt: HORA_INICIAL,
  revision: revision("rev-inicial"),
}

const ESTADO_INICIAL: AppState = {
  notes: { [ID_NOTA]: NOTA },
  plans: {},
  contexts: {},
}

/** Abre el sobre de un `Result` que tenía que haber ido bien. */
const valorDe = <T>(r: Result<T, StorageError>): T => {
  if (!r.ok) throw new Error(`se esperaba ok y vino err: ${r.error.kind}`)
  return r.value
}

/** Cuenta escrituras y transacciones sin cambiar el comportamiento. */
const contando = (
  base: StorageAdapter,
): { adapter: StorageAdapter; escrituras: () => number } => {
  let n = 0
  /* Genérico en el retorno: lo que devuelven `put` y `delete` es un `Result` y
     tiene que pasar por aquí intacto. */
  const contar = <A extends unknown[], R>(
    fn: (...args: A) => Promise<R>,
  ): ((...args: A) => Promise<R>) => {
    return async (...args) => {
      n += 1
      return fn(...args)
    }
  }
  return {
    adapter: {
      ...base,
      notes: {
        ...base.notes,
        put: contar(base.notes.put),
        delete: contar(base.notes.delete),
      },
    },
    escrituras: () => n,
  }
}

/**
 * Monta la app entera: puertos, store, escritor y almacén, todos enchufados.
 * El `schedule` no espera nada — las pruebas llaman a `flush()` cuando quieren.
 */
const montar = () => {
  const clock: Clock = { now: () => HORA_DEL_RELOJ }
  let n = 0
  const ids: IdGenerator = { next: () => `rev-${(n += 1)}` }

  const { adapter, escrituras } = contando(createMemoryStorageAdapter())
  const store = createStore(ESTADO_INICIAL)

  let avisos = 0
  store.subscribe(() => {
    avisos += 1
  })

  const wb = createWriteBehind({
    adapter,
    initial: ESTADO_INICIAL, // lo que ya está guardado
    schedule: () => () => undefined,
  })
  store.subscribe(wb.onState)

  const useCases = createUseCases({ clock, ids, store })

  const notaGuardada = async (): Promise<Note | null> =>
    valorDe(await adapter.notes.get(ID_NOTA))
  const notaEnMemoria = (): Note | undefined => store.getState().notes[ID_NOTA]

  return {
    ...wb,
    useCases,
    escrituras,
    avisos: () => avisos,
    notaGuardada,
    notaEnMemoria,
  }
}

const estaMarcada = (nota: Note | undefined | null): boolean => {
  const linea = nota?.content.find((c) => c.id === ID_FRUTA)
  return linea !== undefined && isCheckBox(linea) && linea.checked
}

/* ───────────────── El criterio de cierre: el eslabón que faltaba ─────────── */

test("marcar una casilla YA marcada no llega a disco", async () => {
  const app = montar()

  app.useCases.setChecked(ID_NOTA, ID_FRUTA, true)
  await app.flush()

  assert.equal(app.avisos(), 0, "el Store ha avisado de un cambio que no hubo")
  assert.equal(app.escrituras(), 0, "ha escrito a disco sin que cambiara nada")
  assert.equal(
    app.notaEnMemoria()?.updatedAt,
    HORA_INICIAL,
    "ha ensuciado updatedAt",
  )
})

test("tres marcados redundantes seguidos siguen sin llegar a disco", async () => {
  const app = montar()

  app.useCases.setChecked(ID_NOTA, ID_FRUTA, true)
  app.useCases.setChecked(ID_NOTA, ID_FRUTA, true)
  app.useCases.setChecked(ID_NOTA, ID_FRUTA, true)
  await app.flush()

  assert.equal(app.avisos(), 0)
  assert.equal(app.escrituras(), 0)
})

test("una acción sobre una nota que no existe tampoco llega a disco", async () => {
  const app = montar()

  app.useCases.setChecked(noteId("no-existe"), ID_FRUTA, true)
  await app.flush()

  assert.equal(app.escrituras(), 0)
})

test("marcar una línea que no existe tampoco", async () => {
  const app = montar()

  app.useCases.setChecked(ID_NOTA, contentId("no-existe"), true)
  await app.flush()

  assert.equal(app.escrituras(), 0)
})

/* ────────────────── Y la otra mitad: un cambio de verdad SÍ llega ─────────── */

test("desmarcar una casilla marcada sí llega a disco, con su updatedAt", async () => {
  const app = montar()

  app.useCases.setChecked(ID_NOTA, ID_FRUTA, false)
  await app.flush()

  assert.equal(app.avisos(), 1)
  assert.equal(app.escrituras(), 1)

  const guardada = await app.notaGuardada()
  assert.equal(estaMarcada(guardada), false, "el cambio no llegó al almacén")
  assert.equal(guardada?.updatedAt, HORA_DEL_RELOJ)
  assert.equal(guardada?.revision, revision("rev-1"))
})

test("un cambio de verdad seguido de dos redundantes escribe UNA vez", async () => {
  const app = montar()

  app.useCases.setChecked(ID_NOTA, ID_FRUTA, false) // cambia
  app.useCases.setChecked(ID_NOTA, ID_FRUTA, false) // ya está así
  app.useCases.setChecked(ID_NOTA, ID_FRUTA, false) // ya está así
  await app.flush()

  assert.equal(app.avisos(), 1, "ha avisado de los redundantes")
  assert.equal(app.escrituras(), 1)
})

test("marcar y desmarcar en la misma ráfaga escribe una vez, con el valor final", async () => {
  const app = montar()

  app.useCases.setChecked(ID_NOTA, ID_FRUTA, false)
  app.useCases.setChecked(ID_NOTA, ID_FRUTA, true)
  await app.flush()

  // Dos avisos —el estado cambió dos veces— pero una sola escritura: el diff se
  // calcula contra lo último guardado, no contra el aviso anterior.
  assert.equal(app.avisos(), 2)
  assert.equal(app.escrituras(), 1)
  assert.equal(estaMarcada(await app.notaGuardada()), true)
})

/* ──────────────────────────── El enchufe en sí ────────────────────────────── */

test("sin flush no hay nada en el almacén: el disco va POR DETRÁS", async () => {
  const app = montar()

  app.useCases.setChecked(ID_NOTA, ID_FRUTA, false)

  assert.equal(app.avisos(), 1, "el Store avisa en el acto…")
  assert.equal(app.escrituras(), 0, "…pero el disco todavía no")
  assert.equal(await app.notaGuardada(), null)
})
