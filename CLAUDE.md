# ElNotas

App de notas personal, en TypeScript. **Web primero**, con desktop y móvil previstos
más adelante (shells nativos sobre la misma UI web).

## Estado actual del repo

En `src/` **conviven dos cosas** y no hay que confundirlas:

- **`src/core/` — la arquitectura nueva.** Dominio puro. **Esta es la referencia** de
  cómo se hacen las cosas aquí, aunque hoy solo contenga el modelo de datos.
- **`src/scripts/` — el prototipo viejo**, anterior al rediseño. Sigue en el repo porque
  es lo único que hace algo visible, pero **no refleja esta arquitectura y no hay que
  imitarlo**. Se sustituye en la Fase 4. Ahora mismo ni se puede construir (webpack está
  desinstalado hasta esa fase).

**Lo que existe en el core: SÓLO el modelo de datos.** Las entidades (`Note`, `Plan`,
`Context`), su contenido (`Text` | `CheckBox`), los IDs marcados, `ItemRef` y `AppState`
normalizado. Más los constructores mínimos para crear y discriminar esos valores
(`noteId(...)`, `checkBox(...)`, `isCheckBox(...)`), que son parte del modelo: sin ellos
un tipo marcado o una unión discriminada no se pueden usar. **325 líneas y cero tests.**

**Lo que NO existe, por decisión explícita:** ninguna operación sobre el modelo. Ni el
árbol de contenido (`setChecked`, `insert`, `move`, `indent`…), ni reducers, ni `Store`,
ni casos de uso, ni persistencia, ni UI nueva, ni nada de Planes.

> Se escribió una primera versión de esa lógica y **se eliminó a propósito** para dejar
> primero el modelo asentado. El diseño que tenía sigue documentado más abajo (es la
> referencia para cuando se reescriba), pero **hoy no hay ni una línea de ella en el
> repo**. No des por hecho que existe: compruébalo.

**Bugs conocidos del prototipo** — se resuelven al sustituirlo, no hace falta parchearlos:
`context.items` apunta al array `notes` original que luego se reasigna, así que el
contexto se queda vacío para siempre; y `deleteNoteBtn` no limpia `selectedNotesId`.

## El dominio

Tres entidades, más nociones de agrupación:

- **Note** — lista de contenido heterogéneo (`Text` | `CheckBox`). Los checkboxes son
  **recursivos** (tienen hijos), para TODOs anidados.
- **Plan** — un **grafo** de nodos (`SimpleNode` | `NoteNode`) con posición X/Y y
  aristas por ID, para esquematizar tareas. Un `NoteNode` es el puente: al pincharlo
  entras en una Nota.
- **Context** — agrupa notas y planes, y decide su `defaultView` (la lista, o entrar
  directo a una nota o plan concreto).
- **ContextoGeneral** — **vista derivada** de todas las notas y planes. No es una
  entidad y no se persiste.
- **ContextoCompuesto** — unión de varios contextos. Sale casi gratis del modelo por
  referencias (ver abajo).
- **Ventanas** — navegación estilo app de móvil. Es **estado de vista, no de dominio**:
  va separado de `AppState` y no se mezcla con los datos persistidos.

## Arquitectura

### Hexagonal (ports & adapters)

El `core` es puro: define **interfaces** (puertos) para todo lo que sea plataforma, y
los adaptadores las implementan. La dependencia va siempre de fuera hacia dentro — el
core no importa nada de nadie.

```
src/
├── core/          # dominio + casos de uso + puertos. CERO plataforma.
│   ├── domain/    # ← lo ÚNICO que existe hoy (y solo tipos)
│   ├── ports/     # (Fase 2)
│   ├── app/       # (Fase 2) Store, reducers, casos de uso
│   ├── migrations/# (Fase 2)
│   └── index.ts
├── storage/
│   ├── memory/
│   ├── file/      # FileStorageAdapter + los BlobStore
│   └── contract-tests/
├── ui/            # vanilla: componentes + render(state)
└── platform/
    └── web/       # composición: el ÚNICO sitio que decide qué adaptador se inyecta
```

