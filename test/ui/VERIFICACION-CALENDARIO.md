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
- **A5.** Con la ficha puesta, **«Calendario» ya no se ofrece** al añadir otra ventana: sólo hay uno.
- **A6.** Pasar con ◀ ▶ hasta la ventana del calendario: se ve su contenido, con la cabecera de
  las ventanas (sin ✕), y el título «Calendario» **no se renombra**.
- **A7.** Con la ventana del calendario activa, **recargar**: se vuelve **a esa ventana**.
- **A8.** Con la ventana del calendario, pulsar **▦**: se abre el calendario encima, y ✕ vuelve a la ventana.
- **A9.** Quitar la ficha del calendario en ⚙ (⋮ → Quitar): desaparece de la lista, y **▦** sigue abriéndolo.

---

## Pasadas

(Sin pasar.)
