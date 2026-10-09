# Verificación manual de la PWA (Fase 6)

**Esto no es documentación de diseño: es un procedimiento**, como sus vecinas. Pasarla en el
móvil es el último punto del criterio de cierre de la Fase 6 (`ARCHITECTURE.md` §9.12).

## Por qué existe

Casi nada de la Fase 6 se puede probar en Node: el manifiesto, el *service worker*, la
instalación y la actualización sólo existen dentro de un navegador. En el ordenador se probó en
Brave el 2026-10-09, sirviendo la carpeta publicada en `localhost`: se registra, guarda los 83
ficheros, funciona sin conexión, se instala y se actualiza borrando la caché vieja. Lo que falta
es **el móvil de verdad**, con HTTPS, con su lanzador, su pantalla de carga, su barra de estado y
la forma que tenga MIUI de cerrar y limpiar apps.

## Cuándo hay que volver a pasarla

- antes de cerrar la Fase 6;
- al tocar `pwa/sw.js`, `tools/build-pages.mjs`, `manifest.webmanifest`, `index.html` o
  `.github/workflows/publicar.yml`;
- al cambiar de móvil o de navegador.

**Cada pasada se anota abajo, debajo de la anterior.**

## Reglas al ejecutarla

> **Si algo no se puede provocar en ese móvil, se anota eso mismo.**

> **Se pasa sobre lo publicado**, y se anota la versión que dice ⚙ al pie y el commit de `main`.

> **Un comportamiento raro no es un fallo si está anotado abajo como conocido.** Se marca igual,
> pero con un «conocido»: lo que interesa es si se aguanta.

---

## Preparación

- La receta de *Publicar* en verde en la pestaña **Actions** del repo, y la app en
  **https://ildartashtekov.github.io/ElNotas/**.
- **Chrome** en el móvil. La versión de la red de casa (`192.168.…:8000`) es **otro sitio**: lo
  que tenga escrito no aparece en la instalada, y es lo esperado.
- **Dónde se ve la versión:** ⚙, al pie de la pantalla, «Versión AAAA-MM-DD · xxxxxxxx».

---

## A. Instalar

- **A1.** Abrir la dirección en Chrome: la app carga y funciona como en casa.
- **A2.** Menú **⋮ → «Instalar aplicación»** (o «Añadir a pantalla de inicio»): sale el diálogo
  con **el nerd** y el nombre **«ElNotas»**.
- **A3.** Tras instalarla, en la pantalla de inicio hay un icono **con el nerd** y **«ElNotas»**
  debajo.

## B. Abrirla

- **B1.** Al tocar el icono sale **la pantalla de carga**: fondo **azul**, el nerd en el centro y
  «ElNotas» debajo.
- **B2.** La app se abre **a pantalla completa**, sin la barra de direcciones de Chrome.
- **B3.** La **barra de estado** —la de la hora y la batería— es **azul**, con el móvil en modo
  claro **y** en modo oscuro.
- **B4.** En ⚙, al pie: **«Versión AAAA-MM-DD · xxxxxxxx»**, no «Versión de desarrollo».
- **B5.** En la lista de apps recientes sale como **ElNotas**, con su icono, aparte de Chrome.

## C. Sin conexión

- **C1.** Con conexión, crear una nota con algo escrito. **Cerrar la app del todo** (quitarla de
  recientes).
- **C2.** Poner **modo avión**. Abrir la app desde el icono: **carga**, y la nota de C1 está.
- **C3.** Sin conexión, entrar en **una nota, un diagrama y ⚙**: todo funciona.
- **C4.** Sin conexión, cambiar el texto de la nota, cerrar la app del todo y volver a abrirla:
  el cambio **sigue ahí**.

## D. Las notas sobreviven

- **D1.** Quitar la app de recientes y volver a abrirla: todo está.
- **D2.** **Reiniciar el móvil** y abrirla: todo está.
- **D3.** *(Opcional, con el cable.)* Si se concedió el almacenamiento persistente: conectar el
  móvil al ordenador con la depuración USB activada, abrir `chrome://inspect` en el Chrome del
  ordenador, «inspect» en ElNotas y escribir en la consola
  `await navigator.storage.persisted()`. Se anota lo que diga, `true` o `false`; un `false` no es
  un fallo, porque el navegador decide.

## E. Girar

- **E1.** Girar el móvil en cada vista —**ventanas, nota, diagrama, ⚙**— : la app gira, se ve
  entera y se puede seguir usando. En horizontal, la columna queda en el centro.
- **E2.** En el diagrama girado, **mover el lienzo y un pósit** con el dedo.
- **E3.** Volver a vertical: todo como estaba.

## F. Se actualiza sola

Hace falta **publicar un cambio que toque la app** (un `push` a `main` con algo en `src/`,
`index.html` o los estilos). Relanzar la receta sin cambios **no** sirve: da la misma huella y,
para el móvil, la misma versión.

- **F1.** Anotar la versión que dice ⚙ antes del `push`. Hacer el `push` y esperar a que
  *Publicar* salga en verde.
- **F2.** Abrir la app **con conexión**: ⚙ dice aún **la versión vieja**. Es lo esperado.
- **F3.** Cerrarla del todo y volver a abrirla: ⚙ dice **la versión nueva**, y el cambio se ve.
- **F4.** Las notas siguen todas.

## G. En el ordenador, sin *service worker* en desarrollo

- **G1.** En casa, `npm run build:web` y `python3 -m http.server 8000`, y abrir
  `http://localhost:8000`: ⚙ dice **«Versión de desarrollo»**.
- **G2.** En DevTools, **Application → Service workers**: para `localhost:8000` **no hay
  ninguno**.

---

## Conocidos

- **La primera apertura tras publicar enseña la versión anterior**; la nueva, en la siguiente.
  Es la actualización en silencio, por decisión (§9.12).
- **La barra de estado es azul también en modo oscuro**: decisión del usuario del 2026-10-09.
- **El icono puede salir con un borde o un fondo** en algunos lanzadores: no tiene versión
  *maskable*, por decisión (§9.12).
- **En MIUI, «Instalar» puede no poner el icono** si Chrome no tiene permiso para crear accesos
  directos: *Ajustes → Aplicaciones → Chrome → Otros permisos → «Accesos directos en la pantalla
  de inicio»*. Se anota si hizo falta.
- **Lo escrito en la versión de la red de casa no aparece en la instalada**: es otro sitio, y el
  usuario aceptó perderlo (§9.12).

---

## Hoja de resultados

### Pasada 1 — móvil

| | |
|---|---|
| Fecha | |
| Móvil, sistema y versión de Chrome | |
| Versión que dice ⚙ | |
| Commit de `main` | |

| Paso | Resultado |
|---|---|
| A1–A3 | |
| B1–B5 (B3 en claro y en oscuro) | |
| C1–C4 | |
| D1–D2 | |
| D3 (opcional) | |
| E1–E3 | |
| F1–F4 (versión de antes → de después) | |

### Pasada 1 — escritorio

| | |
|---|---|
| Fecha | |
| Navegador | |
| Commit | |

| Paso | Resultado |
|---|---|
| G1–G2 | |