`platform/` es la capa de composición. Cuando llegue desktop, aparece
`platform/desktop/` al lado y **nada más se toca**.

### Pureza del core: es un error de compilación, no una convención

`src/core/tsconfig.json` va **sin `DOM` en `lib`** y **sin `@types/node`**
(`"types": []`). Así, dentro del core, un `document.` o un `crypto.randomUUID()`
**no compila**. Verificado: falla cuando debe, y el typecheck de la app sigue
aceptando ese mismo código.

Si necesitas IDs, hora o azar en el core, **inyéctalos por puerto** (`IdGenerator`,
`Clock`). Los tests (`**/*.test.ts`) quedan excluidos de la verja: la pureza aplica al
código de producción, y un test sí puede tocar APIs de plataforma.

Cuatro tsconfig, cada uno con un trabajo:

| Fichero | Para qué |
|---|---|
| `tsconfig.base.json` | opciones comunes. **Sin `paths` ni `baseUrl`** |
| `tsconfig.json` | la app (con `DOM`), excluye los tests |
| `src/core/tsconfig.json` | **la verja de pureza** |
| `tsconfig.test.json` | compila los tests a `tmp-test/` con tipos de Node |

**No añadas `baseUrl` ni `paths`.** `baseUrl` está deprecado en TS 6 y se retira en TS 7,
y `paths` es innecesario: los alias van en el campo `imports` de package.json (abajo).

### Alias entre módulos: campo `imports` de package.json

```json
"imports": {
  "#core/*": {
    "compiled": "./tmp-test/core/*.js",
    "default": "./src/core/*.ts"
  }
}
```

Una sola declaración que entienden **TypeScript, Node y los bundlers de forma nativa**:
sin `paths`, sin `resolve.alias` y sin plugins que los sincronicen. La condición
`compiled` es la que permite que los tests, que corren sobre el JS compilado en
`tmp-test/`, resuelvan el mismo especificador `#core/...` (ver "Tests" abajo).

Reglas:

- **Entre módulos**, siempre por el alias y contra el `index.ts`: `#core/index`.
- **Dentro de un módulo**, imports relativos: `./domain/Note`.
- Un alias **se declara cuando el módulo existe**, no antes. Hoy solo hay `#core/*`;
  `#storage/*`, `#ui/*` y `#platform/*` se añaden en su fase. Efecto secundario útil:
  importar `#ui/algo` desde el core falla porque ese alias todavía no existe.

### Tests: runner nativo de Node, sin dependencias

`node:test` + `node:assert/strict`, sin runner externo. Node 20 no ejecuta TypeScript,
así que `npm test` hace dos cosas: compila `src/` a `tmp-test/` (CommonJS) y lanza
`node --conditions=compiled --test tmp-test`. Ese `--conditions=compiled` es lo que
redirige `#core/*` al JS compilado.

Es más lento que un runner dedicado y no tiene watch mode; es el precio elegido a
cambio de cero dependencias.

⚠️ **Ahora mismo no hay ningún test**, y `node --test` sin ficheros sale con código 0:
`npm test` pasa en verde sin comprobar nada. No hay ninguno porque lo único que existe
es el modelo de datos, que son tipos y no tiene comportamiento que comprobar. Los
primeros llegarán con la lógica del dominio, y serán también los que verifiquen que el
alias `#core/` resuelve bien en ambos modos (typecheck contra `src/`, ejecución contra
`tmp-test/`).

**Pendiente sin resolver:** los adaptadores sobre `FileSystemDirectoryHandle` y OPFS de
la Fase 3 necesitan un navegador real, y esto no lo cubre. Hay que decidirlo al llegar
ahí, no antes.

### Estado normalizado, con referencias por ID

Las entidades **no se anidan** unas dentro de otras. `AppState` es plano, como una mini
base de datos:

