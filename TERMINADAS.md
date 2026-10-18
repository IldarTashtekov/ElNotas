# Lo terminado de ElNotas

Lo que salió de `TAREAS.md` porque ya no pide nada a nadie: las fases cerradas, resumidas para leer
la historia de corrido, y en una línea las tareas sueltas terminadas, las descartadas, las
decisiones cerradas y los hitos. Lo vivo —lo pendiente, la deuda que dejó cada fase, lo sin
decidir y las ideas aparcadas— sigue en `TAREAS.md`; los principios, en `ARCHITECTURE.md`; la
crónica entera, en `git log`.

**Cada fase, 20 líneas como mucho** sin contar el título: qué se hizo, cuándo, la deuda que dejó y
sus commits clave. Lo vigila `npm run check:tareas`. **El `ARCHITECTURE.md` viejo**, el de antes de
la Fase 9, contaba también el diseño de cada funcionalidad, y las entradas de aquí lo citan por
sección; está entero en `git show ef1bcc6:ARCHITECTURE.md`.

---

## Fases cerradas

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
al hacerla: el diff se calcula **contra lo último escrito**, no contra el aviso anterior, así que
una nota creada y borrada en la misma ráfaga no llega nunca a disco; **una copia equivalente SÍ
cuenta como cambio** (hay una prueba que lo fija, para que nadie compare por valor); y
`migrations` y `target` se inyectan para poder probar los caminos de encadenar y de «falta una
migración», inalcanzables mientras `CURRENT_SCHEMA_VERSION` valga 1.
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
OPFS), usando `find` y `stat` como oráculo y no el explorador. **Cerrada con 314 pruebas**, y
declarada el 2026-09-19. Lo que dejó para la Fase 4 —`onError`, `onCorrupt` y la validación de
esquema— se hizo allí (`f406d96`, `473f566`, `8e2dba3`). **Deuda:** quitar `CarpetaRecorrible`, y
si OPFS entra en juego (en `TAREAS.md`).
Commits clave: `d198aaa` (se verifica a mano), `8d05bd9` (el paso 0, planteado), `bab97bb` (el
fichero local y los errores como valores), `61fe72a` (las pruebas a `test/`), `562c086` (las dos
fugas y `check:fronteras`), `f34d7c9` (la fase, TERMINADA).

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
la app instalada, sin anotar paso a paso. **Deuda:** las tres preguntas del editor y qué pasa con
lo guardado en `localStorage` al cambiar de destino (en `TAREAS.md`).
Commits clave: `473f566` (la rebanada vertical), `8b96c70` (la lista de ventanas), `296dd1b` (la
reconciliación), `9fab349` (el editor en pantalla), `56d838c` (el `set-checked` redundante no toca
el DOM), `f406d96` (`onError`), `935de4e` (la escritura condicional), `38b583d` (el cierre).

### Fase 5 — Diagramas ✅ CERRADA el 2026-10-08, con deuda; la deuda, saldada el 2026-10-10

Un lienzo libre con nodos y relaciones, partido en tres: **Modelo** —el `Diagram` nuevo,
las trece acciones (17 → 30), los catorce casos de uso y «Nota perdida» en `delete-note` y
`hydrate`—, hecho el 2026-10-03 con **643 pruebas**; **Lienzo** —la vista diagrama, los pósits,
los nodos-nota, «+ Diagrama» y el diagrama como ventana— con **693**; y **Relaciones** —las
líneas, el abanico, conectar, su menú y el texto a lo largo— con **712**, los dos el 2026-10-04.
Después, «Borrar todo» y el «+» azul, pedidos por el usuario: **723 pruebas** al cerrarla.
**Cerrada el 2026-10-08 sin pasar las listas de Lienzo y Relaciones**, para empezar la Fase 6; el
usuario las dio por pasadas el 2026-10-10, con la app instalada y sin anotar paso a paso.
**Deuda:** renombrar `NoteList`, las etiquetas junto a los «+» y el recorrido conjunto de las
listas, `test/ui/VERIFICACION-SENTADA.md` (en `TAREAS.md`).
Commits clave: `b14df06` (el modelo), `bb05a0b` (las trece acciones), `a87e012` (el arranque
limpia los diagramas), `57663f2` (la vista diagrama), `1997ace` (los nodos-nota y el nivel extra
de navegación), `7e2ebca` (las relaciones), `4ad85ba` (el texto de las líneas), `c1e86c9` («Borrar
todo»).

