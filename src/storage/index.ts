/**
 * API pública del módulo de persistencia.
 *
 * Lo que hay aquí dentro son **implementaciones** de puertos que declara el core
 * (`Repository`, `StorageAdapter`, y en la Fase 3 `BlobStore`). La dependencia
 * va, como siempre, de fuera hacia dentro: `storage/` conoce al core; el core no
 * sabe que esto existe.
 *
 * Quien decide cuál de los adaptadores se usa de verdad no es este módulo: es
 * `platform/`, que no nace hasta la Fase 4 (`ARCHITECTURE.md` §4).
 *
 * La suite de contratos NO sale por aquí: es código de pruebas, y quien la
 * consume son otros ficheros de prueba del propio módulo, con import relativo.
 */

export { createMemoryStorageAdapter } from "./memory/MemoryStorageAdapter"

/* El escritor diferido: la mitad impura del write-behind. La otra mitad
   —`diffState`, que decide qué está sucio— es pura y vive en el core. */
export type { Cancel, Schedule, WriteBehind, WriteBehindDeps } from "./writeBehind"
export { createWriteBehind } from "./writeBehind"
