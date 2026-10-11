# Tareas de ElNotas

Qué está pendiente, qué está sin decidir y qué ideas hay aparcadas. El diseño y sus por qués
están en `ARCHITECTURE.md`; las reglas para agentes, en `CLAUDE.md`.

**La disciplina que mantiene vivo este fichero: cada entrada tiene que ser cerrable.**
"Mejorar la UI" no se cierra nunca y no entra aquí. "Que `npm test` falle sin ficheros de
test" sí. Si una entrada no se puede marcar como hecha, o está mal escrita o es una idea
aparcada.

---

## Pendiente

Las fases cerradas van **resumidas**: qué se hizo, cuándo y con cuántas pruebas, la deuda si la
hubo y sus commits clave, para leer la historia de corrido. La crónica entera está en `git log`;
el diseño y sus porqués, en `ARCHITECTURE.md`.

### Fase 1 — Dominio puro ✅ TERMINADA

El helper de copia por camino en sus dos primitivas (`updateContent.ts`, `updateContainerOf.ts`),
`Position` con sus tres casos, **las ocho operaciones de contenido** —fuera `indent`, `outdent` y
`move`—, los puertos `Clock` e `IdGenerator` (sólo interfaces) y la rebanada vertical (`Action`,
`reduce`, `Store`, `createUseCases`), que demostró que **tres despachos redundantes dan un solo
aviso** y no tocan `updatedAt`. Cada fila de no-op de §9.3 con su prueba `strictEqual`, y cada
guarda rota a propósito. **Cerrada el 2026-09-06 con 99 pruebas**, sin deuda.
Commits clave: `475a585` (`npm test` deja de poder pasar en falso), `286e297` (el helper),
`26ed57a` (la primitiva B), `e1d5f7f` (`Position`), `9a6feee` (las ocho), `3a7f718` (los puertos),
`2abaaaf` (`check:purity`), `53cf667` (la rebanada).

### Fase 2 — Acciones, persistencia y memory ✅ TERMINADA

**De abajo arriba**: la persistencia entera primero —los tres puertos, `MemoryStorageAdapter` con
la suite de contratos y el write-behind en dos piezas (`diffState` y `writeBehind`)—, la prueba de
la cadena entera (un `set-checked` redundante **no llega a disco**), y sólo después las acciones:
**diecisiete**, no dieciséis como se planeó —el error lo cazó la prueba de los casos de uso, que
no estaba en el plan—. Más `schemaVersion`, el runner de migraciones (`MIGRATIONS` vacía) y
`hydrate`. **Cerrada el 2026-09-12 con 216 pruebas**, sin deuda. Tres cosas de diseño que salieron
al hacerla y no están en `ARCHITECTURE.md`: el diff se calcula **contra lo último escrito**, no
contra el aviso anterior, así que una nota creada y borrada en la misma ráfaga no llega nunca a
disco; **una copia equivalente SÍ cuenta como cambio** (hay una prueba que lo fija, para que nadie
compare por valor); y `migrations` y `target` se inyectan para poder probar los caminos de
encadenar y de «falta una migración», inalcanzables mientras `CURRENT_SCHEMA_VERSION` valga 1.
Commits clave: `0591435` (memoria y write-behind), `0f128cb` (el catálogo de acciones),
`ddbaf6d` (migraciones e hidratación), `e492775` (la capa de casos de uso, y eran diecisiete).

### Fase 3 — Fichero local ✅ TERMINADA

Primero **el paso 0**: `Result<T, E>` y las dos taxonomías de error en `domain/errors/`, los
puertos y `runMigrations` sin un `throw`, y el write-behind con su estado *detenido*. Luego
`FileStorageAdapter` (formato de §6.2), que pasa la suite de contratos **sin tocarla**, las dos
implementaciones de `BlobStore` y una **tercera pasada** del contrato sobre `LocalStorageBlobStore`
real, que no estaba prevista y cazó fallos que las otras dos no veían. `check:fronteras` nació de
dos fugas reales —`encodeURIComponent` en `caminoDe` y `paso.migrate()`— que un guardián de
«ningún `throw`» habría dejado pasar. La lista manual de `DirectoryHandleBlobStore` se pasó el
**2026-09-13** sobre `dec4306` con el árbol sucio (Brave, las cinco secciones; Firefox, sólo
OPFS), usando `find` y `stat` como oráculo y no el explorador. **Cerrada con 314 pruebas.** Lo que
dejó para la Fase 4 —`onError`, `onCorrupt` y la validación de esquema— se hizo allí (`f406d96`,
`473f566`, `8e2dba3`).
Commits clave: `d198aaa` (se verifica a mano), `8d05bd9` (el paso 0, planteado), `bab97bb` (el
fichero local y los errores como valores), `61fe72a` (las pruebas a `test/`), `562c086` (las dos
fugas y `check:fronteras`), `f34d7c9` (la fase, TERMINADA).

**Pendiente de la fase:**

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

