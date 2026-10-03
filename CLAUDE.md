# ElNotas

App de notas personal, en TypeScript. **Web primero**, con desktop y móvil previstos más
adelante (shells nativos sobre la misma UI web).

Tres documentos, y cada uno tiene un trabajo:

| Fichero | Qué hay dentro |
|---|---|
| **`CLAUDE.md`** (este) | las reglas. Corto a propósito: se carga en cada sesión |
| **`ARCHITECTURE.md`** | el diseño, sus **por qués**, los conceptos explicados desde cero y el plan por fases razonado |
| **`TAREAS.md`** | qué está pendiente, qué está **sin decidir**, y las ideas aparcadas |

Si vas a discutir una decisión de diseño, léela primero en `ARCHITECTURE.md`: casi todas
tienen ya un motivo escrito y alternativas descartadas.

## Estado actual del repo

**Verificado, no copiado.** Si vas a afirmar algo sobre lo que existe, cuánto hay o si algo
pasa, compruébalo antes: `find src test -name '*.ts' | sort`, `npm run check`,
`git log --oneline`.

**Medido el 2026-10-03:** `npm run check` en verde —sus seis pasos— con **532 pruebas** (la Fase
4 empezó con 329; al terminar el código de Fase 4 · Contextos eran 423). Líneas de `.ts`:
`src/core` 2320, `src/storage` 1577, `src/platform` 321, `src/ui` 2442; `test/` 7195. *(Las
cifras envejecen solas: si no cuadran, manda `npm test`, no este párrafo.)*

**Fases 1, 2 y 3 terminadas. La 4, con el código hecho y SIN CERRAR:** faltan las dos listas de
verificación manual y las tres preguntas del editor (ver *Plan por fases*).

Lo que hay en `src/`, de dentro afuera:

- **`src/core/` — dominio puro, y la referencia de cómo se hacen las cosas aquí.** El modelo
  (`Note`, `Plan`, `Context`, `Text` | `CheckBox`, IDs marcados, `ItemRef`, `AppState`
  normalizado), `Position` (tres casos), el helper de copia por camino en dos primitivas
  (`updateContent.ts` y `updateContainerOf.ts`, **maquinaria interna: no salen por
  `index.ts`**), **las ocho operaciones** en `operations.ts`, `Result<T, E>` y las dos
  taxonomías de error en `domain/errors/`, **los cinco puertos** (sólo interfaces), **las
  diecisiete acciones** con `reduce` (que no sale por `index.ts`), `createStore` (una función,
  no una clase), `createUseCases` y `diffState`, y la mitad pura del arranque (`hydrate`,
  `runMigrations`; `MIGRATIONS` **vacía a propósito**). Ni un `throw`.
- **`src/storage/` — implementa los puertos de persistencia.** `MemoryStorageAdapter`,
  `FileStorageAdapter` (formato en disco de §6.2, con **`onCorrupt`** y la **validación de
  esquema** de `file/schema.ts`), las dos de `BlobStore` en `blobs/` —`LocalStorageBlobStore` y
  `DirectoryHandleBlobStore`, ésta **sin pruebas a propósito** (§6.3)— y el `writeBehind`, con
  su **`onError`**. La suite de contratos (22 casos, `test/storage/contract-tests/`) corre tres
  veces: memoria · fichero + `BlobStore` falso · fichero + `LocalStorageBlobStore` real.
- **`src/platform/web/` — la composición.** `SystemClock` y `CryptoIdGenerator`, las únicas
  implementaciones de `Clock` e `IdGenerator`; `boot.ts`, que monta la pila entera;
  `LocalStorageWindows.ts`, la lista de ventanas; y `main.ts`, la entrada que carga
  `index.html`. Hoy se guarda en `LocalStorageBlobStore`.
- **`src/ui/` — vanilla.** Las cuatro vistas de §7.4 salvo la de plan, el editor con casillas
  anidadas y los avisos de `onCorrupt` y `onError`. Cómo está construida, en §7.5.

**Qué se prueba dónde:** *lo que exige la interfaz va en el contrato; lo que sólo tiene una
implementación, en un fichero aparte*. Por eso el adaptador de memoria no tiene ni una prueba
propia y el de fichero sí (§6.3). Si una prueba pudiera escribirse contra la interfaz, su sitio
es el contrato. **En la UI, lo que decide la pantalla es una función pura con pruebas en Node;
el DOM de encima es delgado y se verifica a mano** con `test/ui/VERIFICACION-MANUAL.md` y
`VERIFICACION-MANUAL-EDITOR.md`. No hay pruebas automáticas del DOM, a propósito.

**`DirectoryHandleBlobStore` se verificó a mano el 2026-09-13** (`test/storage/blobs/
VERIFICACION-MANUAL.md`: Brave pasa las cinco secciones; Firefox, sólo OPFS). ⚠️ Se pasó sobre
`dec4306` **con el árbol sucio**, y ese asterisco se conserva. **Si tocas ese fichero, se
vuelve a pasar la lista**; la única excepción registrada —mismo código una vez quitados los
comentarios— está en `TAREAS.md`.

