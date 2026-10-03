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
 *
 * ── Lo que añade el paso 0 de la Fase 3: qué se hace ante un fallo ─────────
 *
 * El último bloque es el que importa de esta tanda. Hasta ahora una escritura
 * fallida sólo traía una excepción sin forma y el escritor **reintentaba
 * siempre, a ciegas**; con la taxonomía puede decidir, y lo que se prueba es
 * justo esa decisión: `io` se reintenta, los otros cuatro detienen al escritor.
 *
 * Para que la distinción esté probada de verdad hacen falta las dos mitades. Con
 * sólo una, cambiar `esReintentable` por su contrario seguiría en verde.
 */

import { test } from "node:test"
import assert from "node:assert/strict"

import type { AppState, Note, Result, StorageAdapter, StorageError } from "#core/index"
import { err, noteId, revision } from "#core/index"

import { createMemoryStorageAdapter } from "#storage/memory/MemoryStorageAdapter"
import type { Schedule } from "#storage/writeBehind"
import { createWriteBehind } from "#storage/writeBehind"

/* ──────────────────────────── Utillaje de prueba ──────────────────────────── */

/** Abre el sobre de un `Result` que tenía que haber ido bien. */
const valorDe = <T>(r: Result<T, StorageError>): T => {
  if (!r.ok) throw new Error(`se esperaba ok y vino err: ${r.error.kind}`)
  return r.value
}

