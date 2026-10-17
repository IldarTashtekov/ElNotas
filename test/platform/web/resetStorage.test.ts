/**
 * Borrar todo lo de la app en `localStorage`, en sus dos tiempos: apuntarlo y,
 * al arrancar, hacerlo. Contra el `localStorage` de mentira, que sabe lanzar.
 */

import { test } from "node:test"
import assert from "node:assert/strict"

import { RESET_KEY, requestReset, resetIfRequested } from "#platform/web/resetStorage"

import type { FakeStorage } from "../../storage/blobs/FakeStorage"
import { createFakeStorage } from "../../storage/blobs/FakeStorage"

/** Un almacén con lo de la app —notas, manifiesto y ventanas— y algo ajeno. */
const conDatos = (): FakeStorage => {
  const almacen: FakeStorage = createFakeStorage()
  almacen.setItem("elnotas:blob:notes/compra.json", "x")
  almacen.setItem("elnotas:blob:manifest.json", "x")
  almacen.setItem("elnotas:windows", "x")
  almacen.setItem("otra-app:cosa", "x")
  return almacen
}

test("sin pedirlo, arrancar no borra nada", (): void => {
  const almacen: FakeStorage = conDatos()
  assert.equal(resetIfRequested(almacen), false)
  assert.equal(almacen.claves().length, 4)
})

test("pedido, al arrancar borra TODO lo de la app, la marca incluida", (): void => {
  const almacen: FakeStorage = conDatos()
  assert.equal(requestReset(almacen), true)
  assert.equal(almacen.getItem(RESET_KEY), "1")
  assert.equal(resetIfRequested(almacen), true)
  assert.deepEqual(almacen.claves(), ["otra-app:cosa"])
})

test("lo que se escriba entre pedirlo y arrancar también se borra", (): void => {
  /* Es la razón de los dos tiempos: el guardado de salida escribe tras el botón. */
  const almacen: FakeStorage = conDatos()
  requestReset(almacen)
  almacen.setItem("elnotas:blob:notes/escrita-al-salir.json", "x")
  resetIfRequested(almacen)
  assert.deepEqual(almacen.claves(), ["otra-app:cosa"])
})

test("lo que no es de la app no se toca", (): void => {
  const almacen: FakeStorage = conDatos()
  requestReset(almacen)
  resetIfRequested(almacen)
  assert.equal(almacen.getItem("otra-app:cosa"), "x")
})

test("si no se puede apuntar, lo dice y no lanza", (): void => {
  const almacen: FakeStorage = conDatos()
  almacen.lanzarEn("setItem", new Error("cuota"))
  assert.equal(requestReset(almacen), false)
  assert.equal(almacen.getItem(RESET_KEY), null)
})

test("si falla a medias, no lanza y la marca sigue: el próximo arranque lo reintenta", (): void => {
  const almacen: FakeStorage = conDatos()
  requestReset(almacen)
  almacen.lanzarEn("removeItem", new Error("bloqueado"))
  assert.equal(resetIfRequested(almacen), false)
  assert.equal(almacen.getItem(RESET_KEY), "1")
  assert.equal(resetIfRequested(almacen), true)
  assert.deepEqual(almacen.claves(), ["otra-app:cosa"])
})

test("si leer la marca lanza, arrancar sigue sin borrar nada", (): void => {
  const almacen: FakeStorage = conDatos()
  requestReset(almacen)
  almacen.lanzarEn("getItem", new Error("bloqueado"))
  assert.equal(resetIfRequested(almacen), false)
  assert.equal(almacen.claves().length, 5)
})

/** El mismo almacén, pero su `removeItem` número `n` lanza. */
const fallaElBorrado = (almacen: FakeStorage, n: number): Storage => {
  let llamadas: number = 0
  return {
    get length(): number {
      return almacen.length
    },
    clear: (): void => almacen.clear(),
    getItem: (clave: string): string | null => almacen.getItem(clave),
    key: (i: number): string | null => almacen.key(i),
    setItem: (clave: string, valor: string): void => almacen.setItem(clave, valor),
    removeItem: (clave: string): void => {
      llamadas += 1
      if (llamadas === n) throw new Error("bloqueado")
      almacen.removeItem(clave)
    },
  }
}

test("la marca se quita la ÚLTIMA: si falla un borrado de en medio, sigue puesta", (): void => {
  const almacen: FakeStorage = conDatos()
  requestReset(almacen)
  assert.equal(resetIfRequested(fallaElBorrado(almacen, 2)), false)
  assert.equal(almacen.getItem(RESET_KEY), "1")
})
