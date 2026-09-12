/**
 * El escritor diferido: **la mitad impura del write-behind** (§6.4).
 *
 * *Write-behind* quiere decir que el disco va **por detrás** de la memoria. La
 * alternativa —escribir en el acto, en cada cambio— es inviable en una app de
 * notas: teclear una línea de veinte caracteres son veinte cambios de estado, y
 * con ellos veinte reserializaciones de la nota entera. De ahí la regla de §7:
 * **nunca guardar en cada tecla**.
 *
 * Vive fuera del core porque necesita un temporizador, y `setTimeout` no compila
 * dentro de la verja. La parte que puede equivocarse en silencio —qué está
 * sucio— es `diffState`, y ésa sí es pura y está en el core.
 *
 * ── El diff se calcula contra "lo último escrito", no contra el aviso anterior
 *
 * Es lo que hace que esto no necesite acumular nada. El `Listener` del `Store`
 * sólo recibe el estado nuevo, así que aquí se recuerda cuál fue el último que
 * llegó a disco; la diferencia entre ése y el de ahora **es** exactamente lo que
 * falta por guardar, por muchos avisos que hayan pasado en medio.
 *
 * Sale gratis un caso que de otra forma habría que tratar a mano: una nota
 * creada y borrada dentro de la misma ráfaga **no llega nunca a disco**, porque
 * no aparece en el diff.
 *
 * ── El orden: primero todo lo que se guarda, después lo que se borra ───────
 *
 * No es indiferente, y el motivo es qué queda en disco si el proceso muere a
 * mitad. Borrar una nota deja también contextos que la listaban y hay que
 * reescribir. Con este orden, el peor caso es un contexto ya limpio y una nota
 * que sobra: basura inofensiva. Al revés, el peor caso sería una `ItemRef`
 * apuntando a una nota que ya no existe, que es justo lo que prohíbe la regla de
 * integridad referencial.
 *
 * ⚠️ **Lo que este diseño NO da, y hay que saberlo:** si la app se cierra en la
 * ventana entre el cambio y la escritura, ese cambio se pierde. Es el precio
 * inherente de diferir y no se arregla con más debounce: se paga llamando a
 * `flush()` al cerrar, que es plataforma y por tanto Fase 4.
 */

import type { AppState, StorageAdapter } from "#core/index"
import { NO_CHANGES, diffState } from "#core/index"

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
   */
  readonly flush: () => Promise<void>
}

const DEMORA_POR_DEFECTO_MS = 500

const porSetTimeout: Schedule = (fn, ms) => {
  const id = setTimeout(fn, ms)
  return () => clearTimeout(id)
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

  /*
      Las escrituras se encadenan en vez de solaparse. Sin esto, un `flush()` a
      mano mientras el temporizador está escribiendo daría dos pasadas a la vez
      sobre el mismo `escrito`, y la segunda calcularía su diff contra un valor
      que la primera todavía no ha actualizado: se escribiría dos veces lo mismo.
  */
  let cola: Promise<void> = Promise.resolve()

  const escribirPendiente = async (): Promise<void> => {
    const objetivo = pendiente
    if (objetivo === null) return // alguien se nos adelantó
    pendiente = null

    const cambios = diffState(escrito, objetivo)

    // ⚠️ LA LÍNEA DEL ESLABÓN ②: si no cambió nada, no se toca el disco.
    if (cambios === NO_CHANGES) {
      escrito = objetivo
      return
    }

    try {
      await adapter.transaction(async () => {
        for (const n of cambios.notes.upserted) await adapter.notes.put(n)
        for (const p of cambios.plans.upserted) await adapter.plans.put(p)
        for (const c of cambios.contexts.upserted) await adapter.contexts.put(c)

        for (const id of cambios.notes.deleted) await adapter.notes.delete(id)
        for (const id of cambios.plans.deleted) await adapter.plans.delete(id)
        for (const id of cambios.contexts.deleted)
          await adapter.contexts.delete(id)
      })
    } catch (fallo) {
      /* `escrito` NO se actualiza, así que el disco se queda oficialmente
         atrasado y el siguiente intento vuelve a traer estos cambios. Se
         restaura el pendiente sólo si nadie ha puesto otro más nuevo mientras
         tanto: si lo hay, ya incluye lo de éste. */
      pendiente = pendiente ?? objetivo
      throw fallo
    }

    escrito = objetivo
  }

  const flush = (): Promise<void> => {
    if (cancelarEspera !== null) {
      cancelarEspera()
      cancelarEspera = null
    }

    const siguiente = cola.then(escribirPendiente)
    /* La cola se queda con la versión "perdonada": un fallo no puede envenenar
       todas las escrituras futuras. Quien llamó a `flush` sí ve la excepción. */
    cola = siguiente.catch(() => undefined)
    return siguiente
  }

  return {
    onState: (state) => {
      pendiente = state
      if (cancelarEspera !== null) cancelarEspera()
      cancelarEspera = schedule(() => void flush(), delayMs)
    },
    flush,
  }
}
