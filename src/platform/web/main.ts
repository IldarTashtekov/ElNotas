/**
 * La entrada de la app en el navegador: la carga `index.html`.
 *
 * Decide lo que en web es cada pieza —el reloj del sistema, los ids del azar del
 * navegador, las notas y las ventanas en `localStorage`—, arranca y monta la
 * vista ventanas. Si no
 * arranca, lo dice en pantalla en vez de quedarse en blanco.
 */

import type { Result, StorageError } from "#core/index"
import { createLocalStorageBlobStore } from "#storage/index"
import type { WindowsModel } from "#ui/index"
import { createWindowsModel, describeBootError, mountWindowsView } from "#ui/index"
import type { App, BootError } from "./boot.js"
import { boot } from "./boot.js"
import { createCryptoIdGenerator } from "./CryptoIdGenerator.js"
import { createLocalStorageWindows } from "./LocalStorageWindows.js"
import { systemClock } from "./SystemClock.js"

/** `window.localStorage` LANZA si el navegador tiene bloqueados los datos del sitio. */
const localStorageDisponible = (): Storage | null => {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

const mostrarFallo = (raiz: HTMLElement, mensaje: string): void => {
  const aviso: HTMLParagraphElement = document.createElement("p")
  aviso.className = "aviso"
  aviso.setAttribute("role", "alert")
  aviso.textContent = mensaje
  raiz.replaceChildren(aviso)
}

const iniciar = async (): Promise<void> => {
  const raiz: HTMLElement | null = document.getElementById("app")
  if (raiz === null) return

  const almacen: Storage | null = localStorageDisponible()
  if (almacen === null) {
    mostrarFallo(raiz, describeBootError({ kind: "permission-denied" }))
    return
  }

  let ilegibles: ReadonlyArray<StorageError> = []
  const arrancada: Result<App, BootError> = await boot({
    blobs: createLocalStorageBlobStore(almacen),
    clock: systemClock,
    ids: createCryptoIdGenerator(window.crypto),
    onCorrupt: (fallo: StorageError): void => {
      ilegibles = [...ilegibles, fallo]
    },
  })
  if (!arrancada.ok) {
    mostrarFallo(raiz, describeBootError(arrancada.error))
    return
  }

  const app: App = arrancada.value
  const windows: WindowsModel = createWindowsModel({
    store: app.store,
    persistence: createLocalStorageWindows(almacen),
  })
  mountWindowsView(raiz, { store: app.store, useCases: app.useCases, windows, corrupt: ilegibles })

  /* Lo pendiente se escribe al salir. En el móvil `pagehide` no siempre llega,
     y pasar a segundo plano es la última ocasión segura. */
  window.addEventListener("pagehide", (): void => void app.flush())
  document.addEventListener("visibilitychange", (): void => {
    if (document.visibilityState === "hidden") void app.flush()
  })
}

void iniciar()
