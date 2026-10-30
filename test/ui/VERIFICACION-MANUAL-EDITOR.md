# Verificación manual del editor (Fase 4 · Notas)

**Esto no es documentación de diseño: es un procedimiento**, como su vecina
`VERIFICACION-MANUAL.md`, que cubre Fase 4 · Contextos. Es el punto 10 del criterio de cierre de
Fase 4 · Notas.

## Por qué existe

Lo que el editor **decide** está probado en Node, fila a fila contra las tablas del teclado
(`test/ui/editor.test.ts`). Lo que no se puede probar ahí es **el tacto**: que el cursor no salte,
que el teclado del móvil haga lo mismo que el del ordenador, que los botones de la barra no cierren
el teclado. Probando a mano ya salieron dos fallos que ninguna prueba veía: la barra usaba un cursor
viejo, y partir una línea la dejaba con el texto antiguo en pantalla.

## Cuándo hay que volver a pasarla

- antes de cerrar Fase 4 · Notas;
- al tocar `src/ui/NoteEditor.ts`, que es donde viven el teclado y el cursor;
- al probar un navegador o un teclado de móvil nuevos.

**Cada pasada se anota abajo, debajo de la anterior.**

## Reglas al ejecutarla

> **Si algo no se puede provocar en ese navegador, se anota eso mismo.**

> **Se pasa sobre un commit con el árbol limpio**, y se anota el commit.

> **Un comportamiento raro no es un fallo si está anotado abajo como conocido.** Se marca igual,
> pero con un «conocido»: lo que interesa es si se aguanta.

---

## Preparación

La misma que `VERIFICACION-MANUAL.md` (compilar con `npm run build:web`, servir, abrir por
`localhost` o, en el móvil, por la IP). Las secciones J–L usan la consola y sólo se pasan en
escritorio; J necesita abrir la app con **`?depurar`** al final de la dirección.

Para cada sección, una nota nueva con el botón **+** grande vale: nace vacía y se entra en ella.

---

## A. Abrir y salir

- **A1.** Tocar una nota de la lista la abre; **Intro** con el foco en la fila, también.
- **A2.** La cabecera lleva **sólo el título**: ni ◀ ▶ ni ⚙. Tocar el título lo renombra.
- **A3.** Abajo, la barra: **☐ Casilla**, **↳ Anidar** (apagado), **Enlazar…** y **✕ Salir**.
- **A4.** **✕ Salir** y el **atrás** (en Android, el del sistema) vuelven a **la misma ventana**.
- **A5.** Recargar con la nota abierta vuelve a la nota (las capas).

## B. Escribir sin perder nada

- **B1.** En una nota vacía, tocar **en cualquier sitio de la nota** —en «Toca para escribir» o en
  el hueco de debajo, hasta la barra— crea la primera línea y deja el cursor en ella. Igual en una
  ventana de tipo nota.
- **B2.** ⚠️ **La importante: escribir deprisa.** En una casilla **anidada**, escribir dos o tres
  frases largas seguidas, sin parar. El cursor **no salta**, no se pierde ninguna letra y no se
  duplica ninguna. (El guardado va por debajo mientras tanto.)
- **B3.** Recargar: lo escrito está.
- **B4.** **Tab** mete un hueco de tabulación dentro de la línea; no anida nada.
- **B5.** En una nota con líneas, tocar **el hueco de debajo de la última** deja el cursor **al
  final de la última que se ve**, aunque sea una hija anidada; 📱 se abre el teclado. Tocar una
  línea sigue dejando el cursor donde se toca.

## C. Intro

| | Estado | Dónde | Tiene que pasar |
|---|---|---|---|
| **C1** | casilla apagada | al final de un texto **en medio** de la nota | texto nuevo **justo debajo**, no al final de la nota |
| **C2** | casilla apagada | al final de una casilla anidada | texto nuevo debajo de **su casilla de la raíz** |
| **C3** | casilla encendida | al final de un texto | casilla debajo |
| **C4** | casilla encendida | al final de una casilla | casilla hermana, al mismo nivel |
| **C5** | encendida + anidar | al final de una casilla | casilla **hija**, y anidar **se apaga solo** |
| **C6** | encendida + anidar | al final de un texto | casilla hermana, y anidar **sigue armado** |
| **C7** | cualquiera | en medio de una línea | la parte; la mitad de abajo nace de la clase del interruptor |
| **C7b** | casilla apagada | en medio de una casilla **anidada** | la parte; la mitad de abajo sale como **texto** a la raíz, debajo de su casilla de la raíz |
| **C8** | encendida + anidar | en medio de una línea | la parte **sin anidar**, y anidar sigue armado |

## D. Retroceso al principio de una línea

- **D1.** En una **casilla de la raíz**: la primera pulsación **quita el cuadradito**; la segunda
  **une** con la de arriba. El cursor queda en el punto de unión.
- **D2.** En una **casilla anidada**: une directamente, con una sola pulsación.
- **D3.** En la **primera hija**: une con su madre.
- **D4.** Entre **dos textos normales**: une.
- **D4b.** Un texto justo debajo de una casilla **con hijas**: une con **la última hija**, la línea
  que se ve encima, no con la casilla.
- **D5.** En la **primera línea** de la nota, y en una **casilla con hijas**: no hace nada.
- **D6.** En cualquier otro sitio de la línea, borra la letra anterior como siempre.