### Fase 6 — PWA: instalar la app en el móvil ✅ CERRADA el 2026-10-10

Que ElNotas se instale en el móvil como una app —icono, pantalla completa, sin conexión,
actualizándose sola—: manifiesto, iconos, *service worker* en `pwa/sw.js`, `npm run build:pages` y
GitHub Pages publicada por GitHub Actions. Las doce decisiones y su porqué, en el `ARCHITECTURE.md`
viejo. Construida el 2026-10-09 y publicada el 2026-10-10 en
**https://ildartashtekov.github.io/ElNotas/**, con **725 pruebas**, sin dependencias nuevas y sin
tocar el core. El usuario la instaló, la probó y la dio por cerrada, **sin anotar paso a paso** su
lista (`test/ui/VERIFICACION-MANUAL-PWA.md`); su bloque F —que se actualice sola en el móvil— no
consta que se viera. **Deuda:** el icono parece una ilustración de otra persona (en `TAREAS.md`).
Commits clave: `8f44d2d` (rutas relativas), `d007a3d` (manifiesto e icono), `ccd94c6`
(`build:pages`), `45b6242` (el *service worker*), `7791e24` (`persist()` y la versión), `926b8fd`
(la publicación), `af6dcf4` (la lista manual).

### Fase 7 — Refactor: ajustes de diseño y medir antes de tocar ✅ CERRADA el 2026-10-12

Planificada el 2026-10-11 y **cerrada el 2026-10-12 con 729 pruebas**, sin dependencias nuevas,
sin tocar el core y sin deuda en código: el usuario la probó en el móvil sin anotar paso a paso.
**Ajustes, pedidos con capturas del móvil:** la barra de la nota encima del teclado de Android
(`interactive-widget=resizes-content`; `visualViewport` no hizo falta); fuera la L azul en
horizontal (sin `theme-color` ni `theme_color`); los puntos del lienzo a media intensidad
(`--rejilla`); los pósits, de `10rem` a `8rem`; y nota o diagrama nuevos desde el «+» de la última
ventana, sin contexto (`createAsWindow`). **Medir antes de tocar:** arrancar con 20.000 notas no
duele (878 ms leer y 6,4 s pintar el General; el techo de `localStorage`, unas 4.000 notas, llega
antes); arrastrar un nodo sí dolía (1,3 s por movimiento con 500 nodos) y bajó a 10 ms redibujando
sólo las líneas del nodo (`relationsOf`) y midiendo todo antes de escribir. **Documentación:**
`CLAUDE.md` de 646 a 228 líneas, `ARCHITECTURE.md` de 4.590 a 3.896 y `TAREAS.md` de 1.769 a 543.
Negrita y texto más grande, fuera por decisión del usuario. **Deuda:** revisar los puertos al
llegar su segundo uso real (en `TAREAS.md`).
Commits clave: `710253a` (la barra y la L), `165eca9` (el arrastre de nodos), `cc0e311` (la
documentación adelgazada), `1815a2b` (nota o diagrama desde el «+»).

### Fase 8 — Aspecto de terminal: fósforo ámbar sobre negro ✅ CERRADA el 2026-10-12

Planificada, construida y **cerrada el 2026-10-12 con 742 pruebas**, sin dependencias nuevas y
**sin deuda**, en la rama `fase-8-terminal`: el usuario la revisó y la dio por hecha, **sin
anotar paso a paso** la lista (`test/ui/VERIFICACION-MANUAL-TERMINAL.md`). Una terminal de
fósforo de los 80, a partir de capturas del usuario: **sólo CSS**, más la pantalla de carga del
manifiesto. Los colores sueltos, a variables; una sola paleta oscura, la `--mono` del sistema en
toda la app y contraste medido (todo pasa de 4,5 menos `--dim`, que pinta lo desactivado); sin
esquinas ni sombras; brillo con `text-shadow` y líneas de barrido en una capa con
`pointer-events: none`; lo que crea o confirma, en vídeo inverso, y el rojo sólo para borrar.
Fuera el emoji de la papelera. **El verde, a elegir en ⚙** el mismo día, por el usuario:
`src/ui/phosphor.ts` y `elnotas:phosphor`, con dos fronteras más. El icono, con el fondo negro y
lluvia de letras verdes, elegido entre tres muestras. **Reabrió** el «+» verde (vídeo inverso),
la pantalla de carga azul (negra) y claro y oscuro según el sistema (sólo oscuro). Si arrastrar
pósits va a tirones en el móvil, el primer sospechoso es el brillo del lienzo (G3 de su lista).
Commits clave: `d832ac1` (el ámbar), `d2214b2` (el verde a elegir), `1157c81` (el icono).

