/**
 * API pública de la UI.
 *
 * La UI sólo conoce al core: recibe el `Store` y los casos de uso ya montados, y
 * no sabe dónde se guarda nada. Quien la monta es `platform/`.
 */

export type { ContextsScreenDeps } from "./ContextsScreen.js"
export { mountContextsScreen } from "./ContextsScreen.js"
export { describeBootError, describeMigrationError, describeStorageError } from "./messages.js"