Sólo web, partida en **Fase 4 · Contextos** y **Fase 4 · Notas** (§9.10). Nacen
`src/platform/web/` —`SystemClock`, `CryptoIdGenerator`, `boot`, la lista de ventanas en
`localStorage`— y `src/ui/`: las vistas ventanas, configuración y nota, la lista de un contexto
con selección y «Mover a…», la reconciliación por clave, el editor con casillas anidadas y los
bordes del teclado, `onCorrupt`, `onError` y la validación de esquema; sale el prototipo viejo
(`cdfb816`). **Ningún paquete nuevo.** El código acabó el 2026-09-29 con **489 pruebas** (423 al
terminar Contextos); el 2026-10-03 entraron, a petición del usuario, la regla nueva de `merge`,
conservar las referencias a lo ilegible, la escritura condicional y las ventanas con «+» y fichas
que se arrastran. **Cerrada con 532 pruebas y deuda**: las dos listas manuales y las tres
preguntas del editor. **Las listas, dadas por pasadas por el usuario el 2026-10-10** tras probar
la app instalada, sin anotar paso a paso; **quedan las tres preguntas**, abajo.
Commits clave: `473f566` (la rebanada vertical), `8b96c70` (la lista de ventanas), `296dd1b` (la
reconciliación), `9fab349` (el editor en pantalla), `56d838c` (el `set-checked` redundante no toca
el DOM), `f406d96` (`onError`), `935de4e` (la escritura condicional), `38b583d` (el cierre).

**Pendiente de la fase:**

- [ ] **Contestar por escrito las tres preguntas de §9.10** —`move`, `indent`/`outdent`, y si el
      disparador de anidar se entiende solo— **después de usar la app de verdad varios días**,
      no tras una demo. Un «no se aguanta» reabre la decisión correspondiente, y es un resultado
      válido. **Sin contestar el 2026-09-29, y sigue pendiente el 2026-10-03.**
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
      tercio. **En notas, unas 4.000** de un título y seis líneas (~1.300 caracteres cada una),
      estimado el 2026-10-11 en la Fase 7: el techo llega antes que la lentitud. **Y desde el 2026-09-27, un tercer cabo:** la lista de ventanas vive en su propia
      clave de `localStorage`, fuera del almacén, así que **no viaja con las notas** — un cambio
      de destino o de dispositivo la pierde (`ARCHITECTURE.md` §7.4, riesgo aceptado). **Y desde
      el 2026-10-04, un cuarto:** «Borrar todo» vacía las claves `elnotas:` del `localStorage` de
      ese navegador; con otro destino —carpeta, OPFS— **hay que revisar qué borra** y si sigue
      teniendo sentido en dos tiempos (`ARCHITECTURE.md` §7.4). **Y desde el 2026-10-08, un
      quinto:** la app publicada de la Fase 6 es **otro origen** y empieza vacía; no ve lo escrito
      en la red de casa. **El usuario acepta perderlo** (`ARCHITECTURE.md` §9.12).

### Fase 5 — Diagramas ✅ CERRADA el 2026-10-08, con deuda; la deuda, saldada el 2026-10-10

Un lienzo libre con nodos y relaciones, partido en tres (§9.11): **Modelo** —el `Diagram` nuevo,
las trece acciones (17 → 30), los catorce casos de uso y «Nota perdida» en `delete-note` y
`hydrate`—, hecho el 2026-10-03 con **643 pruebas**; **Lienzo** —la vista diagrama, los pósits,
los nodos-nota, «+ Diagrama» y el diagrama como ventana— con **693**; y **Relaciones** —las
líneas, el abanico, conectar, su menú y el texto a lo largo— con **712**, los dos el 2026-10-04.
Después, «Borrar todo» y el «+» azul, pedidos por el usuario: **723 pruebas** al cerrarla.
**Cerrada el 2026-10-08 sin pasar las listas de Lienzo y Relaciones**, para empezar la Fase 6; el
usuario las dio por pasadas el 2026-10-10, con la app instalada y sin anotar paso a paso. El
recorrido conjunto de las listas, `test/ui/VERIFICACION-SENTADA.md`, queda para la próxima vez.
Commits clave: `b14df06` (el modelo), `bb05a0b` (las trece acciones), `a87e012` (el arranque
limpia los diagramas), `57663f2` (la vista diagrama), `1997ace` (los nodos-nota y el nivel extra
de navegación), `7e2ebca` (las relaciones), `4ad85ba` (el texto de las líneas), `c1e86c9` («Borrar
todo»).

**Pendiente de la fase:**

- [ ] **Renombrar `NoteList` (`src/ui/NoteList.ts`, `createNoteList`, `NoteListDeps`)**: desde
      `c8a37db` lista notas **y diagramas**, así que el nombre ya no dice lo que es. Se dejó así
      para no mezclar el cambio de nombre con el de la tarea. *Pedido por el usuario el
      2026-10-04.* El nombre nuevo, por decidir con él.
