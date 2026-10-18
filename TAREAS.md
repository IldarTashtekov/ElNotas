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

#### De la Fase 3 — Fichero local

- [ ] **Quitar la interfaz `CarpetaRecorrible` de `DirectoryHandleBlobStore.ts`, que hoy sobra**.
      Se declaró a mano `values()` con este motivo escrito en el fichero: que el recorrido de entradas «vive en
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

#### De la Fase 4 — UI

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

#### De la Fase 5 — Diagramas

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

#### De la Fase 9 — Meta-desarrollo

- [ ] **C3. Un agente que verifica** *(el usuario, en `.claude/agents/`)*: lee el cambio de otro,
      rompe a propósito y pasa las listas, sin haber escrito el código. Quien escribe no se da el
      visto bueno. **En el aire**, con el resto del uso de agentes.
      **Se cierra cuando** el usuario decide si existe; si es que sí, con su ficha y una pasada real
      sobre un cambio.

#### Avisos sin tarea, cada uno con lo que lo dispara

- **El icono parece una ilustración de otra persona** (Fase 6): si la app se comparte, conviene un
  dibujo con permiso o propio.
- **Revisar los puertos cuando llegue su segundo uso real** (Fase 7): carpeta, OPFS o Supabase. Se
  hace al construir ese adaptador.
- **Partir `DiagramCanvas.ts`** (Fase 9): es código de la app y se hace al tocar esa zona.
- **El recorrido conjunto de las listas**, `test/ui/VERIFICACION-SENTADA.md` (Fase 5): quedó para
  la próxima vez que se pasen las del lienzo.

### Fase 9.1 — Correa larga: encadenar tareas y parar sólo ante decisiones — EN CURSO

**Decidida con el usuario el 2026-10-18**, tras repasar los patrones de trabajo con agentes. Hoy
Claude trabaja con la correa corta: cada edición pide permiso, se para tras cada tarea y no
comitea. **Qué es:** que encadene las tareas de una lista acordada y sólo pare ante lo que es del
usuario, sin perder seguridad. **No cambia la app** salvo en la tanda de prueba (tarea 10), que son
pendientes que ya estaban en este fichero.

**Decidido con el usuario el 2026-10-18:**
- **Los cuatro agentes de `.claude/agents/` se borran** y se empieza de cero: estaban desfasados y
  repartían el trabajo por carpetas, cuando las tareas cruzan todas las capas.
- **La seguridad, del sandbox y no de los patrones de permisos.** Un patrón mira el texto de la
  orden y tiene rodeos (un script en `tools/` lanzado con `node tools/*` hace lo que `curl` no
  puede); el sandbox limita lo que **cualquier** orden puede hacer. **Sin red**: `npm audit` lo
  lanza el usuario. Con él debajo, los permisos se amplían.
- **Lo prohibido no se mueve:** `push`, instalar dependencias, `reset --hard`, `clean`, `.env` y
  `~/.ssh`. Editar `.claude/` sigue preguntando.
- **Commits:** uno por tarea, en una rama por bloque, en esta misma carpeta (sin *worktree*).
  Juntar con `main` y publicar siguen siendo del usuario. Un hook impide comitear en `main`.
- **Tandas de un bloque**, al menos al principio. **Las roturas, como hasta ahora:** al cerrar cada
  tarea que toque `src/`.
- **Cuándo para Claude:** una decisión no cerrada o que choque con una cerrada; elegir entre
  soluciones con consecuencias distintas; una dependencia; cambiar el modelo del dominio o un
  puerto; un fallo que no consigue arreglar. Una duda que no bloquea va a *Sin decidir* y sigue.
- **Cada tarea, etiquetada al planificarla:** *(mecánica)* —el cómo ya está decidido— la hace un
  subagente con Sonnet, que para ante cualquier decisión, y Claude la revisa; *(pensar)*, Claude
  con Opus.
- **Lo cerrado sale de este fichero** a `TERMINADAS.md`, para que lo que se lee al trabajar no
  crezca sin medida (tarea 8).
- **La documentación, vigilada como el código.** Se pudre cuando afirma algo del repo que cambia
  sin ella: donde la Fase 9 puso guardianes no ha vuelto a pasar, y los agentes, que quedaron
  fuera, sí. Tres capas: escribir menos que pueda pudrirse (remitir, no copiar; nada de recuentos
  ni de «hoy existe…»; ningún documento sin dueño); un guardián para las referencias que se
  pueden comprobar (tarea 9); y, para lo que sólo se ve leyendo, **una auditoría de la
  documentación al final de cada fase** (tareas 6 y 11).
- **Las tareas 0 a 9, con la correa corta**, una a una y con el visto bueno del usuario: son las
  que cambian las reglas. La 10 ya con la correa larga, y la 11 cierra la fase.
- **Orden (2026-10-18), las baratas primero** por el límite semanal de uso: 1 → 2 → 5 → 3 → 4 →
  6 → 9, y luego 8 → 7 → 10 → 11. La 2 antes de la 3 (los permisos se amplían sobre el sandbox);
  la 5 antes de la 3 (comitear sin preguntar, con `main` ya cerrada); la 3 antes de la 4 (se poda
  lo que ya esté en `settings.json`); la 7 tras la 8 (su hook lee lo pendiente de este fichero ya
  partido).

