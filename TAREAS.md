# Tareas de ElNotas

Qué está pendiente, qué está sin decidir y qué ideas hay aparcadas. **Lo terminado está en
`TERMINADAS.md`**: las fases cerradas, resumidas, y en una línea las tareas sueltas, las
descartadas, las decisiones cerradas y los hitos. Los principios y su porqué están en
`ARCHITECTURE.md`; las reglas para agentes, en `CLAUDE.md`.

**La disciplina que mantiene vivo este fichero: cada entrada tiene que ser cerrable.**
"Mejorar la UI" no se cierra nunca y no entra aquí. "Que `npm test` falle sin ficheros de
test" sí. Si una entrada no se puede marcar como hecha, o está mal escrita o es una idea
aparcada.

**Y cada tarea abierta acaba en «Se cierra cuando…»**, con lo que lo demuestra: en código, qué
prueba o qué guardián pasa y qué rotura a propósito lo caza; en una lista manual, que quede anotada
entera; en una decisión del usuario, dónde queda escrita. Lo vigila `npm run check:tareas`.

**Lo que ya no pide nada a nadie sale de aquí** a `TERMINADAS.md`, entrada a entrada y no sección
a sección: una tarea suelta, al terminarla; una fase, al cerrarla, resumida en 20 líneas como
mucho, y lo que deja sin hacer, a *Deuda de las fases cerradas* con su origen. **La fase en curso**,
la que lleva «EN CURSO» en el título, se queda entera hasta cerrarla: fuera de ella no hay ninguna
casilla marcada ni ningún tachado. También lo vigila `check:tareas`.

---

## Pendiente

### Deuda de las fases cerradas

Lo que las fases cerradas dejaron sin hacer o sin contestar, con la fase de la que viene. Su
resumen, en `TERMINADAS.md`.

#### De la Fase 4 — UI

- [ ] **Contestar por escrito las tres preguntas del editor** —`move`, `indent`/`outdent`, y si el
      disparador de anidar se entiende solo— **después de usar la app de verdad varios días**,
      no tras una demo. Un «no se aguanta» reabre la decisión correspondiente, y es un resultado
      válido. **Sin contestar el 2026-09-29, y sigue pendiente el 2026-10-03.**
      **`move`, contestada el 2026-11-03: no se aguanta**, y abre la tarea 12 de la Fase 10. Su
      arrastre lleva la profundidad, así que cubre lo que harían `indent`/`outdent`; si además
      hacen falta como órdenes sueltas, y el disparador de anidar, **siguen sin contestar**.
      **Se cierra cuando** el usuario contesta las tres por escrito aquí, y cada «no se aguanta»
      abre su propia tarea.
- [ ] **Qué pasa con las notas de `localStorage` al cambiar de destino.** Arrancar en
      `LocalStorageBlobStore` fue decidido «para salir del paso», y es barato de revertir porque
      el destino se inyecta en un solo sitio. Lo que **no** es gratis son las notas ya escritas:
      o se migran o se pierden. Conviene decidirlo antes de usar la app en serio. Techo
      conocido mientras tanto: ~5 MB por origen, que el base64 del blob infla alrededor de un
      tercio. **En notas, unas 4.000** de un título y seis líneas (~1.300 caracteres cada una),
      estimado el 2026-10-11 en la Fase 7: el techo llega antes que la lentitud. **Y desde el 2026-09-27, un tercer cabo:** la lista de ventanas vive fuera del almacén
      (hoy, en `elnotas:ui`), así que un cambio de destino la pierde; de dispositivo, sólo si no se
      lleva con una copia de seguridad, que desde la Fase 10 incluye el `uiState`. **Y desde
      el 2026-10-04, un cuarto:** «Borrar todo» vacía las claves `elnotas:` del `localStorage` de
      ese navegador; con otro destino —carpeta, OPFS— **hay que revisar qué borra** y si sigue
      teniendo sentido en dos tiempos. **Y desde el 2026-10-08, un
      quinto:** la app publicada de la Fase 6 es **otro origen** y empieza vacía; no ve lo escrito
      en la red de casa. **El usuario acepta perderlo**.
      **Desde el 2026-11-04 se contesta en la Fase 12**: las notas pasan a la app con la copia.
      **Se cierra cuando** el usuario elige migrar o perder lo escrito, y queda en *Decisiones
      cerradas* de `CLAUDE.md`.

#### De la Fase 5 — Diagramas

- [ ] **¿Etiquetas de texto junto a los «+»?** Su boceto (el del usuario, 2026-10-04) las lleva.
      **Pregunta abierta al usuario, sin contestar**; hasta que conteste, los botones siguen sin
      texto.
      **Se cierra cuando** el usuario contesta; si es que sí, construidas y con su paso en la lista
      manual.

#### De la Fase 11 — Dos idiomas, y copiar casillas

- [ ] **Lo de la tarea 6 que sólo se ve con un teclado de verdad o en el móvil:** Ctrl+X pulsado (en
      el panel se lanzó el evento a mano) y borrar o cortar una selección con el dedo (M11–M14).
      **Se cierra cuando** el usuario lo pasa y queda anotado en la lista del editor.
- [ ] **G1: ↑ hacia una línea larga cae en su primera fila**, no en la última como en un editor;
      ↓ sí recorre las filas. Lo sacó la pasada 13 de la lista del editor y viene de antes de la
      fase: el salto entre líneas conserva el número de carácter, no la altura en pantalla.
      **Se cierra cuando** ↑ desde la línea de debajo cae en la última fila, con su paso G1 en ✅.

