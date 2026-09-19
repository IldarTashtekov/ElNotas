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
      estado de `ModosEscritura`. Su **único consumidor es `insert`**. `before`,
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
      implementaciones, a propósito: vivirían en `src/platform/`, que no nace hasta la Fase 4,
      y una prueba se fabrica su reloj en una línea. `IdGenerator` devuelve un `string` pelado
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

**Lo que queda vivo de esta fase y va a la Fase 4**, anotado y no arreglado: el `onError` del
write-behind, el `onCorrupt` de `getAll` —hoy **una nota corrupta impide abrir la app**— y la
validación de esquema al leer del disco. Los tres tienen su casilla aquí abajo.

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
        Hoy son **ocho `try` y cero `throw`**.

      **Lo que NO se tocó, y así sigue:** que `get` de algo que no está guardado devuelva
      `ok(null)`, y que borrar lo que no existe no sea un error. **Ausencia no es fallo**, y
      ahora son además dos casos del contrato.

- [ ] **Un `onError` para el write-behind, aplazado a la Fase 4.** El agujero es concreto:
      cuando falla un flush **automático** —el del temporizador— **nadie mira su resultado**, así
      que entre el fallo y la siguiente llamada manual a `flush()` no se entera nadie. Lo que
      falta es un `onError?: (e: StorageError) => void` en `WriteBehindDeps`, que se llame cuando
      el escritor se detiene: unas cinco líneas y una prueba.
      **Por qué no ahora:** no hay UI a la que avisar, y aquí no se construye lo que no tiene
      consumidor — la misma regla que quitó `move` y el puerto `Scheduler`.
      **Qué lo desbloquea:** la Fase 4, que es cuando hay a quién avisar. Va en el mismo paquete
      que el botón de "reconectar carpeta": **no se puede reanudar un escritor detenido**, y
      reanudarlo significa volver a pedir la carpeta, que es plataforma. Hoy, en consecuencia, un
      `permission-denied` deja el escritor muerto para el resto de la sesión.

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
  - **⚠️ Un fichero corrupto tumba el `getAll` entero**, lo que **contradice a §6.5**. Decidido
    aceptarlo y aplazar el arreglo a la Fase 4 — la casilla del `onCorrupt`, justo aquí abajo.

- [ ] **Un `onCorrupt` para `FileStorageAdapter`, aplazado a la Fase 4.** Va en el mismo paquete
      que el `onError` de arriba, y por el mismo motivo. **El agujero es concreto y hoy está
      vivo:** `getAll` corta al primer fichero ilegible, así que **una sola nota corrupta impide
      abrir la app** — justo el «creer que las has perdido todas» que la taxonomía de §6.5 existe
      para evitar, y que esa misma sección promete resolver aislando la entidad.
      Lo que falta es un `onCorrupt?: (e: StorageError) => void` en las dependencias del
      adaptador: saltar esa entidad y avisar de cuál.
      **Por qué no ahora, y por qué no de otra forma:** saltársela **en silencio** es peor que el
      fallo actual —deja `ItemRef` colgando y, sobre todo, el write-behind vería esa nota como
      borrada y acabaría limpiándola de los contextos, convirtiendo un fichero recuperable en una
      pérdida de verdad—; y cambiar la firma de `getAll` es deshacer lo que el paso 0 acaba de
      estabilizar, ahora con un adaptador escrito encima.
      **Qué lo desbloquea:** la Fase 4, que es cuando hay a quién avisar.
      La prueba que fija el comportamiento de hoy está marcada con ⚠️ en
      `FileStorageAdapter.errors.test.ts`, para que el cambio se vea en el diff.
      → `ARCHITECTURE.md` §6.5.

- [ ] **Validar el esquema de lo que se lee del disco.** Hoy, al leer una entidad sólo se
      comprueba que lo parseado sea **un objeto con un `id` de texto**. Un `notes/x.json` con un
      `content` inventado se acepta y entra en `AppState` tal cual.
      **Por qué no se hizo de paso:** validar campo a campo **es un validador, no una frontera**,
      no hay hoy en el repo nada que lo haga, y escribirlo a mano para tres entidades con
      contenido recursivo es una pieza con entidad propia — no un `if` más dentro de `parsear`.
      **Qué hay que decidir el día que se haga:** si se escribe a mano o si es el primer caso que
      justifica una dependencia (y entonces, la política de dependencias manda comprobar antes si
      Node o TypeScript ya lo hacen). → `ARCHITECTURE.md` §6.2.

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

      **Qué lo desbloquea:** cualquier trabajo de la Fase 4 que abra ese fichero de todas
      formas — el botón de «reconectar carpeta», el `onError` o el `onCorrupt`, que pasan los
      tres por aquí. Ese día la lista se repasa igualmente y este refactor viaja gratis.
      **Mientras tanto, y cuesta cero:** el daño de hoy no es el código muerto sino que el
      comentario **miente** y alguien se lo va a creer. Eso se tapa sin tocar el fichero, con
      una línea en la decisión cerrada de `CLAUDE.md` sobre declarar tipos de plataforma a mano
      —que es donde mira quien se plantee declarar otro— diciendo que el que hay ya es un caso
      de eso y está aquí anotado.

