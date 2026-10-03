# Verificación manual de Fase 4 · Contextos

**Esto no es documentación de diseño: es un procedimiento.** Vive en `test/ui/`, junto a las
pruebas de la UI, porque es una prueba más de ese código; lo único que la distingue de sus
vecinas es que la ejecutan unas manos y no `node --test`. Es el punto 8 del criterio de cierre
de Fase 4 · Contextos (`ARCHITECTURE.md` §9.10).

## Por qué existe

Todo lo que la UI **decide** está probado en Node: la guarda de ventanas, qué enseña cada
vista, las ediciones de la lista, la selección, las acciones sobre las notas y la
reconciliación. Lo que no se puede probar ahí es **cómo se siente en un navegador de verdad**:
la pulsación larga con el dedo, el atrás de Android, el menú de iOS que no tiene que salir, el
foco con el teclado, que recargar no pierda nada. Eso es esta lista.

Y no es una formalidad: probando a mano durante el desarrollo salieron dos fallos que ninguna
prueba veía —el toque que se perdía tras una pulsación larga, y un doble «atrás» que sacaba de
la página al borrar—.

## Cuándo hay que volver a pasarla

- antes de cerrar Fase 4 · Contextos (es parte del criterio);
- al tocar `src/ui/NoteList.ts`, `src/ui/backStack.ts`, `src/ui/sheet.ts`, `src/ui/dragReorder.ts`,
  `src/ui/SettingsView.ts` o `src/ui/App.ts`, que es donde viven los
  gestos y el historial;
- al probar un navegador nuevo.

**Cada pasada se anota abajo, en la hoja de resultados, debajo de la anterior.** No se
sobreescribe: interesa saber en qué navegador funcionó y en cuál no.

## Reglas al ejecutarla

> **Si algo no se puede provocar en ese navegador, se anota eso mismo.** El punto se cierra con
> el resultado que salga, no con el bueno.

> **Se pasa sobre un commit y con el árbol limpio**, y se anota el commit. La lista de la Fase 3
> se pasó con el árbol sucio y lo verificado no era literalmente lo del commit; no hace falta
> repetirlo.

---

## Preparación

**1. Compilar** desde la raíz del repo:

```bash
npm run build:web
```

**2. Servir.** En escritorio basta con `localhost`:

```bash
python3 -m http.server 8000
```

y abrir <http://localhost:8000/index.html>.

**Para el móvil** hay que escuchar en la red local y abrir por la IP del ordenador, con el móvil
en la misma wifi:

```bash
python3 -m http.server 8000 --bind 0.0.0.0
```

La IP sale con `hostname -I`; en el móvil, `http://<esa IP>:8000/index.html`. Por la IP **no** es
un contexto seguro, y la app está hecha para que eso dé igual (los ids no usan `randomUUID`);
si algo falla sólo en el móvil, es lo primero que hay que sospechar.

⚠️ **Cada dirección es un almacén distinto:** `localhost`, `127.0.0.1` y la IP no comparten
`localStorage`. Lo creado en uno no aparece en otro, y eso no es un fallo.

**3. Empezar de cero.** En escritorio, en la consola del navegador:

```js
for (const k of Object.keys(localStorage)) if (k.startsWith("elnotas:")) localStorage.removeItem(k)
```

y recargar. En el móvil, borrar los datos del sitio desde los ajustes del navegador.

---

## A. Arranque y la rebanada

- **A1.** Recién limpio, al abrir se ve **una ventana: el General**, vacía, con ⚙ y sin ◀ ▶.
- **A2.** ⚙ → *Contextos* → crear «Compra». Vuelve a la ventana: **Compra no tiene ventana
  todavía** (crear un contexto no se la da).
- **A3.** ⚙ → ⋮ de *General* → *Añadir detrás* → *Compra*. Sal: aparece ▶, y lleva a Compra.
- **A4.** **Recargar** estando en Compra: vuelve a Compra, con sus ventanas intactas.

## B. La vista ventanas

- **B1.** En la primera ventana no hay ◀; en la última no hay ▶. Pulsar donde estarían no hace
  nada (no da la vuelta).
