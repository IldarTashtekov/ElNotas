# Tareas de ElNotas

Qué está pendiente, qué está sin decidir y qué ideas hay aparcadas. Los principios y su porqué
están en `ARCHITECTURE.md`; las reglas para agentes, en `CLAUDE.md`.

**La disciplina que mantiene vivo este fichero: cada entrada tiene que ser cerrable.**
"Mejorar la UI" no se cierra nunca y no entra aquí. "Que `npm test` falle sin ficheros de
test" sí. Si una entrada no se puede marcar como hecha, o está mal escrita o es una idea
aparcada.

**Y cada tarea abierta acaba en «Se cierra cuando…»**, con lo que lo demuestra: en código, qué
prueba o qué guardián pasa y qué rotura a propósito lo caza; en una lista manual, que quede anotada
entera; en una decisión del usuario, dónde queda escrita. Lo vigila `npm run check:tareas`.

---

## Pendiente

Las fases cerradas van **resumidas**: qué se hizo, cuándo y con cuántas pruebas, la deuda si la
hubo y sus commits clave, para leer la historia de corrido. La crónica entera está en `git log`;
los principios, en `ARCHITECTURE.md`. **El `ARCHITECTURE.md` viejo**, el de antes de la Fase 9,
contaba también el diseño de cada funcionalidad, y las entradas cerradas lo citaban por sección;
está entero en `git show ef1bcc6:ARCHITECTURE.md`.

### Fase 1 — Dominio puro ✅ TERMINADA

El helper de copia por camino en sus dos primitivas (`updateContent.ts`, `updateContainerOf.ts`),
`Position` con sus tres casos, **las ocho operaciones de contenido** —fuera `indent`, `outdent` y
`move`—, los puertos `Clock` e `IdGenerator` (sólo interfaces) y la rebanada vertical (`Action`,
`reduce`, `Store`, `createUseCases`), que demostró que **tres despachos redundantes dan un solo
aviso** y no tocan `updatedAt`. Cada caso no-op con su prueba `strictEqual`, y cada
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
`FileStorageAdapter`, que pasa la suite de contratos **sin tocarla**, las dos
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
      **Se cierra cuando** la interfaz sale, `check` pasa en verde y se repasa la lista manual de
      `test/storage/blobs/`, como exige `CLAUDE.md` al tocar ese fichero.

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

Sólo web, partida en **Fase 4 · Contextos** y **Fase 4 · Notas**. Nacen
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

- [ ] **Contestar por escrito las tres preguntas del editor** —`move`, `indent`/`outdent`, y si el
      disparador de anidar se entiende solo— **después de usar la app de verdad varios días**,
      no tras una demo. Un «no se aguanta» reabre la decisión correspondiente, y es un resultado
      válido. **Sin contestar el 2026-09-29, y sigue pendiente el 2026-10-03.**
      **Se cierra cuando** el usuario contesta las tres por escrito aquí, y cada «no se aguanta»
      abre su propia tarea.
- [ ] **Qué pasa con las notas de `localStorage` al cambiar de destino.** Arrancar en
      `LocalStorageBlobStore` fue decidido «para salir del paso», y es barato de revertir porque
      el destino se inyecta en un solo sitio. Lo que **no** es gratis son las notas ya escritas:
      o se migran o se pierden. Conviene decidirlo antes de usar la app en serio. Techo
      conocido mientras tanto: ~5 MB por origen, que el base64 del blob infla alrededor de un
      tercio. **En notas, unas 4.000** de un título y seis líneas (~1.300 caracteres cada una),
      estimado el 2026-10-11 en la Fase 7: el techo llega antes que la lentitud. **Y desde el 2026-09-27, un tercer cabo:** la lista de ventanas vive en su propia
      clave de `localStorage`, fuera del almacén, así que **no viaja con las notas** — un cambio
      de destino o de dispositivo la pierde (riesgo aceptado). **Y desde
      el 2026-10-04, un cuarto:** «Borrar todo» vacía las claves `elnotas:` del `localStorage` de
      ese navegador; con otro destino —carpeta, OPFS— **hay que revisar qué borra** y si sigue
      teniendo sentido en dos tiempos. **Y desde el 2026-10-08, un
      quinto:** la app publicada de la Fase 6 es **otro origen** y empieza vacía; no ve lo escrito
      en la red de casa. **El usuario acepta perderlo**.
      **Se cierra cuando** el usuario elige migrar o perder lo escrito, y queda en *Decisiones
      cerradas* de `CLAUDE.md`.

### Fase 5 — Diagramas ✅ CERRADA el 2026-10-08, con deuda; la deuda, saldada el 2026-10-10

Un lienzo libre con nodos y relaciones, partido en tres: **Modelo** —el `Diagram` nuevo,
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
      **Se cierra cuando** el usuario elige el nombre, `grep -rn NoteList src test` no da nada y
      `check` pasa en verde.
- [ ] **¿Etiquetas de texto junto a los «+»?** Su boceto (el del usuario, 2026-10-04) las lleva.
      **Pregunta abierta al usuario, sin contestar**; hasta que conteste, los botones siguen sin
      texto.
      **Se cierra cuando** el usuario contesta; si es que sí, construidas y con su paso en la lista
      manual.

### Fase 6 — PWA: instalar la app en el móvil ✅ CERRADA el 2026-10-10

Que ElNotas se instale en el móvil como una app —icono, pantalla completa, sin conexión,
actualizándose sola—: manifiesto, iconos, *service worker* en `pwa/sw.js`, `npm run build:pages` y
GitHub Pages publicada por GitHub Actions. Las doce decisiones y su porqué, en el `ARCHITECTURE.md` viejo. Construida el
2026-10-09 y publicada el 2026-10-10 en **https://ildartashtekov.github.io/ElNotas/**, con **725
pruebas**, sin dependencias nuevas y sin tocar el core. El usuario la instaló, la probó y la dio
por cerrada, **sin anotar paso a paso** su lista (`test/ui/VERIFICACION-MANUAL-PWA.md`); su bloque
F —que se actualice sola en el móvil— no consta que se viera. ⚠️ **El icono parece una ilustración
de otra persona**: si la app se comparte, conviene un dibujo con permiso o propio.
Commits clave: `8f44d2d` (rutas relativas), `d007a3d` (manifiesto e icono), `ccd94c6`
(`build:pages`), `45b6242` (el *service worker*), `7791e24` (`persist()` y la versión), `926b8fd`
(la publicación), `af6dcf4` (la lista manual).

### Fase 7 — Refactor: ajustes de diseño y medir antes de tocar ✅ CERRADA el 2026-10-12

Planificada el 2026-10-11 y **cerrada el 2026-10-12 con 729 pruebas**, sin dependencias nuevas,
sin tocar el core y sin deuda: el usuario la probó en el móvil y la dio por cerrada, **sin anotar
paso a paso** (teclado, la L, arrastre de nodos y el «+»). Con la barra bastó
`interactive-widget`: `visualViewport` no hizo falta.
Commits clave: `710253a` (la barra y la L), `165eca9` (el arrastre de nodos), `cc0e311` (la
documentación adelgazada), `1815a2b` (nota o diagrama desde el «+»).

**Qué es:** dos cosas. Arreglar lo que molesta al usar la app en el móvil, y revisar lo que se
construyó por adelantado o puede no aguantar el volumen, **con números y no a ojo**. Si al medir
algo resulta que no duele, el punto se cierra sin tocar código. **Negrita, cursiva, tachado y
subrayado NO entran, ni el texto más grande**, por decisión del usuario: están juntos en *Sin
fase asignada*. Reflejada en el plan de `CLAUDE.md` y de `ARCHITECTURE.md` en el pase de
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

- [x] **Una nota o un diagrama nuevos como ventana siguiente** *(pedido por el usuario el
      2026-10-12)* (`1815a2b`). La hoja del «+» de la última ventana lleva, bajo «+ Contexto
      nuevo», «+ Nota nueva» y «+ Diagrama nuevo», apilados. Nacen **sin contexto** y llegan con
      el título en edición; el selector de ⚙ no cambia (las dos cosas, decididas por el usuario;
      lo de ⚙, **cambiado el 2026-10-13**: ofrece lo mismo, ver *Sin fase asignada*).
      `createAsWindow`, con dos pruebas rotas a propósito; la hoja, pasada en el panel (I2–I5,
      I7). **Falta CTX-I7 en el móvil**, en la última casilla de la fase.

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

- [x] **Verlo en el móvil** ✅ *(dado por probado por el usuario el 2026-10-12)*: la barra con el teclado, la L (publicar y reinstalar), arrastrar
      nodos con relaciones y crear nota o diagrama desde el «+» (CTX-I7 de
      `VERIFICACION-SENTADA.md`); con eso se cierra la Fase 7. En detalle: que la barra de la nota quede
      encima del teclado de Android y la última línea no se esconda bajo ella (si no basta,
      `visualViewport`); **publicar, desinstalar y reinstalar**, porque la app instalada saca la
      barra del manifiesto, y comprobar que en horizontal ya no sale la L; y arrastrar nodos con
      relaciones en el ordenador y en el móvil (pasos de arrastre de
      `VERIFICACION-MANUAL-LIENZO.md` y `-RELACIONES.md`).

**Fuera de esta fase, con disparador propio:** revisar los puertos cuando llegue su segundo uso
real (carpeta, OPFS o Supabase). Se hace al construir ese adaptador.

### Fase 8 — Aspecto de terminal: fósforo ámbar sobre negro ✅ CERRADA el 2026-10-12

Planificada, construida y **cerrada el 2026-10-12 con 742 pruebas**, sin dependencias nuevas y
**sin deuda**, en la rama `fase-8-terminal`: el usuario la revisó y la dio por hecha, **sin
anotar paso a paso** la lista manual. El diseño y sus porqués, en
el `ARCHITECTURE.md` viejo. Commits clave: `d832ac1` (el ámbar), `d2214b2` (el verde a elegir), `1157c81` (el icono).

**Qué es:** cambiar el aspecto de la app para que parezca una terminal de los 80, de las de
fósforo, a partir de capturas que trajo el usuario (Cool Retro Term y otras parecidas). **Sólo
CSS**, más la pantalla de carga del manifiesto. Ni el DOM, ni el comportamiento, ni las pruebas
cambian, y no hay dependencias nuevas. Al cerrarla, `npm run check` tiene que dar las mismas
**729 pruebas**.

**Decidido con el usuario el 2026-10-12:**
- **Fósforo ámbar** sobre negro. ~~Ni verde ni las dos a elegir~~: **revisado por el usuario el
  mismo día**, tras ver el ámbar: **ámbar o verde, a elegir en ⚙**, ámbar por defecto. El color es
  de cada dispositivo: se guarda en `localStorage` y no viaja con las notas.
- **Siempre en oscuro.** Fuera la paleta clara: una sola paleta y `color-scheme: dark` fijo.
- **La letra monoespaciada del sistema** (la `--mono` que ya existe) en toda la app. Ninguna
  fuente «píxel» en el repo (VT323 y parecidas): pesa y se lee peor en textos largos.
- **Efecto CRT suave:** un brillo leve en las letras y líneas de barrido fijas. Nada se mueve: ni
  parpadeo, ni esquinas oscurecidas, ni cursor de bloque.