- [x] **0. Apuntar la fase** ✅ *(2026-10-18)*: esta entrada.
- [x] **1. Borrar los cuatro agentes** ✅ *(2026-10-18)* (`back-dev-agent`, `infra-agent`, `doc-agent`,
      `frontend-agent`). Quedan en `git log`. El `deny` de `.claude/agents/` pasa a `ask`: las
      fichas futuras las podrá escribir Claude, con permiso en cada edición. C2 se cierra (borrado);
      la nota de *Sin decidir* sobre las fichas desfasadas, también; el título de *Infraestructura*
      pierde el nombre del agente. Las menciones de las fases cerradas son historia y se quedan.
      **Se cierra cuando** `.claude/agents/` está vacía, el `deny` es `ask`, un `grep` de los cuatro
      nombres no da nada fuera de las fases cerradas y `check` pasa.
- [x] **2. Sandbox sin red** ✅ *(2026-10-18)*, en `.claude/settings.json` (`bubblewrap` y `socat` ya están). Los
      nombres de la configuración, de la documentación de Claude Code, no de memoria. **Se cierra
      cuando**, roto a propósito, fallan un `curl`, un `fetch` desde un script de Node y escribir
      fuera del proyecto; y siguen funcionando `npm run check`, los dos hooks, `check:roturas` y el
      servidor del panel.
      **Hecho:** `enabled`, `failIfUnavailable`, `allowUnsandboxedCommands: false` y
      `deniedDomains: ["*"]`. Rotos a propósito: el `fetch` de Node, sin ruta; Python, `403` del
      proxy; escribir en `~`, sólo lectura. `curl` no se lanzó: ya lo niegan los permisos y va por
      el proxy como Python. `check`, las 46 roturas, los dos hooks (corren fuera del sandbox) y el
      panel, en verde. **Dos cosas que salieron:** el sandbox vuelve **no escribibles** las rutas
      de los `deny` de `Edit`, y `allowWrite` no lo levanta; `tmp-test/` pasó de `deny` a `ask`
      (decidido por el usuario) para que compile `npm test`. Y, dentro del sandbox, las rutas
      protegidas que no existen (`.bashrc`, `.mcp.json`, `.claude/agents`…) se tapan con un
      `/dev/null` que `git status` ve como sin seguimiento; fuera no existen. **Por eso, `git add`
      siempre por nombre, nunca `-A` ni `.`** (a la regla de la tarea 6).
- [x] **3. Permisos ampliados** ✅ *(2026-10-18)* encima del sandbox: `defaultMode` a `acceptEdits`; permitidos los
      intérpretes (`node`, `python3`), los de leer (`cat`, `head`, `tail`, `sed`, `awk`),
      `git rm`, `git mv`, `git branch`, `git add`, `git commit`, `git switch` y el navegador del
      panel. Los `deny`, intactos. **Se cierra cuando** una tanda normal no pregunta por ediciones
      ni por órdenes de rutina, y una orden de la lista de prohibidas sigue prohibida.
      **Hecho:** `npm install` y `git push` siguen denegados, y `nodejs.org` sigue sin red aunque
      su `WebFetch` esté permitido (manda `deniedDomains`). La sesión había heredado un `PATH` con
      una Node 20 desinstalada y la 12 del sistema delante de la 26, y `PATH=… npm` pregunta
      siempre; el usuario lo arregló con `nvm alias default 26` y reiniciando la app. Tras eso,
      `npm run check`, `git add` y un `git commit --dry-run` no preguntan.
- [x] **4. Podar `.claude/settings.local.json`** ✅ *(2026-10-18)*, otra vez: han vuelto `python3 -`,
      `python3 -c '*'` y `Read(//home/ubuntu/**)`, que A1 había quitado. **Se cierra cuando** sólo
      quedan reglas de leer o consultar que no estén ya en `settings.json`.
      **Hecho:** de 33 reglas quedan 8 (tres `WebFetch`, `WebSearch`, dos `Read` acotados,
      `git check-ignore` y `git rev-list`). Fuera lo que ya cubre la tarea 3, `Read(//home/ubuntu/**)`,
      los `bash -lc`/`-ic` y las comprobaciones de una sola vez. Vuelven cada vez que se responde
      «sí, y no volver a preguntar»: se poda en el repaso de cierre de fase. El fichero no se versiona.
- [x] **5. Un hook que impide comitear en `main`** ✅ *(2026-10-18)*: un patrón de permisos no distingue la rama.
      **Se cierra cuando**, roto a propósito, un commit en `main` se bloquea y en otra rama pasa.
      **Hecho:** modo `comitear` de `.claude/hooks/checks.mjs`, en `PreToolUse` de Bash; bloquea
      `git commit` en `main` o en la orden que cambia a `main`. Rotos a propósito: `git switch main
      && git commit`, bloqueado con el hook vivo; en un repositorio de juguete en `main`, bloqueado,
      y en otra rama o sin `commit`, pasa. Sin rotura en `tools/roturas.mjs`, como los otros dos
      modos: el sandbox no deja escribir en `.claude/hooks/` y `check-roturas` sólo lanza scripts
      de npm.
