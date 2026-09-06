/**
 * Puerto del reloj.
 *
 * Un **puerto** es una interfaz que dice *qué* hace falta sin decir *cómo* se
 * consigue: el core la declara, y alguien de fuera la cumple (`ARCHITECTURE.md`
 * §4). La dependencia va siempre de fuera hacia dentro.
 *
 * ── Por qué la hora es plataforma ──────────────────────────────────────────
 *
 * `Date.now()` no es una función, es **una lectura del mundo**: llamarla dos
 * veces da dos resultados distintos. En cuanto una operación depende de ella deja
 * de ser comprobable, porque no se puede escribir una prueba que diga "y entonces
 * `updatedAt` vale exactamente esto".
 *
 * Con el puerto, una prueba se fabrica su propio reloj en una línea y sabe
 * exactamente qué esperar:
 *
 *     const clock: Clock = { now: () => 1000 }
 *
 * ⚠️ **A este puerto no lo protege el compilador**, a diferencia de
 * `IdGenerator`. `Date.now()` vive en `lib.es5.d.ts`, dentro de `lib: ["ES2020"]`,
 * así que **sí compila** dentro del core. Lo que lo protege es la comprobación de
 * `npm run check` que caza `Date.now()` en `src/core` — y si esa comprobación no
 * existe todavía, sólo lo protege la convención.
 *
 * No hay implementación en el repo, y es a propósito: viviría en `src/platform/`,
 * que no nace hasta la Fase 4. Aquí no se construye lo que no tiene consumidor.
 */
export interface Clock {
  /** Milisegundos desde 1970, el mismo formato que `Versioned.updatedAt`. */
  readonly now: () => number
}