**Lo que NO existe todavía:** todo lo de Planes salvo sus tipos (Fase 5), la carpeta del usuario
y OPFS como destino de la app y el botón de «reconectar carpeta».

**`npm run check` no puede pasar en falso:** `tools/require-tests.mjs` sale con código 1 si no
encuentra ningún `*.test.js` en `tmp-test/test/`, porque `node --test` sin ficheros imprime
`1..0` y sale con código 0. **No lo "arregles" quitando el guardián.** Mira `tmp-test/test/` y
no `tmp-test/` a secas **a propósito**: así también caza que las pruebas compilen a un sitio
distinto de donde las busca el runner.

⚠️ **Cada guarda y cada invariante se verifica ROMPIÉNDOLA a propósito** y comprobando que las
pruebas caen. Una prueba de identidad que no salta al romper lo que vigila no vale nada, y un
`deepEqual` pasaría igual de verde. Es la disciplina de este repo, no una floritura.

## Estructura y límites

```
src/
├── core/          # dominio + casos de uso + puertos. CERO plataforma.
│   ├── domain/    # ← modelo + Position + helper + las 8 operaciones + Result
│   │   └── errors/#   ← StorageError y MigrationError. Sin index.ts, como domain/
│   ├── ports/     # ← los CINCO: Clock, IdGenerator, Repository, StorageAdapter, BlobStore
│   ├── app/       # ← las 17 acciones + reduce + Store + useCases + diffState
│   ├── migrations/# ← hydrate + runMigrations (la mitad PURA del arranque)
│   └── index.ts
├── storage/       # ← implementa los puertos de persistencia. Conoce al core; él a ella no.
│   ├── memory/    # ← MemoryStorageAdapter
│   ├── file/      # ← FileStorageAdapter (§6.2) + schema.ts, la validación al leer
│   ├── blobs/     # ← las dos de BlobStore, que es OTRO puerto (§6.1)
│   └── index.ts
├── ui/            # ← vanilla. Conoce sólo al core: no sabe dónde se guarda nada
│   └── index.ts
└── platform/      # ← composición: el ÚNICO sitio que inyecta adaptadores. Nadie la importa
    ├── web/       # ← SystemClock, CryptoIdGenerator, boot, LocalStorageWindows, main
    └── index.ts

test/              # LAS PRUEBAS, fuera de src/ y partidas por capa (espejo de src/)
├── core/          # ← domain/ (+ errors/) · app/ · migrations/
├── storage/       # ← contract-tests/ · memory/ · file/ · blobs/
├── platform/web/
└── ui/            # ← incluye las dos listas de verificación manual de la Fase 4

index.html         # la página: carga dist/web/ con un importmap, sin bundler (§8.6)
```

- **Las pruebas van en `test/`, no al lado del código.** La carpeta es un **espejo** de `src/`:
  lo que prueba `src/core/domain/operations.ts` está en `test/core/domain/operations.test.ts`.
  Consecuencias, las tres:
  - **desde `test/` se importa por alias, incluso lo que `index.ts` no exporta**
    (`#core/domain/updateContent`, `#storage/file/FileStorageAdapter`). Es la excepción a la
    regla de cruzar siempre contra el `index.ts`, y es inevitable: quien prueba maquinaria
    interna tiene que poder nombrarla. Entre ficheros de `test/`, relativo;
  - **un ayudante que no contiene pruebas NO lleva `.test`** —`FakeBlobStore.ts`,
    `FakeStorage.ts`, `contract-tests/storageContract.ts`—, porque `node --test` sólo ejecuta
    los `*.test.js` y así no se abre un fichero de pruebas para encontrar un doble;
  - **las listas de verificación manual también viven ahí** (`test/storage/blobs/`,
    `test/ui/`): son pruebas, y lo único que las distingue de sus vecinas es que las ejecutan
    unas manos.

- **La verja de pureza es un error de compilación, no una convención.**
  `src/core/tsconfig.json` va sin `DOM` en `lib` y con `"types": []`, así que dentro del core
  un `document.` o un `crypto.randomUUID()` **no compila**. Si necesitas IDs, hora o azar,
  **inyéctalos por puerto** (`IdGenerator`, `Clock`). Los tests quedan fuera de la verja **por
  vivir en `test/`**, no por una exclusión: ahí sí pueden usar `node:test` y `node:assert`.
- **El reloj y el azar los tapa un guardián aparte, no el compilador.** `Date.now()`,
  `new Date()` y `Math.random()` **sí compilan** en el core —están en `lib.es5.d.ts`, dentro
  de `lib: ["ES2020"]`—, así que el typecheck **no** los caza. Los caza
  `npm run check:purity` (`tools/check-core-purity.mjs`), que mira sólo el código: los
  comentarios y las cadenas pueden mencionarlos, y un `${Date.now()}` dentro de una plantilla
  también salta. Sigue siendo falso decir que el typecheck bloquea el reloj.
- **No añadas `baseUrl` ni `paths`.** `baseUrl` está deprecado en TS 6 y se retira en TS 7, y
  los alias van en el campo `imports` de `package.json`.
