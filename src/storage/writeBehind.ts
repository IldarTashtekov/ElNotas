/**
 * Guarda los cambios en el disco, pero no en el momento: espera a que dejes de
 * escribir. Teclear una palabra son veinte cambios, y guardar veinte veces la
 * nota entera no es viable.
 *
 * Si algo falla y reintentar no serviría de nada —permiso revocado, disco lleno—
 * se detiene en vez de insistir, y avisa con `onError`. Lo no guardado se queda
 * en memoria: no se pierde mientras la página siga abierta.
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

/** A quién se avisa cuando el escritor se detiene. */
export type OnError = (fallo: StorageError) => void

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
  /**
   * Se llama UNA vez, cuando un fallo que no se arregla reintentando detiene al
   * escritor. Sin esto, el fallo de un guardado automático no lo vería nadie:
   * nadie mira lo que devuelve el temporizador.
   */
  readonly onError?: OnError
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
 * ahí volver a intentarlo es exactamente lo correcto. Los otros cinco casos
 * describen situaciones que **no cambian solas**: el permiso seguirá revocado, la
 * carpeta seguirá sin existir, el disco seguirá lleno, el fichero seguirá
 * ilegible y lo que cambió otra pestaña seguirá cambiado. Insistir sobre ellos no
 * arregla nada y tapa el problema —en el último, además, pisaría—.
 */
const esReintentable = (fallo: StorageError): boolean => fallo.kind === "io"

/**
 * Pasa el aviso. **Frontera**: es código ajeno. Si revienta, el fallo sigue
 * saliendo por `flush()`, así que tragarse aquí la excepción no esconde nada.
 */
const avisar = (onError: OnError | undefined, fallo: StorageError): void => {
  if (onError === undefined) return
  try {
    onError(fallo)
  } catch {
    /* El aviso no puede tumbar al escritor: lo que tenía que decir, ya lo dice flush. */
  }
}

/** El mismo mapa sin esa entidad. */
const sin = <TId extends string, T>(mapa: Readonly<Record<TId, T>>, id: TId): Readonly<Record<TId, T>> =>
  Object.fromEntries(
    Object.entries<T>(mapa).filter(([clave]: [string, T]): boolean => clave !== id),
  ) as Record<TId, T>

const porSetTimeout: Schedule = (fn: () => void, ms: number): Cancel => {
  const id: ReturnType<typeof setTimeout> = setTimeout(fn, ms)
  return (): void => clearTimeout(id)
}

export const createWriteBehind = ({
  adapter,
  initial,
  delayMs = DEMORA_POR_DEFECTO_MS,
  schedule = porSetTimeout,
  onError,
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
        /* Cada escritura dice qué espera encontrar: la revisión de lo que se
           tiene por guardado, o `null` si es nuevo. Si otra pestaña lo cambió
           entretanto, sale `stale` y no se pisa. Y cada una que sale bien se
           apunta YA en `escrito`: si la tanda se corta a medias y se reintenta,
           lo ya escrito no se vuelve a escribir esperando la revisión vieja,
           que daría un `stale` falso. */
        for (const n of cambios.notes.upserted) {
          const r: Result<void, StorageError> = await adapter.notes.put(n, escrito.notes[n.id]?.revision ?? null)
          if (!r.ok) return r
          escrito = { ...escrito, notes: { ...escrito.notes, [n.id]: n } }
        }
        for (const p of cambios.plans.upserted) {
          const r: Result<void, StorageError> = await adapter.plans.put(p, escrito.plans[p.id]?.revision ?? null)
          if (!r.ok) return r
          escrito = { ...escrito, plans: { ...escrito.plans, [p.id]: p } }
        }
        for (const c of cambios.contexts.upserted) {
          const r: Result<void, StorageError> = await adapter.contexts.put(c, escrito.contexts[c.id]?.revision ?? null)
          if (!r.ok) return r
          escrito = { ...escrito, contexts: { ...escrito.contexts, [c.id]: c } }
        }

        for (const id of cambios.notes.deleted) {
          const r: Result<void, StorageError> = await adapter.notes.delete(id, escrito.notes[id]?.revision ?? null)
          if (!r.ok) return r
          escrito = { ...escrito, notes: sin(escrito.notes, id) }
        }
        for (const id of cambios.plans.deleted) {
          const r: Result<void, StorageError> = await adapter.plans.delete(id, escrito.plans[id]?.revision ?? null)
          if (!r.ok) return r
          escrito = { ...escrito, plans: sin(escrito.plans, id) }
        }
        for (const id of cambios.contexts.deleted) {
          const r: Result<void, StorageError> = await adapter.contexts.delete(id, escrito.contexts[id]?.revision ?? null)
          if (!r.ok) return r
          escrito = { ...escrito, contexts: sin(escrito.contexts, id) }
        }

        return ok(undefined)
      },
    )

    if (!resultado.ok) {
      /* `escrito` sólo tiene lo que llegó a escribirse, así que el siguiente
         intento trae lo que faltó, y nada más. Se restaura el pendiente sólo si
         nadie ha puesto otro más nuevo mientras tanto: si lo hay, ya incluye
         lo de éste. */
      pendiente = pendiente ?? objetivo

      if (!esReintentable(resultado.error)) {
        detenido = resultado.error
        /* Y se desprograma la espera que hubiera: lo que quedaba por hacer era
           volver a intentarlo, y ya se ha decidido que no. */
        if (cancelarEspera !== null) {
          cancelarEspera()
          cancelarEspera = null
        }
        /* Sólo aquí: una vez detenido, `flush` sale antes y ya no llega. */
        avisar(onError, resultado.error)
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
