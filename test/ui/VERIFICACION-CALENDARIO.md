# Verificación manual del calendario

**Esto no es documentación de diseño: es un procedimiento**, como sus vecinas. Se pasa como dice
`test/PASAR-LAS-LISTAS.md`. Crece con las tareas del calendario: lleva el marco (el
icono, la vista y la ventana) el mes con los eventos de un día, la lista de eventos, las rutinas y la copia de seguridad.

## Por qué existe

Las pruebas de Node ven la lista de ventanas, que el calendario sea único y que la copia lleve su
orden, pero no ven el icono, la vista encima, el atrás ni qué vuelve al recargar.

## Cuándo hay que volver a pasarla

- al tocar `src/ui/CalendarView.ts`, `src/ui/CalendarPanel.ts`, `src/ui/EventsPanel.ts`, `src/ui/RoutinesPanel.ts`, `src/ui/calendarMonth.ts`, `src/ui/dragReorder.ts`, `src/ui/WindowsView.ts`, `src/ui/App.ts` o `src/ui/windows.ts`;
- al probar un navegador o un móvil nuevos.

## Preparación

La de `VERIFICACION-MANUAL.md`: `npm run build:web`, servir y abrir por `localhost`. Hace falta la
lista con **dos ventanas** como mínimo (el General y otra).

---

## A. El marco

- **A1.** En la cabecera de la vista ventanas hay un icono **▦** junto al ⚙. Al pulsarlo se abre
  **«Calendario»** encima, con su ✕.
- **A2.** **✕** cierra el calendario y vuelve a la ventana en la que se estaba. El **atrás del
  navegador** hace lo mismo.
- **A3.** Con el calendario abierto con el icono, **recargar**: se vuelve a la ventana, **no** al
  calendario (como con ⚙).
- **A4.** En ⚙, «Añadir ventana» (la ficha «+» o el ⋮ de una ficha) ofrece **«Calendario»**, justo
  detrás de «General». Al elegirlo aparece una ficha «Calendario» en la lista.
- **A5.** Con la ficha puesta, el «+» de la última ventana **ya no ofrece «Calendario»**; en ⚙ se
  sigue ofreciendo, pero elegirlo otra vez **no añade otra ficha**: sólo hay uno.
- **A6.** Pasar con ◀ ▶ hasta la ventana del calendario: se ve su contenido, con la cabecera de
  las ventanas (sin ✕), y el título «Calendario» **no se renombra**.
- **A7.** Con la ventana del calendario activa, **recargar**: se vuelve **a esa ventana**.
- **A8.** Con la ventana del calendario, pulsar **▦**: se abre el calendario encima, y ✕ vuelve a la ventana.
- **A9.** Quitar la ficha del calendario en ⚙ (⋮ → Quitar): desaparece de la lista, y **▦** sigue abriéndolo.

---

## B. El mes y los eventos de un día

Con la ventana o la vista del calendario abierta, en el mes de hoy.

- **B1.** Arriba, **‹ mes de año ›** y un botón **hoy**; debajo, las iniciales **L M X J V S D** y la
  rejilla de lunes a domingo. **Hoy** sale en vídeo inverso. Los días de los meses vecinos que
  completan la primera y la última fila salen **apagados**.
- **B2.** **›** y **‹** cambian de mes (también a través del fin de año). **hoy** vuelve al mes de
  hoy y, estando ya en él, **no hace nada** (sale apagado).
- **B3.** Pulsar un día abre una **hoja** con el día como título («2 de julio de 2026»). Sin eventos
  dice «Sin eventos este día.» y ofrece **+ Evento**.
- **B4.** **+ Evento** abre el formulario con **Día** (el pulsado), **Hora** (vacía), **Motivo**
  y **Guardar**. Guardar con el motivo vacío crea un evento «Evento».
- **B5.** Tras guardar, la hoja vuelve a la lista del día con el evento; en la rejilla el día lleva un
  **asterisco** (`*`) junto al número.
- **B6.** Un evento **con hora** sale como «18:00 Cena»; los de **todo el día** primero y luego por
  hora.
- **B7.** Un **día** o una **hora** mal escritos no guardan: sale en rojo «Pon un día válido.» o «Pon
  una hora válida, como 18:00.» y la hoja sigue abierta.
