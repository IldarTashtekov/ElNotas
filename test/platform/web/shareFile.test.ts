/**
 * La copia en la app de Android: se escribe en una carpeta de la caché, que antes
 * se vacía, y se comparte, con un puente de mentira que apunta lo que se le pide.
 */

import { test } from "node:test"
import assert from "node:assert/strict"

import type { ChooseDestination, Destination, Written } from "#platform/web/exportBackup"
import { chooseShareDestination } from "#platform/web/shareFile"
import { textos } from "#ui/index"

import { silentLogger } from "../../core/ports/FakeLogger"

/** Lo que se le pidió al puente, plugin y método, con sus opciones. */
interface Pedido {
  readonly que: string
  readonly opciones: object
}

type Respuesta = (opciones: object) => Promise<unknown>

const bien =
  (valor: unknown): Respuesta =>
  (): Promise<unknown> =>
    Promise.resolve(valor)
const mal =
  (mensaje: string): Respuesta =>
  (): Promise<unknown> =>
    Promise.reject(new Error(mensaje))

/** Una ventana con los dos plugins; cada método responde con lo que se le dé. */
const conPuente = (respuestas: {
  readonly rmdir?: Respuesta
  readonly writeFile: Respuesta
  readonly share: Respuesta
}): { readonly ventana: Window; readonly pedidos: () => ReadonlyArray<Pedido> } => {
  let pedidos: ReadonlyArray<Pedido> = []
  const apuntando =
    (que: string, responder: Respuesta): Respuesta =>
    (opciones: object): Promise<unknown> => {
      pedidos = [...pedidos, { que, opciones }]
      return responder(opciones)
    }
  const ventana: unknown = {
    Capacitor: {
      Plugins: {
        Filesystem: {
          rmdir: apuntando("Filesystem.rmdir", respuestas.rmdir ?? bien(undefined)),
          writeFile: apuntando("Filesystem.writeFile", respuestas.writeFile),
        },
        Share: { share: apuntando("Share.share", respuestas.share) },
      },
    },
  }
  return { ventana: ventana as Window, pedidos: (): ReadonlyArray<Pedido> => pedidos }
}

const escribirLaCopia = async (ventana: Window): Promise<Written> => {
  const elegir: ChooseDestination = chooseShareDestination(ventana, silentLogger)
  const destino: Destination | null = await elegir("elnotas-copia.json")
  if (destino === null) assert.fail("no pregunta nada antes: siempre hay destino")
  return destino.write("{}")
}

const URI: string = "file:///data/cache/copias/elnotas-copia.json"

const quienes = (pedidos: ReadonlyArray<Pedido>): ReadonlyArray<string> => pedidos.map((p: Pedido): string => p.que)

test("vacía la carpeta, escribe la copia en ella y comparte ese fichero", async (): Promise<void> => {
  const puente: ReturnType<typeof conPuente> = conPuente({ writeFile: bien({ uri: URI }), share: bien({}) })
  assert.equal(await escribirLaCopia(puente.ventana), "shared")
  const [vaciado, escrito, compartido]: ReadonlyArray<Pedido> = puente.pedidos()
  assert.deepEqual(vaciado, {
    que: "Filesystem.rmdir",
    opciones: { path: "copias", directory: "CACHE", recursive: true },
  })
  assert.deepEqual(escrito, {
    que: "Filesystem.writeFile",
    opciones: { path: "copias/elnotas-copia.json", data: "{}", directory: "CACHE", encoding: "utf8", recursive: true },
  })
  assert.equal(compartido?.que, "Share.share")
  const opciones: { readonly files?: unknown; readonly dialogTitle?: unknown } = compartido?.opciones ?? {}
  assert.deepEqual(opciones.files, [URI])
  assert.equal(opciones.dialogTitle, textos.copia.compartirEn)
})

test("si la carpeta no existe aún, sigue igual", async (): Promise<void> => {
  const puente: ReturnType<typeof conPuente> = conPuente({
    rmdir: mal("Folder does not exist."),
    writeFile: bien({ uri: URI }),
    share: bien({}),
  })
  assert.equal(await escribirLaCopia(puente.ventana), "shared")
})

test("cerrar la hoja sin elegir es cancelar", async (): Promise<void> => {
  const puente: ReturnType<typeof conPuente> = conPuente({
    writeFile: bien({ uri: URI }),
    share: mal("Share canceled"),
  })
  assert.equal(await escribirLaCopia(puente.ventana), "cancelled")
})

test("otro fallo al compartir, aunque hable de cancelar, es un fallo", async (): Promise<void> => {
  const puente: ReturnType<typeof conPuente> = conPuente({
    writeFile: bien({ uri: URI }),
    share: mal("the activity was cancelled by the system"),
  })
  assert.equal(await escribirLaCopia(puente.ventana), "failed")
})

test("si no se puede escribir en la caché, falla sin abrir la hoja, aunque diga cancel", async (): Promise<void> => {
  const puente: ReturnType<typeof conPuente> = conPuente({ writeFile: mal("Share canceled"), share: bien({}) })
  assert.equal(await escribirLaCopia(puente.ventana), "failed")
  assert.deepEqual(quienes(puente.pedidos()), ["Filesystem.rmdir", "Filesystem.writeFile"])
})

test("si escribir no devuelve dónde quedó, falla sin abrir la hoja", async (): Promise<void> => {
  const puente: ReturnType<typeof conPuente> = conPuente({ writeFile: bien({}), share: bien({}) })
  assert.equal(await escribirLaCopia(puente.ventana), "failed")
  assert.deepEqual(quienes(puente.pedidos()), ["Filesystem.rmdir", "Filesystem.writeFile"])
})

test("sin los plugins en el puente, falla", async (): Promise<void> => {
  assert.equal(await escribirLaCopia({} as Window), "failed")
})
