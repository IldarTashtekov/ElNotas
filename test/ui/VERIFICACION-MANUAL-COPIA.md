# Verificación manual de la copia de seguridad

**Esto no es documentación de diseño: es un procedimiento**, como sus vecinas
`VERIFICACION-MANUAL.md` y `VERIFICACION-MANUAL-TERMINAL.md`. Pasarla en escritorio **y** en el
móvil es el criterio de cierre de exportar e importar (`TAREAS.md`).

## Por qué existe

Qué va dentro de la copia, cómo se rechaza lo que no vale y cómo se sustituye al arrancar lo
prueban las de Node, con un `localStorage` de mentira. Lo que no ven es **lo que pone el
navegador**: el diálogo de «Guardar como», la descarga, el selector de ficheros del sistema —el
de Android incluido—, la recarga de verdad y cuánto cabe de verdad en `localStorage`.

## Cuándo hay que volver a pasarla

- antes de dar por cerrada la copia de seguridad;
- al tocar `src/platform/web/saveFile.ts`, `importStorage.ts`, `prepareImport.ts` o el principio
  de `main.ts`;
- al cambiar el formato de la copia (`BACKUP_VERSION` en `backup.ts`) o el de lo guardado;
- al probar un navegador o un móvil nuevos.

**Cada pasada se anota abajo, debajo de la anterior.**

## Reglas al ejecutarla

> **Se pasa sobre un commit con el árbol limpio**, y se anota el commit.

> **Si algo no se puede provocar en ese navegador, se anota eso mismo.**

> ⚠️ **Importar borra lo que hay.** Antes de empezar, **exporta** lo que tengas en ese navegador,
> o pásala en otro origen: con `python3 -m http.server 8001`, `localhost:8001` empieza vacío.

---

## Preparación

La misma que `VERIFICACION-MANUAL.md`: `npm run build:web`, servir, y abrir por `localhost` o,
en el móvil, por la IP del ordenador. Para I5 e I6, además, **la copia publicada instalada** en
el móvil.

Hace falta: **un contexto con dos notas, un diagrama movido y acercado, tres ventanas y el
fósforo en verde.**

> Por la IP de casa no hay HTTPS, y sin HTTPS el navegador no ofrece «Guardar como»: ahí la copia
> va siempre a Descargas. Es lo esperado.

---

## E. Exportar

- **E1.** *(Chrome o Edge de escritorio.)* ⚙ → **Exportar copia** abre el **«Guardar como»** del
  sistema, con el nombre `elnotas-backup-AAAA-MM-DD.json` y la fecha de hoy. Se elige una
  carpeta y se guarda: abajo sale **«Copia guardada.»**
- **E2.** Abrir ese fichero con un editor de texto: se lee, y lleva `"app": "elnotas"`, los
  ficheros de las notas en `files`, las ventanas en `windows`, `"phosphor": "green"` y en
  `framing` el encuadre del diagrama.
- **E3.** **Exportar copia** y **cerrar el diálogo sin guardar**: no sale ningún mensaje y no
  aparece ningún fichero.
- **E4.** *(Firefox o Safari, que no tienen «Guardar como».)* **Exportar copia** la deja en
  **Descargas**, con el mismo nombre, y dice **«Copia guardada.»**
- **E5.** *(Móvil, en la PWA instalada.)* **Exportar copia**: el fichero aparece en
  **Descargas** —en la app de Archivos— y se puede **compartir a Drive** desde ahí.
- **E6.** Mientras se exporta, los dos botones están **desactivados**: pulsar otra vez no hace
  nada.

## I. Importar

- **I1.** Crear una nota **«Sobra»**, poner el fósforo en **ámbar** y mover el corcho del diagrama. ⚙ → **Importar copia** abre
  el **selector de ficheros** del sistema. Elegir la copia de E1: sube la hoja con **lo que trae**
  («La copia trae 2 notas, 1 diagrama y 1 contexto…») y el botón rojo **«Sustituir todo»**.