## E. El interruptor y anidar

- **E1.** Encender **☐ Casilla** con el cursor **al principio** de un texto: la línea entera pasa a
  casilla. **En medio**: se parte y la mitad de abajo es casilla. **Al final**: aparece una casilla
  vacía debajo.
- **E2.** Apagarlo en una casilla de la raíz: vuelve a texto. En una casilla anidada: sigue siendo
  casilla (un texto no cabe ahí), pero el interruptor se apaga.
- **E3.** Con la casilla apagada, **↳ Anidar** está desactivado.
- **E4.** Armado, el botón **se ve distinto** (borde discontinuo) y dice «↳ Anidar armado». ¿Se entiende sin que
  nadie lo explique? *(Anotar la impresión: es una de las tres preguntas del editor, en `TAREAS.md`.)*
- **E5.** Pulsar los botones de la barra **no cambia de línea** el cursor, y en el móvil **no cierra
  el teclado**.

## F. Marcar

- **F1.** Tocar el **☐** marca y desmarca. Una marcada sale tachada.
- **F2.** **Ctrl/Cmd+Intro** con el cursor en una casilla la marca.
- **F3.** Con **Tab** hasta el ☐, **Espacio** lo marca.
- **F4.** Marcar una casilla **no marca a sus hijas**.

## G. Moverse

- **G1.** **↑ ↓** pasan a la línea de arriba o de abajo, conservando la columna si cabe; en una línea
  larga que ocupa varias filas, primero recorren sus filas.
- **G2.** **←** al principio de una línea va al final de la de arriba; **→** al final, al principio
  de la de abajo.

## H. En el móvil *(sólo móvil)*

- **H1.** **Intro del teclado** del móvil hace lo mismo que en C (probar al menos C1, C3 y C5).
- **H2.** **Borrar** del teclado al principio de una línea hace lo mismo que en D1 y D2.
- **H3.** Con el **texto predictivo** o el autocorrector del teclado: escribir y aceptar una
  sugerencia no duplica ni pierde texto.
- **H4.** Tocar una palabra para poner el cursor en medio, y pulsar Intro: la línea se parte ahí.

## I. Ventanas de tipo nota

- **I1.** ⚙ → ⋮ de una ventana → *Añadir detrás* (o la ficha **+**) → en la lista, bajo «Notas:», elegir una nota. Aparece como
  ventana.
- **I2.** En esa ventana: cabecera con **◀ ▶ y ⚙**, el editor debajo y la barra **sin ✕ Salir**.
  Todo lo de B–G funciona igual.
- **I3.** Renombrarla por el título renombra la nota (se ve en el General).
- **I4.** Borrar esa nota desde el General (selección → Borrar): su ventana **desaparece en la
  misma sesión**.

## J. Un «marcar» que no cambia nada no toca la pantalla *(escritorio, con `?depurar`)*

Con una nota abierta que tenga una casilla **marcada en la raíz** (no anidada), en la consola:

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

- **J1.** `setChecked` devuelve `null`, y a los 700 ms dice **`cambios en pantalla: 0`**.

## K. El aviso de que no se guarda *(escritorio)*

- **K1.** En la consola:

  ```js
  Storage.prototype.setItem = function () { throw new DOMException("lleno", "QuotaExceededError") }
  ```

  y escribir algo en una nota. Al poco sale arriba, en rojo, **«No se están guardando los
  cambios»**, con el motivo. La app sigue funcionando.
- **K2.** Recargar: lo escrito después del aviso **no está** (es lo que el aviso dice), y lo de
  antes sí.

## L. Una nota con forma rota *(escritorio)*

- **L1.** En la consola, una nota que es JSON válido pero no es una nota:

  ```js
  localStorage.setItem("elnotas:blob:notes/rara.json", btoa(JSON.stringify({ id: "rara", name: "Rara", updatedAt: 0, revision: "r", content: "no es una lista" })))
  ```

  y recargar. La app arranca con el aviso que nombra `notes/rara.json`.
- **L2.** Quitarla (`localStorage.removeItem("elnotas:blob:notes/rara.json")`) y recargar.

---

## M. Seleccionar y copiar

Con una nota de un texto, una línea vacía, una casilla marcada con dos hijas, y otro texto. (Desde
la Fase 10 las líneas que no se escriben se ven **formateadas**, sección N: lo copiado ya no lleva
las marcas de formato.)

- **M1.** Al abrir la nota, **ninguna línea tiene cursor**. Tocar en medio de una palabra pone el
  cursor **donde se tocó**, y sólo esa línea se edita. *(Con la consola.)*
  `document.querySelectorAll("[contenteditable]").length` vale **1**.
- **M2.** *(Escritorio.)* Arrastrar desde la mitad de la primera línea hasta la mitad de una hija:
  la selección va **de corrido**, cruzando la casilla, en **vídeo inverso** (también sobre texto
  formateado). ⚠️ Hacia arriba
  igual, y **la línea vacía también se pinta**: un hueco ahí era el fallo de la pasada 4.
