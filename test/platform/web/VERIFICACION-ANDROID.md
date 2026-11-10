# Verificación de la app de Android

**Un procedimiento, no documentación de diseño.** Lo que sólo se ve en la app de Android
instalada en un móvil de verdad: ni Node ni el navegador del panel lo alcanzan. Lo pasa el
usuario, con el móvil en la mano, y cada pasada se anota en la **Hoja de resultados**, debajo de
la anterior, con la fecha, el móvil y su versión de Android.

**Si algo no se puede provocar en ese móvil, se anota eso mismo.** Un «no» es un resultado.

## Cómo se compila y se instala

1. `npm run build:web && npm run build:android && npx cap sync android`
2. En Android Studio, *Build → Build App Bundle(s) / APK(s) → Build APK(s)*.
3. El `.apk` bueno es el de `android/app/build/outputs/apk/debug/`. El que deja el botón ▶ en
   `intermediates/` va marcado «sólo para pruebas» y el móvil lo rechaza.
4. Se pasa al móvil y se abre desde el gestor de archivos.

---

## S. El sondeo (provisional, Fase 12, tarea 3)

**El sondeo ya no está en el código**: salió al cerrar la tarea 3, y su resultado está abajo.
Esta sección se queda para saber qué se comprobó y cómo. Mientras existía, al abrir la app salía encima, en verde sobre negro, una pantalla con
el resultado de cada comprobación y un botón «Cerrar el sondeo». Las líneas van saliendo según
llegan, y una que no responde en 10 s sale con `✗ … sin respuesta`. Se anota lo que diga cada
bloque, copiado tal cual o con una foto.

- **S0. Sale el sondeo.** Al abrir la app sale la pantalla verde y acaba en `── Fin del sondeo`.
  Si no sale, o se queda a medias, se anota hasta dónde llegó y se pregunta antes de seguir.
- **S1. El puente, sin `@capacitor/core`.** En el bloque 1: la plataforma dice `android`, y
  sale `nativePromise: sí` o el nombre `Filesystem` entre los `Plugins`.
- **S2. OPFS.** El bloque 2 dice `carpeta: ✓`, `escribir: ✓ escribe y lee` y `borrar: ✓`. Si sólo
  falla `escribir`, la carpeta existe pero no se puede escribir en ella: se anotan las dos.
- **S3. Escribir en `Documentos/ElNotas/` sin pedir permisos.** En el bloque 3 y 4, `escribir` y
  `lo que hay` empiezan por `✓`, y no ha salido ningún aviso de permisos. **La primera vez,
  `lo que había` sale con `✗` (el fichero aún no existe): es lo esperado y no cuenta.** Con el gestor de
  archivos del móvil, en *Documentos → ElNotas* está `sondeo.txt`.
- **S4. Tras desinstalar y reinstalar, la app nueva ve y pisa lo que dejó la vieja.** Anotar la
  hora de `lo que hay`. Desinstalar la app (mantener pulsado el icono → Desinstalar), volver a
  instalar el mismo `.apk` y abrirla. `lo que había` empieza por `✓` y lleva la hora anotada, y
  `escribir` y `lo que hay` empiezan por `✓` con la hora nueva.
- **S4b. Tras reinstalar, la app nueva crea, lee y borra un fichero con otro nombre** en esa
  misma carpeta: en el bloque 4b, las tres líneas empiezan por `✓`. Es lo que necesita la copia
  automática si S4 da `✗`: cada copia con su nombre, sin pisar las de la instalación vieja.
- **S5. «Importar copia» abre el selector y lee lo de la instalación vieja.** El selector sólo
  enseña `.json`, así que el sondeo escribe `sondeo-instalacion.json` (bloque 5, con `✓` la primera
  vez). Instalar encima, sin desinstalar, y abrir; luego desinstalar, reinstalar y abrir (el
  bloque 5 sale ahora con `✗`, como el 3). Cerrar el sondeo, ir a ⚙ → Datos → «Importar copia»,
  ir a *Documentos → ElNotas* y elegir `sondeo-instalacion.json`. Tiene que salir el aviso de que
  no es una copia válida: eso dice que lo ha podido leer. No se borra nada,
  porque importar ensaya antes de tocar lo guardado.
- **S6. Exportar desde ⚙ guarda una copia que se vuelve a importar.** Crear una nota de prueba,
  ⚙ → Datos → «Exportar copia», y guardarla en el móvil. Borrar la nota, «Importar copia», elegir ese
  fichero y aceptar: la nota vuelve.