- [ ] **Manejar el lienzo con teclado.** Pendiente, como reordenar las fichas de ⚙ con teclado:
      el usuario lo dejó para más adelante. No bloquea el cierre de ninguna de las tres partes.
- [ ] **¿Etiquetas de texto junto a los «+»?** Su boceto (el del usuario, 2026-10-04) las lleva.
      **Pregunta abierta al usuario, sin contestar**; hasta que conteste, los botones siguen sin
      texto.

### Fase 6 — PWA: instalar la app en el móvil ✅ CERRADA el 2026-10-10

Que ElNotas se instale en el móvil como una app —icono, pantalla completa, sin conexión,
actualizándose sola—: manifiesto, iconos, *service worker* en `pwa/sw.js`, `npm run build:pages` y
GitHub Pages publicada por GitHub Actions. Las doce decisiones y su porqué, en §9.12. Construida el
2026-10-09 y publicada el 2026-10-10 en **https://ildartashtekov.github.io/ElNotas/**, con **725
pruebas**, sin dependencias nuevas y sin tocar el core. El usuario la instaló, la probó y la dio
por cerrada, **sin anotar paso a paso** su lista (`test/ui/VERIFICACION-MANUAL-PWA.md`); su bloque
F —que se actualice sola en el móvil— no consta que se viera. ⚠️ **El icono parece una ilustración
de otra persona**: si la app se comparte, conviene un dibujo con permiso o propio.
Commits clave: `8f44d2d` (rutas relativas), `d007a3d` (manifiesto e icono), `ccd94c6`
(`build:pages`), `45b6242` (el *service worker*), `7791e24` (`persist()` y la versión), `926b8fd`
(la publicación), `af6dcf4` (la lista manual).

### Fase 7 — Refactor: ajustes de diseño y medir antes de tocar. En curso, planificada el 2026-10-11

**Qué es:** dos cosas. Arreglar lo que molesta al usar la app en el móvil, y revisar lo que se
construyó por adelantado o puede no aguantar el volumen, **con números y no a ojo**. Si al medir
algo resulta que no duele, el punto se cierra sin tocar código. **Negrita, cursiva, tachado y
subrayado NO entran, ni el texto más grande**, por decisión del usuario: están juntos en *Sin
fase asignada*. Reflejada en el plan de `CLAUDE.md` y de `ARCHITECTURE.md` (§9.2) en el pase de
documentación.

#### Ajustes de diseño (pedidos por el usuario el 2026-10-11, con capturas del móvil)

- [x] **La barra de la nota, encima del teclado.** El teclado de Android la tapaba porque Chrome
      no encoge la página al abrirlo. Hecho en el código (`710253a`):
      `interactive-widget=resizes-content` en el `viewport` de `index.html`. La última línea de una
      nota larga no puede quedar bajo la barra: va con `position: sticky` y ocupa su propio sitio,
      no con `fixed`. **Verlo en el móvil, en la última casilla de la fase**; si no basta,
      `visualViewport`.
- [x] **Quitar la L azul en horizontal.** Las barras del móvil, del color del sistema y no uno
      propio: *decidido por el usuario el 2026-10-11*, y revisa el «azul siempre» del 2026-10-09
      (Fase 6). Hecho en el código (`710253a`): fuera la `theme-color` de `index.html` y el
      `theme_color` del manifiesto; el `background_color`, el de la pantalla de carga, sigue azul.
      Es lo único que molesta en horizontal: las franjas a los lados se quedan. **Verlo en el
      móvil, en la última casilla de la fase.**
- [x] **Los puntos del lienzo, a la mitad de intensidad**, sin quitarlos: `--rejilla` en
      `base.css`, `--dim` mezclado al 50 % con transparente, que el lienzo usa en vez de `--dim`.
      Estilo calculado antes y después, en claro y en oscuro: el mismo color con opacidad 0,5, y
      `--dim` sin cambiar en el resto de la app.
- [x] **Los nodos, menos alargados**, no cuadrados: el ancho de `.posit` en `diagrama.css` pasa de
      `10rem` a `8rem`. El otro `10rem` de ese fichero es el campo del texto de una relación, y no
      se toca. Las líneas no dependen del número: miden cada nodo en pantalla (`offsetWidth`).
      Medido antes y después: uno corto pasa de 160 × 39 a 128 × 39 px, y uno de cuatro renglones
      de 160 × 100 a 128 × 121, porque el texto que no cabe a lo ancho crece hacia abajo. Se
      probó `7rem` (112 × 141 el largo) y el usuario prefirió `8rem` por eso.

#### Medir antes de tocar