- **B8.** **☐** de un evento lo marca hecho (☑, tachado); si **todos** los del día están hechos, el
  asterisco de la rejilla queda **atenuado**.
- **B9.** Pulsar el texto de un evento lo abre para **editar**; cambiar el **Día** lo mueve (la
  hoja pasa a ese día y el asterisco cambia de casilla).
- **B10.** **Borrar** pide confirmar («¿Borrar este evento? No se puede deshacer.»); **Cancelar** lo
  deja; **Borrar** lo quita y el asterisco de la rejilla desaparece.
- **B11.** El **atrás del navegador** cierra la hoja (y el formulario con ella).
- **B12.** Con eventos creados, **recargar**: siguen ahí y marcados.
- **B13.** A **375 px** y en escritorio, la rejilla cabe entera, sin barra horizontal, y la hoja se
  puede usar con el teclado en pantalla sin tapar **Guardar**.

## C. La lista de eventos

Bajo el mes, en la pestaña **Eventos**. Hacen falta eventos pasados (antes de hoy) y otros no.

- **C1.** Bajo la rejilla hay una lista con **todos** los eventos de hoy en adelante, «día hora
  motivo», **por día y hora**, y debajo **+ Evento**. Sin eventos dice «Sin eventos.»
- **C2.** Los **pasados** quedan plegados en «▸ Pasados (n)», que los abre y los cierra.
- **C3.** Pulsar un evento lo abre en la hoja para **editarlo**; al guardar o borrar, la lista se
  repinta. Un evento hecho lleva **☑** delante.
- **C4.** **+ Evento** abre la hoja con el formulario de un evento nuevo, con el día de hoy.
- **C5.** No hay grupos en ninguna parte: ni en el formulario, ni en la lista, ni redondas ni ⋮.

## D. La copia de seguridad lleva el calendario

Con eventos y rutinas, y el orden de las rutinas cambiado. Los pasos de la
exportación y la importación en sí son los de `VERIFICACION-MANUAL-COPIA.md`; aquí, que el
calendario entra y sale.

- **D1.** ⚙ → **Exportar copia**: el fichero lleva sus `events/…` en `files`, y `calendarOrder` con la
  lista de rutinas.
- **D2.** Cambiar cosas (un evento nuevo, otro orden) e **Importar copia → Sustituir todo**: tras
  recargar, el calendario es el de la copia: los eventos de entonces y los días marcados. Lo
  creado después ya no está.
- **D3.** Una copia hecha **antes del calendario** se importa sin quejarse: el calendario queda
  vacío.
- **D3b.** Una copia **antigua con `event-groups/…` y `groups` en `calendarOrder`** (de antes de
  quitar los grupos) también se importa sin quejarse: los eventos entran y lo de los grupos se
  ignora.
- **D4.** Con una rutina con días marcados, otra archivada y el orden de las rutinas cambiado:
  la copia lleva sus `routines/…` en `files` y `routines` en `calendarOrder`; al **Sustituir todo**
  y recargar, las rutinas vuelven con sus días, su meta, el archivado y el orden de entonces.

## E. Las rutinas

Bajo la rejilla, la pestaña **Rutinas** (la otra es **Eventos**). Hace falta alguna rutina con meta
y otra sin ella; hoy es miércoles 28 de octubre de 2026.

- **E1.** Bajo el mes hay dos pestañas, **Eventos** y **Rutinas**; sólo se ve la lista de la
  elegida. La de rutinas lleva **+ Rutina** y, con rutinas, una **tabla**: una cabecera con L M X J V
  S D y el número de cada día (hoy resaltado) y una fila por rutina con su nombre, siete casillas y
  «n/meta» (o «n» sin meta). Sin redondas, sin ⋮ y sin desplegables.
- **E2.** **+ Rutina** pide un nombre y una meta (**Sin meta** o de 1 a 7 días a la semana); con el
  nombre vacío no hace nada, y **Crear** la añade con la meta elegida.
- **E3.** La fila enseña **sólo** la semana de hoy; no hay semanas anteriores ni «Ver más».
- **E4.** Pulsar un día de esa semana lo **marca** (X) o lo **desmarca** (·); los días que aún no
  han llegado salen apagados y **no se pueden marcar**. Al llegar a la meta la cuenta lleva **✓**.
