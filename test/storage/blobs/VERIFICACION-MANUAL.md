# Verificación manual de `DirectoryHandleBlobStore`

**Esto no es documentación de diseño: es un procedimiento.** Los tres documentos del
proyecto —`CLAUDE.md`, `ARCHITECTURE.md` y `TAREAS.md`— siguen siendo tres. Esta lista vive
en `test/storage/blobs/`, **junto a las pruebas del mismo rincón del código**, por el mismo
motivo por el que están ahí ellas: esto es una prueba de `DirectoryHandleBlobStore.ts`, y lo
único que la distingue de sus vecinas es que la ejecutan unas manos y no `node --test`.

## Por qué existe

`DirectoryHandleBlobStore.ts` es **el único fichero del proyecto sin pruebas automáticas**, y
es una decisión, no un descuido (`ARCHITECTURE.md` §6.3): no tiene lógica propia, sólo traduce
a la API del navegador, y un doble ahí probaría lo que uno *cree* que hace esa API en vez de
lo que hace. El ejemplo que zanjó la discusión es el paso **A** de abajo: escribir exige un
`close()` final que es **lo que vuelca los datos al disco**, y un `BlobStore` de mentira sobre
un `Map` pasa en verde con ese `close()` olvidado. Contra una carpeta de verdad, no.

Así que la red de seguridad de ese fichero es esta lista. `ARCHITECTURE.md` §9.9, punto 5, la
exige **escrita y ejecutada al menos una vez, con fecha, navegador y resultado anotados**.

## Cuándo hay que volver a pasarla

- siempre que se toque `DirectoryHandleBlobStore.ts`, aunque sea una línea;
- al probar un navegador nuevo, porque lo que se está verificando es **su** API;
- antes de cerrar una fase que dependa del fichero local.

**Cada pasada se anota abajo, en "Hoja de resultados", debajo de la anterior.** No se
sobreescribe la de antes: interesa saber en qué navegador funcionó y en cuál no.

## Regla de oro al ejecutarla

> **Si algo no se puede provocar a mano en ese navegador, se anota eso mismo.**
> El punto se cierra con el resultado que salga, no con el resultado bueno. Una casilla que
> diga «no he podido revocar el permiso en este navegador» es información; una casilla marcada
> por costumbre no lo es.

Y una cosa que **no** es un fallo aunque lo parezca, porque está aplazado a propósito a la
Fase 4 (§6.5): **tras un `permission-denied`, el write-behind se queda detenido para el resto
de la sesión.** No hay forma de reanudarlo —reanudar es volver a pedir la carpeta, que es
plataforma—, así que después del paso **C** hay que **recargar la página** para seguir.

---

## Preparación

Hace falta un **navegador Chromium** (Chrome, Edge, Brave, Opera). Firefox y Safari **no
tienen** `showDirectoryPicker()` a fecha de hoy; si es el que hay, se anota y se pasa sólo la
sección opcional de OPFS, que sí soportan.

⚠️ **Brave no vale recién instalado, aunque sea Chromium: trae la API desactivada de fábrica.**
Se descubrió pasando esta lista y por eso está escrito aquí. El síntoma engaña, porque no es un
permiso denegado sino que **la función no existe**:

```
no se eligió carpeta: ReferenceError: showDirectoryPicker is not defined
```

Un `ReferenceError` y no un `SecurityError` — o sea el mismo mensaje exacto que da Firefox, que
es lo que hace perder el tiempo. Se arregla en `brave://flags/#file-system-access-api` → *Enabled*
y reiniciando; se comprueba en `brave://version`, donde tiene que aparecer
`--enable-features=FileSystemAccessAPI` en la línea de comandos. Antes de sospechar del contexto
seguro o del servidor, **mira eso**.

Y un atajo para descartar el contexto seguro de un vistazo, que también costó tiempo: si OPFS
funciona, el contexto es seguro. `navigator.storage` está restringido igual que el picker, así
que si uno va y el otro no, el problema no es la URL.

**1. Compilar el fichero a JavaScript de navegador.** Desde la raíz del repo:

```bash
./node_modules/.bin/tsc --ignoreConfig \
  src/storage/blobs/DirectoryHandleBlobStore.ts src/core/domain/Result.ts \
  --noResolve --rootDir src --outDir dist/manual \
  --target ES2020 --module ES2020 --lib ES2020,DOM,DOM.AsyncIterable --skipLibCheck
```

