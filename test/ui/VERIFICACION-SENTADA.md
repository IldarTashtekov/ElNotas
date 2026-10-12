# La sentada: todas las verificaciones manuales pendientes, en una

**Esto no es documentación de diseño: es un procedimiento.** Junta en un solo recorrido las cinco
listas manuales que quedan sin pasar, para hacerlas de una vez en el móvil —con la app ya
instalada— y en el escritorio:

| Prefijo | Lista original | Qué verifica |
|---|---|---|
| `CTX-` | `VERIFICACION-MANUAL.md` | Fase 4 · Contextos: ventanas, configuración, la lista de un contexto |
| `ED-` | `VERIFICACION-MANUAL-EDITOR.md` | Fase 4 · Notas: el editor |
| `LZ-` | `VERIFICACION-MANUAL-LIENZO.md` | Fase 5 · Lienzo: el corcho, los pósits, los nodos-nota |
| `RL-` | `VERIFICACION-MANUAL-RELACIONES.md` | Fase 5 · Relaciones: las líneas |
| `PWA-` | `VERIFICACION-MANUAL-PWA.md` | Fase 6: la app instalada |

**Las cinco originales siguen siendo las de referencia**: son las que se vuelven a pasar, sueltas,
cuando se toque su parte. Aquí cada paso conserva **su código de origen** (`CTX-E2` es el E2 de
`VERIFICACION-MANUAL.md`), así que un fallo se busca allí sin perderse. Algunos pasos están
**reescritos para la app instalada**: lo que allí dice «recargar» o «el atrás del navegador», aquí
dice lo que es en el móvil.

## Dónde se pasa cada paso

- **📱** sólo en el móvil, en la app instalada;
- **💻** sólo en el escritorio;
- **sin marca**, en los dos.

## Reglas al ejecutarla

> **Si algo no se puede provocar ahí, se anota eso mismo.** El paso se cierra con el resultado que
> salga, no con el bueno.

> **Se anota sobre qué se pasa**: en el móvil, la versión que dice ⚙ al pie; en el escritorio, el
> commit, con el árbol limpio.

> **Un comportamiento raro no es un fallo si está en «Conocidos»**, al final. Se marca igual, pero
> con un «conocido»: lo que interesa es si se aguanta.

> **No hace falta hacerlo de una vez.** Se puede parar entre partes; la hoja de resultados dice por
> dónde se va.

---

## 0. Preparación

**📱 En el móvil**: la app instalada desde **https://ildartashtekov.github.io/ElNotas/** con
«Instalar» (no «Crear acceso directo»), y abierta **siempre desde su icono**. Empieza vacía, y se
va llenando con lo que piden los pasos.

- **«Recargar»**, en la app instalada, es **quitarla de recientes y volver a abrirla**: no tiene
  botón de recargar.
- **«El atrás»** es el gesto o el botón atrás de Android.
- **«Doble toque»** es tocar dos veces rápido; **«pulsación larga»**, mantener el dedo medio
  segundo.

**💻 En el escritorio**, en desarrollo, desde la raíz del repo:

```bash
npm run build:web
```

```bash
python3 -m http.server 8000
```

y abrir <http://localhost:8000/index.html>. Para empezar de cero, en la consola del navegador:

```js
for (const k of Object.keys(localStorage)) if (k.startsWith("elnotas:")) localStorage.removeItem(k)
```

y recargar. En el escritorio, «doble toque» es **doble clic**, el **clic derecho** abre los mismos
menús, «pulsación larga» es mantener el botón del ratón, y «el atrás» es el del navegador.

⚠️ **Cada sitio es un almacén distinto**: la app instalada, `localhost:8000` y `127.0.0.1:8000` no
comparten notas. Lo creado en uno no aparece en otro, y eso no es un fallo.

---

## 1. Instalar y abrir

- **PWA-A1.** 📱 Abrir la dirección en Chrome: la app carga y funciona.
- **PWA-A2.** 📱 Menú **⋮ → «Instalar aplicación»**: sale el diálogo con **el nerd** y **«ElNotas»**;
  hay que elegir **«Instalar»**, no «Crear acceso directo».
- **PWA-A3.** 📱 En la pantalla de inicio hay un icono **con el nerd y la lluvia de letras
  verdes** y **«ElNotas»** debajo.
- **PWA-B1.** 📱 Al tocar el icono sale **la pantalla de carga**: fondo **negro**, el icono en el
  centro y «ElNotas» debajo.
- **PWA-B2.** 📱 La app se abre **a pantalla completa**, sin la barra de direcciones.
- **PWA-B3.** 📱 La **barra de estado** —la de la hora y la batería— es **oscura**, del
  color del sistema (Fase 7), con el móvil en modo claro **y** en modo oscuro.
- **PWA-B4.** 📱 En ⚙, al pie: **«Versión AAAA-MM-DD · xxxxxxxx»**, no «Versión de desarrollo».
- **PWA-B5.** 📱 En recientes sale como **ElNotas**, con su icono, aparte de Chrome.

## 2. Contextos y ventanas

### El arranque

- **CTX-A1.** Recién vacía, al abrir se ve **una ventana: el General**, vacía, con ⚙ y sin ◀ ▶.
- **CTX-A2.** ⚙ → *Contextos* → crear «Compra». Al volver a la ventana, **Compra no tiene ventana
  todavía**: crear un contexto no se la da.
- **CTX-A3.** ⚙ → ⋮ de *General* → *Añadir detrás* → *Compra*. Al salir aparece ▶, y lleva a
  Compra.
