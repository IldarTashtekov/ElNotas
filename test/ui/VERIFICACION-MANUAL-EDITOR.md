# Verificación manual del editor (Fase 4 · Notas)

**Esto no es documentación de diseño: es un procedimiento**, como su vecina
`VERIFICACION-MANUAL.md`, que cubre Fase 4 · Contextos. Es el punto 10 del criterio de cierre de
Fase 4 · Notas (`ARCHITECTURE.md` §9.10).

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

Para cada sección, una nota nueva con **+ Nota** vale: nace vacía y se entra en ella.

---

## A. Abrir y salir

- **A1.** Tocar una nota de la lista la abre; **Intro** con el foco en la fila, también.
- **A2.** La cabecera lleva **sólo el título**: ni ◀ ▶ ni ⚙. Tocar el título lo renombra.
- **A3.** Abajo, la barra: **☐ Casilla**, **↳ Anidar** (apagado) y **✕ Salir**.
- **A4.** **✕ Salir** y el **atrás** (en Android, el del sistema) vuelven a **la misma ventana**.
- **A5.** Recargar con la nota abierta deja en la ventana, no en la nota.

## B. Escribir sin perder nada

- **B1.** En una nota vacía, «Toca aquí para escribir» crea la primera línea y deja el cursor en
  ella.
- **B2.** ⚠️ **La importante: escribir deprisa.** En una casilla **anidada**, escribir dos o tres
  frases largas seguidas, sin parar. El cursor **no salta**, no se pierde ninguna letra y no se
  duplica ninguna. (El guardado va por debajo mientras tanto.)
- **B3.** Recargar: lo escrito está.
- **B4.** **Tab** mete un hueco de tabulación dentro de la línea; no anida nada.

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
| **C8** | encendida + anidar | en medio de una línea | la parte **sin anidar**, y anidar sigue armado |

## D. Retroceso al principio de una línea

- **D1.** En una **casilla de la raíz**: la primera pulsación **quita el cuadradito**; la segunda
  **une** con la de arriba. El cursor queda en el punto de unión.
- **D2.** En una **casilla anidada**: une directamente, con una sola pulsación.
- **D3.** En la **primera hija**: une con su madre.
- **D4.** Entre **dos textos normales**: une.
- **D5.** En la **primera línea** de la nota, y en una **casilla con hijas**: no hace nada.
- **D6.** En cualquier otro sitio de la línea, borra la letra anterior como siempre.

## E. El interruptor y anidar

- **E1.** Encender **☐ Casilla** con el cursor **al principio** de un texto: la línea entera pasa a
  casilla. **En medio**: se parte y la mitad de abajo es casilla. **Al final**: aparece una casilla
  vacía debajo.
- **E2.** Apagarlo en una casilla de la raíz: vuelve a texto. En una casilla anidada: sigue siendo
  casilla (un texto no cabe ahí), pero el interruptor se apaga.
- **E3.** Con la casilla apagada, **↳ Anidar** está desactivado.
- **E4.** Armado, el botón **se ve distinto** y dice «la próxima, dentro». ¿Se entiende sin que
  nadie lo explique? *(Anotar la impresión: es una de las tres preguntas del punto 11.)*
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

- **I1.** ⚙ → *Añadir detrás* → en el selector, bajo «Notas:», elegir una nota. Aparece como
  ventana.
- **I2.** En esa ventana: cabecera con **◀ ▶ y ⚙**, el editor debajo y la barra **sin ✕ Salir**.
  Todo lo de B–G funciona igual.
- **I3.** Renombrarla por el título renombra la nota (se ve en el General).
- **I4.** Borrar esa nota desde el General (selección → 🗑 Borrar): su ventana **desaparece en la
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

## Comportamientos conocidos

No son fallos; se anotan para que no se marquen como tales, y para decidir si se aguantan:

- **Retroceso bajo una casilla con hijas.** Al principio de un texto que va justo debajo de una
  casilla **con hijas**, Retroceso une el texto a **esa casilla**, no a su última hija —aunque la
  línea que se ve encima sea la hija—. Es la regla de `merge`.
- **Varias «Nueva Nota» iguales** en el selector de ventanas: toda nota nace con ese nombre.
- **Una línea en el nivel equivocado se borra y se reescribe**: no hay `indent` ni `outdent`. Y
  **no se puede reordenar**: no hay `move`. Las dos cosas son preguntas del punto 11.

---

## Hoja de resultados

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
| B1–B4 (**B2**) | |
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
