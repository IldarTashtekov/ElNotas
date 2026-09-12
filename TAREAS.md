# Tareas de ElNotas

Qué está pendiente, qué está sin decidir y qué ideas hay aparcadas. El diseño y sus por qués
están en `ARCHITECTURE.md`; las reglas para agentes, en `CLAUDE.md`.

**La disciplina que mantiene vivo este fichero: cada entrada tiene que ser cerrable.**
"Mejorar la UI" no se cierra nunca y no entra aquí. "Que `npm test` falle sin ficheros de
test" sí. Si una entrada no se puede marcar como hecha, o está mal escrita o es una idea
aparcada.

---

## Pendiente

### Fase 1 — Dominio puro ✅ TERMINADA

En este orden. El helper va primero y solo: es la única pieza con dificultad real y todo lo
demás se apoya en ella.

- [x] **El helper de copia por camino — primitiva A, "transformar un nodo".** ✅ Hecho, en
      `src/core/domain/updateContent.ts`: `mapPreservingIdentity`, un `updateCheckBoxes`
      recursivo (privado) y un `updateContent` de raíz parametrizado por `onText`/`onCheckBox`.
      **9 pruebas en verde**, y verificadas al revés: rompiendo la invariante a propósito por
      sus dos sitios, caen 6 y 5 respectivamente. **No se exporta por `index.ts`** a propósito:
      es maquinaria interna, y lo que consumirán `ui/` y `storage/` son las operaciones.
- [x] **La primitiva B, "transformar el contenedor de una línea"** — ✅ Hecha, en
      `src/core/domain/updateContainerOf.ts`. **Una sola función**, no dos: el contenedor es la
      lista raíz o **la casilla madre entera** (no su lista de hijas), porque `merge` necesita
      que la madre cambie de texto y pierda una hija a la vez. **12 pruebas.** No va en
      `index.ts`: maquinaria interna, como la A.
- [x] **El tipo `Position`**, el vocabulario del "dónde". ✅ Hecho, en
      `src/core/domain/Position.ts`, y exportado por `index.ts` porque **sí es API pública**:
      la UI construye posiciones para pasárselas a `insert`. Sin pruebas propias a propósito —
      es un tipo con tres constructores de una línea, y lo que de verdad hay que comprobar de
      él (que el `switch` sea exhaustivo) lo comprueba el compilador en `insert`. Decidido:
      **tres casos exactos** —`root-end`, `after`, `last-child-of`— y ninguno más, uno por cada
      estado de `ModosEscritura`. Su **único consumidor es `insert`**. `before`,
      `first-child-of` y `root-start` quedan fuera por coste de ramas a testear; el disparador
      para reabrirlo va en el mismo paquete que `move`. Razonado en `ARCHITECTURE.md` §9.4.
- [x] **Las ocho operaciones de contenido** — ✅ **Las ocho hechas.** Eran nueve, subieron a
      once y se quedaron en ocho: fuera `indent`, `outdent` y `move`; dentro las dos
      conversiones. Razonado en `ARCHITECTURE.md` §9.3.
  - [x] `setText`, `setChecked` — ✅ Hechas, en `src/core/domain/operations.ts` y exportadas
        por `index.ts`. **12 pruebas**, con las cinco filas de no-op de §9.3 cubiertas y una
        explícita de que `setChecked` **no arrastra a las hijas**.
  - [x] `insert`, `remove` — ✅ Hechas. **19 pruebas.** `remove` es no-op sobre una casilla con
        hijas (decisión (b)). A `insert` se le añadió una fila de no-op que no estaba en la
        tabla: **id repetido**, porque dos líneas con el mismo id hacen que toda operación
        posterior actúe siempre sobre la primera y jamás sobre la segunda.
  - [x] `convertToCheckBox`, `convertToText` — ✅ Hechas. **12 pruebas.** Las dos usan la
        primitiva **B**, no la A: la A no puede cambiar de variante por diseño (`Text → Text`,
        `CheckBox → CheckBox`), que es justo lo que hacen éstas. Conservan el `ContentId`, así
        que no necesitan `IdGenerator`. `convertToText` es no-op con hijas **y** anidada, y lo
        segundo sale solo de que `onParent` devuelva la madre intacta.
  - [x] `split`, `merge` — ✅ Hechas. **19 pruebas**, incluida una que recorre **todos** los
        puntos de corte de una línea, parte y vuelve a unir, y comprueba que sale el original:
        es la que caza que alguien añada un espacio de cortesía al unir. `split` es la única de
        las ocho que recibe un `ContentId` por parámetro. `merge` sube el texto a la hermana
        anterior, o **a la madre** si es la primera hija.
  - [x] ~~`indent`, `outdent`~~ — **eliminadas.** En el teclado de un móvil no hay Tabulador;
        el nivel se elige al nacer la línea, con el modo activo. Cerró (a) y (g) de golpe.
  - [x] ~~`move`~~ — **eliminada.** Nadie la usa: no hay gesto de arrastrar hasta la Fase 4, y
        no se construye lo que no tiene consumidor. Cerró (f) y (c). Aparcada abajo.