- **Un alias se declara cuando el módulo existe**, no antes. Hoy existen los cuatro —`#core/*`,
  `#storage/*`, `#platform/*`, `#ui/*`— y el `importmap` de `index.html` los calca: **si
  añades uno, va en los dos sitios.**
- **Un `index.ts` por módulo** como API pública. Lo que no esté ahí, para los demás módulos no
  existe.

## Reglas al escribir código

- **Cruzar de módulo, siempre por alias contra el `index.ts`; dentro del módulo, relativo y
  CON `.js`:**
  ```ts
  import { Note } from "#core/index"            // ✅ desde ui/, storage/, platform/
  import { Note } from "../../core/domain/Note" // ❌
  import { Note } from "./domain/Note.js"       // ✅ dentro del propio core
  import { Note } from "./domain/Note"          // ❌ el navegador pide ./domain/Note y da 404
  ```
  El `.js` en los relativos de `src/` es porque el navegador carga el JS compilado tal cual y
  no adivina extensiones (§8.6). Lo vigila `npm run check:extensiones`: sin él, un import sin
  `.js` pasa todas las pruebas —compilan a CommonJS— y sólo se nota al abrir la app.
- **Inmutabilidad:** en arrays usar `filter` / `map` / spread, **nunca** `push` / `splice`.
  Los tipos `readonly` la fuerzan.
- **⚠️ PRESERVAR LA IDENTIDAD CUANDO NO HAY CAMBIOS.** La invariante más fácil de romper sin
  darse cuenta: si una operación de dominio o el reducer no cambian nada, **devuelven el mismo
  objeto de entrada**, no una copia equivalente. Ojo: `map` y `filter` devuelven **siempre**
  array nuevo, y `{ ...n, checked }` crea objeto nuevo aunque el valor ya fuera ese. Hacen
  falta envoltorios que comparen y devuelvan la entrada intacta. Romper esto no hace fallar
  ningún test obvio: la app funciona, solo redibuja y escribe de más. Las cuatro decisiones
  que cuelgan de esta invariante están en `ARCHITECTURE.md` §3.
- **Tests de identidad con `assert.strictEqual`, nunca `deepEqual`.** Un `deepEqual` pasa
  igual de verde con una implementación que rompe la invariante.
  **Única excepción, y está razonada: la suite de contratos de `storage/`**, que compara por
  valor a propósito. Un almacén no promete devolver el mismo objeto —el de fichero devuelve
  uno salido de un `JSON.parse`—, así que exigir `strictEqual` ahí sería exigir algo que sólo
  el adaptador de memoria puede cumplir. **No lo "arregles".**
- **El reducer, puro y total:** no genera IDs, no lee el reloj y no lanza excepciones. Las
  acciones llevan un `meta: { now, revision }` construido por la capa de casos de uso, que es
  la que tiene inyectados `Clock` e `IdGenerator`.
- **Una operación que no aplica NO HACE NADA** en lugar de fallar. Así una acción inocua
  tampoco ensucia `updatedAt` ni `revision`. Enumerar los casos no-op es **la mitad de la
  especificación** de cada operación (tabla en `ARCHITECTURE.md` §9.3).
- **Los errores no se propagan: se devuelven.** Lo que pueda fallar devuelve
  `Result<T, StorageError>`, no lanza. Un `throw` no sale en ninguna firma, así que quien llama
  no se entera. **El `try/catch` no desaparece, se confina:** vive sólo en las funciones frontera
  que hablan con lo que lanza —**trece en todo el código de producción**: **cinco** en
  `FileStorageAdapter` (`caminoDe`, `aBytes`, `parsear`, `transaction` y el aviso `onCorrupt`),
  una en `writeBehind` (el aviso `onError`), una en `MemoryStorageAdapter`, una en cada
  `BlobStore`, una en `runMigrations` (la migración ajena), **dos** en `LocalStorageWindows`
  (leer y escribir) y una en `main.ts` (`window.localStorage` lanza si el navegador bloquea los
  datos del sitio)— y las traduce. Por encima de esa línea nada lanza, **y eso incluye el código
  ajeno**: una excepción dentro de `transaction`, de una migración o de un aviso **no escapa**.
  Ojo: **ausencia no es fallo** — `get` de algo que no está es `ok(null)`. El porqué, en §6.5.
- **⚠️ EL PELIGRO NO ES EL `throw`: ES LA LLAMADA SIN ENVOLVER.** No hay ni un `throw` en el
  repo y aun así se escaparon dos excepciones (`encodeURIComponent` en `caminoDe` y
  `paso.migrate()`). **Antes de llamar a algo de plataforma o a un aviso ajeno, pregúntate si
  lanza**, y si lanza, que esté dentro de un `try`, de `frontera()`/`transaction()`, o de un
  ayudante al que sólo se llame desde dentro de una frontera —esto último es **frágil a
  propósito de reconocer**—. Lo vigila `npm run check:fronteras`, que mira los cuatro módulos,
  pero **su lista de lo peligroso se mantiene a mano**: si llamas a una API nueva que lanza,
  añádela ahí.