#### Avisos sin tarea, cada uno con lo que lo dispara

- **El icono parece una ilustración de otra persona** (Fase 6): si la app se comparte, conviene un
  dibujo con permiso o propio.
- **Revisar los puertos cuando llegue su segundo uso real** (Fase 7): carpeta, OPFS o Supabase. Se
  hace al construir ese adaptador.
- **Partir `DiagramCanvas.ts`** (Fase 9): es código de la app y se hace al tocar esa zona. En la
  tarea 3 de la Fase 10 salieron los botones (`canvasButtons.ts`) y las cuentas de la selección
  (`canvasSelection.ts`), pero el modo lo hizo crecer: queda partir las líneas y los gestos.
- **El recorrido conjunto de las listas**, `test/ui/VERIFICACION-SENTADA.md` (Fase 5): quedó para
  la próxima vez que se pasen las del lienzo.

### Fase 12 — App Android autocontenida, con Capacitor — PLANIFICADA, la siguiente

**Pedida por el usuario el 2026-11-04.** **Qué es:** una app Android **dueña de su código y de sus
datos**, que no depende de Chrome ni de una dirección web. Por dentro se sigue pintando con el visor
web del sistema (Chromium): rehacer la UI en nativo queda fuera. La UI es la misma que la de la PWA.
Sale de *Ideas aparcadas* (la fila de los shells). **Sin plantear**: se plantea con el usuario antes
de construir nada.

**Hablado con el usuario el 2026-11-04:**
- **Lo que da la independencia son los datos, no la cáscara:** las notas, **en ficheros**, con un
  `BlobStore` nuevo sobre el plugin de ficheros de Capacitor, en vez de `localStorage`. Es el segundo
  uso real de los puertos (*Avisos sin tarea*).
- **Lo que deja de funcionar fuera del navegador:** el botón atrás de Android (por defecto cierra la
  app), exportar la copia (descargar no funciona en el visor web: guardar fichero o compartir) y el
  *service worker*, que sobra.
- **Las notas de la PWA se pasan con la copia de seguridad**; eso contesta la deuda de la Fase 4
  sobre las notas de `localStorage` al cambiar de destino.
- **La copia de seguridad automática** *(el usuario, 2026-11-04)*: el mismo `.json` de exportar,
  escrito solo en una carpeta que se elige una vez en ⚙ («cambiar carpeta», «última copia: hace
  2 h»). Sin segundo plano: con la app abierta, tras guardar cambios y como mucho cada X horas, o al
  abrirla si la última es vieja. **Dos o tres copias rotando**, no una sobrescrita: si se guardara
  algo estropeado, no pisa la buena. Si otra app sincroniza esa carpeta (Drive, Syncthing…), es copia
  fuera del móvil sin que ElNotas hable con ninguna nube. En la PWA del móvil no se puede: Chrome no
  deja escribir un fichero sin pedirlo cada vez.
- Notificaciones, compartir desde otras apps, widgets o Play Store: extras, a decidir aparte.

- [ ] **1. Las decisiones abiertas** *(pensar)*: aceptar `@capacitor/core` como primera dependencia
      de runtime o evitarla; los ficheros en la carpeta privada de la app (se van al desinstalar) o
      en una del usuario (con permisos); qué pasa con la PWA publicada; `.apk` a mano o Play Store;
      dónde vive la segunda composición junto a `platform/web/`; si es el momento de los
      *workspaces* de npm; y de la copia automática, cada cuánto y cuántas copias rotan.
      **Se cierra cuando** el usuario contesta y esta entrada se sustituye por
      las tareas de la fase, cada una con su etiqueta y su cierre.

### Fase 13 — App de escritorio, con Tauri — PLANIFICADA, después de la 12

**Pedida por el usuario el 2026-11-04.** **Qué es:** la app de escritorio, **autocontenida como la
de la 12** (reutiliza su `BlobStore` sobre ficheros), y **mejor en pantalla grande**: lo que el
usuario busca en el escritorio son **ventanas divididas** (dos lado a lado: una nota y su diagrama,
dos notas, una nota y el calendario) y **más atajos de teclado al escribir**. Tauri aporta además
las combinaciones que el navegador se reserva (Ctrl+W, Ctrl+T, Ctrl+N…). **La copia de seguridad
automática** de la 12 viene casi gratis, con la misma pieza de ficheros. **Sin plantear.**

- [ ] **1. Las decisiones abiertas** *(pensar)*: cuántos paneles y qué cabe en cada uno; si lo
      dividido va al `UiState`; si un enlace se abre en el otro panel; qué pasa en el móvil; qué
      atajos, y si entra «manejar el lienzo con teclado» (*Ideas aparcadas*). Redefine las decisiones
      cerradas «ventanas en pestañas», «lo de encima se apila» y quizá «móvil = escritorio». Es el
      momento de evaluar Snabbdom si salen fallos de repintado (*Ideas aparcadas*). **Se cierra
      cuando** el usuario contesta, `CLAUDE.md` recoge las decisiones cambiadas y esta entrada se
      sustituye por las tareas de la fase.

### Fase 14 — Aspecto de grimorio medieval, y el manual de uso — PLANIFICADA, la última