- **Ámbar y rojo:** todo en ámbar y lo importante (crear, confirmar) en **vídeo inverso**, es decir,
  letra negra sobre fondo ámbar. El rojo se queda sólo para borrar y para los errores. El verde
  desaparece.

**Decisiones cerradas que reabre**, que se reescriben en `CLAUDE.md` y `ARCHITECTURE.md` en el pase
de documentación:
- **«"+" verde en la última ventana»** pasa a «+» en vídeo inverso.
- **«Pantalla de carga azul»** (Fase 6) pasa a negra: el `background_color` del manifiesto.
- **Claro y oscuro según el sistema** pasa a «sólo oscuro». «Barras del móvil con el color del
  sistema» (Fase 7) sigue en pie: al ser `color-scheme: dark` siempre, saldrán oscuras.

- [x] **0. Los colores sueltos, a variables.** Había colores fuera de `base.css`, aunque la regla
      lo prohíbe: seis `#fff` (`barras.css`, `hojas.css`, `ajustes.css`), el ámbar `#d08a00` del
      borde de `.aviso` (`ventanas.css`) y el velo de las hojas. Ahora son `--sobre-color`,
      `--aviso` y `--velo`, **sin cambio visible**: el estilo calculado de toda la página, idéntico
      antes y después. Las sombras no se pasaron: se van en la tarea 2.
- [x] **1. Paleta y letra.** Una sola paleta en `base.css`: negro tostado de fondo, ámbar para la
      tinta, ámbar tenue para `--muted`, `--line` y `--dim`, y rojo de fósforo para `--danger`.
      Fuera el bloque `prefers-color-scheme` y el `:not([data-theme="light"])`, que nadie usa.
      `--green` desaparece y sus usos pasan al vídeo inverso. `--ui` pasa a ser la `--mono`.
      **Medir el contraste** del ámbar tenue sobre negro: que se lea. ✅ Medido: la tinta da 10,9;
      `--muted`, 6,6 sobre la pantalla y 6,3 sobre una fila; el rojo, 6,3; el negro sobre ámbar,
      10,9. Todo pasa de 4,5 menos `--dim` (2,6), que sólo pinta lo desactivado. Las fichas de ⚙
      partían «contexto» (la monoespaciada es más ancha): su nombre baja a `0.68rem` y el relleno
      lateral a `0.35rem`, y ya caben ocho letras.
- [x] **2. Formas.** `border-radius: 0` en los siete CSS y fuera las sombras. El borde de los avisos
      ya no se distingue en ámbar: se resuelve aquí, con el vídeo inverso o con un borde más grueso.
      ✅ Se quedó en ámbar con su borde grueso, y en rojo el de guardado detenido. Lo que tenía
      sombra para verse levantado (la ficha, el pósit) ya cambiaba de borde. La hoja gana un borde
      arriba. El «+» de diagrama nuevo pasa a ir **en hueco** (borde ámbar, fondo negro) para no
      confundirse con el de nota, que va en vídeo inverso. Y el foco del teclado, ámbar y recto
      (`:focus-visible` en `base.css`), porque el del navegador salía blanco y redondo.
- [x] **3. CRT suave.** Brillo con `text-shadow` y líneas de barrido en una capa encima de todo,
      con `pointer-events: none`. **Riesgo:** sin eso, la capa se come los toques y los gestos
      del lienzo. ✅ `--brillo` en el `body`, que se hereda, y `body::after` con `--barrido`.
      Comprobado: el punto de un pósit y el de ⚙ caen en ellos, no en la capa. Lo que va en vídeo
      inverso lleva `text-shadow: none`, porque el halo ámbar emborrona la letra negra.
- [x] **4. El lienzo.** Pósits en recuadro ámbar; líneas, flechas y puntos de la rejilla en ámbar
      tenue. **Medir el arrastre de nodos** como en la Fase 7: el `text-shadow` en muchos pósits
      puede notarse, y si se nota, el brillo se quita del lienzo. ✅ Recuadro en `--muted`, que pasa
      a `--accent` al levantarlo. **Medido a medias**: con 200 nodos y 290 relaciones, el
      JavaScript de cada movimiento sigue en **4,2 ms** (4,4 en la Fase 7). Pero el brillo cuesta
      al pintar, y eso no se pudo medir: con el panel oculto, el navegador frena los fotogramas
      (alguno tardó un segundo entero). **Queda para el móvil** (G3 de la lista nueva).
- [x] **Fuera el emoji de la papelera** *(pedido por el usuario el 2026-10-12)*: «Borrar»,
      «Quitar» y «Borrar todo», sólo con texto, en `NoteList.ts` y `SettingsView.ts`, y en las
      listas manuales que lo nombraban. No se cambió ningún otro símbolo (◀ ▶ ⚙ ✕ ☐ ↳).
- [x] **El fósforo verde, a elegir en ⚙** *(pedido por el usuario el 2026-10-12)*. Una sección
      «Pantalla» encima de «Datos», con **Ámbar** y **Verde**; el elegido, en vídeo inverso, y el
      cambio se ve al instante. En `base.css`, `:root[data-phosphor="green"]` cambia sólo lo que
      brilla: los negros y el rojo son los mismos, y `--brillo` y `--aviso` salen ya de la tinta.
      `src/ui/phosphor.ts` (`parsePhosphor` y `createPhosphorSetting`, puros, con pruebas) y
      `src/platform/web/LocalStoragePhosphor.ts`, en la clave `elnotas:phosphor`, que «Borrar
      todo» ya se lleva. `main.ts` lo aplica **antes de arrancar**, para que no salga un instante
      en ámbar. **Dos fronteras más** (el `load` y el `save`): diecisiete. **13 pruebas nuevas,
      742 en total**, con cuatro roturas a propósito: la guarda de no-op, `parsePhosphor`, aplicar
      al crearlo y el `try` del `load`, que además caza `check:fronteras`. Probado en el panel:
      cambia, se guarda y la tinta y el brillo pasan a verde.
- [x] **5. La PWA.** `background_color` del manifiesto, a `#050301`, el negro de `--ground`. El
      duplicado de *Sin fase asignada* («Los colores de la app, repetidos…») **no se resuelve**:
      cambia el valor y sigue repetido. **El icono** (`1157c81`): el mismo dibujo, en sus colores,
      con el fondo azul cambiado por negro y lluvia de letras verdes detrás, estilo Matrix,
      **elegido por el usuario** entre tres muestras (el dibujo teñido de verde y un cursor `>_`
      propio). 512 y 192, en `assets/icono/`; la copia publicada los recoge.
- [x] **6. Verificar.** `npm run check`: 742 de 742, y `build:pages` arma la copia. La lista
      manual, `test/ui/VERIFICACION-MANUAL-TERMINAL.md`: las cuatro vistas, las hojas, el lienzo y
      los gestos. **Sin pasar**: la fase se cerró antes, por decisión del usuario (abajo).
- [x] **7. Documentación**, en un solo pase al cerrar: hecho el 2026-10-12, con una sección nueva en
      `ARCHITECTURE.md` y las listas manuales al día. Lo que pedía: las decisiones reabiertas en `CLAUDE.md`
      (*Decisiones cerradas* y *Plan por fases*) y en `ARCHITECTURE.md`. También **las listas
      manuales viejas**, que aún hablan del «+ verde», el «+ azul», la «raya azul» y la «sombra
      más grande» (`VERIFICACION-MANUAL-LIENZO.md` A1, A2 y D3, y las que lo repitan). Y en
      `CLAUDE.md`, las **diecisiete fronteras** (con las dos de `LocalStoragePhosphor`) y el
      fósforo en `localStorage`, junto a las ventanas, entre lo que no viaja con las notas.

#### Para cerrarla

- [x] **Revisarla** ✅ *(dada por hecha por el usuario el 2026-10-12, tras revisarla: «todo
      aparentemente va bien»)*. La lista `test/ui/VERIFICACION-MANUAL-TERMINAL.md` no se anotó
      paso a paso. Si algún día arrastrar pósits va a tirones en el móvil, el primer sospechoso es
      el brillo del lienzo (G3).

### Versión 1 ✅ CERRADA el 2026-10-13, por decisión del usuario

**Cerrada con 828 pruebas**, tras validar en el móvil la tanda de ventanas, hueco y encuadre. El
commit lleva la etiqueta **`v1.0.0`**, para poder volver a esta versión exacta. Incluye las fases
0 a 8 y las dos tandas sin fase (la copia de seguridad; ventanas, hueco y encuadre).
**Pasa a la siguiente, como deuda conocida:**

- **Pasar la lista manual de la copia** (abajo, en *Sin fase asignada*).
- **Las tres preguntas del editor** de la Fase 4 (arriba), sin contestar.

Lo demás pendiente (la nube, Markdown, Node 20, el negro repetido en el manifiesto, el formato de
texto) sigue sin fase, como estaba.

### Fase 9 — Meta-desarrollo: que trabajar con agentes sea más automático — PLANIFICADA el 2026-10-13

**Sin empezar y sin una línea de código.** Decidida con el usuario el 2026-10-13, tras una revisión
de la deuda, las fugas de memoria y lo que la arquitectura está dando al programar con agentes.

**Qué es:** convertir en automático lo que hoy depende de que el agente se acuerde o de que el
usuario mire. Es el patrón que ya funciona —la verja del core, los guardianes, `npm run check` que
no pasa en falso—, llevado más lejos. **No cambia la app:** ni el DOM, ni el comportamiento, ni el
core. Al cerrarla, `npm run check` da **las mismas pruebas que al empezar** más las de los
guardianes nuevos.

**Decidido con el usuario el 2026-10-13:**
- **Sin dependencias nuevas.** Lo que haga falta, con Node, TypeScript (el analizador ya está) o
  `.claude/`. Fuera ESLint entero, Biome, SonarQube y `jscpd`; CodeQL, no hasta que llegue la nube.
- **Un análisis vale si falla el build, es rápido y casi nunca se equivoca.** Un aviso que se puede
  ignorar, el agente lo ignora; un informe o un panel no sirven aquí.
- **No se toca lo que da los frutos:** el core puro, la verja por `tsconfig`, `Result`, sin bundler
  y `node:test`.
- En una rama (`fase-9-meta`), una tarea cada vez, y cada guardián nuevo **roto a propósito**.
- **Ni `push` a otras ramas ni *pull requests*:** el `deny` de `git push` sigue entero y publicar
  sigue siendo cosa del usuario. Por eso C4 queda descartada.
- **Las listas manuales las puede pasar Claude con el navegador del panel** *(el usuario,
  2026-10-13: «parece muy útil para usar todo el poder de Claude en el testing, sin una herramienta
  externa como Playwright»)*. Siguiendo los `VERIFICACION-*.md`, con una anotación por paso y
  capturas en lo visual, sin pruebas guardadas en el repo ni nada instalado. No reabre «a mano, sin
  runner de navegador»: la precisa. La PWA, el móvil de verdad y los diálogos del sistema siguen
  siendo del usuario. Ver C5.
- **`ARCHITECTURE.md` lleva lo estructural, no la bitácora** *(el usuario, 2026-10-13)*: decisiones
  de estructura, paradigmas, convenciones, buenas prácticas y los porqués de los métodos que se
  eligen; **no** cada decisión con su detalle y su fecha. **Entra en esta fase**, como E2, y va la
  última: cuando los guardianes ya existan, el documento puede soltar las reglas que ellos vigilan.