- **CTX-A4.** **Recargar** estando en Compra: vuelve a Compra, con sus ventanas intactas.

### La vista ventanas

- **CTX-B1.** En la primera ventana no hay ◀; en la última no hay ▶. Pulsar donde estarían no hace
  nada: no da la vuelta.
- **CTX-B2.** Tocar el título de un contexto lo convierte en un campo. **Intro** guarda;
  **Escape** 💻 cancela; **tocar fuera** guarda. El nombre nuevo sobrevive a recargar.
- **CTX-B3.** Tocar el título del **General no hace nada**.
- **CTX-B4.** Un contexto sin notas dice «Esta ventana no tiene notas».
- **CTX-B5.** Quitar todas las ventanas desde ⚙: sale «No hay ninguna ventana» **con el ⚙**, que
  sigue funcionando. *(Luego, volver a poner General y Compra.)*

### La configuración

- **CTX-C1.** ⚙ abre la configuración; **✕** vuelve a **la misma ventana** de la que se entró.
- **CTX-C2.** Lo mismo con **el atrás**. Tiene que salir de la configuración, **no de la app**.
- **CTX-C3.** En la ventana principal, sin nada encima, el atrás no hace nada propio de la app.
- **CTX-C4.** Las ventanas son **fichas en una fila**, con ⋮ cada una y una ficha **+** al
  final. ⋮ abre una hoja con *Cambiar contenido*, *Añadir detrás* y *Quitar*, que hacen lo que
  dicen; las dos primeras enseñan la lista **en la misma hoja**. La **+** añade al final. Un
  **toque corto** en una ficha no hace nada. Encima del selector, los **mismos tres botones** que
  en el «+» de la última ventana (CTX-I2): *+ Contexto nuevo*, *+ Nota nueva* y *+ Diagrama
  nuevo* crean «Nuevo contexto», «Nueva Nota» o «Nuevo diagrama» y lo ponen en esa ventana, **sin
  salir de ⚙**; la nota y el diagrama, sin contexto.
- **CTX-C5.** *Borrar* un contexto **pregunta** («¿Borrar «X»? Sus notas seguirán en General.») con
  una **hoja desde abajo** y un botón rojo «Borrar», no con un diálogo del navegador. Con
  *Cancelar*, Escape 💻 o el atrás, no pasa nada y **se sigue en la configuración**. Con «Borrar»
  se va el contexto **y su ventana**, y sus notas siguen en el General.
- **CTX-C6.** **Recargar con la configuración abierta** deja en la ventana, no en la configuración.
- *(CTX-C7, «Borrar todo», va al final: parte 8.)*

### Reordenar las ventanas arrastrando

Con tres o cuatro ventanas, en ⚙:

- **CTX-D1.** **Mantener pulsada** una ficha medio segundo la **levanta**: se resalta con el borde del fósforo.
- **CTX-D2.** Arrastrándola, las demás **se corren** para hacerle hueco; al soltar **queda en ese
  puesto**, y al salir ◀ ▶ recorren las ventanas en el orden nuevo. Sobrevive a recargar.
- **CTX-D3.** Soltarla en su sitio no cambia nada.
- **CTX-D4.** Con más fichas de las que caben: **deslizar** la fila con el dedo la mueve **sin
  levantar ninguna**; arrastrando una levantada cerca del borde, la fila se desliza sola.
- **CTX-D5.** 📱 La pulsación larga **no** selecciona texto ni saca el menú del sistema.
- **CTX-D6.** Pulsar **⋮** no levanta la ficha: abre la hoja. El atrás (o Escape 💻) cierra la hoja
  y **se sigue en ⚙**.

### El «+» de la última ventana

- **CTX-I1.** En la última ventana, en el sitio de ▶, hay un **+** en vídeo inverso; en las demás, ▶ y no el +.
- **CTX-I2.** Tocarlo sube una **hoja desde abajo** con tres botones en vídeo inverso, uno bajo otro —«+
  Contexto nuevo», «+ Nota nueva» y «+ Diagrama nuevo»— y, debajo, **sólo lo que no tiene
  ventana**: el General no sale si ya es ventana; las notas, tras «Notas:».
- **CTX-I3.** Elegir un contexto o una nota lo añade **al final** y **se va a él**; aparece ◀ a la
  ventana de antes y el + sigue en la nueva última.
- **CTX-I4.** «+ Contexto nuevo» crea uno y llega a él **con el título ya en edición**: escribir e
  Intro le pone el nombre.
- **CTX-I5.** La hoja se cierra **sin cambiar nada** con *Cancelar*, con Escape 💻, **tocando
  fuera** y con **el atrás**, y en ningún caso se sale de la app.
- **CTX-I6.** Durante el modo selección (abajo, CTX-E), el + se apaga como ◀ ▶ y ⚙.
- **CTX-I7.** «+ Nota nueva» crea una «Nueva Nota» y llega a ella **con el título ya en edición**,
  como CTX-I4; «+ Diagrama nuevo», lo mismo con «Nuevo diagrama» y su lienzo. Los dos nacen **sin
  contexto**: salen en el General y en ningún contexto. Sobreviven a abrir la app de nuevo.

### La lista de un contexto

Con dos o tres notas en Compra (el botón **+** grande, varias veces):

- **CTX-E1.** El botón **+** grande crea una «Nueva Nota» **en ese contexto** y entra en ella.
  Desde el General la crea sin contexto: sale en el General y en ningún contexto.
- **CTX-E2.** **Pulsación larga** sobre una nota entra en modo selección y la marca. **Un toque
  corto no.** Si el dedo **se mueve** durante la pulsación, tampoco.