**Un «✗» en cualquiera para la fase**: se anota el texto entero y se pregunta antes de seguir.

---

## A. Las notas, en OPFS (Fase 12, tarea 4)

Desde la tarea 4, dentro de la app las notas viven en OPFS y no en `localStorage`. Lo que se
escribió con una versión anterior de la app se queda en `localStorage`, sin verse: la app arranca
vacía la primera vez.

- **A1. Las notas sobreviven a cerrar la app.** Crear una nota con texto, cerrar la app desde
  las recientes (deslizándola fuera) y volver a abrirla: la nota sigue con su texto.
- **A2. Y a reiniciar el móvil.** Reiniciar el móvil y abrir la app: la nota sigue ahí.
- **A3. «Borrar todo» lo vacía todo.** ⚙ → «Borrar todo» y confirmar: la app vuelve a arrancar
  vacía, en el General, sin la nota. Cerrarla y abrirla otra vez: sigue vacía.
- **A4. Importar entra en OPFS.** Tras A3, ⚙ → Datos → «Importar copia» con una copia de la PWA:
  sus notas aparecen. Cerrar la app y volver a abrirla: siguen ahí.

## B. El botón atrás (Fase 12, tarea 5)

El atrás de Android hace lo del atrás del navegador: cierra lo de encima, paso a paso. Sin nada
encima, saca la app de la pantalla, como cualquier app de Android; al volver a ella sigue donde
estaba.

- **B1. Cierra lo de encima, paso a paso.** Abrir una nota con un enlace a otra nota y pulsar el
  enlace. Atrás: vuelve a la primera nota. Atrás: se cierra y queda la ventana.
- **B2. Cierra una hoja.** En una ventana, abrir el «+» de las pestañas (sube una hoja). Atrás: se
  cierra la hoja y nada más.
- **B3. Cierra el modo selección.** Pulsación larga sobre una nota de la lista. Atrás: sale del
  modo selección, sin borrar ni mover nada.
- **B4. Sin nada encima, sale.** En una ventana sin nada abierto encima, atrás: la app sale de la
  pantalla. Volver a ella desde las recientes: sigue en esa ventana.
- **B5. Tras una recarga con algo encima, una pulsación muerta (aceptada).** Abrir ⚙ y cambiar
  el idioma (la app recarga con ⚙ abierto). Atrás: se cierra ⚙. El siguiente atrás no hace nada
  y el otro saca la app: la recarga deja una entrada vieja en el historial. Pasa igual en la PWA,
  y el usuario lo aceptó así el 2026-11-10 (opción A). Volver a poner el idioma de antes.
- **B6. Con una capa que vuelve al abrir.** Abrir una nota, cerrar la app desde las recientes y
  abrirla (vuelve con la nota abierta). Atrás: se cierra la nota. Atrás: la app sale.

---

## Hoja de resultados

### 2026-11-10 — Xiaomi, Capacitor 8, `.apk` de *debug* (modelo y versión de Android sin anotar)

- **S0** ✓ Sale el sondeo y llega al final.
- **S1** ✓ `plataforma: android`. El puente trae los plugins en `Plugins` (`Filesystem`, `Share`,
  `App`…) sin `@capacitor/core`, y también `nativePromise`: las llamadas van directas.
- **S2** ✓ OPFS: carpeta, escribir y leer, borrar.
- **S3** ✓ Escribe en `/storage/emulated/0/Documents/ElNotas/` con `publicStorage: granted` y sin
  pedir nada. La primera vez, `lo que había` con ✗ porque no existía: lo esperado.
- **S4** ✗ Tras desinstalar y reinstalar, `EACCES` al leer y al escribir el `sondeo.txt` de la
  instalación vieja: en Android, un fichero de `Documentos` es de la instalación que lo creó.
  **El usuario elige la opción A**: cada copia automática con su propio nombre.
- **S4b** ✓ Tras reinstalar, crea, lee y borra un fichero con otro nombre en la misma carpeta.
- **S5** ✓ Tras reinstalar, «Importar copia» deja elegir el `sondeo-instalacion.json` de la
  instalación anterior y dice que no es una copia de ElNotas: lo ha leído. Importar una copia
  de la PWA también funciona. El selector sólo enseña `.json`.
- **S6** ✗ «Exportar copia» no hace nada: ni diálogo ni error. Lo arregla la tarea 7.
