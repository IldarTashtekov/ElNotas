/**
 * Guarda los cambios en el disco, pero no en el momento: espera a que dejes de
 * escribir. Teclear una palabra son veinte cambios, y guardar veinte veces la
 * nota entera no es viable.
 *
 * Si algo falla y reintentar no serviría de nada —permiso revocado, disco lleno—
 * se detiene en vez de insistir. Lo no guardado se queda en memoria: no se pierde.
 *
 * ⚠️ Lo que no da: si la app se cierra antes de que toque escribir, ese cambio se
 * pierde. Se paga llamando a `flush()` al cerrar, y eso es de la Fase 4.
 */

import type {
  AppState,
  Result,
  StateDiff,
  StorageAdapter,
  StorageError,
} from "#core/index"
import { NO_CHANGES, diffState, err, ok } from "#core/index"

/** Deshace una espera programada. */
export type Cancel = () => void

/** Cómo se programa la espera. Inyectable para poder probar sin esperas reales. */
export type Schedule = (fn: () => void, ms: number) => Cancel

export interface WriteBehindDeps {
  readonly adapter: StorageAdapter
  /**
   * Lo que ya está en el almacén cuando esto arranca. Normalmente el estado
   * recién hidratado — si se pasara uno vacío teniendo cosas guardadas, el
   * primer diff daría media app por nueva y la reescribiría entera.
   */
  readonly initial: AppState
  /** Milisegundos de calma antes de escribir. */
  readonly delayMs?: number
  readonly schedule?: Schedule
}

export interface WriteBehind {
  /** Se le pasa a `store.subscribe`. Tiene la forma exacta de `Listener`. */
  readonly onState: (state: AppState) => void
  /**
   * Escribe ya lo que haya pendiente y espera a que termine. Para el cierre de
   * la app, y para que las pruebas no dependan de temporizadores.
   *
   * Devuelve `ok` también cuando no había nada que escribir. Si devuelve `err`,
   * lo escrito se quedó sin escribir y **sigue en memoria**: nada se ha perdido.
   */
  readonly flush: () => Promise<Result<void, StorageError>>
}

const DEMORA_POR_DEFECTO_MS: number = 500

/**
 * La línea que este paso 0 existe para poder escribir.
 *
 * `io` es "cualquier otra cosa" —un fallo transitorio del que no se sabe más—, y
 * ahí volver a intentarlo es exactamente lo correcto. Los otros cuatro casos
 * describen situaciones que **no cambian solas**: el permiso seguirá revocado, la
 * carpeta seguirá sin existir, el disco seguirá lleno y el fichero seguirá
 * ilegible. Insistir sobre ellos no arregla nada y tapa el problema.
 */
const esReintentable = (fallo: StorageError): boolean => fallo.kind === "io"

const porSetTimeout: Schedule = (fn: () => void, ms: number): Cancel => {
  const id: ReturnType<typeof setTimeout> = setTimeout(fn, ms)
  return (): void => clearTimeout(id)
}

