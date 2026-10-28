# Verificación manual del calendario

**Esto no es documentación de diseño: es un procedimiento**, como sus vecinas. Se pasa como dice
`test/PASAR-LAS-LISTAS.md`. Crece con las tareas del calendario: lleva el marco (el
icono, la vista y la ventana) el mes con los eventos de un día y los grupos de eventos.

## Por qué existe

Las pruebas de Node ven la lista de ventanas, que el calendario sea único y que la copia lleve su
orden, pero no ven el icono, la vista encima, el atrás ni qué vuelve al recargar.

## Cuándo hay que volver a pasarla

- al tocar `src/ui/CalendarView.ts`, `src/ui/CalendarPanel.ts`, `src/ui/GroupsPanel.ts`, `src/ui/dragReorder.ts`, `src/ui/WindowsView.ts`, `src/ui/App.ts` o `src/ui/windows.ts`;
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
- **B4.** **+ Evento** abre el formulario con **Día** (el pulsado), **Hora** (vacía), **Motivo**,
  **Grupo nuevo** y **Guardar**. Guardar con el motivo vacío crea un evento «Evento».
- **B5.** Tras guardar, la hoja vuelve a la lista del día con el evento; en la rejilla el día lleva un
  **punto** debajo del número.
- **B6.** Un evento **con hora** sale como «18:00 Cena»; los de **todo el día** primero y luego por
  hora.
- **B7.** Un **día** o una **hora** mal escritos no guardan: sale en rojo «Pon un día válido.» o «Pon
  una hora válida, como 18:00.» y la hoja sigue abierta.
- **B8.** **☐** de un evento lo marca hecho (☑, tachado); si **todos** los del día están hechos, el
  punto de la rejilla queda **vacío**.
- **B9.** Pulsar el texto de un evento lo abre para **editar**; cambiar el **Día** lo mueve (la
  hoja pasa a ese día y el punto cambia de casilla).
- **B10.** **Borrar** pide confirmar («¿Borrar este evento? No se puede deshacer.»); **Cancelar** lo
  deja; **Borrar** lo quita y el punto de la rejilla desaparece.
- **B11.** En el formulario, **Grupo nuevo** con un nombre crea el grupo y mete el evento en él;
  al reabrirlo, el grupo sale marcado entre los **Grupos**. Quitar la marca y guardar lo saca.
- **B12.** El **atrás del navegador** cierra la hoja (y el formulario con ella).
- **B13.** Con eventos creados, **recargar**: siguen ahí y marcados.
- **B14.** A **375 px** y en escritorio, la rejilla cabe entera, sin barra horizontal, y la hoja se
  puede usar con el teclado en pantalla sin tapar **Guardar**.

## C. Los grupos de eventos

Bajo el mes, la lista de grupos. Hacen falta eventos en un grupo y otros sin grupo, unos pasados (antes de hoy) y otros no.

- **C1.** Bajo la rejilla hay una fila por grupo —**●** redonda, «nombre · n» y **⋮**— y siempre una
  **«Sin grupo»** (sin ⋮) con los eventos que no están en ningún grupo. Debajo, **+ Grupo**.
- **C2.** **+ Grupo** pide un nombre y **Crear** lo añade a la lista; con el nombre vacío no hace nada.
- **C3.** La **redonda** (● / ○) apaga y enciende un grupo: sólo los días con eventos de los grupos
  encendidos llevan punto. Un evento en varios grupos marca el día si **cualquiera** está encendido.
- **C4.** Pulsar el **nombre** despliega los eventos del grupo **por día y hora**; los **pasados**
  quedan plegados en «▸ Pasados (n)», que los abre y los cierra.
- **C5.** Pulsar un evento de la lista lo abre en la hoja para **editarlo**.
- **C6.** **⋮** ofrece **Renombrar**, **Archivar** y **Borrar**. Renombrar cambia el nombre en la
  lista. **Archivar** lo quita de la lista y de las marcas del mes y aparece **«▸ Archivados (n)»**.
- **C7.** **Archivados** muestra los archivados, sin redonda, con ⋮ → **Renombrar**, **Desarchivar**
  y **Borrar**. Desarchivar lo devuelve a la lista.
- **C8.** **Borrar** pide confirmar («¿Borrar el grupo «X»? Sus eventos no se borran.»); al aceptar,
  el grupo desaparece y sus eventos pasan a **«Sin grupo»** (su cuenta sube).
- **C9.** **Mantener pulsada** una fila (medio segundo) la levanta y se arrastra arriba o abajo;
  al soltar queda en su sitio y **no** se despliega ni se abre nada. «Sin grupo» también se mueve.
- **C10.** Tras **recargar**, las filas conservan el orden. Lo elegido con las redondas y lo
  desplegado **no** se recuerda: vuelve todo encendido y plegado.

---

## Pasadas

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