/** …y el de uno que tenía que haber ido mal. */
const errorDe = <T>(r: Result<T, StorageError>): StorageError => {
  if (r.ok) throw new Error("se esperaba err y vino ok")
  return r.error
}

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

  /* Genérico también en el retorno: desde el paso 0 lo que devuelven `put` y
     `delete` es un `Result`, y el contador tiene que dejarlo pasar intacto. */
  const contar = <A extends unknown[], R>(
    fn: (...args: A) => Promise<R>,
  ): ((...args: A) => Promise<R>) => {
    return async (...args) => {
      escrituras += 1
      return fn(...args)
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
  assert.equal(valorDe(await s.adapter.notes.get(ID_COMPRA)), null)

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
  const guardada: Note | null = valorDe(await s.adapter.notes.get(ID_COMPRA))
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
  await s.adapter.notes.put(nota("Compra"), null) // que exista de verdad en el almacén

  s.onState(VACIO)
  await s.flush()

  assert.equal(valorDe(await s.adapter.notes.get(ID_COMPRA)), null)
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

/* ─────────── La decisión del paso 0: ¿reintentar sirve de algo? ───────────── */

/**
 * Un almacén cuyo `notes.put` devuelve el fallo que diga `fallo()`, o escribe de
 * verdad si dice `null`. Se consulta en cada llamada a propósito: así una prueba
 * puede **arreglar el problema a mitad** y ver si el escritor lo reintenta.
 *
 * Devuelve `err(...)` en vez de lanzar, que es lo que hace un adaptador de
 * verdad desde este paso: el fallo es un valor y no una excepción.
 */
const fallandoAlEscribir = (
  fallo: () => StorageError | null,
): {
  adapter: StorageAdapter
  base: StorageAdapter
  intentos: () => number
} => {
  const base: StorageAdapter = createMemoryStorageAdapter()
  let intentos: number = 0

  return {
    base,
    adapter: {
      ...base,
      notes: {
        ...base.notes,
        put: async (n, esperada) => {
          intentos += 1
          const esteFallo: StorageError | null = fallo()
          return esteFallo === null ? base.notes.put(n, esperada) : err(esteFallo)
        },
      },
    },
    intentos: () => intentos,
  }
}

const montarConFallo = (fallo: () => StorageError | null) => {
  const reloj = relojDeMentira()
  const almacen = fallandoAlEscribir(fallo)
  const wb = createWriteBehind({
    adapter: almacen.adapter,
    initial: VACIO,
    schedule: reloj.schedule,
  })
  return { ...wb, ...reloj, ...almacen }
}

test("un fallo de io NO se da por guardado, y el siguiente intento lo reescribe", async () => {
  let fallo: StorageError | null = { kind: "io", cause: new Error("el disco no responde") }
  const s = montarConFallo(() => fallo)

  s.onState(conNota(nota("Compra")))
  assert.equal(errorDe(await s.flush()).kind, "io")
  assert.equal(valorDe(await s.base.notes.get(ID_COMPRA)), null, "lo ha escrito igual")

  /* `io` es lo único que se reintenta, y aquí está el porqué: es un fallo del
     que no se sabe más, así que puede haber pasado ya. El cambio seguía entero
     en memoria, y el segundo intento lo lleva a disco. */
  fallo = null
  valorDe(await s.flush())
  assert.equal(valorDe(await s.base.notes.get(ID_COMPRA))?.name, "Compra")
  assert.equal(s.intentos(), 2, "no ha reintentado")
})

/**
 * Los otros cinco casos de la taxonomía, enteros y uno por uno.
 *
 * Están los cinco y no un representante porque la taxonomía entera **es** la
 * especificación: mover un `kind` de lado —que `corrupt` pase por reintentable,
 * pongamos— tiene que tumbar una prueba, y con un solo ejemplo no la tumbaría.
 */
const NO_REINTENTABLES: ReadonlyArray<StorageError> = [
  { kind: "permission-denied" },
  { kind: "not-found", path: "notes/compra.json" },
  { kind: "quota-exceeded" },
  { kind: "corrupt", path: "notes/compra.json", cause: new Error("JSON a medias") },
  { kind: "stale", id: "compra" },
]

for (const noReintentable of NO_REINTENTABLES) {
  test(`un fallo de ${noReintentable.kind} DETIENE al escritor`, async () => {
    let fallo: StorageError | null = noReintentable
    const s = montarConFallo(() => fallo)

    s.onState(conNota(nota("Compra")))
    assert.equal(errorDe(await s.flush()).kind, noReintentable.kind)
    assert.equal(s.intentos(), 1)

    /* Y aunque el problema desapareciera, no vuelve a intentarlo por su cuenta:
       insistir sobre un permiso revocado o un disco lleno es exactamente lo que
       este paso vino a quitar. Reanudar es Fase 4, y a mano. */
    fallo = null
    assert.equal(
      errorDe(await s.flush()).kind,
      noReintentable.kind,
      "ha reintentado un fallo que no se arregla reintentando",
    )
    assert.equal(s.intentos(), 1, "ha vuelto a tocar el almacén estando detenido")
    assert.equal(valorDe(await s.base.notes.get(ID_COMPRA)), null)
  })
}

test("detenido, un aviso nuevo ya no programa ninguna espera", async () => {
  const s = montarConFallo(() => ({ kind: "quota-exceeded" }))

  s.onState(conNota(nota("Compra")))
  errorDe(await s.flush())
  assert.equal(s.programados(), 0, "el flush no ha cancelado su espera")

  // Un cambio nuevo se recuerda, pero ya no se programa nada por él: esa espera
  // sólo serviría para volver a fallar igual.
  s.onState(conNota(nota("Compra del mes")))
  assert.equal(s.programados(), 0, "ha programado una escritura estando detenido")
})

test("el StorageError llega INTACTO a quien llamó a flush", async () => {
  /* Identidad, no forma. Un `deepEqual` pasaría igual de verde con un escritor
     que reempaqueta el error por el camino, y reempaquetarlo es justo lo que
     haría perder el `kind` de origen — que es lo único que sirve para decidir. */
  const sinPermiso: StorageError = { kind: "permission-denied" }
  const s = montarConFallo(() => sinPermiso)

  s.onState(conNota(nota("Compra")))

  assert.strictEqual(errorDe(await s.flush()), sinPermiso)
})

/* ────────── onError: que el fallo de un guardado automático se vea ────────── */

interface ConAviso {
  readonly onState: (state: AppState) => void
  readonly flush: () => Promise<Result<void, StorageError>>
  readonly correr: () => void
  readonly avisos: () => ReadonlyArray<StorageError>
}

const montarConAviso = (fallo: () => StorageError | null): ConAviso => {
  const reloj: ReturnType<typeof relojDeMentira> = relojDeMentira()
  const almacen: ReturnType<typeof fallandoAlEscribir> = fallandoAlEscribir(fallo)
  let avisos: ReadonlyArray<StorageError> = []
  const wb: ReturnType<typeof createWriteBehind> = createWriteBehind({
    adapter: almacen.adapter,
    initial: VACIO,
    schedule: reloj.schedule,
    onError: (e: StorageError): void => {
      avisos = [...avisos, e]
    },
  })
  return { ...wb, correr: reloj.correr, avisos: (): ReadonlyArray<StorageError> => avisos }
}

/** Deja correr el guardado automático y lo que encadene, sin llamar a flush a mano. */
const dejarCorrer = async (s: ConAviso): Promise<void> => {
  s.correr()
  await new Promise<void>((listo: () => void): void => {
    setImmediate(listo)
  })
}

test("onError avisa cuando el GUARDADO AUTOMÁTICO se detiene, sin que nadie llame a flush", async (): Promise<void> => {
  const lleno: StorageError = { kind: "quota-exceeded" }
  const s: ConAviso = montarConAviso((): StorageError => lleno)

  s.onState(conNota(nota("Compra")))
  await dejarCorrer(s)

  assert.equal(s.avisos().length, 1)
  assert.strictEqual(s.avisos()[0], lleno, "el error no ha llegado intacto")
})

test("onError avisa UNA sola vez: detenido, los flush siguientes no repiten el aviso", async (): Promise<void> => {
  const s: ConAviso = montarConAviso((): StorageError => ({ kind: "permission-denied" }))

  s.onState(conNota(nota("Compra")))
  errorDe(await s.flush())
  s.onState(conNota(nota("Compra del mes")))
  errorDe(await s.flush())
  errorDe(await s.flush())

  assert.equal(s.avisos().length, 1)
})

test("un fallo de io NO avisa: se reintenta, no se ha detenido nada", async (): Promise<void> => {
  const s: ConAviso = montarConAviso((): StorageError => ({ kind: "io", cause: "x" }))

  s.onState(conNota(nota("Compra")))
  errorDe(await s.flush())

  assert.deepEqual(s.avisos(), [])
})

test("si todo va bien, onError no se llama nunca", async (): Promise<void> => {
  const s: ConAviso = montarConAviso((): null => null)

  s.onState(conNota(nota("Compra")))
  await dejarCorrer(s)
  valorDe(await s.flush())

  assert.deepEqual(s.avisos(), [])
})

test("un onError que lanza no tumba al escritor: el fallo sigue saliendo por flush", async (): Promise<void> => {
  const sinPermiso: StorageError = { kind: "permission-denied" }
  const wb: ReturnType<typeof createWriteBehind> = createWriteBehind({
    adapter: fallandoAlEscribir((): StorageError => sinPermiso).adapter,
    initial: VACIO,
    schedule: relojDeMentira().schedule,
    onError: (): void => {
      throw new Error("el aviso revienta")
    },
  })

  wb.onState(conNota(nota("Compra")))

  assert.strictEqual(errorDe(await wb.flush()), sinPermiso)
})

/* ──────────────── La escritura condicional: dos pestañas ──────────────── */

/** Un almacén compartido por dos escritores, como dos pestañas sobre el mismo `localStorage`. */
const dosPestanas = (): {
  readonly almacen: StorageAdapter
  readonly crear: (onError?: (fallo: StorageError) => void) => ReturnType<typeof createWriteBehind>
} => {
  const almacen: StorageAdapter = createMemoryStorageAdapter()
  return {
    almacen,
    crear: (onError?: (fallo: StorageError) => void): ReturnType<typeof createWriteBehind> =>
      createWriteBehind({
        adapter: almacen,
        initial: conNota(nota("Compra")),
        schedule: (): (() => void) => (): void => undefined,
        onError,
      }),
  }
}

test("DOS PESTAÑAS: la segunda en guardar NO pisa a la primera, se detiene y avisa", async (): Promise<void> => {
  const { almacen, crear } = dosPestanas()
  const sembrada: Result<void, StorageError> = await almacen.notes.put(nota("Compra"), null)
  if (!sembrada.ok) assert.fail("la nota inicial tenía que guardarse")
  let avisos: ReadonlyArray<StorageError> = []
  const a = crear()
  const b = crear((fallo: StorageError): void => {
    avisos = [...avisos, fallo]
  })

  /* Las dos partieron de la misma Compra; A guarda primero. */
  a.onState(conNota(nota("De la pestaña A")))
  valorDe(await a.flush())
  b.onState(conNota(nota("De la pestaña B")))

  assert.deepEqual(errorDe(await b.flush()), { kind: "stale", id: ID_COMPRA })
  assert.equal(valorDe(await almacen.notes.get(ID_COMPRA))?.name, "De la pestaña A")
  assert.deepEqual(avisos, [{ kind: "stale", id: ID_COMPRA }])
})

test("una tanda cortada por io a mitad: al reintentar, lo ya escrito NO da un stale falso", async (): Promise<void> => {
  /* Dos notas en una tanda; la segunda falla una vez con io. Si el escritor no
     apuntara que la primera ya está en disco, al reintentar la volvería a
     escribir esperando su revisión vieja, y el almacén diría `stale`. */
  const base: StorageAdapter = createMemoryStorageAdapter()
  const OTRA = noteId("otra")
  let fallar: boolean = true
  const adapter: StorageAdapter = {
    ...base,
    notes: {
      ...base.notes,
      put: async (n: Note, esperada: ReturnType<typeof revision> | null): Promise<Result<void, StorageError>> => {
        if (n.id === OTRA && fallar) {
          fallar = false
          const tos: StorageError = { kind: "io", cause: new Error("el disco tosió") }
          return err(tos)
        }
        return base.notes.put(n, esperada)
      },
    },
  }
  const wb = createWriteBehind({
    adapter,
    initial: VACIO,
    schedule: (): (() => void) => (): void => undefined,
  })
  const otra: Note = { ...nota("Otra"), id: OTRA }

  wb.onState({ ...VACIO, notes: { [ID_COMPRA]: nota("Compra"), [OTRA]: otra } })
  assert.equal(errorDe(await wb.flush()).kind, "io")
  valorDe(await wb.flush())

  assert.equal(valorDe(await base.notes.get(ID_COMPRA))?.name, "Compra")
  assert.equal(valorDe(await base.notes.get(OTRA))?.name, "Otra")
})
