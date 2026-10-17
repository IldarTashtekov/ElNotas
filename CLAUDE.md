# ElNotas

App de notas personal, en TypeScript. **Web primero**, publicada como PWA; desktop y móvil
nativos, más adelante (shells sobre la misma UI web).

| Fichero | Qué hay dentro |
|---|---|
| **`CLAUDE.md`** (este) | las reglas que **nada automático vigila**. Corto a propósito: se carga en cada sesión. Sin fechas ni recuentos de pruebas, y 300 líneas como mucho (`check:arquitectura`) |
| **`ARCHITECTURE.md`** | el fundamento: los principios con su **porqué** y los conceptos explicados desde cero |
| **`TAREAS.md`** | qué está pendiente, qué está **sin decidir**, las ideas aparcadas y la historia de las fases |

Lo que caza el compilador o un guardián va aquí en una línea con su comando: si lo rompes,
`npm run check` te lo dice. Lo demás tienes que recordarlo tú.

## Estado actual del repo

**Verificado, no copiado.** Antes de afirmar qué existe, cuánto hay o si algo pasa:
`find src test -name '*.ts' | sort`, `npm run check`, `git log --oneline`. Manda `npm test`.

**Versión 1 cerrada** (etiqueta `v1.0.0`), publicada en `https://ildartashtekov.github.io/ElNotas/`.
Qué fase hay en curso y qué queda, en `TAREAS.md`.

- **`src/core/`** — dominio puro y la referencia de estilo: modelo, operaciones, puertos, acciones.
- **`src/storage/`** — los adaptadores de memoria y fichero, las dos de `BlobStore` y el `writeBehind`.
- **`src/platform/web/`** — la composición: los adaptadores de la web, el arranque y `main.ts`.
- **`src/ui/`** — vanilla: las cuatro vistas, el editor y el lienzo de diagramas.

**Qué se prueba dónde:** lo que exige la interfaz, en el contrato; lo de una sola implementación,
aparte (§6.3). En la UI, lo que decide es pura y con pruebas en Node; el DOM, **a mano** con las
listas `VERIFICACION-*.md` de `test/`, que también puede pasar Claude con el navegador del panel
(cómo, en `test/PASAR-LAS-LISTAS.md`; lo que borra, en `localhost:8001`, `web-8001`). El panel **sí**
registra *service workers*; lo que sólo se ve en el móvil —la PWA instalada, el selector de
Android— lo pasa el usuario.

**`npm run check` no puede pasar en falso:** falla si no hay ninguna prueba compilada. **No lo
«arregles» quitando el guardián** (§1).

⚠️ **Cada guarda y cada invariante se verifica ROMPIÉNDOLA a propósito** y viendo caer lo que la
vigila. **Una guarda nueva, una rotura nueva en `tools/roturas.mjs`**; `npm run check:roturas` las
pasa todas (unos 4 minutos): al cerrar cada tarea que toque `src/` y al cerrar una fase.

**Node, el de `.nvmrc`.** Si la sesión no lo tiene en el `PATH`, antepón
`~/.nvm/versions/node/<versión>/bin`; los hooks ya lo cogen solos.

## Estructura y límites

```
src/
├── core/          # dominio + casos de uso + puertos. CERO plataforma
│   ├── domain/    # ← modelo, Position, helper, operaciones, Result
│   │   └── errors/#   ← StorageError y MigrationError. Sin index.ts, como domain/
│   ├── ports/     # ← los SEIS: Clock, IdGenerator, Repository, StorageAdapter, BlobStore, Logger
│   ├── app/       # ← acciones + reduce + Store + useCases + diffState
│   ├── migrations/# ← hydrate + runMigrations (la mitad PURA del arranque)
│   └── index.ts
├── storage/       # ← memory/ · file/ · blobs/ (BlobStore es OTRO puerto). Conoce al core; él a ella no
├── ui/            # ← vanilla, con styles/ (un CSS por vista). Conoce sólo al core
└── platform/      # ← web/: composición, el ÚNICO sitio que inyecta adaptadores. Nadie la importa: sin index.ts
test/              # LAS PRUEBAS: espejo de src/, partido por capa, con las listas manuales
index.html         # carga dist/web/ con un importmap, sin bundler (§8.5)
manifest.webmanifest · assets/icono/ · pwa/sw.js · .github/workflows/   # la PWA (§8.6)
```

