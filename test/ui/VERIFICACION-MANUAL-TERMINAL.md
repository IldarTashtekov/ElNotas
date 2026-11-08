# Verificación manual del aspecto de terminal (Fase 8)

**Esto no es documentación de diseño: es un procedimiento**, como sus vecinas
`VERIFICACION-MANUAL.md` y `VERIFICACION-MANUAL-LIENZO.md`. Pasarla en escritorio **y** en el
móvil es el criterio de cierre de la Fase 8 (`TERMINADAS.md`).

## Por qué existe

La Fase 8 sólo cambia CSS y el `background_color` del manifiesto: ninguna prueba de Node lo ve.
Lo que puede romperse es **lo que se ve y lo que se toca**: un texto que no se lee, un botón que
no se distingue de otro, la capa de las líneas de barrido comiéndose un toque, o el brillo de
las letras frenando el lienzo.

## Cuándo hay que volver a pasarla

- antes de cerrar la Fase 8;
- al tocar `src/ui/styles/base.css` (la paleta, el brillo o las líneas de barrido);
- T10, al tocar el idioma (`src/ui/language.ts`, `src/ui/dateNames.ts` o los textos);
- al probar un navegador o un móvil nuevos.

**Cada pasada se anota abajo, debajo de la anterior.**

## Reglas al ejecutarla

> **Se anota el commit, y qué ficheros llevaba sin comitear**, como dice `test/PASAR-LAS-LISTAS.md`.

> **Si algo no se puede provocar en ese navegador, se anota eso mismo.**

---

## Preparación

La misma que `VERIFICACION-MANUAL.md`: `npm run build:web`, servir, y abrir por `localhost` o,
en el móvil, por la IP del ordenador. Hace falta **un contexto con alguna nota con casillas** y
**un diagrama con nodos y relaciones**. Para T7, la copia publicada.

---

## T. El aspecto

- **T1.** Todo es **verde sobre negro** (el fósforo por defecto), con letra **monoespaciada**, **sin esquinas
  redondeadas ni sombras**. Con el sistema en **modo claro**, igual: no hay versión clara.
- **T2.** Se ven **líneas horizontales finas** encima de todo (las de barrido), también sobre
  las hojas, y **nada se mueve ni parpadea**.
- **T3.** Lo que crea o confirma va en **vídeo inverso** (fondo del color del fósforo, letra negra): el «+»
  grande, el «+» de la última ventana, el de ⚙, «+ Contexto nuevo», «+ Nota nueva», «+ Diagrama
  nuevo» y las barras de abajo. El «+» de diagrama nuevo va **en hueco** (borde del fósforo, fondo
  negro), para no confundirse con el de nota.
- **T4.** **Sólo lo de borrar y los errores son rojos**: «Borrar» en ⚙, «Borrar todo», el botón de
  la pregunta antes de borrar y el borde del aviso de guardado detenido.
- **T5.** Las pestañas con un nombre largo lo **cortan con «…»**, sin partirlo ni desbordar.
  Una palabra de ocho letras («contexto») sale cortada por poco, más en la activa por su ✕: se
  acepta así.
- **T6.** El **foco del teclado** (tabulador) es un recuadro del color del fósforo, recto, no el anillo blanco y
  redondo del navegador.
- **T8.** En ⚙, la sección **Pantalla** tiene **Verde**, **Ámbar** y **Magenta**, el elegido en vídeo
  inverso. Pulsar **Ámbar** o **Magenta** lo cambia **todo al instante**: la tinta, el brillo, las
  líneas, los pósits y la rejilla. El rojo de borrar sigue rojo. **Recargar**: sigue igual. Volver a **Verde**.