### Fase 9 — Meta-desarrollo: que trabajar con agentes sea más automático ✅ CERRADA el 2026-10-17

Planificada el 2026-10-13 y **cerrada el 2026-10-17 con 846 pruebas** y 43 roturas a propósito,
todas cazadas; fusionada en `main` por *fast-forward*. Convertir en automático lo que dependía de
que el agente se acordara, **sin dependencias nuevas** y sin cambiar la app. **La base:** permisos
locales podados (de 103 reglas a 8), Node 26 leída de `.nvmrc` en casa y al publicar, seis opciones
estrictas de TypeScript y hooks que pasan los checks al editar y al terminar. **Guardianes:**
`check:descartes` con el sexto puerto, `Logger`; `check:roturas`, las roturas en una lista;
`check:paragrafos`; `check:exportaciones` (fuera `src/platform/index.ts`); `check:tareas`; y
`history.pushState` dentro de su frontera. La lista negra de `check:fronteras` a lista blanca, B3,
**descartada** (162 avisos para un agujero), y C4, ramas y PR, también. **Trabajo:** cada tarea
dice cómo se cierra, y Claude pasa las listas en el panel (la de la copia, la primera). **Limpieza:**
*worktrees* y ramas viejos, Drive fuera de dos cabeceras, el `unobserve` de los pósits borrados.
**Documentación:** `ARCHITECTURE.md` de anatomía a fundamento (de 4.215 a 754 líneas) y `CLAUDE.md`
a lo que nada automático vigila, con `check:arquitectura`. **Deuda:** C3, un agente que verifica, y
partir `DiagramCanvas.ts` (en `TAREAS.md`).
Commits clave: `018d576` (Node 26), `d9fc809` (los hooks), `f365120` (`Logger` y
`check:descartes`), `b161c23` (`check:roturas`), `6a00f9f` (`check:tareas`), `f07702e` (la lista
de la copia, en el panel), `db502a6` (`ARCHITECTURE.md`), `e9eaed9` (`CLAUDE.md`), `d3097d7` (el
cierre).

---

## Tareas sueltas terminadas

- **Exportar e importar las notas (JSON)** ✅ 2026-10-12, rama `feat/backup`, 803 pruebas: en ⚙ →
  Datos, sustituye todo tras un ensayo; su lista, pasada en la Fase 9 (C5). `9e1288e`.
- **Ventanas, hueco y encuadre** ✅ 2026-10-13, 828 pruebas: ⚙ crea lo mismo que el «+», tocar el
  hueco de la nota, el encuadre recordado (`elnotas:framing`) y la mira. `61fb9e6`.
- **Volver a lo abierto al recargar** ✅ 2026-10-13, 844 pruebas: `elnotas:capas` en `localStorage`;
  su lista, `VERIFICACION-MANUAL-CAPAS.md`, validada en el móvil. `42ce609`.
- **Pasar de Node 20 a uno con soporte** ✅ 2026-10-13: la 26, en la Fase 9 (A2). `018d576`.
- **Que `CLAUDE.md` no vuelva a llenarse de lo que caduca** ✅ 2026-10-17: `check:arquitectura`
  falla con más de 300 líneas, una fecha o un recuento de pruebas. `ddb542a`.
- **`npm test` no puede pasar en falso** ✅ (`475a585`): `require-tests.mjs` y `clean-tmp-test.mjs`.
- **`check:purity`** ✅ (`2abaaaf`): el reloj y el azar en el core, quitando comentarios y cadenas.
- **Las pruebas, a `test/`, espejo de `src/`** ✅ (`61fe72a`), con las mismas 314. §8.3.
- **Tipo explícito en todo `src/`** ✅ (`2f74a06`), con la **única excepción** a repasar la lista
  de `DirectoryHandleBlobStore.ts`: mismo código una vez quitados los comentarios, medido por sha256.