- **CTX-E3.** 📱 La pulsación larga **no** selecciona el texto ni saca el menú contextual.
- **CTX-E4.** Dentro de la selección, **cada toque** marca o desmarca, **incluido el primero
  después de la pulsación larga**. Al desmarcar la última, se sale sola.
- **CTX-E5.** 💻 **Clic derecho** y **Ctrl/Cmd+clic** entran; con el foco en una nota (Tab),
  **Espacio** entra o alterna.
- **CTX-E6.** Se sale con Escape 💻 y con **el atrás**, sin salir de la app.
- **CTX-E7.** Durante la selección: abajo la barra con la cuenta, la papelera y *Mover a…*; **el
  botón + desaparece**; **◀ ▶ y ⚙ se apagan** y no responden.
- **CTX-E8.** En un contexto la papelera dice **«Quitar»**, **no pregunta**, y las notas **siguen
  en el General**.
- **CTX-E9.** En el General dice **«Borrar»** y **pregunta** con la hoja de abajo. Con *Cancelar*,
  Escape 💻 o el atrás se cierra **sólo la pregunta** y la selección sigue; con «Borrar», se
  borran de todas partes.
- **CTX-E10.** *Mover a…* desde un contexto: el selector **no ofrece ni el General ni el contexto
  actual**; al elegir, las notas **salen de aquí y aparecen allí**. No pregunta.
- **CTX-E11.** *Mover a…* desde el General: sólo **añade** al elegido; donde ya estuviera, sigue.

## 3. El editor

Para cada apartado, una nota nueva con el botón **+** grande vale: nace vacía y se entra en ella.

### Abrir y salir

- **ED-A1.** Tocar una nota de la lista la abre; 💻 **Intro** con el foco en la fila, también.
- **ED-A2.** La cabecera lleva **sólo el título**: ni ◀ ▶ ni ⚙. Tocar el título lo renombra.
- **ED-A3.** Abajo, la barra: **☐ Casilla**, **↳ Anidar** (apagado) y **✕ Salir**.
- **ED-A4.** **✕ Salir** y **el atrás** vuelven a **la misma ventana**.
- **ED-A5.** Recargar con la nota abierta deja en la ventana, no en la nota.

### Escribir sin perder nada

- **ED-B1.** En una nota vacía, tocar **en cualquier sitio de la nota** —en «Toca para escribir» o
  en el hueco de debajo, hasta la barra— crea la primera línea y deja el cursor en ella. Igual en
  una ventana de tipo nota.
- **ED-B2.** ⚠️ **La importante: escribir deprisa.** En una casilla **anidada**, escribir dos o
  tres frases largas seguidas, sin parar. El cursor **no salta**, no se pierde ninguna letra y no
  se duplica ninguna.
- **ED-B3.** Recargar: lo escrito está.
- **ED-B4.** 💻 **Tab** mete un hueco de tabulación dentro de la línea; no anida nada.
- **ED-B5.** En una nota con líneas, tocar **el hueco de debajo de la última** deja el cursor **al
  final de la última que se ve**, aunque sea una hija anidada; 📱 se abre el teclado. Tocar una
  línea sigue dejando el cursor donde se toca.

### Intro

En el móvil, con el **Intro del teclado** del móvil (es también ED-H1).

| | Estado | Dónde | Tiene que pasar |
|---|---|---|---|
| **ED-C1** | casilla apagada | al final de un texto **en medio** de la nota | texto nuevo **justo debajo**, no al final de la nota |
| **ED-C2** | casilla apagada | al final de una casilla anidada | texto nuevo debajo de **su casilla de la raíz** |
| **ED-C3** | casilla encendida | al final de un texto | casilla debajo |
| **ED-C4** | casilla encendida | al final de una casilla | casilla hermana, al mismo nivel |
| **ED-C5** | encendida + anidar | al final de una casilla | casilla **hija**, y anidar **se apaga solo** |
| **ED-C6** | encendida + anidar | al final de un texto | casilla hermana, y anidar **sigue armado** |
| **ED-C7** | cualquiera | en medio de una línea | la parte; la mitad de abajo nace de la clase del interruptor |
| **ED-C7b** | casilla apagada | en medio de una casilla **anidada** | la parte; la mitad de abajo sale como **texto** a la raíz, debajo de su casilla de la raíz |
| **ED-C8** | encendida + anidar | en medio de una línea | la parte **sin anidar**, y anidar sigue armado |

### Retroceso al principio de una línea

En el móvil, con el **borrar del teclado** (es también ED-H2).

- **ED-D1.** En una **casilla de la raíz**: la primera pulsación **quita el cuadradito**; la segunda
  **une** con la de arriba. El cursor queda en el punto de unión.
- **ED-D2.** En una **casilla anidada**: une directamente, con una sola pulsación.
- **ED-D3.** En la **primera hija**: une con su madre.
- **ED-D4.** Entre **dos textos normales**: une.
- **ED-D4b.** Un texto justo debajo de una casilla **con hijas**: une con **la última hija**, la
  línea que se ve encima, no con la casilla.
- **ED-D5.** En la **primera línea** de la nota, y en una **casilla con hijas**: no hace nada.
- **ED-D6.** En cualquier otro sitio de la línea, borra la letra anterior como siempre.

### El interruptor y anidar

- **ED-E1.** Encender **☐ Casilla** con el cursor **al principio** de un texto: la línea entera pasa
  a casilla. **En medio**: se parte y la mitad de abajo es casilla. **Al final**: aparece una
  casilla vacía debajo.