- **T9.** Con el ámbar elegido, **«Borrar todo»**: tras recargar, vuelve el **verde**.
- **T10.** En ⚙, debajo de los colores, **Español** y **English**, con el del navegador en vídeo
  inverso. Pulsar **English**: la app **recarga** y sale **toda en inglés**, ⚙ incluida, con
  **English** marcado. En el calendario, el mes es **«November 2026»**, la semana **M T W T F S S**
  y lo que se lee de un día, **«November 8, 2026»**; en la gráfica de una rutina, el lunes de cada
  semana va **mes/día** («11/2»); en la lista de eventos, en la hoja de enlazar un evento y en lo que
  se lee de la casilla de un día de una rutina, el día va como **«November 8, 2026»**, no
  «2026-11-08». Recargar: **sigue en inglés**. Volver a **Español**: recarga,
  **«noviembre de 2026»**, **L M X J V S D** y la gráfica en **día/mes** («2/11»). Pulsar el ya
  elegido **no recarga**.

## G. Que los toques sigan llegando

- **G1.** ⚠️ Con las líneas de barrido encima, **todo responde al primer toque**: las pestañas, ▦, ⚙, abrir
  una nota, las casillas, los botones de las barras, las hojas. *(En el navegador del panel, los
  clics simulados de ⚙ fallaron a ratos y por código funcionaba: aquí se mira con el dedo y el
  ratón de verdad.)*
- **G2.** ⚠️ En el lienzo: **arrastrar el fondo, la rueda, el pellizco, la pulsación larga y
  arrastrar un pósit** funcionan como en `VERIFICACION-MANUAL-LIENZO.md` (B y D).
- **G3.** ⚠️ **Arrastrar un pósit con muchos nodos va fluido** en el móvil. Si va a tirones,
  probar con el brillo apagado (`--brillo: none` en `base.css`) y comparar. Si así va mejor, el
  brillo se quita del lienzo.

## P. La PWA

- **T7.** *(Móvil.)* **Publicar, desinstalar y reinstalar**: la **pantalla de carga es negra**, no
  azul. Las barras del sistema salen **oscuras**.

---

## Pasadas

```
Fecha:        2026-11-05
Navegador:    Chrome/152.0.7977.167 (el del panel)
Quién:        el verificador (subagente), en el panel
Commit:       7f4b67b más el arreglo del «+ Contexto» en ajustes.css, sin comitear
Origen:       localhost:8001, recargado sin caché

T3  ✅ — sólo este paso, tras el arreglo: el «+ Contexto» de ⚙ en inverso en verde, ámbar y
         magenta, también con el ratón encima
```

```
Fecha:        2026-11-05
Navegador:    Chrome/152.0.7977.167 (el del panel), viewport 1024x768
Quién:        el verificador (subagente), en el panel
Commit:       06202e1, árbol limpio salvo TAREAS.md, que esta lista no mira
Origen:       localhost:8001, recargado sin caché

T1  ✅
T2  ✅
T3  ❌ — el «+ Contexto» de ⚙: fondo transparente, sin borde, letra del fósforo; no va en inverso
T4  ✅ — el aviso de guardado detenido, con un `div.aviso.aviso-guardado` metido en la página
T5  ❌ — los largos se cortan con «…», pero «contexto» sale «contex…» (72 px frente a 70) y,
         en la activa, «cont…»
T6  ✅
T8  ✅
T9  ✅
G1  ⏭ no se puede aquí — dedo y ratón de verdad; lo pasa el usuario. Con los clics del panel
         respondió todo a la primera
G2  ⏭ no se puede aquí — pellizco, pulsación larga y arrastre con el dedo; lo pasa el usuario.
         Con el ratón del panel: fondo, rueda, mira y arrastrar un pósit, bien
G3  ⏭ no se puede aquí — la fluidez en el móvil; lo pasa el usuario
T7  ⏭ no se puede aquí — la PWA publicada; lo pasa el usuario en el móvil

Notas: consola sin errores. Los dos ❌ abren tarea en TAREAS.md → Sin fase asignada. En T8,
«las líneas» que cambian de color son los bordes y las del lienzo: las de barrido son negras.
```