export const createWriteBehind = ({
  adapter,
  initial,
  delayMs = DEMORA_POR_DEFECTO_MS,
  schedule = porSetTimeout,
}: WriteBehindDeps): WriteBehind => {
  /** El último estado que se sabe guardado. El diff siempre se hace contra éste. */
  let escrito: AppState = initial
  /** El último estado recibido y todavía sin escribir. */
  let pendiente: AppState | null = null
  let cancelarEspera: Cancel | null = null
  /**
   * El fallo que ha detenido al escritor, si lo hay. Mientras no sea `null` no
   * se vuelve a tocar el almacén: reintentar un `permission-denied` es
   * exactamente lo que esto vino a quitar.
   */
  let detenido: StorageError | null = null

  /*
      Las escrituras se encadenan en vez de solaparse. Sin esto, un `flush()` a
      mano mientras el temporizador está escribiendo daría dos pasadas a la vez
      sobre el mismo `escrito`, y la segunda calcularía su diff contra un valor
      que la primera todavía no ha actualizado: se escribiría dos veces lo mismo.
  */
  let cola: Promise<void> = Promise.resolve()

  const escribirPendiente = async (): Promise<Result<void, StorageError>> => {
    /* Detenido por un fallo que no se arregla reintentando: ni se mira el
       pendiente. Se devuelve el mismo error una y otra vez, que es la verdad. */
    if (detenido !== null) return err(detenido)

    const objetivo: AppState | null = pendiente
    if (objetivo === null) return ok(undefined) // alguien se nos adelantó
    pendiente = null

    const cambios: StateDiff = diffState(escrito, objetivo)

    // ⚠️ LA LÍNEA DEL ESLABÓN ②: si no cambió nada, no se toca el disco.
    if (cambios === NO_CHANGES) {
      escrito = objetivo
      return ok(undefined)
    }

    /*
        El precio de devolver el fallo en vez de lanzarlo, y sin arreglo
        elegante: TypeScript no tiene operador de propagación, así que los seis
        bucles que antes cubría un solo `try` ahora se comprueban uno a uno, con
        corte al primer fallo. Es más ruidoso de leer; es lo que hay.

        Cortar en vez de seguir es deliberado: si el permiso está revocado, las
        otras cinco tandas van a fallar igual, y lo que interesa devolver es el
        PRIMER error, que es el que explica lo que pasó.
    */
    const resultado: Result<void, StorageError> = await adapter.transaction<void>(
      async (): Promise<Result<void, StorageError>> => {
        for (const n of cambios.notes.upserted) {
          const r: Result<void, StorageError> = await adapter.notes.put(n)
          if (!r.ok) return r
        }
        for (const p of cambios.plans.upserted) {
          const r: Result<void, StorageError> = await adapter.plans.put(p)
          if (!r.ok) return r
        }
        for (const c of cambios.contexts.upserted) {
          const r: Result<void, StorageError> = await adapter.contexts.put(c)
          if (!r.ok) return r
        }

        for (const id of cambios.notes.deleted) {
          const r: Result<void, StorageError> = await adapter.notes.delete(id)
          if (!r.ok) return r
        }
        for (const id of cambios.plans.deleted) {
          const r: Result<void, StorageError> = await adapter.plans.delete(id)
          if (!r.ok) return r
        }
        for (const id of cambios.contexts.deleted) {
          const r: Result<void, StorageError> = await adapter.contexts.delete(id)
          if (!r.ok) return r
        }

        return ok(undefined)
      },
    )

    if (!resultado.ok) {
      /* `escrito` NO se actualiza, así que el disco se queda oficialmente
         atrasado y el siguiente intento vuelve a traer estos cambios. Se
         restaura el pendiente sólo si nadie ha puesto otro más nuevo mientras
         tanto: si lo hay, ya incluye lo de éste. */
      pendiente = pendiente ?? objetivo

      if (!esReintentable(resultado.error)) {
        detenido = resultado.error
        /* Y se desprograma la espera que hubiera: lo que quedaba por hacer era
           volver a intentarlo, y ya se ha decidido que no. */
        if (cancelarEspera !== null) {
          cancelarEspera()
          cancelarEspera = null
        }
      }

      // El error viaja INTACTO: quien lo reciba necesita el `kind` de origen.
      return resultado
    }

    escrito = objetivo
    return ok(undefined)
  }

  const flush = (): Promise<Result<void, StorageError>> => {
    if (cancelarEspera !== null) {
      cancelarEspera()
      cancelarEspera = null
    }

    const siguiente: Promise<Result<void, StorageError>> =
      cola.then(escribirPendiente)
    /* La cola ya no necesita "perdonar" nada: un fallo de escritura es ahora un
       valor y no una excepción, así que no puede envenenar las escrituras
       futuras. Si algo llegara a rechazar aquí sería un adaptador incumpliendo
       su puerto —que promete no lanzar—, y eso tiene que hacer ruido. */
    cola = siguiente.then((): void => undefined)
    return siguiente
  }

  return {
    onState: (state: AppState): void => {
      /* El estado se recuerda pase lo que pase: aunque el escritor esté
         detenido, esto es lo que se guardará si algún día se reanuda. */
      pendiente = state
      if (cancelarEspera !== null) cancelarEspera()
      /* Pero no se programa nada si está detenido: esa espera sólo serviría para
         volver a fallar igual. */
      cancelarEspera =
        detenido !== null ? null : schedule((): void => void flush(), delayMs)
    },
    flush,
  }
}
