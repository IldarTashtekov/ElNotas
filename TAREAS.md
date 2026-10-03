# Tareas de ElNotas

Qué está pendiente, qué está sin decidir y qué ideas hay aparcadas. El diseño y sus por qués
están en `ARCHITECTURE.md`; las reglas para agentes, en `CLAUDE.md`.

**La disciplina que mantiene vivo este fichero: cada entrada tiene que ser cerrable.**
"Mejorar la UI" no se cierra nunca y no entra aquí. "Que `npm test` falle sin ficheros de
test" sí. Si una entrada no se puede marcar como hecha, o está mal escrita o es una idea
aparcada.

---

## Pendiente

### Fase 1 — Dominio puro ✅ TERMINADA

En este orden. El helper va primero y solo: es la única pieza con dificultad real y todo lo
demás se apoya en ella.

- [x] **El helper de copia por camino — primitiva A, "transformar un nodo".** ✅ Hecho, en
      `src/core/domain/updateContent.ts`: `mapPreservingIdentity`, un `updateCheckBoxes`
      recursivo (privado) y un `updateContent` de raíz parametrizado por `onText`/`onCheckBox`.
      **9 pruebas en verde**, y verificadas al revés: rompiendo la invariante a propósito por
      sus dos sitios, caen 6 y 5 respectivamente. **No se exporta por `index.ts`** a propósito:
      es maquinaria interna, y lo que consumirán `ui/` y `storage/` son las operaciones.
- [x] **La primitiva B, "transformar el contenedor de una línea"** — ✅ Hecha, en
      `src/core/domain/updateContainerOf.ts`. **Una sola función**, no dos: el contenedor es la
      lista raíz o **la casilla madre entera** (no su lista de hijas), porque `merge` necesita
      que la madre cambie de texto y pierda una hija a la vez. **12 pruebas.** No va en
      `index.ts`: maquinaria interna, como la A.
- [x] **El tipo `Position`**, el vocabulario del "dónde". ✅ Hecho, en
      `src/core/domain/Position.ts`, y exportado por `index.ts` porque **sí es API pública**:
      la UI construye posiciones para pasárselas a `insert`. Sin pruebas propias a propósito —
      es un tipo con tres constructores de una línea, y lo que de verdad hay que comprobar de
      él (que el `switch` sea exhaustivo) lo comprueba el compilador en `insert`. Decidido:
      **tres casos exactos** —`root-end`, `after`, `last-child-of`— y ninguno más, uno por cada
      cosa que el editor puede querer al pulsar Intro. *(Decía «uno por cada estado de
      `ModosEscritura`», y esa barra se rediseñó el 2026-09-20 sin que sobrara ningún caso: ver
      §9.4.)* Su **único consumidor es `insert`**. `before`,
      `first-child-of` y `root-start` quedan fuera por coste de ramas a testear; el disparador
      para reabrirlo va en el mismo paquete que `move`. Razonado en `ARCHITECTURE.md` §9.4.
- [x] **Las ocho operaciones de contenido** — ✅ **Las ocho hechas.** Eran nueve, subieron a
      once y se quedaron en ocho: fuera `indent`, `outdent` y `move`; dentro las dos
      conversiones. Razonado en `ARCHITECTURE.md` §9.3.
  - [x] `setText`, `setChecked` — ✅ Hechas, en `src/core/domain/operations.ts` y exportadas
        por `index.ts`. **12 pruebas**, con las cinco filas de no-op de §9.3 cubiertas y una
        explícita de que `setChecked` **no arrastra a las hijas**.
  - [x] `insert`, `remove` — ✅ Hechas. **19 pruebas.** `remove` es no-op sobre una casilla con
        hijas (decisión (b)). A `insert` se le añadió una fila de no-op que no estaba en la
        tabla: **id repetido**, porque dos líneas con el mismo id hacen que toda operación
        posterior actúe siempre sobre la primera y jamás sobre la segunda.
  - [x] `convertToCheckBox`, `convertToText` — ✅ Hechas. **12 pruebas.** Las dos usan la
        primitiva **B**, no la A: la A no puede cambiar de variante por diseño (`Text → Text`,
        `CheckBox → CheckBox`), que es justo lo que hacen éstas. Conservan el `ContentId`, así
        que no necesitan `IdGenerator`. `convertToText` es no-op con hijas **y** anidada, y lo
        segundo sale solo de que `onParent` devuelva la madre intacta.
  - [x] `split`, `merge` — ✅ Hechas. **19 pruebas**, incluida una que recorre **todos** los
        puntos de corte de una línea, parte y vuelve a unir, y comprueba que sale el original:
        es la que caza que alguien añada un espacio de cortesía al unir. `split` es la única de
        las ocho que recibe un `ContentId` por parámetro. `merge` sube el texto a la hermana
        anterior, o **a la madre** si es la primera hija.
  - [x] ~~`indent`, `outdent`~~ — **eliminadas.** En el teclado de un móvil no hay Tabulador;
        el nivel se elige al nacer la línea, con el modo activo. Cerró (a) y (g) de golpe.
  - [x] ~~`move`~~ — **eliminada.** Nadie la usa: no hay gesto de arrastrar hasta la Fase 4, y
        no se construye lo que no tiene consumidor. Cerró (f) y (c). Aparcada abajo.
- [x] **Un test explícito por cada caso no-op** de la tabla de `ARCHITECTURE.md` §9.3. ✅
      Hecho sobre la marcha, operación por operación, con `assert.strictEqual`. Y cada guarda
      verificada **rompiéndola a propósito** para comprobar que la prueba salta.
- [x] **`core/ports/Clock.ts` y `core/ports/IdGenerator.ts`** — ✅ Hechos: sólo las interfaces,
      y exportadas por `index.ts` porque quien las implementa vive fuera del core. Sin
      implementaciones, a propósito: vivirían en `src/platform/`, que no nació hasta la Fase 4
      (`473f566`: `SystemClock` y `CryptoIdGenerator`), y una prueba se fabrica su reloj en una
      línea. `IdGenerator` devuelve un `string` pelado
      y quien llama lo marca con el constructor que toque: el generador no sabe qué clase de
      id estás creando. **Sin pruebas propias**: son interfaces, no hay comportamiento que
      comprobar. Lo que sí se verificó a mano es la verja (ver la tarea de abajo).
- [x] **La rebanada vertical** — ✅ Hecha, en `src/core/app/`: `Action`, `reduce`, `Store` y
      `createUseCases`. **16 pruebas.** Demuestra el criterio de cierre: tres despachos
      redundantes seguidos → **un solo aviso**, y `updatedAt` con la hora del primero.
      El `Store` es **una función, no una clase**: el estado vive en una clausura, así que no
      hay camino hasta él —el `private` de TypeScript desaparece al ejecutar—.
      La lista de suscriptores **se reemplaza, nunca se muta en el sitio**, y eso resuelve
      gratis que uno pueda darse de baja durante su propio aviso.
- [x] **Exportar por `src/core/index.ts`** — ✅ Hecho sobre la marcha, pieza a pieza. Fuera
      quedan **a propósito** las dos primitivas del helper y `reduce`: son maquinaria interna,
      y lo que consumen `ui/` y `storage/` son las operaciones, el `Store` y los casos de uso.

**Los seis puntos del criterio de cierre (`ARCHITECTURE.md` §9.5), cumplidos:** el helper
devuelve la entrada intacta en sus dos casos · las ocho operaciones existen · cada una tiene
pruebas de valor y de identidad con `strictEqual` · cada fila de no-op de §9.3 está probada ·
la rebanada demuestra que tres despachos redundantes dan **un solo aviso** y no tocan
`updatedAt` · `npm run check` en verde con **99 pruebas**, e incapaz de pasar en falso.

### Fase 2 — Acciones, persistencia y memory ✅ TERMINADA

**En este orden, y el orden es la decisión.** Se ataca **de abajo arriba**: la persistencia
entera primero, verificada con la única acción que ya existe, y sólo después las dieciséis que
faltan. El write-behind es la única pieza con riesgo real de la fase, y se quiere descubrir que
escribe de más cuando hay **un solo candidato**, no diecisiete. Es el mismo razonamiento que la
rebanada vertical de la Fase 1. Criterio de cierre en `ARCHITECTURE.md` §9.8.

- [x] **Los tres puertos de persistencia** — ✅ Hechos, en `src/core/ports/Repository.ts`,
      `StorageAdapter.ts` y `BlobStore.ts`, y exportados por `index.ts` porque quien los
      implementa vive fuera del core. **Sólo interfaces**, como `Clock` e `IdGenerator`, y
      **sin pruebas propias**: no hay comportamiento que comprobar. Todo `async` aunque el
      adaptador de memoria vaya a ser síncrono — si expone firmas sincrónicas, enchufar un
      fichero después obliga a reescribir a todos los llamantes, no sólo al adaptador.
      **Dos desvíos del boceto de §6.1**, los dos al escribirlos: el id de `Repository` va
      **marcado** (`Repository<Note, NoteId>`), verificado rompiéndolo —pasar un `ContextId` a
      `notes.get` da `TS2345`—; y son **propiedades de función, no métodos**, porque TypeScript
      comprueba los métodos de forma bivariante incluso con `strict`. `BlobStore` se adelanta
      sin consumidor hasta la Fase 3, con el mismo trato que tuvieron `Clock` e `IdGenerator`.
- [x] **`MemoryStorageAdapter` y la suite de contratos** — ✅ Hechos. Nace `src/storage/` con
      su `index.ts`, y con él el alias `#storage/*`. **17 pruebas**, y ninguna escrita para el
      adaptador en concreto: las diecisiete son del contrato, y el fichero
      `MemoryStorageAdapter.test.ts` cabe en una línea. El de la Fase 3 tendrá otro igual.
      Tres cosas que salieron al escribirlo:
  - **El contrato usa `deepEqual`, y es lo correcto** — el único sitio del proyecto donde lo
    es. Un almacén no promete devolver el mismo objeto: el de memoria lo hace porque no
    serializa, el de fichero devolverá uno recién salido de un `JSON.parse`. Exigir
    `strictEqual` sería exigir algo que sólo el de memoria puede cumplir, o sea lo contrario
    de para lo que existe un contrato. Escrito en el fichero para que nadie lo "arregle".
  - **La suite se llamó `storageContract.test.ts` aunque no tenga ni una prueba**, porque
    importa `node:test` y `tsconfig.json` va sin los tipos de Node. Se prefirió el nombre a
    añadir una exclusión a mano en la config de la app. **Ya no: hoy es
    `test/storage/contract-tests/storageContract.ts`**, sin sufijo, porque la carpeta hace ese
    trabajo desde la mudanza de las pruebas (`ARCHITECTURE.md` §8.5).
  - **Tres pruebas de contrato no son de `Repository` sino de que los tres estén aislados**, y
    de que una entidad con contenido sobreviva entera. Sin ellas, un adaptador que guardara las
    tres clases en el mismo saco, o que se dejara `items` por el camino, pasaría todo lo demás.
  - **Verificado rompiéndolo por tres sitios**, y en los tres cayó lo que tenía que caer:
    quitar el `async` de `transaction` tumba **1** (la del fallo síncrono, y sólo ésa); un
    `Map` compartido por los tres repositorios tumba **4**; devolver `undefined` en vez de
    `null` en `get` tumba **2**. Todo revertido.
- [x] **El write-behind, que son DOS piezas y no una** — ✅ Hecho. `diffState.ts` en
      `core/app/` (puro, **11 pruebas**) y `writeBehind.ts` en `src/storage/` (**11 pruebas**),
      los dos exportados por sus `index.ts`. La programación va **por parámetro**, así que las
      pruebas usan un reloj de mentira y no esperan ni un milisegundo. Sin puerto `Scheduler`:
      partido así, el core no necesita temporizar nada. Cuatro cosas que salieron al hacerlo:
  - **El diff se calcula contra "lo último escrito", no contra el aviso anterior.** El
    `Listener` del `Store` sólo trae el estado nuevo, así que el escritor recuerda el último
    que llegó a disco. Sale gratis un caso que si no habría que tratar a mano: **una nota
    creada y borrada dentro de la misma ráfaga no llega nunca a disco**.
  - **El orden importa: primero todos los `put`, después los `delete`.** Si el proceso muere a
    mitad, así el peor caso es un contexto ya limpio y una nota que sobra —basura inofensiva—;
    al revés sería una `ItemRef` colgando, que es lo que prohíbe la integridad referencial.
  - **Las pruebas cuentan transacciones además de escrituras**, y no es un adorno: sin ese
    contador, quitar del escritor el corte de "si no cambió nada no toques el disco" **no
    rompía ninguna prueba**, porque un diff vacío no genera ningún `put` de todas formas.
  - **Verificado rompiéndolo por tres sitios:** quitar el corte del eslabón ② tumba **2**;
    no cancelar la espera anterior tumba **1**; comparar por valor en vez de por referencia
    tumba **1**… y esa última sólo por accidente, así que se añadió una prueba explícita de
    que **una copia equivalente SÍ cuenta como cambio**, que es la semántica elegida y lo que
    impide que alguien "mejore" el diff comparando por valor. Todo revertido.
- [x] **La prueba que cierra la cadena entera** — ✅ Hecha, en `test/storage/chain.test.ts`.
      **8 pruebas**, y con ellas el **punto 3 del criterio de cierre**: un `set-checked`
      redundante no avisa, no ensucia `updatedAt` y **no llega a disco**. Es la primera vez que
      `core` y `storage` se montan juntos —`Store` → `createWriteBehind` →
      `MemoryStorageAdapter`—, con `Clock` e `IdGenerator` fabricados en dos líneas.
      **Verificado rompiéndolo por dos sitios:** quitar del reducer la línea
      `content === note.content` tumba **9** pruebas (cinco de la Fase 1 y cuatro de éstas), y
      **no suscribir el escritor al `Store`** tumba **3** — que era justo lo que había que
      comprobar, porque las dos mitades siguen verdes por separado si no están enchufadas.
- [x] **Las siete acciones de contenido** — ✅ Hechas, con sus casos de uso y **18 pruebas**
      en `contentActions.test.ts`. `Action` ya es una unión de ocho y el `switch` vuelve a ser
      exhaustivo por el compilador (ahora con `const nunca: never`, que con un solo miembro no
      servía). Tres cosas que salieron al escribirlas:
  - **La comparación se escribe UNA sola vez, en un helper `onContent`.** Era el riesgo
    anunciado —«que ninguna de las siete se salte el `===`»— y copiar catorce líneas ocho
    veces son ocho oportunidades de olvidarlo. Mismo razonamiento que la primitiva A con su
    recursión escrita una vez (§5.4).
  - **`insert` tiene DOS casos de uso y una sola acción** (`insertText` / `insertCheckBox`):
    el bloque llega ya construido con su id, y quien genera ids es esta capa, no la UI.
    `split` es la única que además pide un id para la mitad nueva.
  - **Verificado rompiéndolo por dos sitios:** quitar la comparación del helper tumba **17**
    pruebas; un copy-paste realista —que `convert-to-text` llame a `convertToCheckBox`, que es
    el error natural al escribir ocho casos casi iguales— tumba **1**, la suya.
- [x] **Las acciones de Nota y de Contexto** — ✅ Las nueve hechas, con sus casos de uso y
      **27 pruebas** en `entityActions.test.ts`. **El catálogo son ya las diecisiete.**
      `createNote` y `createContext` son los **únicos casos de uso que devuelven algo** —el id
      recién generado—, porque quien crea una nota necesita abrirla justo después y si no
      tendría que adivinar cuál es la nueva buscando en el estado.
      **La enjundia estaba donde se esperaba, `delete-note`:** toca dos entidades a la vez,
      da a todos los contextos afectados **el mismo `meta`** y devuelve **intactos por
      referencia** los que no la listaban. Si ninguno la listaba, devuelve el mismo mapa
      `contexts` de entrada.
      **Verificado rompiéndolo por tres sitios:** no limpiar los contextos —dejar la `ItemRef`
      colgando— tumba **2**; copiar todos los contextos en vez de sólo los afectados tumba
      **2**; y quitar de `remove-item` la comparación de longitud tumba **1**, que es la
      trampa del `filter` devolviendo siempre array nuevo.