⚠️ **Ese comando imprime siete errores de tipos y es lo esperado.** Son de `--noResolve`, que
es lo que impide a `tsc` arrastrar el core entero (y con él un montón de imports sin extensión
que el navegador no sabe resolver). `tsc` **emite el JavaScript igualmente**, que es lo que
hace falta. El typecheck de verdad es `npm run typecheck`, y ése tiene que estar limpio.

Comprueba que han salido los dos ficheros:

```bash
find dist/manual -type f
# dist/manual/core/domain/Result.js
# dist/manual/storage/blobs/DirectoryHandleBlobStore.js
```

**2. Servir el repo por HTTP.** La File System Access API exige *contexto seguro*, y
`http://localhost` cuenta; abrir el HTML con doble clic (`file://`) **no**.

```bash
python3 -m http.server 8000
```

**3. Abrir** <http://localhost:8000/test/storage/blobs/verificacion-manual.html>

**4. Crear una carpeta vacía** para la prueba, por ejemplo `~/elnotas-prueba`, y **tenerla
abierta en el explorador de ficheros del sistema**. Esa ventana es el oráculo de esta lista: la
página web sólo dice lo que el código devuelve, y de lo que se trata es de comprobar que en el
disco pasa lo que dice.

> Un `find`/`stat` sobre la carpeta vale más que la ventana del explorador, y no es un capricho:
> en la pasada de Brave los dos hallazgos que importaron —la raíz equivocada y que el `write`
> denegado no tocó el fichero— se vieron por la **ruta completa y el mtime**, que en un explorador
> con iconos no se miran.

**Dos atajos del andamio, que no existían la primera vez que se pasó esta lista.** Ninguno de los
dos cambia lo que se verifica; los dos existen porque la primera pasada enseñó dónde se pierde el
tiempo y dónde se cuela un error:

- **Botones de bloque** (*Bloque A*, *Bloque B*, *Bloque D*): encadenan las operaciones de un paso
  y dejan el disco en un estado auditable. Los botones sueltos siguen ahí, y el paso C se hace con
  ellos. **Los bloques no dicen si algo pasa o falla**: imprimen el mismo `Result` crudo.
- **El handle se guarda en IndexedDB**, así que una recarga ya no obliga a volver a pasar por el
  diálogo nativo. Eso es lo que hace barato el paso B — y elimina la trampa en la que se cayó la
  primera vez, elegir `notes/` como raíz al reelegir carpeta. Hay un botón *Olvidar la carpeta
  guardada* para volver al punto de partida.

⚠️ **El atajo tiene un filo:** con el handle guardado es fácil correr el *Bloque B* sin haber
recargado, y entonces se lee con el mismo handle en memoria que acaba de escribir. Eso sale verde
y no prueba nada. **B sin `F5` no es B**: si el registro no empieza otra vez por
`listo. Empieza por el paso 1.`, no ha habido sesión nueva.

---

## A · Los bytes llegan de verdad al disco

Esto es lo que ninguna prueba automática puede ver.

1. Pulsa **«Elegir una carpeta…»** y elige `~/elnotas-prueba`. Concede el permiso de
   **edición** cuando el navegador lo pida (el diálogo dice «Guardar cambios»).
   - [ ] el registro dice `carpeta elegida: elnotas-prueba`
2. Pulsa **`write(notes/manual.json)`**.
   - [ ] el registro dice `write → ok undefined` (no un `err`)
3. **Ve al explorador de ficheros** y entra en `~/elnotas-prueba`.
   - [ ] existe una carpeta `notes/` — la creó el `{ create: true }` del camino
   - [ ] dentro está `manual.json`
   - [ ] **su tamaño NO es 0 bytes** ← esto es el `close()`. Si el fichero existe pero está
         vacío, falta el `close()` o se está llamando antes del `write()`
4. Ábrelo con un editor de texto cualquiera.
   - [ ] dentro hay un JSON con `escritoA` y una fecha, legible y bien formado
5. Pulsa **`read(notes/manual.json)`**.
   - [ ] el registro enseña los mismos bytes y el mismo texto que el fichero del disco