```ts
export type NoteId    = string & { readonly __brand: "NoteId" }
export type PlanId    = string & { readonly __brand: "PlanId" }
export type ContextId = string & { readonly __brand: "ContextId" }

export type ItemRef =
  | { kind: "note"; id: NoteId }
  | { kind: "plan"; id: PlanId }

export interface AppState {
  notes:    Record<NoteId, Note>
  plans:    Record<PlanId, Plan>
  contexts: Record<ContextId, Context>
}
```

Todas las interfaces del dominio son `readonly` de arriba abajo (y los arrays,
`ReadonlyArray`). Así la regla de inmutabilidad no depende de la disciplina de nadie:
un `push` o una asignación a un campo **no compilan**.

`schemaVersion` entra en la Fase 2, con el runner de migraciones que lo consume.

Dos cambios respecto al modelo del prototipo, ambos deliberados:

- **`Content` es una unión discriminada**, no una interfaz base `{ type: string }` de la
  que hereden `Text` y `CheckBox`. Con `type: string` el compilador no puede comprobar
  exhaustividad en un `switch`, que es justo lo que interesa que compruebe.
- **`Text` también lleva `id`.** Hace falta para direccionar un bloque concreto al
  editarlo y para la reconciliación por `data-id` de la UI.

`Context.items` es `ItemRef[]`, **nunca** `(Note | Plan)[]`. Esto es deliberado y no
negociable, por tres razones: una nota puede estar en varios contextos (que es lo que
exige ContextoCompuesto), guardar un contexto no reescribe sus notas, y `ItemRef` es
discriminable en runtime mientras que `Note` y `Plan` no lo son.

### `Versioned`: los metadatos de escritura

```ts
export interface Versioned {
  readonly updatedAt: number    // del puerto Clock, nunca Date.now()
  readonly revision: Revision   // del puerto IdGenerator; cambia en cada escritura
}

export interface Note extends Versioned { readonly id: NoteId; /* ... */ }
```

Se llama `Versioned` y **no `Entity`** porque no es una entidad: no tiene id ni
contenido. Es la chapa de metadatos que una entidad lleva encima, y `Note extends
Versioned` sí es una frase verdadera.

**No lleva `id`** a propósito: cada entidad declara el suyo con su tipo marcado
(`NoteId`, `PlanId`, `ContextId`). Un `id: string` heredado tiraría por tierra el
marcado de `Ids.ts`.

Los dos campos van desde el principio aunque hoy no haya sync: son campos de entidades
que acabarán en disco, y añadirlos cuando ya haya notas guardadas sería una migración de
datos.

**`revision` (antes `rev`) es un token opaco, no un contador.** Lo único que se puede
preguntar es si sigue siendo el mismo. Sirve para escribir condicionalmente y así
**detectar** que algo cambió por debajo, no para resolver el conflicto: qué hacer
entonces es una política aparte, y "gana el último" **no** es la elegida. Se prefiere a
comparar `updatedAt` porque los relojes de dos dispositivos no coinciden y porque "gana
el más nuevo" pierde datos sin avisar.

Se descartó `version: number` (un contador que daría también orden) porque colisiona
conceptualmente con `schemaVersion`: uno versiona un dato y el otro el formato de todos.

### `CheckBox` lleva `id`

Los checkboxes anidados se direccionan **por `id`**, nunca por ruta de índices: una ruta
como `[0, 2, 1]` se rompe en cuanto insertas o borras un hermano. El `id` además le da a
la UI su clave de reconciliación.

### Persistencia

Dos puertos, a propósito en dos niveles:

```ts
export interface Repository<T> {
  get(id: string): Promise<T | null>
  getAll(): Promise<T[]>
  put(entity: T): Promise<void>
  delete(id: string): Promise<void>
}

export interface StorageAdapter {
  readonly notes:    Repository<Note>
  readonly plans:    Repository<Plan>
  readonly contexts: Repository<Context>
  transaction<T>(fn: () => Promise<T>): Promise<T>   // best-effort según adaptador
  getSchemaVersion(): Promise<number>
  setSchemaVersion(v: number): Promise<void>
}

/** Nivel bajo: solo mueve bytes. No sabe qué es una Nota. */
export interface BlobStore {
  read(path: string): Promise<Uint8Array | null>
  write(path: string, data: Uint8Array): Promise<void>
  delete(path: string): Promise<void>
  list(prefix: string): Promise<string[]>
}
```

