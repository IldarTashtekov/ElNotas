/**
 * La copia automática de la app de Android: cada cierto tiempo, el mismo `.json`
 * de «Exportar copia» en `Documentos/ElNotas/`, con fecha y hora en el nombre.
 * Se queda con las tres últimas de esta instalación; las de otras no las toca.
 *
 * Aquí está la regla —cuándo toca, cómo se llama, cuál sobra— y quien la sigue,
 * con todo lo de fuera inyectado: escribir, borrar, leer lo guardado y apuntar
 * qué copias son suyas.
 */

import type { Clock, Logger, Result, StorageError } from "#core/index"
import type { AutoBackupStatus } from "#ui/index"

/** Cuántas copias suyas guarda: al escribir la siguiente, sobra la más vieja. */
export const COPIAS: number = 3

/** Como mucho, una copia cada tanto. */
export const PLAZO_MS: number = 12 * 60 * 60 * 1000

/** Tras un fallo no se vuelve a intentar enseguida: cada cambio lo repetiría. */
export const REINTENTO_MS: number = 10 * 60 * 1000

/** Lo que se apunta de las copias de esta instalación. */
export interface AutoBackupState {
  /** Los nombres de sus copias, de la más vieja a la más nueva. */
  readonly mias: ReadonlyArray<string>
  /** Milisegundos epoch de la última que se escribió, o `null`. */
  readonly ultima: number | null
  /** Milisegundos epoch del último fallo, o `null`. */
  readonly fallo: number | null
}

export const SIN_COPIAS: AutoBackupState = { mias: [], ultima: null, fallo: null }

const esInstante = (x: unknown): x is number | null => x === null || (typeof x === "number" && Number.isFinite(x))

/** Lo leído de donde se apunta → el estado. Si no tiene la forma, como si no hubiera copias. */
export const readAutoBackupState = (datos: unknown): AutoBackupState => {
  if (typeof datos !== "object" || datos === null) return SIN_COPIAS
  const { mias, ultima, fallo } = datos as Record<string, unknown>
  if (!Array.isArray(mias) || !mias.every((m: unknown): boolean => typeof m === "string")) return SIN_COPIAS
  if (!esInstante(ultima) || !esInstante(fallo)) return SIN_COPIAS
  return { mias: mias as ReadonlyArray<string>, ultima, fallo }
}

/**
 * ¿Toca hacer una ahora? Sí, si nunca se hizo o pasó el plazo desde la última, y
 * no falló hace menos de `REINTENTO_MS`. Un reloj que vuelve atrás cuenta como
 * plazo cumplido: si no, no habría copias hasta alcanzar la fecha de la última.
 */
export const isDue = (estado: AutoBackupState, ahora: number, plazo: number): boolean => {
  const desde = (instante: number | null): number => (instante === null ? Infinity : ahora - instante)
  const reciente = (instante: number | null, margen: number): boolean =>
    desde(instante) >= 0 && desde(instante) < margen
  return !reciente(estado.ultima, plazo) && !reciente(estado.fallo, REINTENTO_MS)
}

/** Escrita una copia: se apunta, y salen las que sobran, para borrarlas. */
export const afterWritten = (
  estado: AutoBackupState,
  nombre: string,
  ahora: number,
): { readonly estado: AutoBackupState; readonly sobran: ReadonlyArray<string> } => {
  const todas: ReadonlyArray<string> = [...estado.mias.filter((m: string): boolean => m !== nombre), nombre]
  const corte: number = Math.max(0, todas.length - COPIAS)
  return { estado: { mias: todas.slice(corte), ultima: ahora, fallo: null }, sobran: todas.slice(0, corte) }
}

export const afterFailed = (estado: AutoBackupState, ahora: number): AutoBackupState => ({ ...estado, fallo: ahora })

