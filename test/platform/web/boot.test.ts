/**
 * El arranque de la app, sobre la pila de producción entera salvo el navegador:
 * `boot` → `FileStorageAdapter` → `LocalStorageBlobStore` → un `localStorage`
 * falso.
 *
 * La prueba central es la rebanada vertical de la Fase 4: un contexto creado
 * sobrevive a cerrar y volver a abrir la app. Recargar se simula arrancando otra
 * vez sobre el mismo almacén, con todo lo demás nuevo.
 */

import { test } from "node:test"
import assert from "node:assert/strict"

import type {
  AppState,
  BlobStore,
  Clock,
  Context,
  IdGenerator,
  Note,
  Result,
  StorageError,
} from "#core/index"
import { CURRENT_SCHEMA_VERSION, noteRef } from "#core/index"
import type { Cancel } from "#storage/index"
import { createFileStorageAdapter, createLocalStorageBlobStore } from "#storage/index"
import type { App, BootError } from "#platform/index"
import { boot } from "#platform/index"

import type { FakeStorage } from "../../storage/blobs/FakeStorage"
import { createFakeStorage, excepcionDeCuota } from "../../storage/blobs/FakeStorage"

/* ────────────────────────────── El escenario ────────────────────────────── */

const reloj: Clock = { now: (): number => 1000 }

/* Un contador para todo el fichero, no uno por arranque: tras «recargar», los
   ids nuevos no pueden chocar con los ya guardados, igual que con los de verdad. */
let siguienteId: number = 0
const idsSecuenciales = (): IdGenerator => ({ next: (): string => `id-${siguienteId++}` })

/** Un temporizador que no salta nunca: las pruebas escriben con `flush()`. */
const nuncaSalta = (): Cancel => (): void => undefined

/** Arranca como lo haría la página, sobre el almacén que se le pase. */
const arrancar = (almacen: Storage, skipCorrupt: boolean = false): Promise<Result<App, BootError>> =>
  boot({
    blobs: createLocalStorageBlobStore(almacen),
    clock: reloj,
    ids: idsSecuenciales(),
    schedule: nuncaSalta,
    skipCorrupt,
  })

const appDe = (r: Result<App, BootError>): App => {
  if (!r.ok) assert.fail(`el arranque tenía que ir bien: ${JSON.stringify(r.error)}`)
  return r.value
}

const errorDe = (r: Result<App, BootError>): BootError => {
  if (r.ok) assert.fail("el arranque tenía que fallar")
  return r.error
}

const escrituraOk = (r: Result<void, StorageError>): void => {
  if (!r.ok) assert.fail(`la escritura tenía que ir bien: ${JSON.stringify(r.error)}`)
}

/* ─────────────────────────────── Las pruebas ────────────────────────────── */

test("un almacén vacío arranca con el estado vacío", async (): Promise<void> => {
  const app: App = appDe(await arrancar(createFakeStorage()))
  const estado: AppState = app.store.getState()

  assert.deepEqual(estado, { notes: {}, plans: {}, contexts: {} })
})

test("un almacén vacío queda marcado con la versión actual del formato", async (): Promise<void> => {
  const almacen: FakeStorage = createFakeStorage()
  appDe(await arrancar(almacen))

  const blobs: BlobStore = createLocalStorageBlobStore(almacen)
  const version: Result<number, StorageError> =
    await createFileStorageAdapter(blobs).getSchemaVersion()
  assert.deepEqual(version, { ok: true, value: CURRENT_SCHEMA_VERSION })
})

test("LA REBANADA: un contexto creado sobrevive a recargar", async (): Promise<void> => {
  const almacen: FakeStorage = createFakeStorage()

  const primera: App = appDe(await arrancar(almacen))
  const creado: Context | null = primera.useCases.createContext("Compra")
  assert.notEqual(creado, null)
  escrituraOk(await primera.flush())

  /* «Recargar»: otro arranque, con Store, escritor y casos de uso nuevos. Sólo
     el almacén es el mismo. */
  const segunda: App = appDe(await arrancar(almacen))
  const contextos: ReadonlyArray<Context> = Object.values<Context>(
    segunda.store.getState().contexts,
  )

  assert.equal(contextos.length, 1)
  assert.deepEqual(contextos[0], creado)
})

test("arrancar sobre lo guardado no escribe nada", async (): Promise<void> => {
  const almacen: FakeStorage = createFakeStorage()
  const primera: App = appDe(await arrancar(almacen))
  primera.useCases.createContext("Compra")
  escrituraOk(await primera.flush())

  /* Si el segundo arranque o su primer flush escribieran, este setItem armado
     saltaría y el flush devolvería el error. */
  almacen.lanzarEn("setItem", excepcionDeCuota())
  const segunda: App = appDe(await arrancar(almacen))
  escrituraOk(await segunda.flush())
})

/** El mismo almacén, apuntando cuántas claves distintas se escriben. */
const contandoEscrituras = (
  almacen: Storage,
): { readonly storage: Storage; readonly escritas: () => ReadonlyArray<string> } => {
  let escritas: ReadonlyArray<string> = []
  const storage: Storage = {
    get length(): number {
      return almacen.length
    },
    clear: (): void => almacen.clear(),
    getItem: (clave: string): string | null => almacen.getItem(clave),
    key: (indice: number): string | null => almacen.key(indice),
    removeItem: (clave: string): void => almacen.removeItem(clave),
    setItem: (clave: string, valor: string): void => {
      escritas = [...escritas, clave]
      almacen.setItem(clave, valor)
    },
  }
  return { storage, escritas: (): ReadonlyArray<string> => escritas }
}

