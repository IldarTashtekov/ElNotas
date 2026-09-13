/**
 * Lo que puede ir mal al hablar con un almacén (`ARCHITECTURE.md` §6.5).
 *
 * Vive en `domain/errors/` y no en `ports/`, aunque sólo lo produzcan los
 * adaptadores: un error es **una entidad del dominio más**, al mismo nivel que
 * `Note` o `Context`. Es parte de lo que la app sabe decir, y quien lo consume
 * —la UI, que decide si reintentar o avisar— no tiene por qué entrar en la
 * carpeta de los puertos a buscarlo. `Result`, en cambio, se queda suelto en
 * `domain/`: es el sobre, no lo que va dentro.
 *
 * ── El criterio de la taxonomía es «¿reintentar sirve de algo?» ────────────
 *
 * No es qué mensaje sale en pantalla, sino qué puede hacer el programa a
 * continuación. Por eso son casos separados y no un error genérico con texto:
 *
 *     permission-denied  no  vuelve a pedir la carpeta; lo no guardado sigue en memoria
 *     not-found          no  avisa de que la carpeta ya no existe y ofrece otra
 *     quota-exceeded     no  deja de intentarlo y avisa de que hay que hacer hueco
 *     corrupt            no  aísla esa entidad y sigue con el resto, diciendo cuál
 *     io                 sí  reintenta en silencio; si persiste, avisa
 *
 * Hoy el write-behind reintenta **siempre, a ciegas**, porque con `Promise<void>`
 * no hay dónde poner esta información. Ésa es toda la razón de esta decisión.
 *
 * ── `corrupt` NO va dentro de `io`, y es deliberado ────────────────────────
 *
 * Si un solo fichero de nota está corrupto, lo correcto es apartar esa nota y
 * abrir todas las demás. Por el camino genérico la app reintentaría leerla
 * eternamente y parecería que está todo roto cuando sólo falla una nota: la
 * diferencia entre perder una nota y creer que las has perdido todas.
 *
 * ── Ausencia no es fallo ───────────────────────────────────────────────────
 *
 * `not-found` es "la carpeta o el fichero han desaparecido", no "esa nota no
 * está guardada". Preguntar por algo que nunca se guardó devuelve `ok(null)`, y
 * borrar lo que no existe tampoco es error: colapsar «no está» con «no he podido
 * mirar» sería perder justo la información que luego hace falta.
 *
 * ── `cause` existe para depurar, no para enseñar ───────────────────────────
 *
 * Guarda el `unknown` que vino de la plataforma —con `useUnknownInCatchVariables`
 * eso es literalmente lo que trae un `catch`—. Al usuario se le enseña el `kind`,
 * que es lo que está en castellano y lo que tiene una acción asociada.
 *
 * ── Lo que falta a propósito ───────────────────────────────────────────────
 *
 * No hay caso de **conflicto de escritura** (dos pestañas pisándose). El modelo
 * tiene la pieza para detectarlo —`revision`— pero el mecanismo de "escribe sólo
 * si nadie lo ha tocado" no está construido: `Repository.put` no recibe revisión,
 * así que nadie podría disparar ese error. Queda anotado en `TAREAS.md` como lo
 * primero que se añadirá aquí el día que el mecanismo exista.
 *
 * Unión discriminada por `kind`, como todas las del proyecto: quien la consuma
 * con un `switch` lo tiene exhaustivo, y añadir un caso rompe la compilación en
 * vez de colarse en silencio.
 */
export type StorageError =
  | { readonly kind: "permission-denied" }
  | { readonly kind: "not-found"; readonly path: string }
  | { readonly kind: "quota-exceeded" }
  | { readonly kind: "corrupt"; readonly path: string; readonly cause: unknown }
  | { readonly kind: "io"; readonly cause: unknown }
