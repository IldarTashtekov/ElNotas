# ElNotas

App de notas personal, en TypeScript. **Web primero**, publicada como PWA; desktop y móvil
nativos, más adelante (shells sobre la misma UI web).

| Fichero | Qué hay dentro |
|---|---|
| **`CLAUDE.md`** (este) | las reglas. Corto a propósito: se carga en cada sesión |
| **`ARCHITECTURE.md`** | el diseño, sus **por qués**, los conceptos explicados desde cero y el plan por fases razonado |
| **`TAREAS.md`** | qué está pendiente, qué está **sin decidir**, y las ideas aparcadas |

## Estado actual del repo

**Verificado, no copiado.** Antes de afirmar qué existe, cuánto hay o si algo pasa:
`find src test -name '*.ts' | sort`, `npm run check`, `git log --oneline`. Manda `npm test`.

**Fases 0 a 6 cerradas; en curso, la Fase 7 — Refactor**, en la rama `fase-7-refactor`.
Publicada en `https://ildartashtekov.github.io/ElNotas/`.

- **`src/core/`** — dominio puro y la referencia de estilo: modelo, operaciones, puertos, acciones.
- **`src/storage/`** — los adaptadores de memoria y fichero, las dos de `BlobStore` y el `writeBehind`.
- **`src/platform/web/`** — la composición: reloj, ids, `boot`, ventanas, «Borrar todo» y `main.ts`.
- **`src/ui/`** — vanilla: las cuatro vistas (§7.4), el editor y el lienzo de diagramas (§7.5).

**Qué se prueba dónde:** lo que exige la interfaz, en el contrato; lo de una sola implementación,
aparte (§6.3). En la UI, lo que decide es pura y con pruebas en Node; el DOM, **a mano** con las
listas de `test/ui/`. La PWA, en un navegador de verdad: el del panel no registra *service workers*.

**`npm run check` no puede pasar en falso:** `tools/require-tests.mjs` falla si no hay ningún
`*.test.js` en `tmp-test/test/`. **No lo «arregles» quitando el guardián** (§8.3).

⚠️ **Cada guarda y cada invariante se verifica ROMPIÉNDOLA a propósito** y viendo caer las
pruebas. Una prueba que no salta al romper lo que vigila no vale nada.

## Estructura y límites

```
src/
├── core/          # dominio + casos de uso + puertos. CERO plataforma
│   ├── domain/    # ← modelo, Position, helper, operaciones, Result
│   │   └── errors/#   ← StorageError y MigrationError. Sin index.ts, como domain/
│   ├── ports/     # ← los CINCO: Clock, IdGenerator, Repository, StorageAdapter, BlobStore
│   ├── app/       # ← acciones + reduce + Store + useCases + diffState
│   ├── migrations/# ← hydrate + runMigrations (la mitad PURA del arranque)
│   └── index.ts
├── storage/       # ← memory/ · file/ · blobs/ (BlobStore es OTRO puerto). Conoce al core; él a ella no
├── ui/            # ← vanilla, con styles/ (un CSS por vista). Conoce sólo al core
└── platform/      # ← web/: composición, el ÚNICO sitio que inyecta adaptadores. Nadie la importa
test/              # LAS PRUEBAS: espejo de src/, partido por capa, con las listas manuales
index.html         # carga dist/web/ con un importmap, sin bundler (§8.6)
manifest.webmanifest · assets/icono/ · pwa/sw.js · .github/workflows/   # la PWA (§9.12)
```

- **La verja de pureza es un error de compilación:** `src/core/tsconfig.json` va sin `DOM` y con
  `"types": []`; un `document.` o un `crypto.randomUUID()` en el core **no compila**. IDs, hora y
  azar entran **por puerto** (`IdGenerator`, `Clock`).
- **El reloj y el azar no los para el compilador:** `Date.now()`, `new Date()` y `Math.random()`
  **sí compilan** en el core; los caza `npm run check:purity`.
- **Ni `baseUrl` ni `paths`.** Los alias van en el campo `imports` de `package.json` y se calcan
  en el `importmap` de `index.html`: **un alias nuevo, en los dos sitios**, y sólo cuando el
  módulo exista. Hoy: `#core/*`, `#storage/*`, `#platform/*`, `#ui/*`.
