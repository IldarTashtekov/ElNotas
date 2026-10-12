# Verificación manual de las relaciones (Fase 5 · Relaciones)

**Esto no es documentación de diseño: es un procedimiento**, como sus vecinas. Pasarla en
escritorio **y** en el móvil es el criterio de cierre de Fase 5 · Relaciones (`ARCHITECTURE.md`
§9.11). Se pasa **en la misma sentada** que `VERIFICACION-MANUAL-LIENZO.md` y que la deuda
móvil de la Fase 4: decisión del usuario del 2026-10-04.

## Por qué existe

Dónde se dibuja cada línea está probado en Node: el corte con el borde del pósit, el abanico de
curvas, el punto medio y el texto que no sale boca abajo (`test/ui/relationGeometry.test.ts`).
Lo que no se puede probar ahí es **verlo y tocarlo**: que la punta de flecha se vea y no quede
debajo del pósit, que una línea fina se acierte con el dedo, que el modo de conectar no deje el
atrás roto.

## Cuándo hay que volver a pasarla

- antes de cerrar Fase 5 · Relaciones;
- al tocar las líneas, el modo de conectar o sus menús en `src/ui/DiagramCanvas.ts`, o
  `src/ui/relationGeometry.ts`;
- al probar un navegador o un móvil nuevos.

**Cada pasada se anota abajo, debajo de la anterior.**

## Reglas al ejecutarla

> **Si algo no se puede provocar en ese navegador, se anota eso mismo.**

> **Se pasa sobre un commit con el árbol limpio**, y se anota el commit.

> **Un comportamiento raro no es un fallo si está anotado abajo como conocido.** Se marca igual,
> pero con un «conocido»: lo que interesa es si se aguanta.

---

## Preparación

La misma que `VERIFICACION-MANUAL-LIENZO.md`. Hace falta **un diagrama con tres pósits**
separados —A, B y C—, y uno de ellos **nodo-nota**.

En escritorio, «doble toque» es doble clic, y el **clic derecho** abre los mismos menús.

---

## A. Conectar

- **A1.** El menú de un pósit empieza por **Conectar** (también en un nodo-nota). Al elegirlo,
  arriba sale **«Toca el nodo de destino»** y el pósit de origen queda **marcado con el borde iluminado**.
- **A2.** Tocar otro pósit crea la línea **con flecha, del origen al destino**. El aviso y la
  marca se van.
- **A3.** Conectando, tocar un **nodo-nota** como destino lo une y **no entra** en la nota.
- **A4.** Cancelan sin crear nada: tocar **el fondo**, tocar **el propio origen**, el **clic
  derecho** y el **atrás** (en Android, el del sistema). El atrás cancela **sólo** el modo: el
  diagrama sigue abierto.
- **A5.** Conectar **dos veces** A con B: salen **dos** líneas. Y B con A: una tercera, en el
  otro sentido.

## B. Cómo se ven

- **B1.** Cada línea **sale del borde** del pósit, no de su centro, y la **punta de flecha se
  ve** entera, pegada al borde del destino.
- **B2.** Una sola línea entre dos pósits va **recta**. Varias entre los mismos dos se abren
  **en abanico**, sin pisarse, **aunque vayan en sentidos contrarios**.
- **B3.** Las líneas van **por debajo** de los pósits.
- **B4.** **Mover un pósit**: sus líneas **lo siguen mientras se arrastra**, no sólo al soltar.
- **B5.** Escribir en un pósit hasta que crezca: sus líneas siguen saliendo **del borde nuevo**.
- **B6.** Al abrir el diagrama, las líneas ya salen del borde: **ninguna** empieza en el centro
  de un pósit.
- **B7.** Con el ratón encima, la línea se **ilumina**.

## C. El menú de la línea

- **C1.** ⚠️ **Doble toque sobre una línea** abre su menú. *(Móvil: con el dedo, sin tener que
  apuntar al píxel.)* El título dice qué une: «A → B», o «A — B» si no tiene dirección.
- **C2.** Con flecha: *Invertir dirección · Sin dirección · Texto · Borrar*. Sin flecha: *Con
  dirección · Texto · Borrar* — **invertir no sale**.
- **C3.** **Invertir** le da la vuelta a la flecha. Si ya había otra en ese sentido, **conviven
  las dos**.
- **C4.** **Sin dirección** quita la punta. **Con dirección** la devuelve **en el sentido que
  tenía**.
- **C5.** **Borrar** quita la línea **sin preguntar**; los pósits se quedan.
- **C6.** Arrastrar empezando **sobre una línea** mueve el corcho.

## D. El texto de la línea

- **D1.** **Texto** pone un campo en el **medio de la línea**. Escribir e **Intro**: el texto
  sale **a lo largo** de la línea, centrado y un poco por encima.
- **D2.** ⚠️ En una línea que va **de derecha a izquierda**, el texto se lee **derecho**, no boca
  abajo.
- **D3.** **Escape** descarta; tocar fuera guarda; **vaciar** el campo y guardar quita el texto.
- **D4.** Un texto que cruza otra línea se lee igual (lleva un halo del color del fondo).
- **D5.** Un texto más largo que la línea **se corta** al final de ella.
- **D6.** Recargar: el texto, las flechas y los sentidos siguen igual.

## E. Lo que arrastra a las líneas

- **E1.** **Borrar un pósit** borra **todas sus líneas**, las que salen y las que llegan.
- **E2.** Borrar la nota de un nodo-nota: el nodo pasa a «Nota perdida» y **sus líneas se
  quedan**.

---

## Conocidos

- **Con el modo de conectar activo, «✕ Salir» primero lo cancela** y hay que pulsarlo otra vez:
  el modo es una capa del atrás, como una hoja.
- **No se puede unir un pósit consigo mismo**: tocarlo como destino cancela. Es decisión
  (§9.11).
- **Las líneas no se manejan con teclado**: pendiente, como el resto del lienzo.

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
| B1–B7 | |
| C1–C6 | |
| D1–D6 | |
| E1–E2 | |

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
| B1–B6 (**B4** con el pósit levantado) | |
| C1–C6 (**C1**) | |
| D1–D6 (**D2**) | |
| E1–E2 | |
