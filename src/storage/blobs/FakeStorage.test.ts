/**
 * Un `localStorage` de mentira, sobre un `Map`, **con inyección de excepciones**.
 *
 * Es lo que hace que `LocalStorageBlobStore` se pueda verificar entero en Node
 * (`ARCHITECTURE.md` §6.3, que lo describe como «un objeto falso de diez
 * líneas»; son más, y todas las de más son para poder fallar).
 *
 * ── Por qué aquí un doble SÍ es legítimo, y en el de la carpeta no ─────────
 *
 * Es el mismo razonamiento que justifica `FakeBlobStore`: lo que se prueba con
 * este doble es **la lógica de la capa de encima** —el espacio de nombres, el
 * base64, el recorrido de claves y, sobre todo, la traducción de excepciones—,
 * y para eso el almacén sólo tiene que comportarse como dice su especificación,
 * que en el caso de `Storage` son seis miembros y ninguna sorpresa.
 *
 * Lo que §6.3 descarta es al revés: usar un doble para probar una capa que **no
 * tiene lógica propia** y sólo traduce a una API del navegador. Ahí el doble
 * prueba lo que uno *cree* que hace la API. Aquí no hay nada que creer: un
 * `getItem` que no está devuelve `null` y punto.
 *
 * ── Lo que añade sobre un `Map`: poder lanzar ─────────────────────────────
 *
 * Sin eso quedaría sin probar justo lo que este `BlobStore` tiene de suyo: que
 * la excepción de cuota salga como `quota-exceeded` y no como `io`. Y como los
 * navegadores no se pusieron de acuerdo en cómo es esa excepción, hace falta
 * poder lanzar **cualquier cosa**, no una en concreto:
 *
 *     lanzarEn(op, loQueSea)   la siguiente llamada a esa operación lanza ESO
 *     escribirCrudo(k, v)      mete texto tal cual, sin pasar por base64
 *     claves()                 las claves de verdad, con su prefijo
 *
 * Se llama `.test.ts` por lo mismo que `FakeBlobStore.test.ts`: es código de
 * pruebas y no debe salir por `src/storage/index.ts`.
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