- **Un error es una entidad del dominio: nace en `src/core/domain/errors/`**, no en el módulo
  que da la casualidad de producirlo. La carpeta **no lleva `index.ts`** —`domain/` tampoco—
  porque la API pública del módulo es `src/core/index.ts`. **`Result.ts` se queda suelto en
  `domain/`, fuera de `errors/`:** es el sobre, no lo que va dentro. §6.5.
- **`setChecked`, no `toggleChecked`.** Un `toggle` no puede ser nunca un no-op; el nombre
  sostiene la invariante de identidad. Vale como criterio general al nombrar operaciones del
  dominio. *(En `ui/editor.ts` sí hay un `toggleChecked`: es el gesto del usuario, y por debajo
  llama a `setChecked` con el valor ya decidido.)*
- **Integridad referencial:** no se deja una referencia apuntando a algo que **no está en el
  almacén** —una nota **ilegible** sí está: su referencia se conserva aunque no se cargue, y
  quien recorra `items` tiene que tolerar una sin nota—. Borrar
  una nota tiene que quitarla de los contextos que la listaban; añadir a un contexto una
  referencia a algo que no existe es un no-op. Fuera del core, la lista de ventanas la
  sostiene una guarda pura (`guardWindows`, §7.4).
- **`noUncheckedIndexedAccess` está activo.** Indexar `Record<NoteId, Note>` devuelve
  `Note | undefined`; hay que tratar el caso "ese id no existe".
- **TODO lleva tipo explícito, aunque TypeScript lo infiera**, y "todo" son tres cosas: las
  **declaraciones de valor** (`let numero: number = 1`), los **parámetros** y el **tipo de
  retorno** de toda función o método — **incluidos los callbacks de una línea** que se pasan a
  un `.map`, un `.filter` o un `.find`:
  ```ts
  const afectados: ReadonlyArray<Context> = Object.values<Context>(contexts).filter(
    (ctx: Context): boolean => ctx.items.some((i: ItemRef): boolean => mismoItem(i, item)),
  )
  ```
  El porqué es el mismo en los tres: cuando un tipo cambia, **se ve en el diff** en vez de que
  la inferencia lo absorba en silencio. **Rige en `src/` Y en `test/`.**

  **CUATRO excepciones, y sólo la primera no es una elección:**
  1. **`for (const x of …)`** — `error TS2483`: lo prohíbe el lenguaje, no el criterio;
  2. **la constante que ES una función** (`const setText = (…): X => …`) — ese trabajo lo hace
     el tipo de retorno. Ojo: los **parámetros y el retorno de esa función sí van anotados**;
  3. **`as const`** — la anotación ensancha justo lo que `as const` estrecha;
  4. **destructuring** — no hay dónde ponerlo sin repetir la forma del objeto entero.

  **Estado:** `src/` **la cumple entero**, comprobado el 2026-09-29 con una sonda sobre el AST
  —ni una declaración, parámetro o retorno sin tipo fuera de las cuatro excepciones—. **Las
  pruebas viejas de `test/core/` y `test/storage/` NO la cumplen, y se quedan así a propósito:**
  es deuda conocida y medida en `TAREAS.md`, no un precedente. **Lo que escribas o toques en
  `test/` sí la cumple.**

  **No hay comprobación automática, y es deliberado:** esta regla es legibilidad, no
  corrección —el compilador ya dice si un tipo está mal—, y los guardianes que existen tapan
  cosas que **funcionan mal en silencio**. El razonamiento, en `TAREAS.md`. **No lo vuelvas a
  proponer.**
- **`Context.items` es `ItemRef[]`, nunca `(Note | Plan)[]`.** No negociable.
- **Nada de credenciales en el repo ni en el bundle.** En web, OAuth con PKCE y token en
  memoria, **nunca** en localStorage. En desktop, keychain del sistema.
- **Los comentarios del código van en castellano**, igual que la documentación.
- **La cabecera de un fichero responde a «¿para qué sirve esto?» y para ahí.** De tres a ocho
  líneas, en lenguaje que entienda quien no programa: qué hace y, si lo tiene, el precio. **El
  porqué NO va en el código**, va en `ARCHITECTURE.md`: una cabecera que argumenta una decisión
  es esa sección copiada, y las copias se separan del original sin que nadie lo note.
- **⚠️ NADA de `§` en el código, ni en cabecera ni dentro.** Apunta a un número que se renumera
  solo y nada comprueba esos punteros. La frase casi siempre sobrevive sin él. Si de verdad hay
  que señalar un documento, se nombra el **fichero**, que no se renumera.
- **Los comentarios de dentro se quedan: son los que pagan su sitio.** Cortos, pegados a la
  línea que explican y diciendo lo que el código no dice. Al quitar una cabecera, **lo que
  explicara y no esté ya en `ARCHITECTURE.md` se mueve allí**, no se borra.

## Dependencias

**No se instala una dependencia hasta la fase en que se usa de verdad**, y se desinstala si
deja de usarse. Cero `dependencies` de runtime. Antes de añadir un paquete, comprobar si Node,
TypeScript o el navegador ya lo hacen nativamente.