**Sin decidir, antes de la tarea que lo necesita:**
- **El uso de agentes, en el aire** *(el usuario, 2026-10-13)*: hay que replantearlo en esta fase,
  y por ahora no se decide nada. Lo dejan en suspenso C2 y C3, y la pregunta de quién edita las
  fichas de `.claude/agents/` (hoy Claude no puede: `deny`).
- ~~**El alcance de la regla de `§`** (B4)~~ — decidido el 2026-10-14: el código de `src/`,
  `test/`, `tools/` y `.claude/hooks/`, sin los `.md`. Ver B4.

#### A. La base: casi gratis y con mucho efecto

- [x] **A1. Podar `.claude/settings.local.json`** ✅ *(aprobado por el usuario el 2026-10-13)*. De
      103 reglas a 8, todas de leer o consultar. Fuera las que ejecutan código cualquiera
      (`node -e`, `python3 -c`, `python3 -`, `perl -0pi -e`), que se saltaban los `deny` de `curl` y
      de instalar; las demasiado amplias (`git config *`, `npm version *`, `Read(//home/ubuntu/**)`,
      `git branch *`, `git tag *`, `gh run *`, `git merge *`, `rm -r …/assets`), y unas 80 de un solo
      uso. El fichero no va en git (`.gitignore`). **Para que no vuelva a crecer:** a una orden de
      una sola vez, «permitir una vez», no «siempre».
- [x] **A2. Pasar de Node 20 a uno con soporte** ✅ *(2026-10-13; la 26, elegida por el usuario
      porque `@types/node` ya era la 26)*. Es la tarea de *Sin fase asignada*. Casa y publicación
      leen la versión del mismo fichero, `.nvmrc` (`node-version-file` en `publicar.yml`), y ya no
      pueden separarse. `npm run check` en verde con la 26.11.1. **Salen 841 pruebas, no 844, y
      no falta ninguna:** Node 20, con la carpeta `tmp-test/test`, ejecutaba todos los `.js` y
      contaba como prueba cada uno de los tres ayudantes (`FakeStorage`, `storageContract`,
      `FakeBlobStore`), que no tienen ninguna; Node 26 sólo ejecuta los `*.test.js`. Comparadas las
      dos listas de nombres, ésa es la única diferencia. Los recuentos de antes llevaban tres de más.
- [x] **A3. Las opciones estrictas de TypeScript que ya se cumplen** ✅ *(aprobado por el usuario
      el 2026-10-13)*, en `tsconfig.base.json`: `noUnusedLocals`, `noUnusedParameters`,
      `noImplicitReturns`, `noImplicitOverride`, `noPropertyAccessFromIndexSignature` y
      `exactOptionalPropertyTypes`. Con Node 26, **0 errores** con las cinco primeras; con la
      última, dos (no tres, como se midió antes): `src/platform/web/boot.ts:137` y
      `test/storage/writeBehind.test.ts:503`, los dos por pasar a `createWriteBehind` un valor que
      puede ser `undefined`. Arreglado en el sitio que lo recibe: los campos opcionales de
      `WriteBehindDeps` se declaran `?: T | undefined` («puede faltar o venir vacío»), sin tocar a
      quien llama. `check` en verde con **841 pruebas**, y cada una de las seis rota a propósito en
      un fichero temporal (variable y parámetro sin usar, un camino sin `return`, un método
      redefinido sin `override`, `registro.clave`, `campo: undefined`): las seis tumban `check`.
- [x] **A4. Hooks en `.claude/settings.json`** ✅ *(aprobado por el usuario el 2026-10-13)*. Cambia
      quién se acuerda de pasar los checks, no los checks. Dos, en `.claude/hooks/checks.mjs`:
      **al editar** un fichero de `src/`, `test/` o `tools/`, los tipos y los guardianes, sin las
      pruebas (rápido, y una edición a medias puede tumbar pruebas sin que haya nada mal); **al
      terminar el turno**, si hay cambios sin comitear en esas carpetas, `npm run check` entero,
      que en rojo no deja terminar, sólo una vez seguida (para poder parar y preguntar sin bucle).
      `checks.sh` los lanza con la Node de `.nvmrc` por `nvm-exec`: la sesión de Claude hereda el
      PATH de cuando se abrió la app, y caía en la v12 de `/usr/bin`. **Probado de verdad:** una
      variable sin usar escrita a propósito la cazó el hook al guardar y el de terminar no dejó
      acabar el turno, sin que nadie lanzara nada.

#### B. Guardianes nuevos

- [x] **B1. Las promesas sueltas, y los `Result` sin mirar** ✅ *(aprobado por el usuario el
      2026-10-13)*. Medido: ninguna suelta por descuido, pero 11 descartes con `void` (uno en
      `writeBehind`, que no salía buscando texto), y `iniciar()` sin ninguna frontera: un fallo
      inesperado al arrancar dejaba la pantalla en blanco sin rastro. **La regla, del usuario:** un
      error se mira siempre, aunque sea para registrarlo; `void` no tapa nada y no hay lista de
      excepciones. El guardián, `npm run check:descartes` (`tools/check-descartes.mjs`, con los
      tipos de TypeScript, sólo `src/`: en `test/` cada `test(…)` es una promesa que nadie espera, a
      propósito), falla si un `Result` o una promesa se tiran: sueltos, con `void`, un `await` que
      tira el `Result`, un `.catch` sobre una promesa que trae un `Result`, o una función que
      devuelve uno de los dos donde se espera una que no devuelve nada. **El registro, transversal:**
      un sexto puerto, `Logger` (sólo el tipo, en `src/core/ports/`), con `consoleLogger` en
      `platform/web/` (prefijo `ElNotas:`), obligatorio en las dependencias de quien registra.
      **Reabre dos decisiones cerradas, con el visto bueno del usuario:** «los cinco puertos» y «la
      Fase 9 no toca el core» (entra un tipo, sin lógica). Pasan a E1. `check` en verde con **845
      pruebas** (4 nuevas: el fallo se registra en fósforo, ventanas, encuadre y guardado
      programado; rota cada una a propósito, cae); el guardián, roto con nueve formas de descartar
      y un control que pasa; en el panel, `localStorage` roto a propósito deja la línea en la
      consola. Corre también en el hook de editar (unos 2 s).
- [x] **B2. Las roturas a propósito, automáticas** ✅ *(aprobado por el usuario el 2026-10-13)*.
      Pruebas de mutación (*mutation testing*) a mano, con una lista elegida y sin Stryker: no
      prueban el código, prueban **que las pruebas sigan vigilando**, para el día en que una se
      reescriba y deje de hacerlo sin que nada avise. `npm run check:roturas`
      (`tools/check-roturas.mjs`) pasa la lista de `tools/roturas.mjs`: cada rotura cambia un texto
      exacto de un fichero de verdad, lanza **sólo lo que tiene que cazarla** (las pruebas, y cuál
      tiene que caer, o un guardián) y lo restaura. Falla si una **sobrevive**, si **caducó** (su
      texto ya no está, o está dos veces), si cae otra prueba o si no compila. Lo roto se apunta
      en `.rotura-en-curso.json` (en `.gitignore`): Ctrl-C restaura en el acto y para la pasada, y
      tras un corte que no da tiempo (un `kill -9`) la pasada siguiente lo restaura antes de nada.
      Con la base en rojo no empieza. **No va en `check` ni en los hooks** (unos 4 minutos): se
      lanza al cerrar cada tarea que toque `src/` y al cerrar la fase; `-- fósforo` pasa sólo las
      que lo lleven en el nombre. **La primera lista, 32, todas cazadas:** las apuntadas en las
      fases anteriores (fósforo, ventanas, capas, encuadre, copia, el `LocalStorageBlobStore`, el
      hueco del editor), la identidad y la integridad del core, `writeBehind`, los cuatro registros
      de B1, la verja y los cuatro guardianes. Ocho salieron al principio «no compila»: con A3, una
      rotura que deja una variable sin usar la caza el compilador antes que las pruebas; se
      reescribieron para que compilen. El script, roto a propósito: una que sobrevive, dos
      caducadas, otra prueba, la base en rojo, Ctrl-C y `kill -9`. **Pasa a E1:** la regla «cada
      guarda se rompe a propósito» de `CLAUDE.md` se cumple ahora añadiendo su rotura a la lista.
- [x] **B3. `check:fronteras`, de lista negra a lista blanca** — ✅ *medida y descartada por el
      usuario el 2026-10-13: sería sobreingeniería.* En `src/` hay 2.273 llamadas: 1.467 a código
      propio y **760 a 162 funciones de fuera sin `try`**, casi todas seguras (`Array`, `Map`,
      `Math`, el DOM con valores fijos) o ya en la lista negra. Una lista blanca daría 162 avisos
      para encontrar **un** agujero. **Lo que sí entró:** ese agujero, `history.pushState` y
      `replaceState` en `src/ui/backStack.ts` (Safari lanza si se llaman unas cien veces en
      treinta segundos), a la lista negra de `check:fronteras` y dentro de su `try`. Una capa que
      no llega a tener su entrada se abre igual, lo registra el `Logger`, y se cierra sin ir atrás:
      un `back()` sin entrada se saldría de la página. Dos fronteras más, dos roturas más en la
      lista de B2, cazadas. Probado en el panel: con el historial normal, abrir una nota y
      cerrarla con «atrás» y con «Salir»; con `pushState` fallando a propósito, la nota se abre,
      deja la línea en la consola y «Salir» la cierra sin salir de la app. `check` en verde con 845.
- [x] **B4. Un guardián de `§`** ✅ *(aprobado por el usuario el 2026-10-14)*. `npm run
      check:paragrafos` (`tools/check-paragrafos.mjs`, búsqueda de texto, milisegundos) falla si
      un fichero de código (`.ts`, `.mjs`, `.js`, `.html`, `.css`, `.sh`) de `src/`, `test/`,
      `tools/` o `.claude/hooks/` señala un documento por número de sección. Los `.md` no entran:
      son documentos y se remiten entre ellos. Los que había, cinco y no cuatro (también un
      comentario de `test/storage/blobs/verificacion-manual.html`), señalan ahora fichero y título
      de sección; sus títulos, a revisar en E2. En `check`, en el hook de editar y con su rotura
      en la lista de B2, cazada. `check` en verde con 845.
