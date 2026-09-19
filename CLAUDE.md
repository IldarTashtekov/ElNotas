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

En `src/` **conviven dos cosas** y no hay que confundirlas:

- **`src/core/` y `src/storage/` — la arquitectura nueva.** El core es dominio puro y **es la
  referencia** de cómo se hacen las cosas aquí; `storage/` es el primer módulo que implementa
  puertos suyos. Hoy: **las fases 1 y 2 enteras y TODO EL CÓDIGO de la Fase 3** — que no es lo
  mismo que la Fase 3 terminada, ver abajo.
- **`src/scripts/` — el prototipo viejo**, anterior al rediseño. Sigue en el repo porque es
  lo único que hace algo visible, pero **no refleja esta arquitectura y no hay que imitarlo**.
  Se sustituye en la Fase 4 y hoy ni se puede construir (webpack está desinstalado).

**Lo que existe: las fases 1 y 2 enteras y el código entero de la Fase 3.** ~4240 líneas de
código en `src/core/` y `src/storage/`, y ~4930 de pruebas en `test/`, que es carpeta aparte:

- **el modelo** — entidades (`Note`, `Plan`, `Context`), contenido (`Text` | `CheckBox`), IDs
  marcados, `ItemRef`, `AppState` normalizado y sus constructores;
- **`Result<T, E>`** en `domain/Result.ts` con `ok` y `err`, y **las dos taxonomías de error**
  en `domain/errors/`: `StorageError` (cinco casos) y `MigrationError` (dos). En el código de
  producción de `core/` y `storage/` **no queda ni un `throw`**;
- **`Position`** — el vocabulario del "dónde", tres casos, uno por cada modo de escritura;
- **el helper de copia por camino, con sus dos primitivas** — `updateContent.ts` (A:
  transformar un nodo) y `updateContainerOf.ts` (B: transformar el contenedor de una línea).
  **Maquinaria interna: NO salen por `index.ts`**;
- **las OCHO operaciones**, en `operations.ts` y todas exportadas: `setText`, `setChecked`,
  `insert`, `remove`, `convertToCheckBox`, `convertToText`, `split`, `merge`;
- **los CINCO puertos** en `src/core/ports/`, **sólo interfaces**: `Clock` e `IdGenerator` de
  la Fase 1, y `Repository`, `StorageAdapter` y `BlobStore` de la Fase 2. El id de
  `Repository` va **marcado** (`Repository<Note, NoteId>`) y todos son propiedades de función,
  no métodos. **Los tres de persistencia devuelven `Result<…, StorageError>` en todos sus
  métodos** —los siete de `Repository` y `StorageAdapter`, y los cuatro de `BlobStore`—, así
  que **ninguno lanza**;
- **la capa de aplicación** en `src/core/app/`: **las DIECISIETE acciones** (8 de contenido, 3
  de Nota, 6 de Contexto), `reduce`, `Store` (una **función**, `createStore`, no una clase),
  `createUseCases` y `diffState`. `reduce` **no** sale por `index.ts`;
- **el arranque en su mitad pura**, en `src/core/migrations/`: `hydrate` y `runMigrations`.
  `MIGRATIONS` está **vacía a propósito** — no hay nada guardado con un esquema viejo.

**Y existe `src/storage/`** — la suite de contratos (**17 casos**, hoy en
`test/storage/contract-tests/`), el
`writeBehind`, **dos adaptadores que pasan esa suite** —`MemoryStorageAdapter` y
`FileStorageAdapter`, en `file/`, con el formato en disco de `ARCHITECTURE.md` §6.2 y
parametrizado por `BlobStore`— y, en `blobs/`, **las dos implementaciones de `BlobStore`**:
`LocalStorageBlobStore` (22 pruebas propias) y `DirectoryHandleBlobStore` (la carpeta del usuario
y OPFS; **sin pruebas a propósito**, §6.3). La suite **corre TRES veces, no dos, y no se tocó**
al añadirlas: memoria · fichero + `BlobStore` falso · **fichero + `LocalStorageBlobStore` real**,
que es la que prueba que la pila entera encaja (§6.3).