- [x] **`schemaVersion`, el runner de migraciones y `hydrate`** — ✅ Hechos, en
      `src/core/migrations/`, con **12 pruebas**. `schemaVersion` **no se añadió a `AppState`**
      y se corrigió su comentario, que decía que faltaba. Tres cosas que salieron al hacerlo:
  - **`EMPTY_STORE_VERSION` (0) no es "esquema viejo", es "nunca se ha escrito nada"**, y
    confundirlos rompía el primer arranque: el runner buscaría una migración del 0 al 1 que no
    existe ni va a existir. Se descubrió escribiendo la primera prueba.
  - **`MIGRATIONS` está vacía a propósito.** No hay nada guardado con un esquema viejo, así
    que inventar una de ejemplo sería inventarse un pasado. Lo que sí hace falta es el runner,
    para que el día que llegue la primera sólo haya que añadir una fila.
  - **`migrations` y `target` se inyectan**, como el `schedule` del write-behind. Con `CURRENT`
    valiendo 1 no existe hoy ninguna versión intermedia, así que dos caminos del runner
    —encadenar y avisar de que falta una— no serían alcanzables desde fuera y quedarían sin
    probar hasta el día que hicieran falta, que es el peor día para descubrir que están mal.
  - **`hydrate` limpia las `ItemRef` rotas al entrar**, porque el reducer mantiene la
    integridad referencial en cada acción pero eso no vale de nada si la app arranca ya con
    referencias colgando. **Verificado rompiéndolo:** copiar los contextos siempre —en vez de
    devolver intactos los que no tenían nada que limpiar— tumba **1**, la que impide que la
    app se reescriba entera en cada arranque.

**Lo que NO entra en esta fase, dicho para que nadie lo dé por hecho:** ninguna acción de Plan
—se persisten, no se operan—; ninguna acción compuesta —cascada de `setChecked`, borrar una
rama—; ningún fichero de verdad; y nada de UI.

- [x] **Las pruebas de la capa de casos de uso** — ✅ Hechas, **13 pruebas** en
      `useCases.test.ts`. No estaban en el plan y salieron de una revisión al dar la fase por
      cerrada: de los dieciocho casos de uso, **sólo `setChecked` estaba ejercitado**. El
      reducer de debajo sí estaba probado a fondo, pero hay tres cosas que sólo ocurren en esa
      capa y que ninguna prueba del reducer puede ver: el **cableado** (dieciocho bloques casi
      idénticos son donde se cuela un copy-paste), **los ids que se generan ahí** —`createNote`
      y `createContext` devuelven el suyo; `insert` y `split` piden **dos** al generador, uno
      para la línea y otro para la revisión— y que **el reloj se lea una sola vez por acción**,
      que es lo que hace que `delete-note` ponga la misma marca a todo lo que toca.
      **Y encontraron un error real: el catálogo son DIECISIETE acciones, no dieciséis.** El
      fallo venía del planteamiento —se sumaron las siete de contenido que faltaban en vez de
      las ocho que hay— y se había propagado al código y a los tres documentos sin que nada lo
      comprobara, porque ningún sitio las contaba. Ahora hay un ancla que sí lo hace.
      **Verificado rompiéndolo por dos sitios:** que `renameNote` despache `delete-note` tumba
      **1** —y **compila sin queja**, porque una función con menos parámetros es asignable, así
      que el compilador no la ve—; y que `createNote` devuelva un id distinto del que despachó,
      otra **1**.

**Los seis puntos del criterio de cierre (`ARCHITECTURE.md` §9.8), cumplidos:** los tres
puertos existen como interfaces y todos `async` · `MemoryStorageAdapter` pasa la suite de
contratos entera, escrita contra la interfaz · un `set-checked` redundante **no llega a
disco**, demostrado de punta a punta desde un `dispatch` · las diecisiete acciones existen con
su caso de reducer y el `switch` vuelve a ser exhaustivo por el compilador · `delete-note` deja
los contextos consistentes y devuelve intactos los que no la listaban, con `strictEqual` ·
`npm run check` en verde con **216 pruebas al cerrarla**.

### Fase 3 — Fichero local ✅ TERMINADA

**Los siete puntos de `ARCHITECTURE.md` §9.9, cumplidos, con 314 pruebas.** El último en caer
fue el 5 —la lista de verificación manual—, el **2026-09-13**: era lo que separaba «el código
está entero» de «la fase está terminada», y no lo podía cerrar un agente. Su casilla, con el
resultado de las dos pasadas, está más abajo.

**Lo que quedó vivo de esta fase y fue a la Fase 4**: el `onError` del write-behind, el
`onCorrupt` de `getAll` —entonces **una nota corrupta impedía abrir la app**— y la validación de
esquema al leer del disco. **Los tres están hechos desde la Fase 4**; sus casillas, aquí abajo.

**El paso 0 iba antes que el adaptador, y el orden era la decisión.** Convertir los puertos a
`Result` después de escribir el adaptador de fichero habría sido escribirlo dos veces: es **lo
primero que falla de verdad** —tiene permisos que revocar y disco que llenar, cosas que el de
memoria no tiene—. Y la suite de contratos cambia con los puertos: había **un** adaptador que la
pasaba, después de esta fase habría dos. Razonado en `ARCHITECTURE.md` §6.5.

**Criterio de cierre en `ARCHITECTURE.md` §9.9**, y escrito **antes** de que el adaptador
exista, a diferencia de los de las fases 1 y 2: un criterio decidido con el trabajo delante se
decide siempre a favor de lo que se hizo. Resumido, son siete: el paso 0 hecho ·
`FileStorageAdapter` pasa la suite de contratos **sin tocarla** · su traducción de errores
—`corrupt` al parsear, y no reclasificar lo que sube del `BlobStore`— probada aparte, porque el
contrato no puede cubrirla · existen **las dos** implementaciones de `BlobStore`, no sólo la de
desarrollo · la lista de verificación manual **escrita y ejecutada una vez, con su resultado
anotado** · ni un `throw` por encima de la frontera de cada adaptador · `npm run check` en verde
con su recuento. **Van cinco cumplidos —1, 2, 3, 4 y 6—**; el 7 está verde con **314 pruebas** y
sólo espera a anotar la cifra de cierre; **el 5 es el que falta**. Y lo que **no** entra: la UI,
el arranque real de la app, el `onError` y el `onCorrupt` con el botón de reconectar, la
validación de esquema, y la escritura condicional.

- [x] **Paso 0 — `Result<T, E>`: que los errores se devuelvan en vez de lanzarse.** ✅ Hecho,
      y con él **`npm run check` en verde con 232 pruebas** (eran 216 al cerrar la Fase 2). En
      el código de producción de `core/` y `storage/` **no queda ni un `throw`**.
      `Result` son 43 líneas en `src/core/domain/Result.ts`, sin `map`, `andThen` ni `unwrapOr`
      —no tienen consumidor—, y con un detalle que decidió más de lo que parece: **`ok` devuelve
      `Result<T, never>` y `err` devuelve `Result<never, E>`**, cada uno dejando en `never` la
      mitad que no construye. Es lo que hace que `ok(null)` encaje en un
      `Result<Note | null, StorageError>` sin anotar nada.
  - [x] **Los errores, a `src/core/domain/errors/`** — no estaba en esta lista y salió al
        escribirlos: `StorageError` y `MigrationError` viven **juntos y al mismo nivel que el
        resto de entidades**, no cada uno en el módulo que lo emite, porque **un error es una
        entidad del dominio más**. La carpeta **no lleva `index.ts`** (`domain/` tampoco: la API
        pública del módulo es `src/core/index.ts`), y **`Result.ts` se queda fuera de `errors/`**
        — es el sobre, no lo que va dentro. → `ARCHITECTURE.md` §6.5.
  - [x] **Los siete métodos de puerto.** ✅ Los cuatro de `Repository<T, TId>` y los tres de
        `StorageAdapter`. `transaction` fue la única con decisión que tomar y quedó
        `<T>(fn: () => Promise<Result<T, StorageError>>) => Promise<Result<T, StorageError>>`:
        el `Result` va **dentro y fuera**, porque el cuerpo real hace `put` tras `put` y cada
        uno ya devuelve uno — con una `T` pelada saldría `Result<Result<T, …>, …>`, dos sobres
        para un solo fallo.
  - [x] **`BlobStore`, también** — tampoco estaba en la lista. Sus cuatro métodos devuelven
        `Result`, y el motivo es el reparto de §6.1: **cada implementación traduce los errores de
        SU plataforma** —`localStorage` sabe cuál es su excepción de cuota, la File System Access
        API cuál es la suya de permisos— mientras que `FileStorageAdapter` traduce sólo lo suyo,
        la serialización (`JSON.parse` que falla → `corrupt`). Con la traducción de plataforma
        arriba, el adaptador tendría que conocer las excepciones de los cuatro backends.
  - [x] **Los dos `throw` de `runMigrations`** — ✅ Fuera los dos. La firma es ya
        `Result<MigrationResult, MigrationError>`, así que `runMigrations` pasa de ser sólo
        **pura** a **pura y total**: son dos propiedades distintas, y la totalidad hasta ahora
        sólo la prometía el reducer.
  - [x] **`MemoryStorageAdapter`** — ✅ Hecho, y fue casi todo mecánico como se esperaba. Lo
        único que no: `transaction` tiene **la única frontera con `try/catch` del fichero**,
        porque es lo único que ejecuta código ajeno.
  - [x] **`writeBehind`** — ✅ Hecho, y aquí estaba el trabajo de verdad. `flush()` pasa de
        `Promise<void>` a `Promise<Result<void, StorageError>>`, y con ella cambia el tipo
        público `WriteBehind` que sale por `src/storage/index.ts`. Tres cosas que salieron al
        hacerlo:
    - **Un estado nuevo, *detenido*, que no estaba previsto en ninguna parte.** Ante un fallo
      que no sea `io`, el escritor retiene el error, **cancela la espera programada** y a partir
      de ahí cada `flush()` devuelve el mismo error **sin tocar el almacén**. Lo pendiente se
      conserva en memoria: no se pierde nada, sólo se deja de insistir. Un aviso nuevo del
      `Store` se recuerda pero ya no programa escritura. → `ARCHITECTURE.md` §6.5.
    - **El `catch` de la cola de escrituras desapareció**, y no por descuido: un fallo es ahora
      un valor, así que no puede envenenar las escrituras futuras. Si algo rechaza ahí es un
      adaptador incumpliendo su puerto, y debe hacer ruido.
    - **Precio aceptado, el que ya estaba escrito:** el bucle de seis `await` de
      `escribirPendiente` pasa de un `try` que cubría los seis a comprobar uno a uno con corte
      al primer fallo. Más ruidoso y sin arreglo elegante.
  - [x] **La suite de contratos** (hoy `test/storage/contract-tests/`) — ✅ Convertida, y **dos de
        sus casos quedaron invertidos**: los que exigían que una excepción lanzada dentro de
        `transaction` se *propagara* ahora exigen que se **traduzca a `io`**. Van los dos
        —asíncrono y síncrono—, y el síncrono no es un duplicado: un `transaction` sin `async`
        rompería antes de que hubiera promesa, así que ningún `catch` lo alcanzaría.
  - [x] **Verificado rompiéndolo, que es como se hace aquí.** Lo que más importa:
        **invertir dos casos de `esReintentable`** —que `io` se detenga y `permission-denied` se
        reintente— tumba **exactamente 2** pruebas, la de `io` y la de `permission-denied`, y
        las otras tres siguen verdes, que es lo correcto porque no cambiaron de lado. Volver al
        comportamiento viejo —reintentar siempre a ciegas— tumba **5**. Por eso los cuatro casos
        no reintentables se prueban **uno a uno** y no con un representante: con un solo ejemplo,
        mover un `kind` de lado no tumbaría nada.
  - [x] **Un guardián en `tools/`** — ✅ Hecho, `tools/check-fronteras.mjs`, enchufado como
        `npm run check:fronteras`. **Pero NO es el que decía esta casilla, y el cambio de idea es
        lo que hay que leer:** aquí ponía «que falle si aparece un `throw` fuera de la frontera».
        **Ese guardián habría dado verde con dos fugas reales dentro**, porque el peligro no es
        lo que lanzamos nosotros —hay **cero `throw`** en el repo y sigue habiéndolos— sino **lo
        que llamamos sin envolver**. Las dos fugas, encontradas leyendo el código y probadas con
        una sonda:
    - **`encodeURIComponent` dentro de `caminoDe`** (`FileStorageAdapter`), que lanza `URIError`
      con un surrogate suelto. `get`, `put` y `delete` lo llamaban **fuera de toda frontera**, o
      sea lanzando por una firma que promete `Result`. Estaba tapado **por accidente**: el único
      consumidor de producción es el write-behind, que llama desde dentro de `transaction`. En
      cuanto `platform/` (Fase 4) llamara al repositorio directamente, se acababa el accidente.
      Arreglado: `caminoDe` devuelve `Result` y el compilador obliga a tratarlo en los tres
      sitios. **3 pruebas**, y se cae rompiéndolo.
    - **`paso.migrate()` en `runMigrations`**, que es código ajeno y estaba sin `try`, desde la
      función que su propio comentario llamaba «pura y **total**: nunca lanza, pase lo que
      pase». No era alcanzable sólo porque `MIGRATIONS` está vacía; la primera migración de
      verdad es este caso, al arrancar y sobre las notas del usuario. Arreglado con la frontera
      y un **tercer caso de `MigrationError`**, `migration-failed`, con `from` y `cause`.
      **2 pruebas.**

        **Cómo funciona el guardián, que es lo que lo hace utilizable:** entiende la cobertura
        **transitiva**. Seis ayudantes locales —`aBase64`, `deBase64`, `navegar`, `caminosBajo`,
        `entradasDe` y los del blob— llaman a cosas que lanzan **sin ningún `try` propio**: los
        protege quien los llama. Sin esa regla el guardián marcaría los seis y sería ruido. Y es
        exactamente esa forma de estar a salvo —depender del sitio de llamada— la que falló en
        `caminoDe`, que era idéntico a los otros seis.
        **Verificado en los tres sentidos:** pasa limpio; devolviéndole los dos agujeros reales
        señala **esos dos y ninguno más, en su línea exacta**; y caza una regresión nueva (un
        `JSON.parse` suelto en un método público). Recorre el AST, así que **no necesita** el
        escáner que borra comentarios y cadenas que sí necesitó `check-core-purity.mjs`.
        Entonces eran **ocho `try` y cero `throw`**; el 2026-09-29, con la Fase 4, son **trece**
        y siguen cero `throw` (`ARCHITECTURE.md` §6).

      **Lo que NO se tocó, y así sigue:** que `get` de algo que no está guardado devuelva
      `ok(null)`, y que borrar lo que no existe no sea un error. **Ausencia no es fallo**, y
      ahora son además dos casos del contrato.

- [x] **Un `onError` para el write-behind, aplazado a la Fase 4.** ✅ **Hecho en la Fase 4,
      `f406d96`.** El agujero era que cuando fallaba un flush **automático** —el del
      temporizador— **nadie miraba su resultado**. Hoy `onError` es una opción de
      `WriteBehindDeps` que se llama **una vez**, cuando un fallo no reintentable detiene al
      escritor; un `io` se sigue reintentando sin avisar; el aviso va en frontera. La UI lo
      enseña arriba en cualquier vista y **sólo informa**. Lo que **no** llegó, y sigue fuera de
      la Fase 4: el botón de «reconectar carpeta» —**un escritor detenido no se reanuda**, y un
      `permission-denied` lo deja muerto para el resto de la sesión—. → `ARCHITECTURE.md` §6.5

