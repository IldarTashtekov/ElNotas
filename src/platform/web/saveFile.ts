/**
 * Dónde se guarda un fichero que la app le da al usuario: con «Guardar como» si
 * el navegador lo tiene (Chrome y Edge de escritorio), y si no, en Descargas.
 *
 * Elegir y escribir van en dos pasos: el diálogo se abre al pulsar, y lo que se
 * escribe se prepara después.
 */

import type { ChooseDestination, Destination } from "./exportBackup.js"

/*
    `showSaveFilePicker` no viene en los tipos de TypeScript: es de la File System
    Access API, que sólo tienen los Chromium. Se declara aquí lo que se usa. El
    fichero que devuelve sí viene: es un `FileSystemFileHandle`.
*/
interface TipoDeFichero {
  readonly description: string
  readonly accept: Readonly<Record<string, ReadonlyArray<string>>>
}

interface OpcionesDeGuardar {
  readonly suggestedName: string
  readonly types: ReadonlyArray<TipoDeFichero>
}

interface ConGuardarComo {
  readonly showSaveFilePicker?: (opciones: OpcionesDeGuardar) => Promise<FileSystemFileHandle>
}

const JSON_TIPO: string = "application/json"

/** Cerrar el diálogo sin elegir es un `AbortError`: no es un fallo. */
const esCancelar = (fallo: unknown): boolean =>
  fallo instanceof DOMException && fallo.name === "AbortError"

/** Escribe en el fichero elegido. `createWritable` y el flujo pueden lanzar. */
const enFichero = (fichero: FileSystemFileHandle): Destination => ({
  write: async (texto: string): Promise<boolean> => {
    try {
      const flujo: FileSystemWritableFileStream = await fichero.createWritable()
      await flujo.write(texto)
      await flujo.close()
      return true
    } catch {
      return false
    }
  },
})

/** Lo descarga con un enlace de mentira: va a la carpeta de descargas. */
const enDescargas = (nombre: string): Destination => ({
  write: async (texto: string): Promise<boolean> => {
    try {
      const url: string = URL.createObjectURL(new Blob([texto], { type: JSON_TIPO }))
      const enlace: HTMLAnchorElement = document.createElement("a")
      enlace.href = url
      enlace.download = nombre
      enlace.click()
      /* Se suelta después: soltarlo enseguida corta la descarga en algún navegador. */
      setTimeout((): void => URL.revokeObjectURL(url), 10_000)
      return true
    } catch {
      return false
    }
  },
})

export const chooseFileDestination: ChooseDestination = async (
  nombre: string,
): Promise<Destination | null> => {
  const ventana: ConGuardarComo = window as unknown as ConGuardarComo
  if (ventana.showSaveFilePicker === undefined) return enDescargas(nombre)
  try {
    const fichero: FileSystemFileHandle = await ventana.showSaveFilePicker({
      suggestedName: nombre,
      types: [{ description: "Copia de ElNotas", accept: { [JSON_TIPO]: [".json"] } }],
    })
    return enFichero(fichero)
  } catch (fallo: unknown) {
    /* Cualquier otro fallo —el navegador no deja abrirlo ahora— no es razón para
       quedarse sin copia: va a Descargas. */
    return esCancelar(fallo) ? null : enDescargas(nombre)
  }
}