**Todos los puertos son `async`, incluso los adaptadores sincrónicos.** Si un adaptador
en memoria expone firmas sincrónicas, enchufar red o SQLite después obliga a reescribir
todos los llamantes.

El `BlobStore` existe porque un fichero local y un fichero remoto solo difieren en
**dónde van los bytes**. Un único `FileStorageAdapter` parametrizado por `BlobStore` da:

| Objetivo | Implementación |
|---|---|
| Desarrollo / fallback | `LocalStorageBlobStore` (~30 líneas) |
| Fichero local en disco | `DirectoryHandleBlobStore` con `showDirectoryPicker()` (Chromium) |
| Fallback otros navegadores | el **mismo** `DirectoryHandleBlobStore` con OPFS (`navigator.storage.getDirectory()`) |
| Drive (más adelante) | `DriveBlobStore` |

La File System Access API y OPFS exponen el mismo `FileSystemDirectoryHandle`: solo
cambia **cómo obtienes el handle**, no la implementación.

**Formato:** un fichero por entidad (`notes/<id>.json`) más un `manifest.json`. Da
diffs pequeños y conflictos por nota en vez de globales.

**Semántica multi-backend (decidida, aún no construida):** espejo con **el fichero
local siempre como primario y fuente de verdad**. Los backends remotos son réplicas
alimentadas por un **outbox durable** con reintentos, para que la app nunca se bloquee
porque la red o un token fallen. El estado de sincronización es **dato persistido**, no
estado en memoria.

**La config de storage no puede vivir en el storage que configura.** Necesita su propio
sitio aparte (`settings.json` o localStorage), o tienes un huevo-y-gallina al arrancar.

### Tests de contrato

Una sola especificación (`storage/contract-tests`) que **todos** los adaptadores deben
pasar. Un adaptador está terminado cuando pasa el contrato — es la única definición de
"modular" que no se degrada. Corre en dos modos: `unit` (memory, directorio temporal) en
cada commit, e `integration` (servicios reales) opt-in por variable de entorno.
Los adaptadores basados en `FileSystemDirectoryHandle` y OPFS necesitan navegador real.

### UI: vanilla, con store y `render(state)`

Sin framework. El core expone reducers puros y un `Store`; la UI se suscribe y despacha.
La inmutabilidad da detección de cambios gratis por referencia:

```ts
dispatch(action: Action) {
  const next = reduce(this.state, action)
  if (next === this.state) return        // sin cambios → sin render
  this.state = next
  this.listeners.forEach(l => l(this.state))
}
```

Dos reglas que evitan el dolor conocido de este enfoque:

1. **Reconciliación por `data-id`**, no re-render ciego de listas.
2. **El nodo que tiene el foco no se re-renderiza.** Con `contenteditable`, un re-render
   completo te borra el cursor a mitad de escribir. Mientras un nodo está enfocado el DOM
   es la fuente de verdad, y se hace `dispatch` en `blur` o con debounce.

La persistencia se engancha como **suscriptor con write-behind y debounce**, escribiendo
solo las entidades marcadas como sucias. Nunca guardar en cada tecla.

## Dependencias: instalar solo lo de la fase actual

**Regla del proyecto, decidida explícitamente:** no se instala una dependencia hasta la
fase en que se usa de verdad, y se desinstala si deja de usarse. Cero `dependencies` de
runtime, y `devDependencies` al mínimo.

Antes de añadir un paquete, comprobar si Node, TypeScript o el navegador ya lo hacen
nativamente. Dos casos reales de este proyecto:

- los alias no necesitan `paths` ni plugins → campo `imports` de package.json;
- los tests no necesitan runner → `node:test`.