Estado actual: **`typescript` y `@types/node`. Nada más** — el árbol entero son **tres
paquetes** (los dos, más el `undici-types` que arrastra `@types/node`) y 0 vulnerabilidades.
**La Fase 4 entera —UI incluida— se hizo sin instalar ni un paquete.** Lo que cuenta es el
`package-lock.json`, no las carpetas de `node_modules`, donde quedan directorios vacíos de
desinstalaciones viejas.

**No hay bundler ni servidor de desarrollo, y no se echan en falta:** `npm run build:web`
compila con `tsc` y la página se sirve con cualquier servidor estático (ver *Comandos*).
Webpack y `webpack.config.js` ya no están en el repo. Un bundler entra sólo cuando algo concreto
lo exija.

## Decisiones cerradas — no volver a proponer alternativas

Los motivos están en `ARCHITECTURE.md`. Si crees que una está equivocada, **plantéalo como
duda**; no la cambies por tu cuenta.

- **Carpetas con límites por `tsconfig`**, no monorepo con workspaces.
- **UI vanilla**, no React/Svelte/Solid — **ni Angular, ni Redux, ni htmx**. Reconfirmada el
  2026-09-20: **`Store.ts` ya es Redux** (65 líneas, con la invariante de identidad que Redux no
  da), y el DOM virtual es débil justo donde esta app es difícil —`contenteditable`—. Las dos
  alternativas que sobrevivieron están aparcadas con su disparador en `TAREAS.md`: **Snabbdom**
  y un **motor de edición** (ProseMirror/Lexical). Si vuelve a surgir, se lee esa tabla.
- **Estado normalizado con `ItemRef`**, no entidades anidadas.
- **`Versioned` con `revision` como token opaco**, no `version: number` ni "gana el último".
- **Marcar una casilla NO arrastra a sus hijas.** La cascada se compone en la UI.
- **Espejo con local como primario**, no sync bidireccional.
- **File System Access API** para el fichero local en web, con OPFS como fallback.
- **Un fichero por entidad** (`notes/<id>.json`) más un `manifest.json`.
- **`node:test` como runner**, no vitest ni jest (vitest: ~64M para algo que Node ya trae).
- **Las pruebas viven en `test/`, espejo de `src/` y partido por capa**, no junto al fichero que
  prueban: que `src/` sea sólo código, separado por carpeta y no por sufijo. Precio asumido: el
  alias profundo desde `test/`, y que la condición `compiled` de `package.json` apunte a
  `tmp-test/src/…`. §8.5.
- **Alias por el campo `imports` de package.json**, no `paths` ni `resolve.alias`.
- **Dependencias solo cuando la fase las necesita.** No instalar "para tenerlo listo".
- **La Fase 1 termina por el criterio de `Versioned`:** lo que opera por debajo de `Versioned`
  es Fase 1; producir entidades es Fase 2.
- **El helper de copia por camino son DOS primitivas:** A (transformar un nodo) y B
  (transformar el array contenedor), con la recursión de la A escrita **una sola vez**. §5.4.
- **`Position` tiene tres casos** —`root-end`, `after`, `last-child-of`— **y ninguno más**, y su
  único consumidor es `insert`. ⚠️ **No los justifiques por la forma que tenga la barra de
  edición**: atar una pieza del dominio a la UI es atarla a lo que más cambia, y ya quedó falso
  una vez. §9.4.
- **Las operaciones de contenido son OCHO**: `setText`, `setChecked`, `insert`, `remove`,
  `split`, `merge`, `convertToCheckBox`, `convertToText`. §9.3.
- **Tampoco existe `move`.** Consecuencia asumida: **una lista se queda en el orden en que se
  escribió**; reordenar es borrar y reescribir. Aparcada en `TAREAS.md`. §9.3.
- **No existen `indent` ni `outdent`.** En el teclado de un móvil no hay Tabulador. El nivel de
  una línea **se elige al nacer**, con el interruptor de casilla y con el disparador de anidar;
  el Tabulador solo mete un carácter. ⚠️ **El botón de anidar NO es `indent` disfrazado**: actúa
  sobre la línea siguiente, no sobre la actual. §9.3 y §7.2.
- **Retroceso al principio de una casilla hace DOS cosas, en dos pulsaciones:** la primera
  quita la casilla (`convertToText`), la segunda une con la línea de arriba (`merge`). §7.3.
- **`merge` une con la línea que se ve encima**: la anterior **en orden de lectura** —la última
  de la hermana de arriba, por honda que esté—, o la madre si es la primera hija. *Cambiado con
  el usuario el 2026-10-03*: antes subía a la hermana anterior, y un texto bajo una casilla con
  hijas se unía a la casilla y no a la hija que se ve encima. Es la única vez que la Fase 4 tocó
  el core. §9.3 y §7.3.
- **`WritingMode` es un interruptor «☐ Casilla» más un disparador de anidar**
  (`{ checkbox: boolean, nestArmed: boolean }`), con el texto como lo normal. *Decidido con el
  usuario el 2026-09-29*, y **sustituye a los dos modos con nombre (*Texto* ⇄ *Casilla*)** del
  2026-09-20; el comportamiento no cambió. **Anidar sólo se arma con la casilla encendida**,
  actúa una vez y se desarma solo, y **cambiar el interruptor lo desarma**. Es un objeto de la
  nota abierta: **no se persiste**, no va en `Note` ni en el core —al núcleo le llega `insert`
  con la `Position` ya elegida— y muere al salir de la nota. Nombre en inglés por ser público
  (*público en inglés, maquinaria interna en castellano*). §7.2.
