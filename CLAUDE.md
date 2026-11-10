# ElNotas

App de notas personal, en TypeScript. **Web primero**, publicada como PWA; desktop y móvil
nativos, más adelante (shells sobre la misma UI web).

| Fichero | Qué hay dentro |
|---|---|
| **`CLAUDE.md`** (este) | las reglas que **nada automático vigila**. Corto a propósito: se carga en cada sesión. Sin fechas ni recuentos de pruebas, y 300 líneas como mucho (`check:arquitectura`) |
| **`ARCHITECTURE.md`** | el fundamento: los principios con su **porqué** y los conceptos explicados desde cero |
| **`TAREAS.md`** | qué está pendiente, la deuda de las fases cerradas, qué está **sin decidir** y las ideas aparcadas |
| **`TERMINADAS.md`** | lo cerrado: las fases, resumidas, y en una línea las tareas, los descartes, las decisiones y los hitos |

Lo que caza el compilador o un guardián va aquí en una línea con su comando: si lo rompes,
`npm run check` te lo dice. Lo demás tienes que recordarlo tú.

## Estado actual del repo

**Verificado, no copiado.** Antes de afirmar qué existe, cuánto hay o si algo pasa:
`find src test -name '*.ts' | sort`, `npm run check`, `git log --oneline`. Manda `npm test`.

**Versión 1 cerrada** (última etiqueta, `v1.2.0`), publicada en `https://ildartashtekov.github.io/ElNotas/`.
Qué fase hay en curso y qué queda, en `TAREAS.md`.

- **`src/core/`** — dominio puro y la referencia de estilo: modelo, operaciones, puertos, acciones.
- **`src/storage/`** — los adaptadores de memoria y fichero, las dos de `BlobStore` y el `writeBehind`.
- **`src/platform/web/`** — la composición: los adaptadores de la web, el arranque y `main.ts`.
- **`src/ui/`** — vanilla: las cinco vistas, el editor, el lienzo y el calendario.

**Qué se prueba dónde:** lo que exige la interfaz, en el contrato; lo de una sola implementación,
aparte (§6.3). En la UI, lo que decide es pura y con pruebas en Node; el DOM, con las listas
`VERIFICACION-*.md` de `test/`, que pasa el verificador en el panel (`test/PASAR-LAS-LISTAS.md`; lo
que borra, en `localhost:8001`). Lo que sólo se ve en el móvil —la PWA, Android— lo pasa el usuario.

**`npm run check` no puede pasar en falso:** sin pruebas compiladas, falla. **No quites el guardián** (§1).

⚠️ **Cada guarda y cada invariante se verifica ROMPIÉNDOLA a propósito** y viendo caer lo que la
vigila. **Una guarda nueva, una rotura nueva en `tools/roturas.mjs`**; `npm run check:roturas` las
pasa todas (~2 min) en una copia, así que van enteras, en segundo plano, en cada tarea.

**Node, el de `.nvmrc`.** Si no está en el `PATH`, antepón `~/.nvm/versions/node/<versión>/bin`.

## Cómo se trabaja

**Correa larga:** se encadenan las tareas de una lista acordada con el usuario, **un bloque por
tanda**, sin pedir permiso entre una y otra. Las órdenes corren en un *sandbox* sin red y que sólo
escribe en el proyecto; `npm audit` y lo que necesite red, lo lanza el usuario.

- **Una rama por bloque**, sin *worktree*; **un commit por tarea**. Juntar con `main` y publicar,
  del usuario; un hook impide comitear en `main`. **`git add` por nombre, nunca `-A` ni `.`**: el
  *sandbox* tapa con `/dev/null` rutas que no existen, y `git status` las ve como nuevas.
- **Cada tarea, etiquetada al planificarla:** *(mecánica)*, cuando el cómo ya está decidido: si es
  larga, un subagente con Sonnet, que para ante cualquier decisión, y Claude la revisa; si es
  corta, Claude, que el subagente cuesta más que el cambio. *(pensar)*: Claude, con Opus.
- **El recorrido de cada tarea:** código → `check` → **revisor** (`.claude/agents/revisor.md`), y si
  objeta, Claude corrige, unas 3 vueltas como mucho o se aparca como duda → **verificador**
  (`verificador.md`), si se ve en el navegador: sólo los pasos que toca, sobre el cambio sin
  comitear → las roturas → commit. Quien escribe no se da el visto bueno. Una *(pensar)* de UI
  **para tras plantearla**: el usuario ve el planteamiento o una maqueta antes del código.