- [x] **Un test explícito por cada caso no-op** de la tabla de `ARCHITECTURE.md` §9.3. ✅
      Hecho sobre la marcha, operación por operación, con `assert.strictEqual`. Y cada guarda
      verificada **rompiéndola a propósito** para comprobar que la prueba salta.
- [x] **`core/ports/Clock.ts` y `core/ports/IdGenerator.ts`** — ✅ Hechos: sólo las interfaces,
      y exportadas por `index.ts` porque quien las implementa vive fuera del core. Sin
      implementaciones, a propósito: vivirían en `src/platform/`, que no nace hasta la Fase 4,
      y una prueba se fabrica su reloj en una línea. `IdGenerator` devuelve un `string` pelado
      y quien llama lo marca con el constructor que toque: el generador no sabe qué clase de
      id estás creando. **Sin pruebas propias**: son interfaces, no hay comportamiento que
      comprobar. Lo que sí se verificó a mano es la verja (ver la tarea de abajo).
- [x] **La rebanada vertical** — ✅ Hecha, en `src/core/app/`: `Action`, `reduce`, `Store` y
      `createUseCases`. **16 pruebas.** Demuestra el criterio de cierre: tres despachos
      redundantes seguidos → **un solo aviso**, y `updatedAt` con la hora del primero.
      El `Store` es **una función, no una clase**: el estado vive en una clausura, así que no
      hay camino hasta él —el `private` de TypeScript desaparece al ejecutar—.
      La lista de suscriptores **se reemplaza, nunca se muta en el sitio**, y eso resuelve
      gratis que uno pueda darse de baja durante su propio aviso.
- [x] **Exportar por `src/core/index.ts`** — ✅ Hecho sobre la marcha, pieza a pieza. Fuera
      quedan **a propósito** las dos primitivas del helper y `reduce`: son maquinaria interna,
      y lo que consumen `ui/` y `storage/` son las operaciones, el `Store` y los casos de uso.

**Los seis puntos del criterio de cierre (`ARCHITECTURE.md` §9.5), cumplidos:** el helper
devuelve la entrada intacta en sus dos casos · las ocho operaciones existen · cada una tiene
pruebas de valor y de identidad con `strictEqual` · cada fila de no-op de §9.3 está probada ·
la rebanada demuestra que tres despachos redundantes dan **un solo aviso** y no tocan
`updatedAt` · `npm run check` en verde con **99 pruebas**, e incapaz de pasar en falso.

### Fase 2 — Acciones, persistencia y memory

**En este orden, y el orden es la decisión.** Se ataca **de abajo arriba**: la persistencia
entera primero, verificada con la única acción que ya existe, y sólo después las quince que
faltan. El write-behind es la única pieza con riesgo real de la fase, y se quiere descubrir que
escribe de más cuando hay **un solo candidato**, no dieciséis. Es el mismo razonamiento que la
rebanada vertical de la Fase 1. Criterio de cierre en `ARCHITECTURE.md` §9.8.