6. Pulsa **`list(notes/)`**.
   - [ ] devuelve `["notes/manual.json"]`, con el camino **completo**, no sólo el nombre
7. Pulsa **`read(no/existe.json)`**.
   - [ ] devuelve `ok(null)`, **no** un `err`. Ausencia no es fallo (§6.5)

## B · Lo escrito se relee en una sesión nueva

Que el fichero esté en disco no basta: hay que poder volver a él.

8. **Recarga la página** (F5). El registro se vacía y el `BlobStore` desaparece con ella: el
   handle de la carpeta vive en memoria y no sobrevive a una recarga (guardarlo entre sesiones
   es cosa de `platform/`, Fase 4).
9. Pulsa **«Elegir una carpeta…»** y elige **la misma** carpeta.
   - [ ] el navegador pide el permiso otra vez, o lo recuerda; en cualquier caso se concede
10. Pulsa **`read(notes/manual.json)`** sin haber escrito nada en esta sesión.
    - [ ] sale el JSON con la fecha **de la sesión anterior**
11. Pulsa **`list(notes/)`**.
    - [ ] sigue apareciendo `notes/manual.json`

## C · Revocar el permiso sale por `Result`, no por excepción

El punto entero de que los errores sean valores (§6.5). Si esto saliera como excepción, el
write-behind se rompería en vez de detenerse.

12. Con la página abierta y la carpeta ya concedida, **revoca el permiso**. En Chrome: candado
    de la barra de direcciones → *Configuración del sitio* / *Permisos* → **Edición de
    archivos** → quitar. (También sirve el chip de «Archivo» que aparece en la barra.)
13. Pulsa **`write(notes/manual.json)`**.
    - [ ] el registro dice `err {"kind":"permission-denied"}`
    - [ ] **NO** dice `⚠️ ¡HA LANZADO!` ← si dice eso, la frontera del fichero no está cazando
          esa excepción, y es un fallo de verdad
    - [ ] **NO** dice `err {"kind":"io", …}` ← saldría como «reintenta» algo que no se arregla
          reintentando, y el write-behind se pondría a escribir en bucle
14. Pulsa **`read(notes/manual.json)`**.
    - [ ] también `err {"kind":"permission-denied"}`, o vuelve a pedir el permiso (algunos
          navegadores lo repiden en la lectura); anota cuál de las dos cosas pasa

> Si tu navegador **no deja revocar el permiso** con la página abierta, anótalo y prueba esta
> variante, que provoca el mismo error por otra puerta: recarga la página, elige la carpeta y
> luego **borra o renombra la carpeta desde el explorador de ficheros**; después pulsa
> `write`. Lo esperado ahí es `err {"kind":"not-found", …}` — que también es un `Result` y
> tampoco es una excepción, que es lo que este paso comprueba.

## D · Borrar, y borrar lo que no está

15. **Recarga** la página y vuelve a elegir la carpeta (después del paso C el permiso está
    revocado; concédelo otra vez).
16. Pulsa **`delete(notes/manual.json)`**.
    - [ ] el registro dice `ok undefined`
    - [ ] en el explorador de ficheros, **`manual.json` ha desaparecido** y `notes/` sigue ahí
17. Pulsa **`delete(notes/manual.json)`** otra vez, con el fichero ya borrado.
    - [ ] vuelve a decir `ok undefined`: borrar lo que no está **no es un error**
18. Pulsa **`list(notes/)`**.
    - [ ] devuelve `ok []`, una lista vacía, y no un error

## E · OPFS *(opcional: no lo exige §9.9)*

Es **el mismo fichero de código** con otro handle (§6.1), así que esto no verifica líneas
nuevas: verifica que la suposición «las dos APIs son la misma» es cierta. Si entra o no en la
Fase 3 está sin decidir (`TAREAS.md`), así que se pasa si se quiere y se anota.

19. Recarga y pulsa **«Usar OPFS»** en vez de elegir carpeta. No hay diálogo ni permisos.
20. Repite los botones `write` → `read` → `list` → `delete`.
    - [ ] se comportan igual que con la carpeta de verdad
    - [ ] aquí **no** hay explorador de ficheros que mirar: OPFS no se ve desde el sistema.
          Por eso esta sección no sustituye a la A — el `close()` sólo se comprueba de verdad
          contra una carpeta que uno pueda abrir

---