**Pedida por el usuario el 2026-11-04.** **Qué es:** cambiar el aspecto de terminal de fósforo por
uno de **grimorio medieval**, y escribir **un manual de uso dentro de la app**. El manual va al
final a propósito: escrito antes, las fases 12 a 14 lo dejarían viejo. **Sin plantear.**

- [ ] **1. Las decisiones abiertas** *(pensar)*: si el grimorio **sustituye** al fósforo o **se suma**
      como estilo a elegir en ⚙; qué fuente (incluir una, con licencia libre, rompe «letra del
      sistema»); inicial capitular; cuánto ornamento cabe en el móvil; si el lienzo también es
      pergamino; el icono. Reabre casi todo *Aspecto* de `CLAUDE.md`. Del manual: dentro de la app
      (vista de sólo lectura, sin red) o fuera; en los dos idiomas de la 11; texto o capturas; y que
      la auditoría de cierre de fase lo revise. **Se cierra cuando** el usuario contesta, `CLAUDE.md`
      recoge el aspecto nuevo y esta entrada se sustituye por las tareas de la fase.

### Sin fase asignada


- [ ] **Ajustes a la correa larga, de la prueba de la Fase 10** *(pensar)*. *Propuestos el
      2026-10-29* al cerrar la 10; `CLAUDE.md` → *Cómo se trabaja* cambia sólo si el usuario lo
      acepta. Dos: (1) **una parada tras plantear una *(pensar)* de UI**, enseñando el
      planteamiento o una maqueta antes de implementar (la 7k a la 7n fueron rehacer lo ya hecho);
      (2) **marcar lo sustituido** en la crónica de
      `TAREAS.md` al quitar un concepto («sustituido por la 7m»), porque la auditoría de la 10
      volvió a encontrar grupos, 🔔 y ✗ descritos como vigentes. El tercero, que `check` y
      `check:roturas` no se pisen, pasó a la Fase 10.1 (tarea 6). **El (1), aceptado el
      2026-11-05** al revisar la tanda de la 10.1, y ya en `CLAUDE.md` → *Cómo se trabaja*; el (2),
      sin contestar. **Se cierra cuando** el usuario
      acepta o descarta cada uno y lo aceptado queda en `CLAUDE.md` o en un guardián con su rotura.
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

---

## Sin decidir

**No las resuelva por su cuenta quien implemente.** Si te topas con una, pregunta.

- [ ] **Tres detalles de los enlaces y las marcas** *(salieron en la 6f y la 6g, 2026-10-27)*. ¿Al
      elegir una dirección web sin texto, el campo Texto lleva el dominio? ¿Un `[texto](destino)`
      escrito o pegado a mano en la línea activa se vuelve bloque al momento (hoy, al salir de la
      línea y volver)? ¿Copiar dentro de la línea activa lleva los asteriscos escondidos (hoy, sí)?
      Quedan además sin pasar en el ordenador unos casos de la sección R de
      `test/ui/VERIFICACION-MANUAL-EDITOR.md` (varios enlaces pegados, texto vacío, R8). **Se cierra
      cuando** el usuario contesta las tres y la respuesta queda escrita aquí.

- [ ] **Marcar un día de una semana pasada** *(salió en la 7l, 2026-10-29)*. Con sólo la semana
      de hoy en cada rutina ya no hay dónde corregir un día olvidado de la semana pasada, aunque el
      core lo permite. Opciones: pulsar el día en el mes con la pestaña Rutinas, o nada. Sin
      decidir hasta que el usuario lo eche en falta. **Se cierra cuando** el usuario elige y la
      decisión queda escrita aquí.
- [ ] **`Context.defaultView`, sin uso** *(salió en E2 de la Fase 9, 2026-10-17)*. Sigue en el
      modelo con su acción `set-default-view`, y nadie lo usa desde que una ventana puede ser una
      nota o un diagrama. Choca con el principio de no construir lo que no tiene quien lo use
      (`ARCHITECTURE.md` §5). O se acepta como excepción, o se quita, y quitarlo toca el core, el
      reducer, las pruebas y el formato en disco.
      **Se cierra cuando** el usuario elige: excepción, escrita en *Decisiones cerradas* de
      `CLAUDE.md`, o una tarea con fase para quitarlo.

- [ ] **Un fichero ilegible no se migra** *(salió en la 15a, 2026-11-03)*. El arranque se salta lo
      ilegible, así que la migración no lo ve; si después alguien lo arregla a mano, llega con la forma
      vieja y una versión ya nueva. Desde la 15b, `schema.ts` acepta las dos formas del nodo, así que un
      diagrama así se lee sin migrar: un nodo-nota viejo llega sin texto. Opciones: dejarlo así, que el
      validador rechace la forma vieja con la versión nueva, o que una copia de seguridad recuerde la
      versión de cada fichero. **Se cierra cuando** el usuario elige y
      la decisión queda escrita aquí.

- [ ] **La pregunta de importar no cuenta los eventos** *(salió en la 7g, 2026-10-28)*. «La copia
      trae 8 notas, 2 diagramas y 2 contextos» no dice cuántos eventos trae,
      aunque los sustituye. No pierde nada, pero la cuenta enseña menos de lo que se va a
      reemplazar. **Se cierra cuando** el usuario dice si la frase los nombra (toca
      `importQuestion` y su prueba) o se queda como está.

### Si OPFS entra en juego: lo que queda del criterio de la Fase 3