- [x] **`FileStorageAdapter` sobre `BlobStore`** — ✅ Hecho, en `src/storage/file/`, y con él
      **`npm run check` en verde con 274 pruebas** (eran 232 al cerrar el paso 0): **17 del
      contrato reusado** —que en ese momento pasó a correr dos veces; hoy corre **tres**, ver más
      abajo— y **24 propias**. La
      suite de contratos **no se tocó**, que era el punto 2 del criterio de cierre y se ve en el
      diff. Con él quedan cumplidos los puntos 1, 2 y 3 de `ARCHITECTURE.md` §9.9.
      Cinco cosas que salieron al escribirlo:
  - **El formato en disco, que §6.2 no describía.** Ahora sí: `manifest.json` con la versión de
    esquema, `notes/`, `plans/` y `contexts/` con un fichero por entidad, JSON indentado a dos
    espacios, el id por `encodeURIComponent` al formar el camino y un `getAll` que ignora los
    ficheros ajenos que aparezcan en la carpeta. → `ARCHITECTURE.md` §6.2.
  - **El `manifest.json` lleva SÓLO `{ schemaVersion }`, y no un índice de ids.** Cierra un
    hueco de *Sin decidir*. El motivo corto: un índice son **dos fuentes de verdad**, un `put`
    pasaría a ser dos escrituras no atómicas, y morir en medio puede dejar **una nota guardada
    que el índice no menciona y que por tanto no se abriría nunca**. Precio aceptado: `getAll`
    son N lecturas, que se pagan al arrancar. → `ARCHITECTURE.md` §6.2.
  - **`transaction` tiene por fin escrito qué garantiza:** que no reordena ni agrupa —de lo que
    depende el orden `put`-antes-que-`delete` del write-behind—, que el `err` de dentro sale
    intacto y que una excepción se traduce a `io`. Y qué no: atomicidad, aislamiento y lecturas
    consistentes. → `ARCHITECTURE.md` §6.2.
  - **Tiene pruebas propias, y el de memoria sigue sin tenerlas.** No es una excepción a la
    regla: el contrato está escrito contra la interfaz y **no sabe que existe un `BlobStore`**,
    así que no puede hacer fallar a la plataforma ni mirar el nombre del fichero. La regla
    afinada está en `ARCHITECTURE.md` §6.3.
  - **⚠️ Un fichero corrupto tumbaba el `getAll` entero**, lo que **contradecía a §6.5**. Se
    aceptó y se aplazó el arreglo a la Fase 4 — la casilla del `onCorrupt`, justo aquí abajo.

- [x] **Un `onCorrupt` para `FileStorageAdapter`, aplazado a la Fase 4.** ✅ **Hecho con la
      primera rebanada de la Fase 4, `473f566`.** El agujero era que `getAll` cortaba al primer
      fichero ilegible, así que **una sola nota corrupta impedía abrir la app**. Hoy es una opción
      `{ onCorrupt }` del adaptador: `getAll` se salta **sólo** los `corrupt` y avisa de cuál;
      cualquier otro fallo sigue cortando; **sin `onCorrupt` sigue siendo todo o nada**; y un
      aviso que lanza sale como `io`. La UI enseña qué fichero. Lo que se descartó entonces sigue
      descartado: saltarse la entidad **en silencio**, y cambiar la firma de `getAll`.
      ✅ **El riesgo residual —la referencia que un contexto podía perder— se cerró el
      2026-10-03** con la opción A. → `ARCHITECTURE.md` §6.5.

- [x] **Validar el esquema de lo que se lee del disco.** ✅ **Hecho al final de Fase 4 · Notas,
      `8e2dba3`**, en `src/storage/file/schema.ts` —**no en el core**: la forma en disco es del
      adaptador—, **a mano y sin dependencias**, que era lo que había que decidir. Nota, plan y
      contexto campo a campo; en una nota, además, ningún texto dentro de una casilla y ningún id
      de línea repetido en ningún nivel; los campos de más se ignoran. Lo que no tiene forma es
      `corrupt` con el motivo y va por el mismo camino que `onCorrupt`. → `ARCHITECTURE.md` §6.2.

- [x] **`LocalStorageBlobStore`** — ✅ Hecho, en `src/storage/blobs/`, **108 líneas de código y
      22 pruebas propias**. Es el de desarrollo y el de emergencia, y tiene pruebas porque tiene
      tres cosas que inventa por encima del puerto: el espacio de nombres (`localStorage` es un
      sitio compartido con cualquier otro script del origen), el base64 —`localStorage` sólo
      guarda texto, y se elige base64 y no una cadena latin1 aunque ocupe un 33% más, para no
      dejar en el almacén texto que parece texto y no lo es— y la traducción de excepciones.
      Dos cosas que salieron al escribirlo:
  - **La cuota se detecta por tres nombres y dos códigos**, no por uno: `QuotaExceededError`
    (estándar y Chromium), `NS_ERROR_DOM_QUOTA_REACHED` (Firefox) y `QUOTA_EXCEEDED_ERR`
    (Safari viejo), más `code` 22 y 1014 para los navegadores que dejan el `name` vacío. Fallar
    ahí convierte «no cabe» en «reintenta», que es justo lo que detiene el write-behind o no.
    Se prueba **caso por caso**, no con un representante, por lo mismo que los cuatro `kind` no
    reintentables: con un solo ejemplo, mover una excepción de lado no tumbaría nada.
  - **Un base64 ilegible sale como `corrupt`, y eso precisó una frontera que no estaba escrita**:
    el **sobre** es del `BlobStore` —lo escribió él— y el **contenido** es de
    `FileStorageAdapter`. No cambia el reparto de §6.1, sólo dice dónde cae la línea. →
    `ARCHITECTURE.md` §6.1.

- [x] **`DirectoryHandleBlobStore`** — ✅ Hecho, **156 líneas de código y ninguna prueba, que es
      la decisión de §6.3 y no un descuido**. Sirve a la vez para la carpeta real y para OPFS:
      es el mismo código y sólo cambia quién le pasa el handle. Tres cosas que dejar escritas:
  - **La cifra vieja de «~50 líneas» era falsa**, y era el argumento para no instalar un runner
    de navegador. **La decisión no cambia** y el porqué está en `ARCHITECTURE.md` §6.3: lo que
    creció es el clasificador de excepciones —que es precisamente lo que un doble no puede
    probar—, el `list` recursivo y unas declaraciones de tipo. Lógica interesante sigue sin
    haber.
  - **La File System Access API lanza el mismo `NotFoundError` para «falta el fichero» y para
    «falta la carpeta»**. `read` y `delete` lo traducen a ausencia y `list` a lista vacía,
    porque en una carpeta recién elegida no existe `notes/` y el `getAll` del arranque tiene que
    devolver cero. **Precio asumido:** si desaparece la raíz entera se lee «vacío» en vez de «no
    la encuentro»; el primer `write` sí dice `not-found`. → `ARCHITECTURE.md` §6.5.
  - **Sin `abort()` de limpieza, a propósito:** `createWritable()` escribe en un temporal y el
    `close()` es quien lo vuelca, así que si algo revienta antes el fichero original queda
    intacto. Ahorra un segundo `try` en el único fichero sin pruebas.

- [x] **La tercera pasada de la suite de contratos** — ✅ Hecha, y **no estaba prevista**:
      `LocalStorageBlobStore.contract.test.ts` monta `FileStorageAdapter` sobre el `BlobStore`
      **de producción**, no sobre el falso. Se ganó el sitio sola, y está medido rompiendo el
      código: devolver las claves de `list` con el espacio de nombres delante tumba **7** pruebas,
      **5 de ellas de esta pasada**; que `read` de una clave ausente devuelva `not-found` en vez
      de `ok(null)` tumba **6**, **3 de ellas suyas**. Ni las pruebas del blob ni el contrato con
      el falso las cazaban por separado. Con ella el contrato corre **tres** veces, no dos como
      anticipaba el punto 7 de §9.9. → `ARCHITECTURE.md` §6.3.

- [x] **Pasar la lista de verificación manual y anotar el resultado** — ✅ Hecho el
      **2026-09-13**, y con él **cae el punto 5 de `ARCHITECTURE.md` §9.9, que era el último: la
      Fase 3 queda TERMINADA**. Dos pasadas anotadas en la hoja de resultados de
      `test/storage/blobs/VERIFICACION-MANUAL.md`:
  - **Brave 1.95.101** (Chromium 153.0.8010.37, Ubuntu 22.04.5): pasan **las cinco** secciones,
    incluida la E de OPFS que §9.9 no exige. ⚠️ Hubo que arrancarlo con
    `--enable-features=FileSystemAccessAPI`: **Brave no trae la API de fábrica**, y eso es parte
    del procedimiento para repetirla.
  - **Firefox 153.0.4**: A, B, C y D **«no se ha podido probar»** —no tiene
    `showDirectoryPicker()`—, sólo OPFS. **Eso también cierra el punto**, por la regla de oro de
    la lista: se cierra con el resultado que haya, no con el bueno.

      **Lo que cazó, que es lo que justifica que esta lista exista:** el fichero salió con **45
      bytes y no 0** —el `close()` de §6.3—, y el `permission-denied` del paso C **no era
      cosmético**: el `mtime` no se movió tras el `write` denegado.
      **Y corrigió el método, que es lo que más valor tiene de cara a la próxima:** el paso B
      hecho sin recargar reutiliza el handle en memoria y da verde sin probar nada — **«B sin F5
      no es B»**. El oráculo tampoco fue el explorador de ficheros sino `find` y `stat`, que fue
      lo que cazó una raíz equivocada que devolvía `ok` a todo.
      ⚠️ **El asterisco, que se conserva:** las dos pasadas son sobre `dec4306` **con el árbol
      sucio**, así que lo verificado no es literalmente ese commit.

- [ ] **Quitar la interfaz `CarpetaRecorrible` de `DirectoryHandleBlobStore.ts`, que hoy sobra**
      *(de `back-dev-agent` o `infra-agent`: es código, no documentación)*. Se declaró a mano
      `values()` con este motivo escrito en el fichero: que el recorrido de entradas «vive en
      `lib.dom.asynciterable.d.ts`, una `lib` aparte que este proyecto no activa».
      **Medido, y ya no es cierto con el TypeScript que hay instalado (6.0.3):** ese fichero es
      hoy un stub de compatibilidad de 18 líneas —«This file's contents are now included in the
      main types file»— y `FileSystemDirectoryHandle.values()` está declarado dentro de
      `lib.dom.d.ts`, que la app ya carga (`lib: ["ES2020", "DOM", "DOM.Iterable"]`).
      **Recomprobado el 2026-09-19 mirando los ficheros de `node_modules/typescript/lib`, no
      con una sonda:** `lib.dom.asynciterable.d.ts` son **18 líneas** —licencia y una nota de
      compatibilidad, ya no declara nada— y `values()` está en **`lib.dom.d.ts:45115`**, dentro
      de una segunda declaración de `FileSystemDirectoryHandle` que se fusiona con la primera.
      **Qué hay que hacer:** borrar la interfaz, el `entradasDe` que castea, cambiar la llamada
      a `carpeta.values()` y borrar el párrafo del comentario que dice algo falso — el propio
      fichero ya avisa de que «si algún día se activa esa lib, esto se borra y no cambia nada».

      **⚠️ CUÁNDO: agrupado con la Fase 4, NO suelto. El reparto de coste es el que manda:**
      el cambio son ~15 minutos; **repasar la lista de verificación manual que obliga es una
      tarde** con Chromium y las manos del usuario. Y obliga, sin escapatoria:
  - **`entradasDe` no es un tipo, es un `const` con una función dentro**, o sea que existe en
    tiempo de ejecución. Al quitarlo desaparece una función del módulo y cambia el sitio de la
    llamada: **el JavaScript emitido cambia**, así que la excepción registrada en la casilla del
    tipado —«emitido idéntico ⇒ no se repite la lista»— **no le aplica**.
  - **Ni siquiera tocar sólo el comentario se escapa:** `removeComments` no está puesto en
    ningún `tsconfig`, comprobado, así que los comentarios **viajan al emitido** y un cambio
    sólo en el comentario también movería bytes. Dentro de un comentario, pero los movería.

      **Qué lo desbloquea:** cualquier trabajo que abra ese fichero de todas formas, porque ese
      día la lista se repasa igualmente y este refactor viaja gratis. *(Aquí decía que el
      `onError` y el `onCorrupt` pasarían por este fichero, y **no pasaron**: los dos se hicieron
      en la Fase 4 sin tocarlo, y tampoco lo tocó el `.js` de los imports, porque sólo importa
      por alias. Así que sigue pendiente, y lo único previsto que lo abriría es el botón de
      «reconectar carpeta», que está fuera de la Fase 4.)*
      **Mientras tanto, y cuesta cero:** el daño de hoy no es el código muerto sino que el
      comentario **miente** y alguien se lo va a creer. Eso se tapa sin tocar el fichero, con
      una línea en la decisión cerrada de `CLAUDE.md` sobre declarar tipos de plataforma a mano
      —que es donde mira quien se plantee declarar otro— diciendo que el que hay ya es un caso
      de eso y está aquí anotado.

### Fase 4 — UI ✅ CERRADA el 2026-10-03, por decisión del usuario y CON DEUDA

**Cerrada sin cumplir su criterio entero** (`ARCHITECTURE.md` §9.10): quedan **las dos listas
manuales sin pasar** y **las tres preguntas sin contestar**, abajo, como pendientes. No se
marcan como hechas. **532 pruebas** al cerrarla. Lo siguiente es planificar la Fase 5.

**Estado el 2026-09-29:** todo el código de las dos partes está hecho y commiteado en la rama
`rediseno-arquitectura`, con `npm run check` en verde y **489 pruebas** (la fase empezó con
**329**; al terminar el código de Contextos eran **423**). **Ningún paquete nuevo en toda la
fase**, y el core no se tocó salvo por los `.js` de sus imports. Los commits, en
`git log --oneline 0656d91..HEAD`.

**Lo que falta para cerrar la Fase 4 entera, y es todo lo que falta:**

1. **pasar las dos listas manuales** —`test/ui/VERIFICACION-MANUAL.md` y
   `test/ui/VERIFICACION-MANUAL-EDITOR.md`— **en escritorio y en móvil**, y anotar el resultado
   en sus hojas, que hoy están vacías;
2. **contestar por escrito las tres preguntas del editor**, tras usar la app varios días.

**Partida en dos desde el 2026-09-27**: **Fase 4 · Contextos** y después **Fase 4 · Notas**, cada
una con su criterio de cierre en `ARCHITECTURE.md` §9.10 y la navegación que las dos construyen
en §7.4. Dentro de cada parte el orden fue **de abajo arriba y en rebanada vertical**, como en las
fases 1 y 2. **Ninguna de las dos tocó el core.**

#### Fase 4 · Contextos — código hecho, lista manual sin pasar

- [x] **`src/platform/` nace: `Clock` e `IdGenerator` reales, y la composición.** ✅ `473f566`.
      `SystemClock`, `CryptoIdGenerator` (con `getRandomValues`, **no `randomUUID`**, que sólo
      existe en contexto seguro y el móvil por la IP de la red local no lo es), `boot.ts` y
      `main.ts`. Nacen el alias `#platform/*` y `test/platform/`. **En un almacén vacío `boot`
      apunta ya la versión del formato**; si no, uno con notas seguiría diciendo «0» y la primera
      migración futura se lo saltaría. Anotado para ese día: con migraciones que cambien datos,
      `boot` tendría que escribir lo migrado antes de subir la versión.
- [x] **La rebanada vertical mínima: crear un contexto y que sobreviva al recargar.** ✅
      `473f566`. Punto 1. Antes hizo falta el `.js` en los imports relativos, porque **el
      `importmap` solo no bastaba**: casilla en *Infraestructura*.
- [x] **`onCorrupt` en `getAll`, y algo en pantalla que lo diga.** ✅ `473f566`. Punto 2. Su
      casilla de la Fase 3, arriba.
- [x] **La lista de ventanas en `localStorage` y su guarda de integridad.** ✅ `8b96c70`. Punto 4.
      `windows.ts` (`guardWindows`, pura, con pruebas y verificada rompiéndola) y
      `LocalStorageWindows.ts` (clave `elnotas:windows`). Tres decisiones con el usuario el
      2026-09-29, en *Sin decidir*: sin nada guardado se ve el General, se permite el mismo
      contexto en dos ventanas, y un fallo al guardar la lista no avisa.