- **Al cerrar cada tarea**, lo suelto sale de `TAREAS.md` a `TERMINADAS.md` en una línea, sin ✅.
  Antes del commit, si el check pasa se mira en su código de salida: un `| tail` lo tapa.
- **Se para y se pregunta** ante una decisión no cerrada o que choque con una cerrada, al elegir
  entre soluciones con consecuencias distintas, ante una dependencia, un cambio del dominio o de un
  puerto, o un fallo sin arreglo. **Una duda que no bloquea**, a `TAREAS.md` → *Sin decidir*.
- **Al acabar la tanda**, al usuario: lo hecho, los commits, las dudas apuntadas y **lo que falta**.

**Al cerrar una fase**, además de `check:roturas` y, enteras, las listas de lo que tocó la fase:
1. **Auditoría de la documentación.** Un subagente que no ha escrito nada de la fase lee contra el
   repo `CLAUDE.md`, `ARCHITECTURE.md`, `TAREAS.md`, `README.md`, las listas de `test/` y `.claude/`,
   y devuelve cada afirmación falsa con fichero, línea y por qué; Claude corrige y se lo enseña al usuario.
2. **Repaso de la memoria de Claude**: lo que el repo ya cuenta o ha dejado de ser verdad, fuera; y
   `.claude/settings.local.json`, podado a lo de leer o consultar.

## Estructura y límites

```
src/
├── core/          # dominio + casos de uso + puertos. CERO plataforma
│   ├── domain/    # ← modelo, Position, helper, operaciones, Result
│   │   └── errors/#   ← StorageError y MigrationError. Sin index.ts, como domain/
│   ├── ports/     # ← los SEIS: Clock, IdGenerator, Repository, StorageAdapter, BlobStore, Logger
│   ├── app/       # ← acciones + reduce + Store + useCases + diffState
│   ├── migrations/# ← hydrate + runMigrations + cada migración (la mitad PURA del arranque)
│   └── index.ts
├── storage/       # ← memory/ · file/ · blobs/ (BlobStore es OTRO puerto). Conoce al core; él a ella no
├── ui/            # ← vanilla, con styles/ (un CSS por vista). Conoce sólo al core
└── platform/      # ← web/: composición, el ÚNICO sitio que inyecta adaptadores. Nadie la importa: sin index.ts
test/              # LAS PRUEBAS: espejo de src/, partido por capa, con las listas manuales
index.html         # carga dist/web/ con un importmap, sin bundler (§8.5)
manifest.webmanifest · assets/icono/ · pwa/sw.js · .github/workflows/   # la PWA (§8.6)
```

- **La verja de pureza:** `document.`, `crypto` o un temporizador en el core no compilan (`typecheck:core`); el
  reloj y el azar sí, y los caza `check:purity`. IDs, hora y azar entran **por puerto** (`IdGenerator`, `Clock`).
- **Ni `baseUrl` ni `paths`.** Los alias van en el campo `imports` de `package.json` y se calcan
  en el `importmap` de `index.html`: **un alias nuevo, en los dos sitios**, y sólo cuando el
  módulo exista. **Nada comprueba el `importmap`**: un alias olvidado ahí se ve al abrir la app.
- **Un `index.ts` por módulo** (menos `platform/`), y **sólo exporta lo que importa otro módulo de
  `src/`**, sin `export *` (`check:exportaciones`).
- **Las pruebas van en `test/`, espejo de `src/`** (`src/core/domain/operations.ts` → `test/core/domain/operations.test.ts`).
  Desde `test/` se importa **por alias y por su fichero** lo que el `index.ts` no anuncia (`#ui/noteActions`); entre
  ficheros de `test/`, relativo. Un ayudante sin pruebas **no lleva `.test`**.

## Reglas al escribir código

- **Cruzar de módulo, por alias contra el `index.ts`; dentro, relativo y CON `.js`**
  (`check:extensiones`):
  ```ts
  import { Note } from "#core/index"      // ✅ desde otro módulo; "../../core/domain/Note", ❌
  import { Note } from "./domain/Note.js" // ✅ dentro del core; sin .js, 404 en el navegador
  ```