- [x] **6. La regla de trabajo, escrita** ✅ *(2026-10-18; `CLAUDE.md` → *Cómo se trabaja*, en 293 de
      las 300 líneas: la 7 y la 8 tendrán que hacerse sitio)* en `CLAUDE.md`: cuándo para, un commit por tarea en una
      rama por bloque, las roturas, la etiqueta *(mecánica)* o *(pensar)*, y el ritual de cierre de
      fase: la auditoría de la documentación (tarea 11) y el repaso de la memoria. Y al día las
      memorias de Claude que la contradicen («confirmar tras cada tarea», «no comitear»). **Se cierra cuando**
      `CLAUDE.md` la recoge, `check:arquitectura` pasa y las memorias dicen lo mismo.
- [ ] **7. Compactar antes y retomar solo.** El umbral de compactación automática, a la mitad de
      la ventana; una sección «Compact Instructions» en `CLAUDE.md` (fase, tarea, rama, lista con
      ✅, dudas, lo que estaba a medias y el siguiente paso); y un hook tras compactar
      (`SessionStart` con `compact`) que añade la rama, lo que hay sin comitear, los commits de la
      rama y lo pendiente de la fase en curso, acotado a eso. Manda el repo sobre el resumen.
      **Se cierra cuando** una compactación forzada con `/compact` a mitad de una tarea retoma sola
      donde estaba, con la rama y la lista correctas.
- [x] **8. Partir este fichero: lo cerrado, a `TERMINADAS.md`** ✅ *(2026-10-18)*. Se mueve **cada entrada, no
      cada sección**, cuando ya no pide nada a nadie. A `TERMINADAS.md`: las fases cerradas,
      resumidas en 20 líneas como mucho (qué, cuándo, la deuda que dejó, commits clave); las
      tareas sueltas, **al terminarlas**; las descartadas, las decisiones cerradas y los hitos, en
      una línea. Se quedan aquí: la deuda de las fases cerradas, con su origen, en una sección
      propia; la fase en curso entera, hasta cerrarla; lo pendiente, lo sin decidir, las ideas
      aparcadas y la nube. Al día la tabla de `CLAUDE.md`, la cabecera de este fichero y las
      referencias rotas. Al cerrar cada fase, además, un repaso de la memoria de Claude. **Se
      cierra cuando** `check:tareas` falla, roto a propósito, con una fase cerrada o un `[x]` o un
      tachado fuera de la fase en curso aquí, y con una fase de más de 20 líneas en
      `TERMINADAS.md`; sus roturas están en la lista, y el fichero partido lo pasa.
      **Hecho:** de 1.399 a unas 630 líneas, con un script que corta por líneas. A `TERMINADAS.md`,
      las fases 1 a 9 resumidas (de 10 a 19 líneas), las tareas sueltas e *Infraestructura*, los
      descartes, las decisiones cerradas de *Sin decidir* y la Versión 1 como hito. Aquí, una
      sección nueva, *Deuda de las fases cerradas*, con lo abierto de las fases 3, 4, 5 y 9 y cuatro
      avisos sin tarea; esta fase pasa a «EN CURSO», que es lo que `check:tareas` busca para saber
      cuál es; y fuera los «0. Apuntar la fase» marcados de la 10 y la 10.1 y los cuatro tachados
      de *Ideas aparcadas*. Cuatro roturas nuevas de `check:tareas` y una de `check:arquitectura`,
      que ahora mira también las `§` de `TERMINADAS.md`. **Queda sin hacer:** el hook de editar
      lanza `check:tareas` al tocar `TAREAS.md` pero no `TERMINADAS.md`; el sandbox no deja
      escribir en `.claude/hooks/`, así que lo cambia el usuario (o la tarea 7, si toca el hook).
- [x] **9. Un guardián de referencias en la documentación** ✅ *(2026-10-18; `tools/check-referencias.mjs`,
      con sus tres roturas cazadas y `check` en verde. Mira sólo lo versionado, y cuenta como
      existente lo ignorado por git, para que dé lo mismo en Actions. Las rutas que no empiezan
      por una carpeta del repo ni son de código, como `notes/rota.json`, son del almacén y no
      se miran)* (`check:referencias`, en `check` y en
      el hook de editar un `.md`): falla si un documento cita entre comillas de código un fichero o
      carpeta que no existe, una orden `npm run …` que no está en `package.json` o un alias `#…`
      que tampoco. Lleva a ficheros, órdenes y alias lo que `check:arquitectura` ya hace con las
      `§`. Mira `CLAUDE.md`, `ARCHITECTURE.md`, `README.md`, los `.md` de `test/` y los de
      `.claude/`; **no** `TAREAS.md` ni `TERMINADAS.md`, que nombran a propósito lo que aún no
      existe o ya no existe. **Se cierra cuando**, roto a propósito con cada uno de los tres
      casos, falla; sus roturas están en la lista, y los documentos de hoy lo pasan.
