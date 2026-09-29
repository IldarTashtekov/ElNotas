/**
 * Borra dist/web/ antes de compilar la app para el navegador.
 *
 * El mismo motivo que `clean-tmp-test.mjs`: `tsc` no limpia lo que sobra, así que
 * un fichero borrado o renombrado dejaría su `.js` viejo ahí, y el navegador lo
 * seguiría cargando si algo lo importara todavía.
 */
import { rmSync } from "node:fs"

rmSync("dist/web", { recursive: true, force: true })