**Qué se prueba dónde, que es donde más se malinterpreta:** *lo que exige la interfaz va en el
contrato; lo que sólo tiene una implementación, en un fichero aparte*. Por eso el de memoria
—tres `Map` y un número— **no tiene ni una prueba propia**, y el de fichero sí: el contrato
habla de entidades e ids y **no sabe que existe un `BlobStore`**, así que no puede hacer fallar
a la plataforma ni mirar cómo se llama el fichero. El razonamiento, en §6.3. Corolario práctico:
si una prueba pudiera escribirse contra la interfaz, su sitio es el contrato.

**El write-behind puede quedarse DETENIDO.** Ante un fallo que no sea `io` retiene el error,
cancela la espera y cada `flush()` devuelve el mismo error sin tocar el almacén; lo pendiente
se conserva en memoria, así que no se pierde nada. **No hay forma de reanudarlo**, y es
deliberado: reanudar es volver a pedir la carpeta, o sea plataforma, o sea Fase 4. §6.5.

⚠️ **Lo que falta de la Fase 3 no es código: es PASAR LA LISTA DE VERIFICACIÓN MANUAL** de
`test/storage/blobs/VERIFICACION-MANUAL.md` (punto 5 de §9.9). Está escrita y **nadie la ha
ejecutado**, así que `DirectoryHandleBlobStore` existe y nadie lo ha visto correr. Necesita un
navegador y las manos del usuario. **La Fase 3 NO está terminada.**

**Lo que NO existe todavía:** la UI y todo lo de Planes salvo sus tipos. Y no hay **ninguna**
implementación de `Clock` ni de `IdGenerator`: vivirían en `src/platform/`, que no nace hasta la
Fase 4, igual que `src/ui/`.

**`npm run check` está en verde y ya no puede pasar en falso:** `tools/require-tests.mjs` sale
con código 1 si no encuentra ningún `*.test.js` en `tmp-test/test/`, porque `node --test` sin
ficheros imprime `1..0` y sale con código 0. **No lo "arregles" quitando el guardián.** Mira
`tmp-test/test/` y no `tmp-test/` a secas **a propósito**: así también caza que las pruebas
compilen a un sitio distinto de donde las busca el runner.

⚠️ **Cada guarda y cada invariante se verifica ROMPIÉNDOLA a propósito** y comprobando que las
pruebas caen. Una prueba de identidad que no salta al romper lo que vigila no vale nada, y un
`deepEqual` pasaría igual de verde. Es la disciplina de esta capa, no una floritura.

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
│   ├── memory/         # ← MemoryStorageAdapter
│   ├── file/           # ← FileStorageAdapter: el formato en disco (§6.2)
│   ├── blobs/          # ← las dos de BlobStore, que es OTRO puerto (§6.1)
│   └── index.ts
├── ui/            # (F4) vanilla: componentes + render(state)
└── platform/      # (F4) composición: el ÚNICO sitio que inyecta adaptadores

test/              # LAS PRUEBAS, fuera de src/ y partidas por capa (espejo de src/)
├── core/          # ← domain/ (+ errors/) · app/ · migrations/
└── storage/       # ← contract-tests/ · memory/ · file/ · blobs/
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
  - **la lista de verificación manual también vive ahí** (`test/storage/blobs/`): es una prueba
    de `DirectoryHandleBlobStore`, y lo único que la distingue de sus vecinas es que la ejecutan
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
- **Un alias se declara cuando el módulo existe**, no antes. Hoy hay `#core/*` y `#storage/*`;
  `#ui/*` y `#platform/*` no existen porque esas carpetas tampoco.
- **Un `index.ts` por módulo** como API pública. Lo que no esté ahí, para los demás módulos no
  existe.