- **Un `index.ts` por módulo** como API pública: lo que no esté ahí no existe para los demás.
- **Las pruebas van en `test/`, espejo de `src/`** (`src/core/domain/operations.ts` →
  `test/core/domain/operations.test.ts`). Desde `test/` se importa **por alias, incluso lo que
  `index.ts` no exporta** (entre ficheros de `test/`, relativo); un ayudante sin pruebas **no
  lleva `.test`**; y las listas de verificación manual también viven ahí.

## Reglas al escribir código

- **Cruzar de módulo, por alias contra el `index.ts`; dentro, relativo y CON `.js`** (el navegador
  no adivina extensiones; lo vigila `check:extensiones`):
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
  ponen los casos de uso. **Una operación que no aplica NO HACE NADA** en vez de fallar (§9.3).
- **Los errores se devuelven, no se lanzan** (`Result`). El `try/catch` vive en **quince fronteras**:
  cinco en `FileStorageAdapter`, una en `writeBehind`, `MemoryStorageAdapter`, cada `BlobStore`,
  `runMigrations` y `main.ts`, y dos en `LocalStorageWindows` y en `resetStorage`. Por encima nada
  lanza, ni el código ajeno. **Ausencia no es fallo:** `get` de lo que no está es `ok(null)` (§6.5).
- **⚠️ EL PELIGRO NO ES EL `throw`: ES LA LLAMADA SIN ENVOLVER.** Si algo de plataforma o un aviso
  ajeno puede lanzar, va dentro de una frontera. Lo vigila `check:fronteras`, pero **su lista de lo
  peligroso se mantiene a mano**: una API nueva que lanza, se añade ahí.
- **Un error nace en `src/core/domain/errors/`**, no donde se produce; `Result.ts`, en `domain/`.
- **`setChecked`, no `toggleChecked`:** un `toggle` nunca es no-op. Vale al nombrar cualquier operación.
- **Integridad referencial:** ninguna referencia a lo que **no está en el almacén** (una nota ilegible
  sí está). Borrar una nota la quita de sus contextos; referenciar lo que no existe es no-op.
- **`noUncheckedIndexedAccess` activo:** indexar un `Record` da `T | undefined`; trata el caso.
- **TODO lleva tipo explícito**, aunque se infiera: declaraciones, parámetros y retornos, callbacks
  de una línea incluidos, en `src/` y en `test/`. **Cuatro excepciones:** `for…of` (TS2483), la
  constante que ES una función (sus parámetros y retorno sí), `as const` y destructuring. Las
  pruebas viejas de `test/core/` y `test/storage/` no la cumplen (deuda); lo que toques, sí. **Sin
  comprobación automática, a propósito: no la propongas** (§2.4).
- **`Context.items` es `ItemRef[]`, nunca `(Note | Diagram)[]`.** No negociable.
- **Nada de credenciales en el repo ni en el bundle.** Web: PKCE, token en memoria. Desktop: keychain.
- **Comentarios en castellano.** La **cabecera** responde a «¿para qué sirve esto?» en 3-8 líneas,
  sin porqués (van en `ARCHITECTURE.md`). **⚠️ NADA de `§` en el código**: si hay que señalar un
  documento, se nombra el fichero. **Los comentarios de dentro se quedan**; al quitar una cabecera,
  lo que no esté en `ARCHITECTURE.md` se mueve allí (§8.6, al final).

## Dependencias

**Sólo cuando la fase las usa de verdad**, y fuera si dejan de usarse; antes, mirar si Node,
TypeScript o el navegador ya lo hacen. Cero de runtime. Hoy: **`typescript` y `@types/node`** (tres
paquetes en el `package-lock.json`). **Sin bundler ni servidor de desarrollo** (§8.4).

## Decisiones cerradas — no volver a proponer alternativas