- [x] **El arranque con muchas notas.** `boot` lo lee todo con `getAll` y guarda el estado entero
      en memoria. ✅ **Medido el 2026-10-11 y cerrado sin tocar código: no duele.** En el
      navegador del panel, en `127.0.0.1` (otro origen, sin tocar los datos de `localhost`), con
      notas sembradas por el adaptador real (título y seis líneas), arrancar y montar el General
      como `main.ts`, mediana de tres:

      | Notas | Leer y montar el estado | Pintar el General |
      |---|---|---|
      | 1.000 | 43 ms | 73 ms |
      | 5.000 | 306 ms | 601 ms |
      | 10.000 | 370 ms | 1.755 ms |
      | 20.000 | 878 ms | 6.387 ms |

      En el móvil, varias veces más lento, sin medir. Dos avisos para el futuro: **pintar la
      lista crece más deprisa que las notas** (el doble de notas, casi cuatro veces el tiempo),
      algo de más en el General que no se buscó porque no duele; y **el techo de `localStorage`
      llega antes**: unas 4.000 notas así (apuntado en la tarea de cambiar de destino, Fase 4).
- [x] **El lienzo con muchos nodos y relaciones.** ✅ **Medido el 2026-10-11, dolía, y optimizado.**
      Abrir un diagrama y mover el corcho iban bien con cualquier tamaño; **arrastrar un nodo
      no**: en cada movimiento se redibujaban TODAS las líneas, y por cada una se alternaba medir
      un pósit y escribir una línea, así que el navegador recalculaba la página una vez por
      línea. Dos cambios en `DiagramCanvas.ts`: arrastrando, **sólo las líneas del nodo**
      (`relationsOf`, pura, en `relationGeometry.ts`, con dos pruebas rotas a propósito); y
      **medir todo primero y escribir después**, con los pósits buscados en una pasada y no uno a
      uno. Al soltar se repinta todo, como antes. En el navegador del panel, `127.0.0.1`,
      diagramas en rejilla con una vez y media tantas relaciones, ratón simulado, mediana:

      | Nodos | Relaciones | Por movimiento, antes | Después |
      |---|---|---|---|
      | 20 | 27 | 8 ms | 1,3 ms |
      | 50 | 70 | 26 ms | 1,3 ms |
      | 200 | 292 | 239 ms | 4,4 ms |
      | 500 | 738 | 1.326 ms | 9,8 ms |

      Comprobado en los cuatro: las líneas que dibuja el arrastre son **idénticas** a las del
      repintado completo al soltar, y sólo se mueven las del nodo. **Falta pasarlo a mano**:
      arrastrar nodos con relaciones en el ordenador y en el móvil (pasos de arrastre de
      `VERIFICACION-MANUAL-LIENZO.md` y `-RELACIONES.md`): en la última casilla de la fase.

#### Documentación

- [x] **Recortar `CLAUDE.md` a las reglas vigentes.** ✅ De **646 a 228 líneas**, sólo reglas
      vigentes; lo que no estaba en `ARCHITECTURE.md` se movió allí, sin perder nada.
- [x] **Adelgazar `ARCHITECTURE.md` y `TAREAS.md`**: quitar duplicados y comprimir las fases
      cerradas. ✅ `ARCHITECTURE.md`, de **4.590 a 3.896 líneas** (sale la crónica de las fases
      cerradas y se queda el diseño, sin renumerar secciones); `TAREAS.md`, de **1.769 a
      543 líneas** (las fases cerradas, resumidas con sus commits clave; las decisiones
      cerradas de *Sin decidir*, en una línea con su sección de `ARCHITECTURE.md`; lo pendiente y
      lo abierto, entero).

#### Para cerrarla

- [ ] **Verlo en el móvil**: la barra con el teclado, la L (publicar y reinstalar) y arrastrar
      nodos con relaciones; con eso se cierra la Fase 7. En detalle: que la barra de la nota quede
      encima del teclado de Android y la última línea no se esconda bajo ella (si no basta,
      `visualViewport`); **publicar, desinstalar y reinstalar**, porque la app instalada saca la
      barra del manifiesto, y comprobar que en horizontal ya no sale la L; y arrastrar nodos con
      relaciones en el ordenador y en el móvil (pasos de arrastre de
      `VERIFICACION-MANUAL-LIENZO.md` y `-RELACIONES.md`).

**Fuera de esta fase, con disparador propio:** revisar los puertos cuando llegue su segundo uso
real (carpeta, OPFS o Drive). Se hace al construir ese adaptador.

### Sin fase asignada

- [ ] **Exportar e importar las notas (JSON).** Fuera de la Fase 6 por decisión del usuario el
      2026-10-08. Hace falta porque las notas viven sólo en el `localStorage` de **un origen**:
      la app publicada es otro origen y empieza vacía, y si se borran los datos de la app a mano
      —o con el «limpiar» de MIUI— se pierde todo. **`persist()` no protege de eso**: sólo impide
      que el navegador borre por su cuenta. Una copia fuera del navegador es lo único que lo cubre.