- **ED-E2.** Apagarlo en una casilla de la raíz: vuelve a texto. En una casilla anidada: sigue
  siendo casilla —un texto no cabe ahí—, pero el interruptor se apaga.
- **ED-E3.** Con la casilla apagada, **↳ Anidar** está desactivado.
- **ED-E4.** Armado, el botón **se ve distinto** (borde discontinuo) y dice «↳ Anidar armado».
  **¿Se entiende sin que nadie lo explique?** Anotar la impresión: es una de las tres preguntas del
  editor (§9.10).
- **ED-E5.** Pulsar los botones de la barra **no cambia de línea** el cursor, y 📱 **no cierra el
  teclado**.

### Marcar

- **ED-F1.** Tocar el **☐** marca y desmarca. Una marcada sale tachada.
- **ED-F2.** 💻 **Ctrl/Cmd+Intro** con el cursor en una casilla la marca.
- **ED-F3.** 💻 Con **Tab** hasta el ☐, **Espacio** lo marca.
- **ED-F4.** Marcar una casilla **no marca a sus hijas**.

### Moverse

- **ED-G1.** 💻 **↑ ↓** pasan a la línea de arriba o de abajo, conservando la columna si cabe; en
  una línea larga que ocupa varias filas, primero recorren sus filas.
- **ED-G2.** 💻 **←** al principio de una línea va al final de la de arriba; **→** al final, al
  principio de la de abajo.

### El teclado del móvil

- **ED-H1.** 📱 **Intro del teclado** hace lo mismo que en ED-C: probar al menos C1, C3 y C5.
- **ED-H2.** 📱 **Borrar** del teclado al principio de una línea hace lo mismo que en ED-D1 y D2.
- **ED-H3.** 📱 Con el **texto predictivo** o el autocorrector: escribir y aceptar una sugerencia
  no duplica ni pierde texto.
- **ED-H4.** 📱 Tocar una palabra para poner el cursor en medio, y pulsar Intro: la línea se parte
  ahí.

### Ventanas de tipo nota

- **ED-I1.** ⚙ → ⋮ de una ventana → *Añadir detrás* (o la ficha **+**) → bajo «Notas:», elegir una
  nota. Aparece como ventana.
- **ED-I2.** En esa ventana: cabecera con **◀ ▶ y ⚙**, el editor debajo y la barra **sin ✕ Salir**.
  Todo lo de ED-B a ED-G funciona igual.
- **ED-I3.** Renombrarla por el título renombra la nota: se ve en el General.
- **ED-I4.** Borrar esa nota desde el General (selección → Borrar): su ventana **desaparece en la
  misma sesión**.

## 4. El lienzo

Hace falta **un contexto con alguna nota** y, para LZ-F2, **un segundo contexto**.

### Crear, listar y tirar un diagrama

- **LZ-A1.** En la ventana de un contexto, abajo a la derecha, **debajo y a la izquierda** del **+**
  grande, hay un **+ en hueco más pequeño**, por encima de la esquina del grande. Tocarlo crea «Nuevo
  diagrama» y **entra** en él con el **nombre seleccionado**, listo para escribir encima. Escribir
  un nombre e Intro lo guarda.
- **LZ-A2.** **✕ Salir** y **el atrás** vuelven a la ventana. El diagrama sale en la lista del
  contexto, **detrás** de las notas, con una **raya gruesa a la izquierda**. Tocarlo lo abre, ya sin
  el nombre en edición.
- **LZ-A3.** En el **General**, el diagrama sale **mezclado con las notas, por nombre**.
- **LZ-A4.** Seleccionarlo (pulsación larga) en un contexto: la papelera dice **«Quitar»** y lo
  saca del contexto sin borrarlo; sigue en el General.
- **LZ-A5.** En el General, la papelera dice **«Borrar»**, pregunta «¿Borrar «…»? No se puede
  deshacer.» con la hoja, y lo borra.
- **LZ-A6.** **Mover a…** con un diagrama seleccionado lo lleva a otro contexto.

### El corcho

- **LZ-B1.** Un diagrama **que nunca se ha movido** se abre con el origen **en el centro**: un
  pósit creado en el centro de la pantalla, al volver a abrir sin tocar el corcho, sigue en el
  centro.
- **LZ-B2.** Arrastrar el fondo **mueve el corcho**, con los puntos de la rejilla.
- **LZ-B3.** 💻 La **rueda** acerca y aleja **alrededor del puntero**: lo que hay debajo no se
  mueve. El **pellizco del trackpad** hace lo mismo. **La página no se desplaza** ni se acerca
  entera.
- **LZ-B4.** 📱 ⚠️ **Dos dedos acercan y alejan alrededor de su punto medio**, y moverlos juntos
  arrastra el corcho. **No se hace zoom a la página.**
- **LZ-B5.** 📱 Pellizcando, **levantar un dedo y seguir con el otro** sigue arrastrando, sin
  saltos.
- **LZ-B6.** No se acerca más de ×4 ni se aleja más de ×0,25.
- **LZ-B7.** ⚠️ **Dónde se miraba se recuerda, en cada diagrama.** Mover el corcho y acercarlo;
  salir —✕, el atrás o cambiar de ventana— y volver: se ve **igual**, mismo sitio y mismo zoom.
  **Recargar**, y 📱 **cerrar la app** del todo (quitarla de recientes) y abrirla: igual. Otro
  diagrama **no hereda** ese encuadre. Tras «Borrar todo», todos vuelven al origen.