- **Las cabeceras del código, cortas** ✅ (`3135831`, 2026-09-19): de 1035 a 328 líneas. §8.7.
- **`.js` en los imports relativos y `check:extensiones`** ✅ (`1037ea1`). §8.2.
- **`npm run build:web` e `index.html`** ✅ (`473f566`): `src/` a `dist/web/` en ESM, sin bundler.
- **Una declaración sin tipo en `test/ui/editor.test.ts`** ✅ (`5e49a5a`, 2026-09-29).

## Descartadas

- ❌ **Un guardián para la regla de tipos explícitos**: no caza ningún fallo, sólo hace que un
  diff se lea mejor; la regla se queda y su comprobación no. El criterio, en `ARCHITECTURE.md` §2.4.
- ❌ **`check:fronteras` de lista negra a lista blanca** (Fase 9, B3), 2026-10-13: sobreingeniería.
- ❌ **Ramas, *pull requests* y CI en los PR** (Fase 9, C4), 2026-10-13: no hay `push` a otras ramas.
- ❌ **Un adaptador de Google Drive**, 2026-10-12: guarda ficheros, y manda el modelo (*La nube*).

## Decisiones cerradas

- **Las siete de la Fase 1**: (a), (c) y (g) por eliminación; (b) `remove` de una casilla con hijas
  es no-op; (d) tres casos de `Position`; (e) dos primitivas; (f) ocho operaciones.
- **Del editor (Fase 4)**, 2026-09-20: anidar actúa en la siguiente, las cuatro esquinas del
  teclado, `WritingMode`, el alcance de `onCorrupt` y `onError`, y `LocalStorageBlobStore`.
- **De la navegación y el alcance (Fase 4)**, 2026-09-27: sin bundler, ventanas en `localStorage`
  (opción C), «Mover a…» mueve, se recuerda la ventana activa y una nota vacía se mantiene.
- **Al construir el editor y las ventanas (Fase 4)**, 2026-09-29: `.js` en los imports, «☐ Casilla»,
  Intro con `after`, ventanas sin aviso al fallar y nombres repetidos.
- **De los Diagramas (Fase 5)**, 2026-10-03: lienzo libre, multigrafo, «Nota perdida», «doble = menú
  o crear», la nota nueva en todos los contextos del diagrama y la fase en tres.
- **⚙ crea lo mismo que el «+», y el encuadre se recuerda** en el dispositivo, 2026-10-13.
- **Escritura condicional con `revision`** ante dos pestañas, 2026-10-03: ante `stale`, Recargar. §6.5.
- **`schemaVersion` es el mecanismo de migración** y vive en `StorageAdapter`, no en `AppState`. §6.1.
- **El arranque tenía dos fases**: la mitad pura en la 2 y `boot.ts` en la 4 (`473f566`).
- **La Fase 3 se verifica a mano**, con una lista escrita y sin runner de navegador. §6.3.
- **Los casos de uso devuelven la entidad protagonista, o `null`** (`646f44f`, 2026-09-19): no es
  `Result` ni undo; las lecciones de sus pruebas, en `test/core/app/useCases.test.ts`.
- **Conservar las referencias a lo ilegible** cuando `onCorrupt` se salta una nota (`17278d9`). §6.5.
- **Las reglas `deny` sobre carpetas que ya no existían**, quitadas el 2026-10-03 (`a5da04e`).
- **Borrar una rama de casillas** no se construye: se borran una a una, 2026-10-03. §5.
- **Snabbdom se reabre por fallos de sincronizar el DOM**, no por tamaño, 2026-10-03.
- **Las fichas de agentes, desfasadas**: borradas los cuatro, 2026-10-18 (Fase 9.1, tarea 1).
- **La lista manual de la Fase 3** vive junto a sus pruebas, con sus pasadas en una hoja.
- **El `manifest.json` lleva sólo `{ schemaVersion }`**, sin índice. §6.1.
- **`CompositeStorage` y el outbox**, desaparcados el 2026-10-12: un sincronizador, en *La nube*.
- **El editor de grafos de los Diagramas**, desaparcado el 2026-10-03: fue la Fase 5.
- **El sync entre dispositivos**, diseñado el 2026-10-12 con la copia en conflicto (*La nube*).

## Hitos

- **Versión 1**, 2026-10-13, etiqueta **`v1.0.0`** (`4a3b708`), con 828 pruebas: las fases 0 a 8 y
  las dos tandas sin fase.