- **M3.** ⚠️ Copiar (Ctrl/Cmd + C) y pegarlo **fuera de la app**, en un editor de texto: **una
  línea por renglón**, sin ✓ ni renglones vacíos de más, la primera y la última cortadas donde
  empezaba y acababa la selección. **Sin marcas de formato**: si alguna línea lleva `**negrita**`
  o un enlace, sale su texto sin `**` ni `[](…)`. (Con la consola se puede lanzar el `copy` y leer
  el resultado, como en la pasada 3.)
- **M4.** *(Móvil.)* ⚠️ **Pulsación larga** en una palabra de una línea que no se está
  escribiendo: sale la selección del sistema, con sus **asas**, que **cruzan líneas**. *Copiar*,
  en su menú, copia como en M3.
- **M5.** Con algo seleccionado, **un toque sin arrastrar** en una línea la hace editable con el
  cursor ahí, y la selección se va. ⚠️ También tocando **encima** de lo seleccionado.
- **M6.** Intro, Retroceso al principio y las flechas, como en C, D y G: **la que se edita pasa a
  ser la línea a la que va el cursor**, y la anterior deja de serlo.

## N. Formato de las líneas

Las líneas que **no se escriben** se ven formateadas; **la activa, en crudo**. Con una nota nueva
y, en cada línea, uno de estos textos (la consola es la de la sección M):

```
una **negrita** y una *cursiva* y \*suelta\*
# Un título
mira [la web](https://example.com) o www.example.com.
**sin cerrar y *esta tampoco
```

- **N1.** Al abrir la nota, ninguna línea está activa y todas se ven formateadas: la **negrita**
  con **más brillo**, la *cursiva* inclinada, **sin ver los `**` ni los `*`**; el título
  (`# `) con una **raya debajo** y **sin letra mayor** que las demás ni el `# `; los enlaces
  **subrayados** y sin los corchetes ni el paréntesis.
- **N2.** `www.example.com.` se detecta **solo** como enlace, **sin el punto final** (el punto
  queda fuera del subrayado).
- **N3.** Con `\*suelta\*` se ve `*suelta*`, con los asteriscos, **sin cursiva**: la barra invertida
  escribe la marca literal y no se ve. Una marca **sin cerrar** (`**sin cerrar y *esta tampoco`) se
  ve **como texto**, con sus asteriscos.
- **N4.** Tocar la línea la **activa en crudo**: salen todas las marcas (`**`, `[`, `](…)`, la
  barra, el `# `), sin formato. Tocar **otra** línea la devuelve a formateada, y la nueva pasa a
  crudo.
- **N5.** ⚠️ Un toque **en medio de una palabra formateada** (dentro de la negrita, de un enlace)
  deja el cursor **en su sitio del texto crudo**, sobre la misma letra que se tocó, **aunque haya
  marcas delante** (escribir una letra la pone ahí). En el **borde** de un enlace o de una negrita
  cae **a la izquierda de las marcas**. Tocar al principio de un título lo deja tras el `# `.
- **N6.** Tocar **el hueco bajo la última línea** deja el cursor **al final de la última, en
  crudo**, aunque estuviera formateada (como B5).
- **N7.** `document.querySelectorAll("[contenteditable]").length` sigue valiendo **1**: sólo la
  activa es editable (como M1).
- **N8.** ⚠️ Seleccionar con el ratón desde la mitad de una línea formateada hasta la mitad de otra
  y **copiar**: sale **texto plano sin marcas** (sin `**`, `*`, `# ` ni `[](…)`; un enlace, **como
  su texto**), una línea por renglón. Si la selección incluye **la línea activa**, ésa sale **en
  crudo**. *(Con un `copy` lanzado desde la consola; pegarlo fuera de la app, el usuario.)*
- **N9.** Escribir en la línea activa una marca cerrada (`*x*`) no la formatea **hasta que se
  deja**; al tocar otra línea se ve formateada.

## O. Burbuja y enlaces

Con una nota con un enlace **a la web** (`[la web](https://example.com)`), una dirección suelta
(`www.example.com`), un enlace **a otra nota** (`[la otra](#id)`, que se crea con P) y uno a un
diagrama.

- **O1.** Con el cursor **estrictamente dentro** de un enlace guardado (no en el borde) sale, **bajo
  la línea**, la burbuja con **«↗ Abrir»**, **«Cambiar»** y **«Quitar»**. En una **dirección suelta**,
  sólo **«↗ Abrir»**. Fuera del enlace, o en el borde, **se va**.
- **O2.** Mover el cursor con **← →** a través del enlace la saca y la esconde; tocar otra línea la
  esconde.
- **O3.** ⚠️ Pulsar un botón de la burbuja **no quita el foco ni mueve el cursor** (en el móvil, el
  teclado no se cierra). *(Móvil, el teclado.)*
- **O4.** «↗ Abrir» en un enlace **web** abre una pestaña nueva. *(En el panel se simula:
  registrando `window.open`; se apunta como 🔁.)*
- **O5.** «↗ Abrir» en un enlace **a una nota** o **a un diagrama** lo abre **apilado encima**; el
  **atrás** (o ✕ Salir) vuelve a la nota de antes, con la burbuja escondida.
- **O6.** Desde esa nota, abrir **otra más** (que tenga un enlace). El atrás las deshace **una a
  una** (Q1).
- **O7.** ⚠️ **Recargar con la cadena abierta restaura toda la cadena**: las mismas capas, en el
  mismo orden (como en `VERIFICACION-MANUAL-CAPAS.md`); el atrás sigue deshaciéndolas.
