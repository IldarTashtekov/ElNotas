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
- **Partir `DiagramCanvas.ts`** (Fase 9): es código de la app y se hace al tocar esa zona. En la
  tarea 3 de la Fase 10 salieron los botones (`canvasButtons.ts`) y las cuentas de la selección
  (`canvasSelection.ts`), pero el modo lo hizo crecer: queda partir las líneas y los gestos.
- **El recorrido conjunto de las listas**, `test/ui/VERIFICACION-SENTADA.md` (Fase 5): quedó para
  la próxima vez que se pasen las del lienzo.

### Fase 10 — Funcionalidades nuevas: ocultos, reordenar, selección en el lienzo, texto, y Markdown — EN CURSO

**Decidida con el usuario el 2026-10-18**, a partir de una lista que trajo de usar la app. De
siete ideas entran cinco; los subcontextos se aparcan (*Ideas aparcadas*) y «fijar» se descarta
porque reordenar lo cubre. **Sin dependencias y sin migrar**: ningún cambio obliga a convertir lo
guardado. **Orden:** lo previsible primero (1-3), el editor al final (4-6), con una parada para
probar el 4 en el móvil antes de construir el Markdown encima. **El calendario**, propuesto el
2026-10-24, salió de esta fase el 2026-10-25 y **volvió el 2026-10-27**, por decisión del usuario:
se plantea ahora, como tarea 7, antes de la documentación de cierre.

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
- **Un enlace interno es `[texto](#id)`** (2026-10-24): el id con que nace la entidad, sin tipo
  ni nombre delante, para que renombrar un tipo o la app no deje viejo lo guardado. El `#` dice
  que es interno aunque ya no exista nada con ese id; `https://…` es web, y lo demás, texto.
- **Los enlaces del texto, fuera de la integridad referencial** (2026-10-24): el core no los lee
  ni los toca, y borrar algo no los cambia. **Uno roto se ve roto**, sin aviso al abrir la nota;
  al pulsarlo no lleva a ningún sitio y sale «El enlace ya no existe» durante segundo y medio.
  Para contextos y lienzo, la regla sigue igual.
- **Contextos fuera de los enlaces, por ahora** (2026-10-25): «Enlazar…» sólo ofrece notas y
  diagramas; un `#id` de contexto escrito a mano se ve como roto. **Capas en cadena**: cualquier
  nota o diagrama se abre encima de cualquier otro y al recargar vuelve toda la cadena.
  El enlace roto se ve **apagado** (color), sin añadir texto.
- **Seleccionar texto como en cualquier página**, por encima de varias líneas, y copiar **texto
  plano**: los enlaces como su texto visible, las casillas sólo con su texto. Ni «copiar nota» ni
  «copiar desde aquí».