- **E5.** **Tocar** una fila (en cualquier parte que no sea un botón, o marcando un día) la resalta:
  en la pestaña **Rutinas** el mes enseña con el **borde brillante** los días marcados **sólo de la rutina
  tocada**; tocar otra cambia el mes; tocar la tocada, fuera de las casillas, la suelta. Al empezar
  no hay ninguna tocada y ningún día con borde. En la pestaña **Eventos** el mes pinta sólo los
  eventos, con un asterisco a un lado del número, y ningún borde brillante.
- **E6.** Pulsar el **nombre** abre una hoja con **Renombrar**, **Cambiar meta**, **Archivar** y
  **Borrar**. Cambiar la meta **recalcula** las semanas pasadas.
- **E7.** **Borrar** pide confirmar y dice cuántos días se pierden y que se puede **archivar**
  («¿Borrar la rutina «X»? Se pierden sus n días marcados…»); al aceptar, desaparece.
- **E8.** **Archivar** la quita de la tabla y del mes y aparece **«▸ Archivadas (n)»**, con sólo el
  nombre; pulsarlo ofrece **Renombrar**, **Cambiar meta**, **Desarchivar** y **Borrar**.
  Desarchivar la devuelve.
- **E9.** **Mantener pulsada** una fila la levanta y se arrastra; al soltar queda en su sitio y **no**
  abre la hoja. Tras **recargar** conserva el orden; la rutina tocada, no.
- **E10.** A **375 px** y a escritorio no hay barra horizontal y los siete días de la semana caben; el mes no pasa de la mitad de la pantalla.

## M. Sólo en el móvil

Los pasa el usuario, en la PWA instalada o en el navegador del móvil.

- **M1.** **Mantener pulsada** una fila de la lista de rutinas la levanta y se arrastra con el dedo;
  al soltar queda donde cae y no abre la hoja. Con el dedo parado, la página **no** se desliza.
- **M2.** Los campos **Día** y **Hora** del formulario abren los selectores nativos del móvil; lo
  elegido aparece en el campo y se guarda.
- **M3.** Con el **teclado en pantalla** abierto en «Motivo», **Guardar** se sigue
  alcanzando (la hoja se desplaza) y no queda tapado.
- **M4.** La rejilla del mes cabe en la pantalla, sin barra horizontal, en vertical y en horizontal.
- **M5.** **▦** abre el calendario; el atrás del móvil cierra primero la hoja y luego el calendario.
- **M6.** **Mantener pulsada** una fila de la lista de rutinas la levanta con el dedo, y los siete días
  de una semana se marcan con el dedo sin pulsar el vecino.

---

## Pasadas

```
Fecha:        2026-10-29
Navegador:    Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Claude/3.1623.0 Chrome/152.0.7977.167 Safari/537.36
Quién:        Claude, en el panel
Commit:       76513b1, árbol limpio
Origen:       localhost:8001

E1  ✅ — cabecera «L 26 M 27 X 28 J 29 V 30 S 31 D 1» con hoy resaltado; filas con nombre, siete
    casillas y «n/meta»; sin redondas, ⋮ ni desplegables
E3  ✅ — sólo la semana de hoy
E4  ✅ — marcar y desmarcar el jueves (1/3 y 0/3); V S D deshabilitados; «3/1 ✓» al pasar la meta
E5  ✅ — al empezar ninguna tocada ni ✗; tocar la cuenta de «Correr 5k» la resalta y el mes pinta
    sus ✗ (+2); tocarla otra vez la suelta; marcar un día de «Correr» la toca y suma su ✗; pestaña
    Eventos: 10 🔔 (las dos copias del calendario del DOM) y ninguna ✗
E6  ✅ — pulsar el nombre abre la hoja con Renombrar, Cambiar meta, Archivar y Borrar; Borrar pide
    confirmar (se cerró sin aceptar)
E9  🔁 simulado — la pulsación larga y el arrastre, con eventos de puntero escritos a mano (700 ms
    quieto, mover, soltar): «Leer» baja sobre «Correr 5k» y no abre la hoja
E10 ✅ — a 375 px y a escritorio, sin barra horizontal (scrollWidth 375 y 798)
E2, E7, E8, M1, M6  ⏭ — sin cambios en el código que tocan salvo el nombre; M1 y M6 los pasa el
    usuario en el móvil

Notas: tras un `navigate` el panel sirvió el JS antiguo (caché de módulos); se resolvió con
  `fetch(url, {cache: "reload"})` de cada módulo y recargar.
```