## Hoja de resultados

Una pasada por bloque, **la más reciente arriba**. Se copia la plantilla y se rellena.

```
Fecha:        AAAA-MM-DD
Navegador:    (nombre y versión exacta: chrome://version)
Sistema:      (SO y versión)
Quién:        
Commit:       (git rev-parse --short HEAD)

A · bytes al disco           [ ] pasa   [ ] falla   [ ] no se ha podido probar
B · sesión nueva             [ ] pasa   [ ] falla   [ ] no se ha podido probar
C · permiso revocado         [ ] pasa   [ ] falla   [ ] no se ha podido probar
D · borrado                  [ ] pasa   [ ] falla   [ ] no se ha podido probar
E · OPFS (opcional)          [ ] pasa   [ ] falla   [ ] no se ha probado

Notas (lo que no encajó en una casilla, mensajes exactos, sorpresas de la API):
```

### Pasadas

```
Fecha:        2026-09-13
Navegador:    Brave 1.95.101 (Chromium 153.0.8010.37), build de snap, Wayland
              ⚠️ arrancado con --enable-features=FileSystemAccessAPI. De fábrica
              Brave NO trae la API; ver el aviso de «Preparación».
Sistema:      Ubuntu 22.04.5 LTS
Quién:        programinx, con Claude Code haciendo de oráculo del disco
Commit:       dec4306 — ⚠️ con el árbol SUCIO: todo el código de la Fase 3
              (blobs/, file/, Result.ts, errors/) estaba sin commitear.

A · bytes al disco           [x] pasa   [ ] falla   [ ] no se ha podido probar
B · sesión nueva             [x] pasa   [ ] falla   [ ] no se ha podido probar
C · permiso revocado         [x] pasa   [ ] falla   [ ] no se ha podido probar
D · borrado                  [x] pasa   [ ] falla   [ ] no se ha podido probar
E · OPFS (opcional)          [x] pasa   [ ] falla   [ ] no se ha probado

Notas (lo que no encajó en una casilla, mensajes exactos, sorpresas de la API):

- EL ORÁCULO NO FUE EL EXPLORADOR DE FICHEROS, y salió ganando. Cada paso se
  auditó con `find` y `stat` sobre la carpeta, mirando ruta completa, tamaño y
  mtime. Dos cosas se cazaron así y el explorador no las habría enseñado:
  la raíz equivocada (ver abajo) y que el `write` denegado del paso C no tocó
  el fichero.

- A · El fichero apareció con 45 bytes, NO 0, y con el JSON bien formado. Ése es
  el `close()`, que es la razón de ser de esta lista (§6.3). `notes/` nació del
  `{ create: true }` y se vio nacer.

- B · Verificado de verdad, con recarga de por medio y comprobando las fechas:
      sesión 1, 11:46:29  write → escritoA 09:46:29.777Z
      ── F5 ──
      sesión 2, 11:47:04  read  → escritoA 09:46:29.777Z
  El primer intento NO valió y conviene dejarlo escrito: se corrió el bloque B
  dos segundos después del A, sin recargar, leyendo con el mismo handle en
  memoria. Daba verde y no probaba nada. B sin F5 no es B.

- C · El paso importante, y pasa limpio:
      write → err {"kind":"permission-denied"}
      read  → err {"kind":"permission-denied"}
  Ni `⚠️ ¡HA LANZADO!` ni `io` en toda la pasada. Brave NO vuelve a pedir el
  permiso en la lectura: falla igual que la escritura (la lista contemplaba las
  dos conductas y pedía anotar cuál).
  Confirmado en el disco, que es lo que lo hace concluyente: el fichero seguía
  con mtime 11:51:20 después del write denegado de las 12:09:09. El
  `permission-denied` no era cosmético — no se escribió nada.
  Se revocó desde `brave://settings/content/siteDetails?site=http%3A%2F%2Flocalhost%3A8000`,
  con la página del andamio abierta y SIN recargar.

- D · `manual.json` desapareció y `notes/` siguió ahí; `delete` repetido → `ok`;
      `list` → `ok []`.

- E · Pasó, y además dos veces: la primera en Firefox (la pasada de abajo) y la
      segunda como prueba de humo de los botones de bloque nuevos.