- [ ] **10. La tanda de prueba, con la correa larga**: cuatro pendientes pequeñas que no dependen de
      ninguna decisión, encadenadas sin parar: quitar `CarpetaRecorrible` (Fase 3), renombrar
      `NoteList` (Fase 5), los colores repetidos fuera de `base.css` y que una posición o una acción
      desconocidas no hagan nada (*Sin fase asignada*). Cada una cierra como dice su entrada. **Se
      cierra cuando** las cuatro están comiteadas en su rama, y el usuario ha revisado la tanda y
      dicho qué ajustar de la regla.
- [ ] **11. La auditoría de la documentación, la primera** *(pensar)*: el ritual con el que se
      cerrará cada fase. Un subagente, sin haber escrito nada de la fase, lee los documentos
      vigentes contra el repo (`CLAUDE.md`, `ARCHITECTURE.md`, `TAREAS.md`, `README.md`, las listas
      de `test/` y lo de `.claude/`) y devuelve cada afirmación falsa, con fichero, línea y por qué.
      Claude las corrige y el informe se le enseña al usuario. Cómo se pide, escrito en
      `CLAUDE.md` con la regla de la tarea 6. **Se cierra cuando** el informe está enseñado, lo
      falso corregido y `check` pasa.

### Fase 10 — Funcionalidades nuevas: ocultos, reordenar, selección en el lienzo, texto y Markdown — PLANIFICADA, empieza al cerrar la 9.1

**Decidida con el usuario el 2026-10-18**, a partir de una lista que trajo de usar la app. De
siete ideas entran cinco; los subcontextos se aparcan (*Ideas aparcadas*) y «fijar» se descarta
porque reordenar lo cubre. **Sin dependencias y sin migrar**: ningún cambio obliga a convertir lo
guardado. **Orden:** lo previsible primero (1-3), el editor al final (4-6), con una parada para
probar el 4 en el móvil antes de construir el Markdown encima.

**Decidido con el usuario el 2026-10-18:**
- **Ocultos, por contexto** (al estilo de los archivados de WhatsApp): lo oculto **sigue siendo del
  contexto** —en «Mover a…», en los enlaces, en el lienzo—, sólo no sale en su lista. Para
  limpiar la lista de lo que ya se ve dentro de un diagrama. El General lo enseña todo. En
  pantalla, «Ocultar» / «Mostrar» y la fila «Ocultos (n)» arriba, con un icono SVG monocromo del
  color del fósforo (un emoji saldría a color).
- **Ocultos como `hidden` ⊆ `items`**, no dos listas que se repartan los elementos ni una marca
  dentro de cada entrada de `items` (eso cambiaría su tipo, decisión cerrada, y pediría migrar).
  El tipo permite el estado incoherente; lo impiden el reducer, `hydrate` y su rotura, como el
  resto de la integridad referencial.
- **Reordenar, no fijar.** Con el `⠿` del modo selección, en el lateral de cada fila. El General
  no se reordena: va por nombre.
- **Selección en el lienzo, sin desmarcar:** el rectángulo selecciona, el arrastre mueve; para
  cambiar la selección, otro rectángulo. Mover desde un nodo marcado, no desde el área. Por ahora,
  sólo mover. **Cambia la decisión cerrada «sin selección»** del lienzo.
- **El texto de una línea pasa a ser Markdown**, un subconjunto, leído línea a línea: la cadena
  del modelo es la misma en el core, en el disco y en la pantalla; la pantalla sólo la lee para
  pintarla. Ni motor de edición ni texto rico propio. Los enlaces internos van **por
  identificador**: renombrar no los rompe.
- **Seleccionar texto como en cualquier página**, por encima de varias líneas, y copiar **texto
  plano**: los enlaces como su texto visible, las casillas sólo con su texto. Ni «copiar nota» ni
  «copiar desde aquí».

- [ ] **1. Ocultos por contexto** *(pensar)*. En el core, `Context.hidden` (ausente = vacío, sin
      migrar) con dos acciones, ocultar y mostrar, que reciben varios elementos; ocultar lo que no
      está en `items` no hace nada. Quitar un elemento del contexto o borrarlo lo saca también de
      `hidden`; `hydrate` y `schema.ts` tiran lo de `hidden` que no esté en `items`. **Lo creado
      desde el lienzo nace oculto** en los contextos del diagrama; lo que ya existía y se pone en
      el lienzo, no. «Mover a…» desde un contexto lo deja visible en el destino. En pantalla:
      «Ocultar» en la barra del modo selección; la fila «Ocultos (n)», sólo si hay alguno, abre su
      lista encima, con «Mostrar», «Mover a…» y la papelera, sin reordenar. Al mostrar, vuelve a su
      sitio. **Se cierra cuando** la invariante tiene sus pruebas y su rotura en
      `tools/roturas.mjs`, `check` pasa y la lista manual de las ventanas tiene sus pasos, pasados.