- [ ] **Pasar de Node 20 a uno con soporte**, en casa y en la receta de publicación
      (`.github/workflows/publicar.yml`) a la vez. Node 20 dejó de tener soporte en abril de 2026;
      la Fase 6 lo dejó en 20 porque es el de casa y con el que pasan las pruebas. Se cierra
      cuando las dos digan lo mismo y `npm run check` siga en verde.
- [ ] **Los colores de la app, repetidos fuera de `base.css`**: el azul `#3552d6` (`--accent`) está
      también en el `background_color` de `manifest.webmanifest` (la pantalla de carga), porque el
      manifiesto no lee variables de CSS. Si cambia `--accent`, hay que cambiarlo a mano. Desde
      el 2026-10-11 es el único sitio: la `theme-color` de `index.html` y el `theme_color` se
      quitaron (Fase 7). Se cierra con una comprobación en `build:pages` que falle si no
      coinciden, o decidiendo con el usuario que se aguanta.
- [ ] **Negrita, cursiva, tachado y subrayado en el editor.** *Pedido por el usuario el
      2026-10-11*, tras usar la app en el móvil. **Fuera de la fase de refactor, por decisión
      suya**: va aparte. Hoy el texto de una línea es una cadena plana en el
      modelo, así que dar formato a un trozo toca el core, el formato en disco con su migración
      y el editor. Queda por decidir con el usuario cómo se guarda el formato y cómo se aplica
      desde la barra (botones, o seleccionar texto antes).
      **Va junto con el texto más grande** (opcional), *decidido por el usuario el 2026-10-11*:
      salió de la Fase 7. Dos caminos, sin elegir: probar antes el escalado de texto de Chrome en
      Android (Accesibilidad), sin código; o un ajuste en ⚙ con tres pasos (100, 115 y 130 %) que
      cambie el tamaño base de la página —crece todo junto, como un zoom—, guardado por
      dispositivo en `localStorage` con su clave `elnotas:`, y con dos fronteras nuevas.

### Infraestructura (`infra-agent`)

Todas son de `src/`, `package.json` o los tsconfig, así que **no las toca el rol de
documentación**.

**Hecho**, una línea por tarea:

- [x] **`npm test` no puede pasar en falso** (`475a585`): `tools/require-tests.mjs` sale con 1 si
      no hay ningún `*.test.js`, y `tools/clean-tmp-test.mjs` vacía `tmp-test/` antes de compilar,
      porque `tsc` no borra lo que sobra y una prueba borrada seguía ejecutándose.
- [x] **`check:purity`** (`2abaaaf`): caza `Date.now()`, `new Date(` y `Math.random()` en el core,
      que **compilan**; no es un `grep`, borra comentarios y cadenas antes de buscar. Aparte, se
      corrigieron los comentarios de `Versioned.ts` y de `src/core/tsconfig.json` que lo negaban.
- [x] **Las pruebas se mudan a `test/`, espejo de `src/`** (`61fe72a`), con las 314 de antes y
      después. Desaparecen tres listas negras y los ayudantes pierden el `.test`. §8.5.
- [x] **Tipo explícito en todo `src/`** (`2f74a06`): el JavaScript emitido salió idéntico, y la
      regla se ensanchó a parámetros y retornos. **La única excepción registrada a «si tocas
      `DirectoryHandleBlobStore.ts` se repasa su lista»:** su emitido salió con el mismo sha256
      (`7342529b…`) y no se repitió. El 2026-09-19 se **amplió**: `removeComments` está en `false`,
      así que un cambio de sólo comentarios mueve el sha256 (`55946a3f…`), y el código con los
      comentarios fuera salió idéntico (`1724398b…`). La excepción es, por tanto, **«mismo código
      una vez quitados los comentarios»**, medido; si se mueve una sola instrucción, la lista se
      repasa.
- [x] **Las cabeceras del código, cortas** (`3135831`, 2026-09-19): de 1035 a 328 líneas en
      `src/`, y las 123 referencias `§` del código, a 0. Tres razonamientos se movieron a
      `ARCHITECTURE.md` en vez de borrarse. La regla, en `CLAUDE.md`; §8.6.
- [x] **`.js` en los imports relativos de `src/` y `check:extensiones`** (`1037ea1`), porque el
      `importmap` sólo resuelve los alias. §8.6.
- [x] **`npm run build:web` e `index.html`** (`473f566`): `src/` a `dist/web/` en ESM, sin bundler.
- [x] **Una declaración sin tipo en `test/ui/editor.test.ts`** *(de `back-dev-agent`)*. ✅ Hecho
      en `5e49a5a` (2026-09-29): `const NOTA: NoteId = noteId("nota")`, comprobado en el fichero.