- **Inmutabilidad:** `filter` / `map` / spread, **nunca** `push` / `splice`. `readonly` la fuerza.
- **⚠️ PRESERVAR LA IDENTIDAD CUANDO NO HAY CAMBIOS:** si una operación o el reducer no cambian
  nada, **devuelven el mismo objeto de entrada**. `map`, `filter` y `{ ...n }` crean objeto nuevo
  siempre: hacen falta envoltorios que comparen. Romperlo no tumba ningún test obvio (§3).
- **Tests de identidad con `assert.strictEqual`, nunca `deepEqual`.** Única excepción: la suite de
  contratos de `storage/` compara por valor a propósito. **No lo «arregles».**
- **El reducer, puro y total:** ni IDs, ni reloj, ni excepciones; `meta: { now, revision }` lo
  ponen los casos de uso. **Una operación que no aplica NO HACE NADA** en vez de fallar (§5).
- **Los errores se devuelven, no se lanzan** (`Result`). El `try/catch` vive sólo en las **fronteras**, donde se
  habla con algo que lanza. **Ausencia no es fallo:** `get` de lo que no está es `ok(null)` (§6.4).
- **⚠️ EL PELIGRO NO ES EL `throw`: ES LA LLAMADA SIN ENVOLVER.** Lo vigila `check:fronteras`, pero
  **su lista de lo peligroso se mantiene a mano**: si llamas a una API nueva que lanza, añádela ahí.
- **Un error se mira siempre**, aunque sea para registrarlo con el `Logger`: ni un `Result` ni una
  promesa se tiran, tampoco con `void` (`check:descartes`).
- **Un error nace en `src/core/domain/errors/`**, no donde se produce; `Result.ts`, en `domain/`.
- **`setChecked`, no `toggleChecked`:** un `toggle` nunca es no-op. Vale al nombrar cualquier operación.
- **Integridad referencial:** ninguna referencia a lo que **no está en el almacén** (una nota ilegible
  sí está). Borrar una nota la quita de sus contextos; referenciar lo que no existe es no-op.
- **TODO lleva tipo explícito**, aunque se infiera: declaraciones, parámetros y retornos, callbacks
  de una línea incluidos, en `src/` y en `test/`. **Cuatro excepciones:** `for…of` (TS2483), la
  constante que ES una función (sus parámetros y retorno sí), `as const` y destructuring. Las
  pruebas viejas de `test/core/` y `test/storage/` no la cumplen (deuda); lo que toques, sí. **Sin
  comprobación automática, a propósito: no la propongas** (§2.4).
- **`Context.items` es `ItemRef[]`, nunca `(Note | Diagram)[]`.** No negociable.
- **Nada de credenciales en el repo ni en el bundle.** Web: la sesión de un servicio externo, en el
  navegador, revocable desde ⚙ (aparcada: `TAREAS.md` → *Ideas aparcadas*). Desktop: keychain.
- **Ningún texto para quien usa la app va suelto en el código:** se pide a `textos` (`src/ui/textos/`) por su
  nombre, al usarlo, nunca en una constante al cargar. Uno nuevo, en `es` y en `en`. Lo del usuario no se traduce.
- **Comentarios en castellano.** La **cabecera** responde a «¿para qué sirve esto?» en 3-8 líneas,
  sin porqués. **Los comentarios de dentro se quedan.** Al quitar una cabecera, si explicaba un
  principio que no está en `ARCHITECTURE.md`, se mueve allí (§8.7). Sin `§` en el código
  (`check:paragrafos`).
- **Un porqué de una sola funcionalidad no va en `ARCHITECTURE.md`**: allí sólo los principios.

## Dependencias

**Sólo cuando se usan de verdad**, y fuera si dejan de usarse; antes, mirar si Node, TypeScript o
el navegador ya lo hacen. Cero de runtime. **Sin bundler ni servidor de desarrollo** (§8.5).

## Decisiones cerradas — no volver a proponer alternativas

**Arquitectura y herramientas**
- Carpetas con límites por `tsconfig`, no monorepo. Alias por `imports`, no `paths` ni `resolve.alias`.
- UI vanilla: ni React/Svelte/Solid/Angular, ni Redux, ni htmx. Snabbdom: lo reabren fallos de DOM, no el tamaño.
- CSS nativo, sin Tailwind ni preprocesador: un fichero por vista **en el orden de la cascada**,
  anidamiento nativo, `@layer base`, colores sólo en `base.css`. Al tocarlo, comparar el estilo calculado.
