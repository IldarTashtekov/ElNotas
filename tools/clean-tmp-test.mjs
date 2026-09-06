/**
 * Borra tmp-test/ antes de cada compilación de pruebas.
 *
 * Por qué existe: `tsc` **no limpia lo que sobra**. Sólo emite. Si borras o
 * renombras un fichero de prueba, su `.js` compilado se queda ahí, y
 * `node --test` lo sigue ejecutando: pruebas fantasma de código que ya no
 * existe, y pruebas renombradas que corren dos veces.
 *
 * No es hipotético — se descubrió justo así: tras borrar una prueba de humo,
 * `require-tests.mjs` seguía dando por buena la compilación por culpa del `.js`
 * huérfano que había quedado atrás.
 *
 * Se usa `node:fs` en vez de `rm -rf` para que el comando no dependa del shell.
 */
import { rmSync } from "node:fs"

rmSync("tmp-test", { recursive: true, force: true })
