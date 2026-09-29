/**
 * La lista de ventanas viva, sobre el `Store` de verdad y un almacén falso de dos
 * líneas: que la guarda corra en cada cambio y que sólo se guarde cuando cambia.
 */

import { test } from "node:test"
import assert from "node:assert/strict"

import type {
  Clock,
  Context,
  ContextId,
  IdGenerator,
  Result,
  StorageError,
  Store,
  UseCases,
} from "#core/index"
import { createStore, createUseCases, emptyAppState, err, ok } from "#core/index"
import type { WindowRef, WindowsLayout, WindowsModel, WindowsPersistence } from "#ui/index"
import { DEFAULT_LAYOUT, GENERAL, createWindowsModel } from "#ui/index"

interface Escenario {
  readonly store: Store
  readonly useCases: UseCases
  readonly creado: (nombre: string) => ContextId
}

const escenario = (): Escenario => {
  let n: number = 0
  const clock: Clock = { now: (): number => 1000 }
  const ids: IdGenerator = { next: (): string => `id-${n++}` }
  const store: Store = createStore(emptyAppState())
  const useCases: UseCases = createUseCases({ clock, ids, store })
  const creado = (nombre: string): ContextId => {
    const ctx: Context | null = useCases.createContext(nombre)
    if (ctx === null) assert.fail("el contexto tenía que crearse")
    return ctx.id
  }
  return { store, useCases, creado }
}

interface AlmacenFalso extends WindowsPersistence {
  readonly guardados: () => ReadonlyArray<WindowsLayout>
}

const almacen = (leido: Result<unknown, StorageError> = ok(null)): AlmacenFalso => {
  let guardados: ReadonlyArray<WindowsLayout> = []
  return {
    load: (): Result<unknown, StorageError> => leido,
    save: (layout: WindowsLayout): Result<void, StorageError> => {
      guardados = [...guardados, layout]
      return ok(undefined)
    },
    guardados: (): ReadonlyArray<WindowsLayout> => guardados,
  }
}

const ventana = (id: ContextId): WindowRef => ({ kind: "context", id })

test("sin nada guardado, empieza con el General y no escribe", (): void => {
  const { store } = escenario()
  const guardado: AlmacenFalso = almacen()
  const model: WindowsModel = createWindowsModel({ store, persistence: guardado })

  assert.strictEqual(model.getLayout(), DEFAULT_LAYOUT)
  assert.deepEqual(guardado.guardados(), [])
})

test("si no se puede leer, empieza con el General", (): void => {
  const { store } = escenario()
  const model: WindowsModel = createWindowsModel({
    store,
    persistence: almacen(err({ kind: "io", cause: "x" })),
  })
  assert.strictEqual(model.getLayout(), DEFAULT_LAYOUT)
})

test("borrar un contexto que es ventana la quita EN LA MISMA SESIÓN, y se guarda", (): void => {
  const { store, useCases, creado } = escenario()
  const casa: ContextId = creado("Casa")
  const guardado: AlmacenFalso = almacen(ok({ windows: [ventana(casa), GENERAL], active: ventana(casa) }))
  const model: WindowsModel = createWindowsModel({ store, persistence: guardado })

  let avisos: number = 0
  model.subscribe((): void => {
    avisos += 1
  })
  useCases.deleteContext(casa)

  assert.deepEqual(model.getLayout(), { windows: [GENERAL], active: GENERAL })
  assert.equal(avisos, 1)
  assert.deepEqual(guardado.guardados(), [{ windows: [GENERAL], active: GENERAL }])
})

test("un cambio que no toca ninguna ventana ni avisa ni escribe", (): void => {
  const { store, useCases, creado } = escenario()
  const casa: ContextId = creado("Casa")
  const guardado: AlmacenFalso = almacen(ok({ windows: [ventana(casa)], active: ventana(casa) }))
  const model: WindowsModel = createWindowsModel({ store, persistence: guardado })
  const antes: WindowsLayout = model.getLayout()

  let avisos: number = 0
  model.subscribe((): void => {
    avisos += 1
  })
  useCases.renameContext(casa, "Hogar")
  creado("Trabajo")

  assert.strictEqual(model.getLayout(), antes)
  assert.equal(avisos, 0)
  assert.deepEqual(guardado.guardados(), [])
})

test("lo leído con referencias rotas se limpia también en el almacén al arrancar", (): void => {
  const { store } = escenario()
  const guardado: AlmacenFalso = almacen(
    ok({ windows: [{ kind: "context", id: "borrado" }, GENERAL], active: GENERAL }),
  )
  createWindowsModel({ store, persistence: guardado })

  assert.deepEqual(guardado.guardados(), [{ windows: [GENERAL], active: GENERAL }])
})

test("setActive cambia la activa y la guarda", (): void => {
  const { store, creado } = escenario()
  const casa: ContextId = creado("Casa")
  const guardado: AlmacenFalso = almacen(ok({ windows: [GENERAL, ventana(casa)], active: GENERAL }))
  const model: WindowsModel = createWindowsModel({ store, persistence: guardado })

  model.setActive(ventana(casa))

  assert.deepEqual(model.getLayout().active, ventana(casa))
  assert.deepEqual(guardado.guardados(), [{ windows: [GENERAL, ventana(casa)], active: ventana(casa) }])
})

test("setActive a la que ya es activa, o a una que no está, no hace nada", (): void => {
  const { store, creado } = escenario()
  const casa: ContextId = creado("Casa")
  const guardado: AlmacenFalso = almacen(ok({ windows: [GENERAL], active: GENERAL }))
  const model: WindowsModel = createWindowsModel({ store, persistence: guardado })
  const antes: WindowsLayout = model.getLayout()

  model.setActive(GENERAL)
  model.setActive(ventana(casa)) // existe, pero no es ventana

  assert.strictEqual(model.getLayout(), antes)
  assert.deepEqual(guardado.guardados(), [])
})
