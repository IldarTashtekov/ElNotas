/**
 * Si la página corre dentro de la app de Android: lo dice el puente de
 * Capacitor, y sólo cuando dice que es una plataforma nativa.
 */

import { test } from "node:test"
import assert from "node:assert/strict"

import { dentroDeLaApp } from "#platform/web/dentroDeLaApp"

test("con el puente diciendo que es nativa, está dentro de la app", (): void => {
  assert.equal(dentroDeLaApp({ Capacitor: { isNativePlatform: (): boolean => true } }), true)
})

test("en un navegador, sin puente, no", (): void => {
  assert.equal(dentroDeLaApp({}), false)
})

test("con un puente que dice que no es nativa, no", (): void => {
  assert.equal(dentroDeLaApp({ Capacitor: { isNativePlatform: (): boolean => false } }), false)
})

test("con un puente sin la pregunta, no", (): void => {
  assert.equal(dentroDeLaApp({ Capacitor: {} }), false)
})