- [ ] **2. Reordenar en un contexto** *(pensar)*. Una acción que mueve **varios** elementos a una
      posición, como un bloque pegado y en su orden relativo; soltarlos donde estaban no hace nada
      y devuelve el mismo contexto (`strictEqual`). En pantalla: en el modo selección sale el `⠿`
      en todas las filas; arrastrar uno mueve todo lo seleccionado, y si la fila no lo estaba, se
      suma antes. Al soltar se sigue en el modo selección. En el General no hay `⠿`. Reutiliza lo
      que se pueda de `dragReorder.ts` y `dropIndex.ts`. **Se cierra cuando** la acción tiene sus
      pruebas de no-op y su rotura, `check` pasa y la lista manual tiene sus pasos, en el ordenador
      y en el móvil.
- [ ] **3. Selección de nodos en el lienzo** *(pensar)*. Un botón junto a la mira activa el modo,
      en vídeo inverso. Arrastrar sobre vacío **o sobre un nodo sin marcar** dibuja un rectángulo:
      al soltar, se marca **todo lo que toca** y sustituye a la selección anterior, y el
      rectángulo desaparece. Arrastrar un nodo marcado mueve el grupo, con **una sola acción** y un
      solo guardado al soltar. Dentro del modo, el lienzo se desplaza con dos dedos o con la rueda.
      Volver a pulsar el botón sale y quita la selección. **Además, para todo arrastre de nodos**,
      dentro o fuera del modo: con el dedo en una franja junto al borde (unos 40 px), el lienzo
      avanza hacia ese lado a velocidad **fija y moderada**; el encuadre se guarda al soltar, como
      hoy. **Se cierra cuando** la acción de mover varios tiene sus pruebas y su rotura, la decisión
      «sin selección» está cambiada en `CLAUDE.md`, y las listas del lienzo tienen sus pasos,
      pasados en el ordenador y en el móvil.
- [ ] **4. Seleccionar y copiar texto en una nota** *(pensar)*. Hoy cada línea es un elemento
      editable aparte y el navegador no deja que una selección salga de él. **Sólo es editable la
      línea activa**; las demás son texto normal, que se selecciona de corrido (arrastrar, o
      pulsación larga y asas en el móvil). Un toque sin arrastrar hace editable esa línea con el
      cursor donde cayó (`caretPositionFromPoint`). Al copiar, sólo texto plano: una línea por
      línea, sin las marcas de casilla. Intro, Retroceso y las flechas, como hoy: si cae una
      prueba del editor, era una decisión. **Se cierra cuando** `check` pasa, la lista del editor
      tiene sus pasos, y **el usuario lo ha probado en su móvil y da el visto bueno antes de
      empezar el 5**.
- [ ] **5. Markdown en el core: los enlaces y su integridad** *(pensar)*. Encontrar los enlaces
      internos dentro de un texto (`[texto](nota:id)`, `diagrama:id`, `contexto:id`), puro y en el
      core: al dominio sólo le importan los enlaces, no la negrita. **Borrar** una nota, un
      diagrama o un contexto cambia los enlaces que apuntaban a él por `[texto](perdido)` en todas
      las notas; `hydrate` hace lo mismo con los que lleguen rotos del disco. **Se cierra cuando**
      la invariante («ningún enlace a lo que no está») tiene sus pruebas, incluida la de identidad
      cuando ninguna nota enlazaba a lo borrado, y su rotura en `tools/roturas.mjs`, y `check`
      pasa.
- [ ] **6. Markdown en pantalla** *(pensar)*. El subconjunto: `**negrita**` (más brillo),
      `*cursiva*`, `# ` al principio de la línea (título), `[texto](https://…)` y los internos del
      5; además, lo que empiece por `http://`, `https://` o `www.` se detecta solo (`www.` se abre
      con `https://` delante; un dominio pelado, no). La barra invertida escribe las marcas
      literales. **La línea activa se ve en crudo; las demás, formateadas.** Con el cursor dentro de
      un enlace sale una **burbuja** con «↗ Abrir» (y «Cambiar» y «Quitar» si es un enlace
      guardado); un interno se abre apilado encima; uno perdido se ve «texto (perdido)». En la
      barra de la nota, **«Enlazar…»**: pegar una dirección o elegir nota, diagrama o contexto en
      una lista como la de «Mover a…», y se escribe el enlace donde está el cursor. Leer el formato
      es una pieza pura, con pruebas en Node. **Se cierra cuando** esa pieza tiene sus pruebas,
      `check` pasa y la lista del editor tiene sus pasos, pasados en el ordenador y en el móvil.
- [ ] **7. Documentación, en un solo pase al cerrar.** En `CLAUDE.md`: «sin selección» del lienzo
      cambiada, el texto como Markdown, los ocultos (`hidden` ⊆ `items`), reordenar con el `⠿` y
      sólo es editable la línea activa. En `ARCHITECTURE.md`, el principio que sale del 5: **la
      integridad referencial llega también a las referencias dentro del texto**. Y la auditoría
      de la documentación de cierre de fase. **Se cierra cuando** los dos lo recogen,
      `check:arquitectura` pasa, `check:roturas` pasa entera y la auditoría no deja nada falso.

