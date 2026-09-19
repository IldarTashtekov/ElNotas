/**
 * Un `localStorage` de mentira, sobre un `Map`, **con inyección de excepciones**.
 *
 * Es lo que permite verificar `LocalStorageBlobStore` entero en Node.
 *
 * Lo que añade sobre un `Map` es poder lanzar, porque sin eso quedaría sin probar
 * lo que ese `BlobStore` tiene de suyo: que la excepción de cuota salga como
 * `quota-exceeded` y no como `io`. Y como los navegadores no se pusieron de
 * acuerdo en cómo es esa excepción, hace falta poder lanzar cualquier cosa:
 *
 *     lanzarEn(op, loQueSea)   la siguiente llamada a esa operación lanza ESO
 *     escribirCrudo(k, v)      mete texto tal cual, sin pasar por base64
 *     claves()                 las claves de verdad, con su prefijo
 */

/** Los cinco miembros de `Storage` que `LocalStorageBlobStore` llega a tocar. */
export type OperacionStorage = "getItem" | "setItem" | "removeItem" | "key" | "length"

export interface FakeStorage extends Storage {
  /**
   * Hace que la **siguiente** llamada a ese miembro lance eso, y sólo la
   * siguiente: así una prueba puede reventar un `setItem` concreto sin dejar el
   * falso inservible para el resto.
   */
  readonly lanzarEn: (op: OperacionStorage, fallo: unknown) => void
  /** Texto tal cual en una clave, saltándose el base64. Para romper el sobre. */
  readonly escribirCrudo: (clave: string, valor: string) => void
  /** Las claves ocupadas, **con prefijo**: para mirar el almacén de verdad. */
  readonly claves: () => ReadonlyArray<string>
}

export const createFakeStorage = (): FakeStorage => {
  const datos = new Map<string, string>()
  /** Excepciones armadas, una como mucho por miembro. Se consumen al saltar. */
  const armadas = new Map<OperacionStorage, unknown>()

  /** Si hay una armada para ese miembro, la desarma y la lanza. */
  const quizaLanzar = (op: OperacionStorage): void => {
    if (!armadas.has(op)) return
    const fallo: unknown = armadas.get(op)
    armadas.delete(op)
    throw fallo
  }

  return {
    get length(): number {
      quizaLanzar("length")
      return datos.size
    },

    clear: () => {
      datos.clear()
    },

    getItem: (clave: string) => {
      quizaLanzar("getItem")
      /* `null`, no `undefined`: es lo que dice la especificación de `Storage` y
         es de lo que depende el «ausencia no es fallo» de la capa de encima. */
      return datos.get(clave) ?? null
    },

    key: (indice: number) => {
      quizaLanzar("key")
      return [...datos.keys()][indice] ?? null
    },

    removeItem: (clave: string) => {
      quizaLanzar("removeItem")
      datos.delete(clave)
    },

    setItem: (clave: string, valor: string) => {
      quizaLanzar("setItem")
      /* Un `localStorage` de verdad guarda siempre una cadena, aunque le pasen
         otra cosa. Aquí los tipos ya lo garantizan. */
      datos.set(clave, valor)
    },

    lanzarEn: (op, fallo) => {
      armadas.set(op, fallo)
    },

    escribirCrudo: (clave, valor) => {
      datos.set(clave, valor)
    },

    claves: () => [...datos.keys()],
  }
}

/**
 * La excepción de cuota **como la lanza un navegador moderno**: una
 * `DOMException` con ese `name`. Node la trae desde la v17, así que no hace
 * falta nada instalado.
 *
 * Las otras formas —el `name` de Firefox, el `code` numérico a secas— las
 * fabrica cada prueba con un objeto literal, porque el caso que modelan es
 * precisamente el de un navegador que **no** lanza una `DOMException` de manual.
 */
export const excepcionDeCuota = (): DOMException =>
  new DOMException("no queda sitio", "QuotaExceededError")