- [x] **Los tres puertos de persistencia** — ✅ Hechos, en `src/core/ports/Repository.ts`,
      `StorageAdapter.ts` y `BlobStore.ts`, y exportados por `index.ts` porque quien los
      implementa vive fuera del core. **Sólo interfaces**, como `Clock` e `IdGenerator`, y
      **sin pruebas propias**: no hay comportamiento que comprobar. Todo `async` aunque el
      adaptador de memoria vaya a ser síncrono — si expone firmas sincrónicas, enchufar un
      fichero después obliga a reescribir a todos los llamantes, no sólo al adaptador.
      **Dos desvíos del boceto de §6.1**, los dos al escribirlos: el id de `Repository` va
      **marcado** (`Repository<Note, NoteId>`), verificado rompiéndolo —pasar un `ContextId` a
      `notes.get` da `TS2345`—; y son **propiedades de función, no métodos**, porque TypeScript
      comprueba los métodos de forma bivariante incluso con `strict`. `BlobStore` se adelanta
      sin consumidor hasta la Fase 3, con el mismo trato que tuvieron `Clock` e `IdGenerator`.
- [x] **`MemoryStorageAdapter` y la suite de contratos** — ✅ Hechos. Nace `src/storage/` con
      su `index.ts`, y con él el alias `#storage/*`. **17 pruebas**, y ninguna escrita para el
      adaptador en concreto: las diecisiete son del contrato, y el fichero
      `MemoryStorageAdapter.test.ts` cabe en una línea. El de la Fase 3 tendrá otro igual.
      Tres cosas que salieron al escribirlo:
  - **El contrato usa `deepEqual`, y es lo correcto** — el único sitio del proyecto donde lo
    es. Un almacén no promete devolver el mismo objeto: el de memoria lo hace porque no
    serializa, el de fichero devolverá uno recién salido de un `JSON.parse`. Exigir
    `strictEqual` sería exigir algo que sólo el de memoria puede cumplir, o sea lo contrario
    de para lo que existe un contrato. Escrito en el fichero para que nadie lo "arregle".
  - **La suite se llama `storageContract.test.ts` aunque no tenga ni una prueba**, porque
    importa `node:test` y `tsconfig.json` va sin los tipos de Node. Se prefirió el nombre a
    añadir una exclusión a mano en la config de la app.
  - **Tres pruebas de contrato no son de `Repository` sino de que los tres estén aislados**, y
    de que una entidad con contenido sobreviva entera. Sin ellas, un adaptador que guardara las
    tres clases en el mismo saco, o que se dejara `items` por el camino, pasaría todo lo demás.
  - **Verificado rompiéndolo por tres sitios**, y en los tres cayó lo que tenía que caer:
    quitar el `async` de `transaction` tumba **1** (la del fallo síncrono, y sólo ésa); un
    `Map` compartido por los tres repositorios tumba **4**; devolver `undefined` en vez de
    `null` en `get` tumba **2**. Todo revertido.
- [x] **El write-behind, que son DOS piezas y no una** — ✅ Hecho. `diffState.ts` en
      `core/app/` (puro, **11 pruebas**) y `writeBehind.ts` en `src/storage/` (**11 pruebas**),
      los dos exportados por sus `index.ts`. La programación va **por parámetro**, así que las
      pruebas usan un reloj de mentira y no esperan ni un milisegundo. Sin puerto `Scheduler`:
      partido así, el core no necesita temporizar nada. Cuatro cosas que salieron al hacerlo:
  - **El diff se calcula contra "lo último escrito", no contra el aviso anterior.** El
    `Listener` del `Store` sólo trae el estado nuevo, así que el escritor recuerda el último
    que llegó a disco. Sale gratis un caso que si no habría que tratar a mano: **una nota
    creada y borrada dentro de la misma ráfaga no llega nunca a disco**.
  - **El orden importa: primero todos los `put`, después los `delete`.** Si el proceso muere a
    mitad, así el peor caso es un contexto ya limpio y una nota que sobra —basura inofensiva—;
    al revés sería una `ItemRef` colgando, que es lo que prohíbe la integridad referencial.
  - **Las pruebas cuentan transacciones además de escrituras**, y no es un adorno: sin ese
    contador, quitar del escritor el corte de "si no cambió nada no toques el disco" **no
    rompía ninguna prueba**, porque un diff vacío no genera ningún `put` de todas formas.
  - **Verificado rompiéndolo por tres sitios:** quitar el corte del eslabón ② tumba **2**;
    no cancelar la espera anterior tumba **1**; comparar por valor en vez de por referencia
    tumba **1**… y esa última sólo por accidente, así que se añadió una prueba explícita de
    que **una copia equivalente SÍ cuenta como cambio**, que es la semántica elegida y lo que
    impide que alguien "mejore" el diff comparando por valor. Todo revertido.
