# Verificación manual del aspecto de terminal (Fase 8)

**Esto no es documentación de diseño: es un procedimiento**, como sus vecinas
`VERIFICACION-MANUAL.md` y `VERIFICACION-MANUAL-LIENZO.md`. Pasarla en escritorio **y** en el
móvil es el criterio de cierre de la Fase 8 (`TAREAS.md`).

## Por qué existe

La Fase 8 sólo cambia CSS y el `background_color` del manifiesto: ninguna prueba de Node lo ve.
Lo que puede romperse es **lo que se ve y lo que se toca**: un texto que no se lee, un botón que
no se distingue de otro, la capa de las líneas de barrido comiéndose un toque, o el brillo de
las letras frenando el lienzo.

## Cuándo hay que volver a pasarla

- antes de cerrar la Fase 8;
- al tocar `src/ui/styles/base.css` (la paleta, el brillo o las líneas de barrido);
- al probar un navegador o un móvil nuevos.

**Cada pasada se anota abajo, debajo de la anterior.**

## Reglas al ejecutarla

> **Se pasa sobre un commit con el árbol limpio**, y se anota el commit.

> **Si algo no se puede provocar en ese navegador, se anota eso mismo.**

---

## Preparación

La misma que `VERIFICACION-MANUAL.md`: `npm run build:web`, servir, y abrir por `localhost` o,
en el móvil, por la IP del ordenador. Hace falta **un contexto con alguna nota con casillas** y
**un diagrama con nodos y relaciones**. Para T7, la copia publicada.

---

## T. El aspecto

- **T1.** Todo es **ámbar sobre negro**, con letra **monoespaciada**, **sin esquinas
  redondeadas ni sombras**. Con el sistema en **modo claro**, igual: no hay versión clara.
- **T2.** Se ven **líneas horizontales finas** encima de todo (las de barrido), también sobre
  las hojas, y **nada se mueve ni parpadea**.
- **T3.** Lo que crea o confirma va en **vídeo inverso** (fondo ámbar, letra negra): el «+»
  grande, el «+» de la última ventana, el de ⚙, «+ Contexto nuevo», «+ Nota nueva», «+ Diagrama
  nuevo» y las barras de abajo. El «+» de diagrama nuevo va **en hueco** (borde ámbar, fondo
  negro), para no confundirse con el de nota.
- **T4.** **Sólo lo de borrar y los errores son rojos**: «Borrar» en ⚙, «Borrar todo», el botón de
  la pregunta antes de borrar y el borde del aviso de guardado detenido.
- **T5.** Las fichas de ⚙ enseñan **palabras de ocho letras enteras** («contexto», «diagrama»),
  sin partirlas.
- **T6.** El **foco del teclado** (tabulador) es un recuadro ámbar recto, no el anillo blanco y
  redondo del navegador.
- **T8.** En ⚙, la sección **Pantalla** tiene **Ámbar** y **Verde**, el elegido en vídeo inverso.
  Pulsar **Verde** lo cambia **todo al instante**: la tinta, el brillo, las líneas, los pósits y
  la rejilla. El rojo de borrar sigue rojo. **Recargar**: sigue en verde. Volver a **Ámbar**.
- **T9.** Con el verde elegido, **«Borrar todo»**: tras recargar, vuelve el **ámbar**.

## G. Que los toques sigan llegando

- **G1.** ⚠️ Con las líneas de barrido encima, **todo responde al primer toque**: ◀ ▶ ⚙, abrir
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

*(Ninguna todavía.)*
