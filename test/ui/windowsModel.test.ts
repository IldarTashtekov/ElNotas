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
  Note,
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

/* ─────────────────── Las ediciones, pasando por la guarda ───────────────── */

test("quitar la ventana activa pasa la activa a la primera que quede", (): void => {
  const { store, creado } = escenario()
  const casa: ContextId = creado("Casa")
  const model: WindowsModel = createWindowsModel({
    store,
    persistence: almacen(ok({ windows: [GENERAL, ventana(casa)], active: ventana(casa) })),
  })

  model.removeAt(1)

  assert.deepEqual(model.getLayout(), { windows: [GENERAL], active: GENERAL })
})

test("quitar la última deja la pantalla vacía, y se permite", (): void => {
  const { store } = escenario()
  const model: WindowsModel = createWindowsModel({ store, persistence: almacen() })
  model.removeAt(0)
  assert.deepEqual(model.getLayout(), { windows: [], active: null })
})

test("añadir la primera a una lista vacía la deja activa", (): void => {
  const { store, creado } = escenario()
  const casa: ContextId = creado("Casa")
  const model: WindowsModel = createWindowsModel({
    store,
    persistence: almacen(ok({ windows: [], active: null })),
  })

  model.insertAfter(-1, ventana(casa))

  assert.deepEqual(model.getLayout(), { windows: [ventana(casa)], active: ventana(casa) })
})

test("una edición que apunta a un contexto inexistente no hace nada, ni guarda", (): void => {
  const { store } = escenario()
  const guardado: AlmacenFalso = almacen()
  const model: WindowsModel = createWindowsModel({ store, persistence: guardado })
  const antes: WindowsLayout = model.getLayout()

  model.insertAfter(0, { kind: "context", id: "no-existe" as ContextId })

  assert.strictEqual(model.getLayout(), antes)
  assert.deepEqual(guardado.guardados(), [])
})

test("con Casa en las dos ventanas, borrar Casa deja la pantalla vacía", (): void => {
  const { store, useCases, creado } = escenario()
  const casa: ContextId = creado("Casa")
  const model: WindowsModel = createWindowsModel({ store, persistence: almacen() })

  model.insertAfter(0, ventana(casa))
  model.replaceAt(0, ventana(casa)) // el General pasa a enseñar Casa: dos ventanas de Casa
  assert.deepEqual(model.getLayout().windows, [ventana(casa), ventana(casa)])

  useCases.deleteContext(casa)
  assert.deepEqual(model.getLayout(), { windows: [], active: null })
})

test("borrar desde el General una nota que es ventana la quita EN LA MISMA SESIÓN", (): void => {
  const { store, useCases } = escenario()
  const nota: Note | null = useCases.createNote("Lista")
  if (nota === null) assert.fail("la nota tenía que crearse")
  const deNota: WindowRef = { kind: "note", id: nota.id }
  const model: WindowsModel = createWindowsModel({
    store,
    persistence: almacen(ok({ windows: [GENERAL, deNota], active: deNota })),
  })
  assert.deepEqual(model.getLayout().windows, [GENERAL, deNota])

  useCases.deleteNote(nota.id)

  assert.deepEqual(model.getLayout(), { windows: [GENERAL], active: GENERAL })
})

test("move reordena y lo guarda; al mismo sitio, ni avisa ni escribe", (): void => {
  const { store, creado } = escenario()
  const casa: ContextId = creado("Casa")
  const obra: ContextId = creado("Obra")
  const persistence: AlmacenFalso = almacen(ok({ windows: [GENERAL, ventana(casa), ventana(obra)], active: GENERAL }))
  const model: WindowsModel = createWindowsModel({ store, persistence })
  const antes: WindowsLayout = model.getLayout()

  model.move(1, 1)
  assert.strictEqual(model.getLayout(), antes)
  assert.equal(persistence.guardados().length, 0)

  model.move(2, 0)
  assert.deepEqual(model.getLayout().windows, [ventana(obra), GENERAL, ventana(casa)])
  assert.deepEqual(model.getLayout().active, GENERAL)
  assert.equal(persistence.guardados().length, 1)
})