- [x] **B5. Exportaciones muertas** ✅ *(aprobado por el usuario el 2026-10-14, opción a)*.
      **Código muerto no había:** lo único que nadie usa es `createDirectoryHandleBlobStore`,
      aparcado a propósito. Lo que sobraba eran **líneas de escaparate**: de 296 exportaciones de
      `core`, `storage` y `ui`, 100 no las usaba nadie fuera de su módulo y 109 sólo las pruebas
      (el de `ui` anunciaba 168 piezas y `platform/` usa 25). **La regla:** un `index.ts` sólo
      exporta lo que importa otro módulo de `src/`; las pruebas importan lo demás por su fichero
      (`#ui/noteActions`), que `CLAUDE.md` ya permitía. Quedan 87 (54, 8 y 25), y 33 pruebas
      cambian sólo sus imports. **`src/platform/index.ts` desaparece**, y con él su entrada del
      `importmap` de `index.html`: nadie importa `platform` por diseño, y lo que exportaba lo
      usaban sólo las pruebas (`#platform/*` de `package.json` sigue, para ellas). **Pasa a E1:**
      la regla «un `index.ts` por módulo» de `CLAUDE.md`, con esa excepción. El guardián,
      `npm run check:exportaciones` (`tools/check-exportaciones.mjs`, analizador de TypeScript,
      menos de un segundo), también rechaza `export *`. En `check`, en el hook de editar y con su
      rotura en la lista de B2, cazada. `check` en verde con 845; las 36 roturas, cazadas; en el
      panel, la app arranca sin errores con el `importmap` nuevo, y `build:pages` arma la copia.

#### C. La forma de trabajar

- [x] **C1. «Se cierra cuando…» comprobable en cada tarea** ✅ *(aprobado por el usuario el
      2026-10-17)*. De 28 abiertas, sólo 4 decían qué demuestra que están hechas. **Revisadas
      una a una:** tres repetidas, fusionadas (el `frontend-agent` de la Fase 4 con C2, la lista
      de la copia con C5, los comentarios atrasados de *Infraestructura* con D2); dos sin cierre
      posible, a *Ideas aparcadas* (el lienzo con teclado; los tipos de las pruebas viejas, deuda
      aceptada); y cinco de la nube pasan a «al construirla», sin casilla: sólo tienen sentido al
      construirla; asignarle fase sigue abierta, y se cierra cuando el usuario se la asigne.
      Quedan **17** sin contar ésta, todas con su cierre. La regla, en la cabecera;
      el guardián, `npm run check:tareas` (`tools/check-tareas.mjs`, milisegundos), en `check`,
      con su rotura en la lista y en el hook: editar `TAREAS.md` lanza sólo ése. Probado de
      verdad: quitar a propósito el cierre de D3 lo cazó el hook al guardar.
- [ ] **C2. El `frontend-agent`: definirlo o borrarlo** *(el usuario)*. Viene de la Fase 4.
      **En el aire**, con el resto del uso de agentes.
      Era también una tarea de la Fase 4: su ficha dice cosas que ya no son verdad (que no existen
      `src/ui/` ni `src/platform/`, que llega webpack o Vite). **Se cierra cuando** su ficha se
      reescribe o se borra, por el usuario: `.claude/agents/` está denegado a Claude.
- [ ] **C3. Un agente que verifica** *(el usuario, en `.claude/agents/`)*: lee el cambio de otro,
      rompe a propósito y pasa las listas, sin haber escrito el código. Quien escribe no se da el
      visto bueno. **En el aire**, con el resto del uso de agentes.
      **Se cierra cuando** el usuario decide si existe; si es que sí, con su ficha y una pasada real
      sobre un cambio.
- ~~**C4. Ramas, *pull requests* y CI en los PR**~~ — ❌ **descartada por el usuario el
      2026-10-13**: no hay `push` a otras ramas.
- [x] **C5. Pasar las listas manuales con el navegador del panel.** ✅ *(2026-10-17: E5 e I6, en
      el móvil, por el usuario, que ya los había probado; anotados en la lista con su palabra)*. La primera, la de la copia
      (`test/ui/VERIFICACION-MANUAL-COPIA.md`), la deuda de la Versión 1. **Pasada por Claude el
      2026-10-17, anotada en la lista:** 20 de 22 pasos, 10 de ellos simulados (los diálogos del
      sistema, sustituidos dentro de la página: E3 y E4, que parecían imposibles, también) y F
      entera, que el plan daba por imposible en el panel. Sin un solo ❌ de la app; **dos fallos
      de la lista**, corregidos en ella: F4 no salía sin vaciar antes el origen, y el script de F
      no llenaba nada en un navegador con más de 20 millones de caracteres (el panel admite unos
      52). La forma de pasarlas, escrita en `test/PASAR-LAS-LISTAS.md`, y `web-8001` en
      `.claude/launch.json` para lo que borra. **Salieron de paso** una tarea nueva (el `default`
      de `insert` y del reducer, en *Sin fase asignada*) y dos cosas para E1: el panel **sí**
      registra *service workers*, y la publicada se puso al día en silencio con una recarga.
      **Se cierra cuando** el usuario pasa en el móvil E5 e I6 y quedan anotados en la lista.

#### D. Limpieza

- [ ] **D1. Los *worktrees* viejos** — **hecho salvo el de esta fase** *(2026-10-17)*. Comprobado
      con `git log main..rama` que las tres ramas `claude/*` (`agitated-franklin-6f5c2d`,
      `eloquent-mayer-7cf937` y `youthful-rubin-e5263b`) no tenían nada fuera de `main`, y que el
      worktree `eloquent-mayer-7cf937` no tenía nada sin comitear: el worktree, quitado con `git
      worktree remove`, y las ramas, con `git branch -d`, que se niega si falta algo por fusionar.
      Con el visto bueno del usuario, también `checkout`, `fase-8-terminal` y
      `feat/volver-a-lo-abierto`, enteras en `main`: quedan `main` y `fase-9-meta`.
      Queda `agitated-franklin-6f5c2d`, que es donde se trabaja la fase (`fase-9-meta`). **Se
      cierra cuando**, acabada la fase, se quita desde la carpeta principal y `git worktree list`
      sólo muestra esa carpeta.
- [x] **D2. Las dos cabeceras que nombran a Drive** y el `--noResolve` de
      `test/storage/blobs/VERIFICACION-MANUAL.md` ✅ *(2026-10-17)*. Fuera Drive de
      `src/core/ports/BlobStore.ts` y `src/storage/file/FileStorageAdapter.ts` (`grep -rn Drive
      src` no da nada). El `--noResolve` dice ahora su motivo de verdad —sin él, `tsc` sigue
      `#core/index` y compila el core entero, y la página sólo necesita `err` y `ok`— y el número
      de errores que imprime: dos, no siete, comprobado compilando como dice el paso, sin cambiar
      los pasos. `DirectoryHandleBlobStore.ts` no se tocó: su lista no hay que repasarla.
- [x] **D3. El `unobserve` de los pósits borrados** ✅ *(2026-10-17)*. `reconcile` gana un paso
      opcional, `remove`, que llega con cada elemento que sobra **antes** de quitarlo, y el lienzo
      lo usa para `tamanos.unobserve`. `reconcile` es pura: una prueba nueva (846) y dos roturas
      en la lista (no avisar; avisar después de quitar), cazadas. Lo del DOM, comprobado en el
      panel: con dos pósits vigilados, borrar uno deja de vigilar justo ése y sigue con el otro.
      Paso nuevo en `test/ui/VERIFICACION-MANUAL-LIENZO.md`, C9.

#### E. Documentación, en un solo pase al cerrar

**Al final de la fase, con todo lo demás hecho, y E2 antes que E1** *(el usuario, 2026-10-13)*:
E2 rehace las referencias `§` de `CLAUDE.md`, y E1 adelgaza `CLAUDE.md` sobre lo que quede.

- [x] **E1. `CLAUDE.md` pasa a «lo que nada automático vigila»** ✅ *(2026-10-17)*. **Hecho:**
      fuera las treinta y tres fronteras contadas a mano, las pruebas de cada fase y la historia del
      plan (a `TAREAS.md`); cada guardián, una línea con su comando, y los seis nuevos en
      *Comandos*, con `check:roturas` fuera de `check`; seis puertos (`Logger`), sin
      `platform/index.ts`, la rotura en su lista, Node por `.nvmrc`, los hooks, las listas que pasa
      Claude en el panel (que **sí** registra *service workers*); y, del informe de E2, fuera el
      helper, «Fase 1 = bajo `Versioned`» y los detalles del teclado, que fijan sus pruebas. Mide
      lo mismo (264 líneas frente a 267): sale lo que se desactualiza y entra lo que vigila.
      **Lo planteado:** fuera los recuentos que se
      desactualizan (pruebas, fronteras) y cada regla que gane guardián deja una línea con su
      comando. Con los guardianes y las opciones nuevas en *Comandos*, la fase en *Plan por fases*,
      y en *Decisiones cerradas* la precisión de «a mano»: también la puede pasar Claude en el panel.
      **Se cierra cuando** no queda ningún recuento en `CLAUDE.md`, están los guardianes en
      *Comandos* y las decisiones reabiertas en la fase (seis puertos, sin `platform/index.ts`, las
      fronteras, las roturas en su lista) están al día, y corregido «el del panel no registra
      *service workers*»: sí los registra (visto en C5).
- [x] **E2. `ARCHITECTURE.md`, de anatomía a fundamento** ✅ *(replanteada con el usuario y
      dada por terminada el 2026-10-17)*. **Hecho:** de 4.215 a 754 líneas; `check:arquitectura`
      en `check` y en el hook de editar un `.md`, con cuatro roturas cazadas (43 en la lista);
      las referencias `§` rehechas a mano, también las que no salían rotas pero ya apuntaban a otra
      cosa; el documento viejo, en `git show ef1bcc6:ARCHITECTURE.md`. **El informe:** casi todas
      las decisiones cerradas salen de un principio; las de producto no lo necesitan; cuatro huecos
      (`defaultView` sin uso, el porqué del «no monorepo», el helper y los detalles del teclado en
      `CLAUDE.md`), los dos últimos para E1. Las 12 `§` de `.claude/agents/back-dev-agent.md`, sin
      tocar: la carpeta está denegada a Claude.
      **Lo planteado:** Hoy tiene 4.215 líneas y 42 commits: describe cómo está hecho cada trozo y
      crece con cada funcionalidad, cuando debería ser casi estático. **La idea, del usuario:** el
      documento es el fundamento del que sale todo cambio, no el registro de cada decisión. **Se
      queda** lo que seguiría siendo verdad si mañana se reescribe esa parte del código: los
      principios con su porqué y los conceptos que hacen falta para entenderlos. **Fuera, sin
      mudarse a ningún sitio:** la anatomía (qué fichero hace qué, cómo se monta cada vista), que
      ya la cuentan el código, sus cabeceras y las pruebas; las decisiones de cada funcionalidad,
      sin porqué escrito aparte (las reglas de una línea siguen en `CLAUDE.md`, y su historia en
      `git log`); y la crónica, que está en `TAREAS.md` y `git log`. Una decisión que no se
      explica desde ningún principio no pide un porqué: o falta un principio o sobra la decisión.
      **Los criterios, aprobados por el usuario:** en un guardián dentro de `check`, (1) no nombra
      ficheros de `src/` ni de `test/`, (2) ni fechas ni «Fase N», (3) 800 líneas como mucho, y de
      paso ninguna referencia `§` rota en los `.md`; validados por Claude, con un informe, (4) cada
      decisión cerrada de `CLAUDE.md` se explica desde algún principio, y las que no se le enseñan
      al usuario, y (5) lo que se quita está en el código y las pruebas, en `git log`, o no hacía
      falta. Las referencias `§` de `CLAUDE.md`, `TAREAS.md`, las listas manuales y el código se
      rehacen a la vez. **Se cierra cuando** el guardián está en `check` con su rotura cazada, el
      documento lo pasa y el informe de (4) y (5) se le ha enseñado al usuario.