test("tras arrancar, un cambio escribe sólo lo que cambió", async (): Promise<void> => {
  const almacen: FakeStorage = createFakeStorage()
  const primera: App = appDe(await arrancar(almacen))
  primera.useCases.createContext("Compra")
  escrituraOk(await primera.flush())

  /* Si el escritor arrancara sin saber lo que ya hay guardado, el primer cambio
     reescribiría también «Compra». */
  const contado: ReturnType<typeof contandoEscrituras> = contandoEscrituras(almacen)
  const segunda: App = appDe(await arrancar(contado.storage))
  const casa: Context | null = segunda.useCases.createContext("Casa")
  escrituraOk(await segunda.flush())

  assert.notEqual(casa, null)
  assert.deepEqual(contado.escritas(), [`elnotas:blob:contexts/${casa?.id}.json`])
})

test("un almacén de una versión más nueva no arranca", async (): Promise<void> => {
  const almacen: FakeStorage = createFakeStorage()
  const blobs: BlobStore = createLocalStorageBlobStore(almacen)
  escrituraOk(await createFileStorageAdapter(blobs).setSchemaVersion(CURRENT_SCHEMA_VERSION + 1))

  const fallo: BootError = errorDe(await arrancar(almacen))
  assert.equal(fallo.kind, "schema-from-future")
})

test("un manifiesto ilegible no arranca, y no se toca", async (): Promise<void> => {
  const almacen: FakeStorage = createFakeStorage()
  const clave: string = "elnotas:blob:manifest.json"
  /* Base64 válido de un texto que no es JSON: lo rompe el adaptador, no el blob. */
  almacen.escribirCrudo(clave, btoa("esto no es json"))

  const fallo: BootError = errorDe(await arrancar(almacen))
  assert.equal(fallo.kind, "corrupt")
  assert.equal(almacen.getItem(clave), btoa("esto no es json"))
})

/* ──────────── skipCorrupt: una nota rota no impide abrir la app ──────────── */

/** Un almacén con una nota buena, «Compra», y el fichero de otra, ilegible. */
const conUnaNotaRota = async (): Promise<FakeStorage> => {
  const almacen: FakeStorage = createFakeStorage()
  const primera: App = appDe(await arrancar(almacen))
  primera.useCases.createNote("Compra")
  escrituraOk(await primera.flush())
  almacen.escribirCrudo("elnotas:blob:notes/rota.json", btoa("no es json"))
  return almacen
}

test("sin skipCorrupt, una nota ilegible impide arrancar", async (): Promise<void> => {
  const fallo: BootError = errorDe(await arrancar(await conUnaNotaRota()))
  assert.equal(fallo.kind, "corrupt")
})

test("con skipCorrupt, una nota ilegible se salta, se dice cuál, y la app arranca con el resto", async (): Promise<void> => {
  const app: App = appDe(await arrancar(await conUnaNotaRota(), true))
  const avisos: ReadonlyArray<StorageError> = app.corrupt

  const nombres: ReadonlyArray<string> = Object.values<Note>(app.store.getState().notes).map(
    (nota: Note): string => nota.name,
  )
  assert.deepEqual(nombres, ["Compra"])
  assert.equal(avisos.length, 1)
  const aviso: StorageError | undefined = avisos[0]
  if (aviso?.kind !== "corrupt") assert.fail(`se esperaba un aviso corrupt y vino ${aviso?.kind}`)
  assert.equal(aviso.path, "notes/rota.json")
})

test("el fichero ilegible que se saltó sigue en disco, intacto", async (): Promise<void> => {
  /* Saltarlo es no cargarlo, no borrarlo: si alguien lo arregla a mano, vuelve. */
  const almacen: FakeStorage = await conUnaNotaRota()
  const app: App = appDe(await arrancar(almacen, true))
  app.useCases.createContext("Casa")
  escrituraOk(await app.flush())

  assert.equal(almacen.getItem("elnotas:blob:notes/rota.json"), btoa("no es json"))
})

test("un arranque sin ficheros rotos no dice ninguno", async (): Promise<void> => {
  const app: App = appDe(await arrancar(createFakeStorage(), true))
  assert.deepEqual(app.corrupt, [])
})

test("LA REFERENCIA NO SE PIERDE: tocar el contexto de una nota ilegible no la saca de él", async (): Promise<void> => {
  /* Lista, dentro de Compra, guardadas. */
  const almacen: FakeStorage = createFakeStorage()
  const primera: App = appDe(await arrancar(almacen))
  const lista: Note | null = primera.useCases.createNote("Lista")
  const compra: Context | null = primera.useCases.createContext("Compra")
  if (lista === null || compra === null) assert.fail("tenían que crearse")
  primera.useCases.addItem(compra.id, noteRef(lista.id))
  escrituraOk(await primera.flush())

  /* Se rompe el fichero de Lista; con él roto, se renombra Compra y se guarda. */
  const clave: string = `elnotas:blob:notes/${lista.id}.json`
  const sano: string | null = almacen.getItem(clave)
  if (sano === null) assert.fail("Lista tenía que estar guardada")
  almacen.escribirCrudo(clave, btoa("no es json"))
  const segunda: App = appDe(await arrancar(almacen, true))
  assert.deepEqual(segunda.store.getState().contexts[compra.id]?.items, [noteRef(lista.id)])
  segunda.useCases.renameContext(compra.id, "Compra semanal")
  escrituraOk(await segunda.flush())

  /* Se arregla el fichero: Lista vuelve, y vuelve DENTRO de Compra. */
  almacen.escribirCrudo(clave, sano)
  const tercera: App = appDe(await arrancar(almacen, true))
  const ctx: Context | undefined = tercera.store.getState().contexts[compra.id]
  assert.equal(ctx?.name, "Compra semanal")
  assert.deepEqual(ctx?.items, [noteRef(lista.id)])
  assert.equal(tercera.store.getState().notes[lista.id]?.name, "Lista")
})
