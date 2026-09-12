/**
 * El escritor diferido.
 *
 * Todas las pruebas usan un **reloj de mentira**: `schedule` se inyecta y lo que
 * hace es apuntar la función en una lista, sin temporizadores de verdad. Así las
 * pruebas no esperan ni un milisegundo y no son intermitentes. Es la ventaja
 * concreta de haber dejado la temporización como argumento en vez de como
 * `setTimeout` a pelo.
 *
 * Y el adaptador va envuelto en un contador de escrituras, porque lo que hay que
 * comprobar no es sólo "qué queda guardado" sino **cuántas veces se escribió**.
 * Un write-behind que funciona pero escribe en cada tecla pasa cualquier prueba
 * que sólo mire el resultado final.
 */

import { test } from "node:test"
import assert from "node:assert/strict"

import type { AppState, Note, StorageAdapter } from "#core/index"
import { noteId, revision } from "#core/index"

import { createMemoryStorageAdapter } from "./memory/MemoryStorageAdapter"
import type { Schedule } from "./writeBehind"
import { createWriteBehind } from "./writeBehind"

/* ──────────────────────────── Utillaje de prueba ──────────────────────────── */

/**
 * Un `schedule` que no espera. Guarda **todas** las funciones programadas —no
 * sólo la última— para que un debounce que se olvide de cancelar la anterior se
 * note: se acumularían y `correr()` las dispararía todas.
 */
const relojDeMentira = (): {
  schedule: Schedule
  correr: () => void
  programados: () => number
} => {
  let pendientes: ReadonlyArray<() => void> = []
  return {
    schedule: (fn) => {
      pendientes = [...pendientes, fn]
      return () => {
        pendientes = pendientes.filter((p) => p !== fn)
      }
    },
    correr: () => {
      const aCorrer = pendientes
      pendientes = []
      for (const fn of aCorrer) fn()
    },
    programados: () => pendientes.length,
  }
}

/**
 * Envuelve un adaptador y cuenta lo que se le pide.
 *
 * Dos contadores, y el segundo no es un capricho: sin él, quitar del escritor la
 * comprobación de "si no cambió nada no toques el disco" **no rompería ninguna
 * prueba**, porque un diff vacío no genera ningún `put` de todas formas. Lo que
 * sí genera es una transacción vacía, que en un adaptador de fichero significa
 * abrir cosas para nada.
 */
const contando = (
  base: StorageAdapter,
): {
  adapter: StorageAdapter
  escrituras: () => number
  transacciones: () => number
} => {
  let escrituras = 0
  let transacciones = 0

  const contar = <A extends unknown[]>(
    fn: (...args: A) => Promise<void>,
  ): ((...args: A) => Promise<void>) => {
    return async (...args) => {
      escrituras += 1
      await fn(...args)
    }
  }

  return {
    adapter: {
      ...base,
      transaction: async (fn) => {
        transacciones += 1
        return base.transaction(fn)
      },
      notes: { ...base.notes, put: contar(base.notes.put), delete: contar(base.notes.delete) },
      plans: { ...base.plans, put: contar(base.plans.put), delete: contar(base.plans.delete) },
      contexts: {
        ...base.contexts,
        put: contar(base.contexts.put),
        delete: contar(base.contexts.delete),
      },
    },
    escrituras: () => escrituras,
    transacciones: () => transacciones,
  }
}

const ID_COMPRA = noteId("compra")

const nota = (name: string): Note => ({
  id: ID_COMPRA,
  name,
  content: [],
  updatedAt: 0,
  revision: revision(`rev-${name}`),
})

const VACIO: AppState = { notes: {}, plans: {}, contexts: {} }

const conNota = (n: Note): AppState => ({ ...VACIO, notes: { [n.id]: n } })

const montar = (initial: AppState = VACIO) => {
  const reloj = relojDeMentira()
  const contador = contando(createMemoryStorageAdapter())
  const wb = createWriteBehind({
    adapter: contador.adapter,
    initial,
    schedule: reloj.schedule,
  })
  return { ...wb, ...reloj, ...contador }
}

/* ─────────────────── Lo que da nombre a esto: NO escribir ya ──────────────── */

test("un aviso no escribe nada hasta que salta la espera", async () => {
  const s = montar()
  s.onState(conNota(nota("Compra")))

  assert.equal(s.escrituras(), 0, "ha escrito sin esperar")
  assert.equal(await s.adapter.notes.get(ID_COMPRA), null)

  s.correr()
  await s.flush()
  assert.equal(s.escrituras(), 1)
})