- **Intro al final de un texto crea la línea con `after`, DEBAJO de la actual**, no con
  `root-end`; y desde una casilla anidada con la casilla apagada, el texto nace **debajo de su
  casilla de la raíz** (un texto sólo cabe en la raíz). `root-end` queda para la primera línea
  de una nota vacía. *Decidido con el usuario el 2026-09-29.* El core no se tocó. §7.3.
- **Los cuatro huecos de §7.3, cerrados con el usuario el 2026-09-29:** anidar armado en un
  **texto** crea una casilla hermana y **sigue armado**; **`split` no anida** y anidar sigue
  armado; **marcar con el teclado es Ctrl/Cmd+Intro** (y Tab + Espacio sobre el ☐).
- **Partir una casilla anidada con el interruptor apagado saca la mitad nueva como TEXTO a la
  raíz, debajo de su casilla de la raíz** —como Intro al final—, aunque haya hermanas detrás.
  *Cambiado con el usuario el 2026-10-03*: antes seguía siendo casilla. El core no se tocó: es
  `setText` + `insertText`. §7.3.
- **Los adaptadores de navegador se verifican A MANO, no con Playwright**, y la UI también.
  Un doble prueba lo que **tú crees** que hace la API, no lo que hace. **No propongas instalar
  un runner de navegador**; qué lo reabriría está en `TAREAS.md`. Las listas viven en
  `test/storage/blobs/` y `test/ui/`, y **si tocas `DirectoryHandleBlobStore.ts`, se vuelve a
  pasar la suya.**
- **El write-behind son DOS piezas, no una.** `setTimeout` **no compila dentro del core**
  (`TS2304`). *Qué está sucio* es puro y va en `core/app/`; *cuándo se escribe* va en
  `src/storage/`. **Nada de puerto `Scheduler`.** §6.4.
- **Los Planes se persisten, pero no se operan** hasta la Fase 5. §9.7.
- **Una acción, una operación.** Crear una nota en un contexto y «Mover a…» encadenan dos casos
  de uso desde la UI. La cascada de `setChecked` sigue sin construir, y si llega se pliega en
  **una sola** acción. §9.7.
- **No existe «borrar una rama» de casillas**: una casilla con hijas se borra **una a una**, de
  abajo arriba. *Decidido con el usuario el 2026-10-03.* §9.3.
- **Los casos de uso devuelven la entidad que tocan, o `null` si no aplicó.** Las dieciocho con
  el mismo tipo. **No un `Result`:** un no-op **no es un fallo**. El no-op sale de la invariante
  de identidad (`cambio`, en `useCases.ts`). ⚠️ Es **la entidad protagonista, no todo lo que
  cambió**, así que **no sirve de undo**. El razonamiento, en `TAREAS.md`. §9.7.
- **`schemaVersion` vive en `StorageAdapter`, no en `AppState`.** Es propiedad de lo guardado.
  Y **en un almacén vacío `boot` apunta ya la versión actual**: si no, uno con notas seguiría
  diciendo «0» y la primera migración se lo saltaría. §9.7.
- **Los errores se devuelven, no se lanzan.** `Result<T, E>` a mano, cero dependencias, y
  `StorageError` con **seis casos elegidos por "¿reintentar sirve de algo?"**
  —`permission-denied`, `not-found`, `quota-exceeded`, `corrupt`, `stale`, `io`—. `corrupt`
  **no** se mete dentro de `io`: es la diferencia entre perder una nota y creer que las has
  perdido todas. Y `stale` tampoco: reintentar volvería a pisar. §6.5.
- **La escritura es CONDICIONAL**: `Repository.put(entidad, esperada)` y `delete(id, esperada)`
  dicen qué `revision` esperan encontrar —`null`, nada—; si lo guardado es otra cosa, sale
  **`stale`** y no se escribe. El `writeBehind` pasa la de lo que tiene por guardado, y apunta
  cada escritura hecha en el momento, para que un `io` a mitad de tanda no dé un `stale` falso
  al reintentar. Ante `stale` se **detiene y avisa** con un botón **Recargar**; lo escrito en esa
  pestaña desde el último guardado se pierde. *Decidido con el usuario el 2026-10-03 (opción c,
  «avisar y recargar»)*, porque es la pieza que reutilizará la sincronización. Precio asumido:
  una pestaña no se entera de lo que cambia la otra hasta que intenta guardar, y cada guardado
  lee antes. §6.5.
- **Un error es una entidad del dominio**, en `core/domain/errors/`; `Result.ts`, fuera. §6.5.
- **`transaction` lleva el `Result` dentro y fuera.** Un `err` de `fn` sale **sin
  reempaquetar**, y una excepción de `fn` se traduce a `io`. §6.5.
- **`BlobStore` también devuelve `Result`**, y cada implementación traduce los errores de **su**
  plataforma; `FileStorageAdapter` traduce sólo la serialización. §6.5.
