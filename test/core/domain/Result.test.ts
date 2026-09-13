/**
 * `Result<T, E>`.
 *
 * Lo más valioso de este tipo —que leer `r.value` sin comprobar `r.ok` no
 * compile— no se puede probar en runtime: eso lo verifica `npm run typecheck`,
 * que es donde ocurre. Aquí queda lo que sí se puede romper en silencio: que los
 * constructores envuelvan el valor **intacto** en vez de una copia.
 */

import { test } from "node:test"
import assert from "node:assert/strict"

import type { Result } from "#core/domain/Result"
import { err, ok } from "#core/domain/Result"

test("ok envuelve el valor y lo estrecha al comprobarlo", () => {
  const r: Result<number, string> = ok(42)

  assert.equal(r.ok, true)
  // Sin este `if` la línea de dentro no compilaría: ésa es toda la fuerza del tipo.
  if (r.ok) {
    assert.equal(r.value, 42)
  }
})

test("err envuelve el error y NO trae valor", () => {
  const r: Result<number, string> = err("no se pudo")

  assert.equal(r.ok, false)
  if (!r.ok) {
    assert.equal(r.error, "no se pudo")
  }
})

test("ok devuelve el MISMO objeto que se le dio, no una copia", () => {
  /*
      ⚠️ Identidad, con `strictEqual` y no `deepEqual`. Un almacén que devolviera
      copias rompería el diff por referencia del write-behind (§3): todo lo leído
      parecería sucio. El envoltorio no puede ser quien introduzca la copia.
  */
  const nota: { readonly id: string } = { id: "compra" }
  const r: Result<{ readonly id: string }, never> = ok(nota)

  assert.equal(r.ok, true)
  if (r.ok) {
    assert.strictEqual(r.value, nota)
  }
})

test("err devuelve el MISMO error que se le dio, no una copia", () => {
  /* Mismo motivo, y además `cause` es para depurar: copiarlo la perdería. */
  const fallo: { readonly kind: string } = { kind: "io" }
  const r: Result<never, { readonly kind: string }> = err(fallo)

  assert.equal(r.ok, false)
  if (!r.ok) {
    assert.strictEqual(r.error, fallo)
  }
})

test("ok(null) es un resultado correcto: ausencia no es fallo", () => {
  /*
      El caso que sostiene todo el contrato de `Repository.get`: preguntar por
      algo que no está guardado devuelve `ok(null)`, no un error.
  */
  const r: Result<string | null, string> = ok(null)

  assert.equal(r.ok, true)
  if (r.ok) {
    assert.strictEqual(r.value, null)
  }
})