- [x] **1. Ocultos por contexto** *(pensar)*. En el core, `Context.hidden` (ausente = vacío, sin
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
      **Hecho en el ordenador** (`1023db8`, `618ad5b`; sección L, pasada 4). **Falta L7 en el
      móvil**, que pasa el usuario.
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
      **Hecho en el ordenador** (secciones I y J de `VERIFICACION-MANUAL-LIENZO.md`, pasada 3).
      **Falta pasar I y J en el móvil**: dos dedos, el arrastre del grupo y el avance por los bordes.
- [x] **4. Seleccionar y copiar texto en una nota** *(pensar)*. Hoy cada línea es un elemento
      editable aparte y el navegador no deja que una selección salga de él. **Sólo es editable la
      línea activa**; las demás son texto normal, que se selecciona de corrido (arrastrar, o
      pulsación larga y asas en el móvil). Un toque sin arrastrar hace editable esa línea con el
      cursor donde cayó (`caretPositionFromPoint`). Al copiar, sólo texto plano: una línea por
      línea, sin las marcas de casilla. Intro, Retroceso y las flechas, como hoy: si cae una
      prueba del editor, era una decisión. **Se cierra cuando** `check` pasa, la lista del editor
      tiene sus pasos, y **el usuario lo ha probado en su móvil y da el visto bueno antes de
      empezar el 5**.
      **Hecho** (`17ddeb6`, `67102cd`; sección M de `VERIFICACION-MANUAL-EDITOR.md`, pasadas 3 y
      4), y el usuario lo dio por bueno en su móvil el 2026-10-24.
- **5. Markdown en el core**: descartada el 2026-10-24 (`TERMINADAS.md` → *Descartadas*).
- [ ] **6. Markdown en pantalla** *(pensar)*. El subconjunto: `**negrita**` (más brillo),
      `*cursiva*`, `# ` al principio de la línea (título), `[texto](https://…)` y los internos,
      `[texto](#id)`; además, lo que empiece por `http://`, `https://` o `www.` se detecta solo (`www.` se abre
      con `https://` delante; un dominio pelado, no). La barra invertida escribe las marcas
      literales. **La línea activa se ve en crudo; las demás, formateadas.** Con el cursor dentro de
      un enlace sale una **burbuja** con «↗ Abrir» (y «Cambiar» y «Quitar» si es un enlace
      guardado); un interno se abre apilado encima; uno roto (su id ya no existe) se ve apagado, con
      el color de `--dim` y sin añadir texto (2026-10-24), y al pulsarlo sale «El enlace ya no existe» durante segundo y medio. La
      barra invertida delante de un enlace, a decidir al plantear esta tarea. En la
      barra de la nota, **«Enlazar…»**: pegar una dirección o elegir nota, diagrama o contexto en
      una lista como la de «Mover a…», y se escribe el enlace donde está el cursor. Leer el formato
      es una pieza pura, con pruebas en Node. **Se cierra cuando** esa pieza tiene sus pruebas,
      `check` pasa y la lista del editor tiene sus pasos, pasados en el ordenador y en el móvil.
      **Por piezas, un commit cada una** (acordado el 2026-10-24): **6a**, el lector de formato
      puro con sus pruebas: la especificación, con todos los casos raros y la barra invertida, la
      escribe Opus *(pensar)*; la construye un subagente con Sonnet *(mecánica)*. **6b**, pintar
      las líneas y que un toque en una formateada deje el cursor en su sitio del texto en crudo:
      Opus *(pensar)*. **6c**, la burbuja y el aviso del enlace roto; **6d**, «Enlazar…»; **6e**,
      los pasos de la lista y pasarlos en el panel: Sonnet *(mecánica)*, con especificación
      cerrada, parando ante cualquier decisión, y Opus revisa antes del commit. Haiku, sólo para
      búsquedas y resumir salidas largas, no para código.
      **Hecho en el ordenador** (6a `36bce45`, 6b `971ada1`, 6c `d34dee4`, 6d `225385d`, y los pasos
      de la lista en `6359079`; secciones N a Q de `VERIFICACION-MANUAL-EDITOR.md`, pasada 5;
      `check:roturas` entera, 70 caen). **Falta pasar en el móvil** la pasada 6: M4, N, O, P y Q.
      **6f, el enlace como bloque** (pedido por el usuario el 2026-10-27, al probarlo; sustituye
      lo de «línea activa en crudo» **sólo para los enlaces guardados**): en la línea activa un
      `[texto](destino)` **no se ve en Markdown**, es un bloque con su texto, que no se edita letra
      a letra; Retroceso pegado a él lo borra entero. Tocarlo saca la burbuja. Lo guardado sigue
      siendo Markdown. **«Enlazar…»** gana un campo **Texto** (vacío: el dominio, o el nombre de
      la nota); con texto seleccionado, ése es el texto, web o interno. **«Cambiar»** abre la misma
      hoja con texto y destino rellenos. Las direcciones sueltas (`https://…` sin corchetes) se
      siguen viendo tal cual al escribirlas. Por piezas: **6f-1**, lo puro (partir la línea en
      tramos y bloques, pasar posiciones de lo que se ve a lo crudo, el texto por omisión, cambiar
      texto y destino) con pruebas; **6f-2**, el editor, la hoja y la burbuja, y los pasos de la
      lista, pasados en el panel. Ambas, con subagente Sonnet *(mecánica)* sobre esta
      especificación, y Claude revisa.
      **Hecho** (6f-1 `9f86d3c`, 6f-2 `08aeeee`; el usuario lo dio por bueno en su navegador el
      2026-10-27). R3, R6 y R10 pasadas en el panel el 2026-10-28 (pasada 9). **Falta** lo que
      quedó sin probar de R1 a R9 (varios enlaces pegados, R5 entre bloques, R7 con texto vacío,
      R8, R9 por separado), y en el móvil la pasada 7. **A decidir con el usuario:** si al elegir una dirección como texto
      el campo Texto debe llevar el dominio, y si un `[texto](destino)` escrito o pegado a mano en
      la línea activa se convierte en bloque al momento (hoy, al reactivar la línea).
      **6g, las marcas de negrita y cursiva escondidas** (pedido por el usuario el 2026-10-27, que
      eligió dejar la sintaxis como está: `**negrita**` y `*cursiva*`): en la línea activa, los
      `*` y `**` **no se ven salvo con el cursor dentro de la palabra o pegado a ella**; al
      entrar aparecen para poder editarlos, y la palabra se ve ya en negrita o cursiva mientras
      se escribe. El `# ` del título se queda visible mientras la línea está activa (la palabra es
      toda la línea). Las barras `\` también se ven. Las marcas son texto de verdad, sólo ocultas
      por CSS, de modo que lo guardado y las posiciones crudas no cambian. Por piezas: **6g-1**,
      lo puro (el lector dice qué marcas forman cada par; la línea activa se parte en tramos con
      su estilo y sus marcas) con pruebas; **6g-2**, el DOM (pintar y repintar al teclear sin
      perder el cursor ni romper la composición del móvil; revelar al mover el cursor) y los
      pasos de la lista. Con subagente Sonnet *(mecánica)* sobre esta especificación, y Claude revisa.
      **Hecho** (6g-1 `7d84b31`, 6g-2 `38d905d`; el usuario lo probó en el ordenador y lo dio por
      bueno el 2026-10-27). S5, S6 y S8 pasadas en el panel el 2026-10-28 (pasada 9). **Falta** la
      pasada 8 en el móvil (S9). **A decidir:** si copiar dentro de la línea activa saca los asteriscos escondidos.
**7. Calendario**, planteado con el usuario el 2026-10-27 y **en dos tandas**: primero el
calendario con los eventos (7a-7g), después las rutinas (7h-7j). Lo decidido y el modelo, aquí;
las tareas, debajo. Propuesto por el usuario el 2026-10-24.
      **Qué es** (esbozos del usuario, 2026-10-27): un calendario simple del que salen dos
      funciones separadas. **Eventos:** un mes; al pulsar un día se crea uno (día, hora opcional,
      motivo, hecho); se agrupan en **grupos de eventos** que se despliegan y se eligen en modo
      selección para pintar sus días en el mes; hay vista de grupos y de archivados. **Rutinas:**
      un tracker de hábitos en cadena (nombre y días cumplidos), con meta opcional por semana
      (5 días cumplen la semana); los días se marcan en la cadena, y el mes sólo enseña el progreso.
      **Decidido con el usuario el 2026-10-27:**
      - **Eventos, grupos y rutinas, en el core**, como entidades guardadas, con copia de seguridad.
        Los grupos de eventos, **un concepto aparte**: un contexto sigue guardando sólo notas y diagramas.
      - **El día, un texto `2026-07-02`; la hora, otro texto `18:00` opcional.** Es un día del
        calendario, no un instante: no se mueve con la zona horaria ni el horario de verano, se lee
        en el fichero y se ordena como texto. Los días de una rutina, la misma clase de texto.
        «Hoy» lo calcula la plataforma y lo pasa al core; el core sigue sin leer el reloj. **Si un
        día hace falta un instante exacto** (avisos, reuniones entre zonas), un campo opcional
        `zona` junto a la hora y entonces un puerto; lo guardado hoy sigue valiendo. **No timestamps.**
      - **Acceso:** un icono de calendario al lado de ⚙, y también se puede añadir como ventana.
        **Cambia dos decisiones cerradas** (las cuatro vistas, y «ventana = referencia a un
        contexto»), por decisión del usuario; al construirlo se actualizan en `CLAUDE.md`.
      - **La semana empieza en lunes**, fija por ahora.
      - **Un evento no tiene por qué estar en un grupo.** Se crea pulsando un día, y la hoja pide
        lo necesario (día, hora opcional, motivo) y, si se quiere, un grupo existente o uno nuevo,
        que se crea ahí mismo.
      - **Los grupos:** una redonda para elegirlos; los días con eventos de los grupos elegidos
        salen marcados en el mes. Los eventos de un grupo, **ordenados por tiempo**.
      - **Una pulsación larga en un grupo lo mueve** por la lista, y se puede dejar dentro de
        «archivados»: no se ve, pero no se borra. **Se archivan los grupos**, como en el esbozo.
      - **Los eventos sin grupo** se ven en un elemento fijo de la lista, «Sin grupo», que
        funciona como un grupo más (con su redonda y sus eventos por tiempo).
      - **Un evento puede estar en varios grupos**; está en «Sin grupo» cuando no está en ninguno.
        El mes pinta un día si cualquiera de los grupos de uno de sus eventos está elegido.
      - **Al borrar un grupo**, sus eventos no se borran: los que se quedan sin grupo pasan a «Sin grupo».
      - **Las rutinas también se archivan y se reordenan** con una pulsación larga, como los grupos.
        En el calendario esa pulsación mueve, no selecciona (la selección es la redonda), así
        que no choca con la de las notas.
      - **El orden de la lista de grupos y de la de rutinas es de presentación**, no del core: una
        lista en `localStorage` (`elnotas:` y un nombre nuevo), como la de las ventanas, que se
        reconcilia al leerla (quita lo que ya no existe, añade al final lo nuevo) y entra en la
        copia de seguridad. **Si un día hay nube**, pasa a una entidad aparte que viaja; hoy, una
        sola función de lectura y otra de escritura, para que ese cambio sea en un solo sitio.
        **`archived` sí es del core**, como `hidden`: es una propiedad del grupo o la rutina.
      - **Menú ⋮ por elemento**, y la pulsación larga queda sólo para mover. Grupo: Renombrar,
        Archivar o Desarchivar, Borrar. Rutina: Renombrar, Cambiar meta, Archivar o Desarchivar,
        Borrar. Evento: Editar (abre la hoja de crear) y Borrar. **«Sin grupo» no lleva menú.**
        Borrar pide confirmar con hoja; la de una rutina avisa de que pierde todos sus días y
        ofrece archivar. **Los grupos de un evento se cambian al editarlo**, y Borrar lo elimina
        de todos los grupos.
      - **Un día con eventos:** al pulsarlo se abre la lista de ese día, con un «+» para añadir.
      - **Rutinas:** se marcan días pasados y el de hoy; los futuros, no. Con varias rutinas, una
        redonda elige cuáles pintan su progreso en el mes, como con los grupos.
      **El modelo** (propuesto el 2026-10-27; `Versioned` en las tres, un fichero por entidad, sin
      migrar porque lo ausente se lee como vacío):
      - `Day` = `"2026-07-02"` y `Time` = `"18:00"`, textos marcados, validados al leer.
      - `CalendarEvent { id, day, time?, title, done }`.
      - `EventGroup { id, name, events: EventId[], archived? }`: **la pertenencia va en el
        grupo**, como `Context.items`, y «Sin grupo» es una vista derivada (los eventos que no
        están en ningún grupo), no una entidad. Borrar un evento lo quita de sus grupos.
      - `Routine { id, name, days: Day[], weeklyGoal?, archived? }`: una semana (lunes a domingo)
        cumple si sus días llegan a la meta; es un cálculo, no un dato.
      - `AppState` gana `events`, `eventGroups` y `routines`. Los grupos elegidos con la redonda y
        el mes que se mira son estado de pantalla, no del core.
      - **Confirmado el 2026-10-27:** la pertenencia va en el grupo (borrar un grupo no toca los
        eventos; cambiar los grupos de un evento reescribe los de los grupos que cambian).
        **«Sin grupo» se mueve en la lista, pero no se archiva ni se borra:** entra en la lista de
        orden con un id reservado y no lleva menú ⋮.
      **Con propuesta, que vale salvo que el usuario diga otra cosa:** los eventos pasados,
      colapsados en las listas; los «hechos», tachados en la lista y con el día pintado igual;
      botón «hoy» y mes anterior y siguiente; las repeticiones y la duración, aparcadas
      (ya en *Ideas aparcadas*).
      Cada tarea de `src/` cierra con `check:roturas` de lo que añade, y las que tocan el dominio
      o un puerto paran antes y se lo cuentan al usuario.

**Primera tanda: el calendario y los eventos.**
- [x] **7a. Las fechas** *(pensar)*. `Day` y `Time` como textos marcados con su validación, y las
      funciones puras de calendario: día de la semana, semana de lunes a domingo, días de un mes
      y su rejilla, sumar días, comparar. **Se cierra cuando** tienen pruebas (febrero y años
      bisiestos, cambio de mes y de año, la semana que cruza meses), `check` pasa y `check:purity`
      no ve reloj ni zona.
      **Hecho** (2026-10-28; `src/core/domain/calendar.ts`, sin `Date` ni zona, rango del año 1 al
      9999 con `null` fuera de él; cinco roturas, todas cazadas). Aún no sale por `index.ts`: lo hará
      con 7b, cuando otro módulo lo use.
- [x] **7b. Eventos y grupos en el dominio** *(pensar)*. `CalendarEvent` y `EventGroup`, sus ids,
      acciones, reducer, casos de uso e hidratación. Crear un evento con su grupo, nuevo o
      existente, en una sola acción; `setMembership`, no un `toggle`; borrar un evento lo quita de
      sus grupos y borrar un grupo no toca los eventos; lo que no aplica es no-op, con la
      identidad preservada. **Cambia el dominio:** se para y se enseña antes de tocarlo.
      **Se cierra cuando** hay pruebas con `strictEqual` en los no-op y en la integridad, `check`
      pasa y sus roturas, en `tools/roturas.mjs`, caen todas.
      **Hecho** (2026-10-28; nueve acciones y sus casos de uso, `set-event-groups` con el conjunto
      entero, el motivo vacío permitido en el core y `create-event` con el grupo nuevo en la misma
      acción; `archived` sólo existe cuando vale `true`; ocho roturas, todas cazadas). Aún no
      salen por `index.ts` ni se guardan: lo primero, cuando los use la pantalla (7d); lo segundo
      es la 7c.
- [x] **7c. Guardar los eventos** *(mecánica)*. Ficheros por entidad, su forma en `schema.ts`
      (un día mal escrito es un fichero ilegible), la copia de seguridad, importar y «Borrar
      todo», y los contratos de `storage/`. **Se cierra cuando** `check` pasa, un fichero con un día
      inválido cae en `onCorrupt` y una copia con eventos se exporta y se importa igual.
      **Hecho** (2026-10-28; `events/` y `event-groups/`, dos repositorios más en `StorageAdapter`,
      el guardado diferido escribe los eventos antes que sus grupos, y un evento ilegible se salta
      conservando su sitio en el grupo; la copia, importar y «Borrar todo» ya iban por rutas, sin
      tocarlos; ocho roturas, todas cazadas). `ImportSummary` aún no cuenta eventos: es de la pantalla.
- [x] **7d. El calendario como vista y como ventana** *(pensar)*. El icono junto a ⚙, la ventana
      de calendario en la lista de ventanas y sus capas, lo que recuerda al recargar, y la lista de
      orden de los grupos en `localStorage` con su reconciliación y «Sin grupo» entrando con un id
      reservado. **Cambia dos decisiones cerradas**, las cuatro vistas y «ventana = referencia a
      un contexto»: se para y se le enseña al usuario. **Se cierra cuando** hay pruebas de lo puro
      (la reconciliación, `guardWindows` con la ventana nueva), la copia de seguridad la lleva y
      los pasos de su lista pasan en el panel.
      **Hecho** (2026-10-28; `{ kind: "calendar" }` en `WindowRef`, único en la lista; el icono ▦
      junto a ⚙ lo abre encima y no vuelve al recargar, como ⚙, pero la ficha de la lista sí;
      `calendarOrder.ts` con `reconcileOrder` y `@sin-grupo`, guardado en
      `elnotas:calendario-orden`, que la copia lleva sin subir `BACKUP_VERSION`; 10 roturas, todas
      cazadas). El marco enseña un texto: el mes es la 7e y los grupos la 7f. Cambia las decisiones
      cerradas de CLAUDE.md (cuatro vistas, ventana = referencia): se reescriben en la 8.
- [x] **7e. El mes y los eventos de un día** *(pensar)*. La rejilla del mes, los días marcados
      según los grupos elegidos, la lista de un día con su «+», la hoja de crear y editar (día,
      hora opcional, motivo, grupos, y Borrar con confirmación), mes anterior y siguiente y «hoy».
      **Se cierra cuando** los pasos de su lista pasan en el panel, a 375 y a escritorio, y lo
      puro tiene pruebas.
      **Hecho** (2026-10-28; `1c4e2d6`, `f0061ae`; `calendarMonth.ts`, `eventForm.ts` y `todayOf`, puros
      y con pruebas; `CalendarPanel.ts` lo comparten la vista y la ventana; los grupos elegidos
      aún son «todos» hasta la 7f, que los elige; 14 roturas, todas cazadas; sección B de
      `VERIFICACION-CALENDARIO.md`). Al mover un evento a otro día la hoja lo sigue: el día va en
      su contenido, no como título. El móvil, con la 7g.
- [x] **7f. Los grupos de eventos** *(pensar)*. La lista con redonda, «Sin grupo» fijo, el menú ⋮
      (Renombrar, Archivar o Desarchivar, Borrar), mover con la pulsación larga, la vista de
      archivados y los eventos de cada grupo por tiempo, los pasados colapsados. **Se cierra
      cuando** los pasos de su lista pasan en el panel y lo puro tiene pruebas.
      **Hecho** (2026-10-28; `47a96ee`; `groupList.ts` puro y con pruebas, `GroupsPanel.ts` bajo el
      mes; `dragReorder.ts` gana el eje vertical y se traga el clic al soltar; «+ Grupo» crea un
      grupo sin evento; lo elegido con las redondas y lo desplegado es de pantalla y no se
      recuerda; 11 roturas, todas cazadas; sección C de `VERIFICACION-CALENDARIO.md`). El móvil,
      con la 7g: sobre todo la pulsación larga con el dedo, que el panel no puede probar.
- [x] **7g. La lista de verificación de los eventos** *(mecánica)*. `test/ui/VERIFICACION-CALENDARIO.md`,
      con los pasos de 7d-7f y los de la copia de seguridad, y pasada en el panel; el móvil, lo
      pasa el usuario. **Se cierra cuando** está pasada y anotada en el panel, y `check` pasa.
      **Hecho** (2026-10-28; la lista ya llevaba A a C de las tareas anteriores; esta añade D, la
      copia con eventos, grupos y orden, y M, los cinco pasos del móvil que pasa el usuario).
      D1 a D3 pasadas en el panel; **M1 a M5, pendientes del usuario**, y con ellos C9 y B14 en
      el dedo. Una duda apuntada en *Sin decidir*.

**Segunda tanda: las rutinas.**
- [x] **7h. Rutinas en el dominio y en el guardado** *(pensar)*. `Routine`, sus acciones
      (`setDone(día, hecho)`, meta semanal, archivar, renombrar, borrar), el cálculo de la semana
      cumplida, y su fichero, su forma y la copia de seguridad. **Cambia el dominio:** se para y
      se enseña antes. **Se cierra cuando** hay pruebas (no se marca el futuro, una semana que
      cruza meses), roturas que caen, `check` pasa y una copia con rutinas se exporta e importa igual.
      **Hecho** (2026-10-28; diseño aprobado por el usuario antes de tocar el dominio). `Routine`
      (`days` ordenados y sin repetir; `weeklyGoal` de 1 a 7; `archived` sólo cuando vale `true`),
      seis acciones y sus casos de uso, `weekProgress` (semana de lunes a domingo, también cuando cruza
      de mes; sin meta ninguna semana cumple), `routines/` en el guardado, su forma en `schema.ts` y
      `routines` en `AppState`, `diffState`, `hydrate`, `boot` y el guardado diferido. El futuro no se
      marca: `set-routine-day` lleva `today`, que pasa quien llama, y el core sigue sin leer el reloj.
      Cambiar la meta recalcula también las semanas pasadas; marcar hacia atrás no tiene límite.
      Una copia con rutinas se exporta, se ensaya y recarga igual. 26 roturas, todas cazadas.
- [x] **7i. Las rutinas en pantalla** *(pensar)*. La pestaña, las cadenas de la semana con las
      anteriores, marcar días, el progreso en el mes de las elegidas con la redonda, el menú ⋮
      (Renombrar, Cambiar meta, Archivar, Borrar con su aviso), mover y archivar. **Se cierra
      cuando** los pasos de su lista pasan en el panel, a 375 y a escritorio.
      **Hecho** (2026-10-28). Pestañas «Eventos | Rutinas» bajo el mes; `RoutinesPanel` (como la de
      grupos: redonda, nombre · n/meta, ⋮ con Renombrar, Cambiar meta, Archivar y Borrar —que dice
      cuántos días se pierden y ofrece archivar—, archivadas aparte, mover con pulsación larga) y la
      lógica pura en `routineList`. Una rutina abierta enseña cuatro semanas, la de hoy primero, y
      «Ver más»; el futuro sale apagado. Al empezar **ninguna rutina pinta el mes**: la redonda la
      enciende y cada día lleva una barra tan llena como la parte de las elegidas que lo tienen
      marcado (`routinesDone` / `routinesTotal` en `DayCell`). Los pasos, en la sección E de
      `VERIFICACION-CALENDARIO.md` (7j los repasa y anota el móvil). 8 roturas, todas cazadas.
- [x] **7j. La lista de verificación de las rutinas** *(mecánica)*. Los pasos en
      `VERIFICACION-CALENDARIO.md`, pasados en el panel, y el móvil, el usuario. **Se cierra
      cuando** está pasada y anotada, y `check` pasa.
      **Hecho** (2026-10-28). La sección E (las rutinas) se pasó con la 7i; se añadió **D4**, que la
      copia con rutinas, archivadas y su orden se exporta e importa igual (simulados el «Guardar
      como» y el selector), y la cabecera y los «cuándo volver a pasarla» recogen `RoutinesPanel` y
      `calendarMonth`. Queda **M6** para el usuario, en el móvil, junto a M1 a M5.

- [x] **7k. El mes a media pantalla** *(mecánica)*. El mes del calendario ocupa como mucho la
      mitad de la altura, y la lista de debajo (eventos o rutinas) el resto, con su propio
      desplazamiento. **Se cierra cuando** se ve así a 375 y a escritorio y la lista se desplaza
      sin mover el mes.
      **Hecho** (2026-10-29). Cada casilla mide `(50vh - 6.5rem) / 6`: con barra y cabecera, el mes
      no pasa de la mitad de la pantalla y la lista de debajo se desplaza con la vista.
- [x] **7l. Las rutinas, sólo la semana de hoy; las marcas, en el mes** *(pensar)*. Cada rutina
      enseña **sólo** los siete días de la semana actual (se quitan las semanas anteriores y «Ver
      más»). El mes pinta una **✗** en los días marcados de las rutinas elegidas **sólo en la
      pestaña Rutinas**, y una **🔔** en los días con eventos **sólo en la pestaña Eventos**; se
      va la barra de progreso. **Se cierra cuando** los pasos de la sección E lo reflejan, pasados
      en el panel a 375 y a escritorio.
      **Hecho** (2026-10-29). `currentWeek` sustituye a `weekRows`; la casilla del mes lleva
      `🔔` o `✗` según la pestaña (`dia-marca`), y `DayCell` sigue llevando las dos cuentas. Ya no se
      pueden marcar semanas pasadas (apuntado en *Sin decidir*).
- [x] **7m. Fuera los grupos de eventos** *(pensar)*. Decidido por el usuario el 2026-10-29: no
      los usará. Se quitan `EventGroup`, sus acciones y casos de uso, `event-groups/` en el
      guardado, el orden de grupos de la copia, «Sin grupo», archivados y la hoja de grupos; los
      eventos quedan en una lista por fecha, con los pasados plegados. Una copia que aún traiga
      `event-groups/` se importa sin quejarse. **Cambia el dominio y una decisión cerrada.**
      **Se cierra cuando** no queda rastro en `src/`, las pruebas y las roturas se ponen al día,
      `check` y `check:roturas` pasan y la lista del calendario recoge el cambio.
      **Hecho** (2026-10-29). Fuera `EventGroup`, sus cinco acciones y casos de uso (44 acciones,
      46 casos de uso), `event-groups/` y `pathOfEvent`; `create-event` ya no lleva grupos. La
      lista de eventos es `eventList` + `EventsPanel` (todos por tiempo, pasados plegados, «+ Evento»);
      `calendarOrder` sólo guarda `routines` y ignora un `groups` de una copia vieja; `event-groups/`
      en una copia vieja ni se lee ni estorba (prueba en `rehearseImport`). Roturas puestas al día;
      las del calendario, pasadas con filtro. Falta la pasada entera al cerrar la tanda.
- [x] **7n. Las rutinas como una tabla** *(pensar)*. Pedido por el usuario el 2026-10-29, con
      una captura de un rastreador de hábitos como modelo. Cada rutina es **una fila** de una
      tabla: el nombre a la izquierda, los siete días de esta semana como columnas (inicial y
      número, hoy resaltado), una marca por celda que se toca para marcar el día, y la cuenta
      «3/4 ✓» a la derecha. Fuera las redondas, el ⋮ de cada fila y los desplegables.
      **Tocar** una rutina es tocar **cualquier parte de su fila** (marcar un día incluido): queda
      «tocada», resaltada, y **sólo ella** pinta su ✗ en el mes de la pestaña Rutinas, sin
      círculos ni barra. Pulsar **el nombre** abre la hoja con renombrar, meta, archivar y borrar;
      mantener pulsada la fila la mueve. Arriba, sólo «+ Rutina» y «Archivadas (n)».  Confirmado
      por el usuario: el nombre abre la hoja y no toca la fila.
      **Cambia la 7l** (ya no se «eligen» varias). **Se cierra cuando** se ve así a 375 y a
      escritorio, el mes sigue a la fila tocada, la lista del calendario recoge el cambio y
      `check` y las roturas de las rutinas pasan.
      **Hecho** (2026-10-29). `RoutinesPanel` es la tabla; `routineList` trae `touchedRoutineIds` y
      `weekHeadings` (fuera `chosenRoutineIds` y `toggleId`). Tocar la fila fuera de un botón la toca
      o la suelta; marcar un día también la toca. Lista del calendario pasada en el panel (E1 a E10,
      menos M1 y M6, del usuario). Falta la pasada entera de roturas al cerrar la tanda.

- [ ] **8. Documentación, en un solo pase al cerrar.** En `CLAUDE.md`: el texto como Markdown,
      las capas en cadena, los ocultos (`hidden` ⊆ `items`), reordenar con el `⠿`, sólo es editable la línea activa, y el calendario (el día y la hora como texto, sin grupos de eventos tras la 7m, el orden de las listas como presentación, las cinco vistas y la ventana de calendario). Y la excepción a la integridad referencial, en `CLAUDE.md`
      y en `ARCHITECTURE.md`: **los enlaces dentro del texto no entran; uno roto se ve roto**. Y la auditoría
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

### Fase 10.2 — Formato y enlaces en los pósits del lienzo — PLANIFICADA, empieza al cerrar la 10.1

**Decidida con el usuario el 2026-10-25**, con el calendario, que el 2026-10-27 volvió a la
Fase 10 (tarea 7). **Sin plantear**: se plantea con el usuario antes de construir nada.

- [ ] **1. Formato y enlaces en los pósits de texto del lienzo** *(a plantear)*. Salió de
      *Ideas aparcadas*, donde decía: Aparcado por el usuario el 2026-10-24: le gusta, pero no hace falta ahora. Al core no le pediría nada (los enlaces del texto no entran en la integridad); lo difícil son los gestos, porque un toque en el lienzo ya mueve, marca o abre el menú. **Y podría jubilar el nodo-nota**: un pósit con un enlace a la nota haría lo mismo. **Qué lo desbloquea:** Usar los enlaces de las notas (tarea 6) y echarlos en falta en el lienzo. Ese día se decide cómo se abre un enlace desde un pósit y si el nodo-nota sigue.
      **Se cierra cuando** está planteado con el usuario —cómo se abre un enlace desde un pósit y
      si el nodo-nota sigue— y esta entrada se sustituye por sus tareas, cada una con su etiqueta
      y su cierre.

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

- [ ] **Añadir un formateador** *(pensar)*. *Pedido por el usuario el 2026-10-29*, tras la revisión
      de estilo de la 7n: hoy nada fija el ancho de línea ni la forma del código, y hay unas 15
      líneas de más de 120 caracteres en `src/ui`. **Toca una dependencia** (una de desarrollo, que
      no entra en el bundle): la regla de «dependencias sólo cuando se usan» pide mirar antes si
      Node o TypeScript ya lo hacen, y la decisión cerrada de no usar herramientas para analizar el
      código (ni ESLint ni Biome) dejó fuera los analizadores, no los formateadores, pero hay que
      confirmarlo con el usuario. Por decidir: cuál (Prettier, `dprint`, el de Biome sólo para
      formatear), el ancho de línea, si `check` lo comprueba o sólo se lanza a mano, y si el primer
      pase reformatea todo el repo en un commit aparte. **Se cierra cuando** el usuario elige y,
      con él ya instalado, `npm run check` falla ante código sin formatear, el repo pasa entero y
      `CLAUDE.md` recoge el comando.
- [ ] **Exportar a Markdown**, legible y **sólo hacia fuera**. Desde el 2026-10-12, con «manda el
      modelo» (ver *La nube*): así no hacen falta ni los ids de línea, ni escapar lo que parece
      Markdown, ni decidir qué pasa con lo editado fuera. Importar `.md`, si llega, crearía notas
      nuevas, sin ida y vuelta. Es otra cosa que la copia: el JSON es para restaurar, el Markdown
      para leer, y los diagramas no caben en él.
      **Se cierra cuando** la conversión de una nota a Markdown tiene sus pruebas, el botón de ⚙
      descarga el fichero y la lista manual tiene su paso.
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

- [ ] **La pregunta de importar no cuenta los eventos** *(salió en la 7g, 2026-10-28)*. «La copia
      trae 8 notas, 2 diagramas y 2 contextos» no dice cuántos eventos ni grupos de eventos trae,
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
| **Archivar grupos de eventos y rutinas desde una lista de presentación, no desde el core** (`archived` en `localStorage`, junto al orden, en vez de un campo de la entidad) | Propuesto por el usuario el 2026-10-28 al diseñar 7b y, tras valorarlo, se mantiene `archived` en el core, como `hidden` (decidido el 2026-10-27). A favor del cambio: un solo sitio para orden y archivados con una sola reconciliación; el core pierde un campo y la acción `set-event-group-archived`; el mismo camino a la nube (la lista pasa a entidad que viaja). En contra: lo archivado sería por dispositivo. | Que archivar por dispositivo no moleste y se quiera simplificar el core, o que llegue la nube y haya que decidir dónde vive el orden. Es un refactor acotado: quitar el campo y la acción, y mover el estado a la lista. |
| **Automatizar y acelerar `check:roturas`** (generar mutaciones solas, o lanzar sólo la prueba de cada rotura y varias a la vez) | Planteado por el usuario el 2026-10-28 tras la pasada entera de la tanda 7e–7g (126 roturas, unos 10 minutos). Es un test que sólo se pasa al cerrar tanda y fase, así que el tiempo molesta poco. Generarlas solas (Stryker o un script casero con `===`→`!==`, `<`→`<=`, quitar un `return`, sólo en el core) da mucho ruido de mutaciones equivalentes que revisar, y Stryker es una dependencia grande, descartada. La lista a mano, con la prueba exacta que debe caer, es lo que da la garantía. | Que la pasada entera pase de molestar a estorbar al cerrar. Entonces, sin tocar la lista: correr sólo la prueba nombrada en `prueba` en vez de la suite, y varias roturas en paralelo, cada una en su copia de `tmp-test/`. |
| **Repeticiones y duración de los eventos del calendario** (un evento cada semana, uno que dura varios días o de una hora a otra) | Planteado el 2026-10-27 al diseñar el calendario (Fase 10, tarea 7): los esbozos del usuario sólo tienen un día y una hora opcional, y repetir o durar pide un modelo más grande (reglas de repetición, excepciones, qué se pinta en el mes). | Echar en falta crear a mano el mismo evento cada semana, o uno de varios días. Es añadido: un campo opcional en el evento, sin migrar lo guardado. |
| **Subcontextos, o un contexto como elemento de otro** | Planteado por el usuario el 2026-10-18 y aparcado por él: interesa, pero no hace falta. De los dos, prefiere **la referencia a la contención**: un contexto enlazado desde varios (n a n, como una clave ajena), sin árbol y sin recorrerlo recursivamente. Un árbol abriría ciclos, qué pasa al borrar un padre, cómo se abre y qué enseña el General. Desde la Fase 10 una nota puede enlazar notas y diagramas con `[texto](#id)`; los contextos, no, por ahora (2026-10-25). | Echar en falta ver un contexto **dentro de la lista** de otro, no sólo enlazado desde una nota. Ese día, un tercer tipo de `ItemRef` (`kind: "context"`), con la limpieza al borrar como la de las notas. |
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
