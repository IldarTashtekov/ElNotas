# Verificación manual del lienzo (Fase 5 · Lienzo)

**Esto no es documentación de diseño: es un procedimiento**, como sus vecinas
`VERIFICACION-MANUAL.md` y `VERIFICACION-MANUAL-EDITOR.md`. Pasarla en escritorio **y** en el
móvil es el criterio de cierre de Fase 5 · Lienzo (`ARCHITECTURE.md` §9.11).

## Por qué existe

Las cuentas del lienzo están probadas en Node: pasar de pantalla a corcho, acercar alrededor de
un punto, el pellizco, el doble toque, el orden de pintado (`test/ui/viewport.test.ts`,
`gestures.test.ts`, `paintOrder.test.ts`). Lo que no se puede probar ahí es **el dedo**: que
arrastrar mueva lo que tiene que mover, que el navegador no se quede los gestos, que el teclado
del móvil no tape lo que se escribe. Y el navegador del ordenador no simula dos dedos: **el
pellizco y la pulsación larga sólo se ven en un móvil de verdad.**

## Cuándo hay que volver a pasarla

- antes de cerrar Fase 5 · Lienzo;
- al tocar `src/ui/DiagramCanvas.ts`, que es donde viven los gestos;
- al probar un navegador o un móvil nuevos.

**Cada pasada se anota abajo, debajo de la anterior.**

## Reglas al ejecutarla

> **Si algo no se puede provocar en ese navegador, se anota eso mismo.**

> **Se pasa sobre un commit con el árbol limpio**, y se anota el commit.

> **Un comportamiento raro no es un fallo si está anotado abajo como conocido.** Se marca igual,
> pero con un «conocido»: lo que interesa es si se aguanta.

---

## Preparación

La misma que `VERIFICACION-MANUAL.md`: compilar con `npm run build:web`, servir, y abrir por
`localhost` o, en el móvil, por la IP del ordenador. Hace falta **un contexto con alguna nota**
y, para F2, **un segundo contexto**.

En escritorio, «doble toque» es doble clic y «mantener pulsado» no aplica: el ratón arrastra
directamente.

---

## A. Crear, listar y tirar un diagrama

- **A1.** En la ventana de un contexto, abajo a la derecha, **debajo y a la izquierda** del **+**
  grande, hay un **+ en hueco más pequeño**, por encima de la esquina del grande. Tocarlo crea «Nuevo
  diagrama» y **entra** en él con el **nombre seleccionado**, listo para escribir encima. Escribir
  un nombre e Intro lo guarda.
- **A2.** **✕ Salir** y el **atrás** vuelven a la ventana. El diagrama sale en la lista del
  contexto, **detrás** de las notas, con una **raya gruesa a la izquierda**. Tocarlo lo abre, ya
  sin el nombre en edición.
- **A3.** En el **General**, el diagrama sale **mezclado con las notas, por nombre**.
- **A4.** Seleccionarlo (pulsación larga, o clic derecho) en un contexto: la papelera dice
  **«Quitar»** y lo saca del contexto sin borrarlo; sigue en el General.
- **A5.** En el General, la papelera dice **«Borrar»**, pregunta «¿Borrar «…»? No se puede
  deshacer.» con la hoja, y lo borra.
- **A6.** **Mover a…** con un diagrama seleccionado lo lleva a otro contexto.

## B. El corcho

- **B1.** Al abrir un diagrama, el origen está **en el centro**: un pósit creado en el centro de
  la pantalla, al volver a abrir, sigue en el centro.
- **B2.** Arrastrar el fondo **mueve el corcho**, con los puntos de la rejilla.
- **B3.** *(Escritorio.)* La **rueda** acerca y aleja **alrededor del puntero**: lo que hay debajo
  no se mueve. El **pellizco del trackpad** hace lo mismo. **La página no se desplaza** ni se
  acerca entera.
- **B4.** *(Móvil.)* ⚠️ **Dos dedos acercan y alejan alrededor de su punto medio**, y moverlos
  juntos arrastra el corcho. **El navegador no hace zoom a la página.**
- **B5.** *(Móvil.)* Pellizcando, **levantar un dedo y seguir con el otro** sigue arrastrando, sin
  saltos.
- **B6.** No se acerca más de ×4 ni se aleja más de ×0,25.

## C. Los pósits y sus menús

- **C1.** **Doble toque en el fondo** abre una hoja «Añadir al diagrama»: *Texto*, *Nota
  existente* (sólo si hay notas) y *Nota nueva*. *(Escritorio: el **clic derecho** abre la
  misma.)*
- **C2.** **Texto** crea un pósit **donde se tocó**, vacío y con el cursor dentro.
- **C3.** Escribir; **Intro guarda**. **Mayúsculas+Intro** hace otra línea. **Escape** descarta
  lo escrito. Tocar fuera también guarda.
- **C4.** Un pósit vacío **se queda**, y enseña «Sin texto» en tenue.
- **C5.** **Doble toque en un pósit** abre su menú, con su texto de título: *Conectar · Editar ·
  Marcar hecho · Borrar*. *(Escritorio: también con clic derecho.)* *Conectar* se prueba en
  `VERIFICACION-MANUAL-RELACIONES.md`.