- **`src/platform/` no nace hasta la Fase 4.** Un test se fabrica su propio `Clock` en una
  línea, así que las implementaciones reales no tienen consumidor hasta entonces.

## Reglas al escribir código

- **Cruzar de módulo, siempre por alias contra el `index.ts`; dentro del módulo, relativo:**
  ```ts
  import { Note } from "#core/index"            // ✅ desde ui/, storage/, platform/
  import { Note } from "../../core/domain/Note" // ❌
  import { Note } from "./domain/Note"          // ✅ dentro del propio core
  ```
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
  valor a propósito. Un almacén no promete devolver el mismo objeto —el de fichero devolverá
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
  que hablan con lo que lanza —**seis en todo el código de producción**: una en el adaptador de
  memoria, tres en el de fichero (`JSON.parse` y `TextDecoder` lanzan) y **una en cada
  `BlobStore`**— y las traduce; por encima de esa línea nada lanza —y
  eso incluye el código ajeno: una excepción dentro de `transaction` **no escapa**, se traduce
  a `io`. Ojo: **ausencia no es fallo** — `get` de algo que no está es `ok(null)`. El tipo, la
  taxonomía y el porqué, en `ARCHITECTURE.md` §6.5.
- **Un error es una entidad del dominio: nace en `src/core/domain/errors/`**, no en el módulo
  que da la casualidad de producirlo. Ahí están `StorageError` y `MigrationError`, y ahí va el
  siguiente. La carpeta **no lleva `index.ts`** —`domain/` tampoco— porque la API pública del
  módulo es `src/core/index.ts`. **`Result.ts` se queda suelto en `domain/`, fuera de
  `errors/`:** es el sobre, no lo que va dentro. El porqué, en `ARCHITECTURE.md` §6.5.
- **`setChecked`, no `toggleChecked`.** Un `toggle` no puede ser nunca un no-op; el nombre
  sostiene la invariante de identidad. Vale como criterio general al nombrar operaciones.
- **Integridad referencial:** no se deja una referencia apuntando a algo inexistente. Borrar
  una nota tiene que quitarla de los contextos que la listaban; añadir a un contexto una
  referencia a algo que no existe es un no-op.
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
  la inferencia lo absorba en silencio.

  **Rige en `src/` Y en `test/`.** No hay una regla para el código y otra para las pruebas: una
  prueba es código, y la inferencia se lo traga igual de callada.

  **CUATRO excepciones, y sólo la primera no es una elección:**
  1. **`for (const x of …)`** — `error TS2483: The left-hand side of a 'for...of' statement
     cannot use a type annotation`. Lo prohíbe el lenguaje, no el criterio;
  2. **la constante que ES una función** (`const setText = (…): X => …`) — ese trabajo lo hace
     el tipo de retorno, y anotar además la constante obliga a escribir la firma dos veces.
     Ojo: los **parámetros y el retorno de esa función sí van anotados**;
  3. **`as const`** — la anotación ensancha justo lo que `as const` estrecha;
  4. **destructuring** — no hay dónde ponerlo sin repetir la forma del objeto entero.

  **Estado, que es lo que evita discutirlo cada vez:** `src/` **la cumple entero** — 330
  anotaciones, y no queda ni una variable, ni un parámetro, ni un retorno sin tipo fuera de las
  cuatro excepciones; las **11** declaraciones que quedan sin anotar son las once `for…of`.
  **Las pruebas ya escritas NO la cumplen, y se quedan así a propósito:** son **942**
  anotaciones —423 variables, 412 retornos y 107 parámetros, medido— de trabajo mecánico que no
  arregla ningún fallo ni caza ninguno. Pero **lo que escribas o toques en `test/` a partir de
  ahora sí la cumple**, sin excepción. Una prueba vieja sin
  anotar no es un precedente ni una autorización: es deuda conocida y anotada en `TAREAS.md`.