- [ ] **Comentarios y textos que se quedaron atrás** *(de `back-dev-agent`; la documentación no
      toca `src/` ni `test/`)*. Dos de los tres se arreglaron en `5e49a5a` —los comentarios de
      `src/storage/index.ts` sobre `platform/`, y el número de punto que la lista del editor daba
      a las tres preguntas—. **Queda uno**, comprobado el 2026-10-11:
  - `test/storage/blobs/VERIFICACION-MANUAL.md`, en su preparación: explica el `--noResolve`
    por «un montón de imports sin extensión que el navegador no sabe resolver», y desde
    `1037ea1` ya no los hay. ⚠️ **Tocar ese procedimiento no obliga a repasar la lista** —es el
    `.md`, no `DirectoryHandleBlobStore.ts`—, pero conviene no cambiar los pasos al corregirlo.
- [ ] **Las pruebas viejas — 942 anotaciones** (423 variables, 412 retornos, 107 parámetros,
      medido el 2026-09-19), **deuda aceptada a sabiendas y no un olvido.** Es trabajo mecánico
      que no arregla ni caza ningún fallo, y el diff sería irrevisable. **Lo que se escriba o se
      toque en `test/` a partir de ahora sí cumple la regla**, que es lo que impide que esto
      crezca. **Recomprobado el 2026-09-29** con una sonda sobre el AST, que cuenta distinto: la
      deuda sigue en `test/core/` y `test/storage/` (981 huecos con su recuento, no comparables
      con los 942), y **`test/platform/` y `test/ui/`, escritas en la Fase 4, la cumplen**; la
      única línea que fallaba se arregló en `5e49a5a`.

**❌ DESCARTADO: un guardián para la regla de tipos explícitos, y el motivo vale como criterio
para la próxima vez que alguien proponga un guardián.** Esta regla **no caza ni un solo fallo**:
el compilador ya dice si un tipo está mal, y lo único que añade la anotación es que un cambio de
tipo **se vea en el diff**. Es legibilidad, no corrección. Compáralo por lo que pasa **si se
rompe la regla**:

| Guardián | Qué pasa si se incumple |
|---|---|
| `typecheck:core` | el core toca plataforma y deja de ser portable |
| `check:purity` | el core lee el reloj → las pruebas dejan de ser deterministas |
| `require-tests` | `npm test` pasa en verde **sin ejecutar nada** |
| `check:fronteras` | una excepción se escapa por una firma que prometía `Result` |
| `check:extensiones` | la app no carga en el navegador, y las pruebas siguen en verde |
| *(el de tipos)* | **un diff se lee peor** |

Los cinco primeros tapan agujeros donde algo **funciona mal en silencio**; éste, una molestia de
revisión. **La regla se queda; lo que se descarta es comprobarla automáticamente.** *(Si alguna vez
se reabre: recorrer el AST con `ts.createSourceFile` y `ts.forEachChild`, mirando
`VariableDeclaration` sin `type` y los `parameters`/`type` de cada función, saltándose las cuatro
excepciones y sólo en `src/`. Está probado; el motivo de arriba no cambia por que sea fácil.)*

---

## Sin decidir

**No las resuelva por su cuenta quien implemente.** Si te topas con una, pregunta.

### Cerradas, en una línea

Registro de lo que estuvo abierto y cómo se cerró; el porqué, en la sección de `ARCHITECTURE.md`
que se cita.

- **Las siete de la Fase 1** — ✅ cerradas las siete. Las letras no se reciclan, porque
  `ARCHITECTURE.md` las cita: **(a)** `indent` sobre un texto, **(c)** el ciclo de `move` y
  **(g)** los hermanos al hacer `outdent`, cerradas por eliminación —esas operaciones no existen—;
  **(b)** `remove` sobre una casilla con hijas es no-op; **(d)** `Position` tiene tres casos;
  **(e)** el helper son dos primitivas; **(f)** las operaciones son ocho. §5.4, §9.3 y §9.4.
- **Del editor (Fase 4)** — ✅ las siete, el 2026-09-20: anidar se consume y actúa sobre la línea
  **siguiente**, con un botón aparte; las cuatro esquinas del teclado, tal cual; el nombre
  `WritingMode` (público en inglés, maquinaria interna en castellano); el alcance de `onCorrupt`,
  `onError` y la validación; y `LocalStorageBlobStore` para salir del paso. Ni una línea del
  núcleo. §7.2, §7.3, §9.4.
- **De la navegación y el alcance (Fase 4)** — ✅ el 2026-09-27: sin bundler de entrada; `onError`
  y la validación al final de Fase 4 · Notas; el aviso de `onError` sólo informa; las ventanas, en
  `localStorage` (opción C; la B, aparcada); la fase partida en Contextos y Notas; «Mover a…»
  mueve; al recargar se recuerda sólo la ventana activa; una nota vacía se mantiene. §7.4, §8.6,
  §9.10.
- **Al construir el editor y las ventanas (Fase 4)** — ✅ el 2026-09-29, una a una con el usuario:
  `.js` en los imports (opción A); el interruptor «☐ Casilla»; Intro en un texto crea con `after`;
  los cuatro huecos de §7.3; ventanas sin nada guardado, duplicadas y sin aviso al fallar; varias
  notas con el mismo nombre. Y un bloque de decisiones de implementación **aceptadas en bloque**,
  que no son accidentes: están en §7.4 y §7.5. §7.2–§7.5, §8.6.
