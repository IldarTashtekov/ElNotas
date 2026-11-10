/**
 * El botón atrás de Android: con historial, atrás; sin él, salir. Y que se
 * escucha por el puente y hace cada cosa, con un puente y una ventana de mentira.
 */

import { test } from "node:test"
import assert from "node:assert/strict"

import { escucharAtras, queHacerConAtras } from "#platform/web/atrasDeAndroid"

import { silentLogger } from "../../core/ports/FakeLogger"

test("con historial al que volver, va atrás", (): void => {
  assert.equal(queHacerConAtras(true), "ir-atras")
})

test("sin historial, sale", (): void => {
  assert.equal(queHacerConAtras(false), "salir")
})

/** Una ventana con un puente que guarda el oyente y apunta lo que se le pide. */
const conPuente = (): {
  readonly ventana: Window
  readonly pulsar: (datos: unknown) => void
  readonly hecho: () => ReadonlyArray<string>
} => {
  let oyente: ((datos: unknown) => void) | null = null
  const hecho: string[] = []
  const ventana: unknown = {
    history: { back: (): void => void hecho.push("atrás") },
    Capacitor: {
      addListener: (plugin: string, evento: string, alLlegar: (datos: unknown) => void): void => {
        hecho.push(`escucha ${plugin}.${evento}`)
        oyente = alLlegar
      },
      Plugins: {
        App: {
          minimizeApp: (): Promise<unknown> => {
            hecho.push("minimizar")
            return Promise.resolve(undefined)
          },
        },
      },
    },
  }
  return {
    ventana: ventana as Window,
    pulsar: (datos: unknown): void => oyente?.(datos),
    hecho: (): ReadonlyArray<string> => hecho,
  }
}

test("escucha el backButton del plugin App", (): void => {
  const puente: ReturnType<typeof conPuente> = conPuente()
  assert.equal(escucharAtras(puente.ventana, silentLogger), true)
  assert.deepEqual(puente.hecho(), ["escucha App.backButton"])
})

test("pulsado con historial, va atrás en la ventana", (): void => {
  const puente: ReturnType<typeof conPuente> = conPuente()
  escucharAtras(puente.ventana, silentLogger)
  puente.pulsar({ canGoBack: true })
  assert.deepEqual(puente.hecho().slice(1), ["atrás"])
})

test("pulsado sin historial, saca la app", (): void => {
  const puente: ReturnType<typeof conPuente> = conPuente()
  escucharAtras(puente.ventana, silentLogger)
  puente.pulsar({ canGoBack: false })
  assert.deepEqual(puente.hecho().slice(1), ["minimizar"])
})

test("sin puente, no escucha y lo dice", (): void => {
  assert.equal(escucharAtras({} as Window, silentLogger), false)
})

test("un aviso sin forma cuenta como sin historial: sale", (): void => {
  for (const datos of [null, undefined, {}, { canGoBack: "true" }]) {
    const puente: ReturnType<typeof conPuente> = conPuente()
    escucharAtras(puente.ventana, silentLogger)
    puente.pulsar(datos)
    assert.deepEqual(puente.hecho().slice(1), ["minimizar"])
  }
})

test("sin minimizeApp en el puente, lo registra y no lanza", (): void => {
  const fallos: string[] = []
  let oyente: ((datos: unknown) => void) | null = null
  const ventana: unknown = {
    history: { back: (): void => undefined },
    Capacitor: {
      addListener: (_plugin: string, _evento: string, alLlegar: (datos: unknown) => void): void => {
        oyente = alLlegar
      },
    },
  }
  escucharAtras(ventana as Window, { failure: (que: string): void => void fallos.push(que) })
  assert.doesNotThrow((): void => oyente?.({ canGoBack: false }))
  assert.deepEqual(fallos, ["el puente no trae minimizeApp"])
})

test("si minimizeApp falla, lo registra", async (): Promise<void> => {
  const fallos: string[] = []
  let oyente: ((datos: unknown) => void) | null = null
  const ventana: unknown = {
    history: { back: (): void => undefined },
    Capacitor: {
      addListener: (_plugin: string, _evento: string, alLlegar: (datos: unknown) => void): void => {
        oyente = alLlegar
      },
      Plugins: { App: { minimizeApp: (): Promise<unknown> => Promise.reject(new Error("no")) } },
    },
  }
  escucharAtras(ventana as Window, { failure: (que: string): void => void fallos.push(que) })
  /* Dentro de una función: fuera, TypeScript da `oyente` por `null` para siempre. */
  const pulsar: () => void = (): void => oyente?.({ canGoBack: false })
  pulsar()
  await new Promise<void>((listo: () => void): void => void setTimeout(listo, 0))
  assert.deepEqual(fallos, ["no se pudo sacar la app"])
})

test("si escuchar lanza, lo registra y dice que no", (): void => {
  const fallos: string[] = []
  const ventana: unknown = {
    Capacitor: {
      addListener: (): void => {
        throw new Error("no")
      },
    },
  }
  assert.equal(escucharAtras(ventana as Window, { failure: (que: string): void => void fallos.push(que) }), false)
  assert.deepEqual(fallos, ["no se pudo escuchar el botón atrás"])
})