- **La verja de pureza:** `document.`, `crypto` o un temporizador en el core no compilan
  (`typecheck:core`); el reloj y el azar sí, y los caza `check:purity`. IDs, hora y azar entran
  **por puerto** (`IdGenerator`, `Clock`).
- **Ni `baseUrl` ni `paths`.** Los alias van en el campo `imports` de `package.json` y se calcan
  en el `importmap` de `index.html`: **un alias nuevo, en los dos sitios**, y sólo cuando el
  módulo exista. **Nada comprueba el `importmap`**: un alias olvidado ahí se ve al abrir la app.
- **Un `index.ts` por módulo** (menos `platform/`), y **sólo exporta lo que importa otro módulo de
  `src/`**, sin `export *` (`check:exportaciones`).
- **Las pruebas van en `test/`, espejo de `src/`** (`src/core/domain/operations.ts` →
  `test/core/domain/operations.test.ts`). Desde `test/` se importa **por alias y por su fichero**
  lo que el `index.ts` no anuncia (`#ui/noteActions`); entre ficheros de `test/`, relativo. Un
  ayudante sin pruebas **no lleva `.test`**.

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
- **Los errores se devuelven, no se lanzan** (`Result`). El `try/catch` vive sólo en las
  **fronteras**, donde se habla con algo que lanza. **Ausencia no es fallo:** `get` de lo que no
  está es `ok(null)` (§6.4).
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
  navegador, revocable desde ⚙ (sin construir: `TAREAS.md` → *La nube*). Desktop: keychain.
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
- Navegador y UI se verifican **con listas escritas**, no con Playwright: a mano, o Claude en el
  panel. Si tocas `DirectoryHandleBlobStore.ts`, se vuelve a pasar su lista (`test/storage/blobs/`;
  la única excepción, en `TAREAS.md`).
- Un tipo de plataforma que falte se declara a mano, local; antes, mira si TypeScript ya lo trae.
- Sin dependencias para analizar el código (ni ESLint, ni Biome): un guardián vale si falla el
  build, es rápido y casi nunca se equivoca. Las roturas, con una lista a mano, no con Stryker.
- Hooks en `.claude/settings.json`: al editar, los tipos y los guardianes; al terminar, `check`
  entero si hay cambios sin comitear en `src/`, `test/` o `tools/`.

**Dominio**
- Estado normalizado con `ItemRef`. `Versioned` con `revision` opaca.
- `Position`: `root-end`, `after`, `last-child-of`, sólo para `insert`. ⚠️ No la justifiques por la barra.
- Ocho operaciones; **ni `move` ni `indent`/`outdent`**. ⚠️ Anidar NO es `indent`: actúa en la siguiente.
- Marcar una casilla NO arrastra a sus hijas; la cascada, si llega, en una sola acción.
- `remove`, `merge` y `convertToText` de una línea con hijas: no-op. No existe «borrar una rama».
- `WritingMode` = «☐ Casilla» + anidar (sólo con casilla, actúa una vez). No se persiste. El resto
  del teclado lo fijan las pruebas del editor: si una cae, era una decisión.
- Una acción, una operación. Los casos de uso devuelven la entidad protagonista o `null`: ⚠️ no es undo.
- Lo público, en inglés; la maquinaria interna, en castellano. Diagrama (`Diagram`), no Plan.
- Seis puertos: el sexto, `Logger` (sólo el tipo), con `consoleLogger` en `platform/web/`; lo
  reciben en sus dependencias quienes registran.

