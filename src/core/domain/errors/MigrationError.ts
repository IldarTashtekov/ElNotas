/**
 * Lo que puede ir mal al abrir notas guardadas por otra versión de la app, en
 * tres casos:
 *
 *     schema-from-future  lo guardado es más nuevo que este código
 *     missing-migration   falta un paso para llegar del formato viejo al de hoy
 *     migration-failed    el paso existe y reventó al ejecutarlo
 *
 * No es un fallo del disco: nada se ha roto al leer. Es que estos datos no se
 * pueden entender con este código, y en los tres casos seguir adelante los
 * corrompería.
 */
export type MigrationError =
  | { readonly kind: "schema-from-future"; readonly stored: number; readonly supported: number }
  | { readonly kind: "missing-migration"; readonly from: number }
  | { readonly kind: "migration-failed"; readonly from: number; readonly cause: unknown }