- **O8.** Un enlace a algo **borrado** (la nota o el diagrama ya no están) se ve **apagado**, con el
  color `--dim`, **sin** «(perdido)» ni texto añadido. Con el cursor dentro, la burbuja **sigue
  saliendo**; **«Abrir»** muestra durante ~1,5 s **«El enlace ya no existe»** y **no apila nada**.
- **O9.** Con la nota abierta, **borrar el destino** (por la consola, `useCases` con `?depurar`, o
  desde otra ventana del navegador) **apaga el enlace al momento**, sin recargar.
- **O10.** ⚠️ Un enlace a un **contexto** escrito a mano (`[x](#id-de-un-contexto)`) se ve **como
  roto** (apagado, «El enlace ya no existe»): por ahora no se enlazan.
- **O11.** **«Quitar»** deja el texto sin marcas (`[la web](https://…)` pasa a `la web`) y el
  **cursor justo tras él**, en la línea activa y en crudo; una dirección suelta no lo lleva.

## P. «Enlazar…» y «Cambiar»

- **P1.** En la barra de la nota, **«Enlazar…»** va **tras «↳ Anidar»**. En una ventana de tipo nota
  (I2) también.
- **P2.** Al pulsarlo sale una **hoja** con un campo **«Pega una dirección»** y las listas
  **«Notas»** y **«Diagramas»**, por nombre: **sin la nota actual** y **sin contextos**. Sin
  diagramas, no sale la lista de diagramas.
- **P3.** Elegir una **nota**, con el cursor en una línea **sin selección**: se escribe
  `[nombre de la nota](#id)` **donde estaba el cursor**.
- **P4.** Con una **selección** dentro de la línea: el enlace lleva **el texto seleccionado**
  (`[lo seleccionado](#id)`), que sustituye a la selección.
- **P5.** ⚠️ Si la selección lleva **`[` o `]`**, no sirve de texto: se usa **el nombre** de la
  nota y el enlace va **tras** la selección, sin borrarla.
- **P6.** Elegir un **diagrama**: igual que P3 y P4.
- **P7.** Escribir una **dirección** (`https://example.com`) **con selección**: `[texto](dirección)`;
  **sin selección**: la dirección **sola**, sin corchetes. Se acepta con Intro o con «Enlazar».
- **P8.** Una dirección **inválida** (`example`, o vacía) **marca el campo** en rojo y **no inserta**
  nada; seguir escribiendo quita la marca.
- **P9.** **Cancelar** (o el **atrás**) cierra la hoja y **no toca la línea**.
- **P10.** Al insertar, el **cursor queda tras lo insertado**, la línea queda **activa en crudo** y
  tiene el foco.
- **P11.** **«Cambiar»** en la burbuja de un enlace guardado: abre la hoja («Cambiar enlace»).
  Elegir **otra nota** o **pegar una dirección** cambia **sólo el destino**: el **texto** del enlace
  se queda; el cursor queda tras el enlace.
- **P12.** ⚠️ «Cambiar» a una dirección que lleva **`)`** avisa **«Esa dirección no se puede
  enlazar»** (~1,5 s) y **no cambia nada**.
- **P13.** ⚠️ Un enlace de la línea cuyo texto lleva `*` o `[` queda bien escapado
  (`[a\*b](#id)`) y se ve `a*b`.
- **P14.** *(Móvil.)* La hoja **se desplaza** si la lista es larga, y el **teclado no sale solo**
  al abrirla.

## Q. Capas en cadena y el atrás

- **Q1.** Nota A → su enlace a la nota B → desde B, el enlace a un diagrama: tres capas. El
  **atrás** (o ✕ Salir) las cierra **de una en una**, **diagrama, B, A**, y la última vuelve a la
  ventana. Ninguna burbuja queda colgada al volver.
- **Q2.** En mitad de la cadena, recargar (O7) y luego el atrás: igual.

## R. El enlace como bloque en la línea activa *(Fase 10, 6f)*

En la línea **activa**, un enlace **guardado** (`[texto](destino)`) ya no se ve en Markdown: es un
**bloque** con su texto. Lo guardado en la nota **sigue siendo la cadena Markdown**. Esta sección
**sustituye** lo que decían N4, N5, O1, O2, O11, P3, P4, P7 y P11 de los enlaces en la línea activa
(el resto de esos pasos sigue valiendo). Con una nota con, al menos, otra nota y un diagrama a los
que enlazar, y una línea `ve a [la otra](#id-de-otra-nota) y mira www.example.com ya` (`id` real,
con `?depurar`: `window.elnotas.store`).

- **R1.** Tocar esa línea la activa: `[la otra](#…)` se ve **como un bloque subrayado con su texto
  («la otra»), sin corchetes ni destino**; el resto, **en crudo** (`www.example.com` completa,
  `**` con sus asteriscos). `document.querySelectorAll(".texto .md-enlace[contenteditable=false]")`
  da **uno** y su `data-raw` es el Markdown entero. Un enlace a algo **borrado** lleva además
  `md-roto` (apagado).
- **R2.** ⚠️ **Tocar el bloque** deja el cursor **justo después** de él y sale **su burbuja**
  («↗ Abrir», «Cambiar», «Quitar»), **bajo el bloque**. Tocar un enlace de una línea **formateada**
  (que se activa) hace lo mismo con **ese** enlace, también si hay **varios** en la línea. El
  cursor **nunca** queda dentro del bloque.