- [ ] **La prueba que cierra la cadena entera:** un `set-checked` redundante **no llega a
      disco**. La Fase 1 demostró que no notifica al suscriptor; esto es el eslabón siguiente
      (§3 ②), con un `StorageAdapter` que cuente escrituras. **Es el punto de la fase que hay
      que escribir mirándolo**; todo lo demás es mecánico.
- [ ] **Las siete acciones de contenido** — `set-text`, `insert`, `remove`, `split`, `merge`,
      `convert-to-checkbox`, `convert-to-text`. Mecánicas: su caso de reducer es calcado al de
      `set-checked`. Lo único que vigilar es que **ninguna de las siete se salte la comparación
      `content === note.content`**. Al añadir la segunda, el `switch` deja de ser exhaustivo
      solo y el compilador empieza a exigir las demás.
- [ ] **Las acciones de Nota** — `create-note`, `rename-note`, `delete-note`. `create-note`
      recibe el `NoteId` **ya hecho** del caso de uso, igual que `split` recibe su `ContentId`.
- [ ] **Las acciones de Contexto** — `create-context`, `rename-context`, `delete-context`,
      `add-item`, `remove-item`, `set-default-view`. **Aquí está la enjundia de la fase:**
      `delete-note` es la primera acción que toca **dos entidades a la vez** y tiene que dejar
      los contextos consistentes, con el **mismo `meta`** para todos los tocados y los demás
      **intactos por referencia**. `add-item` es no-op si la entidad referenciada no existe.
      → `ARCHITECTURE.md` §9.7
- [ ] **`schemaVersion`, el runner de migraciones y `hydrate`.** Nace `src/core/migrations/`.
      `schemaVersion` **no se añade a `AppState`** —ya vive en `StorageAdapter`, que es donde
      significa algo—, y hay que **corregir el comentario de `AppState.ts`**, que hoy dice que
      falta. `hydrate(entidades) → AppState` entra aquí por ser pura; el arranque de verdad
      (quién abre el storage, qué se enseña si no hay nada) es Fase 4. → `ARCHITECTURE.md` §9.7

**Lo que NO entra en esta fase, dicho para que nadie lo dé por hecho:** ninguna acción de Plan
—se persisten, no se operan—; ninguna acción compuesta —cascada de `setChecked`, borrar una
rama—; ningún fichero de verdad; y nada de UI.

### Infraestructura (`infra-agent`)

Las cuatro son de `src/`, `package.json` o los tsconfig, así que **no las toca el rol de
documentación**.

- [x] **Que `npm test` falle si no hay ficheros de test.** ✅ Hecho. `tools/require-tests.mjs`
      cuenta los `*.test.js` de `tmp-test/` y sale con código 1 si no hay ninguno, porque
      `node --test` sin ficheros imprime `1..0` y **sale con código 0**. Mira la salida
      compilada y no las fuentes a propósito: así caza también las pruebas escritas que no
      llegan a compilarse adonde el runner las busca.
- [x] **Que `tmp-test/` se limpie antes de cada compilación.** ✅ Hecho,
      `tools/clean-tmp-test.mjs`. Salió al verificar lo anterior: **`tsc` no borra lo que
      sobra**, sólo emite, así que una prueba borrada dejaba su `.js` atrás y `node --test`
      seguía ejecutándola. Pruebas fantasma de código que ya no existe, y pruebas renombradas
      corriendo dos veces.