- **De los Diagramas (Fase 5)** — ✅ el 2026-10-03: lienzo libre, `DiagramRelation` en un
  multigrafo, «Nota perdida», vista mixta desde cero, «doble = menú o crear», la nota nueva en todos
  los contextos del diagrama, un nivel más de navegación, y la fase partida en tres. §7.4, §9.11.
- **Escritura condicional y conflicto entre dos pestañas** — ✅ decidida y construida el
  2026-10-03: la opción c, escritura condicional con `revision`, porque es la que se reutilizará con
  la sincronización; ante `stale`, avisar y ofrecer Recargar. Descartadas **a** (una sola pestaña
  con Web Locks), **b** (recargar con el evento `storage`), **d** (b + c) y *guardar como copia en
  conflicto*. §6.5.
- **La justificación escrita de `schemaVersion`** — ✅ la real: `schemaVersion` *es* el mecanismo
  de migración y llega con el runner; vive en `StorageAdapter`, no en `AppState`. §9.7.
- **El arranque de la app no tenía fase** — ✅ tenía dos: la mitad pura en la Fase 2 y `boot.ts`
  en la Fase 4 (`473f566`). §9.7.
- **Cómo se verifica la Fase 3** — ✅ a mano, con una lista escrita en el repo, y sin runner de
  navegador. Lo que no se automatiza es `DirectoryHandleBlobStore`, sin lógica interesante: un
  doble prueba **lo que uno cree que hace la API** —un `Map` pasa en verde con el `close()`
  olvidado—, y ese fichero se ejercita solo cada vez que se usa la app; la verificación automática
  se reserva para lo que falla **en silencio**. Precio: un cambio de la API lo caza el uso, no una
  prueba. Qué lo reabriría, en *Ideas aparcadas* (el runner de navegador). §6.3.

### Qué devuelven los casos de uso — ✅ **cerrada y CONSTRUIDA: la entidad protagonista, o `null`**

`ARCHITECTURE.md` §9.7 remite aquí para el registro, así que se queda en un párrafo. **Construida
el 2026-09-19** (`646f44f`), cuando eran dieciocho; hoy son treinta y dos con la misma forma. Sin
retorno, «hecho» y «no aplicaba» eran indistinguibles desde la llamada. **`Result` se descartó**:
un no-op no es un fallo y no habría `E` posible. El no-op sale de la invariante de identidad con
`cambio` (en `useCases.ts`): cambió → la entidad nueva; no aplicó → `null`; se borró → la leída
antes; no existía → `null`. `createNote` también puede dar `null` (un id repetido es no-op).
**No sirve de undo**: `deleteNote` devuelve la nota, no las `ItemRef` que limpió; el undo será una
pila con su propio diseño. Tres lecciones de las pruebas, que conviene no deshacer:

- **un barrido sobre un estado vacío no prueba nada**: con un caso de uso que se saltaba `cambio`,
  las 326 pasaban en verde. El que vigila es el que tiene la entidad y aun así no aplica
  (`NO_OP_CON_NOTA` y `NO_OP_CON_CONTEXTO`), y comprueba además que la entidad guardada sigue
  siendo el mismo objeto;
- **la cobertura de una comprobación duplicada se mira en las dos mitades**: cerrado el lado de la
  Nota, con `addItem` saltándose la comparación las 327 seguían en verde;
- **`useCases.test.ts` tiene dos montajes a propósito**: `montar()` aísla la capa del reducer para
  probar el cableado, y `montarDeVerdad()` monta el `Store` real, porque lo que devuelve un caso de
  uso depende de si la acción cambió algo.

### Abiertas al cerrar el código de la Fase 4

**No las resuelva por su cuenta quien implemente.** Las cerradas, en una línea:

- ~~**La referencia que pierde un contexto cuando `onCorrupt` se salta una nota**~~ — ✅ cerrada el
  2026-10-03 con la opción A, conservar las referencias a lo ilegible (`17278d9`); descartadas
  devolverlas al guardar, una nota de relleno y no guardar el contexto. §6.5.
- ~~**Cuatro reglas `deny` de `.claude/settings.json`**~~ sobre carpetas que ya no existían — ✅
  quitadas el 2026-10-03 (`a5da04e`).
- ~~**Borrar una rama de casillas**~~ — ✅ cerrada el 2026-10-03: no se construye; una casilla con
  hijas se borra una a una. §9.3.
- ~~**El disparador de Snabbdom, por tamaño**~~ — ✅ cerrada el 2026-10-03: el disparador pasa de
  tamaño a fallos de sincronizar el DOM; ninguno de los seis fallos de UI de ese día lo era.
  *Ideas aparcadas*.

**La que sigue abierta:**

