/**
 * El botón atrás de Android, dentro de la app: hace lo mismo que el atrás del
 * navegador, cerrar lo de encima paso a paso, y sin nada encima saca la app de
 * la pantalla, como cualquier app de Android.
 *
 * Sin nadie que lo escuche, Capacitor va atrás si puede pero, sin historial, no
 * hace nada; por eso se escucha aquí, por el puente.
 */

import type { Logger } from "#core/index"

export type Atras = "ir-atras" | "salir"

/** Con historial al que volver, se va atrás; sin él, se sale. */
export const queHacerConAtras = (puedeIrAtras: boolean): Atras => (puedeIrAtras ? "ir-atras" : "salir")

type MetodoDePlugin = (opciones: object) => Promise<unknown>

/** Lo que usa del puente de la app; TypeScript no lo trae. */
interface ConPuente {
  readonly Capacitor?: {
    readonly addListener?: (plugin: string, evento: string, alLlegar: (datos: unknown) => void) => unknown
    readonly Plugins?: { readonly App?: { readonly minimizeApp?: MetodoDePlugin } }
  }
}

/** Lo que trae el aviso: si el visor tiene adónde volver. */
const puedeIrAtras = (datos: unknown): boolean =>
  typeof datos === "object" && datos !== null && (datos as { readonly canGoBack?: unknown }).canGoBack === true

/** Empieza a escuchar el botón atrás. `false` si el puente no deja. */
export const escucharAtras = (ventana: Window, logger: Logger): boolean => {
  const capacitor: ConPuente["Capacitor"] = (ventana as unknown as ConPuente).Capacitor
  const escuchar: ((plugin: string, evento: string, alLlegar: (datos: unknown) => void) => unknown) | undefined =
    capacitor?.addListener
  if (escuchar === undefined) return false
  try {
    escuchar("App", "backButton", (datos: unknown): void => {
      if (queHacerConAtras(puedeIrAtras(datos)) === "ir-atras") {
        ventana.history.back()
        return
      }
      const minimizar: MetodoDePlugin | undefined = capacitor?.Plugins?.App?.minimizeApp
      if (minimizar === undefined) return logger.failure("el puente no trae minimizeApp", null)
      try {
        minimizar({}).catch((fallo: unknown): void => logger.failure("no se pudo sacar la app", fallo))
      } catch (fallo: unknown) {
        logger.failure("no se pudo sacar la app", fallo)
      }
    })
    return true
  } catch (fallo: unknown) {
    logger.failure("no se pudo escuchar el botón atrás", fallo)
    return false
  }
}