- Sin bundler: `importmap` y `.js` en los relativos. `node:test`, no vitest. Pruebas en `test/`.
- Navegador y UI se verifican **con listas escritas**, no con Playwright: a mano, o el verificador en el panel. Si
  tocas `DirectoryHandleBlobStore.ts`, se vuelve a pasar su lista (`test/storage/blobs/`; dos excepciones, en `TERMINADAS.md`).
- Un tipo de plataforma que falte se declara a mano, local; antes, mira si TypeScript ya lo trae.
- Sin dependencias para analizar el código (ni ESLint, ni Biome): un guardián vale si falla el
  build, es rápido y casi nunca se equivoca. Las roturas, con una lista a mano, no con Stryker.
  Para formatear, Prettier a 120 y sin punto y coma (no dprint, que baja de la red); los `.md`, a mano.
- Hooks en `.claude/settings.json`: antes de Bash, nada de comitear en `main`; al editar, los tipos y los guardianes;
  al terminar, `check` entero si hay cambios sin comitear en `src/`, `test/` o `tools/`.

**Dominio**
- Estado normalizado con `ItemRef`. `Versioned` con `revision` opaca. En un contexto, `hidden` ⊆ `items`.
- Calendario: `Day`/`Time` son texto; eventos y rutinas en el core, **sin grupos**; semanas de lunes a domingo;
  «hoy» lo da la plataforma; su orden, fuera del core. Evento: `*` en el día, **sin estado de hecho**; rutina tocada: sus días, con borde brillante.
- `Position`: `root-end`, `after`, `before`, `last-child-of`, para `insert` y `move`. ⚠️ No la justifiques por la barra.
- Nueve operaciones; **ni `indent`/`outdent`**. ⚠️ Anidar NO es `indent`: actúa en la siguiente. `move`: varias, juntas,
  con sus hijas; con un texto, a la raíz. «⠿ Ordenar»: tocar elige, se arrastra por el `⠿`, el dedo da la profundidad.
- Marcar una casilla NO arrastra a sus hijas; la cascada, si llega, en una sola acción.
- `merge`/`convertToText` con hijas: no-op. `remove`, varias; una casilla, con su árbol (papelera de «⠿ Ordenar», o seleccionada y Supr). `insert`, varias: todas o ninguna.
- `WritingMode` = «☐ Casilla» + anidar (sólo con casilla, actúa una vez). No se persiste. El resto
  del teclado lo fijan las pruebas del editor: si una cae, era una decisión.
- Una acción, una operación. Los casos de uso devuelven la entidad protagonista o `null`: ⚠️ no es undo.
- Lo público, en inglés; la maquinaria interna, en castellano. Diagrama (`Diagram`), no Plan.
- Seis puertos: el sexto, `Logger` (sólo el tipo), con `consoleLogger` en `platform/web/`; lo
  reciben en sus dependencias quienes registran.

**Persistencia y errores**
- **Manda el modelo, no el fichero:** un fichero o una fila es la copia guardada de una entidad.
- Espejo con local como primario. File System Access API, con OPFS de fallback.
- Un fichero por entidad + `manifest.json` con SÓLO `{ schemaVersion }` (ausente = versión 0). Éste vive en
  `StorageAdapter`; en un almacén vacío `boot` apunta la actual.
- Write-behind en dos piezas: qué está sucio, en el core; cuándo, en `storage/`. Sin `Scheduler`.
- `StorageError`, seis casos por «¿reintentar sirve?»; `corrupt` y `stale` no van dentro de `io`.
- Escritura condicional: ante `stale`, se detiene y avisa con **Recargar**.
- Fallo no reintentable: se detiene, avisa una vez. Un `io` se reintenta en silencio.
- `transaction` lleva `Result` dentro y fuera, y sobre ficheros NO es atómica.
- `BlobStore` devuelve `Result`; el sobre es suyo, el contenido de `FileStorageAdapter`.
- Ilegible (`corrupt`): se salta y se avisa con `onCorrupt`, conservando sus referencias.
- La forma de lo leído se valida en `storage/file/schema.ts`, no en el core.
- «Borrar todo»: marca y recarga; `main.ts` borra al arrancar, sólo claves `elnotas:`.

