# Verificación manual del calendario

**Esto no es documentación de diseño: es un procedimiento**, como sus vecinas. Se pasa como dice
`test/PASAR-LAS-LISTAS.md`. Crece con las tareas del calendario: ahora lleva sólo el marco (el
icono, la vista y la ventana); el mes, los eventos y los grupos se añaden con su tarea.

## Por qué existe

Las pruebas de Node ven la lista de ventanas, que el calendario sea único y que la copia lleve su
orden, pero no ven el icono, la vista encima, el atrás ni qué vuelve al recargar.

## Cuándo hay que volver a pasarla

- al tocar `src/ui/CalendarView.ts`, `src/ui/WindowsView.ts`, `src/ui/App.ts` o `src/ui/windows.ts`;
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

## Pasadas

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