**Arquitectura y herramientas**
- Carpetas con límites por `tsconfig`, no monorepo. Alias por `imports`, no `paths` ni `resolve.alias`.
- UI vanilla: ni React/Svelte/Solid/Angular, ni Redux, ni htmx. Snabbdom: lo reabren fallos de DOM, no el tamaño.
- CSS nativo, sin Tailwind ni preprocesador: un fichero por vista **en el orden de la cascada**,
  anidamiento nativo, `@layer base`, colores sólo en `base.css`. Al tocarlo, comparar el estilo calculado.
- Sin bundler: `importmap` y `.js` en los relativos. `node:test`, no vitest. Pruebas en `test/`.
- Navegador y UI se verifican **a mano**, no con Playwright. Si tocas `DirectoryHandleBlobStore.ts`,
  se vuelve a pasar su lista (`test/storage/blobs/`; la única excepción, en `TAREAS.md`).
- Un tipo de plataforma que falte se declara a mano, local; antes, mira si TypeScript ya lo trae.

**Dominio y editor**
- Estado normalizado con `ItemRef`. `Versioned` con `revision` opaca. Fase 1 = bajo `Versioned`.
- El helper de copia por camino son DOS primitivas, con la recursión escrita una vez.
- `Position`: `root-end`, `after`, `last-child-of`, sólo para `insert`. ⚠️ No la justifiques por la barra.
- Ocho operaciones; **ni `move` ni `indent`/`outdent`**. ⚠️ Anidar NO es `indent`: actúa en la siguiente.
- Marcar una casilla NO arrastra a sus hijas; la cascada, si llega, en una sola acción.
- `remove`, `merge` y `convertToText` de una línea con hijas: no-op. No existe «borrar una rama».
- Retroceso en una casilla: `convertToText`, y luego `merge` con la línea que se ve encima.
- `WritingMode` = «☐ Casilla» + anidar (sólo con casilla, actúa una vez). No se persiste.
- Intro al final de un texto: `after`, debajo (`root-end`, sólo en nota vacía). Desde una casilla
  anidada con el interruptor apagado —Intro o partir—, sale texto bajo su casilla de la raíz.
- Anidar armado en un texto crea casilla hermana; `split` no anida. Marcar: Ctrl/Cmd+Intro.
- Una acción, una operación. Los casos de uso devuelven la entidad protagonista o `null`: ⚠️ no es undo.
- Lo público, en inglés; la maquinaria interna, en castellano. Diagrama (`Diagram`), no Plan.

**Persistencia y errores**
- Espejo con local como primario. File System Access API, con OPFS de fallback.
- Un fichero por entidad + `manifest.json` con SÓLO `{ schemaVersion }` (ausente = versión 0).
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

**Navegación y UI** (§7.4)
- Cuatro vistas: ventanas, nota, diagrama, configuración. Lo de encima **se apila**; exit, paso a paso.
- Ventana = referencia; la lista, en `localStorage`, fuera del core (no viaja), filtrada por `guardWindows`.
- Sin nada guardado, el General. Un contexto en dos ventanas, sí. Un fallo al guardar la lista no avisa.
- Fichas en ⚙ que se arrastran; «+» verde en la última ventana para añadir otra. Ahí se crea
  contexto, nota o diagrama; los dos últimos, sin contexto. En ⚙, sólo contexto.
- La papelera del General borra; la de un contexto, sólo quita. Confirmar, con hoja, no `window.confirm`.
- Selección por pulsación larga. «Mover a…» mueve y no confirma.
- Nota nueva en su contexto, «Nueva Nota»; vacía se mantiene; nombres repetidos, sí.
- Título sólo en la cabecera, renombrable. `defaultView`, sin uso.

**Diagramas** (§9.11)
- Lienzo libre, desde cero: pósits HTML y líneas SVG, sin librería. El encuadre no se recuerda.
- `DiagramRelation` en un multigrafo, flecha y texto opcionales; de un nodo a sí mismo, no-op.
- Nodos y relaciones en `Record`, sin `parents`/`children`. *Invertir* = `set-relation-ends`.
- Nodo-nota con el título en directo; sin nota, «Nota perdida» (en `delete-note` y `hydrate`).
- Gestos «doble = menú o crear», sin selección; mover guarda al soltar. Móvil = escritorio.
- Nota creada desde el lienzo: a todos los contextos del diagrama. Un diagrama se borra como una nota.