- **C6.** **Marcar hecho** lo atenúa y lo tacha; el menú dice entonces **Desmarcar hecho**.
- **C7.** **Borrar** lo quita **sin preguntar**, y con él sus líneas.
- **C8.** Un texto largo se parte en líneas y **el pósit crece hacia abajo**; el ancho no cambia.

## D. Mover un pósit

- **D1.** *(Escritorio.)* **Arrastrar un pósit lo mueve**; el corcho no se mueve.
- **D2.** *(Móvil.)* ⚠️ **Arrastrar un pósit sin esperar mueve el corcho**, no el pósit.
- **D3.** *(Móvil.)* ⚠️ **Mantenerlo pulsado medio segundo lo levanta** (se le ilumina el borde) y
  entonces el dedo lo arrastra. **Ni la página ni el corcho se mueven.** No sale el menú del
  sistema (copiar, seleccionar).
- **D4.** Al soltar se queda ahí; **recargar** y volver a abrir: sigue ahí.
- **D5.** Arrastrar uno encima de otro: **el que se movió queda encima**. Salir y volver: se
  pintan en el orden en que se crearon.

## E. El teclado del móvil

- **E1.** *(Móvil.)* ⚠️ Crear o editar un pósit **en la mitad de abajo** de la pantalla: al salir
  el teclado, **el corcho sube** y el pósit que se escribe **queda a la vista**.

## F. Los nodos-nota

- **F1.** **Nota nueva** crea «Nueva Nota», pone un nodo-nota (con la **raya gruesa**) donde se
  tocó y **entra en la nota**. Renombrarla, **✕ Salir**: se vuelve **al diagrama**, y el nodo
  enseña **el nombre nuevo**.
- **F2.** Con el diagrama en **dos contextos** (Mover a… desde el General lo añade al otro),
  *Nota nueva*: la nota sale en **los dos**. Un diagrama que sólo está en el General la crea sin
  contexto.
- **F3.** **Un toque** en un nodo-nota **entra en la nota**, tras un instante muy corto. El atrás
  vuelve al diagrama, y **otro atrás** a la ventana: **no se sale de la página**.
- **F4.** **Doble toque** en un nodo-nota abre su menú **sin «Editar»**, y **no entra** en la
  nota.
- **F5.** **Nota existente** cambia la hoja a la lista de notas, por nombre; elegir una pone su
  nodo **sin entrar** en ella. La misma nota puede estar en dos nodos.
- **F6.** Borrar la nota (papelera del General): sus nodos pasan a **«Nota perdida»**, como
  pósits de texto normales, en su sitio. Se pueden editar.

## G. El diagrama como ventana

- **G1.** En la última ventana, el **+** ofrece los diagramas bajo el rótulo
  **«Diagramas:»**, detrás de «Notas:». En ⚙, *Cambiar contenido* y *Añadir detrás* también.
- **G2.** Una ventana de diagrama enseña el **lienzo** bajo la cabecera, **sin ✕ Salir** y sin los
  **+**; ◀ ▶ y ⚙ siguen. Tocar el título lo renombra.
- **G3.** Todo lo de B, C y D funciona igual dentro de la ventana.
- **G4.** **Recargar** con la ventana de diagrama activa: sigue ahí.
- **G5.** Un nodo-nota de una ventana de diagrama abre su nota **encima**; salir vuelve a la
  ventana.
- **G6.** Borrar el diagrama desde el General: **su ventana desaparece**.

## H. El atrás y las hojas

- **H1.** Con un menú abierto, el **atrás** (en Android, el del sistema) lo cierra **y nada más**.
- **H2.** Tras F1, contar los atrás: nota → diagrama → ventana. **Ninguno de más** sale de la
  página.

---

## Conocidos

- **Las líneas entre nodos** tienen su propia lista: `VERIFICACION-MANUAL-RELACIONES.md`.
- **El lienzo no se maneja con teclado** (moverse entre pósits, abrir menús): pendiente en
  `TAREAS.md`.
- **Dónde se miraba no se recuerda**: al abrir, siempre el origen. Es decisión (§9.11).

---

## Hoja de resultados

**2026-10-10: el usuario dio esta lista por pasada**, tras instalar la app publicada en su móvil y
probarla, **sin anotar paso a paso**: por eso las tablas de abajo siguen vacías. Se había juntado
con las demás pendientes en `VERIFICACION-SENTADA.md`. La próxima pasada se anota aquí, como
siempre.

### Pasada 1 — escritorio

| | |
|---|---|
| Fecha | |
| Navegador y versión | |
| Commit (`git log --oneline -1`) | |
| ¿Árbol limpio? | |

| Paso | Resultado |
|---|---|
| A1–A6 | |
| B1–B3, B6 | |
| C1–C8 | |
| D1, D4–D5 | |
| F1–F6 | |
| G1–G6 | |
| H1–H2 | |

### Pasada 2 — móvil

| | |
|---|---|
| Fecha | |
| Dispositivo, sistema, navegador y teclado | |
| Commit | |
| ¿Árbol limpio? | |

| Paso | Resultado |
|---|---|
| A1–A5 | |
| B1–B2, B4–B5 (**B4**) | |
| C1–C8 | |
| D2–D5 (**D2**, **D3**) | |
| E1 | |
| F1–F6 (**F3**) | |
| G2–G5 | |
| H1–H2 (con el atrás del sistema) | |