- **LZ-B8.** La **mira** (un círculo con cuatro marcas): en la vista diagrama, **en la barra de
  abajo, a la izquierda**, con «✕ Salir» a la derecha y sin otra encima del lienzo; en una
  **ventana** de diagrama, que no tiene barra, **flotando abajo a la derecha** del lienzo, en el
  color del fósforo. Con el corcho movido y acercado, tocarla lo devuelve **al origen en el
  centro y a ×1**, como un diagrama nuevo, y así se recuerda (LZ-B7). La flotante **no arrastra**
  el corcho ni abre menús, tampoco con doble toque o clic derecho 💻.

### Los pósits y sus menús

- **LZ-C1.** **Doble toque en el fondo** abre una hoja «Añadir al diagrama»: *Texto*, *Nota
  existente* (sólo si hay notas) y *Nota nueva*.
- **LZ-C2.** **Texto** crea un pósit **donde se tocó**, vacío y con el cursor dentro.
- **LZ-C3.** Escribir; **Intro guarda**. 💻 **Mayúsculas+Intro** hace otra línea. 💻 **Escape**
  descarta lo escrito. Tocar fuera también guarda.
- **LZ-C4.** Un pósit vacío **se queda**, y enseña «Sin texto» en tenue.
- **LZ-C5.** **Doble toque en un pósit** abre su menú, con su texto de título: *Conectar · Editar ·
  Marcar hecho · Borrar*. *Conectar* se prueba en la parte 5.
- **LZ-C6.** **Marcar hecho** lo atenúa y lo tacha; el menú dice entonces **Desmarcar hecho**.
- **LZ-C7.** **Borrar** lo quita **sin preguntar**, y con él sus líneas.
- **LZ-C8.** Un texto largo se parte en líneas y **el pósit crece hacia abajo**; el ancho no cambia.

### Mover un pósit

- **LZ-D1.** 💻 **Arrastrar un pósit lo mueve**; el corcho no se mueve.
- **LZ-D2.** 📱 ⚠️ **Arrastrar un pósit sin esperar mueve el corcho**, no el pósit.
- **LZ-D3.** 📱 ⚠️ **Mantenerlo pulsado medio segundo lo levanta** (se le ilumina el borde) y entonces el
  dedo lo arrastra. **Ni la página ni el corcho se mueven.** No sale el menú del sistema.
- **LZ-D4.** Al soltar se queda ahí; **recargar** y volver a abrir: sigue ahí.
- **LZ-D5.** Arrastrar uno encima de otro: **el que se movió queda encima**. Salir y volver: se
  pintan en el orden en que se crearon.

### El teclado del móvil

- **LZ-E1.** 📱 ⚠️ Crear o editar un pósit **en la mitad de abajo** de la pantalla: al salir el
  teclado, **el corcho sube** y el pósit que se escribe **queda a la vista**.

### Los nodos-nota

- **LZ-F1.** **Nota nueva** crea «Nueva Nota», pone un nodo-nota (con la **raya gruesa**) donde se
  tocó y **entra en la nota**. Renombrarla, **✕ Salir**: se vuelve **al diagrama**, y el nodo
  enseña **el nombre nuevo**.
- **LZ-F2.** Con el diagrama en **dos contextos** (*Mover a…* desde el General lo añade al otro),
  *Nota nueva*: la nota sale en **los dos**. Un diagrama que sólo está en el General la crea sin
  contexto.
- **LZ-F3.** ⚠️ **Un toque** en un nodo-nota **entra en la nota**, tras un instante muy corto. El
  atrás vuelve al diagrama, y **otro atrás** a la ventana: **no se sale de la app**.
- **LZ-F4.** **Doble toque** en un nodo-nota abre su menú **sin «Editar»**, y **no entra** en la
  nota.
- **LZ-F5.** **Nota existente** cambia la hoja a la lista de notas, por nombre; elegir una pone su
  nodo **sin entrar** en ella. La misma nota puede estar en dos nodos.
- **LZ-F6.** Borrar la nota (papelera del General): sus nodos pasan a **«Nota perdida»**, como
  pósits de texto normales, en su sitio. Se pueden editar.

### El diagrama como ventana

- **LZ-G1.** En la última ventana, el **+** ofrece los diagramas bajo **«Diagramas:»**, detrás
  de «Notas:». En ⚙, *Cambiar contenido* y *Añadir detrás* también.
- **LZ-G2.** Una ventana de diagrama enseña el **lienzo** bajo la cabecera, **sin ✕ Salir** y sin
  los **+**; ◀ ▶ y ⚙ siguen. Tocar el título lo renombra.
- **LZ-G3.** Todo lo de LZ-B, LZ-C y LZ-D funciona igual dentro de la ventana.
- **LZ-G4.** **Recargar** con la ventana de diagrama activa: sigue ahí.
- **LZ-G5.** Un nodo-nota de una ventana de diagrama abre su nota **encima**; salir vuelve a la
  ventana.
- **LZ-G6.** Borrar el diagrama desde el General: **su ventana desaparece**.
- **LZ-G7.** El encuadre es **el mismo en la ventana y en la vista propia** del diagrama: moverlo
  en su ventana y abrirlo desde la lista del General (o al revés) enseña **lo mismo en el centro**,
  con el mismo zoom, aunque el lienzo tenga otro tamaño.

### El atrás y las hojas

- **LZ-H1.** Con un menú abierto, **el atrás** lo cierra **y nada más**.
- **LZ-H2.** Tras LZ-F1, contar los atrás: nota → diagrama → ventana. **Ninguno de más** sale de la
  app.