Estado actual (Fase 1): **`typescript` y `@types/node`. Nada más.** El árbol completo son
17 paquetes, 27M y cero vulnerabilidades.

Webpack, webpack-cli, webpack-dev-server y ts-loader **están desinstalados a propósito**:
no se usan hasta la Fase 4. `webpack.config.js` sigue en el repo, pero `npm run build` y
`npm run serve` **no existen ahora mismo**, y por tanto el prototipo de `src/scripts/` no
se puede construir ni servir. Para recuperarlo cuando toque:

```bash
npm i -D webpack webpack-cli webpack-dev-server ts-loader
```

y volver a añadir los scripts `build` y `serve` a package.json. Nótese que toda la
cadena de `webpack-dev-server` es la que traía las 12 vulnerabilidades de `npm audit`.

## Convenciones

- **Inmutabilidad:** en arrays usar `filter` / `map` / spread, **nunca** `push` / `splice`.
  Es una regla del proyecto anterior a este rediseño y se mantiene: es lo que hace
  funcionar la comparación por referencia del store. Los tipos `readonly` la fuerzan.

Las tres siguientes son **para cuando se escriba la lógica**. Hoy no hay código al que
apliquen, pero son las conclusiones de un intento previo y ahorran repetir el análisis:

- **⚠️ PRESERVAR LA IDENTIDAD CUANDO NO HAY CAMBIOS.** La invariante más fácil de
  romper sin darse cuenta, y la que sostiene todo el rendimiento: si una operación de
  dominio o el reducer no cambian nada, **tienen que devolver el mismo objeto de
  entrada**, no una copia equivalente. El `Store` decidirá si re-renderizar con un
  `next === current`, así que una función que siempre devuelve objeto nuevo desactiva
  esa optimización en silencio y sin que ningún test obvio falle.
  Ojo: `Array.map` y `Array.filter` devuelven **siempre** un array nuevo, así que no
  sirven directamente — hacen falta envoltorios que comparen y devuelvan la entrada
  intacta, y tests que comprueben referencias (no valores).
- **El reducer, puro y total:** no genera IDs, no lee el reloj y no lanza excepciones.
  Las acciones llevan un `meta: { now, revision }` construido por la capa de casos de uso, que
  es la que tendrá inyectados `Clock` e `IdGenerator` — y de hecho la verja de pureza no
  deja otra opción. Así los tests del reducer salen deterministas sin simular nada. Una
  operación que no aplica **no hace nada** en lugar de fallar, y así una acción inocua
  tampoco ensucia `updatedAt` ni `revision`.
- **Integridad referencial:** no se deja una referencia apuntando a algo inexistente.
  Borrar una nota tiene que quitarla de los contextos que la listaban; añadir a un
  contexto una referencia a algo que no existe es un no-op.
- **Cruzar de módulo, siempre por alias** (nunca una ruta relativa que salga del módulo);
  **dentro del módulo, siempre relativo**:
  ```ts
  import { Note } from "#core/index"            // ✅ desde ui/, storage/, platform/
  import { Note } from "../../core/domain/Note" // ❌
  import { Note } from "./domain/Note"          // ✅ dentro del propio core
  ```
  Los alias son lo que hace que migrar a workspaces algún día sea cambiar una entrada de
  package.json en vez de un find-and-replace por todo el repo.
- **Un `index.ts` por módulo** como API pública. Las importaciones entre módulos van por
  ahí, nunca a ficheros internos.
- **`noUncheckedIndexedAccess` está activo.** Indexar `Record<NoteId, Note>` devuelve
  `Note | undefined`, así que hay que tratar el caso "ese id no existe". Es deliberado:
  con estado normalizado por IDs, esa es justo la clase de bug que no quieres en runtime.
- **Nada de credenciales en el repo ni en el bundle.** En web, OAuth con PKCE y token en
  memoria, **nunca** en localStorage. En desktop, keychain del sistema.
- Los comentarios del código están en castellano; mantener ese idioma.

## Decisiones cerradas — no volver a proponer alternativas