```
Fecha:        2026-10-29
Navegador:    Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Claude/3.1623.0 Chrome/152.0.7977.167 Safari/537.36
Quién:        Claude, en el panel
Commit:       e3429ff más los cambios de la 7m, sin comitear
Origen:       localhost:8001

C1  ✅ — la lista trae «2026-10-29 Hoy», «2026-10-31 18:00 Cena», «▸ Pasados (3)» y «+ Evento»
C2  ✅ — «▸ Pasados» pasa a «▾» y enseña los tres por día; otra pulsación los pliega
C3  ✅ — pulsar un evento abre «Editar evento» con Día, Hora y Motivo
C4  ✅ — «+ Evento» abre «Evento nuevo» con el día de hoy
C5  ✅ — sin grupos en el formulario ni en la lista
D3b 🔁 simulado — con una copia a la que se añadió `event-groups/salud.json`, el ensayo de la
    importación la acepta sin ilegibles (prueba de Node en `rehearseImport`); y un `groups` en
    `calendarOrder` se descarta al importar (prueba en `importStorage`)
E3  ✅ — «Esta semana» L M X J V S D; los días que no han llegado, apagados; sin semanas anteriores
E4  ✅ — marcar y desmarcar un día de esta semana; V S D no se pueden marcar
E5  ✅ — pestaña Rutinas: sin elegir, ninguna ✗; con la redonda de «Leer», ✗ en el 28; pestaña
    Eventos: 🔔 en los cinco días con eventos y ninguna ✗
E10 ✅ — a 375 px no hay barra horizontal (scrollWidth 375); el mes acaba en 395 px de 812 (menos de la mitad)
B4  ✅ — el formulario trae Día, Hora y Motivo, sin «Grupo nuevo»
M1  ⏭ no se puede aquí — el dedo; lo pasa el usuario en el móvil
M6  ⏭ no se puede aquí — el dedo; lo pasa el usuario en el móvil

Notas: el panel quedó a 375 px de ancho también en «escritorio» (el ancho del panel); el mes a media
pantalla se comprobó a 812 px de alto. En el panel hay dos paneles de calendario (la ventana y la
vista encima): las consultas se hicieron sobre el último.
```

```
Fecha:        2026-10-28
Navegador:    Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Claude/3.1623.0 Chrome/152.0.7977.167 Safari/537.36
Quién:        Claude, en el panel
Commit:       a1cb0a8 (sólo difiere en la lista, que ganó D4)
Origen:       localhost:8001

D4  🔁 simulado — el «Guardar como» y el selector de ficheros, dentro de la página. Con «Leer»
    (meta 1, hoy marcado), «Correr 5k» (meta 2), «Vieja» archivada y el orden Leer, Correr, Vieja:
    la copia lleva 3 `routines/…` y `routines` en `calendarOrder`. Con «Sobra» creada después,
    «Sustituir todo» y recargar: «Sobra» ya no está y vuelven Leer · 1/1 ✓ con el miércoles
    marcado, Correr 5k · 3/2 ✓ y «Vieja» en Archivadas, en ese orden
E1 a E10 ✅ — pasados en 6074009 (más abajo); en esta pasada se repitieron E2 (nombre vacío), E3
    («Ver más») y E7 (aceptar el borrado), que antes sólo estaban a medias

Notas: la pregunta de la importación sigue diciendo «8 notas, 2 diagramas y 2 contextos», sin
nombrar rutinas ni eventos (la duda de TAREAS.md → Sin decidir).
```

