/**
 * Registros para las pruebas: uno que calla, para las que no miran el registro, y
 * otro que apunta qué se registró, para comprobar que un fallo no se pierde.
 */

import type { Logger } from "#core/index"

export const silentLogger: Logger = { failure: (): void => undefined }

export interface RecordingLogger {
  readonly logger: Logger
  /** El `what` de cada registro, en orden. */
  readonly logged: () => ReadonlyArray<string>
}

export const createRecordingLogger = (): RecordingLogger => {
  let apuntado: ReadonlyArray<string> = []
  return {
    logger: {
      failure: (what: string): void => {
        apuntado = [...apuntado, what]
      },
    },
    logged: (): ReadonlyArray<string> => apuntado,
  }
}