- **R3.** La burbuja **se va** al teclear, al mover el cursor con ← → lejos del bloque, al tocar
  otra línea o al apagarse la línea. Con el cursor **dentro** de la dirección suelta
  (`www.example.com`), sale la burbuja con sólo «↗ Abrir», como antes.
- **R4.** ⚠️ **Retroceso** con el cursor **justo tras** el bloque lo borra **entero** (de una
  pulsación) y el cursor queda donde estaba; **Suprimir** con el cursor **justo antes** de un
  bloque, igual. La nota deja de llevar el Markdown de ese enlace (`document.querySelector(…)` o
  recargar). Con un enlace **pegado a otro**, cada tecla quita el suyo.
- **R5.** ⚠️ **Escribir pegado al bloque** (antes, después, entre dos bloques, con el bloque al
  principio o al final de la línea, sin texto al lado) mete el texto **fuera** del bloque, **no
  pierde el cursor** y el bloque **no cambia**. Tabulador, Intro y las flechas funcionan con la
  línea con bloques (Intro parte la línea sin romper el enlace; ← → saltan el bloque de un paso).
- **R6.** **Seleccionar y copiar** dentro de la línea activa, abarcando un bloque, copia **su
  texto** (sin Markdown). *(Con un `copy` lanzado desde la consola.)*
- **R7.** **«Enlazar…»** abre la hoja con un campo **«Texto del enlace»** encima del de la
  dirección. Con **texto seleccionado** que sirve, el campo **lo lleva**; sin selección, **vacío**.
  Elegir una nota con el campo **vacío** da `[nombre de la nota](#id)`; con texto escrito,
  `[ese texto](#id)`. Pegar una dirección con el campo vacío da `[host](dirección)` (el dominio sin
  `www.` ni ruta, p. ej. `example.com`); con texto, `[ese texto](dirección)`. Intro en el campo del
  texto pasa al de la dirección. El enlace nuevo **se ve como bloque**, con el cursor tras él.
- **R8.** Una dirección con `)` pegada en «Enlazar…» avisa **«Esa dirección no se puede
  enlazar»** (~1,5 s) y **no inserta nada**.
- **R9.** **«Cambiar»** abre la hoja con el campo del texto **relleno con el texto actual** (y, si
  era un enlace web, la dirección). Cambiar **sólo el texto**, eligiendo la misma nota, reescribe el
  texto; cambiar **sólo el destino** (dejando el texto), también; los dos, igual. Texto en blanco:
  el de por defecto (R7). Tras cambiar, el cursor queda **tras el bloque** nuevo. Un destino con `)`
  avisa como R8 y no cambia nada.
- **R10.** ⚠️ **Recargar** la nota: la línea sigue llevando el enlace, **formateado** (subrayado,
  con su texto) y, al activarla, **de nuevo como bloque**; el Markdown de la nota es el escrito
  (`store.getState()` con `?depurar`).

## S. Las marcas de negrita y cursiva, escondidas en la línea activa *(Fase 10, 6g)*

En la línea **activa**, las marcas `*` y `**` **no se ven** salvo con el cursor **dentro de la
palabra con formato o pegado a ella** (dentro del intervalo cerrado del par, marcas incluidas); la
palabra, mientras, ya se ve en negrita o cursiva. Las marcas siguen siendo **texto real** (escondido
por CSS): lo guardado es Markdown y las posiciones no cambian. Esto **sustituye** lo que R1 decía del
`**` «con sus asteriscos». Con `?depurar`, `document.querySelectorAll(".texto .md-marca")` da las
marcas y `md-viva` marca las que se ven.

- **S1.** Escribir `hola **mundo** y *cursiva* fin` y llevar el cursor **fuera** de las dos
  palabras: la línea activa muestra `hola mundo y cursiva fin`, «mundo» en **negrita** y «cursiva» en
  *cursiva*, **sin ningún asterisco**.
- **S2.** El cursor **dentro** de «mundo», o **pegado** a él por cualquier lado, **revela sus `**`**
  (atenuados) y **sólo los suyos**; los de «cursiva» siguen escondidos. Moverlo fuera (con el dedo, el
  ratón o las flechas) los esconde de nuevo. El cursor **nunca** se ve atascado en un hueco ni
  necesita una pulsación de más para cruzar una marca escondida.
- **S3.** ⚠️ Teclear el `*` que **cierra** un par (`hola *a` y luego `*`) lo convierte en cursiva **en
  el momento**, y el cursor **no salta**: lo siguiente que se teclee sale pegado tras la marca de
  cierre. Igual con `**` (dos pulsaciones) y con la marca de apertura escrita **después** de la de
  cierre.
- **S4.** ⚠️ Con el cursor pegado a una marca revelada, **Retroceso** la borra de a una y **deshace el
  par**: la palabra vuelve a texto normal, con el asterisco que quedaba a la vista como texto. Suprimir,
  igual por el otro lado. Escribir **dentro** de la palabra con formato **no cambia nada** más que el
  texto.
- **S5.** Anidados: `***a***` y `**a *b* c**`. Con el cursor dentro de «b» se ven las marcas de **los
  dos** pares que lo contienen; dentro de «a» (en el segundo), sólo las del par de fuera. Fuera de
  todos, ninguna.