```
Fecha:        2026-10-28
Navegador:    Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Claude/3.1623.0 Chrome/152.0.7977.167 Safari/537.36
Quién:        Claude, en el panel
Commit:       6074009, árbol limpio
Origen:       localhost:8001

E1  ✅ — pestañas Eventos y Rutinas; la de rutinas con «○ Correr · 0/3 ⋮» y «+ Rutina»
E2  ✅ — con el nombre vacío la hoja sigue abierta y no crea nada; «Correr» con meta 3 y «Leer» sin meta
E3  ✅ — «Esta semana» y las anteriores por su lunes (19/10, 12/10, 5/10); «Ver más» pasa de 4 a 8
E4  ✅ — L M X marcados y J a D apagados, sin poder marcarse; «3/3 ✓»; una semana pasada se marca y se desmarca
E5  ✅ — sin elegir, ninguna barra; con la redonda, barra llena en los 5 días marcados (19, 21, 26, 27, 28)
E6  ✅ — Renombrar, Cambiar meta, Archivar, Borrar; con meta 2 la semana pasada pasa de 2/3 a 2/2 ✓
E7  ✅ — «¿Borrar la rutina «Correr 5k»? Se pierden sus 5 días marcados y no se puede deshacer. Para
    apartarla sin perderlos, archívala.»; cancelar no borra y aceptar sí
E8  ✅ — «▸ Archivadas (1)», sin redonda, ⋮ con Renombrar, Cambiar meta, Desarchivar y Borrar;
    archivada no pinta el mes; desarchivar la devuelve
E9  🔁 simulado — la pulsación larga y el arrastre, con eventos de puntero escritos a mano (650 ms
    quieto, mover, soltar): «Leer» sube sobre «Correr» y no se despliega; `routines` guardado en
    `elnotas:calendario-orden`; tras recargar conserva el orden y lo elegido y lo desplegado, no
E10 ✅ — a 375 px y a escritorio, sin barra horizontal (scrollWidth 375) y los siete días caben
M6  ⏭ no se puede aquí — el dedo; lo pasa el usuario en el móvil

Notas: tras un `navigate` el panel enseñó la página sin `calendario.css` (la caché); con recargar
se arregla. Las capturas se dieron a 375 px y a escritorio.
```

```
Fecha:        2026-10-28
Navegador:    Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Claude/3.1623.0 Chrome/152.0.7977.167 Safari/537.36
Quién:        Claude, en el panel
Commit:       6e9fa8e, árbol limpio
Origen:       localhost:8001

D1  🔁 simulado — el «Guardar como», por uno que guarda en memoria: 5 `events/…`, 2 `event-groups/…`
    y `calendarOrder` con `["c2ca…", "@sin-grupo"]`; «Copia guardada.»
D2  🔁 simulado (el selector de ficheros) — con «Sobra» creado y el orden cambiado, «Sustituir
    todo»: tras recargar, vuelven Trabajo, Sin grupo y Ocio con sus eventos, los cinco días
    marcados y el orden exportado; «Sobra» ya no está
D3  🔁 simulado (el selector) — una copia sin `calendarOrder` ni eventos entra sin queja: sólo
    «Sin grupo · 0», ningún día marcado y `elnotas:calendario-orden` sin escribir
M1  ⏭ no se puede aquí — el dedo; lo pasa el usuario en el móvil
M2  ⏭ no se puede aquí — los selectores nativos; lo pasa el usuario
M3  ⏭ no se puede aquí — el teclado en pantalla; lo pasa el usuario
M4  ⏭ no se puede aquí — vertical y horizontal en el móvil; lo pasa el usuario
M5  ⏭ no se puede aquí — el atrás del móvil; lo pasa el usuario

Notas: en D2 la pregunta decía «La copia trae 8 notas, 2 diagramas y 2 contextos»: no nombra los
eventos (duda en TAREAS.md → Sin decidir). Los pasos de la exportación y la importación en sí, en
`VERIFICACION-MANUAL-COPIA.md`.
```

```
Fecha:        2026-10-28
Navegador:    Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Claude/3.1623.0 Chrome/152.0.7977.167 Safari/537.36
Quién:        Claude, en el panel
Commit:       47a96ee, árbol limpio
Origen:       localhost:8001

C1  ✅ — «Sin grupo · n» sin ⋮, los grupos con ● y ⋮, y «+ Grupo» debajo
C2  ✅ — con el nombre vacío la hoja sigue abierta y no crea nada; «Ocio» entra en la lista
C3  ✅ — con la redonda apagada desaparecen sus puntos; un evento en Trabajo y Ocio marca el día
    con cualquiera de los dos encendido
C4  ✅ — despliega por día y hora; «▸ Pasados (2)» los abre y los cierra
C5  ✅ — pulsar un evento de la lista abre «Editar evento» con su motivo
C6  ✅ — ⋮: Renombrar, Archivar, Borrar; archivado, sale de la lista y de las marcas del mes
C7  ✅ — «▸ Archivados (1)»: sin redonda, ⋮ con Renombrar, Desarchivar, Borrar; desarchivar lo devuelve
C8  ✅ — «¿Borrar el grupo «Hogar»? Sus eventos no se borran.»; «Sin grupo» pasa de 2 a 3
C9  🔁 simulado — la pulsación larga y el arrastre, con eventos de puntero escritos a mano (500 ms
    quieto, mover, soltar); «Trabajo» sube sobre «Sin grupo» y no se despliega. El dedo, lo pasa
    el usuario (7g)
C10 ✅ — tras recargar, el orden se conserva (`elnotas:calendario-orden`) y todo vuelve encendido
    y plegado

Notas: C4 a C9 se pasaron sobre el mismo código antes de comitear; C2, C3 y C10 se repitieron sobre
`47a96ee`. 375 px y 1024 px sin barra horizontal; captura de la lista a 375 px.
```

