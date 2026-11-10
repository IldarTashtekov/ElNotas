/**
 * La entrada de la app en el navegador: la carga `index.html`.
 *
 * Decide lo que en web es cada pieza —el reloj del sistema, los ids del azar del
 * navegador, las notas en `localStorage` (en la app de Android, en OPFS), y el
 * estado de la pantalla y lo abierto encima de la ventana en `localStorage`—, elige el idioma antes de pintar nada,
 * termina una importación pedida, arranca y monta la app, con la copia de
 * seguridad en la configuración. Si no arranca, lo dice en pantalla en vez de
 * quedarse en blanco.
 */

import type { BlobStore, Day, IdGenerator, Result, StorageError } from "#core/index"
import { err } from "#core/index"
import { createDirectoryHandleBlobStore, createLocalStorageBlobStore } from "#storage/index"
import type {
  BackupActions,
  CalendarTabSetting,
  RoutineChartsSetting,
  DiagramFraming,
  ExportResult,
  ImportPreparation,
  Language,
  LanguagePersistence,
  LanguageSetting,
  MountedApp,
  Phosphor,
  PhosphorSetting,
  UiStatePersistence,
  WindowsModel,
} from "#ui/index"
import {
  createCalendarTabSetting,
  createRoutineChartsSetting,
  createDiagramFraming,
  createLanguageSetting,
  createPhosphorSetting,
  createWindowsModel,
  describeBootError,
  describeImportFailure,
  mountApp,
  textos,
  uiStateSection,
} from "#ui/index"
import type { App, BootError } from "./boot.js"
import { boot } from "./boot.js"
import { consoleLogger } from "./ConsoleLogger.js"
import { createCryptoIdGenerator } from "./CryptoIdGenerator.js"
import { exportBackup } from "./exportBackup.js"
import type { ImportAtBoot } from "./importStorage.js"
import { cancelImport, importIfRequested } from "./importStorage.js"
import { createLocalStorageOpenLayers } from "./LocalStorageOpenLayers.js"
import { createLocalStorageUiState, forgetOldUiKeys } from "./LocalStorageUiState.js"
import { prepareImport } from "./prepareImport.js"
import { requestReset, resetAllIfRequested, resetIfRequested } from "./resetStorage.js"
import { dentroDeLaApp } from "./dentroDeLaApp.js"
import { chooseFileDestination } from "./saveFile.js"
import { systemClock } from "./SystemClock.js"
import { todayOf } from "./today.js"

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

/** OPFS, la carpeta privada del origen, como almacén de las notas; `null` si no se abre. */
const abrirOpfs = async (): Promise<BlobStore | null> => {
  try {
    return createDirectoryHandleBlobStore(await navigator.storage.getDirectory())
  } catch (fallo: unknown) {
    consoleLogger.failure("no se pudo abrir OPFS para las notas", fallo)
    return null
  }
}

/** Sin `localStorage` no hay nada guardado que leer: manda el del navegador. */
const SIN_ALMACEN: LanguagePersistence = {
  load: (): Result<unknown, StorageError> => err({ kind: "permission-denied" }),
  save: (): Result<void, StorageError> => err({ kind: "permission-denied" }),
}

/** Elige el idioma de los textos y lo pone en la página. */
const elegirIdioma = (persistence: LanguagePersistence): LanguageSetting =>
  createLanguageSetting({
    persistence,
    browser: navigator.language,
    apply: (elegido: Language): void => {
      document.documentElement.lang = elegido
    },
    reload: (): void => window.location.reload(),
    logger: consoleLogger,
  })

const mostrarFallo = (raiz: HTMLElement, mensaje: string): void => {
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
    boton(textos.arranque.reintentar, "recargar", (): void => window.location.reload()),
    boton(textos.arranque.abandonarImportacion, "abandonar", (): void => {
      if (cancelImport(almacen)) window.location.reload()
    }),
  )
  raiz.replaceChildren(aviso)
}

const iniciar = async (): Promise<void> => {
  const raiz: HTMLElement | null = document.getElementById("app")
  if (raiz === null) return

  const almacen: Storage | null = localStorageDisponible()
  /* El idioma, lo primero: hasta los fallos del arranque salen en él. */
  elegirIdioma(almacen === null ? SIN_ALMACEN : uiStateSection(createLocalStorageUiState(almacen), "language"))
  if (almacen === null) {
    mostrarFallo(raiz, describeBootError({ kind: "permission-denied" }))
    return
  }

  /* En la app de Android las notas viven en OPFS; en el navegador, en `localStorage`.
     Si OPFS no se abre, no se arranca: con otro almacén se vería la app vacía. */
  const opfs: BlobStore | null = dentroDeLaApp(window) ? await abrirOpfs() : null
  if (dentroDeLaApp(window) && opfs === null) {
    mostrarFallo(raiz, describeBootError({ kind: "permission-denied" }))
    return
  }
  /* Si se pidió importar una copia, antes que nada: sustituye lo guardado por ella. */
  const importada: ImportAtBoot = await importIfRequested(almacen, opfs)
  if (importada.kind === "failed") {
    mostrarImportacionSinTerminar(raiz, almacen, importada.error)
    return
  }

  /* Si se pidió «Borrar todo», es aquí, antes de leer nada: así también se va lo
     que el guardado escribió al salir de la página. */
  if (opfs === null) resetIfRequested(almacen)
  else await resetAllIfRequested(almacen, opfs)
  if (!forgetOldUiKeys(almacen)) {
    consoleLogger.failure("no se quitaron las claves de antes del estado de la pantalla", null)
  }
  pedirPersistencia()

  /* Lo de la pantalla de este dispositivo, en un objeto: cada pieza recibe su sección. */
  const estadoUi: UiStatePersistence = createLocalStorageUiState(almacen)

  /* Otra vez: la copia importada pudo traer otro, y «Borrar todo» lo olvida. */
  const language: LanguageSetting = elegirIdioma(uiStateSection(estadoUi, "language"))

  /* El color, antes de arrancar: así lo que se pinte mientras tanto ya sale con él. */
  const phosphor: PhosphorSetting = createPhosphorSetting({
    persistence: uiStateSection(estadoUi, "phosphor"),
    logger: consoleLogger,
    apply: (elegido: Phosphor): void => {
      document.documentElement.dataset["phosphor"] = elegido
    },
  })
  const calendarTab: CalendarTabSetting = createCalendarTabSetting({
    persistence: uiStateSection(estadoUi, "calendarTab"),
    logger: consoleLogger,
  })

  /* El guardado puede detenerse antes de que haya UI a la que avisar: se guarda
     el fallo y se enseña al montarla. */
  let sinGuardar: StorageError | null = null
  let avisarDeGuardado: (fallo: StorageError) => void = (fallo: StorageError): void => {
    sinGuardar = fallo
  }
  const blobs: BlobStore = opfs ?? createLocalStorageBlobStore(almacen)
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
    persistence: uiStateSection(estadoUi, "windows"),
    logger: consoleLogger,
  })
  const framing: DiagramFraming = createDiagramFraming({
    store: app.store,
    persistence: uiStateSection(estadoUi, "framings"),
    logger: consoleLogger,
  })
  const routineCharts: RoutineChartsSetting = createRoutineChartsSetting({
    store: app.store,
    persistence: uiStateSection(estadoUi, "routineCharts"),
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
        uiState: estadoUi,
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
    today: (): Day | null => todayOf(systemClock.now()),
    calendarOrder: uiStateSection(estadoUi, "calendarOrder"),
    calendarTab,
    routineCharts,
    phosphor,
    language,
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