### Fase 10.1 — Equipo: un revisor, y un verificador si puede — PLANIFICADA, empieza al cerrar la 10

**Decidida con el usuario el 2026-10-18**, junto con la 9.1. **Qué es:** que el trabajo pase por
filtros antes de llegar al usuario. Va después de la 10 a propósito: la correa larga se prueba
primero con funcionalidades de verdad, y lo que salga de ahí cambiará este diseño. **No cambia la
app.** **Se apoya en la 9.1 y no la repite:** el sandbox y los permisos, `.claude/agents/` en
`ask`, la regla de cuándo para Claude, un commit por tarea en su rama, la etiqueta *(mecánica)* o
*(pensar)*, que también elige el modelo de cada agente, y compactar y retomar solo. Lo nuevo son
los dos agentes y el recorrido.

**Decidido con el usuario el 2026-10-18:**
- **Claude, en la sesión principal, dirige y escribe el código**; no hay agente coordinador: un
  subagente no lanza a otros. Plan y Explore, los de serie, cuando hagan falta. Un desarrollador
  delegado, sólo si las tandas se alargan y el contexto no aguanta.
- **El recorrido de cada tarea:** código → `check` → **revisor**, que si encuentra algo lo devuelve
  y Claude corrige, con un tope de vueltas (unas 3; si no se resuelve, la tarea se aparca como
  duda) → **verificador**, sólo si se ve en el navegador → roturas, sólo si toca `src/` → commit.
- **Las roturas no son un agente:** son una orden fija sin criterio; se lanza en segundo plano y se
  lee el resumen.
- **Al principio, sin votación de dos revisores ni Workflow**: lo primero si al revisor se le
  escapan cosas; lo segundo cuando el recorrido lleve unas tandas sin cambiar.

- [ ] **1. ¿Puede un subagente usar el navegador del panel?** *(mecánica)* Un subagente de prueba
      abre la app, lee la página y hace una captura. **Se cierra cuando** el resultado está
      escrito aquí: si puede, hay verificador (tarea 3); si no, la 3 se tacha y las listas las
      sigue pasando Claude.
- [ ] **2. El revisor** *(pensar)*, en `.claude/agents/`, con Opus y sólo de lectura: lee el cambio
      sin haberlo escrito y mira lo que ningún guardián vigila —las reglas de `CLAUDE.md` que
      «tienes que recordar tú»—, fallos, pruebas que faltan para el no-op, decisiones cerradas que
      el cambio contradice. **Sólo el código:** la documentación la revisa la auditoría de cierre
      de fase, no cada tarea. Devuelve una lista con fichero y línea, o «nada que objetar». Corto: remite a `CLAUDE.md`, no lo copia. Cierra C3
      de la Fase 9. **Se cierra cuando** su ficha está escrita y, sobre un cambio con un fallo
      metido a propósito que ningún guardián caza, lo encuentra.
- [ ] **3. El verificador** *(pensar)*, si la 1 dice que puede: pasa las listas `VERIFICACION-*.md`
      siguiendo `test/PASAR-LAS-LISTAS.md`, sin editar código, y devuelve cada paso con ✅ o ❌ y
      lo que vio. Candidato a Sonnet, porque sigue una lista escrita. **Se cierra cuando** su ficha
      está escrita y ha pasado una lista entera, anotada, con un fallo metido a propósito cazado.
- [ ] **4. Una tanda real con el recorrido completo** *(pensar)*: un bloque de tareas pendientes,
      con la correa larga y los dos filtros. **Se cierra cuando** la tanda está comiteada en su
      rama y el usuario la ha revisado y dicho qué ajustar del recorrido.
- [ ] **5. Documentación, en un solo pase al cerrar.** En `CLAUDE.md`, cuándo se llama a cada
      agente; el porqué de los filtros, en `ARCHITECTURE.md` si es un principio. Y la auditoría
      de la documentación de cierre de fase. **Se cierra cuando** los dos lo recogen,
      `check:arquitectura` pasa y la auditoría no deja nada falso.

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