```
Fecha:        2026-10-28
Navegador:    Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Claude/3.1623.0 Chrome/152.0.7977.167 Safari/537.36
Quién:        Claude, en el panel
Commit:       f0061ae, árbol limpio
Origen:       localhost:8001

B1  ✅ — a 375 px: «octubre de 2026», L M X J V S D, hoy en vídeo inverso, 8 días vecinos apagados
B2  ✅ — › y ‹ (también a enero de 2027); «hoy» vuelve y queda apagado en el mes de hoy
B3  ✅ — hoja «5 de octubre de 2026», «Sin eventos este día.» y «+ Evento»
B4  ✅ — Día 2026-10-05, Hora vacía; guardar sin motivo crea «Evento»
B5  ✅ — vuelve a la lista y el día lleva punto
B6  ✅ — «Evento», «09:30 Dentista», «18:00 Cena», en ese orden
B7  🔁 simulado — «Pon un día válido.» y «Pon una hora válida, como 18:00.»; la hora inválida se
    escribió convirtiendo el campo en texto, porque un campo de hora no admite «25:99»
B8  ✅ — ☑ tachado; con todo hecho el punto queda vacío y vuelve a lleno al desmarcar uno
B9  ✅ — Dentista al día 7: la hoja pasa a «7 de octubre» y el punto cambia de casilla (la primera
    pasada vio el título viejo; arreglado en `f0061ae` y repetido)
B10 ✅ — la confirmación sale; Cancelar lo deja; Borrar lo quita y el punto desaparece
B11 ✅ — «Grupo nuevo: Trabajo» lo crea y marca; al quitar la marca y guardar, sale sin marcar
B12 ✅ — el atrás del navegador cierra la hoja
B13 ✅ — tras recargar siguen los eventos y los días marcados
B14 ✅ — 375 px y 1024 px, sin barra horizontal (scrollWidth = ancho); Guardar visible con la hoja
    del formulario. El teclado en pantalla del móvil lo pasa el usuario (7g)

Notas: los clics se hicieron por JavaScript; hay capturas a 375 px de la rejilla y de la hoja del día
(el panel las entrega con un paso de retraso).
```

```
Fecha:        2026-10-28
Navegador:    Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Claude/3.1623.0 Chrome/152.0.7977.167 Safari/537.36
Quién:        Claude, en el panel
Commit:       9210b40, árbol limpio
Origen:       localhost:8001

A1  ✅
A2  ✅ — ✕ y el atrás del navegador (history.back) cierran el calendario
A3  ✅ — tras recargar, «General»; `elnotas:capas` queda en `[]`
A4  ✅ — «Calendario» sale detrás de «General» en el selector de ⚙
A5  ✅ — el «+» de la última ventana no lo ofrece; elegirlo otra vez en ⚙ deja una sola ficha
A6  ✅ — cabecera de las ventanas sin ✕; pulsar el título no abre el editor
A7  ✅ — tras recargar en la ventana del calendario, sigue en ella
A8  ✅ — ▦ abre el calendario encima y ✕ vuelve a la ventana
A9  ✅ — sin la ficha, `elnotas:windows` no lleva «calendar» y ▦ sigue abriéndolo

Notas: los clics se hicieron por JavaScript y el estado se leyó del DOM y de `localStorage`; hay
capturas del A1 y del A6 (el panel las entrega con un paso de retraso). Falta pasarla a 375 px y
en el móvil cuando haya contenido (7g).
```