**PWA** (§9.12)
- GitHub Pages, rutas relativas. Publica Actions al subir a `main`, sólo si `check` pasa.
- Actualización en silencio (`skipWaiting`); un `import()` dinámico la reabriría.
- `persist()` en `main.ts`, fuera de `try` y de `check:fronteras`.
- *Service worker* en JS plano, `pwa/sw.js`, sólo en la copia publicada.
- Icono `purpose: "any"`, orientación libre, versión a la vista en ⚙, pantalla de carga azul.
- Barras del móvil con el color del sistema (Fase 7: fuera `theme-color` y `theme_color`).

El porqué de cada una está en `ARCHITECTURE.md`. Si crees que una está mal, **plantéalo como
duda**; no la cambies por tu cuenta.

## Fuera de alcance por ahora

No empezar sin pedirlo. Motivo y desbloqueo, en `TAREAS.md` → *Ideas aparcadas*.

- Reordenar y re-anidar líneas (`move`, `indent`, `outdent`), hasta contestar las tres preguntas
- Las candidatas extra de la barra · el «reintentar» de `onError` · las ventanas en el core
- La carpeta del usuario y OPFS como destino, con «reconectar carpeta» · una librería para el lienzo
- Adaptadores de MongoDB y Google Drive · `CompositeStorage` y outbox · `storageTarget` por contexto
- Exportar e importar las notas · formato de texto y texto más grande (sin fase)
- Shells de desktop y móvil (Tauri / Capacitor) · sync, CRDTs, colaboración

## Plan por fases

- **Fases 0 a 3** — andamiaje, dominio puro, acciones y persistencia, fichero local. ✅ (§9.5–§9.9)
- **Fase 4 — UI, sólo web.** ✅ Con deuda: **las tres preguntas del editor, sin contestar** (§9.10).
- **Fase 5 — Diagramas.** ✅ Modelo, Lienzo y Relaciones (§9.11).
- **Fase 6 — PWA.** ✅ Publicada e instalada en el móvil del usuario (§9.12).
- **Fase 7 — Refactor. EN CURSO**, rama `fase-7-refactor`, **729 pruebas**. Hecho: la barra de la
  nota sube con el teclado, barras del móvil sin color propio, puntos del lienzo a media intensidad,
  pósits a `8rem`, arranque medido (no duele), arrastre de nodos optimizado, documentación
  adelgazada y nota o diagrama nuevos desde el «+». **Falta:** verlo en el móvil (teclado, la L,
  arrastre y el «+»).

**Abierto** (`TAREAS.md`): si entra OPFS y qué pasa con lo guardado en `localStorage` al cambiar
de destino. Sin fase: exportar/importar, pasar de Node 20 y el azul repetido en el manifiesto.

## Comandos

```bash
npm run check              # las seis de abajo, en orden. Esto antes de commit.
npm run typecheck          # tsc de la app: sólo src/, que es donde vive el código
npm run typecheck:core     # LA VERJA: falla si el core toca plataforma
npm run check:purity       # GUARDIÁN: falla si el core lee el reloj o el azar
npm run check:fronteras    # GUARDIÁN: falla si una excepción puede escaparse de su frontera
npm run check:extensiones  # GUARDIÁN: falla si un import relativo de src/ no lleva .js
npm test                   # compila src/ y test/ a tmp-test/, EXIGE que haya pruebas y las lanza
npm run build:web          # compila src/ a dist/web/ en ESM, para el navegador
python3 -m http.server 8000                # y se abre http://localhost:8000
python3 -m http.server 8000 --bind 0.0.0.0 # para el móvil: http://<IP del ordenador>:8000
npm run build:pages        # tras build:web: arma dist/pages/ (lo publicado). Niega rutas absolutas
```

**Publicar es hacer `push` a `main`**; lo hace el usuario (denegado aquí en `.claude/settings.json`,
a propósito). Lo publicado se prueba sirviendo `dist/pages/` en una subcarpeta de `localhost`.

`?depurar` en la dirección deja `window.elnotas = { store, useCases }` en la consola.