- **El sobre es del `BlobStore`; el contenido, de `FileStorageAdapter`.** Un base64 ilegible de
  `localStorage` es `corrupt` y nace abajo; una entidad que no parsea, arriba. §6.1.
- **Ante un fallo no reintentable el write-behind SE DETIENE, no se reanuda, y avisa UNA vez
  por `onError`.** Un `io` se sigue reintentando sin avisar. El aviso en pantalla **sólo
  informa** («No se están guardando los cambios»): reanudar es volver a pedir la carpeta, y el
  «reintentar» está aparcado. §6.5.
- **Un fichero ilegible se salta y se avisa, con `onCorrupt`; sin `onCorrupt`, `getAll` sigue
  siendo todo o nada.** Sólo se salta `corrupt`: cualquier otro fallo corta. **Nunca en
  silencio.** `boot` lo pide con `skipCorrupt` y devuelve los saltados en `App.corrupt`.
  **Las referencias a lo saltado se conservan** (`hydrate(stored, ilegible)`, que las reconoce
  con `pathOf`): arreglado el fichero, la nota vuelve **a su contexto**. *Cerrado con el usuario
  el 2026-10-03 (opción A); era el riesgo residual que se dejó abierto el 2026-09-29.* Es la
  segunda vez que la Fase 4 toca el core. §6.5.
- **La forma de lo leído se valida en `storage/file/schema.ts`, no en el core**: la forma en
  disco es del adaptador. Lo que no la tiene es `corrupt` con el motivo y va por `onCorrupt`.
  §6.2.
- **El `manifest.json` lleva SÓLO `{ schemaVersion }`, sin índice de ids.** Un índice sería una
  **segunda fuente de verdad**. Si algún día el coste duele: **una caché, no un índice**.
  **Manifiesto ausente = versión 0**, «nunca se ha escrito nada». §6.2.
- **`transaction` sobre ficheros NO es atómica**; sólo garantiza que no reordena ni agrupa. §6.2.
- **Las implementaciones de `BlobStore` van en `src/storage/blobs/`, no dentro de `file/`.**
  §6.1.
- **Un tipo de plataforma que falte se declara a mano** —local, sin exportar— antes que instalar
  `@types` o activar una `lib` más. Y **antes, comprueba si el TypeScript instalado ya lo trae**.
  §8.4.
- **`remove` NO borra una casilla con hijas: es no-op**, y la regla se propaga a `merge` y a
  `convertToText`: todo lo que hace desaparecer una línea se niega si tiene hijas. §9.3.
- **Sin bundler: `index.html` con un `importmap` para los alias, y `.js` en todos los imports
  relativos de `src/`.** *Decidido con el usuario el 2026-09-29 (opción A)*: el `importmap`
  solo no bastaba. Descartados reescribir el JS emitido y un servidor que añada `.js`. §8.6.

**De la navegación y el alcance de la Fase 4** (el porqué, en §7.4 salvo que se diga otra cosa):

- **Cuatro vistas: ventanas (la principal y la única que enseña contextos), nota, plan y
  configuración.** De ventanas se entra a las demás **a un solo nivel**, y de una secundaria sólo
  se sale con **exit** (o el atrás del navegador, que es lo mismo), a **la misma ventana**. ◀ ▶
  no son circulares. En la vista nota no hay ◀ ▶ ni ⚙.
- **Las ventanas en ⚙ son una fila de fichas que se desliza**: mantener pulsada una la levanta
  para **arrastrarla y reordenar** (`moveWindow`), **⋮ abre la hoja** con *Cambiar contenido*,
  *Añadir detrás* y *Quitar*, un toque corto no hace nada, y una ficha «+» añade al final.
  Reordenar con teclado, pendiente. *Decidido con el usuario el 2026-10-03.*
- **En la última ventana, un «+» verde en el sitio de ▶** abre una hoja desde abajo para añadir
  otra detrás: «+ Contexto nuevo» y sólo lo que **aún no tiene ventana**. Al elegir **se va a
  ella**, y un contexto nuevo llega con el título en edición. *Decidido con el usuario el
  2026-10-03.*
- **Una ventana es una referencia** (`WindowRef`: General, contexto o nota) y **la lista se
  guarda FUERA del core, en `localStorage`** (`elnotas:windows`), con la activa **como
  referencia y no como índice**. Riesgo aceptado: no viaja con las notas.
- **Las ventanas visibles se calculan siempre** (`guardWindows`): la lista guardada menos las
  rotas, y si la activa ya no está, la primera. Quitar una ventana no borra nada.
- **Sin nada guardado se ve una ventana, el General; se permite el mismo contexto en dos
  ventanas** (la activa es la primera que coincide); **y un fallo al guardar la lista no avisa**:
  sólo se pierde el orden. *Decidido con el usuario el 2026-09-29.*
- **El General** enseña todas las notas, no se renombra, y su papelera **borra de verdad**; en un
  contexto la papelera **sólo quita de ese contexto**. Confirman sólo borrar un contexto y la
  papelera del General, **con una hoja propia y no con `window.confirm`**, que hay navegadores
  que contestan «no» sin enseñarla (2026-10-03). El `backStack` es una pila: la hoja va encima.