- **`Context.items` es `ItemRef[]`, nunca `(Note | Plan)[]`.** No negociable.
- **Nada de credenciales en el repo ni en el bundle.** En web, OAuth con PKCE y token en
  memoria, **nunca** en localStorage. En desktop, keychain del sistema.
- **Los comentarios del código van en castellano**, igual que la documentación.

## Dependencias

**No se instala una dependencia hasta la fase en que se usa de verdad**, y se desinstala si
deja de usarse. Cero `dependencies` de runtime. Antes de añadir un paquete, comprobar si Node,
TypeScript o el navegador ya lo hacen nativamente.

Estado actual: **`typescript` y `@types/node`. Nada más** — el árbol entero son **tres
paquetes** (los dos, más el `undici-types` que arrastra `@types/node`), 27M y 0
vulnerabilidades, y conviene que siga así. Ojo si cuentas carpetas de `node_modules`: quedan
directorios vacíos de desinstalaciones viejas y salen diecisiete. Lo que cuenta es el
`package-lock.json`.

Webpack y su cadena están desinstalados a propósito hasta la Fase 4, así que **`npm run build`
y `npm run serve` no existen**. Para recuperarlos:
`npm i -D webpack webpack-cli webpack-dev-server ts-loader` y volver a añadir los scripts.

## Decisiones cerradas — no volver a proponer alternativas

Los motivos están en `ARCHITECTURE.md`. Si crees que una está equivocada, **plantéalo como
duda**; no la cambies por tu cuenta.

- **Carpetas con límites por `tsconfig`**, no monorepo con workspaces.
- **UI vanilla**, no React/Svelte/Solid.
- **Estado normalizado con `ItemRef`**, no entidades anidadas.
- **`Versioned` con `revision` como token opaco**, no `version: number` ni "gana el último".
- **Marcar una casilla NO arrastra a sus hijas.** La cascada se compone en la UI.
- **Espejo con local como primario**, no sync bidireccional.
- **File System Access API** para el fichero local en web, con OPFS como fallback.
- **Un fichero por entidad** (`notes/<id>.json`) más un `manifest.json`.
- **`node:test` como runner**, no vitest ni jest (se evaluó vitest: ~64M para algo que Node ya
  trae).
- **Las pruebas viven en `test/`, espejo de `src/` y partido por capa**, no junto al fichero que
  prueban. Se movieron las 314 de golpe, y el criterio es que `src/` sea sólo código: la
  separación deja de depender del sufijo `.test` y pasa a depender de la carpeta, que es lo que
  ya usan el `tsconfig` de la app y la verja del core para no mirar dentro. Precio asumido:
  desde `test/` se importa por alias profundo, y el `rootDir` de `tsconfig.test.json` es la raíz
  del repo, así que la salida compilada lleva `tmp-test/src/…` y la condición `compiled` de
  `package.json` apunta ahí. §8.5.
- **Alias por el campo `imports` de package.json**, no `paths` ni `resolve.alias`.
- **Dependencias solo cuando la fase las necesita.** No instalar "para tenerlo listo".
- **La Fase 1 termina por el criterio de `Versioned`:** lo que opera por debajo de `Versioned`
  es Fase 1; producir entidades es Fase 2.
- **El helper de copia por camino son DOS primitivas:** A (transformar un nodo) y B
  (transformar el array contenedor). La A va parametrizada por `onText`/`onCheckBox` con la
  recursión escrita **una sola vez**, no dos funciones raíz/profundidad. §5.4.
- **`Position` tiene tres casos** —`root-end`, `after`, `last-child-of`— **y ninguno más**.
  Uno por cada estado de `ModosEscritura`, y su único consumidor es `insert`. §9.4.
- **Las operaciones de contenido son OCHO** y ninguna pasa de dificultad media: `setText`,
  `setChecked`, `insert`, `remove`, `split`, `merge`, `convertToCheckBox`, `convertToText`.
  §9.3.