**Persistencia y errores**
- **Manda el modelo, no el fichero:** un fichero o una fila es la copia guardada de una entidad.
- Espejo con local como primario. File System Access API, con OPFS de fallback.
- Un fichero por entidad (el grano: un documento por entidad) + `manifest.json` con SÓLO
  `{ schemaVersion }` (ausente = versión 0).
- `schemaVersion` vive en `StorageAdapter`; en un almacén vacío `boot` apunta la actual.
- Write-behind en dos piezas: qué está sucio, en el core; cuándo, en `storage/`. Sin `Scheduler`.
- `StorageError`, seis casos por «¿reintentar sirve?»; `corrupt` y `stale` no van dentro de `io`.
- Escritura condicional: ante `stale`, se detiene y avisa con **Recargar**.
- Fallo no reintentable: se detiene, avisa una vez, sólo informa. Un `io` se reintenta en silencio.
- `transaction` lleva `Result` dentro y fuera, y sobre ficheros NO es atómica.
- `BlobStore` devuelve `Result`; el sobre es suyo, el contenido de `FileStorageAdapter`.
- Ilegible (`corrupt`): se salta y se avisa con `onCorrupt`, conservando sus referencias.
- La forma de lo leído se valida en `storage/file/schema.ts`, no en el core.
- «Borrar todo»: marca y recarga; `main.ts` borra al arrancar, sólo claves `elnotas:`.

**Navegación y UI**
- Cuatro vistas: ventanas, nota, diagrama, configuración. Lo de encima **se apila**; exit, paso a paso.
- Ventana = referencia; la lista, en `localStorage`, fuera del core (no viaja), filtrada por `guardWindows`.
- Sin nada guardado, el General. Un contexto en dos ventanas, sí. Un fallo al guardar la lista no avisa.
- Al recargar, vuelve la nota o el diagrama abiertos encima (`elnotas:capas`, en `localStorage`, no
  `sessionStorage`); ⚙ no. Lo que ya no está se corta, y lo de encima con ello.
- Fichas en ⚙ que se arrastran; «+» en vídeo inverso en la última ventana para añadir otra. Ahí y en
  ⚙ se crea contexto, nota o diagrama; los dos últimos, sin contexto.
- La papelera del General borra; la de un contexto, sólo quita. Confirmar, con hoja, no `window.confirm`.
- Selección por pulsación larga. «Mover a…» mueve y no confirma.
- Nota nueva en su contexto, «Nueva Nota»; vacía se mantiene; nombres repetidos, sí.
- Título sólo en la cabecera, renombrable. `defaultView`, sin uso (en `TAREAS.md` → *Sin decidir*).
- El atrás del navegador cierra lo de encima; abrir una capa que no consigue su entrada en el
  historial no se cae, y se cierra sin ir atrás.

**Aspecto**
- Terminal de fósforo: **ámbar o verde, a elegir en ⚙**, ámbar por defecto; **siempre en oscuro**.
- El fósforo es de cada dispositivo: `localStorage` (`elnotas:phosphor`), fuera del core, no viaja.
- Letra monoespaciada **del sistema**, sin fuente propia. Sin esquinas redondeadas ni sombras.
- Crear o confirmar, en **vídeo inverso**; el rojo, sólo para borrar y los errores. Sin verde «de crear».
- CRT suave y **fijo**: brillo leve y líneas de barrido con `pointer-events: none`. Nada se mueve.

**Diagramas**
- Lienzo libre, desde cero: pósits HTML y líneas SVG, sin librería.
- El encuadre (punto del centro y escala, no píxeles) se recuerda **por dispositivo** en `elnotas:framing`,
  fuera del core; se escribe al soltar el lienzo, sin temporizador. La mira vuelve al origen a ×1.
