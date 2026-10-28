/**
 * La entrada de la app en el navegador: la carga `index.html`.
 *
 * Decide lo que en web es cada pieza —el reloj del sistema, los ids del azar del
 * navegador, las notas, las ventanas, el color de la pantalla, dónde se miraba
 * cada diagrama y lo abierto encima de la ventana en `localStorage`—,
 * termina una importación pedida, arranca y monta la app, con la copia de
 * seguridad en la configuración. Si no arranca, lo dice en pantalla en vez de
 * quedarse en blanco.
 */

import type { BlobStore, IdGenerator, Result, StorageError } from "#core/index"
import { createLocalStorageBlobStore } from "#storage/index"
import type {
  BackupActions,
  DiagramFraming,
  ExportResult,
  ImportPreparation,
  MountedApp,
  Phosphor,
  PhosphorSetting,
  WindowsModel,
} from "#ui/index"
import {
  createDiagramFraming,
  createPhosphorSetting,
  createWindowsModel,
  describeBootError,
  describeImportFailure,
  mountApp,
} from "#ui/index"
import type { App, BootError } from "./boot.js"
import { boot } from "./boot.js"
import { consoleLogger } from "./ConsoleLogger.js"
import { createCryptoIdGenerator } from "./CryptoIdGenerator.js"
import { exportBackup } from "./exportBackup.js"
import type { ImportAtBoot } from "./importStorage.js"
import { cancelImport, importIfRequested } from "./importStorage.js"
import { createLocalStorageCalendarOrder } from "./LocalStorageCalendarOrder.js"
import { createLocalStorageFraming } from "./LocalStorageFraming.js"
import { createLocalStorageOpenLayers } from "./LocalStorageOpenLayers.js"
import { createLocalStoragePhosphor } from "./LocalStoragePhosphor.js"
import { createLocalStorageWindows } from "./LocalStorageWindows.js"
import { prepareImport } from "./prepareImport.js"
import { requestReset, resetIfRequested } from "./resetStorage.js"
import { chooseFileDestination } from "./saveFile.js"
import { systemClock } from "./SystemClock.js"

