# Arquitectura de ElNotas

**El fundamento**: los principios de los que sale cada decisión del proyecto, con su porqué, y
los conceptos que hacen falta para entenderlos. Se lee a demanda, no en cada sesión.

**Qué entra aquí, y qué no.** La prueba es una pregunta: *¿seguiría siendo verdad si mañana se
reescribe esa parte del código?* Si sí, es un principio y va aquí. Si no, es anatomía —qué fichero
hace qué, cómo se monta una pantalla—, y ya la cuentan el código, sus cabeceras y las pruebas, que
cambian a la vez que lo que describen. Las decisiones de cada funcionalidad son reglas de una línea
en `CLAUDE.md`; su historia, en `TERMINADAS.md` y en `git log`. Lo vigila `npm run check:arquitectura`.

**Cuándo se toca.** Casi nunca. Una decisión nueva que no se explica desde ningún principio de aquí
no pide escribirle un porqué: o falta un principio, o la decisión está mal. Sólo lo primero es motivo
para editar este documento.

**Índice**

1. [Las reglas las hace cumplir la máquina](#1-las-reglas-las-hace-cumplir-la-máquina)
2. [Conceptos desde cero](#2-conceptos-desde-cero)
3. [La cadena de la identidad](#3-la-cadena-de-la-identidad)
4. [Las capas: puertos y adaptadores](#4-las-capas-puertos-y-adaptadores)
5. [El dominio](#5-el-dominio)
6. [La persistencia](#6-la-persistencia)
7. [La UI](#7-la-ui)
8. [La infraestructura](#8-la-infraestructura)
9. [Cómo se trabaja](#9-cómo-se-trabaja)

---

## 1. Las reglas las hace cumplir la máquina

Una regla que sólo vive en un documento se erosiona. Nadie la rompe a propósito: se rompe por
descuido, meses después, en un fichero que nadie relee. **Cada regla importante se convierte en algo
que falla solo**: un error de compilación, si se puede; si no, un guardián dentro de `npm run check`.

| Mecanismo | Regla que hace cumplir | Sin él |
|---|---|---|
| **La verja de pureza** (el `tsconfig` del core, sin DOM ni tipos de Node) | el core no toca la plataforma | un `document.` acaba en el dominio y nadie se entera |
| **`readonly` / `ReadonlyArray`** | inmutabilidad | un `push` silencioso rompe la detección de cambios |
| **Tipos marcados** (`NoteId`, `DiagramId`…) | no confundir un id con otro | un `DiagramId` donde va un `NoteId` falla en ejecución |
| **Uniones discriminadas** | tratar todos los casos | un caso nuevo y nada avisa de dónde falta |
| **`noUncheckedIndexedAccess`** | tratar «ese id no existe» | un `undefined` se cuela por una búsqueda |
| **`Result<T, E>`** (§6.4) | tratar el fallo | una excepción sube sin tipo y nadie sabe que existe |
| **Los guardianes** | lo que el compilador no ve | lo que funciona mal en silencio |

**Qué merece un guardián:** lo que **funciona mal en silencio**. Una regla de legibilidad no lo
merece —el código se lee peor, pero no falla—, y por eso la de tipos explícitos no tiene ninguno
(§2.4). **Un análisis vale si falla el build, es rápido y casi nunca se equivoca.** Un aviso que se
puede ignorar, se ignora; un informe o un panel no hacen cumplir nada.

**Un guardián se verifica rompiéndolo a propósito.** Que todo esté en verde no demuestra que el
guardián detecte algo: podría no estar mirando nada. Cada guarda, cada invariante y cada prueba que
vigila algo se rompe a propósito y se ve caer. Las roturas que lo demuestran se guardan en una lista
y se repasan solas (`npm run check:roturas`), para el día en que una prueba se reescriba y deje de
vigilar sin que nada avise.

**`check` no puede pasar en falso.** `node --test` sin ningún fichero de pruebas sale en verde sin
ejecutar nada; un guardián lo impide. Un guardián que falla no se «arregla» quitándolo: el fallo es
lo que avisa.

**El orden importa.** La verja y los guardianes van **antes** del código que vigilan. Un guardián
que llega después llega tarde: lo que ya se coló no lo va a buscar nadie.

---

## 2. Conceptos desde cero

El vocabulario del resto del documento, con ejemplos del dominio real: notas, líneas de texto y
casillas anidadas.

### 2.1 El patrón de estado

**Estado.** Una sola foto de todos los datos de la app, en un solo objeto (`AppState`): todas las
notas, todos los diagramas y todos los contextos. Lo contrario es tener los datos repartidos —un
array por aquí, una variable por allá y el DOM guardando por su cuenta lo que se escribe—, y
entonces «cuál es el estado de la app» no tiene respuesta y dos sitios pueden discrepar.

**Acción.** Un objeto plano que describe qué ha pasado. No hace nada: es un dato, como un asiento en
un libro de cuentas.

```ts
{ type: "set-checked", noteId, contentId, checked: true, meta: { now, revision } }
```

Que sea un dato y no una llamada permite registrarla, guardarla, compararla en una prueba o mandarla
por la red tal cual. **Trae ya puestas la hora y la revisión** (`meta`), en vez de que las calcule
quien la procesa.

**Reducer.** Una función `(estado, acción) => estado`: recibe la foto actual y una acción, y devuelve
la siguiente sin tocar la que recibe. Tiene la forma del callback de `Array.reduce`, y la analogía es
el modelo mental entero: **la app es un `reduce` sobre las acciones del usuario.** Dos exigencias:

- **puro**: ni reloj, ni ids, ni disco, ni DOM. Mismos argumentos, mismo resultado, y sus pruebas no
  simulan nada;
- **total**: **no lanza nunca**. Una acción que no se puede aplicar no hace nada y devuelve el estado
  que recibió. «El usuario pulsó algo raro» no es motivo para tumbar la app.

**Store.** La caja que guarda el estado actual, recibe acciones y avisa a quien escuche. Su
`state = next` es **la única reasignación del estado**: los datos siguen siendo inmutables; lo que
cambia es qué foto es «la actual». Una app interactiva tiene por definición un «ahora» distinto de su
«antes», así que no se evita la mutación: se confina en **un sitio pequeño y localizable**. Es una
clausura y no una clase, porque la UI recibe `dispatch` suelto y una clase lo perdería con su `this`.
Su lista de suscriptores **se sustituye, nunca se muta en el sitio**, para que darse de baja durante
un aviso no corrompa el recorrido en curso.

**`dispatch` y suscriptores.** `dispatch` es **el único verbo que la UI conoce**: construye una
acción y la despacha, sin saber qué hay detrás. Los suscriptores se enteran del cambio y son
independientes: el render redibuja; la persistencia apunta qué cambió y lo escribe más tarde. Que la
persistencia sea un suscriptor más es lo que permite que el dominio no sepa nada de discos.

**Caso de uso.** La capa que tiene los puertos inyectados y construye el `meta` de la acción: **la
frontera entre lo impuro y lo puro**. Todo lo de dentro (reducer, operaciones, dominio) se prueba sin
simular nada. Como `meta` se construye **una vez por acción**, todas las entidades que toca reciben la
misma marca de tiempo.

### 2.2 Los conceptos de arquitectura

**Puerto y adaptador (hexagonal).** Un **puerto** es una interfaz que declara *qué necesita* el
dominio; un **adaptador**, una implementación concreta.

```ts
export interface Clock { now(): number }                         // puerto: código DEL CORE
export const systemClock: Clock = { now: () => Date.now() }      // adaptador: fuera del core
```

⚠️ **La interfaz del puerto vive dentro del core.** No es algo que se le quita al dominio: es **el
dominio declarando la forma de lo que necesita**. Quién lo cumple es asunto de otra capa.

**Núcleo funcional, cáscara imperativa.** El núcleo es puro: funciones de valores a valores. La
cáscara habla con el mundo —DOM, disco, red, reloj—, entra al núcleo con datos, recoge el resultado y
sale a escribir. El núcleo nunca llama hacia fuera.

> **El tiempo y el azar son entrada/salida**, igual que leer un fichero.

`Date.now()` es una llamada a un servicio externo —el reloj del sistema— aunque sea síncrona y
barata. **El criterio práctico:** si llamándolo dos veces seguidas puede dar respuestas distintas, es
E/S. Por eso la hora y los ids entran por puerto y viajan dentro de la acción.

**Inversión de dependencias.** Las flechas van siempre **de fuera hacia dentro**: la composición
conoce el core; el core no conoce a nadie. El core define `Clock`; fuera se implementa. El core
**usa** un reloj sin **conocer** ninguno, y de ahí salen las tres ganancias: probar el dominio con
`{ now: () => 1000 }`, añadir otra plataforma al lado sin tocar el core, y cambiar de UI sin poder
romper el dominio.

**Write-behind, debounce y *dirty tracking*.** Tres cosas distintas:

- **write-behind**, el *qué*: escribir **después**. La memoria es la verdad inmediata y el disco la
  persigue por detrás. Escribir es *la* acción de una app de notas: con escritura inmediata, una línea
  de veinte letras serían veinte escrituras de la nota entera;
- **debounce**, el *cuándo*: esperar a que haya calma, y cada cambio reinicia la cuenta. No es un
  *throttle*, que escribiría a mitad de palabra;
- ***dirty tracking***, el *qué se escribe*: sólo lo que cambió. **Ese «¿está sucia?» es un `===`**,
  el eslabón ② de §3.

**El precio de diferir no se arregla con más debounce:** si la app muere entre el cambio y la
escritura, el cambio se pierde. Se paga forzando la escritura al cerrar y al pasar a segundo plano,
que en el móvil es la última ocasión segura.

### 2.3 Estructuras inmutables

**Igualdad por referencia.** `===` entre objetos no compara contenido: pregunta si son **el mismo
objeto**. Cuesta lo mismo comparar dos números que dos árboles de diez mil nodos, y por eso es **el
motor de todo**: «¿ha cambiado esta rama?» se contesta en tiempo constante… si el código respeta la
invariante de identidad (§3).

**Copia por camino (*structural sharing*).** Cambiar algo hondo en un árbol inmutable obliga a crear
objetos nuevos, y la pregunta es cuántos. La lista de la compra:

```
ANTES                              DESPUÉS (tras marcar "Peras")

content                            content              ← objeto NUEVO  (1)
├── Text "Compra semanal"          ├── Text ··········· MISMO objeto (===)
├── CheckBox "Fruta"               ├── CheckBox "Fruta" ← objeto NUEVO  (2)
│   ├── CheckBox "Manzanas"        │   ├── "Manzanas" ·· MISMO objeto (===)
│   └── CheckBox "Peras"     ☐     │   └── "Peras"   ☑  ← objeto NUEVO  (3)
└── CheckBox "Limpieza"            └── CheckBox ······· MISMO objeto (===)
    └── CheckBox "Fregona"             └── "Fregona" ··· (con su subárbol entero)
```

Se reconstruye **sólo el camino** de la raíz a lo que cambia; lo demás se reutiliza por referencia.
**El coste es la profundidad, no el tamaño**, y **el render se salta ramas enteras** con un `===`. Es
la técnica de Immer, de Redux y de las estructuras persistentes de Clojure, hecha a mano en unas
pocas líneas porque la alternativa nativa cabe en un fichero.

**La trampa: `map`, `filter` y el spread siempre crean objeto nuevo**, aunque no cambie nada.

```ts
a.map(x => x) === a                   // false
const c2 = { ...c, checked: true }    // nuevo AUNQUE c.checked ya fuera true
```

Escrito así, el dominio **desactiva en silencio** toda la detección de cambios: cada operación
devuelve estructura nueva, y todo se redibuja y se escribe de más. **No falla nada**: sólo va más
lento, por un motivo invisible. Hacen falta envoltorios que comparen y, si nada cambió, devuelvan la
entrada intacta.

**`assert.strictEqual`, nunca `deepEqual`, en las pruebas de identidad.** Un `deepEqual` pasa igual
de verde con una implementación que rompe la invariante, porque el contenido sería correcto y sólo las
referencias estarían mal. Y también en positivo: comprobar que la rama que **no** se tocó sigue siendo
el mismo objeto.

### 2.4 Los conceptos de TypeScript

**Tipo marcado (*branded type*).** Un `NoteId` es un `string` en ejecución, pero un `string` no es un
`NoteId`:

```ts
declare const brand: unique symbol
type Branded<T, B extends string> = T & { readonly [brand]: B }
export type NoteId = Branded<string, "NoteId">
```

Con estado normalizado todo se referencia por id, y sin marcarlos pasar un id de diagrama donde va
uno de nota compila. La marca no existe en ejecución: **coste cero**. Se cruza sólo por los
constructores, los únicos sitios con el `as`.

**Unión discriminada y exhaustividad.** Con un campo literal (`type: "text" | "checkbox"`), el
compilador **estrecha** dentro de cada rama y **comprueba que no falte ninguna**: en el `default`, la
variable es `never`, y el día que llegue un caso nuevo eso deja de compilar en **todos** los sitios que
hay que tocar. Con un `type: string` no habría ninguna de las dos cosas.

**`readonly` y `ReadonlyArray`.** El mismo array en ejecución, con `push`, `splice` y compañía
**quitados del tipo**. «Nunca `push`» deja de depender de que alguien se acuerde.

**`noUncheckedIndexedAccess`.** Indexar un `Record` da `T | undefined`. Es fricción real, aceptada a
propósito: con todo buscado por id, «ese id no existe» es justo el fallo que no se quiere descubrir en
ejecución. Encaja con el reducer total: si no está, no hace nada.

**Type guard.** Una función `x is CheckBox` que le enseña al compilador a estrechar. Es la pregunta
«¿tiene hijas por las que bajar?» de cada recorrido del árbol.

**Tipo explícito en todo, aunque se infiera.** Para que **un cambio de tipo se vea en el diff** en vez
de que la inferencia lo absorba. Cuatro excepciones, con su motivo: `for…of` (lo prohíbe el lenguaje),
la constante que *es* una función (su tipo de retorno hace el trabajo), `as const` (la anotación
ensancharía lo que estrecha) y la desestructuración (no hay dónde ponerla). **Sin guardián, a
propósito:** es legibilidad, no corrección (§1).

---

## 3. La cadena de la identidad

Lo más importante del documento. Lo que aparece como reglas sueltas —«preserva la identidad», «un
no-op no hace nada», «usa `strictEqual`»— **es una sola cosa**:

> **Si una operación no cambió nada, devuelve el objeto de entrada. El mismo, no una copia
> equivalente.**

De esa invariante cuelgan cuatro decisiones en cuatro capas, cada una con un `===`:

```
   una operación de dominio devuelve el MISMO objeto
                        │
   ① el REDUCER          ¿cambió? no → el estado tal cual, sin estampar updatedAt ni revision
                        │
   ② la PERSISTENCIA     ¿quedó sucia? no → no se escribe
                        │
   ③ el STORE            ¿next === state? sí → no avisa a nadie
                        │
   ④ el RENDER           ¿es la misma rama? sí → no se redibuja
```

Al revés: **una sola función mal escrita desactiva las cuatro a la vez.** Marcar una casilla ya
marcada acabaría en una escritura a disco y en un repintado con el cursor dentro. Y no falla ninguna
prueba obvia. Por eso:

- las operaciones que no aplican **no lanzan**: devuelven la entrada intacta;
- los casos no-op son **la mitad de la especificación**, cada uno con su prueba;
- las pruebas que importan usan `assert.strictEqual`;
- **el nombre sostiene la invariante**: `setChecked`, no `toggleChecked`. Un `toggle` siempre cambia
  algo; `setChecked(id, true)` sobre una casilla marcada puede devolver el árbol intacto. Vale para
  nombrar cualquier operación: se pasa el valor ya decidido, no la orden de invertirlo.

---

## 4. Las capas: puertos y adaptadores

Cuatro módulos, y las flechas siempre hacia dentro:

```
   platform ──→ ui ──→ core ←── storage
       └──────────────→ core
       └──────────────────────→ storage
```

- **`core`**: el dominio, las acciones, los casos de uso y los puertos. **Cero plataforma**, y no
  importa de nadie.
- **`storage`** y **`ui`** sólo conocen al core.
- **`platform`**: **la composición**, el único sitio que sabe a la vez qué puertos hay y qué
  implementaciones existen, y que decide qué se inyecta. **Nadie la importa.** El día que haya otra
  plataforma, aparece otra composición al lado y nada más se toca.

**Un puerto se declara cuando el dominio necesita algo del mundo**, no para dar cobijo a código que
no es del dominio. El ejemplo que lo fijó: el debounce del guardado necesita un temporizador, y la
reacción automática sería un puerto `Scheduler`. No hace falta: partido por la costura de siempre
—*qué* está sucio es puro y va en el core; *cuándo* se escribe es plataforma y va fuera—, el core no
temporiza nada. Para probar lo de fuera sin esperas reales basta recibir la función de programar
**por parámetro**: un argumento, no un puerto.

**Los puertos son `async`, también con adaptadores síncronos.** Si el de memoria expusiera firmas
síncronas, enchufar después un disco o la red obligaría a reescribir a todos los que llaman.

**Sus miembros son propiedades de función, no métodos** (`readonly get: (id) => …`). TypeScript
compara los parámetros de un método de forma laxa incluso con `strict`, y los de una propiedad de
función de forma estricta.

**Cada módulo tiene un `index.ts` como API pública, y sólo anuncia lo que otro módulo usa.** Lo que
no está ahí no existe para los demás; las pruebas, que necesitan nombrar la maquinaria interna,
importan su fichero directamente. Un escaparate que anuncia de más hace creer que algo es público y
esconde qué se usa de verdad.

---

## 5. El dominio

**Estado normalizado, con referencias por id.** Las entidades no se anidan: `AppState` es plano,
como una pequeña base de datos, y un contexto guarda **referencias** (`ItemRef`), nunca las notas
dentro. Tres razones, cada una suficiente: una nota puede estar en varios contextos; guardar un
contexto no reescribe sus notas; y una `ItemRef` lleva su clase (`kind`), así que se distingue en
ejecución qué es cada elemento. Lo de dentro de una nota también se direcciona **por id**, nunca por
ruta de índices: una ruta se rompe en cuanto se inserta algo por encima.

**Integridad referencial.** Ninguna referencia a lo que **no está en el almacén**. Una acción que
borra algo limpia todas las referencias a ello **en la misma acción** y con el mismo `meta`, y
devuelve intacto —por referencia— todo lo que no lo mencionaba. Referenciar lo que no existe es un
no-op. Y **ilegible no es inexistente** (§6.5): lo que está guardado pero no se puede leer conserva
sus referencias.

**Una operación que no aplica no hace nada.** No falla, no lanza: devuelve su entrada. Eso elimina el
caso de error en vez de tiparlo, y es lo que hace que **el dominio no pueda fallar por diseño**.

**Las primitivas son mínimas; lo compuesto se compone fuera.** Una operación hace una cosa. Marcar una
casilla no arrastra a sus hijas; borrar no se lleva una rama. Si algún día hace falta la cascada, se
compone recorriendo con la primitiva **y se pliega en una sola acción**: N despachos serían N
estampas, N avisos y N escrituras.

**Nada desaparece sin que el usuario lo esté mirando.** Lo que haría desaparecer contenido que no se
ve —borrar o absorber una línea con hijas— es un no-op. Un borrado accidental de cuarenta casillas no
es un deshacer más: es la clase de pérdida que hace que dejes de fiarte de la app.

**Sobrevive con su identidad lo que ya estaba.** Cuando una operación parte, une o convierte, la línea
de antes conserva su id, y lo nuevo nace con uno nuevo. De eso dependen las referencias y que la UI,
que reconcilia por id, no destruya y recree lo que el usuario está tocando.

**Los ids entran por parámetro.** El dominio no los genera: llegan ya hechos desde el caso de uso,
que tiene el puerto. El reducer no los inventa nunca.

**`Versioned`: la chapa de metadatos de escritura** (`updatedAt` y `revision`). No es una entidad
—no lleva id: cada entidad declara el suyo, marcado—. **`revision` es un token opaco**, no un
contador: lo único que se pregunta es si sigue siendo el mismo. Sirve para escribir condicionalmente
y **detectar** que algo cambió por debajo; qué hacer entonces es una política aparte, y «gana el
último» no es la elegida, porque pierde datos sin avisar. Se prefiere a comparar fechas porque los
relojes de dos dispositivos no coinciden.

**No se construye lo que no tiene quien lo use.** Una operación, un caso de un tipo, un parámetro
configurable o un puerto entran el día que existe su consumidor, no antes. Cada caso de más es una
rama más que probar en quien la consuma, y lo que se añade después cuesta lo mismo que ahora. Lo
aplazado no se olvida: se aparca con lo que lo desbloquearía.

**El dominio no se justifica por la forma de la UI.** Una pieza del dominio atada a cómo es hoy una
pantalla queda atada a lo que más cambia. La prueba de que la frontera está bien puesta es que
rediseñar la UI no cueste ni una línea del core.

**Una acción, una operación, y un caso de uso devuelve su protagonista o `null`.** La UI encadena
acciones cuando un gesto toca varias entidades. Devolver la entidad tocada, o `null` si no aplicó,
distingue «hecho» de «no aplicaba» sin convertir un no-op en un fallo. No sirve de deshacer: un
deshacer es otra pieza, con su propio diseño.

**Lo público, en inglés; la maquinaria interna, en castellano.** Los tipos y las funciones que salen
por un `index.ts` se nombran en inglés (`Note`, `AppState`); lo de dentro, en castellano. Sirve para
decidir el siguiente nombre.

---

## 6. La persistencia

### 6.1 Manda el modelo, y una sola fuente de verdad

**Manda el modelo, no el fichero.** Un fichero o una fila es la copia guardada de una entidad. El
grano es **un documento por entidad**, y eso da cambios pequeños y conflictos por nota en vez de
globales. Si el destino fuera una base de datos, sería una fila por entidad: la misma decisión.

**Una sola fuente de verdad, siempre.** Cada dato vive en un sitio, y lo demás se calcula. Por eso:

- **no hay índice de ids** junto a las entidades: serían dos fuentes que se desincronizan al morir a
  mitad de una escritura, y el peor caso es una nota guardada, intacta, que nadie abre nunca. **Si
  algún día leer todo duele, la respuesta es una caché, no una segunda fuente**: una caché que se
  equivoca se tira; un índice que se equivoca pierde notas;
- **no se guardan copias de nombres**: lo que enseña el título de otra entidad lo lee en directo;
- **lo que se puede calcular no se persiste**: una vista que reúne todas las notas es cálculo de
  presentación, no una entidad.

**La versión del formato es de lo guardado, no del estado en memoria.** Vive en el almacén, sólo ahí.
Ausente significa «aquí no se ha escrito nunca nada», no «formato viejo»: confundirlo hace buscar una
migración que no existe. Una versión ilegible sí es un error: migrar sin saber de dónde se viene es la
forma de estropear lo guardado. **Es el mecanismo de migración**, y por eso llega con quien la lee.

**Lo que hace cada escritura, en orden, y con el peor caso inofensivo.** Primero todo lo que se
guarda, después lo que se borra: morir a mitad deja algo que sobra, nunca una referencia colgando. Una
transacción sobre ficheros sueltos **no es atómica** ni aísla; lo que sí promete es no reordenar nada,
y quien la usa cuenta con eso.

**Lo local es primario.** En cada dispositivo, lo guardado allí es la fuente de verdad; cualquier
destino remoto se alimenta después, con reintentos, para que la app no se bloquee nunca porque falle
la red. **La configuración del almacenamiento no puede vivir en el almacenamiento que configura**:
sería un huevo y una gallina al arrancar.

**Nada de credenciales en el repo ni en el código publicado.** La sesión de un servicio externo es
del dispositivo y se puede revocar.

### 6.2 Dos puertos, dos ejes

La persistencia tiene dos preguntas independientes, y por eso dos puertos:

```
¿cómo se guarda?    en memoria  ·  documentos JSON   ← lo decide el StorageAdapter
¿dónde van?         —           ·  qué almacén       ← lo decide el BlobStore
```

`StorageAdapter` habla de entidades e ids; `BlobStore`, de caminos y bytes. **`BlobStore` no está
debajo de `Repository`: es un parámetro de una implementación**, la de documentos. **La traducción
ocurre en un solo sitio**: el adaptador de documentos convierte entidades en bytes y ids en caminos, y
el esquema en disco aparece ahí y en ningún otro lado. Cambiar de formato, o de almacén, toca una
pieza.

**Cada capa traduce sólo lo suyo.** Un almacén traduce las excepciones de **su** plataforma; el
adaptador de encima traduce sólo la serialización. Si la traducción de plataforma subiera, el
adaptador tendría que conocer las excepciones de todos los almacenes. **El sobre es del almacén y el
contenido del adaptador:** si un almacén codificó los bytes para poder guardarlos y no puede
descodificarlos, eso es suyo.

**Mueve bytes, no texto**: es el denominador común de verdad, y lo que no sea texto cabe sin cambiar
el puerto.

**La forma de lo leído la valida el adaptador, no el core.** Lo que se comprueba es la forma en disco,
que es del adaptador como el nombre del fichero. El core recibe entidades ya construidas y no sabe que
existe un JSON. Se valida lo que la app necesita, campo a campo, y lo de más se ignora; lo que no tiene
forma va por el mismo camino que un fichero ilegible.

**Lo que es plataforma entra por el constructor.** Conseguir el almacén del navegador es
composición, y vive en la composición. Que de paso se pueda montar en Node con un objeto falso es la
consecuencia, no el motivo.

**En un sitio compartido, todo lleva espacio de nombres.** Un almacén del navegador es de todo el
origen: sin prefijo propio, la app leería claves ajenas o pisaría las de otro. Por la misma razón,
borrarlo todo borra sólo lo que lleva ese prefijo.

### 6.3 Las pruebas de un puerto: el contrato

**Una sola especificación, escrita contra la interfaz, que pasan todas las implementaciones.** Un
adaptador está terminado cuando pasa el contrato, y es la única definición de «intercambiable» que no
se degrada: si uno nuevo se comporta distinto, el contrato lo canta. Se compara por valor, a
propósito: un almacén devuelve copias.

> El contrato prueba que un adaptador es **un almacén**. Sus pruebas aparte, que es **ése**.

La regla verdadera: **lo que exige la interfaz se prueba en el contrato; lo que sólo tiene una
implementación, aparte.** Si una prueba se pudiera escribir contra la interfaz, está en el sitio
equivocado.

**Cuanto más fina es la capa, menos vale probarla con un doble.** Un doble prueba lo que uno *cree*
que hace la plataforma, no lo que hace. Un doble es legítimo para probar la capa gorda de encima; para
la capa que sólo traduce llamadas del navegador, se descarta: ésa se verifica en un navegador de
verdad, con una lista escrita. Y montar la pila entera sobre la implementación real, cuando se puede,
caza lo que un doble demasiado amable deja pasar.

### 6.4 Los errores son valores: `Result`

> **Toda operación que puede fallar devuelve un resultado explícito en vez de lanzar.**

Una excepción **no aparece en ninguna firma**: `put(n): Promise<void>` promete no fallar nunca, y ni
quien llama ni el compilador se enteran de que hay un caso que tratar. `Result` mete ese caso **dentro
del tipo**:

```ts
export type Result<T, E> =
  | { readonly ok: true;  readonly value: T }
  | { readonly ok: false; readonly error: E }
```

Leer `value` sin comprobar `ok` no compila; esa es toda su fuerza. Sin `map` ni `andThen`: no se
construye lo que no tiene consumidor. `ok` devuelve `Result<T, never>` y `err`, `Result<never, E>`:
cada uno deja abierta la mitad que no construye.

**Un error es una entidad del dominio.** Vive con el resto del modelo, no donde da la casualidad de
producirse: es parte de lo que la app sabe decir, y quien lo trata no tiene por qué buscarlo en los
puertos.

**Ausencia no es fallo.** `get` de lo que no está es `ok(null)`, y borrar lo que no existe es `ok`.
«No está» y «no he podido mirar» son cosas distintas, y colapsarlas pierde información. `null`, y no
`undefined`, porque es una respuesta: «he ido a buscarlo y no está».

**El `try/catch` no desaparece: se confina en fronteras.** JavaScript lanza por su cuenta —un parseo,
una API del navegador, un aviso ajeno—. Cada sitio que habla con algo que lanza tiene **una frontera**
donde envuelve la llamada y la traduce a `Result`. Por debajo hay `try/catch`; por encima, nada lanza.

> **El peligro no es el `throw`: es la llamada sin envolver.**

Contar `throw` mide lo que lanzamos nosotros; la pregunta buena es si alguna llamada que lanza puede
llegar a una firma pública. La vigila `npm run check:fronteras`, con un límite que hay que conocer: **su
lista de lo peligroso se mantiene a mano**, porque desde el código no se sabe qué API lanza. Quien
llame a una nueva que lance, la añade. Y **un error se mira siempre**, aunque sea para registrarlo:
ningún `Result` ni ninguna promesa se tiran (`npm run check:descartes`). El registro es un puerto más
(`Logger`), para que sea transversal sin que el core sepa dónde acaba.

**La taxonomía se decide por «¿reintentar sirve de algo?»**, no por el mensaje que sale en pantalla:

| Caso | ¿Reintentar? | Qué hace la app |
|---|---|---|
| `permission-denied` | no | se para; lo no guardado sigue en memoria |
| `not-found` | no | avisa de que el destino ya no está |
| `quota-exceeded` | no | deja de intentarlo y avisa |
| `corrupt` | no | **aparta esa entidad y sigue con las demás**, diciendo cuál |
| `stale` | no | **no pisa**: se para y ofrece recargar |
| `io` | **sí** | reintenta en silencio |

Dos excepciones se agrupan cuando **quien las recibe hace lo mismo con ellas**, no cuando se parecen.
**Lo que va a `io` se razona**, porque es el único caso que dice «insiste», y uno mal clasificado
convierte «no cabe» en «reintenta». **`corrupt` no va dentro de `io`**: una nota rota, reintentada sin
fin, haría parecer que está todo roto; es la diferencia entre perder una nota y creer que las has
perdido todas. **`cause` es para depurar**; al usuario se le enseña el caso, que tiene una acción. El
precio del cajón genérico, aceptado: un fallo de programación dentro de una escritura sale como `io`.

**El coste, dicho sin esconderlo.** TypeScript no tiene operador para propagar errores: una secuencia
de pasos que pueden fallar se comprueba uno a uno, cortando en el primero, que es el que explica lo
que pasó. Es más ruidoso de leer, y se acepta.

### 6.5 Nunca en silencio, nunca a ciegas

**Ilegible no es inexistente.** Un fichero que no se puede leer **se salta y se avisa**, diciendo cuál;
nunca impide abrir la app, y nunca se toma por borrado. Saltarlo en silencio haría que el guardado lo
viera como borrado y limpiara sus referencias: un fichero recuperable convertido en una pérdida de
verdad. Por eso lo ilegible conserva sus referencias, y arreglado el fichero, vuelve donde estaba.

**Ante un fallo que no se arregla insistiendo, el guardado se detiene.** Retiene el error, deja de
programar escrituras y avisa **una vez**; lo pendiente sigue en memoria y no se pierde mientras la
página siga abierta, y el aviso dice que se perderá al cerrarla. Se prefiere a reintentar en bucle
porque así el error se ve en vez de desaparecer. Un `io` se sigue reintentando sin avisar: es justo
el caso en que insistir sirve.

**Una escritura no pisa lo que no ha visto.** Cada escritura dice qué revisión espera encontrar; si lo
guardado es otra cosa, otro lo cambió, y se para con `stale` en vez de pisarlo. Lo de esa pestaña
desde su último guardado se pierde al recargar: es el precio de la política más sencilla, y **nunca
pisa**. Es la pieza que reutilizará la sincronización entre dispositivos.

**Lo destructivo se hace en dos tiempos, al arrancar.** Borrar todo o sustituirlo por una copia no se
hace en el acto: se apunta una marca y se recarga, y se ejecuta al arrancar **antes de leer nada**,
quitando la marca **la última**. Así el guardado de salida, que escribe después de la pulsación, no
reescribe lo recién borrado, y si algo falla a medias el siguiente arranque lo reintenta. Si un
cambio así se queda a medias, la app **no arranca** sobre datos incompletos: ofrece reintentar o
abandonar.

**Antes de destruir, un ensayo.** Lo que va a sustituir los datos se arranca primero en memoria con el
mismo código de arranque: si no arrancaría, se sabe sin haber tocado nada.

**Una copia de seguridad lleva lo guardado tal cual**, ilegibles incluidos, no lo que enseña la
pantalla: así no se pierde nada y no depende de dónde se guarde. Su formato lleva su propia versión,
distinta de la de las notas; **sube cuando una copia vieja ya no se puede leer igual, no cuando se
añade algo que se puede no traer.**

---

## 7. La UI

### 7.1 Vanilla, y el estado en su sitio

**Sin framework.** El `Store` **ya es Redux** —`getState`, `dispatch` y `subscribe` sobre un reducer
puro, más la invariante de identidad, que Redux no da—, y un DOM virtual es débil justo donde esta app
es difícil: el texto editable. La UI se suscribe y despacha; la detección de cambios sale gratis por
referencia (§3). Lo que reabriría esto son fallos reales de sincronizar el DOM, no el tamaño.

**Cuatro clases de estado, y cada una vive en un sitio distinto:**

| | Qué es | Dónde vive |
|---|---|---|
| **Contenido** | notas, diagramas, contextos | en el core, persistido, viaja con los datos |
| **Modo de trabajo** | cómo se comporta el teclado ahora mismo | en memoria, en quien lo usa; se pierde sin consecuencias |
| **Organización de la vista** | qué se enseña y cómo: ventanas, encuadres, lo abierto encima | **fuera del core**, en el dispositivo; no viaja |
| **Preferencias del dispositivo** | el aspecto | igual: fuera del core, en el dispositivo |

**Lo que no es contenido no entra en el core.** Meterlo llenaría la persistencia de basura de
interfaz, y abrir un menú marcaría notas como sucias. Lo que se guarda fuera del core **no lo vigila
el reducer**, así que **una guarda pura recalcula lo visible** —lo guardado menos lo que ya no
existe—, siempre y no sólo al arrancar. Lo leído se valida antes de usarlo, y un fallo al guardarlo
no avisa: sólo se pierde cómo se miraba, no un dato. Lo que es del dispositivo es legítimo que
difiera entre dispositivos.

**Una referencia, no un índice.** Lo que señala algo de una lista lo señala por su identidad: un
índice se desplaza en cuanto se quita algo de delante y acaba señalando otra cosa.

### 7.2 Lo que decide es puro; el DOM, delgado

**Lo que decide qué se ve y qué pasa es una función pura, con pruebas en Node; el DOM de encima es
delgado y se verifica en el navegador**, con listas escritas. Las cuentas de un lienzo, las reglas de
un teclado o qué ofrece un menú son lógica, y se prueban; el tacto de un teclado de móvil no lo prueba
`node --test`, y un DOM falso probaría lo que uno cree que hace el navegador. Lo que se monta en dos
sitios es una pieza y dos marcos.

**Dos reglas del texto editable:**

1. **Reconciliación por clave**, no repintado ciego: cada elemento lleva su id en el DOM, y por eso
   todo lo que se pinta en una lista tiene id en el modelo.
2. **Lo que tiene el foco no se repinta**: mientras se escribe, el DOM es la fuente de verdad, porque
   repintarlo borra el cursor. La excepción es una orden del propio editor, que sí cambia lo
   enfocado.

**La UI despacha en cada tecla; quien agrupa es el guardado.** El editor no decide cuándo escribir al
disco.

**El atrás es salir.** Lo que se abre encima se apila en el historial del navegador, así que el atrás
del sistema lo cierra paso a paso; moverse entre lo que está al mismo nivel no se apunta, o el atrás
dejaría de significar «salir».

### 7.3 Convenciones de la interfaz

- **Móvil y escritorio, los mismos gestos.** Nada depende de lo que un teclado de móvil no tiene, como
  el Tabulador. Un diseño que lo necesite es un diseño sólo para ordenador.
- **Se confirma sólo lo que no tiene vuelta atrás**, con una hoja propia y no con un diálogo del
  navegador, que algunos contestan solos. Quitar, mover o lo que se rehace de un toque, no confirma.
- **Un control que actúa sobre lo que todavía no existe tiene que verse armado.** Si el efecto no está
  en lo que se mira, un estado invisible convierte la siguiente pulsación en una sorpresa.
- **Una pulsación, una cosa**, y ninguna se lleva por delante lo que el usuario no está mirando.
- **El aspecto, en un solo sitio.** Los colores viven en un fichero; lo importante se distingue
  invirtiendo, y el rojo queda para borrar y para los errores. Nada se mueve solo.
- **El CSS, un fichero por vista en el orden de la cascada.** Con la misma especificidad gana la regla
  de después, así que el orden es parte del diseño. Sin preprocesador: el anidamiento y las capas ya
  son nativos. **Al tocarlo, se compara el estilo calculado** de cada elemento antes y después.

---

## 8. La infraestructura

### 8.1 La verja de pureza

**`lib` y `types` se aplican por invocación de `tsc`, no por fichero.** En cuanto el core no debía ver
el DOM y la UI sí, hicieron falta configuraciones separadas. **Los límites entre módulos son carpetas
con su `tsconfig`, no un monorepo.** La del core va sin DOM ni tipos de Node, y está en la carpeta del
core con el nombre de siempre, para que el editor marque el error **mientras se escribe**. Las
pruebas viven en otra carpeta, así que la verja no las alcanza: una prueba sí puede usar Node.

**Lo que la verja no cubre, y lo tapa un guardián.** El reloj y el azar (`Date`, `Math.random()`) son
parte del lenguaje y **compilan** dentro del core; `npm run check:purity` los caza, con un escáner que
ignora comentarios y cadenas, porque los comentarios mencionan justo lo que prohíben. Un temporizador,
en cambio, lo para el compilador solo.

**Una verja que estorbe al resto del proyecto se acabaría desactivando**: por eso se comprobó que lo
que no compila en el core sí compila en la app.

**Ni `baseUrl` ni `paths`**: el primero está en retirada en TypeScript, y el segundo sobra con el
campo `imports`.

### 8.2 Alias: una sola declaración

`#core/index` lo resuelven TypeScript, Node y el navegador con **una sola declaración estándar**, el
campo `imports` de `package.json`, en vez de una por herramienta que acaben desincronizándose. Las
claves son condiciones: Node, con `--conditions=compiled`, apunta al JavaScript compilado de las
pruebas; TypeScript cae en el fuente. **El navegador es la excepción**: no lee `package.json`, y los
alias le llegan por el `importmap` de `index.html`. Es la única segunda declaración, y el precio de
no tener bundler. Un alias **se declara cuando el módulo existe**.

**Entre módulos, por alias contra el `index.ts`; dentro, relativo y con `.js`.** El navegador no
adivina extensiones, y sin el `.js` pide un fichero que no existe. Como las pruebas compilan a
CommonJS, que sí lo adivina, un import sin extensión pasaría todo `check` y sólo fallaría al abrir la
app: lo vigila `npm run check:extensiones`.

### 8.3 Pruebas: el runner de Node

`node:test` y `node:assert/strict`, sin runner externo: lo trae Node. Es más lento y sin modo
vigilancia, y es el precio elegido.

**Las pruebas viven en su propia carpeta, espejo de la del código.** La separación entre código y
pruebas la decide la **carpeta**, que es lo que entienden las herramientas, y no un sufijo que haya
que repetir en cada exclusión. El sufijo `.test` se queda con un solo trabajo: decirle a `node --test`
qué ejecutar. Un ayudante sin pruebas no lo lleva, y una lista manual vive al lado de las pruebas que
completa: es una prueba que ejecutan unas manos.

**Un navegador lo prueba un navegador.** Lo que no llega a Node —el DOM, las APIs de fichero, la app
instalada— se verifica con una lista escrita en el repo, sin instalar un runner de navegador. Esas
listas las puede pasar también un agente con un navegador, siguiendo el mismo texto.

### 8.4 Dependencias: sólo lo que se usa

**No se instala nada hasta que se usa de verdad, y se quita cuando deja de usarse.** Cero dependencias
de ejecución. Antes de añadir un paquete, se mira si Node, TypeScript o el navegador ya lo hacen. **Si
falta un tipo de plataforma, primero se mira si falta de verdad o sólo un trozo, y en qué versión de
TypeScript**: un trozo se declara a mano, local, y se borra el día que sobre; instalar tipos o activar
una `lib` más se queda para siempre.

### 8.5 Sin bundler

El navegador carga el JavaScript compilado tal cual, módulo a módulo, con un `importmap`. **Sin
bundler ni servidor de desarrollo**: cualquier servidor estático sirve la app. Las rutas de la página
son **relativas**, porque publicada vive en una subcarpeta; una absoluta funcionaría en casa y
fallaría publicada, y armar lo publicado se niega a seguir si encuentra una.

### 8.6 La web como plataforma

**Una app web instalable (PWA), y sin conexión.** El sitio publicado aloja el programa, no los datos:
**las notas nunca salen del dispositivo**. Internet hace falta para instalarla y actualizarla, no para
usarla.

**Se publica sólo lo que pasa `check`**, y lo publica un robot al subir a la rama principal: ningún
paso a mano entre lo comprobado y lo publicado. Publicar es cosa del usuario.

**La actualización es en silencio**, y es segura **mientras todos los módulos se carguen al
arrancar**: con una carga dinámica a mitad de sesión, una página vieja podría recibir ficheros nuevos.
Un `import()` dinámico reabre la decisión.

**El *service worker* sólo existe en la copia publicada.** En desarrollo serviría desde su caché lo
que se está cambiando. Va en JavaScript plano, fuera del código TypeScript, porque sus tipos y los del
DOM no conviven en un mismo `tsconfig`.

**Se pide almacenamiento persistente**, para que el navegador no borre los datos por su cuenta. No
protege de que alguien los borre a mano: para eso está la copia de seguridad.

### 8.7 Los comentarios del código

**La cabecera de un fichero responde a «¿para qué sirve esto?» y para ahí**, en pocas líneas que
entienda quien no programa. **El porqué no va en el código**: una cabecera que argumenta una decisión
es una copia de un documento, y las copias se separan del original sin que nadie lo note. Si el
porqué es un principio, está aquí; si no, no hace falta escribirlo. **Los comentarios de dentro se
quedan**, cortos y pegados a la línea: dicen lo que el código no dice. **Ningún número de sección en
el código** (`npm run check:paragrafos`): se renumeran solos y nada comprueba esos punteros; se nombra
el fichero, y si hace falta, el título.

---

## 9. Cómo se trabaja

**Una rebanada vertical antes de extender.** Antes de escribir todas las piezas de una clase, se
monta una de punta a punta y se comprueba que la cadena funciona. Escribirlas todas y enchufarlas al
final descubriría un fallo cuando ya hay muchos sitios donde puede estar.

**De abajo arriba, con un solo candidato.** Lo que tiene riesgo se prueba con el caso más sencillo
posible antes de multiplicarlo: un fallo con un candidato se encuentra; con diecisiete, se busca.

**Medir antes de optimizar.** Si al medir algo no duele, se cierra sin tocar código; si duele, se
arregla lo que la medida señala y no lo que parecía.

**Hay preguntas que sólo se contestan usando.** Cuando una decisión no se puede cerrar sobre el papel,
no se finge que está cerrada: se escriben las preguntas y qué cuenta como haberlas contestado. «No se
aguanta» es un resultado válido, y reabre la decisión con datos en vez de con intuiciones.

**Lo que está decidido no se reabre por cuenta propia.** Si algo parece mal, se plantea como duda,
con lo que lo reabriría.

**Una tarea dice cómo se cierra.** Qué prueba, guardián, lista o decisión demuestra que está hecha
(`npm run check:tareas`). Sin eso, «hecho» es una opinión.

**Se automatiza lo que depende de acordarse.** Lo que hoy depende de que alguien se acuerde —pasar
los checks, romper a propósito, mirar un documento— se convierte en algo que falla solo (§1). Lo que
no se puede automatizar se queda en `CLAUDE.md`, que se carga en cada sesión, y es lo único que hay
que recordar.