- **Tampoco existe `move`.** Nadie la usa: no hay gesto de arrastrar hasta la Fase 4, y aquí no
  se construye lo que no tiene consumidor. Consecuencia asumida: **una lista se queda en el
  orden en que se escribió**; reordenar es borrar y reescribir. Aparcada en `TAREAS.md`. §9.3.
- **No existen `indent` ni `outdent`.** En el teclado de un móvil no hay Tabulador, y la app es
  multiplataforma. El nivel de una línea **se elige al nacer**, con el modo activo de
  `ModosEscritura`; el Tabulador solo mete un carácter. Precio aceptado: una línea en el nivel
  equivocado se borra y se reescribe. §9.3.
- **Retroceso al principio de una casilla hace DOS cosas, en dos pulsaciones:** la primera
  quita la casilla (`convertToText`), la segunda une con la línea de arriba (`merge`). Cada
  pulsación, una sola cosa. §7.3.
- **`ModosEscritura` es un objeto auxiliar de la nota abierta**, con tres estados en ciclo
  (*Texto → Casilla → Casilla hija*). **No se persiste** y muere al salir de la nota: no va
  dentro de `Note`, no va en el core —al núcleo le llega `insert` con la `Position` ya
  elegida— y no necesita fichero de preferencias. §7.2.
- **Los adaptadores de navegador de la Fase 3 se verifican A MANO, no con Playwright.** Todo lo
  que tiene lógica —`FileStorageAdapter`— pasa la suite de contratos en Node con un `BlobStore`
  falso; lo único sin automatizar es `DirectoryHandleBlobStore` (**156 líneas de código, no las
  «~50» que decía este documento**, y la decisión no cambia: lo que creció es el clasificador de
  excepciones, §6.3). Un doble ahí prueba lo que **tú crees** que hace la API, no lo que hace.
  **No propongas instalar un runner de navegador**; qué lo reabriría está en `TAREAS.md`.
  Su red de seguridad es `test/storage/blobs/VERIFICACION-MANUAL.md`: **si tocas ese fichero, se
  vuelve a pasar la lista y se anota el resultado.**
- **El write-behind son DOS piezas, no una.** `setTimeout` **no compila dentro del core**
  (`TS2304`: no está en `lib.es2020` ni con `"types": []`). *Qué está sucio* es puro y va en
  `core/app/`; *cuándo se escribe* va en `src/storage/`. **Nada de puerto `Scheduler`.** §6.4.
- **En la Fase 2 los Planes se persisten, pero no se operan.** `StorageAdapter` lleva su
  `Repository<Plan>` y ni una acción de Plan entra en el catálogo: el editor de grafos está
  aparcado y no habría quien las despachara. §9.7.
- **Una acción, una operación.** Ninguna acción pliega varias llamadas en la Fase 2. Las
  compuestas —cascada de `setChecked`, borrar una rama— se diseñan en la Fase 4, con el editor
  delante. §9.7.
- **`schemaVersion` vive en `StorageAdapter`, no en `AppState`.** Es propiedad de lo guardado.
  Y llega con el runner que lo consume, porque **es** el mecanismo de migración. §9.7.
- **El arranque de la app está partido en dos fases:** `hydrate` y las migraciones son puras y
  van en la Fase 2; quién abre el storage y qué se ve sin nada guardado es Fase 4. §9.7.
- **Los errores se devuelven, no se lanzan.** `Result<T, E>` a mano (~20 líneas, cero
  dependencias), y `StorageError` con **cinco casos elegidos por "¿reintentar sirve de algo?"**
  —`permission-denied`, `not-found`, `quota-exceeded`, `corrupt`, `io`—, no por qué mensaje sale
  en pantalla. `corrupt` **no** se mete dentro de `io`: es la diferencia entre perder una nota y
  creer que las has perdido todas. Se aplicó **antes** del adaptador de fichero de la Fase 3,
  porque después habría dos adaptadores y una suite de contratos que convertir en vez de una.
  §6.5.
