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
- **F4.** Repetir el script y, en el aviso, **«Abandonar la importación»**: arranca **con lo que
  haya entrado** (aquí, nada) y no vuelve a intentarlo al recargar. Limpiar con
  `localStorage.removeItem("prueba:relleno")` y **Borrar todo**.

## V. Cómo se ve

- **V1.** En ⚙ → Datos: la explicación de la copia, **Exportar copia** e **Importar copia** como
  botones **sin color** —ni vídeo inverso ni rojo—, y debajo «Borrar todo» en rojo, como antes.
- **V2.** *(Móvil, o el navegador a 375 px.)* Los dos botones caben en una fila y la página **no
  se desplaza de lado**.

---

## Pasadas

*(Ninguna todavía.)*