### Infraestructura (`infra-agent`)

Todas son de `src/`, `package.json` o los tsconfig, así que **no las toca el rol de
documentación**.

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
      la inferencia lo absorba en silencio.
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
    apoya en evidencia, no en criterio. **Si un cambio futuro mueve un solo byte del emitido,
    la excepción no vale y la lista se repasa.**
  - **Las tres excepciones viejas se confirman tal cual:** la constante que **es** una función
    —se anotan sus parámetros y su retorno, no la constante—, el `as const` de
    `src/core/app/diffState.ts:52` y los dos destructuring de `src/core/app/reduce.ts:227`
    y `:267`.
  - [ ] **Las pruebas — 942 anotaciones** (423 variables, 412 retornos, 107 parámetros),
        **deuda aceptada a sabiendas y no un olvido.** Es trabajo mecánico que no arregla ni
        caza ningún fallo, y el diff sería irrevisable. **Lo que se escriba o se toque en
        `test/` a partir de ahora sí cumple la regla**, que es lo que impide que esto crezca.
  - ~~*(Opcional)* **Un guardián en `tools/`** que sostuviera esta regla~~ — ❌ **DESCARTADO, y
        el motivo vale como criterio para la próxima vez que alguien proponga un guardián.**

        Esta regla **no caza ni un solo fallo**. El compilador ya dice si un tipo está mal; lo
        único que añade la anotación es que **un cambio de tipo se vea en el diff** en vez de
        que la inferencia se lo trague. Es legibilidad, no corrección.

        Y eso la pone en otra liga que los cuatro guardianes que sí existen. Compáralas por lo
        que pasa **si se rompe la regla**:

        | Guardián | Qué pasa si se incumple |
        |---|---|
        | `typecheck:core` | el core toca plataforma y deja de ser portable |
        | `check:purity` | el core lee el reloj → las pruebas dejan de ser deterministas |
        | `require-tests` | `npm test` pasa en verde **sin ejecutar nada** |
        | `check:fronteras` | una excepción se escapa por una firma que prometía `Result` |
        | *(el de tipos)* | **un diff se lee peor** |

        Los cuatro primeros tapan agujeros donde algo **funciona mal en silencio**. Éste tapa
        una molestia de revisión, y un script en `npm run check` para eso es maquinaria de más.
        **La regla se queda** —está en `CLAUDE.md` y se aplica al escribir—; lo que se descarta
        es comprobarla automáticamente.

        *(Si alguna vez se reabre: se hace recorriendo el AST con `ts.createSourceFile` y
        `ts.forEachChild`, mirando `VariableDeclaration` sin `type` y los `parameters`/`type` de
        cada función, saltándose las cuatro excepciones y mirando sólo `src/`. Está probado. Pero
        el motivo de arriba no cambia por que sea fácil de escribir.)*

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
      ejecutándose de verdad. Hoy van 314.
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

### Del editor (Fase 4)

No bloquean nada de la Fase 1, pero salieron al diseñar `ModosEscritura` y se pierden si no se
apuntan.

- **El escalón infinito en modo *Casilla hija*.** Si cada Intro creara una hija de la línea
  actual, irías bajando un nivel por pulsación y **sin `outdent` no habría forma de subir**.
  La regla tiene que ser que el modo baje un nivel **una sola vez**, y de ahí en adelante las
  siguientes sean hermanas en ese nivel. Falta confirmarlo.
- **Cómo se baja un segundo nivel.** Con el ciclo actual (*Texto → Casilla → Casilla hija →
  Texto*) hacen falta tres pulsaciones del botón para volver a *Casilla hija*. Si se quiere
  anidar con soltura, hay que replantear el ciclo.
- **Las cuatro esquinas del teclado propuestas en `ARCHITECTURE.md` §7.3** y sin confirmar:
  cursor al final al pulsar el botón de modo · volver de *Casilla* a *Texto* con el botón ·
  unir dos textos normales sin casilla de por medio · partir una casilla que tiene hijas.
- **El identificador de `ModosEscritura` en el código.** El concepto se llama así; el nombre
  en el código está sin fijar, porque todo lo demás está en inglés (`WritingMode`, y en
  singular). O se cambia la convención a conciencia y para todo. → `ARCHITECTURE.md` §7.2

### Escritura condicional y conflicto entre dos pestañas

**Abierta a conciencia, no por olvido.** Salió al cerrar la taxonomía de `StorageError` (§6.5) y
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
mecanismo funciona.

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
Queda pendiente **corregir el comentario de `AppState.ts`**, que hoy dice que falta ahí.
→ `ARCHITECTURE.md` §9.7

### ~~El arranque de la app no tiene fase asignada~~ — ✅ **cerrada: tenía dos**

Por eso no encajaba en ninguna. **Se parte**, por la misma costura que el write-behind:

- **la parte pura, en la Fase 2** — `hydrate(entidades) → AppState` y el runner de migraciones.
  De datos a datos: se prueban sin navegador y sin temporizadores.