- **Un error es una entidad del dominio.** `StorageError` y `MigrationError` viven juntos en
  `core/domain/errors/`, al mismo nivel que `Note` o `Context`, no en el módulo que los emite.
  `Result.ts` se queda fuera de `errors/`: es el sobre. §6.5.
- **`transaction` lleva el `Result` dentro y fuera.** Su `fn` devuelve
  `Promise<Result<T, StorageError>>` porque el cuerpo real hace `put` tras `put` y cada uno ya
  devuelve uno; con una `T` pelada saldrían dos sobres para un solo fallo. Un `err` de `fn`
  corta y sale **sin reempaquetar**, y una excepción de `fn` se traduce a `io`. §6.5.
- **`BlobStore` también devuelve `Result`.** Cada implementación traduce los errores de **su**
  plataforma —cada una sabe cuál es su excepción de cuota o de permisos— y `FileStorageAdapter`
  traduce sólo lo suyo, la serialización. Si la traducción de plataforma subiera al adaptador,
  tendría que conocer las excepciones de los cuatro backends. §6.5.
- **Ante un fallo no reintentable el write-behind SE DETIENE, y no se puede reanudar.** Retiene
  el error, cancela la espera y lo devuelve en cada `flush()` sin tocar el almacén; lo pendiente
  se conserva. Reanudar es volver a pedir la carpeta, que es plataforma: Fase 4. §6.5.
- **El `manifest.json` lleva SÓLO `{ schemaVersion }`, sin índice de ids.** `getAll` se resuelve
  con `list(prefijo)` más N lecturas. Un índice sería una **segunda fuente de verdad** que puede
  esconder una nota que está intacta en disco. Si algún día el coste duele: **una caché, no un
  índice**. Y **manifiesto ausente = versión 0**, que es "nunca se ha escrito nada". §6.2.
- **`transaction` sobre ficheros NO es atómica, y lo único que añade a lo de arriba es que no
  reordena ni agrupa las escrituras** — de eso depende el orden `put`-antes-que-`delete` del
  write-behind. No hay rollback, ni cerrojo, ni lecturas consistentes. §6.2.
- **⚠️ Un fichero corrupto tumba el `getAll` entero, y se acepta hasta la Fase 4.** Contradice a
  §6.5 —que pide aislar esa entidad— y hoy significa que **una nota ilegible impide abrir la
  app**. El arreglo es un `onCorrupt`, y va en el mismo paquete que el `onError` del
  write-behind: hoy no hay a quién avisar. **No lo "arregles" saltándote la entidad en
  silencio**, que es peor. El porqué completo, en §6.5; la tarea, en `TAREAS.md`.
- **Las implementaciones de `BlobStore` van en `src/storage/blobs/`, no dentro de `file/`.**
  `memory/` y `file/` nombran formas de guardar **entidades**; `BlobStore` es otro puerto y es un
  **parámetro** de `FileStorageAdapter`, no algo debajo de `Repository`. §6.1.
- **El sobre es del `BlobStore`; el contenido, de `FileStorageAdapter`.** Si falla la codificación
  que el propio blob aplicó (el base64 de `localStorage`) es `corrupt` y nace abajo; si lo que no
  parsea es la entidad, es del adaptador. No cambia el reparto de §6.1, lo precisa.
- **Un tipo de plataforma que falte se declara a mano** —local, sin exportar— antes que instalar
  `@types` o activar una `lib` más en un `tsconfig`. Y **antes de declararlo, comprueba si la
  versión de TypeScript instalada ya lo trae**: la Fase 3 se escribió con **cero dependencias
  nuevas**. §8.4.
- **`remove` NO borra una casilla con hijas: es no-op.** Se borra de abajo arriba. Ninguna
  operación del dominio hace desaparecer contenido que el usuario no esté mirando; la cascada
  se compone, como la de `setChecked`. **La regla se propaga a `merge` y a `convertToText`**:
  todo lo que hace desaparecer una línea se niega si tiene hijas. §9.3.

## Fuera de alcance por ahora