- ⚠️ ERROR DE OPERADOR QUE MERECE LA PENA RECORDAR: en un intento anterior se
  eligió la subcarpeta `notes/` como raíz en vez de la carpeta de prueba. Todo
  siguió devolviendo `ok`, porque todo era correcto — respecto de la raíz
  equivocada. En el disco aparecía `elnotas-prueba/notes/notes/manual.json`.
  De ahí salieron los botones de bloque y el guardado del handle: el paso B ya
  no obliga a volver a pasar por el diálogo, así que esa trampa desaparece.

- ANDAMIO: en esta pasada se le añadieron a `verificacion-manual.html` los tres
  botones de bloque y el guardado del handle en IndexedDB. Lo que NO se le
  añadió, a propósito: ningún veredicto. La página sigue imprimiendo el
  `Result` crudo y no dice si algo pasa o falla — un andamio que se autoevalúa
  es juez y parte. `DirectoryHandleBlobStore.ts` no se tocó.
```

```
Fecha:        2026-09-13
Navegador:    Mozilla Firefox 153.0.4
Sistema:      Ubuntu 22.04.5 LTS
Quién:        programinx
Commit:       dec4306 — ⚠️ con el árbol SUCIO: todo el código de la Fase 3
              (blobs/, file/, Result.ts, errors/) estaba sin commitear, así que
              lo verificado NO es lo que hay en ese commit.

A · bytes al disco           [ ] pasa   [ ] falla   [x] no se ha podido probar
B · sesión nueva             [ ] pasa   [ ] falla   [x] no se ha podido probar
C · permiso revocado         [ ] pasa   [ ] falla   [x] no se ha podido probar
D · borrado                  [ ] pasa   [ ] falla   [x] no se ha podido probar
E · OPFS (opcional)          [x] pasa   [ ] falla   [ ] no se ha probado

Notas (lo que no encajó en una casilla, mensajes exactos, sorpresas de la API):

- A, B, C y D no se probaron por una razón sola: Firefox no tiene
  `showDirectoryPicker()`. Mensaje exacto del registro:
      no se eligió carpeta: ReferenceError: showDirectoryPicker is not defined
  Es un ReferenceError, no un SecurityError: la función no está declarada, no es
  que esté y se niegue. Lo anticipa la sección «Preparación» de esta misma lista.

- El contexto seguro NO era el problema, y conviene dejarlo escrito para que la
  próxima vez nadie lo persiga: `navigator.storage` también exige contexto seguro,
  y OPFS funcionó. Servidor y URL estaban bien.

- E pasó entera, con los cinco botones:
      write  → ok undefined
      read   → ok(45 bytes) con el JSON de `escritoA` bien formado y legible
      list   → ok ["notes/manual.json"]   ← camino COMPLETO, no sólo el nombre
      delete → ok undefined
      read de ausente → ok(null)          ← ausencia, que no es fallo (§6.5)

- Qué vale esta pasada y qué no. Vale: es la primera vez que las 156 líneas
  corren contra una API de navegador real, y el `list` recursivo con su prefijo
  se comportó. No vale como cierre del punto 5 de §9.9, y no por tecnicismo: lo
  que ese punto exige es lo que un doble no puede ver, y las tres cosas que
  enumera —bytes al disco, relectura en sesión nueva, permiso revocado por
  `Result`— necesitan la carpeta real. La propia sección E lo dice: no sustituye
  a la A, porque el `close()` sólo se comprueba contra una carpeta que uno pueda
  abrir. La escapatoria del «se anota lo que salga» cuelga del paso C, no de la
  lista entera.

- ⚠️ LO QUE SIGUE SIN VERIFICAR, y es lo que más importa: el clasificador de
  excepciones. Según §6.3 es justo la parte que creció y la que ningún doble
  puede probar, y es la que necesita los pasos C y D.

- Siguiente pasada: Brave 1.95.101, que está instalado en esta máquina por snap
  (no está en el PATH; se lanza con `snap run brave`). Es Chromium, así que sí
  tiene `showDirectoryPicker()`.
```

**El punto 5 del criterio de cierre de la Fase 3 (§9.9) queda CUMPLIDO** con la pasada de
Brave: A, B, C y D pasan, y E también. La de Firefox se conserva debajo porque documenta lo
que hace un navegador sin `showDirectoryPicker()`, que es información y no ruido.
