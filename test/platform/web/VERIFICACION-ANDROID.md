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

⚠️ **Una vez instalada la *release* (sección E), al móvil sólo va la *release***, compilada con
`npm run build:apk`. Una *debug* lleva otra firma y Android no la deja instalar encima; desinstalar
para que entre borra las notas.

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

## C. Exportar con «Compartir» (Fase 12, tarea 7)

En la app no se puede descargar: «Exportar copia» escribe la copia y abre la hoja «Compartir» de
Android, desde la que se guarda donde se quiera. Lo único que la app llega a saber es que la pasó
a otra app, así que dice «Copia enviada», no «guardada».

- **C1. Sale la hoja.** ⚙ → Datos → «Exportar copia»: sube la hoja de compartir de Android, con
  el título «Guardar la copia en…» (en inglés, «Save the backup to…»).
- **C2. Se guarda en Drive y se vuelve a importar entera.** En la hoja, elegir Drive y guardarla.
  La app dice «Copia enviada.». Crear una nota de prueba, «Importar copia», abrir Drive en el
  selector, elegir ese fichero y aceptar: vuelve lo de antes y la nota de prueba ya no está. Si en
  la hoja sale también un gestor de archivos que guarde, probarlo igual y anotarlo.
- **C3. Cerrar la hoja no es un fallo.** «Exportar copia» y cerrar la hoja sin elegir nada (atrás
  o tocando fuera): la app no dice nada.
- **C4. Cancelar dentro de Drive.** «Exportar copia», elegir Drive y, en su pantalla de guardar,
  cancelar. Anotar qué dice la app: Android no le cuenta que se canceló, y lo esperable es que
  diga «Copia enviada.» igualmente.
- **C5. Un destino que se abre encima.** «Exportar copia» y elegir uno que no saque de la app
  («Copiar», Quick Share o Bluetooth, el que haya). Anotar qué dice la app: puede no decir nada
  aunque se haya enviado.

## D. El icono y la carga (Fase 12, tarea 9)

- **D1. El icono es el «nerd», entero.** En la pantalla de inicio y en el cajón de apps, el icono
  de ElNotas es el del «nerd» con la lluvia de letras, sobre negro; no el robot de Capacitor. Con
  la forma de icono que traiga el móvil (redonda o cuadrada con esquinas), la cabeza y los libros se
  ven enteros, y no sale el marco verde del icono de la PWA, ni cortado ni como un icono dentro de
  otro. Si el lanzador deja cambiar la forma, probar también la redonda.
- **D2. Al abrir, todo negro.** Cerrar la app desde las recientes y abrirla: la pantalla de carga
  es negra y no hay ningún destello blanco antes de que salga la app. En Android 12 o más, en el
  centro sale el «nerd» en un círculo; no el icono genérico de Android ni el robot de Capacitor.

## E. La release, firmada con la clave del usuario (Fase 12, tarea 6)

Una actualización sólo se instala encima si va firmada con la misma clave, y desinstalar borra
las notas. Por eso la *release* se firma con una clave propia, que se crea **una sola vez** y no
se puede perder. La clave y sus contraseñas viven en `~/.elnotas/`, fuera del repo; nada de eso
entra en el `.apk` ni en git.

**Crear la clave (una vez).** En una terminal, con el Java de Android Studio:

```bash
mkdir -p ~/.elnotas && chmod 700 ~/.elnotas
/snap/android-studio/current/jbr/bin/keytool -genkeypair -v -keystore ~/.elnotas/clave-android.jks -alias elnotas -keyalg RSA -keysize 2048 -validity 10000
```