No empezar nada de esto sin pedirlo explícitamente. El motivo de cada uno y qué lo
desbloquearía están en `TAREAS.md` → *Ideas aparcadas*.

- **Reordenar y re-anidar líneas** (`move`, `indent`, `outdent`)
- Adaptador de MongoDB · adaptador de Google Drive
- `CompositeStorage` y outbox · `storageTarget` por contexto
- El editor de grafos de los **Planes**
- Shells de desktop y móvil (Tauri / Capacitor)
- Sync entre dispositivos, CRDTs, colaboración en tiempo real

## Plan por fases

- **Fase 0 — Andamiaje. ✅ HECHA.**
- **Fase 1 — Dominio puro. ✅ HECHA.** Los seis puntos del criterio de cierre (§9.5),
  cumplidos, con **99 pruebas**. El helper con sus dos primitivas, `Position`, las ocho
  operaciones, los puertos y la rebanada vertical.
- **Fase 2 — Acciones, persistencia y memory. ✅ HECHA.** Los seis puntos del criterio de
  cierre (§9.8), cumplidos, con **216 pruebas al cerrarla**. Los tres puertos, `MemoryStorageAdapter` con
  su suite de contratos, el write-behind en sus dos mitades (§6.4), **las diecisiete acciones**
  y la parte pura del arranque. Se atacó **de abajo arriba** —la persistencia primero,
  verificada con la única acción que ya existía— por el mismo motivo que la rebanada vertical
  de la Fase 1: descubrir un fallo con un candidato, no con diecisiete.
- **Fase 3 — Fichero local. ← EN CURSO: el código está ENTERO, la fase NO está terminada.**
  Hechos el **paso 0** (§6.5, 232 pruebas), **`FileStorageAdapter`** con el formato en disco de
  §6.2 (274) y **las dos implementaciones de `BlobStore`** en `blobs/` (**314**, y el contrato
  corriendo tres veces). **Falta el punto 5 de §9.9 y sólo ése: ejecutar la lista de verificación
  manual**, que no la puede cerrar un agente. De los siete puntos van **cinco cumplidos** —1, 2,
  3, 4 y 6—; el 7 está verde y sólo espera a anotar la cifra de cierre. §9.9 lleva además la
  lista explícita de lo que **no** entra en la fase.
- **Fase 4 — UI.** El editor con checkboxes anidados: el corazón de la app.

**Las decisiones de las fases 1 y 2 están CERRADAS**, y las dos fases están escritas. **De la
Fase 3 también:** cómo se verifican los adaptadores de navegador y la taxonomía de errores. Lo
abierto es **la escritura condicional** —el conflicto entre dos pestañas, que `revision` sabe
detectar pero que nadie puede disparar todavía—, **avisar de los fallos que hoy no ve nadie**
(el `onError` del write-behind y el `onCorrupt` de `getAll`, los dos aplazados a la Fase 4
porque hoy no hay a quién avisar), **la validación de esquema al leer del disco**, **si OPFS
entra en la fase** —está en la lista manual como sección opcional y §9.9 no lo exige— y lo **de
la Fase 4** (cuatro esquinas del teclado, el escalón de anidamiento, el nombre en código de
`ModosEscritura`). Las respuestas y su porqué están en `TAREAS.md` → *Sin decidir*, que se
conserva como registro.

## Comandos

```bash
npm run check           # las cuatro de abajo, en orden. Esto antes de commit.

npm test                # limpia tmp-test/, compila src/ y test/, EXIGE que haya pruebas,
                        # y lanza node --test sobre tmp-test/test
npm run typecheck       # tsc de la app: sólo src/, que es donde vive el código
npm run typecheck:core  # LA VERJA: falla si el core toca plataforma
npm run check:purity    # EL OTRO GUARDIÁN: falla si el core lee el reloj o el azar
```

No hay `build` ni `serve` hasta la Fase 4. `npm audit` da 0 vulnerabilidades.