- **Las fichas de agentes están desfasadas**, y también son del usuario. `frontend-agent.md` sigue
  siendo el stub que dice «si te han invocado, para» y que `src/ui/` y `src/platform/` no
  existen; se redactó una ficha nueva que no se aplicó, porque **el usuario dijo que no hacía
  falta**. `infra-agent.md` todavía manda reinstalar webpack en la Fase 4 y habla de
  `webpack.config.js`, que ya no está. Por eso la casilla «Acordar la definición del
  `frontend-agent`» sigue **sin hacer**.

**Y las que ya estaban abiertas siguen igual:** **si OPFS entra en juego** (abajo, *Tres
huecos…*) y **qué pasa con lo guardado en `localStorage` al cambiar de destino**, que desde el
2026-09-27 incluye la lista de ventanas y desde el 2026-10-04 qué borra «Borrar todo» (arriba, en
*Fase 4*).

### Tres huecos que salieron al escribir el criterio de la Fase 3 — queda uno

Se dejaron abiertos a conciencia: decidirlos de paso habría cambiado el alcance de la fase por la
puerta de atrás. **Dos están cerrados:** la lista manual vive junto a las pruebas de su rincón
(`test/storage/blobs/VERIFICACION-MANUAL.md`), con las pasadas acumuladas en su «Hoja de
resultados», la más reciente arriba; y el `manifest.json` lleva sólo `{ schemaVersion }`, sin
índice (§6.2). El de OPFS **sigue sin contestarse formalmente**:

- **¿Entra OPFS en la Fase 3? — LA ÚNICA QUE SIGUE ABIERTA.** §6.1 dice que es **la misma**
  `DirectoryHandleBlobStore` y que lo único que cambia es **cómo se consigue el handle**
  (`showDirectoryPicker()` frente a `navigator.storage.getDirectory()`). Si eso es «quién abre el
  storage», es composición y cae en la Fase 4 por §9.7; si se considera parte del adaptador,
  entonces la lista manual necesita **una segunda pasada**. El criterio de cierre pide una pasada
  sobre la carpeta real y no se pronuncia sobre la otra.
  **Cómo se dejó mientras tanto, sin decidirlo por la puerta de atrás:** la lista manual lleva
  OPFS como **sección E, marcada opcional**, con su botón en el andamio y la nota de que el
  criterio de cierre no la exige. Quien pase la lista puede hacerla o no; si la hace, se anota.
  Lo que esa sección **no puede** sustituir es la de la carpeta real: en OPFS no hay explorador
  de ficheros que mirar, y el oráculo del `close()` es precisamente mirar el fichero en el disco.
  **Y la realidad la ha dejado sin filo, aunque la pregunta siga sin contestar formalmente:** en
  la pasada del 2026-09-13 la sección E **se hizo y pasó en los dos navegadores** —es lo único
  que Firefox pudo probar—, y la fase se cerró **sin exigirla**. Así que la respuesta de facto es
  la primera: OPFS es «cómo se consigue el handle», o sea composición, o sea Fase 4. Si alguien
  quiere cerrarla formalmente, eso es lo que hay que escribir.

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
| ~~**El editor de grafos de los Diagramas**~~ — ✅ **ya no está aparcado: planificado el 2026-10-03** | Estaba aquí porque no tenía diseño: el boceto del usuario decía que aún no sabía cómo plantear la interfaz. | **Desbloqueada:** cerró la Fase 4 y se planificó la 5 —un lienzo libre, partido en Modelo, Lienzo y Relaciones— en `ARCHITECTURE.md` §9.11 y en *Pendiente*. Lo que estaba anotado aquí, que `Diagram.nodes` pasara de array a `Record`, entra en Fase 5 · Modelo. |
| **Una librería pequeña sólo para mover y acercar el lienzo** (pan/zoom, sin dependencias propias) | Decidido el 2026-10-03 hacer el lienzo **desde cero**: las librerías de lienzo completas exigen React o guardan su propio estado (`ARCHITECTURE.md` §9.11), y mover y acercar son unas pocas cuentas puras que se prueban en Node. | **Que el pellizco o el arrastre no se dejen domar en el móvil real.** El lienzo se hizo sin ella, y **aún no se ha probado en el móvil**: se sabrá al pasar su lista, que desde el 2026-10-04 va al final de la Fase 5, con las relaciones ya encima. Ese día se evalúa una que haga **sólo** eso y no guarde estado; sería la primera dependencia de runtime, así que con el mismo cuidado que Snabbdom. |
| **Shells de escritorio y móvil (Tauri / Capacitor)** | Envuelven el output del build web. Ese build existe desde la Fase 4 (`npm run build:web`, a `dist/web/`), y desde la Fase 6 se publica como PWA, que ya da la app instalada en el móvil. | Era «una Fase 4 terminada», y ya se cumple. **Qué lo reabre ahora, sin decidir con el usuario.** Y ese es el momento de reconsiderar los workspaces de npm, no antes. |
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
