/**
 * Los encuadres de los diagramas, sobre el `Store` de verdad y un almacén falso:
 * que lo leído se valide, que se olviden los de diagramas que ya no están y que
 * sólo se escriba al guardar, y sólo si hay algo nuevo.
 */

import { test } from "node:test"
import assert from "node:assert/strict"

import type {
  Clock,
  Diagram,
  DiagramId,
  IdGenerator,
  Result,
  StorageError,
  Store,
  UseCases,
} from "#core/index"
import { createStore, createUseCases, emptyAppState, err, ok } from "#core/index"
import type { DiagramFraming, FramingPersistence, Framings } from "#ui/index"
import {
  MAX_SCALE,
  NO_FRAMINGS,
  createDiagramFraming,
  guardFramings,
  parseFramings,
} from "#ui/index"

interface Escenario {
  readonly store: Store
  readonly useCases: UseCases
  readonly creado: (nombre: string) => DiagramId
}

const escenario = (): Escenario => {
  let n: number = 0
  const clock: Clock = { now: (): number => 1000 }
  const ids: IdGenerator = { next: (): string => `id-${n++}` }
  const store: Store = createStore(emptyAppState())
  const useCases: UseCases = createUseCases({ clock, ids, store })
  const creado = (nombre: string): DiagramId => {
    const diagrama: Diagram | null = useCases.createDiagram(nombre)
    if (diagrama === null) assert.fail("el diagrama tenía que crearse")
    return diagrama.id
  }
  return { store, useCases, creado }
}

interface AlmacenFalso extends FramingPersistence {
  readonly guardados: () => ReadonlyArray<Framings>
}

const almacen = (leido: Result<unknown, StorageError> = ok(null)): AlmacenFalso => {
  let guardados: ReadonlyArray<Framings> = []
  return {
    load: (): Result<unknown, StorageError> => leido,
    save: (framings: Framings): Result<void, StorageError> => {
      guardados = [...guardados, framings]
      return ok(undefined)
    },
    guardados: (): ReadonlyArray<Framings> => guardados,
  }
}

/* ── Leer lo guardado ── */

test("lo leído con forma de encuadres entra; lo que no la tiene se descarta", (): void => {
  assert.deepEqual(
    parseFramings({
      bueno: { x: 1, y: -2, scale: 1.5 },
      sinEscala: { x: 1, y: 2 },
      texto: { x: "1", y: 2, scale: 1 },
      infinito: { x: Infinity, y: 2, scale: 1 },
      nulo: null,
    }),
    { bueno: { x: 1, y: -2, scale: 1.5 } },
  )
})

test("una escala leída fuera de los topes entra, pero en el tope", (): void => {
  assert.deepEqual(parseFramings({ d: { x: 0, y: 0, scale: 99 } }), {
    d: { x: 0, y: 0, scale: MAX_SCALE },
  })
})

test("lo que no es un objeto no trae ningún encuadre", (): void => {
  for (const raro of [null, 42, "hola", [{ x: 0, y: 0, scale: 1 }]]) {
    assert.deepEqual(parseFramings(raro), NO_FRAMINGS)
  }
})

/* ── Olvidar los diagramas que ya no están ── */

test("se olvidan los encuadres de diagramas que no están", (): void => {
  const { store, creado } = escenario()
  const plano: DiagramId = creado("Plano")
  const encuadres: Framings = {
    [plano]: { x: 1, y: 1, scale: 1 },
    borrado: { x: 2, y: 2, scale: 2 },
  }
  assert.deepEqual(guardFramings(encuadres, store.getState()), { [plano]: { x: 1, y: 1, scale: 1 } })
})

test("si no sobra ninguno, devuelve LOS MISMOS encuadres", (): void => {
  const { store, creado } = escenario()
  const encuadres: Framings = { [creado("Plano")]: { x: 1, y: 1, scale: 1 } }
  assert.strictEqual(guardFramings(encuadres, store.getState()), encuadres)
})

/* ── El modelo ── */

test("sin nada guardado, ningún diagrama tiene encuadre", (): void => {
  const { store, creado } = escenario()
  const encuadre: DiagramFraming = createDiagramFraming({ store, persistence: almacen() })
  assert.equal(encuadre.get(creado("Plano")), null)
})

test("lo guardado se lee al crearlo, sin los diagramas que ya no están", (): void => {
  const { store, creado } = escenario()
  const plano: DiagramId = creado("Plano")
  const encuadre: DiagramFraming = createDiagramFraming({
    store,
    persistence: almacen(ok({ [plano]: { x: 5, y: 6, scale: 2 }, borrado: { x: 0, y: 0, scale: 1 } })),
  })
  assert.deepEqual(encuadre.get(plano), { x: 5, y: 6, scale: 2 })
})

test("si no se puede leer, se empieza sin encuadres y sin fallar", (): void => {
  const { store, creado } = escenario()
  const encuadre: DiagramFraming = createDiagramFraming({
    store,
    persistence: almacen(err({ kind: "io", cause: "bloqueado" })),
  })
  assert.equal(encuadre.get(creado("Plano")), null)
})

test("apuntar un encuadre se ve en el momento, pero no escribe nada", (): void => {
  const { store, creado } = escenario()
  const plano: DiagramId = creado("Plano")
  const persistence: AlmacenFalso = almacen()
  const encuadre: DiagramFraming = createDiagramFraming({ store, persistence })
  encuadre.remember(plano, { x: 3, y: 4, scale: 2 })
  assert.deepEqual(encuadre.get(plano), { x: 3, y: 4, scale: 2 })
  assert.equal(persistence.guardados().length, 0)
})

test("guardar escribe lo apuntado una vez; sin nada nuevo, no vuelve a escribir", (): void => {
  const { store, creado } = escenario()
  const plano: DiagramId = creado("Plano")
  const persistence: AlmacenFalso = almacen()
  const encuadre: DiagramFraming = createDiagramFraming({ store, persistence })
  encuadre.save()
  assert.equal(persistence.guardados().length, 0)
  encuadre.remember(plano, { x: 3, y: 4, scale: 2 })
  encuadre.save()
  encuadre.save()
  assert.deepEqual(persistence.guardados(), [{ [plano]: { x: 3, y: 4, scale: 2 } }])
})

test("al guardar se olvida el encuadre de un diagrama borrado entre medias", (): void => {
  const { store, useCases, creado } = escenario()
  const plano: DiagramId = creado("Plano")
  const otro: DiagramId = creado("Otro")
  const persistence: AlmacenFalso = almacen()
  const encuadre: DiagramFraming = createDiagramFraming({ store, persistence })
  encuadre.remember(plano, { x: 1, y: 1, scale: 1 })
  encuadre.remember(otro, { x: 2, y: 2, scale: 2 })
  useCases.deleteDiagram(otro)
  encuadre.save()
  assert.deepEqual(persistence.guardados(), [{ [plano]: { x: 1, y: 1, scale: 1 } }])
  assert.equal(encuadre.get(otro), null)
})