**Fuera de esta fase:** las tres preguntas del editor, la otra deuda de la Versión 1, siguen como
estaban. Partir
`DiagramCanvas.ts` y renombrar `NoteList` son código de la app y se hacen al tocar esa zona.

### La nube: copia de seguridad y sincronización con Supabase — DISEÑADA el 2026-10-12, sin fase

Decidida con el usuario el 2026-10-12, en una conversación. **Sin fase asignada y sin una línea de
código.** Lo que tenga de principio pasa a `ARCHITECTURE.md` (§6) cuando se construya; hasta entonces vive aquí.
**Para qué, las dos cosas:** copia de seguridad, y las mismas notas en el móvil (Android, la PWA) y
en el ordenador.

**Decidido:**

- **Manda el modelo, no el fichero.** Una nota es un dato estructurado —ids de línea, `revision`,
  reglas de casillas—, y un fichero o una fila es su copia guardada. «Manda el fichero», al estilo
  Obsidian, sería refundar el core. Consecuencia: **la nube es una base de datos**, no un sitio de
  ficheros. Markdown, sólo para exportar (ver *Sin fase asignada*).
- **Supabase** (Postgres gestionado). Es la única base de datos a la que el navegador llega **sin
  servidor propio**: habla HTTPS y trae de serie el inicio de sesión y las reglas por usuario (*Row
  Level Security*). El usuario no quiere mantener un servidor.
- **Una fila por entidad, con su JSON dentro** (id, tipo, `revision`, contenido, hora de escritura,
  marca de borrado). Es el mismo grano que los ficheros de hoy, y `schema.ts` sirve igual para
  validar lo que baja.
- **La forma:** el core habla sólo con lo local, como hoy, y **un sincronizador** se pone entre lo
  local y la nube. El core no sabe que Supabase existe. **Todo lo que baja entra por el core**, con
  una acción nueva («aplicar lo remoto»), y nunca se escribe directamente en `localStorage`: si no,
  la pantalla no se entera y el `writeBehind` lo pisaría con lo que tiene en memoria. **Reparto:**
  la acción y la política de conflictos, en `core/`; el adaptador y el sincronizador, en `storage/`;
  cuándo sincronizar, la sesión y ⚙, en `platform/web/`. Sin `CompositeStorage`.
- **Un puerto nuevo, sin nada de Supabase dentro**, en vez de ampliar `StorageAdapter`. Tres
  operaciones: «dame lo que cambió desde este punto» (los cambios y un punto nuevo, opaco), «sube
  esto si la revisión remota sigue siendo X» (ok, o `stale` con la versión remota) y «borra esto si
  sigue siendo X». En Supabase **el punto es la hora del servidor**, no la del dispositivo, así que
  los relojes desajustados no importan; y **los borrados son marcas**, no filas quitadas, para que el
  otro dispositivo se entere. Sin Supabase dentro para que mañana lo cumpla otro transporte (el
  peer-to-peer de *Ideas aparcadas*).
- **El estado de sincronización, persistido en local** (que fuera dato ya estaba decidido): por
  cada entidad, **la última revisión sincronizada**, y los ids borrados pendientes de subir. Una
  entidad está pendiente si su revisión local es distinta de la sincronizada. Son unos bytes por
  nota: **cabe en `localStorage`**.
- **El eco**, resuelto con eso mismo: «aplicar lo remoto» **conserva la revisión que trae**; el
  sincronizador la apunta como sincronizada y no la vuelve a subir. Sin marcas especiales.
- **Conflictos: copia en conflicto.** Si al subir sale `stale`, la versión remota queda como la
  oficial y la local se guarda como una entidad nueva, «‹nombre› (conflicto)», en los mismos
  contextos; los nodos de diagrama siguen apuntando a la original. Así para notas y diagramas. **En
  los contextos, se suman las referencias de los dos lados**: una quitada puede reaparecer, y eso
  molesta pero no pierde nada. **Editar gana a borrar:** lo borrado en un lado y editado en el otro
  sigue vivo. **Nunca se pierde nada, y no se guarda la versión base.** El usuario eligió primero la
  fusión a tres bandas y la cambió por ésta: en una app personal el conflicto es raro —sin
  conexión, la pausa de Supabase, un dispositivo que no se ha puesto al día—, y la fusión cuesta
  mucho (guardar la base duplica lo local, y la función de fusión es la pieza más cara). Aparcada
  abajo, con lo que se decidió de ella.
- **Lo local sigue mandando en cada dispositivo**, y la app funciona sin red.
- **ElNotas sigue sin cuentas: abrir la app no pide nada, nunca.** La conexión vive en ⚙, en una
  sección «Nube» con la lista de servicios (hoy, Supabase). Cada servicio tiene conectar,
  desconectar, estado y su adaptador. **Conectar se hace una vez:** la dirección y la clave pública
  del proyecto (públicas por diseño; lo que protege las notas son las reglas de la base, y no van en
  el repo), y **un código de 6 cifras por correo**. El código sirve en cualquier navegador; el enlace
  por correo también valdría en Android, pero obliga a gestionar la vuelta a la app.
- **La sesión (el token de renovación) se guarda en el navegador**, sin cifrar por ahora. **Cambia
  la regla de `CLAUDE.md`**, que decía «token en memoria». Si caduca, la app sigue en local, la cola
  espera y ⚙ ofrece «Reconectar», sin interrumpir.
- **«Quitar»** desconecta, invalida la sesión en Supabase y la olvida. La copia remota se queda.
- **El código, incluido pero dormido**: se activa en ⚙. Sin `import()` dinámico, que reabriría la
  actualización en silencio de la PWA (§8.6).
- **La pausa del plan gratuito** (una semana sin actividad): **una tarea programada en GitHub
  Actions** que hace una consulta cada pocos días, con la dirección del proyecto en los *secrets*
  del repo. El aviso «la nube no responde» en ⚙, igualmente, por si la tarea falla.
- **Se sigue con la PWA.** Capacitor o Tauri, más adelante y como complemento, no como sustituto.

**Sin fase por ahora** *(el usuario, 2026-10-17)*. Lo de abajo, salvo asignarle fase, no son
tareas pendientes: es lo que hay que hacer **al construirla**, y entonces cada punto pasa a ser
una tarea con su cierre.

**Propuesto, sin objeción del usuario, por confirmar al construir:**

- **«Borrar todo» se lleva también la conexión**, porque borra las claves `elnotas:`.

**Por comprobar antes de construir**, porque se dijo de memoria:

- Qué cuenta como «actividad» para la pausa de Supabase, y si basta con la consulta de la tarea.
- Que GitHub desactiva las tareas programadas de un repo público tras 60 días sin actividad, y
      qué se hace entonces (reactivarla a mano, con el aviso por correo).
- El inicio de sesión de Supabase con `fetch` y sin su librería: el código por correo, la
      renovación del token y su rotación.
- Que Supabase acepta peticiones desde `ildartashtekov.github.io` (CORS).

- [ ] **Asignarle fase**, con el usuario. **Se cierra cuando** el usuario se la asigna.

### Sin fase asignada

- [x] **Exportar e importar las notas (JSON)** ✅ *(construida el 2026-10-12 en la rama
      `feat/backup`, con **803 pruebas**, y probada por el usuario ese día: «funciona perfecto»)*.
      Fuera de la Fase 6 por decisión del usuario el 2026-10-08; hacía falta porque las notas
      viven sólo en el `localStorage` de **un origen** y `persist()` no protege de que se borren a
      mano. En ⚙ → Datos, **Exportar copia** (con «Guardar como» si el navegador lo tiene; si no, a
      Descargas) e **Importar copia**, que **sustituye todo** tras un ensayo y una pregunta. Lleva
      los ficheros guardados tal cual, las ventanas y el fósforo (y desde el 2026-10-13, los
      encuadres de los diagramas). Sin dependencias y sin tocar el core. Mezclar en vez de sustituir, aparcado (*Ideas aparcadas*). Diseño y porqués, en
      el `ARCHITECTURE.md` viejo.
  - Su lista manual, por pasar: ahora es **C5** de la Fase 9.
- [x] **Ventanas, hueco y encuadre** ✅ *(pedido por el usuario el 2026-10-13 y construido ese día
      en la rama `feat/ventanas-hueco-encuadre`, con **828 pruebas** —eran 803—; validado por él en
      el móvil)*. Sin dependencias y sin tocar el core. Cuatro cosas:
  - **⚙ → Ventanas ofrece lo mismo que el «+» de la última ventana**: contexto, nota o diagrama
    nuevos, con `newWindowButtons.ts` para los dos. Desde ⚙ se quedan con su nombre por defecto.
    **Cambia la decisión «en ⚙, sólo contexto»**.
  - **Tocar el hueco de la nota**: vacía, empieza a escribir; con líneas, cursor al final de la
    última que se ve (`lastLine`).
  - **El encuadre de cada diagrama se recuerda**, en el dispositivo (`elnotas:framing`), y **entra
    en la copia** sin subir `backupVersion`. **Cambia la decisión «el encuadre no se recuerda»**;
    el usuario eligió la opción B (en el dispositivo) frente a A (en memoria) y C (dentro del
    diagrama). Dos fronteras nuevas: de 29 a 31.
  - **La mira**, que vuelve al origen a ×1: en la barra de la vista diagrama, y flotando abajo a la
    derecha en una ventana de diagrama.

  Cada guarda se verificó rompiéndola a propósito: `guardFramings`, el `sucio`, el centro en
  `framingOf`, importar, leer y exportar sin encuadres, `lastLine` y el nombre del contexto en
  `createAsWindow`. Listas manuales al día en `test/ui/`: `VERIFICACION-SENTADA.md` y las de
  editor, lienzo y copia.
- [x] **Volver a lo abierto al recargar** ✅ *(pedido por el usuario el 2026-10-13, tras la
      `v1.0.0`, y construido ese día con **844 pruebas** —eran 828—; validado por él en el móvil)*. Al volver a la app después
      de que el móvil la cerrara en segundo plano, se veía la ventana —el diagrama— y no la nota
      que había encima. Ahora se guarda lo abierto encima en `elnotas:capas` y se reabre al
      arrancar, con su atrás; ⚙ no. **Cambia la decisión «lo de encima no se recuerda»**; el
      usuario eligió `localStorage` (A) frente a `sessionStorage` (B). Dos fronteras nuevas: de 31
      a 33. Sin dependencias y sin tocar el core.

  Cada guarda se verificó rompiéndola a propósito: el corte de lo borrado, la identidad, la forma
  de las capas y la guarda al arrancar. Probado en el navegador del panel: nota sola, nota encima
  de un diagrama y el atrás tras recargar.
  - [x] **Pasar la lista manual**, `test/ui/VERIFICACION-MANUAL-CAPAS.md` ✅ *(validado por el
        usuario en el móvil el 2026-10-13, por la red de casa y sin instalar)*. No se anotó paso
        a paso; C6 con la app instalada, al probar la copia publicada.