Se dejó abierto a conciencia: decidirlo de paso habría cambiado el alcance de la fase por la
puerta de atrás. Los otros dos huecos de entonces están cerrados (`TERMINADAS.md`).

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
| **Una entidad `Preferences` en el core para lo de presentación que viaja** (orden de las rutinas, archivadas y, más adelante, orden dentro de un contexto y ocultos) | Planteado el 2026-10-30 tras sacar `archived` de `Routine`. Hoy el orden y lo archivado viven en el `UiState` (`elnotas:ui`), por dispositivo y fuera del core. Diseño esbozado: un objeto `{ schemaVersion, routineOrder, archivedRoutines, … }` guardado como un fichero más con el escritor diferido; sólo la parte que viaja; el resto del `UiState` se queda en el dispositivo. Pide una entidad nueva, su acción y su reconciliación en el core. Dudas abiertas: una global o una por contexto; si los ocultos (`hidden` en `Context`, decisión cerrada) se mueven ahí, y si entra el orden de contexto de la tarea 2. | Querer que el orden y lo archivado viajen entre dispositivos, o la nube. Decidir antes las tres dudas. |
| **Repeticiones y duración de los eventos del calendario** (un evento cada semana, uno que dura varios días o de una hora a otra) | Planteado el 2026-10-27 al diseñar el calendario (Fase 10, tarea 7): los esbozos del usuario sólo tienen un día y una hora opcional, y repetir o durar pide un modelo más grande (reglas de repetición, excepciones, qué se pinta en el mes). | Echar en falta crear a mano el mismo evento cada semana, o uno de varios días. Es añadido: un campo opcional en el evento, sin migrar lo guardado. |
| **Subcontextos, o un contexto como elemento de otro** | Planteado por el usuario el 2026-10-18 y aparcado por él: interesa, pero no hace falta. De los dos, prefiere **la referencia a la contención**: un contexto enlazado desde varios (n a n, como una clave ajena), sin árbol y sin recorrerlo recursivamente. Un árbol abriría ciclos, qué pasa al borrar un padre, cómo se abre y qué enseña el General. Desde la Fase 10 una nota puede enlazar notas y diagramas con `[texto](#id)`; los contextos, no, por ahora (2026-10-25). | Echar en falta ver un contexto **dentro de la lista** de otro, no sólo enlazado desde una nota. Ese día, un tercer tipo de `ItemRef` (`kind: "context"`), con la limpieza al borrar como la de las notas. |
| **Exportar las notas a Markdown**, legible y sólo hacia fuera | Entró en la Fase 11 y el usuario la aparcó el 2026-11-09, ya planteada: no hace falta por ahora. Lo planteado: en ⚙ → Datos, «Exportar a Markdown» descarga un `.md` con todas las notas, guardado como la copia. `#` el contexto y `##` la nota; al final, «Sin contexto»; una nota en dos contextos, una vez, en el primero. Casillas `- [ ]`/`- [x]` con las hijas a dos espacios; las líneas de texto, separadas por una en blanco; un `# ` de la nota pasa a `###`. Los enlaces web se quedan; los internos, sólo su texto. Fuera diagramas, calendario y rutinas; los ocultos, dentro. Es otra cosa que la copia: el JSON restaura, el Markdown se lee. | Querer leer o llevarse las notas fuera de la app. La conversión de casillas de la tarea 5 de la Fase 11 (copiar y pegar) se podrá reutilizar. |
| **Manejar el lienzo con teclado**, y reordenar las fichas de ⚙ con teclado | El usuario lo dejó para más adelante (Fase 5); no bloqueaba nada. | Que lo pida el usuario. |
| **Anotar los tipos en las pruebas viejas** (942 anotaciones de `test/core/` y `test/storage/`, medido el 2026-09-19) | Deuda aceptada a sabiendas: trabajo mecánico que no caza ningún fallo, con un diff irrevisable. Lo que se escribe o se toca ya cumple la regla, y eso impide que crezca. | Tocar esas pruebas por otro motivo: lo que se toque, se anota. |
| **Adaptador de MongoDB** (o cualquier base de datos con servidor propio) | Requiere un backend HTTP propio: el driver de Mongo habla TCP y no funciona desde navegador, y la Data API de Atlas está retirada. **Reconsiderado el 2026-10-12** al elegir la nube, y lo mismo vale para SQL con servidor propio: el usuario no quiere mantener un servidor, así que se eligió Supabase (*Ideas aparcadas → La nube*). | Que hubiera ya un backend propio por otro motivo. Montar uno solo para esto no sale a cuenta. |
| **`storageTarget` por contexto** (enrutar notas privadas a un backend concreto) | Presupone varios backends, que no existen. | Lo mismo que el anterior, más una necesidad real de separar notas por destino. |
| **Cambiar `LocalStorageBlobStore` por IndexedDB**, o por una base ligera (SQLite compilado a wasm, o similar) | Como tecnología, IndexedDB gana casi en todo —cuota de cientos de MB frente a ~5 MB, `Uint8Array` nativo frente al base64 que cuesta un 33% más, asíncrona de verdad cuando el puerto ya es `async`—, y aun así no compensa, por tres motivos. **(1) El hueco ya está ocupado:** "almacén grande, privado del origen, sin diálogo y con bytes nativos" es **OPFS**, que ya está construido y es el mismo `DirectoryHandleBlobStore` con otro handle. Un `IndexedDbBlobStore` sería una cuarta implementación duplicando a una existente, en el mismo *bucket* de cuota. **(2) El valor de `localStorage` aquí no es guardar, es que se puede falsear honradamente en Node**: Node no tiene ninguna de las dos, y el `Storage` falso es **un fichero corto que además sabe lanzar la excepción de cuota**. De ahí cuelga **la tercera pasada de la suite de contratos** (§6.3), la que monta la pila entera sobre un `BlobStore` de producción y que se ganó el sitio cazando fallos que las otras dos no veían (5 de 7 y 3 de 6, medidos). Falsear IndexedDB no es un fichero corto; sería `fake-indexeddb` —una dependencia, contra la política— o quedarse sin esa pasada. **(3) Una base ligera no es un `BlobStore` siquiera:** sustituiría a `StorageAdapter` entero, y choca de frente con el formato en disco (§6.1) y con "un fichero por entidad", que es decisión cerrada. Además arrastra ~1 MB de wasm en un proyecto de cero dependencias de runtime. | Que los ~5 MB **aprieten de verdad** — y ese día la respuesta sigue siendo **OPFS primero**, que no cuesta código. O que aparezca una necesidad que sólo una base cubre: consultas por contenido, índices, búsqueda de texto completo. Nada de eso tiene consumidor mientras `getAll` sea N lecturas al arrancar. **No confundir con lo que sí está planificado:** IndexedDB **entrará** para **guardar el handle de la carpeta** y hacer posible el botón de "reconectar carpeta"; eso no es esta idea y no está aparcado. *(Aquí decía «entra en la Fase 4»; desde el 2026-09-20 la carpeta del usuario como destino está fuera de la Fase 4, así que entra el día que lo haga ella.)* Verificado el 2026-09-13 en el andamio de la verificación manual: el handle vuelve tras recargar, con el permiso intacto y sin diálogo. **Reconsiderado el 2026-10-12** con «manda el modelo» y Postgres en la nube, y la conclusión no cambia: SQLite en el navegador es posible (wasm sobre OPFS, en un *Worker*), pero sin búsqueda ni volumen no tiene consumidor. Y «un fichero por entidad» se relee como **un documento por entidad**: lo que decide es el grano, no que sea un fichero. |
| **Replantear los efectos que no devuelven nada en clave más funcional** (el `Listener` del `Store` como flujo, `Cancel`/`Unsubscribe` con ámbito) | Salió de un inventario de **todas las funciones que devuelven `void`** en `src/core` y `src/storage`, hecho el 2026-09-19. **Ese inventario ya dio un arreglo real y está construido**: los casos de uso devolvían `void` y ahora devuelven la entidad o `null`. Lo que queda no es el mismo caso, y el criterio que los separa es el que hay que conservar: **¿la vuelta llevaría información que NO se deduce de los argumentos?** `dispatch(action)` no se deducía —lo decide el reducer—, y por eso valía la pena. `setItem(k, v)` se deduce entero: después de eso `k` vale `v`, así que devolver algo sería devolverle al llamante lo que él trajo. `clearTimeout` deja un solo bit —«¿seguía pendiente?»— que **ningún** sitio de los tres que cancelan miraría. **Y la reformulación buena no es cambiar retornos, son otras dos, las dos con su pega: (1) el `Listener` como flujo de estados**, con el write-behind convertido en un `scan` en vez de un objeto con cuatro variables mutables — pero eso **no elimina el `void`, lo centraliza**, y el `Store` ya tiene esa propiedad por otro camino («la única mutación del proyecto»); además construir el flujo a mano choca con cero dependencias y `rxjs` es justo lo que no se instala aquí. **(2) `Cancel` y `Unsubscribe` con adquirir-y-liberar por ámbito**, que es la forma funcional de un recurso — pero **no encaja con el debounce**, que necesita cancelar y reprogramar desde fuera en cada tecla: la vida de ese temporizador no es un bloque, es una carrera contra la siguiente pulsación. | **La Fase 4**, y en concreto el punto en que haya **dos suscriptores** (la UI y la persistencia) en vez de uno: es cuando un flujo empieza a pagar y se puede decidir con el caso delante. Ese día hay que resolver antes lo de cero dependencias. ⚠️ **Desde la Fase 4 hay dos suscriptores** —la UI y el write-behind— y esto **no se ha reabierto**: la UI se escribió con el `Listener` tal cual. **No confundir con el caso que quedaba vivo del mismo inventario:** el `void flush()` del write-behind, donde el error del flush automático no lo veía nadie — no se arreglaba con un retorno porque **no hay quien llame, es un temporizador**, y su arreglo fue el `onError`, **hecho en la Fase 4** (`f406d96`). |
| **Una librería pequeña sólo para mover y acercar el lienzo** (pan/zoom, sin dependencias propias) | Decidido el 2026-10-03 hacer el lienzo **desde cero**: las librerías de lienzo completas exigen React o guardan su propio estado, y mover y acercar son unas pocas cuentas puras que se prueban en Node. | **Que el pellizco o el arrastre no se dejen domar en el móvil real.** El lienzo se hizo sin ella, y **aún no se ha probado en el móvil**: se sabrá al pasar su lista, que desde el 2026-10-04 va al final de la Fase 5, con las relaciones ya encima. Ese día se evalúa una que haga **sólo** eso y no guarde estado; sería la primera dependencia de runtime, así que con el mismo cuidado que Snabbdom. |
| **La nube: copia de seguridad y sincronización con Supabase** (el diseño entero, en *La nube: el diseño*, debajo de esta tabla) | Diseñada el 2026-10-12 y aparcada por el usuario el 2026-11-04: la copia de seguridad en `.json` ya da la copia, y pasar las notas de un dispositivo a otro a mano con ella le basta. A cambio se ahorra un servicio externo con su cuenta y su pausa, la pieza más delicada del core («aplicar lo remoto» y las copias en conflicto) y guardar una sesión en el navegador. | Que pasar las notas a mano con la copia se haga pesado, o que se pierda una edición por importar encima. Ese día, antes de construir, lo de *Por comprobar* de su diseño. |
| **CRDTs y colaboración en tiempo real** | Un salto enorme de complejidad para un problema que en una app personal es raro. El sync entre dispositivos ya está diseñado, con su copia en conflicto (*Ideas aparcadas → La nube*). | Colaborar con otras personas en la misma nota. |
| **Importar una copia mezclándola** con lo que hay, en vez de sustituir (con la copia en conflicto de *La nube*) | Estudiada el 2026-10-12 al construir la copia de seguridad, y el usuario eligió sustituir porque **mezclar toca el core** y sustituir no. Cómo sería: lo que no está, se añade; con la misma `revision`, nada; con otra, la local se queda como oficial y la de la copia entra como «‹nombre› (conflicto)», en los mismos contextos; los contextos suman referencias. Sus dos pegas: **restaurar una copia vieja llena la app de «(conflicto)»** —sin recordar qué `revision` se vio la última vez, una versión antigua de la nota no se distingue de una edición hecha en otro sitio— y **lo borrado reaparece**, porque no hay registro de borrados. Habría que añadir la regla de no repetir una copia «(conflicto)» con el mismo contenido, para que importar dos veces no duplique. | **Empezar la nube.** La acción «aplicar lo remoto» y su política de conflictos son la misma pieza del core que necesita el sincronizador: hecha para uno, la otra sale casi gratis, y entonces importar puede ofrecer «Sustituir todo» o «Añadir a lo que hay». O querer pasar notas entre dispositivos a mano con un fichero. |
| **Fusión a tres bandas en los conflictos** | Elegida primero por el usuario el 2026-10-12 y cambiada ese mismo día por la copia en conflicto: el conflicto es raro en una app personal, y la fusión exige **guardar la base** de cada entidad (lo local se duplica) y escribir la función de fusión, la pieza más cara del sync. Lo que se decidió de ella, por si vuelve: fusionar **por campos**; **editar gana a borrar** en todos los niveles; en un choque real (el mismo campo en los dos lados) **gana el más nuevo**, usando la `updatedAt` de la entidad y aceptando que se pierde la otra versión; las inserciones en el mismo sitio se quedan las dos, la más nueva primero; y en los diagramas, nodo a nodo y relación a relación. La facilitan los ids de línea y los `Record` del diagrama; `move` la complica (mover y editar a la vez). ⚠️ «Gana el más nuevo» aquí **no** reabre el «gana el último» descartado: aquél era sobre la entidad entera; éste, sólo sobre el campo que chocó después de fusionar. | Que las copias en conflicto salgan **más de lo esperado** usando la app. Ese día se empieza a guardar la base; no hace falta migrar lo ya guardado. |
| **Sincronizar sin nube, entre pares** (*peer-to-peer*) | Preguntado el 2026-10-12, y al usuario le atraía más que la base de datos. Tres variantes, cada una con su pega. **(1) Manual, en la PWA, con WebRTC:** los dos dispositivos se presentan con QR, pero son **dos escaneos** (oferta y respuesta) **cada vez**, o un servicio público sólo para el saludo; y las dos apps abiertas a la vez. **(2) Automático** («enciendo el ordenador y se sincroniza»): una PWA no puede escuchar conexiones ni correr en segundo plano, y una página HTTPS no puede llamar a `http://192.168.x.x`. Pide **app nativa en los dos lados**. **(3) PWA más un servicio Kotlin aparte en cada dispositivo**, hablando por `localhost`: es la versión frágil de la (2). Chrome está poniendo permiso a que las webs públicas lleguen a la red local, Android exige una notificación fija para el segundo plano, y son dos programas más por dispositivo. Lo limpio es **Capacitor con plugins en Kotlin**, que es la (2). Ninguna da copia fuera de casa. | **(1):** querer prescindir de la nube y aceptar que sincronizar sea un gesto. **(2):** la app nativa (Fases 12 y 13). Las dos entrarían como **un servicio más** en la sección «Nube» de ⚙, con el puerto sin Supabase dentro y la misma política de conflictos. |
| **Markdown como formato de guardado** | Preguntado el 2026-10-12. Una nota es un dato estructurado y un `.md` es texto libre: los ids de línea no tienen sitio, lo que el usuario escribe y parece Markdown hay que escaparlo, los diagramas y los contextos no caben, y si se edita fuera la app no lo entiende ni se entera (la `revision` no cambia). Con «manda el modelo», Markdown es **sólo para exportar** (*Exportar las notas a Markdown*, aquí arriba). | Que se reabra «manda el fichero»: editar las notas en Obsidian o en cualquier editor. Es otro proyecto, no una ampliación del almacenamiento. |
| **Cifrar la sesión guardada de la nube** (con una llave de WebCrypto que no se puede sacar) | El 2026-10-12 se decidió guardar la sesión en el navegador sin cifrar. Cifrarla impide que copiar el almacén baste para llevarse el token, pero no protege de un script malicioso dentro de la app, que podría usar la llave. Hoy no hay código de terceros ni dependencias. | Que la app cargue código ajeno, o que se comparta con más gente. |
| **Un runner de navegador para las pruebas** (Playwright o similar) | Lo único que no se puede probar en Node es un fichero —`DirectoryHandleBlobStore`, más de trescientas líneas de código— cuya parte larga es un clasificador de excepciones: probarlo con un doble es comprobar lo que uno *cree* que lanza la API. Y se ejercita solo cada vez que alguien usa la app. A cambio: cientos de megas frente a los 37 MB de hoy, y una cadena de herramientas más que mantener. | Que aparezca un **segundo** adaptador sobre navegador con lógica de verdad —el de Supabase, con su sesión y sus reintentos; hasta el 2026-10-12 decía «el de Drive»— o que ese fichero dé más de un sobresalto. Ese día se instala **sólo para esa fase**, coherente con la política de dependencias. |
| **Migrar de webpack a Vite** | ⚠️ **Superada el 2026-09-27:** webpack ya **no** es el bundler previsto para la Fase 4 — la fase arranca con el `importmap`, sin bundler. La elección entre bundlers no afecta a la arquitectura, así que no urge. | Que algo concreto exija un bundler. Ese día se comparan los que haya, no sólo estos dos; y se reinstala **sólo** el elegido. |
| **Las ventanas como entidad del core** (la opción B de el `ARCHITECTURE.md` viejo: algo como `Layout`, en su fichero junto a las notas) | Es la opción más limpia —una sola fuente, viaja con las notas, el reducer vigila la integridad—, pero reabre `StorageAdapter`, la suite de contratos, `FileStorageAdapter` y el catálogo de acciones, todo cerrado. Se eligió la C (`localStorage`) para salir del paso. | Que lleguen las **entidades «meta» de UX/UI** al core, que el usuario prevé; o que duela de verdad que las ventanas no viajen con las notas (un cambio de destino o de dispositivo). Ese día la guarda de la presentación se sustituye por la integridad del reducer. |
| **Revisar `Context.defaultView`** (y su acción `set-default-view`) | Se queda sin consumidor en la Fase 4: «abrir directamente una nota» lo hace ahora una ventana de tipo nota. No se quita porque el dominio está cerrado y quitarlo toca modelo, reducer, pruebas y formato en disco por algo que no molesta. | Lo mismo que la fila anterior: cuando lleguen las entidades «meta» de UX. Ahí se decide si se elimina o si recupera un sentido. |
| **Tres candidatas más para la barra de modo**: «al marcar una casilla, marcar también sus hijas», «esconder las marcadas», «mandar las marcadas al final» | Fuera de la Fase 4. Cumplen la regla de la barra (el `ARCHITECTURE.md` viejo), pero nadie las ha echado de menos todavía con un editor delante. | El mismo disparador que las tres preguntas del editor: **si usando el editor se echan en falta**, se reabren. La primera es además donde se compondría la cascada de `setChecked`, que irá plegada en una sola acción (§5). |
| **Un botón «reintentar» en el aviso de `onError`** | Con `localStorage` como destino no hay nada que reanudar, y está cerrado que un write-behind detenido no se reanuda. El aviso sólo informa. | Que el destino sea **la carpeta del usuario**: ahí reanudar sí significa algo —volver a pedir la carpeta— y va con el botón de «reconectar carpeta» (§6.5). |
| **Prototipo desechable del editor** (solo DOM, sin core y sin persistencia) | Es trabajo que se tira. ⚠️ **Matizada el 2026-09-20**, al plantearse hacerlo en una carpeta `/frontend-temporal`: lo desechable no sale gratis aquí. `src/scripts/` fue la prueba —el prototipo viejo siguió en el repo sin construirse hasta la Fase 4, y `CLAUDE.md` gastaba un párrafo por sesión diciendo que no se imitara—, y para arrancar cualquier cosa hacen falta `Clock`, `IdGenerator` y un arranque, que **son** `src/platform/`, o sea Fase 4 literal: se escribirían para tirarlos y se reescribirían igual. | **Partida en dos, que es lo que la resuelve.** *(a)* Para «¿encaja la pila entera?» un **script de Node** de ~100 líneas, sin navegador, ejecutable ya con `node --conditions=compiled`: ése sí es desechable de verdad. *(b)* Para «¿cómo se siente escribir?» **no vale código de usar y tirar**, porque lo que se descubre son las tres preguntas del editor y una respuesta obtenida con un juguete no cierra ninguna. Eso es el editor de Fase 4 · Notas, feo al principio pero en `src/ui/` y `src/platform/`. *(Hasta el 2026-09-27 decía «la primera rebanada vertical de la Fase 4»; desde que la fase se parte, esa rebanada es la de Contextos y no toca el editor.)* |
| **Tailwind, o cualquier CSS que pida compilación** (UnoCSS, Sass, CSS Modules) | Preguntado el 2026-10-03. Pide un paso de compilación y una dependencia, **duplica** las variables CSS que ya llevan los colores en claro y oscuro, y mete el estilo en el TypeScript (`className = "…"` con quince clases). Sass y CSS Modules, compilación también, y el anidamiento ya es nativo. Se hizo lo contrario: CSS nativo partido por vista en `src/ui/styles/`. | Que el CSS crezca hasta que **los choques de cascada** entre ficheros se vuelvan inmanejables, o que haya un equipo diseñando muchas pantallas. Ese día se mira primero **`@layer` por vista**, que es nativo. |
| **Snabbdom, o cualquier DOM virtual mínimo** | Preguntado el 2026-09-20. Es el **único candidato honesto** de todos los que se plantearon, porque aporta sólo *diffing* (~3 KB) y no duplica nada: el estado ya está resuelto. Aun así no ahora, y el motivo es el mismo que hace difícil a esta app — lo que describe §7, *reconciliar por `data-id`* y **saltarse el nodo enfocado**, es un vdom a mano recortado alrededor de la única excepción que un vdom genérico expresa mal. Daría el 90% y habría que pelearse con él justo en el 10% que decide si la app se siente bien. Sería además la **primera dependencia de runtime** del proyecto. | **Cambiado con el usuario el 2026-10-03: ya no cuenta el tamaño, cuentan los fallos.** Se reabre cuando aparezcan **fallos de sincronizar el DOM** —un dato que cambia y no se repinta, un nodo que se repinta de más, una lista que se desordena al repintar—, que son los que el *diffing* evita. El tamaño (~600 líneas) se descartó como disparador: se pasó sin que saliera ni un fallo de ésos. ⚠️ Ese día se evalúa **Snabbdom, no React ni Svelte ni Angular**: los frameworks traen estado, y el estado ya está construido. |
| **Un motor de edición** (ProseMirror, Lexical, CodeMirror) | Preguntado el 2026-09-20, y es **lo único que ahorraría semanas de verdad**: resuelven cursor, selección, deshacer y anidamiento, que es literalmente la Fase 4. Por eso mismo es lo más caro: **traen su propio modelo de documento**. `Note`, `Content`, las nueve operaciones, la lógica del editor de `src/ui/` y buena parte de las pruebas pasarían a ser redundantes. No complementan el core, **lo sustituyen**. | Querer **texto rico** — negritas, enlaces, tablas. Hoy `Content` es `Text \| CheckBox` con cadenas planas y no hay nada que ganar. Ese día la pregunta ya no es «qué librería de vistas», es **«¿se rehace el núcleo?»**, y es una decisión de otro tamaño: conviene no llegar a ella por accidente, añadiendo formato poco a poco. |
| **Un framework con estado dentro** (React, Angular, Svelte, Redux) · **htmx** | Preguntados el 2026-09-20 y descartados en bloque, para no volver a discutirlos de uno en uno. **Redux ya está construido**: `Store.ts` son 63 líneas con `getState`/`dispatch`/`subscribe` sobre un reducer puro, más lo que Redux no da —la invariante de identidad, en `if (next === state) return`—. **React** es débil exactamente donde esta app es difícil: el vdom y `contenteditable` se llevan mal porque el navegador muta el DOM mientras se escribe (Facebook abandonó Draft.js; ProseMirror, CodeMirror y Lexical gestionan el DOM ellos mismos), así que §7 obligaría a salirse de React justo en el componente que importa. **Angular** es de otra escala. **Svelte** es el mejor de los cuatro, pero sus *stores* compiten con el `Store` que ya existe y exige compilador. **htmx** es de otro paradigma: vive de que un servidor devuelva HTML, y esta app no tiene servidor. | Nada previsible. Si algún día se reabre, se reabre por la fila de **Snabbdom** —diffing sin estado—, que es la única necesidad real que podría aparecer. |