- **Carpetas con límites por `tsconfig`, no monorepo con workspaces.** Tauri y Capacitor
  envuelven el output del build web; no consumen paquetes npm, así que los workspaces no
  aportan nada todavía. Se migrará cuando los adaptadores necesiten árboles de
  dependencias distintos (SQLite, plugins nativos).
- **UI vanilla**, no React/Svelte/Solid.
- **Espejo con local como primario**, no sync bidireccional.
- **File System Access API** para el fichero local en web, con OPFS como fallback.
- **Estado normalizado con `ItemRef`**, no entidades anidadas.
- **Dependencias solo cuando la fase las necesita.** No instalar "para tenerlo listo".
- **`node:test` como runner**, no vitest ni jest. Se evaluó vitest y se descartó: eran
  ~64M en disco para algo que Node ya trae.
- **Alias por el campo `imports` de package.json**, no `paths` ni `resolve.alias`.
- Webpack se mantiene como bundler previsto para la Fase 4 (hoy desinstalado). Migrar a
  Vite es una opción abierta y no afecta a la arquitectura.

## Fuera de alcance por ahora

No empezar nada de esto sin pedirlo explícitamente:

- **Adaptador de MongoDB.** Requiere un backend HTTP propio: el driver de Mongo habla
  TCP y no funciona desde navegador, y la Data API de Atlas está retirada.
- **Adaptador de Google Drive.** Escribir siempre exige OAuth (scope `drive.file`),
  aunque la carpeta sea pública.
- `CompositeStorage` y outbox — sin consumidor mientras haya un solo backend.
- `storageTarget` por contexto (enrutado de notas privadas a un backend concreto).
- El editor de grafos de los **Planes**.
- Shells de desktop y móvil (Tauri / Capacitor).
- Sync entre dispositivos, CRDTs, colaboración en tiempo real.

## Plan por fases

- **Fase 0 — Andamiaje. ✅ HECHA.** Alias por campo `imports`, verja de pureza del core,
  tests con `node:test`, y limpieza de los restos del prototipo.
- **Fase 1 — Dominio puro. 🟡 A MEDIAS.**
  - ✅ **Modelo de datos:** entidades, IDs marcados, `ItemRef`, `AppState` normalizado.
  - ⬜ **Operaciones de contenido** (`setChecked`, `setText`, `insert`, `remove`, `move`,
    `indent`, `outdent`), **reducers** y **`Store`**. Se escribieron y se borraron para
    asentar antes el modelo; hay que rehacerlas.
  - Al rehacerlas, dos decisiones que ya se tomaron y conviene no volver a discutir:
    **marcar una casilla NO arrastra a sus hijas** (la cascada es decisión de producto y
    se compone en la UI), y **una operación que no aplica no hace nada** en vez de lanzar.
- **Fase 2 — Puertos y memory.** Los puertos, `MemoryStorageAdapter`, la suite de
  contratos, y el enganche store↔persistencia con write-behind.
- **Fase 3 — Fichero local.** `FileStorageAdapter` sobre `LocalStorageBlobStore`, luego
  `DirectoryHandleBlobStore`. Ojo al detalle de UX: al recargar **no se puede recuperar
  el permiso de la carpeta en silencio** — el handle se guarda en IndexedDB, pero volver
  a pedir permiso exige un gesto del usuario (botón de "reconectar carpeta").
- **Fase 4 — UI.** `render(state)`, reconciliación, y el editor de contenido con
  checkboxes anidados: el corazón de la app y lo que hoy no existe. El CSS actual se
  reutiliza casi tal cual.

## Comandos

```bash
npm run check           # typecheck app + verja del core + tests. Esto antes de commit.

npm test                # compila a tmp-test/ y lanza node --test
npm run typecheck       # tsc de la app (excluye tests)
npm run typecheck:core  # LA VERJA: falla si el core toca plataforma
```

No hay `build` ni `serve`: sus dependencias están desinstaladas hasta la Fase 4 (ver
"Dependencias"). `npm audit` da 0 vulnerabilidades y conviene que siga así.