- **I2.** **Cancelar**: la hoja se cierra y **no cambia nada**; «Sobra» sigue ahí.
- **I3.** Repetir I1 y pulsar **«Sustituir todo»**: la app **recarga** y queda **como en la
  copia**: sin «Sobra», con sus **tres ventanas**, el fósforo **verde** y el diagrama **donde se
  miraba al exportar**.
- **I4.** Elegir **el mismo fichero dos veces seguidas** (cancelando la primera): la segunda vez
  **vuelve a preguntar**.
- **I5.** Elegir un fichero que **no es una copia** (cualquier `.json`, o un `.txt` renombrado):
  dice **«Ese fichero no es una copia de ElNotas.»** y no cambia nada.
- **I6.** *(Móvil, en la PWA instalada.)* **Importar copia** abre el selector de **Android**: se
  puede coger la copia de **Descargas** y, si está instalado, de **Drive**. I1 a I3 funcionan
  igual.
- **I7.** **De un origen a otro**: exportar en `localhost` e importar en la **publicada** (o al
  revés). Entra todo: es lo que se necesita para pasar las notas a la app instalada.
- **I8.** *(Móvil.)* Con la hoja de «Sustituir todo» abierta, el **atrás** del móvil la cierra
  **sin importar**.

## F. Una importación que se queda a medias

Hace falta un navegador con el espacio normal (unos 5 MB; Chrome de escritorio vale). **En un
origen vacío** (`localhost:8001`), abrir la consola y pegar esto: llena el almacén con una clave
ajena hasta dejar poco hueco, y apunta una copia que cabe al apuntarla pero no al escribirla.
Busca el tope hasta 20 millones de caracteres: si el navegador deja más (el del panel de Claude,
unos 52 millones), `alto = 200_000_000`, o la copia entra y F1 no sale.

```js
let bajo = 0, alto = 20_000_000
while (alto - bajo > 10_000) {
  const m = Math.floor((bajo + alto) / 2)
  try { localStorage.setItem("prueba:relleno", "x".repeat(m)); bajo = m } catch { alto = m }
}
localStorage.setItem("prueba:relleno", "x".repeat(bajo - 1_000_000))
localStorage.setItem("elnotas:importar", JSON.stringify({
  app: "elnotas", backupVersion: 1, exportedAt: Date.now(),
  files: { "notes/relleno.json": "x".repeat(900_000) }, windows: null, phosphor: null,
}))
location.reload()
```

- **F1.** La app **no arranca**: sale el aviso «La copia no se ha terminado de importar. No queda
  sitio para guardar más. Se reintentará al recargar…», con **«Reintentar»** en vídeo inverso y
  **«Abandonar la importación»** al lado, en hueco. El aviso tiene el borde de los demás avisos:
  nada en rojo.
- **F2.** **Reintentar**: vuelve a salir el mismo aviso (sigue sin caber).
- **F3.** En la consola, `localStorage.removeItem("prueba:relleno")`, y **Reintentar**: ahora
  entra. Arranca y avisa de que **`notes/relleno.json` no se puede leer**, que es lo que tiene que
  decir de ese relleno.
- **F4.** **Vaciar el origen** (`localStorage.clear()` en la consola) y repetir el script; si no,
  el `notes/relleno.json` de F3 sigue ahí, importar lo borra antes de escribir, libera su sitio y
  la copia cabe. En el aviso, **«Abandonar la importación»**: arranca **con lo que
  haya entrado** (aquí, nada) y no vuelve a intentarlo al recargar. Limpiar con
  `localStorage.removeItem("prueba:relleno")` y **Borrar todo**.

## V. Cómo se ve

- **V1.** En ⚙ → Datos: la explicación de la copia, **Exportar copia** e **Importar copia** como
  botones **sin color** —ni vídeo inverso ni rojo—, y debajo «Borrar todo» en rojo, como antes.
- **V2.** *(Móvil, o el navegador a 375 px.)* Los dos botones caben en una fila y la página **no
  se desplaza de lado**.

---

## Pasadas

Cómo se pasa y cómo se marca cada paso: `test/PASAR-LAS-LISTAS.md`.