## 5. Las relaciones

Hace falta **un diagrama con tres pósits** separados —A, B y C—, y uno de ellos **nodo-nota**.

### Conectar

- **RL-A1.** El menú de un pósit empieza por **Conectar**, también en un nodo-nota. Al elegirlo,
  arriba sale **«Toca el nodo de destino»** y el pósit de origen queda **marcado con el borde iluminado**.
- **RL-A2.** Tocar otro pósit crea la línea **con flecha, del origen al destino**. El aviso y la
  marca se van.
- **RL-A3.** Conectando, tocar un **nodo-nota** como destino lo une y **no entra** en la nota.
- **RL-A4.** Cancelan sin crear nada: tocar **el fondo**, tocar **el propio origen**, el **clic
  derecho** 💻 y **el atrás**. El atrás cancela **sólo** el modo: el diagrama sigue abierto.
- **RL-A5.** Conectar **dos veces** A con B: salen **dos** líneas. Y B con A: una tercera, en el
  otro sentido.

### Cómo se ven

- **RL-B1.** Cada línea **sale del borde** del pósit, no de su centro, y la **punta de flecha se
  ve** entera, pegada al borde del destino.
- **RL-B2.** Una sola línea entre dos pósits va **recta**. Varias entre los mismos dos se abren
  **en abanico**, sin pisarse, **aunque vayan en sentidos contrarios**.
- **RL-B3.** Las líneas van **por debajo** de los pósits.
- **RL-B4.** **Mover un pósit** (📱 levantado con la pulsación larga): sus líneas **lo siguen
  mientras se arrastra**, no sólo al soltar.
- **RL-B5.** Escribir en un pósit hasta que crezca: sus líneas siguen saliendo **del borde nuevo**.
- **RL-B6.** Al abrir el diagrama, las líneas ya salen del borde: **ninguna** empieza en el centro
  de un pósit.
- **RL-B7.** 💻 Con el ratón encima, la línea se **ilumina**.

### El menú de la línea

- **RL-C1.** ⚠️ **Doble toque sobre una línea** abre su menú; 📱 con el dedo, sin tener que apuntar
  al píxel. El título dice qué une: «A → B», o «A — B» si no tiene dirección.
- **RL-C2.** Con flecha: *Invertir dirección · Sin dirección · Texto · Borrar*. Sin flecha: *Con
  dirección · Texto · Borrar* — **invertir no sale**.
- **RL-C3.** **Invertir** le da la vuelta a la flecha. Si ya había otra en ese sentido, **conviven
  las dos**.
- **RL-C4.** **Sin dirección** quita la punta. **Con dirección** la devuelve **en el sentido que
  tenía**.
- **RL-C5.** **Borrar** quita la línea **sin preguntar**; los pósits se quedan.
- **RL-C6.** Arrastrar empezando **sobre una línea** mueve el corcho.

### El texto de la línea

- **RL-D1.** **Texto** pone un campo en el **medio de la línea**. Escribir e **Intro**: el texto
  sale **a lo largo** de la línea, centrado y un poco por encima.
- **RL-D2.** ⚠️ En una línea que va **de derecha a izquierda**, el texto se lee **derecho**, no boca
  abajo. 📱 Escribirlo con el teclado del móvil.
- **RL-D3.** 💻 **Escape** descarta; tocar fuera guarda; **vaciar** el campo y guardar quita el
  texto.
- **RL-D4.** Un texto que cruza otra línea se lee igual: lleva un halo del color del fondo.
- **RL-D5.** Un texto más largo que la línea **se corta** al final de ella.
- **RL-D6.** Recargar: el texto, las flechas y los sentidos siguen igual.

### Lo que arrastra a las líneas

- **RL-E1.** **Borrar un pósit** borra **todas sus líneas**, las que salen y las que llegan.
- **RL-E2.** Borrar la nota de un nodo-nota: el nodo pasa a «Nota perdida» y **sus líneas se
  quedan**.

## 6. Sin conexión, que nada se pierda, y girar

### Sin conexión

- **PWA-C1.** 📱 Con conexión, crear una nota con algo escrito. **Cerrar la app del todo**:
  quitarla de recientes.
- **PWA-C2.** 📱 Poner **modo avión**. Abrir la app desde el icono: **carga**, y la nota de C1 está.
- **PWA-C3.** 📱 Sin conexión, entrar en **una nota, un diagrama y ⚙**: todo funciona.
- **PWA-C4.** 📱 Sin conexión, cambiar el texto de la nota, cerrar la app del todo y volver a
  abrirla: el cambio **sigue ahí**. *(Quitar el modo avión.)*

### Que no se pierda nada al salir

- **CTX-H1.** 💻 Crear una nota y **cerrar la pestaña enseguida**, sin esperar. Al volver a abrir,
  está.
- **CTX-H2.** 📱 Crear una nota, **cambiar de app**, y cerrar ElNotas desde recientes. Al volver,
  está.
- **PWA-D1.** 📱 Quitar la app de recientes y volver a abrirla: todo está.
- **PWA-D2.** 📱 **Reiniciar el móvil** y abrirla: todo está.
- **PWA-D3.** 📱 *(Opcional, con el cable.)* Con la depuración USB activada, en el Chrome del
  ordenador `chrome://inspect` → «inspect» en ElNotas, y en la consola
  `await navigator.storage.persisted()`. Se anota `true` o `false`; un `false` no es un fallo,
  porque decide el navegador.

### Girar