- [ ] **Exportar a Markdown**, legible y **sólo hacia fuera**. Desde el 2026-10-12, con «manda el
      modelo» (ver *La nube*): así no hacen falta ni los ids de línea, ni escapar lo que parece
      Markdown, ni decidir qué pasa con lo editado fuera. Importar `.md`, si llega, crearía notas
      nuevas, sin ida y vuelta. Es otra cosa que la copia: el JSON es para restaurar, el Markdown
      para leer, y los diagramas no caben en él.
      **Se cierra cuando** la conversión de una nota a Markdown tiene sus pruebas, el botón de ⚙
      descarga el fichero y la lista manual tiene su paso.
- [x] ✅ *Hecha en la Fase 9 (A2), con la 26.* **Pasar de Node 20 a uno con soporte**, en casa y en la receta de publicación
      (`.github/workflows/publicar.yml`) a la vez. Node 20 dejó de tener soporte en abril de 2026;
      la Fase 6 lo dejó en 20 porque es el de casa y con el que pasan las pruebas. Se cierra
      cuando las dos digan lo mismo y `npm run check` siga en verde.
- [ ] **Los colores de la app, repetidos fuera de `base.css`**: el azul `#3552d6` (`--accent`) está
      también en el `background_color` de `manifest.webmanifest` (la pantalla de carga), porque el
      manifiesto no lee variables de CSS. Si cambia `--accent`, hay que cambiarlo a mano. Desde
      el 2026-10-11 es el único sitio: la `theme-color` de `index.html` y el `theme_color` se
      quitaron (Fase 7). Se cierra con una comprobación en `build:pages` que falle si no
      coinciden, o decidiendo con el usuario que se aguanta. **La Fase 8 lo cambia de valor**:
      pasa a ser el negro de `--ground`, sigue repetido.
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
      **Se cierra cuando** el usuario decide cómo se guarda el formato y cómo se aplica: entonces se
      parte en tareas propias, cada una con su cierre.

- [ ] **Que una posición o una acción desconocidas no hagan nada** *(salió pasando la lista de la
      copia el 2026-10-17)*. El `default` del `switch` de `insert` (`src/core/domain/operations.ts`)
      devuelve **la posición** como si fuera el contenido, y el del reducer
      (`src/core/app/reduce.ts`) devuelve **la acción** como si fuera el estado. El tipo lo
      impide desde el código (no compila), pero llegando sin tipos —la consola con `?depurar`,
      o algo que un día lea sin validar— la nota, o la app entera, quedan estropeadas en disco, en
      vez de cumplir «una operación que no aplica no hace nada». Visto con `?depurar`: una
      posición mal escrita guardó `"content": {"kind": "root-end"}`. **Se cierra cuando** los dos
      devuelven lo que recibieron (el contenido, el estado) sin perder la comprobación de que el
      `switch` cubre todos los casos, con una prueba de cada uno que pase un valor desconocido a
      la fuerza y su rotura en `tools/roturas.mjs`.

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
      después. Desaparecen tres listas negras y los ayudantes pierden el `.test`. §8.3.
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
      `ARCHITECTURE.md` en vez de borrarse. La regla, en `CLAUDE.md`; §8.7.
- [x] **`.js` en los imports relativos de `src/` y `check:extensiones`** (`1037ea1`), porque el
      `importmap` sólo resuelve los alias. §8.2.
- [x] **`npm run build:web` e `index.html`** (`473f566`): `src/` a `dist/web/` en ESM, sin bundler.
- [x] **Una declaración sin tipo en `test/ui/editor.test.ts`** *(de `back-dev-agent`)*. ✅ Hecho
      en `5e49a5a` (2026-09-29): `const NOTA: NoteId = noteId("nota")`, comprobado en el fichero.

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

- [ ] **`Context.defaultView`, sin uso** *(salió en E2 de la Fase 9, 2026-10-17)*. Sigue en el
      modelo con su acción `set-default-view`, y nadie lo usa desde que una ventana puede ser una
      nota o un diagrama. Choca con el principio de que lo que deja de usarse se quita
      (`ARCHITECTURE.md` §5). O se acepta como excepción, o se quita, y quitarlo toca el core, el
      reducer, las pruebas y el formato en disco.
      **Se cierra cuando** el usuario elige: excepción, escrita en *Decisiones cerradas* de
      `CLAUDE.md`, o una tarea con fase para quitarlo.
- [ ] **El porqué de «carpetas con `tsconfig`, no monorepo»** *(salió en E2 de la Fase 9,
      2026-10-17)*. Es una decisión cerrada de `CLAUDE.md` cuyo motivo nunca se escribió.
      **Se cierra cuando** el usuario da el porqué y entra en `ARCHITECTURE.md` §8.1, o decide que
      se queda como decisión sin porqué escrito.

### Cerradas, en una línea

Registro de lo que estuvo abierto y cómo se cerró. El principio del que sale, en la sección de
`ARCHITECTURE.md` que se cita; el detalle de entonces, en el `ARCHITECTURE.md` viejo.

- **Las siete de la Fase 1** — ✅ cerradas las siete. Las letras no se reciclan, porque
  el `ARCHITECTURE.md` viejo las cita: **(a)** `indent` sobre un texto, **(c)** el ciclo de `move` y
  **(g)** los hermanos al hacer `outdent`, cerradas por eliminación —esas operaciones no existen—;
  **(b)** `remove` sobre una casilla con hijas es no-op; **(d)** `Position` tiene tres casos;
  **(e)** el helper son dos primitivas; **(f)** las operaciones son ocho.
- **Del editor (Fase 4)** — ✅ las siete, el 2026-09-20: anidar se consume y actúa sobre la línea
  **siguiente**, con un botón aparte; las cuatro esquinas del teclado, tal cual; el nombre
  `WritingMode` (público en inglés, maquinaria interna en castellano); el alcance de `onCorrupt`,
  `onError` y la validación; y `LocalStorageBlobStore` para salir del paso. Ni una línea del
  núcleo.
- **De la navegación y el alcance (Fase 4)** — ✅ el 2026-09-27: sin bundler de entrada; `onError`
  y la validación al final de Fase 4 · Notas; el aviso de `onError` sólo informa; las ventanas, en
  `localStorage` (opción C; la B, aparcada); la fase partida en Contextos y Notas; «Mover a…»
  mueve; al recargar se recuerda sólo la ventana activa *(desde el 2026-10-13, también la nota o el
  diagrama de encima: Sin fase asignada)*; una nota vacía se mantiene.
- **Al construir el editor y las ventanas (Fase 4)** — ✅ el 2026-09-29, una a una con el usuario:
  `.js` en los imports (opción A); el interruptor «☐ Casilla»; Intro en un texto crea con `after`;
  los cuatro huecos del teclado; ventanas sin nada guardado, duplicadas y sin aviso al fallar; varias
  notas con el mismo nombre. Y un bloque de decisiones de implementación **aceptadas en bloque**,
  que no son accidentes: estaban en el `ARCHITECTURE.md` viejo.
- **De los Diagramas (Fase 5)** — ✅ el 2026-10-03: lienzo libre, `DiagramRelation` en un
  multigrafo, «Nota perdida», vista mixta desde cero, «doble = menú o crear», la nota nueva en todos
  los contextos del diagrama, un nivel más de navegación, y la fase partida en tres.
- **Dos decisiones cerradas que el usuario cambió el 2026-10-13** — ✅ **⚙ crea lo mismo que el
  «+»** (antes, sólo contexto), para que los dos sitios ofrezcan lo mismo; y **el encuadre del
  diagrama se recuerda** (antes, no), en el dispositivo (opción B; descartadas A, en memoria, y C,
  dentro del diagrama, que tocaba el core y el formato y no sirve entre pantallas distintas), y va
  en la copia.
- **Escritura condicional y conflicto entre dos pestañas** — ✅ decidida y construida el
  2026-10-03: la opción c, escritura condicional con `revision`, porque es la que se reutilizará con
  la sincronización; ante `stale`, avisar y ofrecer Recargar. Descartadas **a** (una sola pestaña
  con Web Locks), **b** (recargar con el evento `storage`), **d** (b + c) y *guardar como copia en
  conflicto*. §6.5.
- **La justificación escrita de `schemaVersion`** — ✅ la real: `schemaVersion` *es* el mecanismo
  de migración y llega con el runner; vive en `StorageAdapter`, no en `AppState`. §6.1.
- **El arranque de la app no tenía fase** — ✅ tenía dos: la mitad pura en la Fase 2 y `boot.ts`
  en la Fase 4 (`473f566`).
- **Cómo se verifica la Fase 3** — ✅ a mano, con una lista escrita en el repo, y sin runner de
  navegador. Lo que no se automatiza es `DirectoryHandleBlobStore`, sin lógica interesante: un
  doble prueba **lo que uno cree que hace la API** —un `Map` pasa en verde con el `close()`
  olvidado—, y ese fichero se ejercita solo cada vez que se usa la app; la verificación automática
  se reserva para lo que falla **en silencio**. Precio: un cambio de la API lo caza el uso, no una
  prueba. Qué lo reabriría, en *Ideas aparcadas* (el runner de navegador). §6.3.

### Qué devuelven los casos de uso — ✅ **cerrada y CONSTRUIDA: la entidad protagonista, o `null`**

El registro, en un párrafo. **Construida
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
  hijas se borra una a una. §5.
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
índice (§6.1). El de OPFS **sigue sin contestarse formalmente**:

- **¿Entra OPFS en la Fase 3? — LA ÚNICA QUE SIGUE ABIERTA.** El `ARCHITECTURE.md` viejo decía que es **la misma**
  `DirectoryHandleBlobStore` y que lo único que cambia es **cómo se consigue el handle**
  (`showDirectoryPicker()` frente a `navigator.storage.getDirectory()`). Si eso es «quién abre el
  storage», es composición y cae en la Fase 4; si se considera parte del adaptador,
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
| **Manejar el lienzo con teclado**, y reordenar las fichas de ⚙ con teclado | El usuario lo dejó para más adelante (Fase 5); no bloqueaba nada. | Que lo pida el usuario. |
| **Anotar los tipos en las pruebas viejas** (942 anotaciones de `test/core/` y `test/storage/`, medido el 2026-09-19) | Deuda aceptada a sabiendas: trabajo mecánico que no caza ningún fallo, con un diff irrevisable. Lo que se escribe o se toca ya cumple la regla, y eso impide que crezca. | Tocar esas pruebas por otro motivo: lo que se toque, se anota. |
| **Reordenar y re-anidar líneas** (`move`, y con ella `indent`/`outdent`) | No hay quien lo use: sin gesto de arrastrar, `move` no tiene consumidor, y el Tabulador no existe en un móvil. Hoy una lista se queda en el orden en que se escribió, y arreglarla es borrar y reescribir. | Llegar a la Fase 4 y **echarlo de menos con el editor delante**. Es puramente añadido —no cambia ninguna operación, ni el formato en disco, ni obliga a migrar—, así que cuesta lo mismo entonces que hoy. Ojo a dos cosas ese día: hace falta un cuarto caso de `Position` (`before`, para "la primera del todo"), y `move` **no** puede escribirse como `remove` + `insert` o heredaría la guarda de las casillas con hijas. |
| **Adaptador de MongoDB** (o cualquier base de datos con servidor propio) | Requiere un backend HTTP propio: el driver de Mongo habla TCP y no funciona desde navegador, y la Data API de Atlas está retirada. **Reconsiderado el 2026-10-12** al elegir la nube, y lo mismo vale para SQL con servidor propio: el usuario no quiere mantener un servidor, así que se eligió Supabase (*Pendiente → La nube*). | Que hubiera ya un backend propio por otro motivo. Montar uno solo para esto no sale a cuenta. |
| ~~**Adaptador de Google Drive**~~ — ❌ **descartado el 2026-10-12** | Drive guarda **ficheros**, y la app es de «manda el modelo» (*Pendiente → La nube*): una base de datos da de serie la escritura condicional y el «qué cambió desde…», que sobre Drive habría que construir. Además, sin servidor la sesión dura una hora y no se renueva sola. **Una carpeta pública no lo arregla:** escribir **siempre** exige OAuth (scope `drive.file`), y lo público deja las notas a la vista de quien tenga el enlace. **Tampoco SQLite dentro de Drive:** se sube y se baja el fichero entero, y dos dispositivos se pisan la base completa. | Que se reabra «manda el fichero». Ese día un `DriveBlobStore` encaja tal cual bajo `FileStorageAdapter`. |
| ~~**`CompositeStorage` y outbox durable**~~ — ✅ **ya no está aparcado: diseñado el 2026-10-12** | Estaba aquí por falta de un segundo backend. | **Desbloqueado por la nube** (*Pendiente → La nube*), pero con otra forma: no hay `CompositeStorage` repartiendo cada escritura entre réplicas. El core habla sólo con lo local, y un sincronizador sube lo pendiente (la cola) y baja lo nuevo, que entra por el core. |
| **`storageTarget` por contexto** (enrutar notas privadas a un backend concreto) | Presupone varios backends, que no existen. | Lo mismo que el anterior, más una necesidad real de separar notas por destino. |
| **Cambiar `LocalStorageBlobStore` por IndexedDB**, o por una base ligera (SQLite compilado a wasm, o similar) | Como tecnología, IndexedDB gana casi en todo —cuota de cientos de MB frente a ~5 MB, `Uint8Array` nativo frente al base64 que cuesta un 33% más, asíncrona de verdad cuando el puerto ya es `async`—, y aun así no compensa, por tres motivos. **(1) El hueco ya está ocupado:** "almacén grande, privado del origen, sin diálogo y con bytes nativos" es **OPFS**, que ya está construido y es el mismo `DirectoryHandleBlobStore` con otro handle. Un `IndexedDbBlobStore` sería una cuarta implementación duplicando a una existente, en el mismo *bucket* de cuota. **(2) El valor de `localStorage` aquí no es guardar, es que se puede falsear honradamente en Node**: Node no tiene ninguna de las dos, y el `Storage` falso son **52 líneas que además saben lanzar la excepción de cuota**. De ahí cuelga **la tercera pasada de la suite de contratos** (§6.3), la que monta la pila entera sobre un `BlobStore` de producción y que se ganó el sitio cazando fallos que las otras dos no veían (5 de 7 y 3 de 6, medidos). Falsear IndexedDB no son 52 líneas; sería `fake-indexeddb` —una dependencia, contra la política— o quedarse sin esa pasada. **(3) Una base ligera no es un `BlobStore` siquiera:** sustituiría a `StorageAdapter` entero, y choca de frente con el formato en disco (§6.1) y con "un fichero por entidad", que es decisión cerrada. Además arrastra ~1 MB de wasm en un proyecto de cero dependencias de runtime. | Que los ~5 MB **aprieten de verdad** — y ese día la respuesta sigue siendo **OPFS primero**, que no cuesta código. O que aparezca una necesidad que sólo una base cubre: consultas por contenido, índices, búsqueda de texto completo. Nada de eso tiene consumidor mientras `getAll` sea N lecturas al arrancar. **No confundir con lo que sí está planificado:** IndexedDB **entrará** para **guardar el handle de la carpeta** y hacer posible el botón de "reconectar carpeta"; eso no es esta idea y no está aparcado. *(Aquí decía «entra en la Fase 4»; desde el 2026-09-20 la carpeta del usuario como destino está fuera de la Fase 4, así que entra el día que lo haga ella.)* Verificado el 2026-09-13 en el andamio de la verificación manual: el handle vuelve tras recargar, con el permiso intacto y sin diálogo. **Reconsiderado el 2026-10-12** con «manda el modelo» y Postgres en la nube, y la conclusión no cambia: SQLite en el navegador es posible (wasm sobre OPFS, en un *Worker*), pero sin búsqueda ni volumen no tiene consumidor. Y «un fichero por entidad» se relee como **un documento por entidad**: lo que decide es el grano, no que sea un fichero. |
| **Replantear los efectos que no devuelven nada en clave más funcional** (el `Listener` del `Store` como flujo, `Cancel`/`Unsubscribe` con ámbito) | Salió de un inventario de **todas las funciones que devuelven `void`** en `src/core` y `src/storage`, hecho el 2026-09-19. **Ese inventario ya dio un arreglo real y está construido**: los casos de uso devolvían `void` y ahora devuelven la entidad o `null`. Lo que queda no es el mismo caso, y el criterio que los separa es el que hay que conservar: **¿la vuelta llevaría información que NO se deduce de los argumentos?** `dispatch(action)` no se deducía —lo decide el reducer—, y por eso valía la pena. `setItem(k, v)` se deduce entero: después de eso `k` vale `v`, así que devolver algo sería devolverle al llamante lo que él trajo. `clearTimeout` deja un solo bit —«¿seguía pendiente?»— que **ningún** sitio de los tres que cancelan miraría. **Y la reformulación buena no es cambiar retornos, son otras dos, las dos con su pega: (1) el `Listener` como flujo de estados**, con el write-behind convertido en un `scan` en vez de un objeto con cuatro variables mutables — pero eso **no elimina el `void`, lo centraliza**, y el `Store` ya tiene esa propiedad por otro camino («la única mutación del proyecto»); además construir el flujo a mano choca con cero dependencias y `rxjs` es justo lo que no se instala aquí. **(2) `Cancel` y `Unsubscribe` con adquirir-y-liberar por ámbito**, que es la forma funcional de un recurso — pero **no encaja con el debounce**, que necesita cancelar y reprogramar desde fuera en cada tecla: la vida de ese temporizador no es un bloque, es una carrera contra la siguiente pulsación. | **La Fase 4**, y en concreto el punto en que haya **dos suscriptores** (la UI y la persistencia) en vez de uno: es cuando un flujo empieza a pagar y se puede decidir con el caso delante. Ese día hay que resolver antes lo de cero dependencias. ⚠️ **Desde la Fase 4 hay dos suscriptores** —la UI y el write-behind— y esto **no se ha reabierto**: la UI se escribió con el `Listener` tal cual. **No confundir con el caso que quedaba vivo del mismo inventario:** el `void flush()` del write-behind, donde el error del flush automático no lo veía nadie — no se arreglaba con un retorno porque **no hay quien llame, es un temporizador**, y su arreglo fue el `onError`, **hecho en la Fase 4** (`f406d96`). |
| ~~**El editor de grafos de los Diagramas**~~ — ✅ **ya no está aparcado: planificado el 2026-10-03** | Estaba aquí porque no tenía diseño: el boceto del usuario decía que aún no sabía cómo plantear la interfaz. | **Desbloqueada:** cerró la Fase 4 y se planificó la 5 —un lienzo libre, partido en Modelo, Lienzo y Relaciones— en el `ARCHITECTURE.md` viejo y en *Pendiente*. Lo que estaba anotado aquí, que `Diagram.nodes` pasara de array a `Record`, entra en Fase 5 · Modelo. |
| **Una librería pequeña sólo para mover y acercar el lienzo** (pan/zoom, sin dependencias propias) | Decidido el 2026-10-03 hacer el lienzo **desde cero**: las librerías de lienzo completas exigen React o guardan su propio estado, y mover y acercar son unas pocas cuentas puras que se prueban en Node. | **Que el pellizco o el arrastre no se dejen domar en el móvil real.** El lienzo se hizo sin ella, y **aún no se ha probado en el móvil**: se sabrá al pasar su lista, que desde el 2026-10-04 va al final de la Fase 5, con las relaciones ya encima. Ese día se evalúa una que haga **sólo** eso y no guarde estado; sería la primera dependencia de runtime, así que con el mismo cuidado que Snabbdom. |
| **Shells de escritorio y móvil (Tauri / Capacitor)** | Envuelven el output del build web. Ese build existe desde la Fase 4 (`npm run build:web`, a `dist/web/`), y desde la Fase 6 se publica como PWA, que ya da la app instalada en el móvil. | Era «una Fase 4 terminada», y ya se cumple. **Qué lo reabre ahora, sin decidir con el usuario.** Y ese es el momento de reconsiderar los workspaces de npm, no antes. **Desde el 2026-10-12, dos motivos con nombre:** el peer-to-peer automático (abajo) y guardar la sesión de la nube en el llavero del sistema. *Decidido ese día: se sigue con la PWA.* |
| ~~**Sync entre dispositivos**~~ — ✅ **diseñado el 2026-10-12** · **CRDTs y colaboración en tiempo real**, siguen aparcados | El sync, con su política de conflictos (copia en conflicto), está en *Pendiente → La nube*. Los CRDTs son un salto enorme de complejidad para un problema que en una app personal es raro. | CRDTs: colaborar con otras personas en la misma nota. |
| **Importar una copia mezclándola** con lo que hay, en vez de sustituir (con la copia en conflicto de *La nube*) | Estudiada el 2026-10-12 al construir la copia de seguridad, y el usuario eligió sustituir porque **mezclar toca el core** y sustituir no. Cómo sería: lo que no está, se añade; con la misma `revision`, nada; con otra, la local se queda como oficial y la de la copia entra como «‹nombre› (conflicto)», en los mismos contextos; los contextos suman referencias. Sus dos pegas: **restaurar una copia vieja llena la app de «(conflicto)»** —sin recordar qué `revision` se vio la última vez, una versión antigua de la nota no se distingue de una edición hecha en otro sitio— y **lo borrado reaparece**, porque no hay registro de borrados. Habría que añadir la regla de no repetir una copia «(conflicto)» con el mismo contenido, para que importar dos veces no duplique. | **Empezar la nube.** La acción «aplicar lo remoto» y su política de conflictos son la misma pieza del core que necesita el sincronizador: hecha para uno, la otra sale casi gratis, y entonces importar puede ofrecer «Sustituir todo» o «Añadir a lo que hay». O querer pasar notas entre dispositivos a mano con un fichero. |
| **Fusión a tres bandas en los conflictos** | Elegida primero por el usuario el 2026-10-12 y cambiada ese mismo día por la copia en conflicto: el conflicto es raro en una app personal, y la fusión exige **guardar la base** de cada entidad (lo local se duplica) y escribir la función de fusión, la pieza más cara del sync. Lo que se decidió de ella, por si vuelve: fusionar **por campos**; **editar gana a borrar** en todos los niveles; en un choque real (el mismo campo en los dos lados) **gana el más nuevo**, usando la `updatedAt` de la entidad y aceptando que se pierde la otra versión; las inserciones en el mismo sitio se quedan las dos, la más nueva primero; y en los diagramas, nodo a nodo y relación a relación. La facilitan los ids de línea, que no exista `move` y los `Record` del diagrama. ⚠️ «Gana el más nuevo» aquí **no** reabre el «gana el último» descartado: aquél era sobre la entidad entera; éste, sólo sobre el campo que chocó después de fusionar. | Que las copias en conflicto salgan **más de lo esperado** usando la app. Ese día se empieza a guardar la base; no hace falta migrar lo ya guardado. |
| **Sincronizar sin nube, entre pares** (*peer-to-peer*) | Preguntado el 2026-10-12, y al usuario le atraía más que la base de datos. Tres variantes, cada una con su pega. **(1) Manual, en la PWA, con WebRTC:** los dos dispositivos se presentan con QR, pero son **dos escaneos** (oferta y respuesta) **cada vez**, o un servicio público sólo para el saludo; y las dos apps abiertas a la vez. **(2) Automático** («enciendo el ordenador y se sincroniza»): una PWA no puede escuchar conexiones ni correr en segundo plano, y una página HTTPS no puede llamar a `http://192.168.x.x`. Pide **app nativa en los dos lados**. **(3) PWA más un servicio Kotlin aparte en cada dispositivo**, hablando por `localhost`: es la versión frágil de la (2). Chrome está poniendo permiso a que las webs públicas lleguen a la red local, Android exige una notificación fija para el segundo plano, y son dos programas más por dispositivo. Lo limpio es **Capacitor con plugins en Kotlin**, que es la (2). Ninguna da copia fuera de casa. | **(1):** querer prescindir de la nube y aceptar que sincronizar sea un gesto. **(2):** la app nativa (fila de los shells). Las dos entrarían como **un servicio más** en la sección «Nube» de ⚙, con el puerto sin Supabase dentro y la misma política de conflictos. |
| **Markdown como formato de guardado** | Preguntado el 2026-10-12. Una nota es un dato estructurado y un `.md` es texto libre: los ids de línea no tienen sitio, lo que el usuario escribe y parece Markdown hay que escaparlo, los diagramas y los contextos no caben, y si se edita fuera la app no lo entiende ni se entera (la `revision` no cambia). Con «manda el modelo», Markdown es **sólo para exportar** (*Sin fase asignada*). | Que se reabra «manda el fichero»: editar las notas en Obsidian o en cualquier editor. Es otro proyecto, no una ampliación del almacenamiento. |
| **Cifrar la sesión guardada de la nube** (con una llave de WebCrypto que no se puede sacar) | El 2026-10-12 se decidió guardar la sesión en el navegador sin cifrar. Cifrarla impide que copiar el almacén baste para llevarse el token, pero no protege de un script malicioso dentro de la app, que podría usar la llave. Hoy no hay código de terceros ni dependencias. | Que la app cargue código ajeno, o que se comparta con más gente. |
| **Un runner de navegador para las pruebas** (Playwright o similar) | Lo único que no se puede probar en Node es un fichero —`DirectoryHandleBlobStore`, 156 líneas de código— cuya parte larga es un clasificador de excepciones: probarlo con un doble es comprobar lo que uno *cree* que lanza la API. Y se ejercita solo cada vez que alguien usa la app. A cambio: cientos de megas frente a los 27 MB de hoy, y una cadena de herramientas más que mantener. | Que aparezca un **segundo** adaptador sobre navegador con lógica de verdad —el de Supabase, con su sesión y sus reintentos; hasta el 2026-10-12 decía «el de Drive»— o que ese fichero dé más de un sobresalto. Ese día se instala **sólo para esa fase**, coherente con la política de dependencias. |
| **Migrar de webpack a Vite** | ⚠️ **Superada el 2026-09-27:** webpack ya **no** es el bundler previsto para la Fase 4 — la fase arranca con el `importmap`, sin bundler. La elección entre bundlers no afecta a la arquitectura, así que no urge. | Que algo concreto exija un bundler. Ese día se comparan los que haya, no sólo estos dos; y se reinstala **sólo** el elegido. |
| **Las ventanas como entidad del core** (la opción B de el `ARCHITECTURE.md` viejo: algo como `Layout`, en su fichero junto a las notas) | Es la opción más limpia —una sola fuente, viaja con las notas, el reducer vigila la integridad—, pero reabre `StorageAdapter`, la suite de contratos, `FileStorageAdapter` y el catálogo de acciones, todo cerrado. Se eligió la C (`localStorage`) para salir del paso. | Que lleguen las **entidades «meta» de UX/UI** al core, que el usuario prevé; o que duela de verdad que las ventanas no viajen con las notas (un cambio de destino o de dispositivo). Ese día la guarda de la presentación se sustituye por la integridad del reducer. |
| **Revisar `Context.defaultView`** (y su acción `set-default-view`) | Se queda sin consumidor en la Fase 4: «abrir directamente una nota» lo hace ahora una ventana de tipo nota. No se quita porque el dominio está cerrado y quitarlo toca modelo, reducer, pruebas y formato en disco por algo que no molesta. | Lo mismo que la fila anterior: cuando lleguen las entidades «meta» de UX. Ahí se decide si se elimina o si recupera un sentido. |
| **Tres candidatas más para la barra de modo**: «al marcar una casilla, marcar también sus hijas», «esconder las marcadas», «mandar las marcadas al final» | Fuera de la Fase 4. Cumplen la regla de la barra (el `ARCHITECTURE.md` viejo), pero nadie las ha echado de menos todavía con un editor delante. | El mismo disparador que las tres preguntas del editor: **si usando el editor se echan en falta**, se reabren. La primera es además donde se compondría la cascada de `setChecked`, que irá plegada en una sola acción (§5). |
| **Un botón «reintentar» en el aviso de `onError`** | Con `localStorage` como destino no hay nada que reanudar, y está cerrado que un write-behind detenido no se reanuda. El aviso sólo informa. | Que el destino sea **la carpeta del usuario**: ahí reanudar sí significa algo —volver a pedir la carpeta— y va con el botón de «reconectar carpeta» (§6.5). |
| **Prototipo desechable del editor** (solo DOM, sin core y sin persistencia) | Es trabajo que se tira. ⚠️ **Matizada el 2026-09-20**, al plantearse hacerlo en una carpeta `/frontend-temporal`: lo desechable no sale gratis aquí. `src/scripts/` fue la prueba —el prototipo viejo siguió en el repo sin construirse hasta la Fase 4, y `CLAUDE.md` gastaba un párrafo por sesión diciendo que no se imitara—, y para arrancar cualquier cosa hacen falta `Clock`, `IdGenerator` y un arranque, que **son** `src/platform/`, o sea Fase 4 literal: se escribirían para tirarlos y se reescribirían igual. | **Partida en dos, que es lo que la resuelve.** *(a)* Para «¿encaja la pila entera?» un **script de Node** de ~100 líneas, sin navegador, ejecutable ya con `node --conditions=compiled`: ése sí es desechable de verdad. *(b)* Para «¿cómo se siente escribir?» **no vale código de usar y tirar**, porque lo que se descubre son las tres preguntas del editor y una respuesta obtenida con un juguete no cierra ninguna. Eso es el editor de Fase 4 · Notas, feo al principio pero en `src/ui/` y `src/platform/`. *(Hasta el 2026-09-27 decía «la primera rebanada vertical de la Fase 4»; desde que la fase se parte, esa rebanada es la de Contextos y no toca el editor.)* |
| **Tailwind, o cualquier CSS que pida compilación** (UnoCSS, Sass, CSS Modules) | Preguntado el 2026-10-03. Pide un paso de compilación y una dependencia, **duplica** las variables CSS que ya llevan los colores en claro y oscuro, y mete el estilo en el TypeScript (`className = "…"` con quince clases). Sass y CSS Modules, compilación también, y el anidamiento ya es nativo. Se hizo lo contrario: CSS nativo partido por vista en `src/ui/styles/`. | Que el CSS crezca hasta que **los choques de cascada** entre ficheros se vuelvan inmanejables, o que haya un equipo diseñando muchas pantallas. Ese día se mira primero **`@layer` por vista**, que es nativo. |
| **Snabbdom, o cualquier DOM virtual mínimo** | Preguntado el 2026-09-20. Es el **único candidato honesto** de todos los que se plantearon, porque aporta sólo *diffing* (~3 KB) y no duplica nada: el estado ya está resuelto. Aun así no ahora, y el motivo es el mismo que hace difícil a esta app — lo que describe §7, *reconciliar por `data-id`* y **saltarse el nodo enfocado**, es un vdom a mano recortado alrededor de la única excepción que un vdom genérico expresa mal. Daría el 90% y habría que pelearse con él justo en el 10% que decide si la app se siente bien. Sería además la **primera dependencia de runtime** del proyecto. | **Cambiado con el usuario el 2026-10-03: ya no cuenta el tamaño, cuentan los fallos.** Se reabre cuando aparezcan **fallos de sincronizar el DOM** —un dato que cambia y no se repinta, un nodo que se repinta de más, una lista que se desordena al repintar—, que son los que el *diffing* evita. El tamaño (~600 líneas) se descartó como disparador: se pasó sin que saliera ni un fallo de ésos. ⚠️ Ese día se evalúa **Snabbdom, no React ni Svelte ni Angular**: los frameworks traen estado, y el estado ya está construido. |
| **Un motor de edición** (ProseMirror, Lexical, CodeMirror) | Preguntado el 2026-09-20, y es **lo único que ahorraría semanas de verdad**: resuelven cursor, selección, deshacer y anidamiento, que es literalmente la Fase 4. Por eso mismo es lo más caro: **traen su propio modelo de documento**. `Note`, `Content`, las ocho operaciones, la lógica del editor de `src/ui/` y buena parte de las pruebas pasarían a ser redundantes. No complementan el core, **lo sustituyen**. | Querer **texto rico** — negritas, enlaces, tablas. Hoy `Content` es `Text \| CheckBox` con cadenas planas y no hay nada que ganar. Ese día la pregunta ya no es «qué librería de vistas», es **«¿se rehace el núcleo?»**, y es una decisión de otro tamaño: conviene no llegar a ella por accidente, añadiendo formato poco a poco. |
| **Un framework con estado dentro** (React, Angular, Svelte, Redux) · **htmx** | Preguntados el 2026-09-20 y descartados en bloque, para no volver a discutirlos de uno en uno. **Redux ya está construido**: `Store.ts` son 65 líneas con `getState`/`dispatch`/`subscribe` sobre un reducer puro, más lo que Redux no da —la invariante de identidad, en `if (next === state) return`—. **React** es débil exactamente donde esta app es difícil: el vdom y `contenteditable` se llevan mal porque el navegador muta el DOM mientras se escribe (Facebook abandonó Draft.js; ProseMirror, CodeMirror y Lexical gestionan el DOM ellos mismos), así que §7 obligaría a salirse de React justo en el componente que importa. **Angular** es de otra escala. **Svelte** es el mejor de los cuatro, pero sus *stores* compiten con el `Store` que ya existe y exige compilador. **htmx** es de otro paradigma: vive de que un servidor devuelva HTML, y esta app no tiene servidor. | Nada previsible. Si algún día se reabre, se reabre por la fila de **Snabbdom** —diffing sin estado—, que es la única necesidad real que podría aparecer. |