```
Fecha:        anotada el 2026-10-17; probado antes, sin fecha exacta
Navegador:    la PWA instalada en el móvil del usuario (Android)
Quién:        el usuario, en su móvil
Commit:       el publicado entonces en main, no esta rama
Origen:       la publicada

E5  ✅ — según el usuario: «ya la probé con anterioridad y sí hace correcto»
I6  ✅ — según el usuario, la misma respuesta

Notas: los dos pasos que el panel no podía, completan la pasada de abajo. Sin anotar paso a
paso: lo que consta es la palabra del usuario.
```

```
Fecha:        2026-10-17
Navegador:    el del panel de Claude (Chromium 152.0.7977.130, Linux)
Quién:        Claude, en el panel
Commit:       6a00f9f, con dos cambios sin comitear que no tocan la app
              (test/PASAR-LAS-LISTAS.md y la entrada web-8001 de .claude/launch.json)
Origen:       localhost:8001, vacío al empezar; I7, en la publicada (2026-10-13 · 2fa7b591)

E1  🔁 simulado — el «Guardar como», por uno que guarda en memoria: propone
       elnotas-backup-2026-10-17.json, escribe, cierra y dice «Copia guardada.»
E2  ✅ — "app": "elnotas", los 5 ficheros, las 3 ventanas, "phosphor": "green" y el encuadre
E3  🔁 simulado — el diálogo lanza el AbortError de cerrarlo: ni mensaje ni error, botones activos
E4  🔁 simulado — sin showSaveFilePicker y con el enlace de descarga interceptado: mismo nombre,
       la misma copia, «Copia guardada.» Nada se descargó
E5  ⏭ no se puede aquí — el móvil; lo pasa el usuario
E6  ✅ — con el diálogo en espera, los dos botones desactivados y otro clic no pide otro diálogo
I1  🔁 simulado — el selector de ficheros: el botón lo pide (accept .json), y el fichero se le da
       por código. Sube «La copia trae 2 notas, 1 diagrama y 1 contexto. ¿Sustituir por ella todo
       lo de este navegador? Lo de ahora se pierde.» y «Sustituir todo» en rojo
I2  ✅ — «Cancelar»: la hoja se cierra; «Sobra», el ámbar y el encuadre movido, igual
I3  ✅ — recarga y queda como la copia: sin «Sobra», tres ventanas con «Casa» activa, verde, y el
       diagrama en (140, -60) ×1,75, el de la exportación, no el movido
I4  🔁 simulado — el selector queda vacío tras cada elección, y la hoja vuelve a salir
I5  🔁 simulado — un .json cualquiera y un texto: «Ese fichero no es una copia de ElNotas.»
I6  ⏭ no se puede aquí — el selector de Android; lo pasa el usuario
I7  🔁 simulado (el selector) — la copia de localhost:8001 entra entera en la publicada
I8  🔁 simulado — el atrás del navegador por el del móvil: cierra sólo la hoja, sin importar
F1  ✅ — con el tope a 200 millones (ver F): el aviso, «Reintentar» en vídeo inverso,
       «Abandonar la importación» en hueco, el borde de los avisos y nada en rojo
F2  ✅ — recarga y el mismo aviso
F3  ✅ — entra, arranca y avisa «No se entiende el fichero notes/relleno.json»
F4  ✅ — tras vaciar el origen (corregido arriba): arranca vacía y no vuelve a intentarlo
V1  ✅ — explicación, los dos botones sin color y «Borrar todo» en rojo
V2  ✅ — a 375 px, los dos botones en una fila y sin desplazamiento lateral

Notas:
- F4, tal como estaba escrito, no salía: tras F3, `notes/relleno.json` sigue guardado, importar lo
  borra antes de escribir y la copia cabe. Corregido el paso: vaciar el origen antes.
- El panel deja guardar unos 52 millones de caracteres, no 5 MB: el script de F, con su tope de
  20 millones, no llenaba nada. Apuntado en F.
- La publicada salió primero en una versión vieja (2026-10-11), del service worker del panel;
  una recarga la puso al día en silencio. El panel sí registra service workers.
```