- **B2.** Tocar el título de un contexto lo convierte en un campo. **Intro** guarda; **Escape**
  cancela; **tocar fuera** guarda. El nombre nuevo sobrevive a recargar.
- **B3.** Tocar el título del **General no hace nada**.
- **B4.** Un contexto sin notas dice «Esta ventana no tiene notas».
- **B5.** Quitar todas las ventanas desde ⚙: sale «No hay ninguna ventana» **con el ⚙**, que
  sigue funcionando.

## C. La vista configuración

- **C1.** ⚙ abre la configuración; **✕** vuelve a **la misma ventana** de la que se entró.
- **C2.** Lo mismo con el **atrás del navegador**, y en Android con el **gesto o botón atrás del
  sistema**. Tiene que salir de la configuración, **no de la app**.
- **C3.** En la ventana principal (sin nada encima), el atrás no hace nada propio de la app.
- **C4.** Las ventanas son **fichas en una fila**, con ⋮ cada una y una ficha **+** verde al
  final. ⋮ abre una hoja con *Cambiar contenido*, *Añadir detrás* y *Quitar*, que hacen lo que
  dicen; las dos primeras enseñan la lista **en la misma hoja**. La **+** añade al final. Un
  **toque corto** en una ficha no hace nada.
  *+ Contexto nuevo* en el selector crea «Nuevo contexto» y lo pone en esa ventana.
- **C5.** *Borrar* un contexto **pregunta** («¿Borrar «X»? Sus notas seguirán en General.»).
  La pregunta es una **hoja desde abajo** con un botón rojo «🗑 Borrar», no un diálogo del
  navegador. Con *Cancelar*, Escape o el atrás, no pasa nada y **se sigue en la configuración**.
  Con «🗑 Borrar», se va el contexto **y su ventana**, y sus notas
  siguen en el General.
- **C6.** **Recargar con la configuración abierta** deja en la ventana, no en la configuración.

## D. Reordenar las ventanas arrastrando

Con tres o cuatro ventanas, en ⚙:

- **D1.** **Mantener pulsada** una ficha medio segundo la **levanta** (se resalta y hace sombra).
  Con el ratón, igual: mantener el botón.
- **D2.** Arrastrándola, las demás **se corren** para hacerle hueco; al soltar, **queda en ese
  puesto**, y al salir ◀ ▶ recorren las ventanas en el orden nuevo. Sobrevive a recargar.
- **D3.** Soltarla en su sitio no cambia nada.
- **D4.** Con más fichas de las que caben: **deslizar** la fila con el dedo la mueve **sin levantar
  ninguna**; arrastrando una levantada cerca del borde, la fila se desliza sola.
- **D5.** En el móvil, la pulsación larga **no** selecciona texto ni saca el menú del sistema.
- **D6.** Pulsar **⋮** no levanta la ficha: abre la hoja. El atrás (o Escape) cierra la hoja y
  **se sigue en ⚙**.

## E. La lista de un contexto

Con dos o tres notas en Compra (el botón redondo **+**, varias veces):

- **E1.** El botón redondo **+** crea una «Nueva Nota» **en ese contexto** y entra en ella (desde
  Fase 4 · Notas). Desde el General la crea sin contexto: sale en el General y en ningún contexto.
- **E2.** **Pulsación larga** (medio segundo) sobre una nota entra en modo selección y la marca.
  **Un toque corto no.** Si el dedo **se mueve** durante la pulsación, tampoco.
- **E3.** En el móvil, la pulsación larga **no** selecciona el texto, **no** saca el menú
  contextual ni, en iOS, el *callout*.
- **E4.** Dentro de la selección, **cada toque** marca o desmarca, **incluido el primero después
  de la pulsación larga**. Al desmarcar la última, se sale sola.
- **E5.** En escritorio: **clic derecho** y **Ctrl/Cmd+clic** entran; con el foco en una nota
  (Tab), **Espacio** entra o alterna.
- **E6.** Se sale con **Escape** y con **atrás** (en Android, el del sistema), sin salir de la
  app.
