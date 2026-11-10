/**
 * Dónde va la copia dentro de la app de Android, que no sabe descargar: se
 * escribe en una carpeta propia de la caché de la app y se abre la hoja
 * «Compartir» de Android, desde la que se guarda en Drive o donde se quiera.
 *
 * Habla con Android por el puente de Capacitor, con sus plugins de ficheros y de
 * compartir. Lo único que se sabe al final es que la copia se pasó a otra app.
 */

import type { Logger } from "#core/index"
import { textos } from "#ui/index"
import type { ChooseDestination, Destination, Written } from "./exportBackup.js"

type MetodoDePlugin = (opciones: object) => Promise<unknown>

/** Lo que usa del puente de la app; TypeScript no lo trae. */
interface ConPuente {
  readonly Capacitor?: {
    readonly Plugins?: {
      readonly Filesystem?: { readonly writeFile?: MetodoDePlugin; readonly rmdir?: MetodoDePlugin }
      readonly Share?: { readonly share?: MetodoDePlugin }
    }
  }
}

/** La carpeta de la caché donde se deja la copia: se vacía antes de cada una, para no amontonarlas. */
const CARPETA: string = "copias"

/** Lo que rechaza el plugin al cerrar la hoja sin elegir: no es un fallo. */
const CANCELADO: string = "Share canceled"

const esCancelar = (fallo: unknown): boolean => fallo instanceof Error && fallo.message === CANCELADO

/** La dirección `file://` del fichero escrito, o `null` si no la trae. */
const uriDe = (escrito: unknown): string | null => {
  const uri: unknown = typeof escrito === "object" && escrito !== null ? (escrito as { uri?: unknown }).uri : null
  return typeof uri === "string" ? uri : null
}

const compartir = (ventana: Window, logger: Logger, nombre: string): Destination => ({
  write: async (texto: string): Promise<Written> => {
    const plugins: NonNullable<NonNullable<ConPuente["Capacitor"]>["Plugins"]> | undefined = (
      ventana as unknown as ConPuente
    ).Capacitor?.Plugins
    const pluginBorrar: MetodoDePlugin | undefined = plugins?.Filesystem?.rmdir
    const pluginEscribir: MetodoDePlugin | undefined = plugins?.Filesystem?.writeFile
    const pluginCompartir: MetodoDePlugin | undefined = plugins?.Share?.share
    if (pluginBorrar === undefined || pluginEscribir === undefined || pluginCompartir === undefined) return "failed"

    /* La de la vez anterior ya la habrá leído la app que la recibió. Si falla (la
       primera vez, porque no hay carpeta), se sigue: lo peor es una copia vieja en la caché. */
    try {
      await pluginBorrar({ path: CARPETA, directory: "CACHE", recursive: true })
    } catch (fallo: unknown) {
      logger.failure("no se vació la carpeta de la copia en la caché", fallo)
    }

    let uri: string | null
    try {
      uri = uriDe(
        await pluginEscribir({
          path: `${CARPETA}/${nombre}`,
          data: texto,
          directory: "CACHE",
          encoding: "utf8",
          recursive: true,
        }),
      )
    } catch {
      return "failed"
    }
    if (uri === null) return "failed"

    try {
      await pluginCompartir({ title: nombre, files: [uri], dialogTitle: textos.copia.compartirEn })
      return "shared"
    } catch (fallo: unknown) {
      return esCancelar(fallo) ? "cancelled" : "failed"
    }
  },
})

/** El destino de la copia en la app: no pregunta nada antes; la hoja sale al escribir. */
export const chooseShareDestination =
  (ventana: Window, logger: Logger): ChooseDestination =>
  async (nombre: string): Promise<Destination | null> =>
    compartir(ventana, logger, nombre)