test("cada aviso CANCELA la espera anterior: sólo queda una programada", () => {
  const s = montar()

  // Veinte cambios seguidos, como teclear una línea.
  for (let i = 0; i < 20; i += 1) s.onState(conNota(nota(`Compra${i}`)))

  assert.equal(s.programados(), 1, "se han acumulado esperas sin cancelar")
})

test("una ráfaga de avisos acaba en UNA sola escritura", async () => {
  const s = montar()

  for (let i = 0; i < 20; i += 1) s.onState(conNota(nota(`Compra${i}`)))

  s.correr()
  await s.flush()

  assert.equal(s.escrituras(), 1, "ha escrito más de una vez en la ráfaga")
  const guardada = await s.adapter.notes.get(ID_COMPRA)
  assert.equal(guardada?.name, "Compra19", "ha guardado un estado intermedio")
})

/* ──────── El eslabón ②: si el estado no cambió, no se toca el disco ───────── */

test("recibir el MISMO estado no provoca ninguna escritura", async () => {
  const estado = conNota(nota("Compra"))
  const s = montar(estado) // ya está guardado: es el estado inicial

  s.onState(estado)
  await s.flush()

  assert.equal(s.escrituras(), 0)
  // Ni siquiera se abre una transacción vacía.
  assert.equal(s.transacciones(), 0, "ha abierto el almacén para no hacer nada")
})

test("un estado nuevo con las mismas entidades tampoco escribe", async () => {
  const laNota = nota("Compra")
  const s = montar(conNota(laNota))

  // Objeto raíz distinto, entidades idénticas por referencia.
  s.onState({ ...conNota(laNota) })
  await s.flush()

  assert.equal(s.escrituras(), 0)
  assert.equal(s.transacciones(), 0)
})

/* ──────────────────────── Sólo se escribe lo que cambió ───────────────────── */

test("cambiar una nota no reescribe el resto del estado", async () => {
  const otra: Note = { ...nota("Diario"), id: noteId("diario") }
  const inicial: AppState = {
    ...VACIO,
    notes: { [ID_COMPRA]: nota("Compra"), [otra.id]: otra },
  }
  const s = montar(inicial)

  s.onState({
    ...inicial,
    notes: { ...inicial.notes, [ID_COMPRA]: nota("Compra del mes") },
  })
  await s.flush()

  assert.equal(s.escrituras(), 1, "ha reescrito la nota que no cambió")
})

test("borrar una entidad llega al almacén", async () => {
  const s = montar(conNota(nota("Compra")))
  await s.adapter.notes.put(nota("Compra")) // que exista de verdad en el almacén

  s.onState(VACIO)
  await s.flush()

  assert.equal(await s.adapter.notes.get(ID_COMPRA), null)
})

/* ──────────────────────────── Ráfagas que se anulan ───────────────────────── */

test("una nota creada y borrada dentro de la ráfaga no llega a disco", async () => {
  const s = montar()

  s.onState(conNota(nota("Efímera")))
  s.onState(VACIO)
  await s.flush()

  assert.equal(s.escrituras(), 0)
})

/* ────────────────────────────── flush y fallos ────────────────────────────── */

test("flush cancela la espera pendiente: no se escribe dos veces", async () => {
  const s = montar()
  s.onState(conNota(nota("Compra")))

  await s.flush()
  s.correr() // el temporizador que ya no debería existir

  await s.flush()
  assert.equal(s.escrituras(), 1)
})

test("flush sin nada pendiente no escribe ni falla", async () => {
  const s = montar()
  await s.flush()
  assert.equal(s.escrituras(), 0)
})

test("si la escritura falla, el cambio NO se da por guardado y se reintenta", async () => {
  const base = createMemoryStorageAdapter()
  let fallar = true
  const adapter: StorageAdapter = {
    ...base,
    notes: {
      ...base.notes,
      put: async (n) => {
        if (fallar) throw new Error("disco lleno")
        await base.notes.put(n)
      },
    },
  }
  const wb = createWriteBehind({ adapter, initial: VACIO, schedule: () => () => undefined })

  wb.onState(conNota(nota("Compra")))
  await assert.rejects(wb.flush(), /disco lleno/)
  assert.equal(await base.notes.get(ID_COMPRA), null)

  // El fallo no ha envenenado el escritor: al reintentar, el cambio sigue ahí.
  fallar = false
  await wb.flush()
  assert.equal((await base.notes.get(ID_COMPRA))?.name, "Compra")
})