- [x] **La vista ventanas.** ✅ `c17f5c1`. Punto 3. El General ordena sus notas por nombre; un
      contexto, en el orden de sus `items`.
- [x] **La vista configuración.** ✅ `ba27135`. Punto 5. Con «+ Ventana» cuando la lista está
      vacía, «+ Contexto nuevo» que crea «Nuevo contexto», y `window.confirm` inyectada.
- [x] **La lista de un contexto.** ✅ `11c3291`. Punto 6. Pulsación larga de 500 ms, anulada si el
      dedo se mueve más de 10 px.
- [x] **Reconciliación de listas por clave**, comprobada. ✅ `296dd1b`. Punto 7. Contra una
      interfaz mínima de contenedor, probada en Node. La lista de ventanas de la configuración va
      por **posición + contenido** porque se permiten duplicados. → `ARCHITECTURE.md` §7.5
- [ ] **La lista de verificación manual, escrita y pasada** en escritorio y en móvil. Punto 8.
      **Escrita** (`test/ui/VERIFICACION-MANUAL.md`, `70aeeb6`). **Sin pasar entera**: el usuario
      hizo una revisión parcial y no la confirma, y la hoja de resultados está vacía. **Esto es
      lo que tiene abierta Fase 4 · Contextos.** *Puesta al día el 2026-10-03* con lo construido
      ese día —la D pasa a ser reordenar arrastrando, y hay secciones nuevas: I, el «+» de la
      última ventana, y J, dos pestañas—, y **G1 y G2 ya se vieron en escritorio**. **Sigue
      pendiente, por decisión del usuario el 2026-10-03.**
- [x] **`npm run check` en verde y el recuento anotado.** Punto 9: **423** al terminar el código de
      esta parte.

#### Fase 4 · Notas — código hecho, lista manual y preguntas pendientes

- [x] **La vista nota**: se abre tocando una nota o con «+ Nota», que ya crea y entra; exit y
      atrás vuelven a la misma ventana. ✅ `6fd2667`. Punto 1. El atrás lo comparten la vista
      nota, la configuración y el modo selección (`backStack`), y `close()` es idempotente.
- [x] **Las casillas**, desde el teclado y desde el ratón, con el **interruptor «☐ Casilla»** de
      la barra —hasta el 2026-09-29 eran dos modos, *Texto* ⇄ *Casilla*—. ✅ `c95664d` (la lógica,
      pura y probada contra las tablas del teclado) y `9fab349` (la pantalla). **Marcar con el
      teclado es Ctrl/Cmd+Intro.**
- [x] **El anidamiento: el disparador de anidar.** Arma la línea **siguiente**, se consume al
      usarse y **el armado se ve en pantalla**. Sólo se arma con la casilla encendida, y cambiar
      el interruptor lo desarma. ✅ `c95664d` + `9fab349`.
- [x] **Los bordes del teclado: `split`, `merge` y las cuatro esquinas de §7.3**, con el
      Retroceso al principio en sus dos pulsaciones. ✅ `c95664d` + `9fab349`. Punto 3. Y los
      cuatro huecos que salieron al construirlo, cerrados con el usuario el 2026-09-29 (en *Sin
      decidir*). Y un cambio pedido al usarlo, el 2026-10-03: **Retroceso une con la línea que
      se ve encima** —la última hija de la casilla de arriba, por honda que esté—, no con la
      casilla. Cambia la regla de `merge` en el core (§9.3), una de las dos veces que la Fase 4 lo
      toca —la otra, conservar las referencias a lo ilegible en `hydrate`—.
- [x] **Un `set-checked` redundante no redibuja.** ✅ `56d838c`. Punto 4, y el tercer eslabón de
      la cadena de §9.5 y §9.8 queda **demostrado**: medido en el navegador con `?depurar`, un
      `set-checked` redundante da **0 avisos, 0 escrituras y 0 cambios en el DOM**, frente a
      **1, 1 y 7** de un cambio de verdad.
- [x] **Las ventanas de tipo nota**: el mismo editor en otro marco, y la guarda sabiendo de
      notas, con pruebas y verificada rompiéndola. ✅ `a0ed6ea`. Punto 7.
- [x] **`src/scripts/` fuera del repo**, con `webpack.config.js` y `public/` entero. ✅ `cdfb816`.
      Punto 9. Su CSS no se aprovechó.
- [x] **El `onError` del write-behind**, al final de esta parte. ✅ `f406d96`. Punto 8. El aviso
      (`MountedApp.showSaveError`) sale arriba en cualquier vista, dice el motivo y que lo que se
      ve se perderá al cerrar, y **sólo informa**. `main.ts` lo guarda si llega antes de montar
      la UI.
- [x] **Validar el esquema de lo que se lee del disco**, también al final. ✅ `8e2dba3`. Punto 8.
- [ ] **La lista de verificación manual del editor, escrita y pasada** en escritorio y en móvil.
      Punto 10. **Escrita** (`test/ui/VERIFICACION-MANUAL-EDITOR.md`, `9eec14d`). **Sin pasar**,
      con la hoja de resultados vacía. *Puesta al día el 2026-10-03* (C7b, D4b). **Sigue
      pendiente, por decisión del usuario el 2026-10-03.**
- [ ] **Contestar por escrito las tres preguntas de §9.10** —`move`, `indent`/`outdent`, y si el
      disparador de anidar se entiende solo— **después de usar la app de verdad varios días**,
      no tras una demo. Un «no se aguanta» reabre la decisión correspondiente, y es un resultado
      válido. **Sin contestar el 2026-09-29, y sigue pendiente el 2026-10-03.**
- [x] **`npm run check` en verde y el recuento anotado.** Punto 11: **489**.

#### De las dos partes

- [x] ~~**Decidir si la fase instala un bundler.**~~ ✅ **Cerrada el 2026-09-27: de entrada, no**,
      y la fase se hizo sin él. ⚠️ El `importmap` solo **no bastó**: hizo falta el `.js` en los
      imports relativos (casilla en *Infraestructura*). Registro, abajo en *Sin decidir*.
- [ ] **Acordar la definición del `frontend-agent`.** **Sin hacer, y la fase se hizo sin él.**
      Su ficha (`.claude/agents/frontend-agent.md`) sigue siendo el stub que dice «si te han
      invocado, para». Se redactó una ficha nueva que no se aplicó: **el usuario dijo que no
      hacía falta**. Queda abierta porque la ficha dice cosas que ya no son verdad —que «hoy no
      existen ni `src/ui/` ni `src/platform/`», que el CSS del prototipo se reutiliza, que llega
      webpack o Vite—, y eso es de `.claude/`, que es del usuario. Ver *Sin decidir*.
- [ ] **Qué pasa con las notas de `localStorage` al cambiar de destino.** Arrancar en
      `LocalStorageBlobStore` fue decidido «para salir del paso», y es barato de revertir porque
      el destino se inyecta en un solo sitio. Lo que **no** es gratis son las notas ya escritas:
      o se migran o se pierden. Conviene decidirlo antes de usar la app en serio. Techo
      conocido mientras tanto: ~5 MB por origen, que el base64 del blob infla alrededor de un
      tercio. **Y desde el 2026-09-27, un tercer cabo:** la lista de ventanas vive en su propia
      clave de `localStorage`, fuera del almacén, así que **no viaja con las notas** — un cambio
      de destino o de dispositivo la pierde (`ARCHITECTURE.md` §7.4, riesgo aceptado).

### Infraestructura (`infra-agent`)

Todas son de `src/`, `package.json` o los tsconfig, así que **no las toca el rol de
documentación**.

- [x] **Los imports relativos de `src/` llevan `.js`, y un guardián lo vigila** — ✅ `1037ea1`,
      el primer commit de la fase, antes de la rebanada. **El `importmap` resuelve los alias pero
      no los imports relativos sin extensión**, y el navegador pide
      `./domain/Note` tal cual y recibe un 404. La verificación manual de la Fase 3 lo había
      esquivado compilando dos ficheros con `--noResolve`. **Decidido con el usuario el
      2026-09-29, opción A**: `.js` en todos los relativos de `src/` —115 líneas de import,
      medidas en ese commit, y sólo líneas de import—; `DirectoryHandleBlobStore.ts` sólo importa
      por alias y no se tocó, así que su lista manual sigue valiendo. **Descartadas:** un script
      que reescriba el JS emitido, y un servidor propio que añada `.js`. **El guardián,
      `npm run check:extensiones`** (`tools/check-extensiones.mjs`), entra en `npm run check`,
      que pasa a tener **seis** pasos: sin él, un import sin `.js` pasa todas las pruebas —compilan
      a CommonJS— y sólo se nota al abrir la app. → `ARCHITECTURE.md` §8.6
- [x] **`npm run build:web` e `index.html`** — ✅ `473f566`. `tools/clean-dist.mjs` +
      `tsconfig.web.json` compilan `src/` a `dist/web/` en ESM; `index.html`, en la raíz, lleva el
      `importmap` que calca el campo `imports` y la hoja de estilos. Se sirve con
      `python3 -m http.server 8000`. Sin bundler y sin ningún paquete nuevo. Nacen los alias
      `#platform/*` y `#ui/*`, y `tools/check-fronteras.mjs` pasa a mirar también `src/platform` y
      `src/ui`, con `onCorrupt` en su lista de peligrosas (código ajeno); `onError` entró en ella
      con `f406d96`.
- [ ] **Una declaración sin tipo en una prueba nueva** *(de `back-dev-agent`)*:
      `test/ui/editor.test.ts:51`, `const NOTA = noteId("nota")`. Encontrada en este pase con una
      sonda sobre el AST; es la única en `test/platform/` y `test/ui/`, que por lo demás cumplen la
      regla entera. Una línea.
- [ ] **Comentarios y textos que se quedaron atrás** *(de `back-dev-agent`; la documentación no
      toca `src/` ni `test/`)*. Encontrados en este pase, y todos dicen algo que ya no es verdad:
  - `src/storage/index.ts`: dos comentarios dicen que `platform/` «no nace hasta la Fase 4»;
  - `test/storage/blobs/VERIFICACION-MANUAL.md`, en su preparación: explica el `--noResolve`
    por «un montón de imports sin extensión que el navegador no sabe resolver», y desde
    `1037ea1` ya no los hay. ⚠️ **Tocar ese procedimiento no obliga a repasar la lista** —es el
    `.md`, no `DirectoryHandleBlobStore.ts`—, pero conviene no cambiar los pasos al corregirlo;
  - `test/ui/VERIFICACION-MANUAL-EDITOR.md`, en *Comportamientos conocidos*: llama a `move` e
    `indent`/`outdent` «preguntas del punto 11», y en `ARCHITECTURE.md` §9.10 el punto 11 es el
    recuento de pruebas; las preguntas no llevan número.
- [x] **Las pruebas se mudan a `test/`, partido por capa** — ✅ Hecho. Las **21** que había
      repartidas por `src/` (18 de pruebas y 3 ayudantes) pasan a `test/core/…` y
      `test/storage/…`, en un árbol que calca el de `src/`. Sale del hecho de que `src/` mezclaba
      dos cosas; lo que se gana de fondo es que la separación deja de depender del **sufijo**
      `.test` y pasa a depender de la **carpeta**. El razonamiento entero, en `ARCHITECTURE.md`
      §8.5. Lo que arrastró, que es más de lo que parece:
  - **desaparecen las tres listas negras** que decían lo mismo: el `exclude` del `tsconfig.json`
    de la app, el de la verja del core y el `.filter()` de `tools/check-core-purity.mjs`. Ese
    último cambio hace al guardián **más** estricto, no menos;
  - **los tres ayudantes pierden el `.test`** —`FakeBlobStore.ts`, `FakeStorage.ts`,
    `storageContract.ts`—, que lo llevaban sólo para escapar del tsconfig de la app. `node --test`
    deja de abrir tres ficheros para no encontrar pruebas en ellos;
  - **`rootDir` de `tsconfig.test.json` pasa a ser la raíz del repo**, así que la salida es
    `tmp-test/src/…` + `tmp-test/test/…` y la condición `compiled` de `package.json` apunta a la
    primera. Es el acoplamiento a recordar: mover esto obliga a tocar aquello;
  - **`require-tests.mjs` mira `tmp-test/test/`** y no `tmp-test/` a secas, con lo que caza un
    fallo más: que las pruebas compilen a un sitio distinto del que mira el runner. Verificado
    rompiéndolo, igual que los otros dos guardianes;
  - **la lista de verificación manual se muda también**, a `test/storage/blobs/`. Se le tocó una
    línea, la URL del paso 3; el procedimiento no cambia. *(Estaba sin ejecutar al escribir esto,
    y era lo que tenía abierta la Fase 3; se pasó el 2026-09-13.)*
      Las **314 pruebas antes y después**, y `npm run check` en verde.
- [x] **Anotar el tipo en toda declaración de valor, parámetro y retorno** — ✅ Hecho en
      `src/`, **330 anotaciones en 14 ficheros**, y `npm run check` en verde con las **314**
      pruebas de siempre. El porqué: cuando un tipo cambia, se ve **en el diff** en vez de que
      la inferencia lo absorba en silencio. *(Cifras de aquel día, sobre `core/` y `storage/`.
      **Recomprobado el 2026-09-29, tras la Fase 4**, con una sonda sobre el AST de los cuatro
      módulos: `src/` sigue cumpliéndola entera, y las declaraciones sin anotar son **22**, todas
      `for…of`. La sonda cuenta distinto que la medición original, así que sus totales no se
      comparan con el 330.)*
      **La regla se ensanchó al aplicarla**, y ése es el cambio de fondo: no son sólo las
      declaraciones de valor, son también **los parámetros y el tipo de retorno de toda función
      o método, incluidos los callbacks de una línea** de un `.map` o un `.filter`. La versión
      buena está en `CLAUDE.md`; aquí queda lo medido.
      **Las cifras viejas de esta casilla eran ambas falsas**, y por el mismo motivo —se
      midieron antes de `file/` y `blobs/`, y con la regla estrecha—: decía ~55 declaraciones en
      código y eran **70**, más 11 `for…of` y 6 `catch`.
      Cuatro cosas que salieron al hacerlo:
  - **Apareció una CUARTA excepción, y es la única que no es una elección: `for (const x of …)`
    no admite anotación.** Es `error TS2483`, comprobado con una sonda y no supuesto. Las
    **11** declaraciones que quedan sin anotar en `src/` son exactamente esas once.
  - **Se verificó comparando el JavaScript emitido contra el de antes**, que es la comprobación
    fuerte que admite un refactor de sólo tipos: **idéntico**, salvo dos paréntesis redundantes
    alrededor de un ternario en `operations.js` que salen de reformatear dos líneas.
  - **`DirectoryHandleBlobStore.ts` entró, y su emitido salió con el MISMO sha256**
    (`7342529b…`). Por eso **no se repitió la lista de verificación manual**: el navegador
    ejecutaría los mismos bytes que pasaron la lista el 2026-09-13. Es la única excepción
    registrada a la regla de `CLAUDE.md` de «si tocas ese fichero, se repasa la lista», y se
    apoya en evidencia, no en criterio.
      **⚠️ La excepción se AMPLIÓ el 2026-09-19, al adelgazar la documentación, y conviene
      saber por qué:** `removeComments` está en `false` —ningún `tsconfig` lo toca, y ése es el
      valor por defecto—, así que **TypeScript emite los comentarios al `.js`** y un cambio de
      sólo comentarios mueve el sha256 sin que cambie una instrucción. Medido ese día: el
      emitido pasó de `7342529b…` a `55946a3f…`, y **el código con los comentarios fuera salió
      idéntico**, `1724398b…` antes y después. Así que la excepción ya no es «mismo emitido»
      sino **«mismo código una vez quitados los comentarios»**, y se sigue apoyando en una
      medición, no en criterio. Lo que no cambia: **si se mueve una sola instrucción, la lista
      se repasa.**
  - **Las tres excepciones viejas se confirman tal cual:** la constante que **es** una función
    —se anotan sus parámetros y su retorno, no la constante—, el `as const` de
    `src/core/app/diffState.ts:52` y los dos destructuring de `src/core/app/reduce.ts:227`
    y `:267`.
  - [ ] **Las pruebas viejas — 942 anotaciones** (423 variables, 412 retornos, 107 parámetros,
        medido el 2026-09-19), **deuda aceptada a sabiendas y no un olvido.** Es trabajo mecánico
        que no arregla ni caza ningún fallo, y el diff sería irrevisable. **Lo que se escriba o se
        toque en `test/` a partir de ahora sí cumple la regla**, que es lo que impide que esto
        crezca. **Recomprobado el 2026-09-29** con la sonda de arriba, que cuenta distinto: la
        deuda sigue en `test/core/` y `test/storage/` (981 huecos con su recuento, no comparables
        con los 942), y **`test/platform/` y `test/ui/`, escritas en la Fase 4, la cumplen** salvo
        una línea, anotada como tarea más arriba.
  - ~~*(Opcional)* **Un guardián en `tools/`** que sostuviera esta regla~~ — ❌ **DESCARTADO, y
        el motivo vale como criterio para la próxima vez que alguien proponga un guardián.**

        Esta regla **no caza ni un solo fallo**. El compilador ya dice si un tipo está mal; lo
        único que añade la anotación es que **un cambio de tipo se vea en el diff** en vez de
        que la inferencia se lo trague. Es legibilidad, no corrección.

        Y eso la pone en otra liga que los guardianes que sí existen. Compáralas por lo
        que pasa **si se rompe la regla**:

        | Guardián | Qué pasa si se incumple |
        |---|---|
        | `typecheck:core` | el core toca plataforma y deja de ser portable |
        | `check:purity` | el core lee el reloj → las pruebas dejan de ser deterministas |
        | `require-tests` | `npm test` pasa en verde **sin ejecutar nada** |
        | `check:fronteras` | una excepción se escapa por una firma que prometía `Result` |
        | `check:extensiones` *(desde la Fase 4)* | la app no carga en el navegador, y las pruebas siguen en verde |
        | *(el de tipos)* | **un diff se lee peor** |

        Los cinco primeros tapan agujeros donde algo **funciona mal en silencio**. Éste tapa
        una molestia de revisión, y un script en `npm run check` para eso es maquinaria de más.
        **La regla se queda** —está en `CLAUDE.md` y se aplica al escribir—; lo que se descarta
        es comprobarla automáticamente.

        *(Si alguna vez se reabre: se hace recorriendo el AST con `ts.createSourceFile` y
        `ts.forEachChild`, mirando `VariableDeclaration` sin `type` y los `parameters`/`type` de
        cada función, saltándose las cuatro excepciones y mirando sólo `src/`. Está probado. Pero
        el motivo de arriba no cambia por que sea fácil de escribir.)*