- **Selección por pulsación larga** (más clic derecho, Ctrl/Cmd+clic y teclado). «Mover a…»
  **mueve** (`remove-item` + `add-item`; desde el General sólo `add-item`) y no confirma.
- **Una nota nace en el contexto donde se crea**, como «Nueva Nota», y **una nota vacía se
  mantiene**. **Puede haber varias notas con el mismo nombre**: lo que las distingue es el id, y
  el selector no enseña nada más. *Decidido con el usuario el 2026-09-29.*
- **El título, sólo en la cabecera, y se renombra tocándolo.** Una nota que es ventana usa **el
  mismo editor en dos marcos**, sin exit. `defaultView` queda sin uso, y no se toca.
- **La Fase 4 es sólo web y se partió en Fase 4 · Contextos y Fase 4 · Notas**, sin tocar el
  core salvo la regla de `merge` y conservar las referencias a lo ilegible (2026-10-03,
  arriba); **los Planes son la Fase 5**. §9.10.

## Fuera de alcance por ahora

No empezar nada de esto sin pedirlo explícitamente. El motivo de cada uno y qué lo
desbloquearía están en `TAREAS.md` → *Ideas aparcadas*.

- **Reordenar y re-anidar líneas** (`move`, `indent`, `outdent`) — *pendiente de las tres
  preguntas de §9.10*, que se contestan usando el editor varios días. Un «no se aguanta» las
  reabre; hasta entonces, siguen fuera
- Las tres candidatas extra de la barra (cascada al marcar, esconder las marcadas, mandarlas al
  final) · el «reintentar» del aviso de `onError` · las ventanas como entidad del core
- La carpeta del usuario y OPFS como destino de la app, con su botón de «reconectar carpeta»
- Adaptador de MongoDB · adaptador de Google Drive
- `CompositeStorage` y outbox · `storageTarget` por contexto
- El editor de grafos de los **Planes** — es la Fase 5
- Shells de desktop y móvil (Tauri / Capacitor)
- Sync entre dispositivos, CRDTs, colaboración en tiempo real

## Plan por fases

- **Fase 0 — Andamiaje. ✅ HECHA.**
- **Fase 1 — Dominio puro. ✅ HECHA**, con **99 pruebas** al cerrarla (§9.5).
- **Fase 2 — Acciones, persistencia y memory. ✅ HECHA**, con **216** (§9.8).
- **Fase 3 — Fichero local. ✅ HECHA**, con **314**, y la lista manual pasada el 2026-09-13
  (§9.9).
- **Fase 4 — UI, sólo web. ⏳ CÓDIGO HECHO, SIN CERRAR.** 532 pruebas. Partida en dos (§9.10):
  - **Fase 4 · Contextos** — puntos 1–7 y 9 hechos. **El 8, la lista manual
    (`test/ui/VERIFICACION-MANUAL.md`), escrita y SIN PASAR entera**: hubo una revisión parcial
    que el usuario no confirma. No cerrada.
  - **Fase 4 · Notas** — puntos 1–9 y 11 hechos. **El 10, la lista del editor
    (`test/ui/VERIFICACION-MANUAL-EDITOR.md`), escrita y SIN PASAR.** Y **las tres preguntas**
    —si se aguanta no tener `move`, no tener `indent`/`outdent`, y si el disparador de anidar se
    entiende solo— **sin contestar**: piden usar la app varios días. No cerrada.
  - **Para cerrar la Fase 4 falta:** pasar las dos listas en escritorio y en móvil, anotar el
    resultado, y contestar por escrito las tres preguntas en `TAREAS.md`.
- **Fase 5 — Planes.** El editor de grafos. Se planifica cuando cierre la 4.

**Lo que queda abierto**, con su registro en `TAREAS.md` → *Sin decidir*: **si OPFS entra en
juego** y **qué pasa con lo guardado en `localStorage`** —notas y lista de ventanas— el día que
cambie el destino.

## Comandos

```bash
npm run check              # las seis de abajo, en orden. Esto antes de commit.

npm run typecheck          # tsc de la app: sólo src/, que es donde vive el código
npm run typecheck:core     # LA VERJA: falla si el core toca plataforma
npm run check:purity       # GUARDIÁN: falla si el core lee el reloj o el azar
npm run check:fronteras    # GUARDIÁN: falla si una excepción puede escaparse de su frontera
npm run check:extensiones  # GUARDIÁN: falla si un import relativo de src/ no lleva .js
npm test                   # limpia tmp-test/, compila src/ y test/, EXIGE que haya pruebas,
                           # y lanza node --test sobre tmp-test/test

npm run build:web          # compila src/ a dist/web/ en ESM, para el navegador
python3 -m http.server 8000                # y se abre http://localhost:8000
python3 -m http.server 8000 --bind 0.0.0.0 # para el móvil: http://<IP del ordenador>:8000
```

`?depurar` en la dirección deja `window.elnotas = { store, useCases }` en la consola; sin él no
existe. `npm audit` da 0 vulnerabilidades.