- **PWA-E1.** 📱 Girar el móvil en cada vista —**ventanas, nota, diagrama, ⚙**—: la app gira, se ve
  entera y se puede seguir usando. En horizontal, la columna queda en el centro.
- **PWA-E2.** 📱 En el diagrama girado, **mover el lienzo y un pósit** con el dedo.
- **PWA-E3.** 📱 Volver a vertical: todo como estaba.

## 7. Sólo en el escritorio

### Que no se repinte de más

En Chrome o Brave, herramientas de desarrollo → *Elements*, con la lista de notas desplegada: el
navegador **resalta en color los nodos que cambian**.

- **CTX-F1.** 💻 Al seleccionar una nota, se resalta **esa fila**, no la lista entera.
- **CTX-F2.** 💻 Al renombrar el contexto por su título, **las filas de notas no se resaltan**.

### Un «marcar» que no cambia nada no toca la pantalla

Abrir la app con **`?depurar`** al final de la dirección
(<http://localhost:8000/index.html?depurar>). Con una nota abierta que tenga una casilla **marcada
en la raíz** (no anidada), en la consola:

```js
const { store, useCases } = window.elnotas
const nota = Object.values(store.getState().notes).find((n) => n.name === "NOMBRE DE LA NOTA")
const casilla = nota.content.find((c) => c.type === "checkbox" && c.checked)
let cambios = 0
new MutationObserver((m) => { cambios += m.length })
  .observe(document.querySelector(".vista-nota"), { subtree: true, childList: true, characterData: true, attributes: true })
useCases.setChecked(nota.id, casilla.id, true)   // ya lo estaba
setTimeout(() => console.log("cambios en pantalla:", cambios), 700)
```

- **ED-J1.** 💻 `setChecked` devuelve `null`, y a los 700 ms dice **`cambios en pantalla: 0`**.

### Una nota ilegible, y una con forma rota

- **CTX-G1.** 💻 En la consola:

  ```js
  localStorage.setItem("elnotas:blob:notes/rota.json", btoa("no es json"))
  ```

  y recargar. La app **arranca**, con un aviso **flotando arriba** que nombra `notes/rota.json` —y
  dice «Sigue guardado», en singular—, y el resto de notas está. A los **6 segundos se difumina**
  solo; **tocarlo** lo quita antes.
- **CTX-G2.** 💻 Quitarla (`localStorage.removeItem("elnotas:blob:notes/rota.json")`) y recargar:
  el aviso desaparece.
- **ED-L1.** 💻 En la consola, una nota que es JSON válido pero no es una nota:

  ```js
  localStorage.setItem("elnotas:blob:notes/rara.json", btoa(JSON.stringify({ id: "rara", name: "Rara", updatedAt: 0, revision: "r", content: "no es una lista" })))
  ```

  y recargar. La app arranca con el aviso que nombra `notes/rara.json`.
- **ED-L2.** 💻 Quitarla (`localStorage.removeItem("elnotas:blob:notes/rara.json")`) y recargar.

### Dos pestañas no se pisan

- **CTX-J1.** 💻 Abrir la app en **dos pestañas**, A y B. En A, renombrar una nota a «Desde A» y
  esperar un segundo. En B —que no se ha enterado—, renombrar la misma nota a «Desde B».
- **CTX-J2.** 💻 En B sale arriba, en rojo, **«No se están guardando los cambios. Otra pestaña ha
  cambiado lo mismo que esta…»** con un botón **Recargar**. En A, la nota sigue «Desde A».
- **CTX-J3.** 💻 **Recargar** en B: la nota dice «Desde A» y el aviso desaparece.

### El aviso de que no se guarda

Va casi al final porque deja la pestaña sin guardar hasta recargar.

- **ED-K1.** 💻 En la consola:

  ```js
  Storage.prototype.setItem = function () { throw new DOMException("lleno", "QuotaExceededError") }
  ```

  y escribir algo en una nota. Al poco sale arriba, en rojo, **«No se están guardando los
  cambios»**, con el motivo. La app sigue funcionando.
- **ED-K2.** 💻 Recargar: lo escrito después del aviso **no está** —es lo que el aviso dice—, y lo de
  antes sí.

### Sin *service worker* en desarrollo

- **PWA-G1.** 💻 En `http://localhost:8000`, ⚙ dice **«Versión de desarrollo»**.
- **PWA-G2.** 💻 En DevTools, **Application → Service workers**: para `localhost:8000` **no hay
  ninguno**.

## 8. Al final: «Borrar todo»

⚠️ **Borra todas las notas de ese sitio.** Por eso va lo último, y en cada sitio por separado: en
el móvil borra las de la app instalada; en el escritorio, las de `localhost:8000`.

- **CTX-C7.** En ⚙, al final, en «Datos», **Borrar todo** pregunta con la hoja **contando lo que
  se pierde** («¿Borrar 2 notas, 1 diagrama y 1 contexto, y las ventanas? …»), con el foco en
  *Cancelar*. *Cancelar* no borra nada. Con «Borrar todo», la app **se recarga en blanco**: sin
  notas, sin diagramas, sin contextos y con el General como única ventana. **Recargar otra vez**:
  sigue en blanco.

## 9. Más adelante: que se actualice sola

Hace falta **publicar un cambio que toque la app**: un `push` a `main` con algo en `src/`,
`index.html` o los estilos. Relanzar la receta sin cambios **no** sirve: da la misma huella y, para
el móvil, la misma versión.

- **PWA-F1.** 📱 Anotar la versión que dice ⚙ antes del `push`. Hacer el `push` y esperar a que
  *Publicar* salga en verde en la pestaña **Actions**.
- **PWA-F2.** 📱 Abrir la app **con conexión**: ⚙ dice aún **la versión vieja**. Es lo esperado.
- **PWA-F3.** 📱 Cerrarla del todo y volver a abrirla: ⚙ dice **la versión nueva**, y el cambio se
  ve.
- **PWA-F4.** 📱 Las notas siguen todas.

---

## Conocidos

No son fallos; se anotan para no marcarlos como tales, y para decidir si se aguantan.

**De la Fase 4:**

- **Varias «Nueva Nota» iguales** en los selectores: toda nota nace con ese nombre, y pueden
  existir notas con el mismo nombre; lo que las distingue es su id (2026-09-29).
- **Una línea en el nivel equivocado se borra y se reescribe**: no hay `indent` ni `outdent`. Y
  **no se puede reordenar**: no hay `move`. Las dos son preguntas abiertas del editor (§9.10).

**De la Fase 5:**

- **El lienzo y las líneas no se manejan con teclado**: pendiente en `TAREAS.md`.
- **Con el modo de conectar activo, «✕ Salir» primero lo cancela** y hay que pulsarlo otra vez: el
  modo es una capa del atrás, como una hoja.
- **No se puede unir un pósit consigo mismo**: tocarlo como destino cancela (§9.11).

**De la Fase 6:**

- **La primera apertura tras publicar enseña la versión anterior**; la nueva, en la siguiente. Es
  la actualización en silencio (§9.12).
- ~~**La barra de estado es azul también en modo oscuro**~~: decisión del 2026-10-09, revisada en la Fase 7 (color del sistema).
- **El icono puede salir con un borde o un fondo** en algunos lanzadores: no tiene versión
  *maskable* (§9.12).
- **En MIUI, «Instalar» puede no poner el icono** si Chrome no tiene permiso para crear accesos
  directos: *Ajustes → Aplicaciones → Chrome → Otros permisos → «Accesos directos en la pantalla de
  inicio»*. Se anota si hizo falta.
- **Lo escrito en la versión de la red de casa no aparece en la instalada**: es otro sitio (§9.12).

---

## Hoja de resultados

**2026-10-10: el usuario dio la sentada entera por pasada**, tras instalar la app publicada en
su móvil y probarla, satisfecho con su funcionamiento, **sin anotar paso a paso**: la tabla de
abajo queda vacía, para la próxima vez. **No consta la parte 9**, la actualización en el móvil.

En cada casilla: ✅, ❌ con lo que pasó, «conocido», o «no se puede probar aquí» y por qué. Una
casilla con **—** es que ese paso no va en ese sitio.

| | 📱 Móvil | 💻 Escritorio |
|---|---|---|
| Fecha | | |
| Dispositivo y sistema / navegador | | |
| Navegador y teclado del móvil | | — |
| Versión que dice ⚙ / commit | | |
| ¿Árbol limpio? | — | |

| Parte | Pasos | 📱 | 💻 |
|---|---|---|---|
| 1. Instalar y abrir | PWA-A1–A3 | | — |
| | PWA-B1–B5 (B3 en claro y en oscuro) | | — |
| 2. Contextos y ventanas | CTX-A1–A4 | | |
| | CTX-B1–B5 | | |
| | CTX-C1–C6 (C2 con el atrás) | | |
| | CTX-D1–D6 (**D4**, **D5** en el móvil) | | |
| | CTX-I1–I6 | | |
| | CTX-E1–E11 (**E3**, **E6** en el móvil) | | |
| 3. El editor | ED-A1–A5 | | |
| | ED-B1–B5 (**B2**) | | |
| | ED-C1–C8 | | |
| | ED-D1–D6 | | |
| | ED-E1–E5 (**E4**: ¿se entiende anidar?) | | |
| | ED-F1–F4 | | |
| | ED-G1–G2 | — | |
| | ED-H1–H4 | | — |
| | ED-I1–I4 | | |
| 4. El lienzo | LZ-A1–A6 | | |
| | LZ-B1–B8 (**B4** y **B7** en el móvil) | | |
| | LZ-C1–C8 | | |
| | LZ-D1–D5 (**D2**, **D3** en el móvil) | | |
| | LZ-E1 | | — |
| | LZ-F1–F6 (**F3**) | | |
| | LZ-G1–G7 | | |
| | LZ-H1–H2 | | |
| 5. Las relaciones | RL-A1–A5 | | |
| | RL-B1–B7 | | |
| | RL-C1–C6 (**C1** con el dedo) | | |
| | RL-D1–D6 (**D2**) | | |
| | RL-E1–E2 | | |
| 6. Sin conexión, nada se pierde, girar | PWA-C1–C4 | | — |
| | CTX-H1 | — | |
| | CTX-H2, PWA-D1–D2 | | — |
| | PWA-D3 (opcional) | | — |
| | PWA-E1–E3 | | — |
| 7. Sólo escritorio | CTX-F1–F2 | — | |
| | ED-J1 | — | |
| | CTX-G1–G2, ED-L1–L2 | — | |
| | CTX-J1–J3 | — | |
| | ED-K1–K2 | — | |
| | PWA-G1–G2 | — | |
| 8. Borrar todo | CTX-C7 | | |
| 9. Actualización | PWA-F1–F4 (versión de antes → de después) | | — |

**Al terminar**, lo pasado se apunta también en la hoja de cada lista original, con una línea que
remita aquí, y en `TAREAS.md` se cierran las que hayan quedado enteras.