- [x] **Adelgazar la documentación del código** — ✅ Hecho el **2026-09-19**, a petición del
      usuario: *«la documentación del código es extremadamente verbosa y técnica; la quiero
      mucho más corta, que un no dev la entienda, y que responda a "¿para qué sirve esto?"»*.
      Lo medido antes de tocar nada, que es lo que dio la forma del arreglo: **1035 de las 4416
      líneas de `src/core` y `src/storage` eran cabecera de fichero** —33 cabeceras, 31 de
      media, y `BlobStore.ts` con 89 para 8 líneas de código—, mientras que los comentarios
      pegados a su línea sumaban poco. O sea: **la verbosidad estaba concentrada en las
      cabeceras**, y no repartida. Y la primera línea de las 29 ya respondía a la pregunta ella
      sola; lo que sobraba iba debajo, y era `ARCHITECTURE.md` copiado.
      Resultado: cabeceras de `src/` **1035 → 328**, las de `test/` 407 → 308, el módulo entero
      de 4416 a 3600 líneas. 44 ficheros, −1237/+376, **ni una línea de código tocada** y
      `npm run check` en verde con las 319 pruebas. La regla, en `CLAUDE.md`.
  - **Las referencias `§` del código se fueron enteras: 123 → 0.** El motivo lo puso el usuario
    —*«ARCHITECTURE puede cambiar, de hecho no hace falta el porqué»*— y es doble: un `§6.5`
    apunta a un número que se renumera solo, **nada comprueba esos punteros**, y la frase casi
    siempre sobrevive sin él porque ya lleva dentro lo que hay que saber. Comprobado ese día:
    las 21 secciones citadas existían todas, así que ninguna estaba rota **todavía**. Se
    quitaron igual. En los documentos (`VERIFICACION-MANUAL.md` incluido) los `§` se quedan:
    ahí sí son navegación.
  - **Tres razonamientos se movieron a `ARCHITECTURE.md` en vez de borrarse**, porque no
    estaban allí: por qué `BlobStore` mueve `Uint8Array` y no `string`; las dos decisiones
    propias de `LocalStorageBlobStore` (base64 frente a latin1, con su +33%, y el espacio de
    nombres); y por qué un `get` vacío devuelve `null` y no `undefined`. **Comprobar cada
    cabecera contra el documento antes de borrarla es parte del procedimiento**, no un extra.
  - **Cayeron dos datos que ya estaban mal**, y los dos son el mismo síntoma: un comentario
    decía «~50 líneas de `DirectoryHandleBlobStore`» cuando son 156, y otro remitía a una parte
    de la cabecera de `BlobStore.ts` que se acababa de quitar.
  - **Las cabeceras de `test/` se quedan casi enteras, y es una elección.** Explican *por qué
    existe esa prueba* —«esto no comprueba que detecte los cambios, sino que **no** detecte los
    que no hay»—, que es justo el registro que se pedía. Sólo perdieron los `§`.
- [x] **Que `npm test` falle si no hay ficheros de test.** ✅ Hecho. `tools/require-tests.mjs`
      cuenta los `*.test.js` de `tmp-test/test/` y sale con código 1 si no hay ninguno, porque
      `node --test` sin ficheros imprime `1..0` y **sale con código 0**. Mira la salida
      compilada y no las fuentes a propósito: así caza también las pruebas escritas que no
      llegan a compilarse adonde el runner las busca.
- [x] **Que `tmp-test/` se limpie antes de cada compilación.** ✅ Hecho,
      `tools/clean-tmp-test.mjs`. Salió al verificar lo anterior: **`tsc` no borra lo que
      sobra**, sólo emite, así que una prueba borrada dejaba su `.js` atrás y `node --test`
      seguía ejecutándola. Pruebas fantasma de código que ya no existe, y pruebas renombradas
      corriendo dos veces.
- [x] ✅ **`npm run check` vuelve a estar en verde**, y ahora significa algo: 9 pruebas
      ejecutándose de verdad. El 2026-09-29 van 489.
- [x] **Que `npm run check` falle ante `Date.now()`, `Math.random()` o `new Date(` en
      `src/core`.** ✅ Hecho: `tools/check-core-purity.mjs`, enchufado como `npm run
      check:purity`. Tapa el único hueco de la verja — `Date` y `Math` están en `lib.es5.d.ts`,
      dentro de `lib: ["ES2020"]`, y **compilan** dentro del core (recomprobado el 2026-09-06:
      `crypto.randomUUID()` da `TS2304`, `Date.now()` no da nada).
      **No es un `grep`**, y no puede serlo: los comentarios del proyecto mencionan
      `Date.now()` a propósito —son justo los que explican la regla—, así que un `grep` daría
      positivo en `Clock.ts` y en el propio guardián. Lleva un escáner que borra comentarios y
      cadenas antes de buscar. Y **`${Date.now()}` dentro de una plantilla sí salta**, que es
      de las formas más plausibles de colarlo sin querer.
      Verificado en los tres sentidos: pasa limpio, caza las cuatro violaciones reales sin
      tocar las menciones en comentarios ni en cadenas. La excepción que tenía para los
      `*.test.ts` **se le quitó** al mudarse las pruebas a `test/`: dentro de `src/core/` ya no
      hay ninguna, así que ahora mira todo lo que encuentra ahí.
- [x] **Corregir el comentario de `src/core/domain/Versioned.ts`** — ✅ Hecho. Decía que
      `Date.now()` "dentro del core no compila", y es falso. Ahora dice quién lo caza de
      verdad (`npm run check:purity`) y por dónde llega la hora: dentro del `meta` de la
      acción, porque el reducer es puro.
- [x] **Borrar la mención a vitest de `src/core/tsconfig.json`** — ✅ Hecho, y de paso se
      añade ahí el aviso de que **la verja no cubre el reloj ni el azar**, que era justo el
      sitio donde faltaba: quien va a tocar la verja lee ese fichero.

---

## Sin decidir

**No las resuelva por su cuenta quien implemente.** Si te topas con una, pregunta.

### Las siete de la Fase 1 — ✅ **cerradas las siete**

**No queda ninguna abierta: la Fase 1 está especificada entera y se puede escribir de un tirón.**
Se dejan aquí con su respuesta porque el valor está en el porqué, no en la casilla marcada. Las
letras no se reciclan, para que las referencias de `ARCHITECTURE.md` sigan valiendo.

| | Pregunta | Qué depende de ella |
|---|---|---|
| ~~**(a)**~~ | ✅ **Cerrada por eliminación.** Preguntaba qué hace `indent` sobre un texto; `indent` ya no existe. → `ARCHITECTURE.md` §9.3 | |
| ~~**(b)**~~ | ✅ **Cerrada.** Ninguna de las dos: `remove` sobre una casilla con hijas es **no-op**. Se borra de abajo arriba. → `ARCHITECTURE.md` §9.3 | Desbloqueó la primitiva B. Deja **dos deberes**: `move` no puede ser `remove`+`insert`, y la Fase 4 necesita un "borrar rama" explícito. |
| ~~**(c)**~~ | ✅ **Cerrada por eliminación.** Preguntaba cómo detectar el ciclo al mover algo dentro de su propio subárbol; `move` ya no existe, así que no hay destino que comprobar. → `ARCHITECTURE.md` §9.3 | |
| ~~**(d)**~~ | ✅ **Cerrada.** `Position` tiene tres casos y no más. → `ARCHITECTURE.md` §9.4 | |
| ~~**(e)**~~ | ✅ **Cerrada.** El helper es **dos primitivas**; la A va parametrizada por variante con la recursión escrita una sola vez. → `ARCHITECTURE.md` §5.4 | Destapó que la primitiva B queda pendiente de **(b)**. |
| ~~**(f)**~~ | ✅ **Cerrada. Son ocho:** `setText`, `setChecked`, `insert`, `remove`, `split`, `merge`, `convertToCheckBox`, `convertToText`. Fuera `indent`, `outdent` y `move`. → `ARCHITECTURE.md` §9.3 | Cerró también la (c), y fija el tamaño de la Fase 1: ninguna de las ocho pasa de dificultad media. |
| ~~**(g)**~~ | ✅ **Cerrada por eliminación.** Preguntaba qué pasa con los hermanos al hacer `outdent`; `outdent` ya no existe. → `ARCHITECTURE.md` §9.3 | |

### Del editor (Fase 4) — ✅ **cerradas las siete el 2026-09-20**

Eran cuatro dudas apuntadas al diseñar el modo de escritura, y al contestarlas salieron tres
más. **Las tres primeras resultaron ser la misma decisión vista por tres lados**, y por eso se
cerraron juntas.

- **El escalón infinito** — ✅ **el modo anidado se consume.** Tras crear la hija, la barra
  vuelve sola a *Casilla*. Se descartó «baja un nivel una sola vez y luego hermanas», que era lo
  propuesto: funciona igual, pero deja la barra diciendo *Casilla hija* cuando ya se comporta
  como *Casilla*, o sea **lo que ves deja de ser lo que hace**. Consumirlo mata el escalón
  infinito **por construcción**: armado o no, y armar dos veces no baja dos niveles.
- **Cómo se baja un segundo nivel** — ✅ **un botón «anidar» aparte, fuera del ciclo.** La barra
  quedó en dos modos estables (*Texto* ⇄ *Casilla*) más el disparador. Volver a anidar es una
  pulsación en vez de tres, y anidar con soltura es justo lo que distingue esta app de un bloc
  de notas. ⚠️ ***Texto* ⇄ *Casilla* se reabrió el 2026-09-29** y hoy es un interruptor
  «☐ Casilla» (entrada de abajo, *Al construir el editor y las ventanas*); el disparador no
  cambió.
- **Sobre qué actúa «anidar»** — ✅ **sobre la línea SIGUIENTE, nunca sobre la actual.** Duda que
  no estaba apuntada y apareció al juntar las dos de arriba: §7.3 dice que el botón de modo *sí*
  toca la línea donde estás, así que lo simétrico habría sido que anidar bajara de nivel la línea
  actual — y **eso es `indent`**, cerrado que no existe porque en el teclado de un móvil no hay
  Tabulador. La distinción que lo resuelve: cambiar la **clase** de una línea viva está
  permitido, cambiar su **nivel** no. Precio, el ya aceptado: una línea en el nivel equivocado se
  borra y se reescribe. ⚠️ **Contrapartida obligatoria: el armado tiene que verse**, o la próxima
  Intro es una sorpresa.
- **Las cuatro esquinas del teclado de §7.3** — ✅ **confirmadas las cuatro tal cual.** La única
  que merecía mirarse era *partir una casilla que tiene hijas*, porque parece chocar con la regla
  de que lo que tiene hijas no se toca; no choca, porque esa regla prohíbe lo que **hace
  desaparecer** una línea (`remove`, `merge`, `convertToText`) y `split` no destruye nada.
- **El identificador en el código** — ✅ **`WritingMode`, en inglés y en singular.**
  `ModosEscritura` era el nombre provisional del diseño y se retira. **La premisa de la duda era
  falsa** y conviene no reutilizarla: decía que «todo lo demás está en inglés», y el repo está
  mezclado con un patrón que nadie había escrito — **público en inglés** (`Note`, `CheckBox`,
  `createFileStorageAdapter`), **maquinaria interna en castellano** (`cambio`, `caminoDe`,
  `clasificar`, `esReintentable`, `frontera`). Va en inglés por ser público, no por el repo.
- **El alcance de los tres pendientes de la Fase 3** — ✅ **`onCorrupt` entra con la primera
  rebanada; `onError` y la validación de esquema, dentro de la fase pero después del editor.**
  El criterio: `onCorrupt` no es deuda interna, es un fallo que el usuario ve — una nota ilegible
  impide abrir la app. *(Precisado el 2026-09-27, al partir la fase: `onCorrupt` en Fase 4 ·
  Contextos; `onError` y la validación, al final de Fase 4 · Notas. Entrada de abajo.)*
- **Dónde guarda la app al arrancar** — ✅ **`LocalStorageBlobStore`, para salir del paso.**
  Decidido a sabiendas de que es provisional. Aquí lo provisional **sí** es barato, y por un
  motivo estructural: `BlobStore` es un puerto, así que el destino se cambia en un solo sitio de
  `platform/` — no es código que reescribir, es un parámetro. Lo que no es gratis está apuntado
  como tarea: migrar las notas ya escritas el día del cambio, y el techo de ~5 MB.

**Lo que este rediseño NO costó, que es el dato interesante:** ni una línea del núcleo. Los tres
casos de `Position` siguen intactos y no hizo falta ninguna operación nueva; sólo cambió quién
elige `last-child-of`. La lección, anotada en §9.4: justificar una pieza del dominio por la forma
que hoy tiene la UI es atarla a lo que más cambia.

### De la navegación y el alcance (Fase 4) — ✅ **cerradas el 2026-09-27**

Salieron de planificar la UI/UX con el boceto en PDF del usuario delante. El diseño entero y sus
porqués están en `ARCHITECTURE.md` §7.4 (navegación), §7.2 (la barra) y §9.10 (la fase partida
y sus dos criterios); aquí queda el registro de lo que estaba abierto y cómo se cerró.