Pide la contraseña dos veces: de 6 caracteres o más, **sólo letras sin tilde ni ñ y números**
(sin `\`), para que llegue igual al compilar. Luego pide unos datos de nombre, que pueden quedarse
en blanco con Intro. Al final pregunta si es correcto: hay que escribir «sí» (o «yes»), porque con
Intro responde que no y vuelve a empezar. La clave no pide contraseña aparte: es la misma.

Luego, crear `~/.elnotas/firma.properties` con esto, poniendo esa contraseña en las dos líneas, y
dejarlo legible sólo para ti con `chmod 600 ~/.elnotas/firma.properties`:

```
storeFile=~/.elnotas/clave-android.jks
storePassword=LA_CONTRASENA
keyAlias=elnotas
keyPassword=LA_CONTRASENA
```

**La copia, fuera del ordenador.** `clave-android.jks` a un pendrive o a Drive, **sin**
`firma.properties`; la contraseña, en un gestor de contraseñas o en papel. Si se pierde la clave,
no hay forma de actualizar sin desinstalar.

**Compilar la release.** Con `JAVA_HOME` apuntando al Java con el que compila Android Studio, el
21 de `~/.jdks/` (se puede añadir a `~/.bashrc`, como `CAPACITOR_ANDROID_STUDIO_PATH`). El de
`/snap/android-studio/current/jbr` es un Java 25, y Gradle 8.14 falla con él («Unsupported class
file major version 69»); vale para `keytool`, no para compilar. Si Android Studio cambia de Java,
el suyo sale en *Settings → Build Tools → Gradle → Gradle JDK*.

```bash
cd /home/ubuntu/proyectos-dev/ElNotas && export JAVA_HOME=~/.jdks/jbr-21.0.11 && npm run build:web && npm run build:android && npx cap sync android && npm run build:apk
```

El `.apk` sale en `android/app/build/outputs/apk/release/app-release.apk`. Su número de versión es
el recuento de commits: cada *release* nueva sube sola. Por eso, lo que ya se compiló en una
*release* no se reescribe: ni `reset` hacia atrás, ni *rebase* que quite commits, ni juntar con
*squash*. El recuento bajaría, y Android no instala encima una versión menor.

- **E1. Sin la firma, la release se niega.** Antes de crear `firma.properties` (o moviéndolo un
  momento), `npm run build:apk` falla diciendo que falta `~/.elnotas/firma.properties`.
- **E2. Se instala la release.** Desinstalar la de *debug* (aún sin notas de verdad: se pierden) e
  instalar `app-release.apk`. Abre y funciona; crear una nota de prueba.
- **E3. Una segunda release se instala encima sin perder nada.** Tras un commit nuevo, volver a
  compilar e instalar el `.apk` nuevo encima, sin desinstalar: Android ofrece «Actualizar», y la
  nota de prueba sigue ahí.
- **E4. Ningún secreto en git.** `git log --all --name-only | grep -E '\.jks$|\.keystore$|firma\.properties$'`
  no encuentra nada, y `git grep -F 'la contraseña' $(git rev-list --all)`, con la de verdad,
  tampoco: busca en toda la historia (luego, borrar esa línea del historial de la terminal).

## F. La copia automática (Fase 12, tarea 8)

Al abrir la app y tras cada cambio, si han pasado 12 horas desde la última, la app escribe en
`Documentos/ElNotas/` el mismo `.json` de «Exportar copia», con fecha y hora en el nombre
(`elnotas-AAAA-MM-DD-HHMMSS.json`). Se queda con tres: al escribir la cuarta, borra la más vieja de
las suyas. Se pasa a lo largo de dos días, usando la app como siempre y con el reloj del móvil en
hora automática: entre una copia y la siguiente hay que esperar el plazo. La carpeta se mira con el
gestor de archivos del móvil.

⚠️ **F4 y F6 lo borran todo** (desinstalar, «Borrar todo»): antes, exportar una copia a Drive, o
pasarlas antes de llevar a la app las notas de verdad.

- **F1. La primera, al abrir.** Con alguna nota y ⚙ cerrada, cerrar la app desde las recientes y
  abrirla: en `Documentos/ElNotas/` hay un `elnotas-…json` con la fecha y la hora de ahora. Abrir
  entonces ⚙ → Datos (la línea se cuenta al abrirla): debajo de los botones de la copia, «Copia
  automática: hace un momento, en Documentos/ElNotas.»
- **F2. Dentro del plazo, ninguna más.** Editar una nota, cerrar la app y abrirla: sigue habiendo
  una sola.
- **F3. La cuarta borra la más vieja.** Pasadas 12 horas desde la primera, abrir la app o editar
  una nota: aparece la segunda. Otras 12 horas: la tercera. Otras 12: sigue habiendo tres, y la
  primera ya no está. En ⚙, la línea dice cuánto hace de la última.
- **F4. Tras reinstalar, se importa una de esas.** Desinstalar la app e instalar el mismo `.apk`:
  en ⚙, «Copia automática: todavía ninguna.» y la app está vacía. «Importar copia», ir a
  `Documentos/ElNotas/` en el selector, elegir la más reciente y aceptar: vuelve todo. Al abrir
  después, la app hace una copia nueva y no toca las de la instalación anterior (ahora hay cuatro).
  Si al reinstalar la app ya traía las notas, Android ha devuelto sus datos de su propia copia
  (`allowBackup`): anotarlo, porque entonces la lista de las copias también vuelve.
- **F5. En inglés.** En ⚙, cambiar a English: la línea dice «Automatic backup: … ago, in
  Documents/ElNotas.» (o «just now», si es de hace menos de un minuto). Volver a Español.
- **F6. La app vacía no copia.** ⚙ → «Borrar todo» y confirmar: en ⚙, «todavía ninguna.»; cerrar y
  abrir la app no añade nada a la carpeta, y las de antes siguen ahí.

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

### 2026-11-11 — Xiaomi, Capacitor 8, `.apk` *release* firmado con la clave del usuario

Todo en una sola instalación: la de *debug* desinstalada antes. El usuario da por buenos todos los
pasos; de C4 y C5 no anotó qué dijo la app.

- **A1–A4** ✓ Las notas sobreviven a cerrar la app y a reiniciar el móvil; «Borrar todo» lo vacía
  todo; una copia de la PWA se importa y sigue tras cerrar la app.
- **B1–B6** ✓ El atrás cierra lo de encima paso a paso, las hojas y la selección; sin nada encima
  saca la app; tras una recarga queda la pulsación muerta aceptada.
- **C1–C5** ✓ «Exportar copia» abre la hoja con su título; la copia guardada en Drive se vuelve a
  importar entera; cerrar la hoja no dice nada.
- **D1–D2** ✓ El icono, el «nerd» entero en la máscara del móvil; la carga, negra y sin destello.
- **E1** — No se pasó: la *release* compila con la firma, que es lo que importa.
- **E2** ✓ La *release* se instala y funciona.
- **E3** ✓ (pasada después, con la *release* de la copia automática) La segunda *release* se
  instala encima, con «Actualizar», y la nota de prueba sigue ahí.
- **E4** ✓ Ni la clave ni `firma.properties` aparecen en la historia de git.
- **F1–F3** ✓ La primera copia sale al abrir, con su línea en ⚙; dentro del plazo no hay más; con
  la cuarta quedan tres y se va la más vieja. El usuario adelantó el reloj del móvil en vez de
  esperar las 12 horas.
- **F4–F6** Pendientes: desinstalar e importar, el inglés y «Borrar todo».
