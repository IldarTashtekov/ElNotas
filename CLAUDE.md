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
pasa, compruébalo antes: `find src -name '*.ts' | sort`, `npm run check`, `git log --oneline`.

En `src/` **conviven dos cosas** y no hay que confundirlas:

- **`src/core/` — la arquitectura nueva.** Dominio puro. **Es la referencia** de cómo se
  hacen las cosas aquí. Hoy tiene el modelo, el helper, las ocho operaciones y los puertos.
- **`src/scripts/` — el prototipo viejo**, anterior al rediseño. Sigue en el repo porque es
  lo único que hace algo visible, pero **no refleja esta arquitectura y no hay que imitarlo**.
  Se sustituye en la Fase 4 y hoy ni se puede construir (webpack está desinstalado).

**Lo que existe en el core: el modelo de datos y la mayor parte de la Fase 1.** ~800 líneas de
código y ~960 de pruebas, todo en `src/core/domain/`:

- **el modelo** — entidades (`Note`, `Plan`, `Context`), contenido (`Text` | `CheckBox`), IDs
  marcados, `ItemRef`, `AppState` normalizado y sus constructores;
- **`Position`** — el vocabulario del "dónde", tres casos, uno por cada modo de escritura;
- **el helper de copia por camino, con sus dos primitivas** — `updateContent.ts` (A:
  transformar un nodo) y `updateContainerOf.ts` (B: transformar el contenedor de una línea).
  **Maquinaria interna: NO salen por `index.ts`**;
- **las OCHO operaciones**, en `operations.ts` y todas exportadas: `setText`, `setChecked`,
  `insert`, `remove`, `convertToCheckBox`, `convertToText`, `split`, `merge`;
- **los dos puertos** en `src/core/ports/`: `Clock` e `IdGenerator`, **sólo las interfaces**.

**Lo que NO existe todavía:** el reducer, el `Store`, los casos de uso, la persistencia, la UI
y todo lo de Planes. Tampoco las implementaciones de los puertos —vivirían en `src/platform/`,
que no nace hasta la Fase 4— ni las carpetas `core/app/`, `core/migrations/`, `src/storage/`,
`src/ui/` ni `src/platform/`.

**`npm run check` está en verde y ya no puede pasar en falso:** `tools/require-tests.mjs` sale
con código 1 si no encuentra ningún `*.test.js` en `tmp-test/`, porque `node --test` sin
ficheros imprime `1..0` y sale con código 0. **No lo "arregles" quitando el guardián.**

⚠️ **Cada guarda y cada invariante se verifica ROMPIÉNDOLA a propósito** y comprobando que las
pruebas caen. Una prueba de identidad que no salta al romper lo que vigila no vale nada, y un
`deepEqual` pasaría igual de verde. Es la disciplina de esta capa, no una floritura.

## Estructura y límites

```
src/
├── core/          # dominio + casos de uso + puertos. CERO plataforma.
│   ├── domain/    # ← modelo + Position + helper + las 8 operaciones
│   ├── ports/     # ← Clock e IdGenerator (solo interfaces) · (F2) los de persistencia
│   ├── app/       # (F1) Store + reducer con UN caso · (F2) el catálogo completo
│   ├── migrations/# (F2)
│   └── index.ts
├── storage/       # (F2 memory · F3 file)
├── ui/            # (F4) vanilla: componentes + render(state)
└── platform/      # (F4) composición: el ÚNICO sitio que inyecta adaptadores
```

- **La verja de pureza es un error de compilación, no una convención.**
  `src/core/tsconfig.json` va sin `DOM` en `lib` y con `"types": []`, así que dentro del core
  un `document.` o un `crypto.randomUUID()` **no compila**. Si necesitas IDs, hora o azar,
  **inyéctalos por puerto** (`IdGenerator`, `Clock`). Los tests quedan excluidos de la verja.
- **El reloj y el azar los tapa un guardián aparte, no el compilador.** `Date.now()`,
  `new Date()` y `Math.random()` **sí compilan** en el core —están en `lib.es5.d.ts`, dentro
  de `lib: ["ES2020"]`—, así que el typecheck **no** los caza. Los caza
  `npm run check:purity` (`tools/check-core-purity.mjs`), que mira sólo el código: los
  comentarios y las cadenas pueden mencionarlos, y un `${Date.now()}` dentro de una plantilla
  también salta. Sigue siendo falso decir que el typecheck bloquea el reloj.