- **Si la fase instala un bundler** — ✅ **de entrada, no.** Se arranca con el `<script
  type="importmap">` ya probado en `test/storage/blobs/verificacion-manual.html`, que carga el
  código de producción compilado a ESM y funcionó en Brave y en Firefox. Cero dependencias; el
  bundler entra sólo cuando algo concreto lo exija. Se aplica desde Fase 4 · Contextos, que es
  la que escribe la primera línea de `ui/`. ⚠️ ***Corregido el 2026-09-29:*** «ya probado» era
  verdad a medias —ese andamio sólo cargaba dos ficheros compilados con `--noResolve`—, y para
  el core entero **hizo falta además el `.js` en los imports relativos** (entrada de abajo). La
  decisión no cambió: la fase se hizo sin bundler.
- **Cuándo entran `onError` y la validación de esquema** — ✅ **al final de Fase 4 · Notas.** La
  decisión del 2026-09-20 decía «después del editor»; con la fase partida, eso cae ahí.
- **Qué hace el aviso de `onError`** — ✅ **sólo informa** («No se están guardando los cambios»).
  Es coherente con la decisión de la Fase 3 de que un write-behind detenido no se reanuda. El
  botón de «reintentar» queda aparcado (abajo) para cuando el destino sea la carpeta del
  usuario, donde reanudar tiene un significado: volver a pedir la carpeta.
- **Dónde se guarda el orden de las ventanas** — ✅ **fuera del core, en `localStorage`**, con
  clave propia. Opción C de cuatro; la B —una entidad del core— queda aparcada (abajo). Riesgo
  aceptado explícitamente: no viaja con las notas, hay dos sitios donde se guarda, y la
  integridad la vigila una guarda en la presentación y no el core.
- **Cómo se parte la fase** — ✅ **Fase 4 · Contextos y luego Fase 4 · Notas**, de lo global a lo
  específico, a propuesta del usuario. Nombradas por contenido, no por número. Los **Planes pasan
  a ser la Fase 5**, que se planifica cuando la 4 cierre.
- **Cómo se recoloca una nota entre contextos** — ✅ **«Mover a…», en la barra de selección,
  con semántica de MOVER.** Desde un contexto, `remove-item` + `add-item` (si ya estaba en el
  destino, `add-item` es no-op y sólo se quita); desde el General, sólo `add-item`. El selector
  lista los contextos existentes, ni el General ni el actual, y no confirma. Descartados «Añadir a
  otro» (copiar la referencia) y tener las dos. Salió de una duda del pase de documentación:
  quitar una nota de un contexto se daba por reversible y **no había ningún gesto para devolverla**;
  ahora se devuelve desde el General. Entra en Fase 4 · Contextos. → `ARCHITECTURE.md` §7.4
- **Qué se recuerda al recargar** — ✅ **la ventana activa, y nada más.** Se guarda junto a la
  lista de ventanas, como **referencia y no como índice** (un índice se desplaza al quitar
  ventanas); si ya no es visible, la primera, o la pantalla vacía. La vista nota o la
  configuración que hubiera encima no se recuerda. → `ARCHITECTURE.md` §7.4
- **Qué pasa con una nota vacía** — ✅ **se mantiene. Y es una RECTIFICACIÓN, que se deja a la
  vista:** en la misma sesión se había decidido primero que *una nota abandonada vacía se
  descarta* (vacía = sin texto en el contenido), y se cambió porque «se mantiene» simplifica la
  gestión —«+ Nota» crea en el momento y exit sólo vuelve— y porque, con la regla de descarte,
  **vaciar una nota existente que es ventana la borraría de verdad al salir**. Precio: un «+» sin
  querer deja una «Nueva Nota» vacía, que se quita con selección y papelera. Si alguien vuelve a
  proponer el descarte, ése es el argumento que lo tumbó.

### Al construir el editor y las ventanas (Fase 4) — ✅ **decididas el 2026-09-29**

Salieron al escribir el código, con la app delante. **Las de este primer bloque las decidió el
usuario una a una**; el diseño y su porqué, en `ARCHITECTURE.md` §7.2–§7.4 y §8.6.

- **Cómo se carga la app sin bundler** — ✅ **opción A: `.js` en todos los imports relativos de
  `src/`**, vigilado por `npm run check:extensiones`. El `importmap` solo resolvía los alias y no
  los relativos. Descartadas: un script que reescriba el JS emitido, y un servidor que añada
  `.js`. → §8.6
- **`WritingMode` reabre §7.2** — ✅ **un interruptor «☐ Casilla»** (`{ checkbox, nestArmed }`),
  con el texto como lo normal, **en vez de dos modos con nombre** (*Texto* ⇄ *Casilla*). El
  argumento que sostenía los dos modos —«un apagado obliga a preguntarse qué significa»— no
  aplica: apagado es texto normal. **El comportamiento no cambia**: encender es lo que era «pasar
  a *Casilla*», apagar lo que era «pasar a *Texto*». Anidar sólo se arma con la casilla
  encendida, y cambiar el interruptor lo desarma. → §7.2
- **Intro en un texto** — ✅ **crea la línea con `after`, debajo de la actual**, y no con
  `root-end` como decía la tabla de §7.3: con `root-end`, una línea escrita en medio de la nota
  aparecía al final. `root-end` se queda para la primera línea de una nota vacía. Desde una
  casilla anidada con la casilla apagada, el texto nace **debajo de su casilla de la raíz**. Los
  mismos tres casos de `Position`, y el core sin tocar. *(El usuario lo aprobó con un
  «adelante» que al principio se interpretó como sí; el uso posterior lo ha confirmado, y queda
  registrado como decidido.)* → §7.3, §9.4
- **Los cuatro huecos de §7.3** — ✅ **(a)** con anidar armado en un **texto**, Intro crea una
  casilla hermana y anidar **sigue armado**; **(b)** partir una casilla **anidada** con el
  interruptor apagado deja la mitad nueva **como casilla** — *cambiado el 2026-10-03: ahora sale
  como texto a la raíz, debajo de su casilla de la raíz*; **(c)** `split` **no anida**, y anidar
  sigue armado; **(d)** marcar con el teclado es **Ctrl/Cmd+Intro** (y el ☐ es un botón: Espacio
  con el foco encima). → §7.3
- **Ventanas** — ✅ **sin nada guardado se ve una ventana, el General**; **se permite el mismo
  contexto en dos ventanas** (la activa, por referencia, es la primera que coincide); y **un fallo
  al guardar la lista de ventanas no avisa**: sólo se pierde el orden. → §7.4
- **Varias notas con el mismo nombre** — ✅ **se deja así.** Toda nota nace como «Nueva Nota», y
  varias se veían iguales en el selector de ventanas. **No es un problema**: lo que las distingue
  es su id, que siempre es distinto, y el selector **no enseña nada más** —ni el principio del
  contenido, ni la fecha, ni el id—. → §7.4

**Y un bloque de decisiones de implementación**, tomadas al escribir el código y **aceptadas por
el usuario en bloque**, no cerradas una a una. Están descritas en `ARCHITECTURE.md` §7.4 y §7.5;
aquí, sólo la lista para que nadie las tome por accidentes:

- el General ordena sus notas **por nombre**; un contexto, en el orden de sus `items`;
- en la configuración: **«+ Ventana»** con la lista vacía —*sustituido el 2026-10-03 por la fila
  de fichas con ⋮, arrastrar y una ficha «+»*—, **«+ Contexto nuevo»** crea «Nuevo
  contexto», la confirmación es `window.confirm` **inyectada** —*cambiada el 2026-10-03 por una hoja propia:
  en el panel de Claude `window.confirm` contestaba «no» sin enseñarse*—, y lo que se deja a medias **no se
  recuerda** al salir;
- **`backStack`**: configuración, vista nota y modo selección comparten el historial del
  navegador, así que el atrás cierra los tres y el exit **es** ir atrás; `close()` es idempotente
  (un segundo `back()` sacaba de la página: cazado probando);
- **reconciliación por clave** contra una interfaz mínima de contenedor, probada en Node: notas y
  contextos por `data-id`, líneas del editor por `tipo:id`, y **la lista de ventanas de la
  configuración por posición + contenido** —no tiene id estable porque se permiten duplicados; un
  id por ventana obligaría a cambiar el formato guardado, y se descartó—, con el foco llevado a su
  sitio en cada paso. Precio: al quitar o añadir en medio, las filas de detrás se recrean;
- **selección**: pulsación larga de 500 ms, anulada si el dedo se mueve más de 10 px; cada
  pulsación empieza limpia (el primer toque tras una pulsación larga se perdía: cazado probando);
- **editor**: un `contenteditable` (`plaintext-only`, con respaldo) por línea; `setText` en cada
  tecla, porque el write-behind ya agrupa; **el campo con el foco no se repinta, salvo durante
  una orden del editor** (partir la línea con foco la dejaba con el texto viejo: cazado
  probando); los botones de la barra no roban el foco y leen la selección en vivo (usaban un
  cursor viejo: cazado probando); Intro y Retroceso por `keydown` con `beforeinput` de respaldo
  para Android; las flechas saltan de línea; Tab mete un carácter;
- **ventanas de tipo nota**: `WindowRef` gana `note`; **el mismo `NoteEditor`** en la ventana, con
  ◀ ▶ ⚙ y la barra sin exit; la guarda sabe de notas; el selector las ofrece tras un rótulo
  «Notas:».

### Abiertas al cerrar el código de la Fase 4

**No las resuelva por su cuenta quien implemente.** Las dos primeras son abiertas **por decisión
del usuario**; la tercera es de `.claude/`, que es suyo; las dos últimas salieron en el pase de
documentación del 2026-09-29.

- ~~**La referencia que pierde un contexto cuando `onCorrupt` se salta una nota**~~ — ✅
  **cerrada el 2026-10-03 con la opción A**, de cuatro que se pusieron sobre la mesa: **A**,
  conservar las referencias a lo ilegible (`hydrate(stored, ilegible)`, `pathOf`, `skipCorrupt`
  + `App.corrupt`); **B**, devolverlas al guardar —descartada: el almacén tendría que saber de
  contextos—; **C**, una nota de relleno sólo de lectura —descartada: habría que impedir escribir
  encima del fichero roto desde cualquier sitio—; **D**, no guardar el contexto en esa sesión
  —descartada: cambios que no se guardan—. La A arregla la causa (confundir «ilegible» con «no
  existe») y no la consecuencia. → `ARCHITECTURE.md` §6.5
- ~~**Cuatro reglas `deny` de `.claude/settings.json` protegen carpetas que ya no existen**~~ —
  ✅ **quitadas el 2026-10-03**, a petición del usuario: eran `Edit`/`Write` sobre
  `./src/scripts/**` y `./public/js/**`. El mismo día se quitó el worktree viejo
  `.claude/worktrees/reverent-elbakyan-7edec1` y su rama, ya integrada en `rediseno-arquitectura`.
- **Las fichas de agentes están desfasadas**, y también son del usuario. `frontend-agent.md` sigue
  siendo el stub que dice «si te han invocado, para» y que `src/ui/` y `src/platform/` no
  existen; se redactó una ficha nueva que no se aplicó, porque **el usuario dijo que no hacía
  falta**. `infra-agent.md` todavía manda reinstalar webpack en la Fase 4 y habla de
  `webpack.config.js`, que ya no está. Por eso la casilla «Acordar la definición del
  `frontend-agent`» sigue **sin hacer**.
- ~~**Borrar una rama de casillas**~~ *(detectado en el pase)* — ✅ **cerrada el 2026-10-03: no se
  construye.** `ARCHITECTURE.md` §9.3 decía que en la Fase 4 «hace falta una forma explícita de
  borrar una rama». El usuario prefiere que se quede como está: **una casilla con hijas se borra
  una a una**, de abajo arriba. Hoy no falla nada —el editor no tiene selección de varias
  líneas, así que no hay un «Supr» que no haga nada—.
- ~~**El disparador de Snabbdom, por tamaño, está pasado**~~ *(detectado en el pase)* — ✅
  **cerrada el 2026-10-03: el disparador cambia de tamaño a fallos.** Medido el 2026-09-29, el
  DOM de `src/ui/` eran ~1170 líneas sin comentarios, por encima de las ~600 del disparador. Pero
  el tamaño medía lo que no era: de los seis fallos de UI del 2026-10-03 —`window.confirm`
  contestando «no» sin enseñarse, `transitionend` que no llega en una pestaña oculta, cerrar dos
  capas del `backStack`, un `stale` falso, partir una anidada, arrastrar frente a deslizar—
  **ninguno era de sincronizar el DOM**, y Snabbdom no habría evitado ninguno. Donde más cuesta,
  el editor, ayuda poco por `contenteditable`; donde ayudaría, las listas, `reconcile.ts` ya lo
  hace. Disparador nuevo en *Ideas aparcadas*.

**Y las que ya estaban abiertas siguen igual:** la **escritura condicional** (abajo), **si OPFS
entra en juego** (abajo, *Tres huecos…*) y **qué pasa con lo guardado en `localStorage` al cambiar
de destino**, que desde el 2026-09-27 incluye la lista de ventanas (arriba, en *Pendiente*).

### Qué devuelven los casos de uso — ✅ **cerrada y CONSTRUIDA: la entidad protagonista, o `null`**

**Decidida y construida el 2026-09-19**, con **329 pruebas** en verde (eran 319: tres reescritas
y diez nuevas). Salió al hacer inventario de las funciones que
devuelven `void`: **16 de los 18 casos de uso no devuelven nada**, y sólo `createNote` y
`createContext` devuelven su id. Cruzado con la regla de que *una operación que no aplica no
hace nada en lugar de fallar*, eso deja que **desde el sitio de la llamada «hecho» y «no
aplicaba» sean indistinguibles**: `remove` sobre una casilla con hijas es no-op, `add-item`
sobre un destino inexistente también, y quien llama no se entera de ninguno de los dos.

**Lo decidido: cada caso de uso devuelve la entidad que ha tocado, o `null` si no aplicó.**

```
Note | null     la nota como ha quedado · null si fue no-op
Context | null  igual para las seis de Contexto
```

**Las dieciocho con el mismo tipo, sin excepción ni aserción**, y eso salió de un hecho que se
comprobó en el reducer al implementarlo: **`create-note` con un id que ya existe es no-op**
(`reduce.ts`, primera línea del caso), igual que `create-context`. O sea que `null` es
alcanzable también al crear, y la idea inicial de que `createNote` devolviera una `Note` no
nullable era falsa. `createNote` y `createContext` pasan de devolver el id a devolver la
entidad, que es estrictamente más: el id sale dentro.

**Y `Result` se descartó, que era la primera idea.** `Result<T, E>` significa aquí «esto puede
fallar», y un no-op **no es un fallo** — está escrito en `CLAUDE.md` con esas palabras. Meterlo
en el canal `err` desharía esa decisión por la puerta de atrás: todo el `if (!r.ok)` pasaría a
tratar «no aplicaba» como error. El indicio práctico de que no encaja es que **no hay `E`
posible**: ni `StorageError` ni `MigrationError` sirven, y haría falta inventar una tercera
taxonomía de errores para cosas que no lo son.

**El no-op no hay que calcularlo: ya está calculado.** Es la invariante de identidad, así que
la comprobación es un `===`, **no hizo falta tocar el `Store` ni el reducer**, y los cuatro
caminos salen de una sola expresión —`cambio`, al final de `useCases.ts`—:

```ts
const cambio = <T>(antes: T | undefined, despues: T | undefined): T | null =>
  despues === antes ? null : (despues ?? antes ?? null)

//  cambió      antes ≠ después        → la entidad nueva
//  no aplicó   antes === después      → null
//  se borró    después es undefined   → la que se leyó antes
//  no existía  los dos undefined      → null
```

Encima van dos ayudantes de tres líneas, `trasNota` y `trasContexto`, que leen, despachan y
comparan. Los dieciocho casos de uso siguen siendo una expresión cada uno.

⚠️ **Esto vive de la invariante de identidad**: si una operación devolviera una copia
equivalente en vez de su entrada, `cambio` diría «cambió» siempre y el `null` dejaría de
significar nada. Es la misma dependencia que tiene `diffState`, y se rompe igual de callada.

**Verificado rompiéndolo a propósito**, que es la disciplina de esta capa. Tres roturas de
`cambio`, y cada una tumba **exactamente una** prueba y ninguna más:

| Rotura | Qué cae |
|---|---|
| quitar la comparación `antes === despues` | *un NO-OP devuelve null* |
| `despues ?? null` (se pierde la borrada) | *deleteNote devuelve la nota BORRADA* |
| `antes ?? despues` (devuelve la vieja) | *una acción que cambia algo devuelve la entidad YA ACTUALIZADA* |

⚠️ **Y un barrido que parecía cubrir los dieciocho y no cubría nada, que es la lección que
conviene conservar.** El primero que se escribió llamaba a cada caso de uso **sobre un estado
vacío** y exigía `null`. Se midió rompiendo un caso de uso a propósito —que `merge` se saltara
`cambio` y devolviera `getState().notes[id]` a secas— y **las 326 pruebas pasaron en verde**:
sin nota en el estado, el camino correcto y el incorrecto dan `null` los dos.

El barrido con dientes es el otro: **la entidad existe y la acción aun así no aplica**. Ahí un
no-op tiene que dar `null`, y quien se salte la comparación devuelve la entidad. Con la misma
rotura, ése cae. Son dos listas, `NO_OP_CON_NOTA` (diez) y `NO_OP_CON_CONTEXTO` (cuatro), y
comprueban además que la entidad guardada **sigue siendo el mismo objeto**, o sea que tampoco se
estampó `updatedAt`. El débil se conserva porque cuesta nada y cubre el otro extremo, pero los
que vigilan son éstos.

Encontrar el no-op de cada uno fue la única parte con trabajo, y está en el reducer: renombrar
**con el nombre que ya tiene**, insertar **tras una línea que no existe**, meter una referencia a
algo inexistente, quitar lo que no estaba, poner la vista que ya tenía. `createNote`,
`createContext`, `deleteNote` y `deleteContext` van con prueba propia porque siempre aplican.

⚠️ **Y el agujero era simétrico, que es lo que casi se escapa.** Cerrado el lado de la Nota, el
del Contexto seguía abierto: con `addItem` saltándose la comparación, **las 327 pasaban en
verde**. La lección para la próxima: cuando una comprobación se hace por duplicado —`trasNota` y
`trasContexto`— la cobertura hay que mirarla **en las dos mitades**, porque probar una no prueba
la otra.

⚠️ **Lo que este retorno NO da, y hay que saberlo porque suena a que sí: undo.** `delete-note`
es la única acción que toca **dos clases de entidad** —borra la nota **y** limpia todos los
contextos que la listaban, ver `sinReferenciasA` en `reduce.ts`—. Devolver la `Note` borrada y
reinsertarla recupera la nota **huérfana**, fuera de todas las listas donde estaba, porque las
`ItemRef` limpiadas no vuelven. Se evaluó darle a `deleteNote` un retorno más rico y **se
descartó**: rompe la uniformidad de las dieciocho firmas por un solo caso, y el undo va a
necesitar su propio diseño de todas formas —es una pila, no un valor de retorno—. Así que el
retorno es **la entidad protagonista, no todo lo que cambió**: sirve para saber qué pasó y para
pintar; no sirve para deshacer.

**Una consecuencia en las pruebas que conviene no deshacer:** `useCases.test.ts` tiene ahora
**dos montajes**, y la diferencia es deliberada. `montar()` sigue dando un `Store` de mentira
que sólo apunta acciones —aísla esta capa del reducer, y es con el que se comprueba el
cableado—; `montarDeVerdad()` monta el `Store` real, porque **lo que devuelve un caso de uso
depende de si la acción cambió algo, y eso sólo lo sabe el reducer**. Unificarlos perdería el
aislamiento de lo primero.

### Escritura condicional y conflicto entre dos pestañas

**✅ Decidida con el usuario y CONSTRUIDA el 2026-10-03: la opción c, escritura condicional, con
«avisar y recargar».** El detalle de lo construido, en `ARCHITECTURE.md` §6.5. Se pusieron sobre la mesa cuatro: **a**, una sola pestaña activa con Web Locks;
**b**, recargar al enterarse por el evento `storage`; **c**, escritura condicional con
`revision`; **d**, b + c. Ganó la c **porque es la que se reutilizará cuando haya sincronización
entre dispositivos**. Precio asumido: una pestaña no se entera de lo que cambió la otra hasta que
intenta guardar —enseña lo viejo—, pero **nunca pisa**. Las tres cosas de abajo quedaron así:
`put(entidad, esperada)` y `delete(id, esperada)`; el caso `stale`, con el id; y la app **avisa
y ofrece Recargar** —lo más sencillo; se pierde lo escrito en esa pestaña desde el último
guardado—. Descartada, *guardar como copia en conflicto*, que no perdía nada.

**Antes de decidirse estuvo abierta a conciencia, no por olvido.** Salió al cerrar la taxonomía de `StorageError` (§6.5) y
es el único caso que se dejó fuera a propósito.

El problema es real y va a pasar: **dos pestañas abiertas sobre la misma nota**, y la segunda
pisando lo que acaba de guardar la primera. El modelo ya tiene la pieza para detectarlo
—`revision` existe justo para eso, y por eso es un token opaco y no un contador (§5.3)— pero el
mecanismo **no está construido**: `Repository.put` no recibe revisión, así que hoy no hay forma
de decir "escribe esto sólo si nadie lo ha tocado desde que lo leí".

**Por qué no se metió ya un caso de error para esto:** sería inventar un aviso que nadie puede
disparar, y choca con la regla del proyecto de no construir lo que no tiene consumidor — la
misma por la que no existen `move` ni el puerto `Scheduler`.

Queda anotado como **lo primero que se añadirá a `StorageError`** el día que el mecanismo
exista. Tres cosas que habrá que decidir ese día, y conviene que estén escritas ya:

- **La firma.** Si `put` pasa a recibir la revisión leída (`put(entity, esperada)`) o si la
  escritura condicional es un método aparte.
- **El caso de error.** Algo como `{ kind: "stale"; stored: Revision }` — y **no es un `io`**:
  reintentar a ciegas es justo lo que no hay que hacer, porque volvería a pisar.
- **Qué hace la app al recibirlo**, que es decisión de producto y no de arquitectura. Lo único
  ya descartado es **"gana el último"** (§5.3).

**Qué lo desbloquearía:** que la app se use de verdad en dos pestañas, o llegar a la Fase 4 con
el editor delante. No antes: sin un segundo escritor real, no hay forma de probar que el
mecanismo funciona. *(El 2026-09-29 el editor ya existe y esto sigue abierto: la escritura
condicional quedó fuera de la Fase 4, y sigue sin haber un segundo escritor real.)*

### Tres huecos que salieron al escribir el criterio de la Fase 3 — queda uno

**Salieron de escribir `ARCHITECTURE.md` §9.9, y se dejaron abiertos a conciencia:** el criterio
recoge lo ya decidido y lo hace comprobable; decidir esto de paso, y sin preguntar, habría sido
cambiar el alcance de la fase por la puerta de atrás. **Dos están cerrados** —el del manifiesto y
el de la lista manual—; el de OPFS **sigue sin contestarse formalmente**, aunque la pasada del
2026-09-13 lo dejó sin filo: la fase se cerró sin exigirlo y OPFS pasó igualmente.

- ~~**¿En qué fichero vive la lista de verificación manual, y su resultado?**~~ — ✅ **Cerrada al
  escribirla: junto a las pruebas de su mismo rincón, hoy
  `test/storage/blobs/VERIFICACION-MANUAL.md`.** Ni
  una sección de este fichero ni un cuarto documento: **los documentos del proyecto siguen siendo
  tres**, porque esto no es documentación de diseño sino **un procedimiento**. Cuando se escribió
  vivía pegada al adaptador, en `src/storage/blobs/`; se mudó con las demás pruebas
  (`ARCHITECTURE.md` §8.5) y el criterio no cambió, sólo la carpeta a la que apunta: **es una
  prueba de `DirectoryHandleBlobStore`**, y lo único que la distingue de sus vecinas es que la
  ejecutan unas manos. **Las pasadas se acumulan ahí mismo**, en una
  «Hoja de resultados» con plantilla (fecha, navegador y versión, sistema, quién, commit) y **la
  más reciente arriba**: no se sobreescribe la anterior, porque interesa saber en qué navegador
  funcionó y en cuál no. Lo que sigue siendo tarea —ejecutarla— está arriba, en *Pendiente*.
- ~~**¿Qué lleva dentro el `manifest.json`?**~~ — ✅ **Cerrada al escribir el adaptador: sólo
  `{ schemaVersion }`, y NO un índice de ids.** `getAll` se resuelve con `list(prefijo)` más una
  lectura por entidad, y el `schemaVersion` vive ahí y sólo ahí. El motivo que decidió es que un
  índice crea **dos fuentes de verdad** sobre la misma carpeta: cada `put` serían dos escrituras
  no atómicas, y morir en medio deja o un id fantasma o —peor— **una nota guardada que el índice
  no menciona y que por tanto no se abriría nunca**. Además los tres repositorios se pisarían
  sobre el mismo fichero, que es justo lo que §6.1 da como motivo para que `Repository` no hable
  con `BlobStore`. **Precio aceptado:** N lecturas al arrancar; si algún día duele, **una caché,
  no una segunda fuente de verdad**. → `ARCHITECTURE.md` §6.2.
- **¿Entra OPFS en la Fase 3? — LA ÚNICA QUE SIGUE ABIERTA.** §6.1 dice que es **la misma**
  `DirectoryHandleBlobStore` y que lo único que cambia es **cómo se consigue el handle**
  (`showDirectoryPicker()` frente a `navigator.storage.getDirectory()`). Si eso es «quién abre el
  storage», es composición y cae en la Fase 4 por §9.7; si se considera parte del adaptador,
  entonces la lista manual necesita **una segunda pasada**. El criterio de cierre pide una pasada
  sobre la carpeta real y no se pronuncia sobre la otra.
  **Cómo se dejó mientras tanto, sin decidirlo por la puerta de atrás:** la lista manual lleva
  OPFS como **sección E, marcada opcional**, con su botón en el andamio y la nota de que §9.9 no
  la exige. Quien pase la lista puede hacerla o no; si la hace, se anota. Lo que esa sección **no
  puede** sustituir es la de la carpeta real: en OPFS no hay explorador de ficheros que mirar, y
  el oráculo del `close()` es precisamente mirar el fichero en el disco.
  **Y la realidad la ha dejado sin filo, aunque la pregunta siga sin contestar formalmente:** en
  la pasada del 2026-09-13 la sección E **se hizo y pasó en los dos navegadores** —es lo único
  que Firefox pudo probar—, y la fase se cerró **sin exigirla**. Así que la respuesta de facto es
  la primera: OPFS es «cómo se consigue el handle», o sea composición, o sea Fase 4. Si alguien
  quiere cerrarla formalmente, eso es lo que hay que escribir.

### ~~Cómo se verifica la Fase 3~~ — ✅ **cerrada: a mano, y documentado**

**Nada de Playwright ni de ningún runner de navegador.** Se cierra antes de empezar la fase, no
a mitad, que era el motivo de dejarla apuntada.

**Lo primero que hay que ver es que el problema es mucho más pequeño de lo que decía esta
entrada**, y lo es gracias al reparto en dos niveles de §6.1:

| Qué | Tiene lógica propia | Cómo se verifica |
|---|---|---|
| `FileStorageAdapter` | **sí** — serializa, traduce id → camino, mantiene el manifiesto | Node, con la **suite de contratos que ya existe** y un `BlobStore` falso |
| `LocalStorageBlobStore` | poca | Node, con un `Storage` falso (52 líneas de código, y sabe lanzar excepciones) |
| `DirectoryHandleBlobStore` | **no** — sólo traduce a la API del navegador | **a mano, una vez, con una lista de pasos escrita en el repo** |

Así que lo que no se puede automatizar es **un fichero sin lógica interesante**. Todo lo que
puede tener un fallo interesante queda del lado de Node.

> **Cifra corregida al escribirlo, y se deja a la vista porque era el argumento:** aquí decía
> «unas cincuenta líneas», y son **156 líneas de código**. La decisión **no cambia** —lo que
> creció es el clasificador de excepciones, que es justo lo que un doble no puede probar, más un
> `list` recursivo y unas declaraciones de tipo—, pero el número que la sostenía era falso y
> repetirlo sin medirlo es como se pudre esto. El porqué desarrollado, en `ARCHITECTURE.md` §6.3.

**Por qué un test unitario con un doble no resuelve esas líneas.** Porque un doble
que escribes tú prueba **lo que tú crees que hace la API**, no lo que hace. El ejemplo que lo
deja claro: escribir un fichero con la File System Access API exige un `close()` final, y **ese
`close()` es lo que vuelca los datos al disco** — sin él no se guarda nada. Un `BlobStore` de
mentira que guarde en un `Map` pasa en verde con el `close()` olvidado. La regla general:
**cuanto más fina es la capa de traducción, menos vale probarla con un doble**; el test acaba
siendo el mismo código escrito dos veces, y con el mismo error si lo hay.

**Y el argumento que decide:** ese fichero **se ejercita solo cada vez que alguien usa la app**.
Si guardar en la carpeta no funciona, se nota al minuto y de forma ruidosa. La verificación
automática se reserva para lo que falla **en silencio**, que es lo que las fases 1 y 2 han estado
blindando.

**Precio aceptado:** si el navegador cambia el comportamiento de esa API, no lo cazará ninguna
prueba — lo cazará el uso. Y mientras la lista manual no se haya pasado ni una vez, tampoco lo
caza el uso, porque nadie lo ha usado: por eso el punto 5 de §9.9 existe.

**Qué lo reabriría:** que aparezca un segundo `BlobStore` sobre navegador con lógica de verdad
(el de Drive, con su OAuth y sus reintentos), o que ese fichero dé más de un sobresalto. Ese día, el runner de navegador se instala **sólo para esa fase**, coherente con la
política de dependencias. Aparcado abajo.

### ~~La justificación escrita de `schemaVersion` no es la real~~ — ✅ **cerrada**

**Se adopta la razón buena y se reescribe.** El argumento viejo —«añadirlo cuando ya haya notas
guardadas sería una migración de datos»— **no aplica**, porque no hay nada guardado todavía y
por tanto valdría igual para `Versioned`, que sí se adelantó. La razón real: **`schemaVersion`
*es* el mecanismo de migración**, y un número de versión que nadie lee no protege nada, así que
llega con el runner que lo consume.

De paso se cierra dónde vive: **en `StorageAdapter`, no en `AppState`**. Es una propiedad de lo
guardado; en el estado en memoria no significaría nada y cada acción tendría que arrastrarla.
El comentario de `AppState.ts` que decía que faltaba ahí **ya está corregido** (comprobado el
2026-09-29).
→ `ARCHITECTURE.md` §9.7

### ~~El arranque de la app no tiene fase asignada~~ — ✅ **cerrada: tenía dos**

Por eso no encajaba en ninguna. **Se parte**, por la misma costura que el write-behind:

- **la parte pura, en la Fase 2** — `hydrate(entidades) → AppState` y el runner de migraciones.
  De datos a datos: se prueban sin navegador y sin temporizadores.
- **la parte impura, en la Fase 4** — quién abre el storage y en qué orden, y qué se le enseña
  al usuario si no hay nada guardado (¿nota de bienvenida? ¿contexto vacío?). Eso es
  composición y decisión de producto, y vive en `platform/web/`. **Construida en `473f566`**:
  `boot.ts`, y sin nada guardado se ve la ventana del General —ni nota de bienvenida ni contexto
  vacío—, decidido con el usuario el 2026-09-29.

→ `ARCHITECTURE.md` §9.7

---

## Ideas aparcadas

Lo que se contempló y no se eligió. Cada una con **qué haría falta para que mereciera la
pena**: esa última parte es la que evita volver a discutirlo desde cero.