- [ ] **Exportar a Markdown**, legible y **sólo hacia fuera**. Desde el 2026-10-12, con «manda el
      modelo» (ver *La nube*): así no hacen falta ni los ids de línea, ni escapar lo que parece
      Markdown, ni decidir qué pasa con lo editado fuera. Importar `.md`, si llega, crearía notas
      nuevas, sin ida y vuelta. Es otra cosa que la copia: el JSON es para restaurar, el Markdown
      para leer, y los diagramas no caben en él.
      **Se cierra cuando** la conversión de una nota a Markdown tiene sus pruebas, el botón de ⚙
      descarga el fichero y la lista manual tiene su paso.
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
- [ ] **Enlaces en los nodos del lienzo** *(salió al planificar la Fase 10, 2026-10-18; el usuario
      se lo piensa)*. Con el texto en Markdown, la pregunta es si el texto de un nodo simple también
      admite formato y enlaces, con la misma burbuja. El nodo-nota se queda como está. **Se cierra
      cuando** el usuario decide: una tarea con fase, o a *Ideas aparcadas*.

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
| **Subcontextos, o un contexto como elemento de otro** | Planteado por el usuario el 2026-10-18 y aparcado por él: interesa, pero no hace falta. De los dos, prefiere **la referencia a la contención**: un contexto enlazado desde varios (n a n, como una clave ajena), sin árbol y sin recorrerlo recursivamente. Un árbol abriría ciclos, qué pasa al borrar un padre, cómo se abre y qué enseña el General. Desde la Fase 10, una nota ya puede enlazar un contexto con `[texto](contexto:id)`. | Echar en falta ver un contexto **dentro de la lista** de otro, no sólo enlazado desde una nota. Ese día, un tercer tipo de `ItemRef` (`kind: "context"`), con la limpieza al borrar como la de las notas. |
| **Manejar el lienzo con teclado**, y reordenar las fichas de ⚙ con teclado | El usuario lo dejó para más adelante (Fase 5); no bloqueaba nada. | Que lo pida el usuario. |
| **Anotar los tipos en las pruebas viejas** (942 anotaciones de `test/core/` y `test/storage/`, medido el 2026-09-19) | Deuda aceptada a sabiendas: trabajo mecánico que no caza ningún fallo, con un diff irrevisable. Lo que se escribe o se toca ya cumple la regla, y eso impide que crezca. | Tocar esas pruebas por otro motivo: lo que se toque, se anota. |
| **Reordenar y re-anidar líneas** (`move`, y con ella `indent`/`outdent`) | No hay quien lo use: sin gesto de arrastrar, `move` no tiene consumidor, y el Tabulador no existe en un móvil. Hoy una lista se queda en el orden en que se escribió, y arreglarla es borrar y reescribir. | Llegar a la Fase 4 y **echarlo de menos con el editor delante**. Es puramente añadido —no cambia ninguna operación, ni el formato en disco, ni obliga a migrar—, así que cuesta lo mismo entonces que hoy. Ojo a dos cosas ese día: hace falta un cuarto caso de `Position` (`before`, para "la primera del todo"), y `move` **no** puede escribirse como `remove` + `insert` o heredaría la guarda de las casillas con hijas. |
| **Adaptador de MongoDB** (o cualquier base de datos con servidor propio) | Requiere un backend HTTP propio: el driver de Mongo habla TCP y no funciona desde navegador, y la Data API de Atlas está retirada. **Reconsiderado el 2026-10-12** al elegir la nube, y lo mismo vale para SQL con servidor propio: el usuario no quiere mantener un servidor, así que se eligió Supabase (*Pendiente → La nube*). | Que hubiera ya un backend propio por otro motivo. Montar uno solo para esto no sale a cuenta. |
| **`storageTarget` por contexto** (enrutar notas privadas a un backend concreto) | Presupone varios backends, que no existen. | Lo mismo que el anterior, más una necesidad real de separar notas por destino. |
| **Cambiar `LocalStorageBlobStore` por IndexedDB**, o por una base ligera (SQLite compilado a wasm, o similar) | Como tecnología, IndexedDB gana casi en todo —cuota de cientos de MB frente a ~5 MB, `Uint8Array` nativo frente al base64 que cuesta un 33% más, asíncrona de verdad cuando el puerto ya es `async`—, y aun así no compensa, por tres motivos. **(1) El hueco ya está ocupado:** "almacén grande, privado del origen, sin diálogo y con bytes nativos" es **OPFS**, que ya está construido y es el mismo `DirectoryHandleBlobStore` con otro handle. Un `IndexedDbBlobStore` sería una cuarta implementación duplicando a una existente, en el mismo *bucket* de cuota. **(2) El valor de `localStorage` aquí no es guardar, es que se puede falsear honradamente en Node**: Node no tiene ninguna de las dos, y el `Storage` falso son **52 líneas que además saben lanzar la excepción de cuota**. De ahí cuelga **la tercera pasada de la suite de contratos** (§6.3), la que monta la pila entera sobre un `BlobStore` de producción y que se ganó el sitio cazando fallos que las otras dos no veían (5 de 7 y 3 de 6, medidos). Falsear IndexedDB no son 52 líneas; sería `fake-indexeddb` —una dependencia, contra la política— o quedarse sin esa pasada. **(3) Una base ligera no es un `BlobStore` siquiera:** sustituiría a `StorageAdapter` entero, y choca de frente con el formato en disco (§6.1) y con "un fichero por entidad", que es decisión cerrada. Además arrastra ~1 MB de wasm en un proyecto de cero dependencias de runtime. | Que los ~5 MB **aprieten de verdad** — y ese día la respuesta sigue siendo **OPFS primero**, que no cuesta código. O que aparezca una necesidad que sólo una base cubre: consultas por contenido, índices, búsqueda de texto completo. Nada de eso tiene consumidor mientras `getAll` sea N lecturas al arrancar. **No confundir con lo que sí está planificado:** IndexedDB **entrará** para **guardar el handle de la carpeta** y hacer posible el botón de "reconectar carpeta"; eso no es esta idea y no está aparcado. *(Aquí decía «entra en la Fase 4»; desde el 2026-09-20 la carpeta del usuario como destino está fuera de la Fase 4, así que entra el día que lo haga ella.)* Verificado el 2026-09-13 en el andamio de la verificación manual: el handle vuelve tras recargar, con el permiso intacto y sin diálogo. **Reconsiderado el 2026-10-12** con «manda el modelo» y Postgres en la nube, y la conclusión no cambia: SQLite en el navegador es posible (wasm sobre OPFS, en un *Worker*), pero sin búsqueda ni volumen no tiene consumidor. Y «un fichero por entidad» se relee como **un documento por entidad**: lo que decide es el grano, no que sea un fichero. |
| **Replantear los efectos que no devuelven nada en clave más funcional** (el `Listener` del `Store` como flujo, `Cancel`/`Unsubscribe` con ámbito) | Salió de un inventario de **todas las funciones que devuelven `void`** en `src/core` y `src/storage`, hecho el 2026-09-19. **Ese inventario ya dio un arreglo real y está construido**: los casos de uso devolvían `void` y ahora devuelven la entidad o `null`. Lo que queda no es el mismo caso, y el criterio que los separa es el que hay que conservar: **¿la vuelta llevaría información que NO se deduce de los argumentos?** `dispatch(action)` no se deducía —lo decide el reducer—, y por eso valía la pena. `setItem(k, v)` se deduce entero: después de eso `k` vale `v`, así que devolver algo sería devolverle al llamante lo que él trajo. `clearTimeout` deja un solo bit —«¿seguía pendiente?»— que **ningún** sitio de los tres que cancelan miraría. **Y la reformulación buena no es cambiar retornos, son otras dos, las dos con su pega: (1) el `Listener` como flujo de estados**, con el write-behind convertido en un `scan` en vez de un objeto con cuatro variables mutables — pero eso **no elimina el `void`, lo centraliza**, y el `Store` ya tiene esa propiedad por otro camino («la única mutación del proyecto»); además construir el flujo a mano choca con cero dependencias y `rxjs` es justo lo que no se instala aquí. **(2) `Cancel` y `Unsubscribe` con adquirir-y-liberar por ámbito**, que es la forma funcional de un recurso — pero **no encaja con el debounce**, que necesita cancelar y reprogramar desde fuera en cada tecla: la vida de ese temporizador no es un bloque, es una carrera contra la siguiente pulsación. | **La Fase 4**, y en concreto el punto en que haya **dos suscriptores** (la UI y la persistencia) en vez de uno: es cuando un flujo empieza a pagar y se puede decidir con el caso delante. Ese día hay que resolver antes lo de cero dependencias. ⚠️ **Desde la Fase 4 hay dos suscriptores** —la UI y el write-behind— y esto **no se ha reabierto**: la UI se escribió con el `Listener` tal cual. **No confundir con el caso que quedaba vivo del mismo inventario:** el `void flush()` del write-behind, donde el error del flush automático no lo veía nadie — no se arreglaba con un retorno porque **no hay quien llame, es un temporizador**, y su arreglo fue el `onError`, **hecho en la Fase 4** (`f406d96`). |
| **Una librería pequeña sólo para mover y acercar el lienzo** (pan/zoom, sin dependencias propias) | Decidido el 2026-10-03 hacer el lienzo **desde cero**: las librerías de lienzo completas exigen React o guardan su propio estado, y mover y acercar son unas pocas cuentas puras que se prueban en Node. | **Que el pellizco o el arrastre no se dejen domar en el móvil real.** El lienzo se hizo sin ella, y **aún no se ha probado en el móvil**: se sabrá al pasar su lista, que desde el 2026-10-04 va al final de la Fase 5, con las relaciones ya encima. Ese día se evalúa una que haga **sólo** eso y no guarde estado; sería la primera dependencia de runtime, así que con el mismo cuidado que Snabbdom. |
| **Shells de escritorio y móvil (Tauri / Capacitor)** | Envuelven el output del build web. Ese build existe desde la Fase 4 (`npm run build:web`, a `dist/web/`), y desde la Fase 6 se publica como PWA, que ya da la app instalada en el móvil. | Era «una Fase 4 terminada», y ya se cumple. **Qué lo reabre ahora, sin decidir con el usuario.** Y ese es el momento de reconsiderar los workspaces de npm, no antes. **Desde el 2026-10-12, dos motivos con nombre:** el peer-to-peer automático (abajo) y guardar la sesión de la nube en el llavero del sistema. *Decidido ese día: se sigue con la PWA.* |
| **CRDTs y colaboración en tiempo real** | Un salto enorme de complejidad para un problema que en una app personal es raro. El sync entre dispositivos ya está diseñado, con su copia en conflicto (*Pendiente → La nube*). | Colaborar con otras personas en la misma nota. |
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