- **S6.** **Escribir seguido** (palabras, espacios, signos) a lo largo de una línea con formato, y con
  **enlaces guardados** en la misma línea (bloques de R): el texto sale donde se espera, el bloque no
  cambia, el cursor no salta y Intro parte la línea con el Markdown **crudo** correcto (con sus `*`
  aunque estuvieran escondidos).
- **S7.** ⚠️ **Recargar** la nota: lo guardado es el Markdown escrito (`window.elnotas.store`, con
  `?depurar`), asteriscos incluidos; la línea formateada se ve como en N, y al activarla vuelve a
  esconder las marcas.
- **S8.** `# título con **negrita**`: el `# ` **se ve** (no es una marca de énfasis) y la negrita
  esconde sus `**` como en S1. Una barra `\` también se ve.
- **S9.** *(móvil, el usuario)* **Teclear y autocorrección** en una línea con formato: el teclado **no
  se cierra**, el cursor **no salta** ni siquiera al cerrar un par con `*`, y aceptar una sugerencia
  junto a una palabra con formato deja el texto bien. Copiar una selección **dentro** de la línea
  activa (con marcas) copia **el Markdown**, asteriscos incluidos (a decidir si se aguanta).

## T. Enlaces a eventos y rutinas, y la casilla-atajo *(Fase 10, tareas 9 y 10)*

Con la hora de hoy en el calendario: un evento (`Dentista`, 10:30), una rutina (`Leer`) y una nota con
tres líneas: texto con `[Dentista](#id-del-evento)`; una **casilla** con sólo `[Leer](#id-de-la-rutina)`;
otra casilla con `hoy [Leer](#id-de-la-rutina)`; y una línea de texto con `[Leer](#id-de-la-rutina)`.

- **T1.** «Enlazar…» (y «Cambiar») ofrece, además de notas y diagramas, **«Eventos»** (con su día y
  hora delante, los de hoy en adelante primero y luego los pasados) y **«Rutinas»** (las no
  archivadas). Un grupo vacío no sale.
- **T2.** «↗ Abrir» en el enlace al **evento** abre el **calendario encima**, en el mes del evento y con
  **su hoja de edición** abierta. El atrás cierra la hoja, otro atrás el calendario y otro vuelve a la
  nota.
- **T3.** «↗ Abrir» en el enlace a la **rutina** de una línea normal abre el calendario en la pestaña
  **Rutinas** con **esa fila tocada**.
- **T4.** La casilla cuyo texto es **sólo** el enlace a la rutina se ve **desmarcada**; pulsarla marca
  **hoy** en la rutina (la fila del calendario lo muestra) y la casilla se ve **marcada**; pulsarla
  otra vez lo quita. El `checked` de la línea **no cambia**.
- **T5.** Con la rutina marcada hoy, otra casilla de la misma nota (`hoy [Leer](…)`, con texto al
  lado) **no se ve marcada** y se marca sola, como una normal.
- **T6.** Marcar o desmarcar **desde el calendario** actualiza la casilla-atajo al momento. Al día
  siguiente (cambiando «hoy» o los días de la rutina) sale sin marcar.
- **T7.** Borrar la rutina o el evento: sus enlaces se ven **apagados**, «Abrir» dice «El enlace ya no
  existe» y la casilla-atajo es una **casilla normal**.

## Comportamientos conocidos

No son fallos; se anotan para que no se marquen como tales, y para decidir si se aguantan:

- **Varias «Nueva Nota» iguales** en el selector de ventanas: toda nota nace con ese nombre. Es
  decisión (2026-09-29): pueden existir notas con el mismo nombre; lo que las distingue es su id.
- **Una línea en el nivel equivocado se borra y se reescribe**: no hay `indent` ni `outdent`. Y
  **no se puede reordenar**: no hay `move`. Las dos cosas son preguntas del editor, en `TAREAS.md`.
- **Una selección que empieza en la línea que se está escribiendo no sale de ella**: el navegador
  no deja que salga de un campo editable. Para seleccionar varias, se empieza en otra línea.
- **La burbuja del enlace flota bajo la línea activa y puede tapar la siguiente.** Decisión del
  usuario (2026-10-25): se queda así; en el móvil se mira con el dedo (se aparta tocando otra
  parte).
- **Una dirección insertada pegada a texto sin espacio lo absorbe**: junto a una palabra, la
  dirección se lee como parte de ella y puede dejar de verse como enlace. Se escribe con un espacio.
- **Una línea activa que pierde el foco sigue en crudo y editable** hasta que se toca otra línea
  (por ejemplo, al abrir la hoja de «Enlazar…»).

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
| A1–A5 | |
| B1–B5 (**B2**) | |
| C1–C8 | |
| D1–D6 | |
| E1–E5 | |
| F1–F4 | |
| G1–G2 | |
| I1–I4 | |
| J1 | |
| K1–K2 | |
| L1–L2 | |

### Pasada 2 — móvil

| | |
|---|---|
| Fecha | |
| Dispositivo, sistema, navegador y teclado | |
| Commit | |
| ¿Árbol limpio? | |

| Paso | Resultado |
|---|---|
| A1–A5 (A4 con el atrás del sistema) | |
| B1–B3 (**B2**) | |
| C1, C3, C5, C7 | |
| D1–D2 | |
| E1, E5 | |
| F1, F4 | |
| H1–H4 | |
| I1–I4 | |

### Pasada 3 — escritorio, sólo M (seleccionar y copiar, Fase 10)

| | |
|---|---|
| Fecha | 2026-10-24 |
| Navegador y versión | Chrome 152, el navegador del panel (Claude/3.1623.0) |
| Quién | Claude, en el panel |
| Commit | `17ddeb6`; pasada sobre el mismo código, justo antes de comitearlo |
| Origen | `localhost:8001`, con la nota de M |

| Paso | Resultado |
|---|---|
| M1 | ✅ — una sola línea editable, y el cursor donde se toca |
| M2 | ✅ |
| M3 | ✅ con un `copy` lanzado desde la consola: «ro del día\nCompra\nLeche\nPa». ⏭ pegarlo fuera de la app, el usuario |
| M4 | ⏭ móvil, el usuario |
| M5 | ✅ |
| M6 | ✅ — Retroceso, ↓, Intro y juntar líneas |

Notas: un arrastre entre líneas soltaba un clic en el hueco que llevaba el cursor a la última
línea y perdía la selección; arreglado antes del commit.

### Pasada 4 — escritorio, sólo M2 y M5 (tras el aviso del usuario)

| | |
|---|---|
| Fecha | 2026-10-24 |
| Navegador y versión | Chrome 152, el navegador del panel (Claude/3.1623.0) |
| Quién | Claude, en el panel |
| Commit | el siguiente a `82ca056`; pasada sobre el mismo código, justo antes de comitearlo |
| Origen | `localhost:8001`, con la nota de M |

| Paso | Resultado |
|---|---|
| M2 | ❌ → ✅ — el usuario vio la selección cortada en una línea vacía: no tenía nada que pintar y quedaba un hueco. Ahora lleva un `<br>` y se pinta; la copia ya salía entera |
| M5 | ❌ → ✅ — tocar encima de la selección no activaba la línea: el navegador la quita después del `click`. Ahora cuenta lo que se movió el puntero |

Notas: la pasada 3 dio M5 por bueno tocando fuera de la selección. Escribir en una línea vacía,
partirla con Intro y juntarla con Retroceso siguen igual. ⏭ en el móvil, el usuario.

### Pasada 5 — escritorio, N–Q (Markdown en pantalla y enlaces, Fase 10)

| | |
|---|---|
| Fecha | 2026-10-25 |
| Navegador y versión | Chrome 152, el navegador del panel (Claude/3.1623.0) |
| Quién | Claude, en el panel |
| Commit | `225385d`, árbol limpio de código |
| Origen | `localhost:8001`, con notas y un diagrama de prueba, borrados al acabar |

| Paso | Resultado |
|---|---|
| N1–N7 | ✅ |
| N8 | ✅ con un `copy` lanzado desde la consola (sin marcas de formato). ⏭ pegarlo fuera de la app, el usuario |
| N9 | ✅ |
| O1, O2 | ✅ |
| O3 | ✅ con el ratón. ⏭ el teclado del móvil, el usuario |
| O4 | 🔁 con `window.open` simulado: se comprobó que se llama con la dirección, sin abrir nada |
| O5–O11 | ✅ |
| P1–P6 | ✅ |
| P7 | ✅ — sin selección, una dirección pegada a texto sin espacio sale como «textowww.example.net»: es el comportamiento conocido, no un fallo |
| P8 | ✅ |
| P9 | ✅ — Cancelar y el atrás cierran la hoja sin tocar la línea |
| P10 | ✅ |
| P11 | ✅ — a otra nota y a una dirección: el texto se queda y el cursor queda tras el enlace |
| P12 | ✅ — avisa y desaparece a los ~1,5 s; la línea no cambia |
| P13 | ✅ |
| P14 | ⏭ móvil, el usuario |
| Q1, Q2 | ✅ |

Notas: «Enlazar…» (no «Cambiar») con una dirección que lleva `)` y sin selección la inserta tal
cual, sin corchetes (P7); sólo «Cambiar» avisa. L7 (reordenar) y I y J del lienzo se anotan en
sus listas.

### Pasada 6 — móvil, M4 y N–Q

| | |
|---|---|
| Fecha | |
| Navegador y versión | |
| Quién | |
| Commit | |
| Origen | |

| Paso | Resultado |
|---|---|
| M4 | |
| N1–N7 | |
| N8 (pegar fuera de la app) | |
| O1–O3, O5–O8 | |
| O4 (abrir una dirección en el móvil) | |
| P1–P13 | |
| P14 | |
| Q1, Q2 | |

Notas:

### Pasada 7 — escritorio y móvil, R (el enlace como bloque, Fase 10)

| | |
|---|---|
| Fecha | 2026-10-27 |
| Navegador y versión | Chrome, el navegador del panel (escritorio) |
| Quién | Claude, en el panel; el móvil, el usuario |
| Commit | `9f86d3c` más los cambios de la 6f-2 sin comitear (el commit de la pieza los recoge) |
| Origen | `localhost:8001`, con la nota de prueba «Nueva Nota» |

| Paso | Resultado |
|---|---|
| R1, R2 | ✅ un clic real sobre el bloque lo deja tras él y saca «↗ Abrir», «Cambiar» y «Quitar»; `data-raw` lleva el Markdown. Varios enlaces en la línea: sin probar |
| R3 | ⏭ sin pasar |
| R4 | ✅ Retroceso tras el bloque y Suprimir antes de él lo quitan entero, de una pulsación. Dos enlaces pegados: sin probar |
| R5 | ✅ escribir tras el bloque lo deja fuera de él. Antes, entre dos y bloque solo: sin probar |
| R6 | ⏭ sin pasar |
| R7, R8 | ✅ R7: con selección el campo «Texto» la lleva; una dirección con texto da `[Wikipedia](https://es.wikipedia.org)`; una nota elegida con texto seleccionado da `[mira](#id)`. ⏭ texto vacío (dominio o nombre) y R8, sin pasar |
| R9 | ✅ «Cambiar» abre con el texto actual; cambiar texto y destino a la vez reescribe el enlace. «Quitar» deja el texto. ⏭ sólo texto, sólo destino, destino con `)` |
| R10 | ⏭ sin pasar |

Notas: al seleccionar una dirección y pulsar «Enlazar…», el campo «Texto» se rellena con la propia
dirección en vez de con el dominio; a decidir con el usuario. Móvil: el usuario, otro día.

### Pasada 8 — escritorio y móvil, S (las marcas escondidas, Fase 10)

| | |
|---|---|
| Fecha | 2026-10-27 |
| Navegador y versión | Chrome, el navegador del panel (escritorio) |
| Quién | Claude, en el panel; el móvil, el usuario |
| Commit | `7d84b31` más los cambios de la 6g-2 sin comitear (el commit de la pieza los recoge) |
| Origen | `localhost:8001`, con la nota de prueba «Nueva Nota» |

| Paso | Resultado |
|---|---|
| S1, S2 | ✅ `hola **mundo** y *cursiva* fin`: sin asteriscos al activar; con el cursor en «mundo» salen sus `**` atenuados y sólo los suyos; con el cursor al final de `**mundo**` siguen; un paso más allá se esconden |
| S3 | ✅ teclear `**nuevo*` deja la cursiva de `*nuevo*`; el `*` que cierra lo pasa a negrita al momento, el cursor queda al final y lo que se escribe después va a su sitio |
| S4 | ✅ Retroceso sobre una marca revelada borra un asterisco y el par se deshace |
| S5 | ⏭ `***a***` y `**a *b* c**`: el reparto de marcas sale bien en lo puro; en pantalla, sin pasar |
| S6, S8 | ⏭ sin pasar |
| S7 | ✅ lo guardado es el Markdown escrito (`hola **mundo** y *cursiva* fin **nuevo** z`); recargar, sin pasar |
| S9 (móvil) | ⏭ el usuario |

Notas: el CSS se carga desde `src/ui/styles/` y el navegador lo guarda en caché: recargar a fondo
con las herramientas de desarrollo abiertas. Copiar dentro de la línea activa, con asteriscos
escondidos, a decidir.

### Pasada 9 — escritorio, lo que faltaba de R y S (Fase 10)

| | |
|---|---|
| Fecha | 2026-10-28 |
| Navegador y versión | Chrome 152, el navegador del panel (`Claude/3.1623.0`, Linux) |
| Quién | Claude, en el panel; el móvil, el usuario |
| Commit | `6af8356`, árbol sin cambios en `src/` |
| Origen | `localhost:8001`, con `?depurar` y la nota «Pruebas R» |

| Paso | Resultado |
|---|---|
| R1 | ✅ un solo bloque con `data-raw` el Markdown entero; un enlace a algo borrado lleva `md-roto` (apagado) |
| R3 | ✅ la burbuja se oculta al llevar el cursor lejos del bloque; con el cursor dentro de `www.example.com` sale sólo «↗ Abrir» (Cambiar y Quitar, ocultos) |
| R6 | ✅ seleccionando toda la línea activa con un bloque, la selección da su texto visible, sin Markdown del enlace. 🔁 simulado: el portapapeles no se lee desde la página; se mira `getSelection().toString()`, que es lo que copia el navegador |
| R10 | ✅ tras recargar la línea sale formateada (subrayada, con su texto) y, al activarla, de nuevo con el bloque; el Markdown de la nota no cambia |
| S5 | ✅ `***a***`: dentro de «a», las cuatro marcas; fuera, ninguna. `**a *b* c**`: dentro de «b», las de los dos pares; dentro de «a», sólo las de fuera |
| S6 | ✅ teclear seguido tras un bloque y una negrita deja el texto en su sitio y el bloque intacto; Intro parte la línea y el Markdown crudo queda con sus `*` (`*` y `*a *b* c** fin`) |
| S8 | ✅ `# título con **negrita** y \\ barra`: el `# ` y las barras se ven; los `**` se esconden |

Notas: R3 «se va al teclear» sólo se probó con el cursor dentro de una dirección suelta, donde la
burbuja se queda (correcto, el cursor sigue dentro). Sin probar todavía: varios enlaces pegados con
Retroceso, R5 entre dos bloques, R7 con texto vacío, R8 y R9 por separado. Copiar dentro de la
línea activa **sí** saca los `**` escondidos (`getSelection().toString()` los incluye): es la duda
ya apuntada en *A decidir*. Móvil: el usuario.