- `DiagramRelation` en un multigrafo, flecha y texto opcionales; de un nodo a sí mismo, no-op.
- Nodos y relaciones en `Record`, sin `parents`/`children`. *Invertir* = `set-relation-ends`.
- Nodo-nota con el título en directo; sin nota, «Nota perdida» (en `delete-note` y `hydrate`).
- Gestos «doble = menú o crear», sin selección; mover guarda al soltar. Móvil = escritorio.
- Nota creada desde el lienzo: a todos los contextos del diagrama. Un diagrama se borra como una nota.

**PWA**
- GitHub Pages, rutas relativas. Publica Actions al subir a `main`, sólo si `check` pasa.
- Actualización en silencio (`skipWaiting`); un `import()` dinámico la reabriría.
- `persist()` en `main.ts`, fuera de `try` y de `check:fronteras`.
- *Service worker* en JS plano, `pwa/sw.js`, sólo en la copia publicada.
- Icono `purpose: "any"`, orientación libre, versión a la vista en ⚙, pantalla de carga negra.
- Icono: el dibujo del «nerd» con lluvia de letras verdes sobre negro.
- Barras del móvil con el color del sistema: sin `theme-color` ni `theme_color`.

**Copia de seguridad**
- Un `.json` con los ficheros guardados TAL CUAL (los ilegibles también), las ventanas, el fósforo y los encuadres.
- Importar **sustituye todo**; mezclar, aparcado. Sin tocar el core.
- «Guardar como» si el navegador lo tiene; si no, Descargas. No reabre «la carpeta del usuario».
- Antes de borrar, un ensayo con el mismo `boot`, en memoria. Luego en dos tiempos, como «Borrar todo».
- A medias, la app no arranca: «Reintentar» o «Abandonar la importación».

Los principios de los que salen, en `ARCHITECTURE.md`. Si crees que una está mal, **plantéalo como
duda**; no la cambies por tu cuenta.

## Fuera de alcance por ahora

No empezar sin pedirlo. Motivo y desbloqueo, en `TAREAS.md` → *Ideas aparcadas*.

- Reordenar y re-anidar líneas (`move`, `indent`, `outdent`), hasta contestar las tres preguntas
- Las candidatas extra de la barra · el «reintentar» de `onError` · las ventanas en el core
- La carpeta del usuario y OPFS como destino, con «reconectar carpeta» · una librería para el lienzo
- La nube con Supabase (diseñada, sin fase: `TAREAS.md` → *La nube*) · `storageTarget`
- Exportar a Markdown · importar mezclando · formato de texto y texto más grande (sin fase)
- Shells de desktop y móvil (Tauri / Capacitor) · sync entre pares · CRDTs, colaboración

## Plan por fases

Las fases 0 a 8 y las tandas sin fase están cerradas, resumidas en `TAREAS.md` con sus commits.
**Deuda que arrastran:** las tres preguntas del editor, sin contestar. **En curso:** la que diga
`TAREAS.md` → *Pendiente*.

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
npm test                     # compila src/ y test/ a tmp-test/, EXIGE que haya pruebas y las lanza
npm run check:roturas        # FUERA de check (~4 min): rompe a propósito y exige que algo caiga
npm run build:web            # compila src/ a dist/web/ en ESM, para el navegador
python3 -m http.server 8000                # y se abre http://localhost:8000
python3 -m http.server 8000 --bind 0.0.0.0 # para el móvil: http://<IP del ordenador>:8000
npm run build:pages          # tras build:web: arma dist/pages/ (lo publicado). Niega rutas absolutas
```

`npm run check:roturas -- fósforo` pasa sólo las que lo lleven en el nombre.

**Publicar es hacer `push` a `main`**; lo hace el usuario (denegado aquí en `.claude/settings.json`,
a propósito). Lo publicado se prueba sirviendo `dist/pages/` en una subcarpeta de `localhost`.

`?depurar` en la dirección deja `window.elnotas = { store, useCases }` en la consola.