- [x] ✅ **`npm run check` vuelve a estar en verde**, y ahora significa algo: 9 pruebas
      ejecutándose de verdad. Hoy van 99.
- [x] **Que `npm run check` falle ante `Date.now()`, `Math.random()` o `new Date(` en
      `src/core`.** ✅ Hecho: `tools/check-core-purity.mjs`, enchufado como `npm run
      check:purity`. Tapa el único hueco de la verja — `Date` y `Math` están en `lib.es5.d.ts`,
      dentro de `lib: ["ES2020"]`, y **compilan** dentro del core (recomprobado el 2026-09-06:
      `crypto.randomUUID()` da `TS2304`, `Date.now()` no da nada).
      **No es un `grep`**, y no puede serlo: los comentarios del proyecto mencionan
      `Date.now()` a propósito —son justo los que explican la regla—, así que un `grep` daría
      positivo en `Clock.ts` y en el propio guardián. Lleva un escáner que borra comentarios y
      cadenas antes de buscar. Y **`${Date.now()}` dentro de una plantilla sí salta**, que es
      de las formas más plausibles de colarlo sin querer.
      Verificado en los tres sentidos: pasa limpio, caza las cuatro violaciones reales sin
      tocar las menciones en comentarios ni en cadenas, e ignora los `*.test.ts`.
- [x] **Corregir el comentario de `src/core/domain/Versioned.ts`** — ✅ Hecho. Decía que
      `Date.now()` "dentro del core no compila", y es falso. Ahora dice quién lo caza de
      verdad (`npm run check:purity`) y por dónde llega la hora: dentro del `meta` de la
      acción, porque el reducer es puro.
- [x] **Borrar la mención a vitest de `src/core/tsconfig.json`** — ✅ Hecho, y de paso se
      añade ahí el aviso de que **la verja no cubre el reloj ni el azar**, que era justo el
      sitio donde faltaba: quien va a tocar la verja lee ese fichero.

---

## Sin decidir

**No las resuelva por su cuenta quien implemente.** Si te topas con una, pregunta.

### Las siete de la Fase 1 — ✅ **cerradas las siete**

**No queda ninguna abierta: la Fase 1 está especificada entera y se puede escribir de un tirón.**
Se dejan aquí con su respuesta porque el valor está en el porqué, no en la casilla marcada. Las
letras no se reciclan, para que las referencias de `ARCHITECTURE.md` sigan valiendo.

| | Pregunta | Qué depende de ella |
|---|---|---|
| ~~**(a)**~~ | ✅ **Cerrada por eliminación.** Preguntaba qué hace `indent` sobre un texto; `indent` ya no existe. → `ARCHITECTURE.md` §9.3 | |
| ~~**(b)**~~ | ✅ **Cerrada.** Ninguna de las dos: `remove` sobre una casilla con hijas es **no-op**. Se borra de abajo arriba. → `ARCHITECTURE.md` §9.3 | Desbloqueó la primitiva B. Deja **dos deberes**: `move` no puede ser `remove`+`insert`, y la Fase 4 necesita un "borrar rama" explícito. |
| ~~**(c)**~~ | ✅ **Cerrada por eliminación.** Preguntaba cómo detectar el ciclo al mover algo dentro de su propio subárbol; `move` ya no existe, así que no hay destino que comprobar. → `ARCHITECTURE.md` §9.3 | |
| ~~**(d)**~~ | ✅ **Cerrada.** `Position` tiene tres casos y no más. → `ARCHITECTURE.md` §9.4 | |
| ~~**(e)**~~ | ✅ **Cerrada.** El helper es **dos primitivas**; la A va parametrizada por variante con la recursión escrita una sola vez. → `ARCHITECTURE.md` §5.4 | Destapó que la primitiva B queda pendiente de **(b)**. |
| ~~**(f)**~~ | ✅ **Cerrada. Son ocho:** `setText`, `setChecked`, `insert`, `remove`, `split`, `merge`, `convertToCheckBox`, `convertToText`. Fuera `indent`, `outdent` y `move`. → `ARCHITECTURE.md` §9.3 | Cerró también la (c), y fija el tamaño de la Fase 1: ninguna de las ocho pasa de dificultad media. |
| ~~**(g)**~~ | ✅ **Cerrada por eliminación.** Preguntaba qué pasa con los hermanos al hacer `outdent`; `outdent` ya no existe. → `ARCHITECTURE.md` §9.3 | |