### La nube: el diseño — DISEÑADA el 2026-10-12, APARCADA el 2026-11-04

Decidida con el usuario el 2026-10-12, en una conversación, y **aparcada por él el 2026-11-04**, sin
una línea de código (por qué y qué la desbloquea, en su fila de la tabla). Lo que tenga de principio pasa a `ARCHITECTURE.md` (§6) cuando se construya; hasta entonces vive aquí.
**Para qué, las dos cosas:** copia de seguridad, y las mismas notas en el móvil (Android, la PWA) y
en el ordenador.

**Decidido:**

- **Manda el modelo, no el fichero.** Una nota es un dato estructurado —ids de línea, `revision`,
  reglas de casillas—, y un fichero o una fila es su copia guardada. «Manda el fichero», al estilo
  Obsidian, sería refundar el core. Consecuencia: **la nube es una base de datos**, no un sitio de
  ficheros. Markdown, sólo para exportar (*Ideas aparcadas*).
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
  en la tabla de arriba, con lo que se decidió de ella.
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

**Aparcada** *(el usuario, 2026-11-04; sin fase desde el 2026-10-17)*. Lo de abajo no son tareas
pendientes: es lo que hay que hacer **al construirla**, y entonces cada punto pasa a ser una tarea
con su cierre.

**Propuesto, sin objeción del usuario, por confirmar al construir:**

- **«Borrar todo» se lleva también la conexión**, porque borra las claves `elnotas:`.

**Por comprobar antes de construir**, porque se dijo de memoria:

- Qué cuenta como «actividad» para la pausa de Supabase, y si basta con la consulta de la tarea.
- Que GitHub desactiva las tareas programadas de un repo público tras 60 días sin actividad, y
      qué se hace entonces (reactivarla a mano, con el aviso por correo).
- El inicio de sesión de Supabase con `fetch` y sin su librería: el código por correo, la
      renovación del token y su rotación.
- Que Supabase acepta peticiones desde `ildartashtekov.github.io` (CORS).
