/**
 * Un `BlobStore` de mentira, sobre un `Map`, **con inyección de fallos**.
 *
 * Es lo que hace que `FileStorageAdapter` —donde está toda la lógica de la
 * persistencia en fichero— se pueda verificar entero en Node, sin navegador y
 * sin tocar el disco (`ARCHITECTURE.md` §6.3).
 *
 * ── Por qué aquí un doble SÍ es legítimo ───────────────────────────────────
 *
 * Parece chocar con la decisión de §6.3 de **no** probar los adaptadores de
 * navegador con dobles, y no choca: lo que allí se descarta es usar un doble
 * para probar `DirectoryHandleBlobStore`, que **no tiene lógica propia** y sólo
 * traduce a la API del navegador — probarlo con un `Map` demostraría lo que uno
 * *cree* que hace esa API, no lo que hace (el ejemplo escrito allí es el
 * `close()` que se olvida y aun así pasa en verde).
 *
 * Aquí es al revés: lo que se prueba con este doble es **la lógica del
 * adaptador de encima** —serializar, traducir id a camino, mantener el
 * manifiesto, traducir errores—, y para eso el `BlobStore` sólo tiene que
 * comportarse como dice su puerto. Cuanto más gorda es la capa que se prueba,
 * más vale el doble; cuanto más fina, menos.
 *
 * ── Guardar bytes no basta: hace falta poder fallar ────────────────────────
 *
 * Un `Map` y ya está probaría únicamente el camino feliz, y dejaría sin probar
 * justo lo que este adaptador tiene de delicado: que **el `err` de la plataforma
 * se propague sin reempaquetar** y que **unos bytes que no son JSON salgan como
 * `corrupt`**. De ahí las dos herramientas que este falso añade al puerto:
 *
 *     fallarEn(op, error)       la siguiente llamada a esa operación devuelve
 *                               ESE MISMO objeto de error — lo que permite
 *                               comprobar la propagación con `strictEqual`
 *     escribirTexto(ruta, txt)  mete texto crudo en una ruta, JSON válido o no
 *
 * `fallarEn` devuelve **el mismo objeto**, no uno equivalente, y esa es toda la
 * gracia: con `deepEqual` pasaría igual de verde un adaptador que reconstruyera
 * el error por el camino, y reconstruirlo es el primer paso para deformarlo.
 *
 * Este fichero se llama `.test.ts` por el mismo motivo que la suite de
 * contratos: es código de pruebas y no debe salir por `src/storage/index.ts`.
 * `node --test` lo carga y no encuentra pruebas de nivel superior, que es
 * inocuo.
 */

import type { BlobStore, Result, StorageError } from "#core/index"
import { err, ok } from "#core/index"

/** Las cuatro del puerto. Se puede inyectar un fallo en cualquiera. */
export type OperacionBlob = "read" | "write" | "delete" | "list"

export interface FakeBlobStore extends BlobStore {
  /**
   * Hace que la **siguiente** llamada a esa operación devuelva ese error, y
   * sólo la siguiente: así una prueba puede fallar un `read` concreto en medio
   * de un `getAll` sin dejar el falso inservible para el resto.
   */
  readonly fallarEn: (op: OperacionBlob, fallo: StorageError) => void
  /**
   * Un camino que `list` reporta y que `read` no encuentra. Modela la carrera
   * de verdad que hay entre listar y leer: alguien —otra pestaña, el usuario en
   * el explorador de ficheros— borró ese fichero en medio del `getAll`.
   */
  readonly fantasma: (camino: string) => void
  /** Texto crudo en una ruta. Para meter bytes que no son JSON válido. */
  readonly escribirTexto: (camino: string, texto: string) => void
  /** Lo guardado en esa ruta, como texto, o `null`. Para mirar el disco. */
  readonly leerTexto: (camino: string) => string | null
  /** Todas las rutas ocupadas. Para comprobar el esquema `notes/<id>.json`. */
  readonly caminos: () => ReadonlyArray<string>
}

export const createFakeBlobStore = (): FakeBlobStore => {
  const archivos = new Map<string, Uint8Array>()
  /** Fallos armados, uno como mucho por operación. Se consumen al dispararse. */
  const armados = new Map<OperacionBlob, StorageError>()
  /** Caminos que sólo existen para `list`. Ver `fantasma`. */
  const fantasmas = new Set<string>()

  const codificador: TextEncoder = new TextEncoder()
  const descodificador: TextDecoder = new TextDecoder()

  /**
   * Si hay un fallo armado para esa operación, lo desarma y lo devuelve. El
   * objeto sale **intacto**, que es lo que después se comprueba con
   * `strictEqual` al otro lado del adaptador.
   */
  const falloArmado = (op: OperacionBlob): StorageError | null => {
    const fallo: StorageError | undefined = armados.get(op)
    if (fallo === undefined) return null
    armados.delete(op)
    return fallo
  }

  return {
    read: async (camino) => {
      const fallo: StorageError | null = falloArmado("read")
      if (fallo !== null) return err(fallo)

      /* `ok(null)` y no un error: que un camino no exista es una respuesta, y el
         puerto lo dice con todas las letras. Si este falso devolviera
         `not-found` aquí, el adaptador no tendría ocasión de equivocarse. */
      return ok(archivos.get(camino) ?? null)
    },

    write: async (camino, data) => {
      const fallo: StorageError | null = falloArmado("write")
      if (fallo !== null) return err(fallo)

      archivos.set(camino, data)
      return ok(undefined)
    },

    delete: async (camino) => {
      const fallo: StorageError | null = falloArmado("delete")
      if (fallo !== null) return err(fallo)

      // Borrar lo que no está tampoco es un error aquí abajo.
      archivos.delete(camino)
      return ok(undefined)
    },

    list: async (prefijo) => {
      const fallo: StorageError | null = falloArmado("list")
      if (fallo !== null) return err(fallo)

      const encontrados: ReadonlyArray<string> = [
        ...archivos.keys(),
        ...fantasmas,
      ].filter((c) => c.startsWith(prefijo))
      /* Sin orden garantizado en el puerto, así que este falso devuelve el de
         inserción del `Map`. El adaptador no debe depender de ninguno: `getAll`
         tampoco promete orden. */
      return ok(encontrados)
    },

    fallarEn: (op, fallo) => {
      armados.set(op, fallo)
    },

    fantasma: (camino) => {
      fantasmas.add(camino)
    },

    escribirTexto: (camino, texto) => {
      archivos.set(camino, codificador.encode(texto))
    },

    leerTexto: (camino) => {
      const bytes: Uint8Array | undefined = archivos.get(camino)
      return bytes === undefined ? null : descodificador.decode(bytes)
    },

    caminos: () => [...archivos.keys()],
  }
}

/** Azúcar para las pruebas: un `Result` que tenía que haber ido mal. */
export const errorDe = <T>(r: Result<T, StorageError>): StorageError => {
  if (r.ok) throw new Error(`se esperaba err y vino ok: ${JSON.stringify(r.value)}`)
  return r.error
}

/** Y el que tenía que haber ido bien. */
export const valorDe = <T>(r: Result<T, StorageError>): T => {
  if (!r.ok) throw new Error(`se esperaba ok y vino err: ${r.error.kind}`)
  return r.value
}