### Del editor (Fase 4)

No bloquean nada de la Fase 1, pero salieron al diseñar `ModosEscritura` y se pierden si no se
apuntan.

- **El escalón infinito en modo *Casilla hija*.** Si cada Intro creara una hija de la línea
  actual, irías bajando un nivel por pulsación y **sin `outdent` no habría forma de subir**.
  La regla tiene que ser que el modo baje un nivel **una sola vez**, y de ahí en adelante las
  siguientes sean hermanas en ese nivel. Falta confirmarlo.
- **Cómo se baja un segundo nivel.** Con el ciclo actual (*Texto → Casilla → Casilla hija →
  Texto*) hacen falta tres pulsaciones del botón para volver a *Casilla hija*. Si se quiere
  anidar con soltura, hay que replantear el ciclo.
- **Las cuatro esquinas del teclado propuestas en `ARCHITECTURE.md` §7.3** y sin confirmar:
  cursor al final al pulsar el botón de modo · volver de *Casilla* a *Texto* con el botón ·
  unir dos textos normales sin casilla de por medio · partir una casilla que tiene hijas.
- **El identificador de `ModosEscritura` en el código.** El concepto se llama así; el nombre
  en el código está sin fijar, porque todo lo demás está en inglés (`WritingMode`, y en
  singular). O se cambia la convención a conciencia y para todo. → `ARCHITECTURE.md` §7.2

### Cómo se verifica la Fase 3

Los adaptadores sobre `FileSystemDirectoryHandle` y OPFS **necesitan un navegador real**, y
`node:test` no llega ahí. Hoy figura como "pendiente de decidir al llegar", pero **se puede
decidir ya**: no depende de nada que no se sepa hoy.

Aplazarlo tiene dos costes concretos. Uno, convierte la Fase 3 en **la única con riesgo
desconocido**: no sabemos si es un problema de una tarde o de una semana. Dos, si la respuesta
acaba siendo Playwright o similar, **choca de frente con la política de cero dependencias** —y
esa conversación es mejor tenerla ahora que con la fase a medias.

Opciones que se ven desde aquí: verificar solo `LocalStorageBlobStore` en automático y el
resto a mano; instalar un runner de navegador **solo para esa fase** (coherente con la
política de dependencias por fase); o aceptar que ese adaptador se valida manualmente y
documentarlo como tal.

### ~~La justificación escrita de `schemaVersion` no es la real~~ — ✅ **cerrada**

**Se adopta la razón buena y se reescribe.** El argumento viejo —«añadirlo cuando ya haya notas
guardadas sería una migración de datos»— **no aplica**, porque no hay nada guardado todavía y
por tanto valdría igual para `Versioned`, que sí se adelantó. La razón real: **`schemaVersion`
*es* el mecanismo de migración**, y un número de versión que nadie lee no protege nada, así que
llega con el runner que lo consume.

De paso se cierra dónde vive: **en `StorageAdapter`, no en `AppState`**. Es una propiedad de lo
guardado; en el estado en memoria no significaría nada y cada acción tendría que arrastrarla.
Queda pendiente **corregir el comentario de `AppState.ts`**, que hoy dice que falta ahí.
→ `ARCHITECTURE.md` §9.7

### ~~El arranque de la app no tiene fase asignada~~ — ✅ **cerrada: tenía dos**

Por eso no encajaba en ninguna. **Se parte**, por la misma costura que el write-behind:

- **la parte pura, en la Fase 2** — `hydrate(entidades) → AppState` y el runner de migraciones.
  De datos a datos: se prueban sin navegador y sin temporizadores.
- **la parte impura, en la Fase 4** — quién abre el storage y en qué orden, y qué se le enseña
  al usuario si no hay nada guardado (¿nota de bienvenida? ¿contexto vacío?). Eso es
  composición y decisión de producto, y vive en `platform/web/`, que no nace hasta entonces.