**Navegación y UI**
- Cinco vistas: ventanas, nota, diagrama, calendario, configuración. Lo de encima **se apila**; exit, paso a paso.
- Ventana = referencia (General, calendario, contexto, nota o diagrama); la lista, en el `UiState`, filtrada por `guardWindows`. Sin nada
  guardado, el General. Una ventana repetida, no: añadirla la activa. Un fallo al guardar no avisa.
- Al recargar, vuelve lo abierto encima: la nota, el diagrama o ⚙ (`elnotas:capas`, en `localStorage`, no
  `sessionStorage`), también en cadena (nota → nota por un enlace). Lo que ya no está se corta, y lo de encima con ello.
- Ventanas en pestañas, todas iguales (también el General y el calendario): ✕ sólo en la activa, sin
  confirmar. Se deslizan y se reordena con pulsación larga. Su «+», al final: contexto, nota o diagrama (los dos últimos, sin contexto). ⚙, sólo contextos.
- La papelera del General borra; la de un contexto, sólo quita. Confirmar, con hoja, no `window.confirm`.
- Selección por pulsación larga. «Mover a…» mueve y no confirma. Reordenar, con el `⠿` de la selección, no en el General.
- Texto: subconjunto de Markdown; **sólo la línea activa se edita en crudo**. El enlace `[texto](#id)` (nota, diagrama,
  evento o rutina), en una nota o en un nodo, **no lo lee el core** (excepción a la integridad referencial): roto, se ve apagado y no falla. Una
  casilla cuyo texto es sólo un enlace a rutina es un atajo: marca **hoy**, sin guardar nada en la nota.
- Nota nueva en su contexto, «Nueva Nota»; vacía se mantiene; nombres repetidos, sí. Título sólo en la cabecera,
  renombrable. `defaultView`, sin uso (en `TAREAS.md` → *Sin decidir*).
- El atrás del navegador cierra lo de encima; una capa sin entrada en el historial se cierra sin ir atrás.
- `UiState` (fósforo, idioma, ventanas, encuadres, orden y gráficas de rutinas, pestaña del calendario): un objeto en `elnotas:ui`, un
  adaptador, sin core ni versión; guardar una sección no pisa las otras. Las capas, fuera: dónde se está, no cómo se ve.

**Aspecto**
- Terminal de fósforo: **verde, ámbar o magenta, a elegir en ⚙**, verde por defecto; **siempre en oscuro**.
- Letra monoespaciada **del sistema**, sin fuente propia. Sin esquinas redondeadas ni sombras.
- Crear o confirmar, en **vídeo inverso**; el rojo, sólo para borrar y los errores. Sin verde «de crear».
- CRT suave y **fijo**: brillo leve y líneas de barrido con `pointer-events: none`. Nada se mueve.
- **Español o inglés, en ⚙**; de partida, el del navegador. Cambiarlo recarga. Los nombres por defecto, en el elegido
  («New Note»); lo ya creado no cambia. Días y meses con `Intl`. El `manifest`, sin traducir.

**Diagramas**
- Lienzo libre, desde cero: pósits HTML y líneas SVG, sin librería.
- El encuadre (centro y escala, no píxeles), en el `UiState`; se escribe al soltar, sin temporizador. La mira: origen, ×1.
- `DiagramRelation` en un multigrafo, flecha y texto opcionales; de un nodo a sí mismo, no-op.
- Nodos y relaciones en `Record`, sin `parents`/`children`. *Invertir* = `set-relation-ends`. Selección: un modo junto a la mira; su papelera confirma.
- Un solo tipo de nodo: posición, «hecho» y texto. Sin Markdown en el lienzo: texto, o un enlace entero con el nombre de lo enlazado.
- Gestos «doble = menú o crear»; mover guarda al soltar. Móvil = escritorio.
- En el lienzo se crea un texto o un enlace; una nota, no. Un diagrama se borra como una nota.

**PWA**
- GitHub Pages, rutas relativas. Publica Actions al subir a `main`, sólo si `check` pasa.
- Actualización en silencio (`skipWaiting`); un `import()` dinámico la reabriría.
- `persist()` en `main.ts`, fuera de `try` y de `check:fronteras`. *Service worker* en JS plano, `pwa/sw.js`, sólo en la copia publicada.
- Icono `purpose: "any"`: el «nerd» con lluvia de letras verdes sobre negro. Orientación libre, versión en ⚙, carga negra.
- Barras del móvil con el color del sistema: sin `theme-color` ni `theme_color`.