- **No añadas `baseUrl` ni `paths`.** `baseUrl` está deprecado en TS 6 y se retira en TS 7, y
  los alias van en el campo `imports` de `package.json`.
- **Un alias se declara cuando el módulo existe**, no antes. Hoy solo hay `#core/*`.
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
- **El reducer, puro y total:** no genera IDs, no lee el reloj y no lanza excepciones. Las
  acciones llevan un `meta: { now, revision }` construido por la capa de casos de uso, que es
  la que tiene inyectados `Clock` e `IdGenerator`.
- **Una operación que no aplica NO HACE NADA** en lugar de fallar. Así una acción inocua
  tampoco ensucia `updatedAt` ni `revision`. Enumerar los casos no-op es **la mitad de la
  especificación** de cada operación (tabla en `ARCHITECTURE.md` §9.3).
- **`setChecked`, no `toggleChecked`.** Un `toggle` no puede ser nunca un no-op; el nombre
  sostiene la invariante de identidad. Vale como criterio general al nombrar operaciones.
- **Integridad referencial:** no se deja una referencia apuntando a algo inexistente. Borrar
  una nota tiene que quitarla de los contextos que la listaban; añadir a un contexto una
  referencia a algo que no existe es un no-op.
- **`noUncheckedIndexedAccess` está activo.** Indexar `Record<NoteId, Note>` devuelve
  `Note | undefined`; hay que tratar el caso "ese id no existe".
- **`Context.items` es `ItemRef[]`, nunca `(Note | Plan)[]`.** No negociable.
- **Nada de credenciales en el repo ni en el bundle.** En web, OAuth con PKCE y token en
  memoria, **nunca** en localStorage. En desktop, keychain del sistema.
- **Los comentarios del código van en castellano**, igual que la documentación.

## Dependencias

**No se instala una dependencia hasta la fase en que se usa de verdad**, y se desinstala si
deja de usarse. Cero `dependencies` de runtime. Antes de añadir un paquete, comprobar si Node,
TypeScript o el navegador ya lo hacen nativamente.

Estado actual: **`typescript` y `@types/node`. Nada más** (17 paquetes, 27M, 0
vulnerabilidades, y conviene que siga así).

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
- **Fase 1 — Dominio puro. 🟡 EN CURSO.** Hecho el modelo de datos. Falta, en este orden: el
  **helper de copia por camino** (primero y solo; es la **primitiva A**, y la **B** va con las
  operaciones estructurales — §5.4), el tipo **`Position`**, las **ocho operaciones de
  contenido**, los puertos
  **`Clock`** e **`IdGenerator`** (solo interfaces), y una **rebanada vertical** (`Store` +
  reducer de un caso + caso de uso + suscriptor que cuente). Detalle en `TAREAS.md`; criterio
  de cierre en `ARCHITECTURE.md` §9.5.
- **Fase 2 — Acciones, puertos de persistencia y memory.**
- **Fase 3 — Fichero local.**
- **Fase 4 — UI.** El editor con checkboxes anidados: el corazón de la app.

**Las siete decisiones de la Fase 1 (a)–(g) están CERRADAS.** La fase está especificada entera
y se puede escribir de un tirón; el criterio de cierre es `ARCHITECTURE.md` §9.5. Las
respuestas y su porqué están en `TAREAS.md` → *Sin decidir*, que se conserva como registro. Lo
que sigue abierto es **de la Fase 4** (cuatro esquinas del teclado, el escalón de anidamiento,
el nombre en código de `ModosEscritura`) y no bloquea nada de la Fase 1.

## Comandos

```bash
npm run check           # las cuatro de abajo, en orden. Esto antes de commit.

npm test                # limpia tmp-test/, compila, EXIGE que haya pruebas, y lanza node --test
npm run typecheck       # tsc de la app (excluye tests)
npm run typecheck:core  # LA VERJA: falla si el core toca plataforma
npm run check:purity    # EL OTRO GUARDIÁN: falla si el core lee el reloj o el azar
```

No hay `build` ni `serve` hasta la Fase 4. `npm audit` da 0 vulnerabilidades.