→ `ARCHITECTURE.md` §9.7

---

## Ideas aparcadas

Lo que se contempló y no se eligió. Cada una con **qué haría falta para que mereciera la
pena**: esa última parte es la que evita volver a discutirlo desde cero.

| Idea | Por qué no ahora | Qué la desbloquearía |
|---|---|---|
| **Reordenar y re-anidar líneas** (`move`, y con ella `indent`/`outdent`) | No hay quien lo use: sin gesto de arrastrar, `move` no tiene consumidor, y el Tabulador no existe en un móvil. Hoy una lista se queda en el orden en que se escribió, y arreglarla es borrar y reescribir. | Llegar a la Fase 4 y **echarlo de menos con el editor delante**. Es puramente añadido —no cambia ninguna operación, ni el formato en disco, ni obliga a migrar—, así que cuesta lo mismo entonces que hoy. Ojo a dos cosas ese día: hace falta un cuarto caso de `Position` (`before`, para "la primera del todo"), y `move` **no** puede escribirse como `remove` + `insert` o heredaría la guarda de las casillas con hijas. |
| **Adaptador de MongoDB** | Requiere un backend HTTP propio: el driver de Mongo habla TCP y no funciona desde navegador, y la Data API de Atlas está retirada. | Que hubiera ya un backend propio por otro motivo. Montar uno solo para esto no sale a cuenta. |
| **Adaptador de Google Drive** | Escribir **siempre** exige OAuth (scope `drive.file`), aunque la carpeta sea pública. Eso arrastra registro de app, PKCE y gestión de tokens. | Querer de verdad sincronizar entre dispositivos, y aceptar el coste de OAuth. Antes tendría que estar cerrado el `BlobStore`. |
| **`CompositeStorage` y outbox durable** | Sin consumidor mientras haya un solo backend. La semántica (local primario + réplicas con reintentos) ya está decidida. | Que exista un segundo backend real. Ni un día antes: es infraestructura para un problema que aún no se tiene. |
| **`storageTarget` por contexto** (enrutar notas privadas a un backend concreto) | Presupone varios backends, que no existen. | Lo mismo que el anterior, más una necesidad real de separar notas por destino. |
| **El editor de grafos de los Planes** | Los tipos de `Plan` están, pero no hay ni una operación. Es una app dentro de la app. | Que la parte de Notas esté terminada y en uso. Anotado: si llega, `Plan.nodes` probablemente deba pasar de array a `Record`, porque las aristas se guardan por id y con array toda búsqueda es lineal. |
| **Shells de escritorio y móvil (Tauri / Capacitor)** | Envuelven el output del build web; no hay build web todavía. | Una Fase 4 terminada. Y ese es el momento de reconsiderar los workspaces de npm, no antes. |
| **Sync entre dispositivos, CRDTs, colaboración en tiempo real** | Salto enorme de complejidad. `revision` ya deja la puerta abierta a detectar conflictos, que es el 10% que sí hacía falta desde el principio. | Uso real en dos dispositivos y una política de conflictos elegida a conciencia. "Gana el último" ya está descartada. |
| **Migrar de webpack a Vite** | Webpack sigue siendo el bundler previsto para la Fase 4, hoy desinstalado. Migrar **no afecta a la arquitectura**, así que no urge. | Llegar a la Fase 4 y comparar los dos entonces. Está fuera de "decisiones cerradas" a propósito: es una opción abierta, no un compromiso. |
| **Prototipo desechable del editor** (solo DOM, sin core y sin persistencia) | Es trabajo que se tira. | Nada: **puede que merezca la pena ya.** El editor con `contenteditable` es la parte más difícil del proyecto, está **al final del plan** y es la única sin verificación automática posible. Un prototipo de un rato responde pronto a la pregunta que más riesgo esconde: ¿aguanta en la práctica la regla de que "el nodo enfocado no se re-renderiza"? Si no aguanta, es mejor saberlo antes de construir tres fases encima. |