- **E7.** Durante la selección: abajo la barra con la cuenta, la papelera y *Mover a…*; **el botón + desaparece**; **◀ ▶ y ⚙ se apagan** y no responden.
- **E8.** En un contexto la papelera dice **«Quitar»**, **no pregunta**, y las notas **siguen en el
  General**.
- **E9.** En el General dice **«Borrar»** y **pregunta** con la hoja de abajo. Con *Cancelar*,
  Escape o el atrás, se cierra **sólo la pregunta** y la selección sigue; con «🗑 Borrar», se
  borran de todas partes.
- **E10.** *Mover a…* desde un contexto: el selector **no ofrece ni el General ni el contexto
  actual**; al elegir, las notas **salen de aquí y aparecen allí**. No pregunta.
- **E11.** *Mover a…* desde el General: sólo **añade** al elegido; donde ya estuviera, sigue.

## F. Que no se repinte de más *(sólo escritorio)*

En Chrome o Brave, herramientas de desarrollo → *Elements*, con la lista de notas desplegada:
el navegador **resalta en color los nodos que cambian**.

- **F1.** Al seleccionar una nota, se resalta **esa fila**, no la lista entera.
- **F2.** Al renombrar el contexto por su título, **las filas de notas no se resaltan**.

## G. Una nota ilegible *(sólo escritorio: hace falta la consola)*

- **G1.** En la consola:

  ```js
  localStorage.setItem("elnotas:blob:notes/rota.json", btoa("no es json"))
  ```

  y recargar. La app **arranca**, con un aviso arriba que nombra `notes/rota.json`, y el resto
  de notas está.
- **G2.** Quitarla (`localStorage.removeItem("elnotas:blob:notes/rota.json")`) y recargar: el
  aviso desaparece.

## I. El «+» de la última ventana

- **I1.** En la última ventana, en el sitio de ▶, hay un **+ verde**; en las demás, ▶ y no el +.
- **I2.** Tocarlo sube una **hoja desde abajo** con «+ Contexto nuevo» y, debajo, **sólo lo que no
  tiene ventana** (el General no sale si ya es ventana; las notas, tras «Notas:»).
- **I3.** Elegir un contexto o una nota lo añade **al final** y **se va a él**; aparece ◀ a la
  ventana de antes y el + sigue en la nueva última.
- **I4.** «+ Contexto nuevo» crea uno y llega a él **con el título ya en edición**: escribir y
  Intro le pone el nombre.
- **I5.** La hoja se cierra **sin cambiar nada** con *Cancelar*, con **Escape**, **tocando fuera**
  y con el **atrás** (en Android, el del sistema), y en ningún caso se sale de la app.
- **I6.** Durante el modo selección, el + se apaga como ◀ ▶ y ⚙.

## H. No se pierde nada al salir

- **H1.** Crear una nota y **cerrar la pestaña enseguida**, sin esperar. Al volver a abrir, está.
- **H2.** En el móvil: crear una nota, **cambiar de app**, y cerrar el navegador desde el
  multitarea. Al volver, está.

---

## Hoja de resultados

Una tabla por pasada. En *Resultado*: ✅, ❌ con lo que pasó, o «no se puede probar aquí» y por
qué.

### Pasada 1 — escritorio

| | |
|---|---|
| Fecha | |
| Navegador y versión | |
| Commit (`git log --oneline -1`) | |
| ¿Árbol limpio? (`git status --short` vacío) | |

| Paso | Resultado |
|---|---|
| A1–A4 | |
| B1–B5 | |
| C1–C6 | |
| D1–D6 | |
| E1–E11 | |
| F1–F2 | |
| G1–G2 | |
| H1 | |
| I1–I6 | |

### Pasada 2 — móvil

| | |
|---|---|
| Fecha | |
| Dispositivo, sistema y navegador | |
| Commit | |
| ¿Árbol limpio? | |

| Paso | Resultado |
|---|---|
| A1–A4 | |
| B1–B5 | |
| C1–C6 (C2 con el atrás del sistema) | |
| D1–D6 (D4 y D5 son los que importan aquí) | |
| E1–E11 (E3 y E6 son los que importan aquí) | |
| H2 | |
| I1–I5 (I5 con el atrás del sistema) | |