**Copia de seguridad**
- Un `.json` con los ficheros guardados TAL CUAL (los ilegibles también) y el `uiState`. Una v1 importa sólo ficheros.
- Importar **sustituye todo**; mezclar, aparcado. Sin tocar el core.
- «Guardar como» si el navegador lo tiene; si no, Descargas. No reabre «la carpeta del usuario».
- Antes de borrar, un ensayo con el mismo `boot`, en memoria; luego en dos tiempos, como «Borrar todo». A medias,
  la app no arranca: «Reintentar» o «Abandonar la importación».

Los principios, en `ARCHITECTURE.md`. Si una está mal, **plantéalo como duda**; no la cambies por tu cuenta.

## Fuera de alcance por ahora

No empezar sin pedirlo. Motivo y desbloqueo, en `TAREAS.md` → *Ideas aparcadas*.

- Las candidatas extra de la barra · el «reintentar» de `onError` · las ventanas en el core
- La carpeta del usuario y OPFS como destino, con «reconectar carpeta» · una librería para el lienzo
- La nube con Supabase (diseñada y aparcada: `TAREAS.md` → *Ideas aparcadas*) · `storageTarget`
- Importar mezclando · exportar a Markdown · formato de texto y texto más grande (sin fase)
- Sync entre pares · CRDTs, colaboración. Android (Capacitor) y escritorio (Tauri), en las fases 12 y 13

## Plan por fases

Las fases cerradas y las tandas sin fase, resumidas en `TERMINADAS.md` con sus commits. **Su
deuda**, en `TAREAS.md` → *Deuda de las fases cerradas*. **En curso:** la que lleve «EN CURSO».

## Comandos

```bash
npm run check                # todo lo de abajo hasta npm test, en orden. Esto antes de commit
npm run typecheck            # tsc de la app, con las opciones estrictas
npm run typecheck:core       # LA VERJA: falla si el core toca plataforma
npm run check:purity         # falla si el core lee el reloj o el azar
npm run check:fronteras      # falla si una excepción puede escaparse de su frontera
npm run check:extensiones    # falla si un import relativo de src/ no lleva .js
npm run check:descartes      # falla si un Result o una promesa se tiran sin mirarlos
npm run check:paragrafos     # falla si el código señala un documento por número de sección
npm run check:exportaciones  # falla si un index.ts anuncia lo que ningún otro módulo usa
npm run check:tareas         # falla si una tarea abierta no dice cómo se cierra
npm run check:arquitectura   # falla si ARCHITECTURE.md vuelve a ser anatomía o crónica, si CLAUDE.md
                             # pasa de 300 líneas o lleva fechas o recuentos de pruebas, o hay § rotas
npm run check:referencias    # falla si un documento nombra un fichero, una orden o un alias que no existe
npm run check:formato        # falla si algo no está como lo deja Prettier; npm run format lo arregla
npm test                     # compila src/ y test/ a tmp-test/, EXIGE que haya pruebas y las lanza
npm run check:roturas        # FUERA de check (~2 min), en una copia: puede ir a la vez. `-- fósforo`, sólo ésas
npm run build:web            # compila src/ a dist/web/ en ESM, para el navegador
python3 -m http.server 8000                # y se abre http://localhost:8000
python3 -m http.server 8000 --bind 0.0.0.0 # para el móvil: http://<IP del ordenador>:8000
npm run build:pages          # tras build:web: arma dist/pages/ (lo publicado). Niega rutas absolutas
npm run build:android        # tras build:web: dist/android/, sin service worker; luego npx cap sync android
```

**Publicar es hacer `push` a `main`**; lo hace el usuario (denegado aquí en `.claude/settings.json`,
a propósito). Lo publicado se prueba sirviendo `dist/pages/` en una subcarpeta de `localhost`.

`?depurar` en la dirección deja `window.elnotas = { store, useCases }` en la consola.

## Compact instructions

Al resumir, conserva fase, tarea, rama, la lista con ✅, las dudas, lo que estaba a medias y el
siguiente paso. **Tras compactar manda el repo**: un hook añade rama, cambios, commits y pendientes.