- **la parte impura, en la Fase 4** — quién abre el storage y en qué orden, y qué se le enseña
  al usuario si no hay nada guardado (¿nota de bienvenida? ¿contexto vacío?). Eso es
  composición y decisión de producto, y vive en `platform/web/`, que no nace hasta entonces.

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
| **Cambiar `LocalStorageBlobStore` por IndexedDB**, o por una base ligera (SQLite compilado a wasm, o similar) | Como tecnología, IndexedDB gana casi en todo —cuota de cientos de MB frente a ~5 MB, `Uint8Array` nativo frente al base64 que cuesta un 33% más, asíncrona de verdad cuando el puerto ya es `async`—, y aun así no compensa, por tres motivos. **(1) El hueco ya está ocupado:** "almacén grande, privado del origen, sin diálogo y con bytes nativos" es **OPFS**, que ya está construido y es el mismo `DirectoryHandleBlobStore` con otro handle. Un `IndexedDbBlobStore` sería una cuarta implementación duplicando a una existente, en el mismo *bucket* de cuota. **(2) El valor de `localStorage` aquí no es guardar, es que se puede falsear honradamente en Node**: Node no tiene ninguna de las dos, y el `Storage` falso son **52 líneas que además saben lanzar la excepción de cuota**. De ahí cuelga **la tercera pasada de la suite de contratos** (§6.3), la que monta la pila entera sobre un `BlobStore` de producción y que se ganó el sitio cazando fallos que las otras dos no veían (5 de 7 y 3 de 6, medidos). Falsear IndexedDB no son 52 líneas; sería `fake-indexeddb` —una dependencia, contra la política— o quedarse sin esa pasada. **(3) Una base ligera no es un `BlobStore` siquiera:** sustituiría a `StorageAdapter` entero, y choca de frente con el formato en disco de §6.2 y con "un fichero por entidad", que es decisión cerrada. Además arrastra ~1 MB de wasm en un proyecto de cero dependencias de runtime. | Que los ~5 MB **aprieten de verdad** — y ese día la respuesta sigue siendo **OPFS primero**, que no cuesta código. O que aparezca una necesidad que sólo una base cubre: consultas por contenido, índices, búsqueda de texto completo. Nada de eso tiene consumidor mientras `getAll` sea N lecturas al arrancar. **No confundir con lo que sí está planificado:** IndexedDB **entra** en la Fase 4, pero para **guardar el handle de la carpeta** (§6.1) y hacer posible el botón de "reconectar carpeta"; eso no es esta idea y no está aparcado. Verificado el 2026-09-13 en el andamio de la verificación manual: el handle vuelve tras recargar, con el permiso intacto y sin diálogo. |
| **El editor de grafos de los Planes** | Los tipos de `Plan` están, pero no hay ni una operación. Es una app dentro de la app. | Que la parte de Notas esté terminada y en uso. Anotado: si llega, `Plan.nodes` probablemente deba pasar de array a `Record`, porque las aristas se guardan por id y con array toda búsqueda es lineal. |
| **Shells de escritorio y móvil (Tauri / Capacitor)** | Envuelven el output del build web; no hay build web todavía. | Una Fase 4 terminada. Y ese es el momento de reconsiderar los workspaces de npm, no antes. |
| **Sync entre dispositivos, CRDTs, colaboración en tiempo real** | Salto enorme de complejidad. `revision` ya deja la puerta abierta a detectar conflictos, que es el 10% que sí hacía falta desde el principio. | Uso real en dos dispositivos y una política de conflictos elegida a conciencia. "Gana el último" ya está descartada. |
| **Un runner de navegador para las pruebas** (Playwright o similar) | Lo único que no se puede probar en Node es un fichero —`DirectoryHandleBlobStore`, 156 líneas de código— cuya parte larga es un clasificador de excepciones: probarlo con un doble es comprobar lo que uno *cree* que lanza la API. Y se ejercita solo cada vez que alguien usa la app. A cambio: cientos de megas frente a los 27 MB de hoy, y una cadena de herramientas más que mantener. | Que aparezca un **segundo** `BlobStore` sobre navegador con lógica de verdad —el de Drive, con su OAuth y sus reintentos— o que ese fichero dé más de un sobresalto. Ese día se instala **sólo para esa fase**, coherente con la política de dependencias. |
| **Migrar de webpack a Vite** | Webpack sigue siendo el bundler previsto para la Fase 4, hoy desinstalado. Migrar **no afecta a la arquitectura**, así que no urge. | Llegar a la Fase 4 y comparar los dos entonces. Está fuera de "decisiones cerradas" a propósito: es una opción abierta, no un compromiso. |
| **Prototipo desechable del editor** (solo DOM, sin core y sin persistencia) | Es trabajo que se tira. | Nada: **puede que merezca la pena ya.** El editor con `contenteditable` es la parte más difícil del proyecto, está **al final del plan** y es la única sin verificación automática posible. Un prototipo de un rato responde pronto a la pregunta que más riesgo esconde: ¿aguanta en la práctica la regla de que "el nodo enfocado no se re-renderiza"? Si no aguanta, es mejor saberlo antes de construir tres fases encima. |