| Idea | Por qué no ahora | Qué la desbloquearía |
|---|---|---|
| **Reordenar y re-anidar líneas** (`move`, y con ella `indent`/`outdent`) | No hay quien lo use: sin gesto de arrastrar, `move` no tiene consumidor, y el Tabulador no existe en un móvil. Hoy una lista se queda en el orden en que se escribió, y arreglarla es borrar y reescribir. | Llegar a la Fase 4 y **echarlo de menos con el editor delante**. Es puramente añadido —no cambia ninguna operación, ni el formato en disco, ni obliga a migrar—, así que cuesta lo mismo entonces que hoy. Ojo a dos cosas ese día: hace falta un cuarto caso de `Position` (`before`, para "la primera del todo"), y `move` **no** puede escribirse como `remove` + `insert` o heredaría la guarda de las casillas con hijas. |
| **Adaptador de MongoDB** | Requiere un backend HTTP propio: el driver de Mongo habla TCP y no funciona desde navegador, y la Data API de Atlas está retirada. | Que hubiera ya un backend propio por otro motivo. Montar uno solo para esto no sale a cuenta. |
| **Adaptador de Google Drive** | Escribir **siempre** exige OAuth (scope `drive.file`), aunque la carpeta sea pública. Eso arrastra registro de app, PKCE y gestión de tokens. | Querer de verdad sincronizar entre dispositivos, y aceptar el coste de OAuth. Antes tendría que estar cerrado el `BlobStore`. |
| **`CompositeStorage` y outbox durable** | Sin consumidor mientras haya un solo backend. La semántica (local primario + réplicas con reintentos) ya está decidida. | Que exista un segundo backend real. Ni un día antes: es infraestructura para un problema que aún no se tiene. |
| **`storageTarget` por contexto** (enrutar notas privadas a un backend concreto) | Presupone varios backends, que no existen. | Lo mismo que el anterior, más una necesidad real de separar notas por destino. |
| **Cambiar `LocalStorageBlobStore` por IndexedDB**, o por una base ligera (SQLite compilado a wasm, o similar) | Como tecnología, IndexedDB gana casi en todo —cuota de cientos de MB frente a ~5 MB, `Uint8Array` nativo frente al base64 que cuesta un 33% más, asíncrona de verdad cuando el puerto ya es `async`—, y aun así no compensa, por tres motivos. **(1) El hueco ya está ocupado:** "almacén grande, privado del origen, sin diálogo y con bytes nativos" es **OPFS**, que ya está construido y es el mismo `DirectoryHandleBlobStore` con otro handle. Un `IndexedDbBlobStore` sería una cuarta implementación duplicando a una existente, en el mismo *bucket* de cuota. **(2) El valor de `localStorage` aquí no es guardar, es que se puede falsear honradamente en Node**: Node no tiene ninguna de las dos, y el `Storage` falso son **52 líneas que además saben lanzar la excepción de cuota**. De ahí cuelga **la tercera pasada de la suite de contratos** (§6.3), la que monta la pila entera sobre un `BlobStore` de producción y que se ganó el sitio cazando fallos que las otras dos no veían (5 de 7 y 3 de 6, medidos). Falsear IndexedDB no son 52 líneas; sería `fake-indexeddb` —una dependencia, contra la política— o quedarse sin esa pasada. **(3) Una base ligera no es un `BlobStore` siquiera:** sustituiría a `StorageAdapter` entero, y choca de frente con el formato en disco de §6.2 y con "un fichero por entidad", que es decisión cerrada. Además arrastra ~1 MB de wasm en un proyecto de cero dependencias de runtime. | Que los ~5 MB **aprieten de verdad** — y ese día la respuesta sigue siendo **OPFS primero**, que no cuesta código. O que aparezca una necesidad que sólo una base cubre: consultas por contenido, índices, búsqueda de texto completo. Nada de eso tiene consumidor mientras `getAll` sea N lecturas al arrancar. **No confundir con lo que sí está planificado:** IndexedDB **entrará** para **guardar el handle de la carpeta** (§6.1) y hacer posible el botón de "reconectar carpeta"; eso no es esta idea y no está aparcado. *(Aquí decía «entra en la Fase 4»; desde el 2026-09-20 la carpeta del usuario como destino está fuera de la Fase 4, así que entra el día que lo haga ella.)* Verificado el 2026-09-13 en el andamio de la verificación manual: el handle vuelve tras recargar, con el permiso intacto y sin diálogo. |
| **Replantear los efectos que no devuelven nada en clave más funcional** (el `Listener` del `Store` como flujo, `Cancel`/`Unsubscribe` con ámbito) | Salió de un inventario de **todas las funciones que devuelven `void`** en `src/core` y `src/storage`, hecho el 2026-09-19. **Ese inventario ya dio un arreglo real y está construido**: los casos de uso devolvían `void` y ahora devuelven la entidad o `null`. Lo que queda no es el mismo caso, y el criterio que los separa es el que hay que conservar: **¿la vuelta llevaría información que NO se deduce de los argumentos?** `dispatch(action)` no se deducía —lo decide el reducer—, y por eso valía la pena. `setItem(k, v)` se deduce entero: después de eso `k` vale `v`, así que devolver algo sería devolverle al llamante lo que él trajo. `clearTimeout` deja un solo bit —«¿seguía pendiente?»— que **ningún** sitio de los tres que cancelan miraría. **Y la reformulación buena no es cambiar retornos, son otras dos, las dos con su pega: (1) el `Listener` como flujo de estados**, con el write-behind convertido en un `scan` en vez de un objeto con cuatro variables mutables — pero eso **no elimina el `void`, lo centraliza**, y el `Store` ya tiene esa propiedad por otro camino («la única mutación del proyecto»); además construir el flujo a mano choca con cero dependencias y `rxjs` es justo lo que no se instala aquí. **(2) `Cancel` y `Unsubscribe` con adquirir-y-liberar por ámbito**, que es la forma funcional de un recurso — pero **no encaja con el debounce**, que necesita cancelar y reprogramar desde fuera en cada tecla: la vida de ese temporizador no es un bloque, es una carrera contra la siguiente pulsación. | **La Fase 4**, y en concreto el punto en que haya **dos suscriptores** (la UI y la persistencia) en vez de uno: es cuando un flujo empieza a pagar y se puede decidir con el caso delante. Ese día hay que resolver antes lo de cero dependencias. ⚠️ **Desde la Fase 4 hay dos suscriptores** —la UI y el write-behind— y esto **no se ha reabierto**: la UI se escribió con el `Listener` tal cual. **No confundir con el caso que quedaba vivo del mismo inventario:** el `void flush()` del write-behind, donde el error del flush automático no lo veía nadie — no se arreglaba con un retorno porque **no hay quien llame, es un temporizador**, y su arreglo fue el `onError`, **hecho en la Fase 4** (`f406d96`). |
| **El editor de grafos de los Planes** — *desde el 2026-09-27, tiene fase: la 5* | Los tipos de `Plan` están, pero no hay ni una operación. Es una app dentro de la app, y el boceto del usuario dice él mismo que aún no sabe cómo plantear la interfaz de los diagramas. | **Que cierre la Fase 4**: entonces se planifica la 5. Ya no es una idea sin dueño, pero se deja aquí porque sigue sin diseño. Anotado: si llega, `Plan.nodes` probablemente deba pasar de array a `Record`, porque las aristas se guardan por id y con array toda búsqueda es lineal. |
| **Shells de escritorio y móvil (Tauri / Capacitor)** | Envuelven el output del build web. Ese build existe desde la Fase 4 (`npm run build:web`, a `dist/web/`), pero la fase no está cerrada. | Una Fase 4 terminada. Y ese es el momento de reconsiderar los workspaces de npm, no antes. |
| **Sync entre dispositivos, CRDTs, colaboración en tiempo real** | Salto enorme de complejidad. `revision` ya deja la puerta abierta a detectar conflictos, que es el 10% que sí hacía falta desde el principio. | Uso real en dos dispositivos y una política de conflictos elegida a conciencia. "Gana el último" ya está descartada. |
| **Un runner de navegador para las pruebas** (Playwright o similar) | Lo único que no se puede probar en Node es un fichero —`DirectoryHandleBlobStore`, 156 líneas de código— cuya parte larga es un clasificador de excepciones: probarlo con un doble es comprobar lo que uno *cree* que lanza la API. Y se ejercita solo cada vez que alguien usa la app. A cambio: cientos de megas frente a los 27 MB de hoy, y una cadena de herramientas más que mantener. | Que aparezca un **segundo** `BlobStore` sobre navegador con lógica de verdad —el de Drive, con su OAuth y sus reintentos— o que ese fichero dé más de un sobresalto. Ese día se instala **sólo para esa fase**, coherente con la política de dependencias. |
| **Migrar de webpack a Vite** | ⚠️ **Superada el 2026-09-27:** webpack ya **no** es el bundler previsto para la Fase 4 — la fase arranca con el `importmap`, sin bundler. La elección entre bundlers no afecta a la arquitectura, así que no urge. | Que algo concreto exija un bundler. Ese día se comparan los que haya, no sólo estos dos; y se reinstala **sólo** el elegido. |
| **Las ventanas como entidad del core** (la opción B de `ARCHITECTURE.md` §7.4: algo como `Layout`, en su fichero junto a las notas) | Es la opción más limpia —una sola fuente, viaja con las notas, el reducer vigila la integridad—, pero reabre `StorageAdapter`, la suite de contratos, `FileStorageAdapter` y el catálogo de acciones, todo cerrado. Se eligió la C (`localStorage`) para salir del paso. | Que lleguen las **entidades «meta» de UX/UI** al core, que el usuario prevé; o que duela de verdad que las ventanas no viajen con las notas (un cambio de destino o de dispositivo). Ese día la guarda de la presentación se sustituye por la integridad del reducer. |
| **Revisar `Context.defaultView`** (y su acción `set-default-view`) | Se queda sin consumidor en la Fase 4: «abrir directamente una nota» lo hace ahora una ventana de tipo nota. No se quita porque el dominio está cerrado y quitarlo toca modelo, reducer, pruebas y formato en disco por algo que no molesta. | Lo mismo que la fila anterior: cuando lleguen las entidades «meta» de UX. Ahí se decide si se elimina o si recupera un sentido. |
| **Tres candidatas más para la barra de modo**: «al marcar una casilla, marcar también sus hijas», «esconder las marcadas», «mandar las marcadas al final» | Fuera de la Fase 4. Cumplen la regla de la barra (`ARCHITECTURE.md` §7.2), pero nadie las ha echado de menos todavía con un editor delante. | El mismo disparador que las tres preguntas de §9.10: **si usando el editor se echan en falta**, se reabren. La primera es además donde se compondría la cascada de `setChecked`, que irá plegada en una sola acción (§9.3). |
| **Un botón «reintentar» en el aviso de `onError`** | Con `localStorage` como destino no hay nada que reanudar, y está cerrado que un write-behind detenido no se reanuda. El aviso sólo informa. | Que el destino sea **la carpeta del usuario**: ahí reanudar sí significa algo —volver a pedir la carpeta— y va con el botón de «reconectar carpeta» (§6.1, §6.5). |
| **Prototipo desechable del editor** (solo DOM, sin core y sin persistencia) | Es trabajo que se tira. ⚠️ **Matizada el 2026-09-20**, al plantearse hacerlo en una carpeta `/frontend-temporal`: lo desechable no sale gratis aquí. `src/scripts/` fue la prueba —el prototipo viejo siguió en el repo sin construirse hasta la Fase 4, y `CLAUDE.md` gastaba un párrafo por sesión diciendo que no se imitara—, y para arrancar cualquier cosa hacen falta `Clock`, `IdGenerator` y un arranque, que **son** `src/platform/`, o sea Fase 4 literal: se escribirían para tirarlos y se reescribirían igual. | **Partida en dos, que es lo que la resuelve.** *(a)* Para «¿encaja la pila entera?» un **script de Node** de ~100 líneas, sin navegador, ejecutable ya con `node --conditions=compiled`: ése sí es desechable de verdad. *(b)* Para «¿cómo se siente escribir?» **no vale código de usar y tirar**, porque lo que se descubre son las tres preguntas de §9.10 y una respuesta obtenida con un juguete no cierra ninguna. Eso es el editor de Fase 4 · Notas, feo al principio pero en `src/ui/` y `src/platform/`. *(Hasta el 2026-09-27 decía «la primera rebanada vertical de la Fase 4»; desde que la fase se parte, esa rebanada es la de Contextos y no toca el editor.)* |
| **Tailwind, o cualquier CSS que pida compilación** (UnoCSS, Sass, CSS Modules) | Preguntado el 2026-10-03. Pide un paso de compilación y una dependencia, **duplica** las variables CSS que ya llevan los colores en claro y oscuro, y mete el estilo en el TypeScript (`className = "…"` con quince clases). Sass y CSS Modules, compilación también, y el anidamiento ya es nativo. Se hizo lo contrario: CSS nativo partido por vista en `src/ui/styles/`. | Que el CSS crezca hasta que **los choques de cascada** entre ficheros se vuelvan inmanejables, o que haya un equipo diseñando muchas pantallas. Ese día se mira primero **`@layer` por vista**, que es nativo. |
| **Snabbdom, o cualquier DOM virtual mínimo** | Preguntado el 2026-09-20. Es el **único candidato honesto** de todos los que se plantearon, porque aporta sólo *diffing* (~3 KB) y no duplica nada: el estado ya está resuelto. Aun así no ahora, y el motivo es el mismo que hace difícil a esta app — lo que describe §7, *reconciliar por `data-id`* y **saltarse el nodo enfocado**, es un vdom a mano recortado alrededor de la única excepción que un vdom genérico expresa mal. Daría el 90% y habría que pelearse con él justo en el 10% que decide si la app se siente bien. Sería además la **primera dependencia de runtime** del proyecto. | **Cambiado con el usuario el 2026-10-03: ya no cuenta el tamaño, cuentan los fallos.** Se reabre cuando aparezcan **fallos de sincronizar el DOM** —un dato que cambia y no se repinta, un nodo que se repinta de más, una lista que se desordena al repintar—, que son los que el *diffing* evita. El tamaño (~600 líneas) se descartó como disparador: se pasó sin que saliera ni un fallo de ésos. ⚠️ Ese día se evalúa **Snabbdom, no React ni Svelte ni Angular**: los frameworks traen estado, y el estado ya está construido. |
| **Un motor de edición** (ProseMirror, Lexical, CodeMirror) | Preguntado el 2026-09-20, y es **lo único que ahorraría semanas de verdad**: resuelven cursor, selección, deshacer y anidamiento, que es literalmente la Fase 4. Por eso mismo es lo más caro: **traen su propio modelo de documento**. `Note`, `Content`, las ocho operaciones, la lógica del editor de `src/ui/` y buena parte de las pruebas pasarían a ser redundantes. No complementan el core, **lo sustituyen**. | Querer **texto rico** — negritas, enlaces, tablas. Hoy `Content` es `Text \| CheckBox` con cadenas planas y no hay nada que ganar. Ese día la pregunta ya no es «qué librería de vistas», es **«¿se rehace el núcleo?»**, y es una decisión de otro tamaño: conviene no llegar a ella por accidente, añadiendo formato poco a poco. |
| **Un framework con estado dentro** (React, Angular, Svelte, Redux) · **htmx** | Preguntados el 2026-09-20 y descartados en bloque, para no volver a discutirlos de uno en uno. **Redux ya está construido**: `Store.ts` son 65 líneas con `getState`/`dispatch`/`subscribe` sobre un reducer puro, más lo que Redux no da —la invariante de identidad, en `if (next === state) return`—. **React** es débil exactamente donde esta app es difícil: el vdom y `contenteditable` se llevan mal porque el navegador muta el DOM mientras se escribe (Facebook abandonó Draft.js; ProseMirror, CodeMirror y Lexical gestionan el DOM ellos mismos), así que §7 obligaría a salirse de React justo en el componente que importa. **Angular** es de otra escala. **Svelte** es el mejor de los cuatro, pero sus *stores* compiten con el `Store` que ya existe y exige compilador. **htmx** es de otro paradigma: vive de que un servidor devuelva HTML, y esta app no tiene servidor. | Nada previsible. Si algún día se reabre, se reabre por la fila de **Snabbdom** —diffing sin estado—, que es la única necesidad real que podría aparecer. |
