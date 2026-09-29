/**
 * La reconciliación por clave, con un contenedor falso sobre un array: que las
 * filas que siguen sean LAS MISMAS —`strictEqual`—, en su orden, y que sólo se
 * cree lo nuevo y se quite lo que sobra.
 */

import { test } from "node:test"
import assert from "node:assert/strict"

import type { KeyedContainer, ReconcileSteps } from "#ui/index"
import { reconcile } from "#ui/index"

interface Fila {
  readonly clave: string
  texto: string
}

interface Item {
  readonly id: string
  readonly nombre: string
}

/** Un contenedor de mentira que se comporta como el DOM al mover un hijo. */
interface Falso extends KeyedContainer<Fila> {
  readonly hijos: () => ReadonlyArray<Fila>
  readonly movimientos: () => number
}

const contenedor = (): Falso => {
  let hijos: ReadonlyArray<Fila> = []
  let movimientos: number = 0
  return {
    get children(): ArrayLike<Fila> {
      return hijos
    },
    insertBefore: (nuevo: Fila, referencia: Fila | null): void => {
      movimientos += 1
      const sin: ReadonlyArray<Fila> = hijos.filter((f: Fila): boolean => f !== nuevo)
      const i: number = referencia === null ? sin.length : sin.indexOf(referencia)
      hijos = [...sin.slice(0, i), nuevo, ...sin.slice(i)]
    },
    removeChild: (hijo: Fila): void => {
      hijos = hijos.filter((f: Fila): boolean => f !== hijo)
    },
    hijos: (): ReadonlyArray<Fila> => hijos,
    movimientos: (): number => movimientos,
  }
}

interface Cuenta {
  readonly pasos: ReconcileSteps<Item, Fila>
  readonly creadas: () => number
}

const pasos = (): Cuenta => {
  let creadas: number = 0
  return {
    pasos: {
      key: (item: Item): string => item.id,
      keyOf: (fila: Fila): string | null => fila.clave,
      create: (item: Item): Fila => {
        creadas += 1
        return { clave: item.id, texto: "" }
      },
      update: (fila: Fila, item: Item): void => {
        fila.texto = item.nombre
      },
    },
    creadas: (): number => creadas,
  }
}

const item = (id: string, nombre: string = id): Item => ({ id, nombre })
const textos = (c: Falso): ReadonlyArray<string> => c.hijos().map((f: Fila): string => f.texto)

test("la primera vez crea una fila por dato, en orden", (): void => {
  const c: Falso = contenedor()
  const cuenta: Cuenta = pasos()
  reconcile(c, [item("a"), item("b"), item("c")], cuenta.pasos)

  assert.deepEqual(textos(c), ["a", "b", "c"])
  assert.equal(cuenta.creadas(), 3)
})

test("con los mismos datos no crea ni mueve nada: son LAS MISMAS filas", (): void => {
  const c: Falso = contenedor()
  const cuenta: Cuenta = pasos()
  reconcile(c, [item("a"), item("b")], cuenta.pasos)
  const [a, b] = c.hijos()
  const movidas: number = c.movimientos()

  reconcile(c, [item("a"), item("b")], cuenta.pasos)

  assert.strictEqual(c.hijos()[0], a)
  assert.strictEqual(c.hijos()[1], b)
  assert.equal(cuenta.creadas(), 2)
  assert.equal(c.movimientos(), movidas)
})

test("renombrar uno actualiza ESA fila y no recrea ninguna", (): void => {
  const c: Falso = contenedor()
  const cuenta: Cuenta = pasos()
  reconcile(c, [item("a"), item("b")], cuenta.pasos)
  const [a, b] = c.hijos()

  reconcile(c, [item("a", "Casa"), item("b")], cuenta.pasos)

  assert.strictEqual(c.hijos()[0], a)
  assert.strictEqual(c.hijos()[1], b)
  assert.deepEqual(textos(c), ["Casa", "b"])
  assert.equal(cuenta.creadas(), 2)
})

test("uno nuevo en medio se crea sólo él, y los demás siguen siendo los mismos", (): void => {
  const c: Falso = contenedor()
  const cuenta: Cuenta = pasos()
  reconcile(c, [item("a"), item("c")], cuenta.pasos)
  const [a, cc] = c.hijos()

  reconcile(c, [item("a"), item("b"), item("c")], cuenta.pasos)

  assert.deepEqual(textos(c), ["a", "b", "c"])
  assert.strictEqual(c.hijos()[0], a)
  assert.strictEqual(c.hijos()[2], cc)
  assert.equal(cuenta.creadas(), 3)
})

test("lo que sobra se quita, y lo que queda es lo mismo", (): void => {
  const c: Falso = contenedor()
  const cuenta: Cuenta = pasos()
  reconcile(c, [item("a"), item("b"), item("c")], cuenta.pasos)
  const cc: Fila | undefined = c.hijos()[2]

  reconcile(c, [item("c")], cuenta.pasos)

  assert.equal(c.hijos().length, 1)
  assert.strictEqual(c.hijos()[0], cc)
})

test("reordenar mueve las filas que ya había, sin crear ninguna", (): void => {
  const c: Falso = contenedor()
  const cuenta: Cuenta = pasos()
  reconcile(c, [item("a"), item("b"), item("c")], cuenta.pasos)
  const [a, b, cc] = c.hijos()

  reconcile(c, [item("c"), item("a"), item("b")], cuenta.pasos)

  assert.strictEqual(c.hijos()[0], cc)
  assert.strictEqual(c.hijos()[1], a)
  assert.strictEqual(c.hijos()[2], b)
  assert.equal(cuenta.creadas(), 3)
})

test("una lista vacía quita todo", (): void => {
  const c: Falso = contenedor()
  const cuenta: Cuenta = pasos()
  reconcile(c, [item("a"), item("b")], cuenta.pasos)
  reconcile(c, [], cuenta.pasos)
  assert.deepEqual(c.hijos(), [])
})