/** Lo que enseña la configuración: lo más reciente de las dos cosas. */
export const autoBackupStatus = (estado: AutoBackupState, ahora: number): AutoBackupStatus => {
  if (estado.fallo !== null && (estado.ultima === null || estado.fallo >= estado.ultima)) {
    return { kind: "failed", ago: ahora - estado.fallo }
  }
  if (estado.ultima !== null) return { kind: "done", ago: ahora - estado.ultima }
  return { kind: "none" }
}

/** ¿Hay algo que copiar? Con sólo el manifiesto guardado, la app está vacía. */
export const hasContent = (files: Readonly<Record<string, string>>): boolean =>
  Object.keys(files).some((camino: string): boolean => camino !== "manifest.json")

const dosCifras = (n: number): string => String(n).padStart(2, "0")

/** `elnotas-AAAA-MM-DD-HHMMSS.json`, con la hora de este dispositivo: una por copia. */
export const autoBackupFileName = (now: number): string => {
  const f: Date = new Date(now)
  const dia: string = [String(f.getFullYear()), dosCifras(f.getMonth() + 1), dosCifras(f.getDate())].join("-")
  const hora: string = [f.getHours(), f.getMinutes(), f.getSeconds()].map(dosCifras).join("")
  return `elnotas-${dia}-${hora}.json`
}

export interface AutoBackupDeps {
  /** La copia entera como texto, o `null` si no hay nada que copiar (la app vacía). */
  readonly collect: () => Promise<Result<string | null, StorageError>>
  /** Escribir y borrar registran ellas su fallo, con su causa. */
  readonly write: (nombre: string, texto: string) => Promise<boolean>
  readonly remove: (nombre: string) => Promise<boolean>
  readonly load: () => AutoBackupState
  /** Registra ella su fallo, con su causa. */
  readonly save: (estado: AutoBackupState) => boolean
  readonly clock: Clock
  readonly plazo: number
  readonly logger: Logger
}

export interface AutoBackup {
  /** Hace una si toca. Se puede llamar a menudo: si ya hay una en marcha, no hace nada. */
  readonly maybeRun: () => Promise<void>
  readonly status: () => AutoBackupStatus
}

export const createAutoBackup = (deps: AutoBackupDeps): AutoBackup => {
  let enMarcha: boolean = false
  /* Lo último apuntado, también en memoria: si no se puede guardar, el plazo y
     la cuenta siguen valiendo mientras la app esté abierta, en vez de escribir
     una copia nueva en cada cambio. */
  let enMemoria: AutoBackupState | null = null
  const leer = (): AutoBackupState => enMemoria ?? deps.load()

  const apuntar = (estado: AutoBackupState): void => {
    enMemoria = estado
    deps.save(estado)
  }

  const hacer = async (): Promise<void> => {
    const antes: AutoBackupState = leer()
    if (!isDue(antes, deps.clock.now(), deps.plazo)) return

    const copia: Result<string | null, StorageError> = await deps.collect()
    if (copia.ok && copia.value === null) return
    const nombre: string = autoBackupFileName(deps.clock.now())
    if (!copia.ok) deps.logger.failure("no se leyó lo guardado para la copia automática", copia.error)
    if (!copia.ok || !(await deps.write(nombre, copia.value ?? ""))) {
      apuntar(afterFailed(leer(), deps.clock.now()))
      return
    }

    const { estado, sobran } = afterWritten(leer(), nombre, deps.clock.now())
    apuntar(estado)
    /* La que no se borre se queda en la carpeta, ya fuera de la cuenta: mejor una
       de más que volver a intentarlo cada vez. */
    for (const vieja of sobran) await deps.remove(vieja)
  }

  return {
    maybeRun: async (): Promise<void> => {
      if (enMarcha) return
      enMarcha = true
      try {
        await hacer()
      } finally {
        enMarcha = false
      }
    },
    status: (): AutoBackupStatus => autoBackupStatus(leer(), deps.clock.now()),
  }
}