/** `window.localStorage` LANZA si el navegador tiene bloqueados los datos del sitio. */
const localStorageDisponible = (): Storage | null => {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

/** La versión que escribe el script que arma la carpeta publicada; en desarrollo no hay. */
const versionPublicada = (): string | null =>
  document.querySelector('meta[name="elnotas-version"]')?.getAttribute("content") ?? null

/**
 * Pide que el navegador no borre los datos por su cuenta cuando falte espacio. La
 * respuesta no cambia nada. Sin HTTPS (la red de casa) `navigator.storage` no
 * existe, y entonces no se pide.
 */
const pedirPersistencia = (): void => {
  navigator.storage
    ?.persist()
    .catch((fallo: unknown): void => consoleLogger.failure("no se pudo pedir que no se borren los datos", fallo))
}

const mostrarFallo =(raiz: HTMLElement, mensaje: string): void => {
  const aviso: HTMLParagraphElement = document.createElement("p")
  aviso.className = "aviso"
  aviso.setAttribute("role", "alert")
  aviso.textContent = mensaje
  raiz.replaceChildren(aviso)
}

/**
 * Una importación que se quedó a medias: lo de antes ya no está, así que la app no
 * arranca, para que nada de lo que se edite se pierda en el siguiente intento.
 * Recargar lo reintenta; abandonar arranca con lo que haya entrado.
 */
const mostrarImportacionSinTerminar = (raiz: HTMLElement, almacen: Storage, fallo: StorageError): void => {
  const boton = (texto: string, clase: string, alPulsar: () => void): HTMLButtonElement => {
    const b: HTMLButtonElement = document.createElement("button")
    b.type = "button"
    b.className = clase
    b.textContent = texto
    b.addEventListener("click", alPulsar)
    return b
  }
  const texto: HTMLParagraphElement = document.createElement("p")
  texto.textContent = describeImportFailure(fallo)
  const aviso: HTMLElement = document.createElement("div")
  aviso.className = "aviso importacion-sin-terminar"
  aviso.setAttribute("role", "alert")
  aviso.append(
    texto,
    boton("Reintentar", "recargar", (): void => window.location.reload()),
    boton("Abandonar la importación", "abandonar", (): void => {
      if (cancelImport(almacen)) window.location.reload()
    }),
  )
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

  /* Si se pidió importar una copia, antes que nada: sustituye lo guardado por ella. */
  const importada: ImportAtBoot = await importIfRequested(almacen)
  if (importada.kind === "failed") {
    mostrarImportacionSinTerminar(raiz, almacen, importada.error)
    return
  }

  /* Si se pidió «Borrar todo», es aquí, antes de leer nada: así también se va lo
     que el guardado escribió al salir de la página. */
  resetIfRequested(almacen)
  pedirPersistencia()

  /* El color, antes de arrancar: así lo que se pinte mientras tanto ya sale con él. */
  const phosphor: PhosphorSetting = createPhosphorSetting({
    persistence: createLocalStoragePhosphor(almacen),
    logger: consoleLogger,
    apply: (elegido: Phosphor): void => {
      document.documentElement.dataset["phosphor"] = elegido
    },
  })

  /* El guardado puede detenerse antes de que haya UI a la que avisar: se guarda
     el fallo y se enseña al montarla. */
  let sinGuardar: StorageError | null = null
  let avisarDeGuardado: (fallo: StorageError) => void = (fallo: StorageError): void => {
    sinGuardar = fallo
  }
  const blobs: BlobStore = createLocalStorageBlobStore(almacen)
  const ids: IdGenerator = createCryptoIdGenerator(window.crypto)
  const arrancada: Result<App, BootError> = await boot({
    blobs,
    clock: systemClock,
    ids,
    logger: consoleLogger,
    skipCorrupt: true,
    onError: (fallo: StorageError): void => avisarDeGuardado(fallo),
  })
  if (!arrancada.ok) {
    mostrarFallo(raiz, describeBootError(arrancada.error))
    return
  }

  const app: App = arrancada.value
  /* Sólo con `?depurar` en la dirección: deja el estado a mano en la consola,
     para las comprobaciones de la lista manual. Sin él, no existe. */
  if (new URLSearchParams(window.location.search).has("depurar")) {
    Object.assign(window, { elnotas: { store: app.store, useCases: app.useCases } })
  }
  const windows: WindowsModel = createWindowsModel({
    store: app.store,
    persistence: createLocalStorageWindows(almacen),
    logger: consoleLogger,
  })
  const framing: DiagramFraming = createDiagramFraming({
    store: app.store,
    persistence: createLocalStorageFraming(almacen),
    logger: consoleLogger,
  })
  /* La copia lee lo guardado, no lo de la pantalla: así van también los ficheros ilegibles. */
  const backup: BackupActions = {
    exportAll: (): Promise<ExportResult> => {
      /* Dónde se miraba el diagrama de debajo, que sigue abierto: antes de leer lo guardado. */
      framing.save()
      return exportBackup({
        flush: app.flush,
        blobs,
        windows: createLocalStorageWindows(almacen),
        phosphor: createLocalStoragePhosphor(almacen),
        framing: createLocalStorageFraming(almacen),
        calendarOrder: createLocalStorageCalendarOrder(almacen),
        clock: systemClock,
        chooseDestination: chooseFileDestination,
      })
    },
    prepareImport: (fichero: File): Promise<ImportPreparation> =>
      prepareImport(fichero, {
        almacen,
        clock: systemClock,
        ids,
        logger: consoleLogger,
        reload: (): void => window.location.reload(),
      }),
  }
  const montada: MountedApp = mountApp(raiz, {
    store: app.store,
    useCases: app.useCases,
    windows,
    framing,
    phosphor,
    openLayers: createLocalStorageOpenLayers(almacen),
    corrupt: app.corrupt,
    /* Sólo apunta el borrado y recarga: se hace al arrancar, antes de leer nada. */
    onResetAll: (): boolean => {
      if (!requestReset(almacen)) return false
      window.location.reload()
      return true
    },
    backup,
    version: versionPublicada(),
    logger: consoleLogger,
  })
  avisarDeGuardado = montada.showSaveError
  if (sinGuardar !== null) montada.showSaveError(sinGuardar)

  /* Lo pendiente se escribe al salir, y dónde se miraba el diagrama abierto. En
     el móvil `pagehide` no siempre llega, y pasar a segundo plano es la última
     ocasión segura. */
  const guardarAlSalir = (): void => {
    framing.save()
    /* Un fallo que no se arregla reintentando ya lo ha avisado `onError`; aquí,
       con la página yéndose, sólo queda dejarlo en la consola. */
    app
      .flush()
      .then((guardado: Result<void, StorageError>): void => {
        if (!guardado.ok) consoleLogger.failure("no se guardó lo pendiente al salir", guardado.error)
      })
      .catch((fallo: unknown): void => consoleLogger.failure("falló guardar lo pendiente al salir", fallo))
  }
  window.addEventListener("pagehide", guardarAlSalir)
  document.addEventListener("visibilitychange", (): void => {
    if (document.visibilityState !== "hidden") return
    guardarAlSalir()
  })
}

iniciar().catch((fallo: unknown): void => consoleLogger.failure("falló el arranque", fallo))
