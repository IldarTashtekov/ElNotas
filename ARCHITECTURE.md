# Arquitectura de ElNotas

El diseño y **sus por qués**. Se lee a demanda, no en cada sesión: `CLAUDE.md` tiene las
reglas y `TAREAS.md` lo pendiente; aquí está el razonamiento que las sostiene, para no
volver a discutirlo desde cero.

Incluye una **sección de conceptos desde cero** (§2) para quien sepa TypeScript pero no
arquitectura de front. Si algún término del resto del documento suena a jerga —reducer,
puerto, copia por camino—, está explicado ahí con ejemplos de notas y casillas.

> **Ojo al leer:** este documento describe **el diseño**, y no todo él está construido. Hoy lo
> están las **fases 1 a 7** —el dominio, la persistencia, la UI web, los Diagramas, la PWA y un
> refactor— (§9.2). De la Fase 4 quedan sin contestar las tres preguntas del
> editor (§9.10). Siguen siendo sólo diseño la carpeta del usuario como destino y la semántica
> multi-backend (§6); la nube, diseñada el 2026-10-12, vive en `TAREAS.md` hasta que se construya.
> Donde algo está planificado y no construido, la sección lo dice.
> Antes de dar algo por hecho, compruébalo contra el repo.

**Índice**

1. [La filosofía: que las reglas las haga cumplir el compilador](#1-la-filosofía-que-las-reglas-las-haga-cumplir-el-compilador)
2. [Conceptos desde cero](#2-conceptos-desde-cero)
3. [La cadena de la identidad](#3-la-cadena-de-la-identidad)
4. [Hexagonal: puertos y adaptadores](#4-hexagonal-puertos-y-adaptadores)
5. [El dominio](#5-el-dominio)
6. [Persistencia](#6-persistencia)
7. [La UI](#7-la-ui)
8. [La infraestructura](#8-la-infraestructura)
9. [El plan por fases, razonado](#9-el-plan-por-fases-razonado)

---

## 1. La filosofía: que las reglas las haga cumplir el compilador

Una regla de proyecto que solo vive en un documento se erosiona. Nadie la rompe a
propósito: se rompe por descuido, seis meses después, en un fichero que nadie relee. La
apuesta de este repo es convertir cada regla importante en **un error de compilación**.

Siete mecanismos, una sola filosofía:

| Mecanismo | Regla que hace cumplir | Sin él |
|---|---|---|
| **Verja de pureza** (`src/core/tsconfig.json` sin `DOM` y con `types: []`) | el core no toca la plataforma | un `document.` acaba en el dominio y no te enteras |
| **`readonly` / `ReadonlyArray`** en todo el dominio | inmutabilidad | un `push` silencioso rompe la detección de cambios |
| **Tipos marcados** (`NoteId`, `DiagramId`…) | no confundir un id con otro | pasas un `DiagramId` donde va un `NoteId` y falla en runtime |
| **Unión discriminada** (`Content = Text \| CheckBox`) | tratar todos los casos | añades un tipo de bloque y nada te avisa de dónde falta |
| **`noUncheckedIndexedAccess`** | tratar el "ese id no existe" | `undefined` se cuela por un lookup en un estado normalizado |
| **Alias no declarado** (mientras `#ui/*` no existía) | el core no importa de fuera | una dependencia al revés pasa desapercibida |
| **`Result<T, E>`** en vez de excepciones (§6.5) | tratar el fallo de E/S | un `throw` sube sin tipo hasta arriba y nadie sabe que existe |

El sexto es el más curioso, porque no se diseñó: sale gratis de la regla "un alias se
declara cuando el módulo existe". Mientras `#ui/*` no estuvo en el campo `imports`, importarlo
desde el core fallaba con un limpio *Cannot find module*. **Desde la Fase 4 existen los cuatro
alias**, así que ese mecanismo ya no protege nada: lo que sigue cazando el caso real es la verja
—la UI usa DOM, y arrastrarla al core rompe `typecheck:core`—, con un mensaje menos claro (§8.1).

El séptimo es el más reciente y el de mayor alcance, porque **es el único que ataca algo que
era invisible**: una excepción no aparece en ninguna firma, así que el compilador no puede
avisar de que existe. Ya está construido —en el código de producción de `core/` y `storage/`
no queda ni un `throw`— y está desarrollado en §6.5.

**El orden importa.** Todo esto es la Fase 0 y se montó *antes* de escribir una línea de
dominio. Si la verja hubiera llegado después, habría llegado tarde.

**Lo que la verja NO cubre** (medido, no supuesto): `Date`, `Math` y `new Date()` están en
`lib.es5.d.ts`, o sea dentro de `lib: ["ES2020"]`, así que **compilan** dentro del core.
Solo caen `crypto`, `performance` y `document`, que viven en `lib.dom` / `@types/node`.
Consecuencia: **`IdGenerator` está protegido por el compilador; `Clock` solo por
convención.** No se puede tapar por `lib` sin renunciar a medio ES2020, así que el hueco lo
tapa un guardián aparte, `tools/check-core-purity.mjs`, enchufado como `npm run check:purity`.
**No es un `grep`** y no puede serlo: los comentarios del proyecto mencionan `Date.now()` a
propósito —son justo los que explican la regla—, así que lleva un escáner que borra comentarios
y cadenas antes de buscar.

---

## 2. Conceptos desde cero

Esta sección explica el vocabulario que usa el resto del documento. Los ejemplos son del
dominio real de la app: notas, bloques de texto y casillas anidadas.

### 2.1 El patrón de estado

#### Estado

**Una sola foto de todos los datos de la app, en un solo objeto.** Aquí se llama
`AppState`, y contiene todas las notas, todos los diagramas y todos los contextos:

```ts
interface AppState {
  readonly notes:    Readonly<Record<NoteId, Note>>
  readonly diagrams: Readonly<Record<DiagramId, Diagram>>
  readonly contexts: Readonly<Record<ContextId, Context>>
}
```

Lo contrario —y lo que hacía el prototipo viejo de `src/scripts/`, ya borrado— es tener los datos
repartidos: un array de notas por aquí, una variable con la nota seleccionada por allá, y
el DOM guardando por su cuenta lo que el usuario ha escrito. Entonces "cuál es el estado
de la app" no tiene respuesta, y dos sitios pueden discrepar.

Con una foto única, cualquier pregunta ("¿qué se pinta?", "¿qué se guarda en disco?") se
responde mirando un solo objeto.

#### Acción

**Un objeto plano que describe qué ha pasado.** No es una función y no hace nada por sí
mismo: es un dato, como un asiento en un libro de cuentas.

```ts
{ type: "set-checked", noteId, contentId, checked: true, meta: { now, revision } }
```

Se lee: «se marcó la casilla `contentId` de la nota `noteId`». Que sea un dato y no una
llamada tiene consecuencias prácticas: se puede registrar en un log, guardar, comparar en
un test, o mandarse por la red tal cual.

El campo `meta` es peculiar de este proyecto y merece explicación aparte (ver *caso de
uso*, más abajo): la acción **trae ya puestas** la hora y la revisión nueva, en vez de que
las calcule quien la procesa.

#### Reducer

**Una función `(estado, acción) => estado`.** Recibe la foto actual y una acción, y
devuelve la foto siguiente. No modifica la que recibe.

```ts
const siguiente = reduce(estadoActual, { type: "set-checked", ... })
```

Se llama "reducer" porque tiene exactamente la forma del callback de `Array.reduce`:
`(acumulado, elemento) => acumulado`. Y esa analogía no es decorativa, es el modelo mental
entero: **la app es un `reduce` sobre la secuencia de acciones que ha hecho el usuario.**

```ts
estadoFinal = todasLasAcciones.reduce(reduce, estadoInicial)
```

En este proyecto el reducer tiene además dos exigencias:

- **Puro** — no lee el reloj, no genera ids, no toca disco ni DOM. Solo mira sus dos
  argumentos. Por eso sus tests son deterministas sin simular nada: mismos argumentos,
  mismo resultado, siempre.
- **Total** — **no lanza excepciones nunca**. Una acción que no se puede aplicar (marcar una
  casilla que no existe) **no hace nada**: devuelve el estado que recibió. Un reducer que
  peta se lleva la app entera por delante, y "el usuario pulsó algo raro" no es motivo para
  eso.

#### Store

**La caja que guarda el estado actual**, recibe acciones y avisa a quien esté escuchando.
Su forma completa es corta:

```ts
export const createStore = (initial: AppState): Store => {
  let state = initial
  let listeners: ReadonlyArray<Listener> = []

  return {
    getState: () => state,
    dispatch: (action) => {
      const next = reduce(state, action)
      if (next === state) return    // nada cambió → nadie se entera
      state = next                  // ← LA mutación
      for (const listener of listeners) listener(next)
    },
    subscribe: (listener) => { /* ... */ },
  }
}
```

Fíjate en `state = next`: eso es una **mutación**. Y es deliberada. El `Store` es **el único
sitio de todo el sistema donde algo se reasigna**: todo lo demás —dominio, operaciones,
reducer— es puro y devuelve valores nuevos. Los datos siguen siendo inmutables; lo que cambia
es la variable que señala cuál es el estado actual, no el objeto al que señala. Una app
interactiva es por definición algo que tiene un "ahora" distinto de su "antes", así que la
decisión de diseño no es evitar la mutación —no se puede— sino que ocupe **un sitio, pequeño
y localizable**.

**Es una función y no una clase**, y la razón que decide es concreta: la UI recibe
`dispatch` **y nada más**, así que esa función tiene que poder viajar sola. Con una clase,
`const { dispatch } = store` se lleva el método sin su `this` y revienta al llamarlo; con una
clausura no hay `this` que perder. De propina, `Store` queda siendo sólo una interfaz que
nadie puede instanciar por su cuenta.

Un detalle real: la lista de suscriptores **se reemplaza, nunca se muta en el sitio**. Así el
`for...of` en curso se queda iterando el array que había al empezar, y un suscriptor puede
darse de baja durante su propia notificación sin corromper el recorrido. Con `push`/`splice`
sí falla: es la clase de bug que solo aparece en producción y de forma intermitente.

#### `dispatch` y suscriptor

**`dispatch` es el único verbo que la UI conoce.** La UI no modifica datos: construye una
acción y la despacha. No sabe qué es un reducer, ni si hay persistencia detrás.

**Un suscriptor es quien se entera de que el estado cambió.** Habrá al menos dos, y son
independientes entre sí:

- el **render**, que redibuja lo que haga falta;
- la **persistencia**, que apunta qué entidades quedaron sucias y las escribe a disco un
  poco más tarde (*write-behind* con debounce; nunca en cada tecla).

Que la persistencia sea "un suscriptor más" es lo que permite que el dominio no sepa nada
de discos.

#### Caso de uso

**La capa que tiene los puertos inyectados y construye el `meta` de la acción.** Es la
frontera entre lo impuro y lo puro:

```ts
// Impuro: le han inyectado un reloj y un generador de ids de verdad.
export const createUseCases = ({ clock, ids, store }: UseCaseDeps): UseCases => ({
  setChecked: (noteId, contentId, checked) =>
    store.dispatch({
      type: "set-checked", noteId, contentId, checked,
      meta: { now: clock.now(), revision: revision(ids.next()) },    // ← aquí, y solo aquí
    }),
})
```

Todo lo que pasa de esta línea hacia dentro (reducer, operaciones de contenido, dominio) es
puro y testeable sin simular nada. Todo lo que queda fuera es plataforma.

Y de propina: como el `meta` se construye **una vez** por acción, todas las entidades que
esa acción toque reciben exactamente la misma marca de tiempo, en vez de milisegundos
ligeramente distintos según el orden en que se procesaran.

### 2.2 Los conceptos de arquitectura

#### Puerto y adaptador (arquitectura hexagonal)

Un **puerto** es una interfaz que declara *qué necesita* el dominio. Un **adaptador** es una
implementación concreta de ese puerto.

```ts
// core/ports/Clock.ts        ← ESTO ES CÓDIGO DEL CORE
export interface Clock { now(): number }

// platform/web/SystemClock.ts  ← esto no
export const systemClock: Clock = { now: () => Date.now() }
```

> ⚠️ **Aviso, porque es lo que más se malentiende: la interfaz del puerto vive DENTRO del
> core.** `core/ports/Clock.ts` es código del core, no una concesión a la plataforma. Solo
> la **implementación** vive fuera.
>
> Un puerto **no es algo que se le quita al dominio**. Es **el dominio declarando la forma
> de lo que necesita**. El dominio dice "necesito algo que me dé la hora, y así es su
> forma"; quien lo cumple es asunto de otra capa. Eso es lo que invierte la dirección de la
> dependencia (abajo).

Con el mismo patrón se enchufan cosas mucho más grandes: `Repository`, `StorageAdapter`,
`BlobStore` (§6). El puerto es siempre el sitio donde el dominio dice "aquí necesito algo
del mundo exterior, y esta es la forma exacta que tiene que tener".

#### Functional core, imperative shell

El proyecto se parte en dos:

- **el núcleo funcional** — puro, sin efectos, todo son funciones de valores a valores;
- **la cáscara imperativa** — la que habla con el mundo: DOM, disco, red, reloj.

La cáscara lee del mundo, **entra** al núcleo con datos puros, recoge el resultado y
**sale** a escribir al mundo. El núcleo nunca llama hacia fuera.

> **La regla de oro, y la que menos intuitiva resulta: el tiempo y el azar son
> entrada/salida.** Igual que leer un fichero.

`Date.now()` **es una llamada a un servicio externo** —el reloj del sistema operativo—
aunque la sintaxis sea de doce caracteres y no lleve `await`. `Math.random()` igual. Que
sean síncronos y baratos no los hace puros: hacen que el resultado de tu función dependa de
algo que no está en sus argumentos.

**El criterio práctico:** si llamándolo dos veces seguidas puede darte respuestas
distintas, es E/S. `Date.now()` lo es. `crypto.randomUUID()` lo es. Sumar dos números no.

De ahí que en este proyecto la hora y los ids entren **por puerto** y viajen dentro de la
acción, en `meta`.

#### Inversión de dependencias

La regla: **`platform/` importa de `core/`, y nunca al revés.** Las flechas van siempre de
fuera hacia dentro.

```
platform/web/  ─────►  core/     ✅  la cáscara conoce el núcleo
platform/web/  ◄─────  core/     ❌  jamás
```

Suena arbitrario hasta que se ve qué compra. El core define `interface Clock`; `platform/`
la implementa. El core **usa** un reloj sin **conocer** ninguno. Entonces:

- se puede testear el dominio con `{ now: () => 1000 }`, sin navegador ni simulaciones;
- cuando llegue el shell de escritorio, aparece `platform/desktop/` al lado y **el core no
  se toca**;
- cambiar de framework de UI no puede romper el dominio, porque el dominio no lo importa.

"Inversión" se refiere a esto: lo natural sería que el código de alto nivel (el dominio)
dependiera del de bajo nivel (el reloj del SO). Se invierte metiendo una interfaz en medio
que pertenece **al de alto nivel**. Los dos acaban dependiendo de la interfaz, y el dominio
no depende de nadie.

#### Write-behind, debounce y *dirty tracking*

Son tres cosas distintas que este documento nombra juntas —«un suscriptor con write-behind y
debounce, escribiendo sólo las entidades sucias»— y conviene separarlas, porque cada una
responde a una pregunta diferente.

**Write-behind es el *qué*: escribir a disco después, no en el momento.** Se entiende mejor
por su contrario:

| | Cuándo escribe | Qué pasa mientras |
|---|---|---|
| *write-through* | en el acto, antes de dar la operación por buena | la app espera al disco |
| **write-behind** | más tarde, cuando amaina | la app sigue; el disco va **por detrás** |

Ese «por detrás» es el *behind* del nombre: la memoria es la verdad inmediata y el disco la
persigue con unos segundos de retraso.

**Por qué esta app no puede hacer otra cosa.** Escribir es *la* acción principal de una app de
notas. Teclear una línea de veinte caracteres son veinte cambios de estado: con write-through,
veinte escrituras de `notes/<id>.json` en dos segundos, y cada una reserializando la nota
**entera** —cien líneas incluidas—. De ahí la regla de §7: **nunca guardar en cada tecla**.

**Debounce es el *cuándo*:** no escribas mientras siga pasando algo; espera a que haya medio
segundo de calma, y cada cambio nuevo reinicia la cuenta. Es distinto de un *throttle*, que
sería «como mucho una escritura cada 500 ms» y sí escribiría a mitad de palabra.

**Dirty tracking es el *qué se escribe*:** sólo las entidades que cambiaron. Y aquí está el
enganche con todo lo demás — **ese «¿está sucia?» es un `===`**, el eslabón ② de §3. Por eso
importa tanto que una operación que no cambia nada devuelva su entrada: si devolviera una copia
equivalente, todo saldría sucio siempre y el filtro no filtraría nada.

**El precio, que es real y no se arregla con más debounce:** si la app se cierra en la ventana
entre el cambio y la escritura, ese cambio **se pierde**. Es inherente a diferir. Se paga
forzando la escritura pendiente al cerrar, que es plataforma: `main.ts` hace `flush()` en
`pagehide` **y** al pasar la página a oculta (`visibilitychange`), porque en el móvil `pagehide`
no siempre llega y pasar a segundo plano es la última ocasión segura.

### 2.3 Estructuras inmutables

#### Igualdad por referencia

En JavaScript, `===` entre objetos **no compara contenido, compara identidad**: pregunta si
las dos variables apuntan al mismo objeto en memoria.

```ts
const a = { texto: "hola" }
const b = { texto: "hola" }
const c = a

a === b   // false  ← contenido idéntico, objetos distintos
a === c   // true   ← el mismo objeto
```

Esto suele presentarse como una molestia del lenguaje. Aquí es **el motor de todo**: es una
comparación de un puntero, cuesta lo mismo comparar dos strings que dos árboles de diez mil
nodos. Toda la eficiencia de esta arquitectura consiste en poder preguntar "¿ha cambiado
esta rama?" en tiempo constante… **a condición de** que el código respete la invariante de
identidad (§3).

#### Copia por camino (*path copying*, *structural sharing*)

El concepto central. Si el estado es inmutable, cambiar algo hondo en un árbol obliga a
crear objetos nuevos. La pregunta es **cuántos**.

Ejemplo con una nota real: la lista de la compra.

```
Note.content
├── Text     "Compra semanal"
├── CheckBox "Fruta"
│   ├── CheckBox "Manzanas"
│   └── CheckBox "Peras"      ☐   ← vamos a marcar esta
└── CheckBox "Limpieza"
    └── CheckBox "Fregona"
```

Al marcar "Peras" se reconstruye **solo el camino desde la raíz hasta ella**: la raíz,
"Fruta" y "Peras". Todo lo demás se **reutiliza por referencia**, tal cual, sin copiarlo:

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

**Tres objetos nuevos.** "Compra semanal", "Manzanas" y "Limpieza" —con toda su rama
debajo— siguen siendo literalmente los mismos objetos en memoria.

Dos consecuencias, y las dos importan:

1. **El coste es la profundidad, no el tamaño.** Para un árbol de N nodos asignas tantos
   objetos como **profundidad** tenga el camino, no N. Una nota con quinientas casillas
   anidadas tres niveles cuesta tres objetos por pulsación, no quinientos.
2. **El render puede saltarse ramas enteras** con un solo `===`. Si `"Limpieza"` sigue
   siendo el mismo objeto, no hace falta ni mirar dentro: nada de su subárbol ha cambiado.

Y como el árbol viejo sigue intacto, guardarse una referencia al estado anterior da
*undo* casi gratis.

No es una invención de este proyecto: es la misma técnica de **Immer**, de **Redux** y de
las estructuras persistentes de **Clojure**. Lo que aquí se hace a mano —con un helper de
unas 25 líneas— es lo que esas librerías automatizan; se hace a mano porque la política del
proyecto es cero dependencias mientras la alternativa nativa quepa en un fichero.

#### Por qué `map` y `filter` no sirven

La regla de inmutabilidad dice "usa `map`/`filter`/spread, nunca `push`/`splice`". Correcto,
pero **insuficiente**, y aquí está la trampa:

```ts
const a = [1, 2, 3]
a.map(x => x)        === a   // false  ← map SIEMPRE crea array nuevo
a.filter(() => true) === a   // false  ← filter también
```

Lo mismo con el spread de objetos:

```ts
const casilla = { ...c, checked: true }   // objeto nuevo AUNQUE c.checked ya fuera true
```

Es decir: escribir el dominio con `map`, `filter` y spread tal cual **desactiva
silenciosamente** toda la detección de cambios. Cada operación devuelve estructura nueva
aunque no haya cambiado nada, así que `next === this.state` es siempre falso y el `Store`
notifica siempre.

**Y lo peligroso es que no falla nada.** La app funciona perfectamente. Solo redibuja de
más y escribe a disco de más. No hay excepción, no hay pantalla en blanco, no hay test
rojo: solo una app más lenta de lo que debería, por un motivo invisible.

La solución son **envoltorios que comparen y devuelvan la entrada intacta**:

```ts
const mapPreservandoIdentidad = <T>(items: ReadonlyArray<T>, fn: (x: T) => T) => {
  let cambió = false
  const next = items.map(item => {
    const nuevo = fn(item)
    if (nuevo !== item) cambió = true
    return nuevo
  })
  return cambió ? next : items      // ← si nada cambió, el array ORIGINAL
}
```

#### `assert.strictEqual`, nunca `deepEqual`

Consecuencia directa de lo anterior. Los tests que sostienen esta arquitectura **no
comprueban valores, comprueban referencias**:

```ts
assert.strictEqual(despues, antes)                    // ✅ ¿es el MISMO objeto?
assert.deepStrictEqual(despues, antes)                // ❌ ¿tiene el mismo contenido?
```

Un test con `deepEqual` **pasa igual de verde** con una implementación que rompe la
invariante, porque el contenido sería correcto y solo las referencias estarían mal. Es la
clase de test que da confianza sin dar garantía.

Y también en positivo: hay que comprobar que la rama que **no** se tocó sigue siendo el
mismo objeto, no solo que la que sí se tocó cambió.

### 2.4 Los conceptos de TypeScript que usa el proyecto

#### Tipo marcado (*branded type*)

Un `NoteId` **no es** un `string`, aunque en runtime sea exactamente un string:

```ts
declare const brand: unique symbol
type Branded<T, B extends string> = T & { readonly [brand]: B }

export type NoteId = Branded<string, "NoteId">
export type DiagramId = Branded<string, "DiagramId">
```

El problema que resuelve: con estado normalizado **todo** se referencia por id y todos los
ids son strings. Sin marcarlos, pasar un `DiagramId` donde se espera un `NoteId` compila
perfectamente, y el fallo aparece mucho después en runtime como "esa nota no existe".

El truco es que `brand` es un `unique symbol` **declarado pero nunca creado**: la propiedad
no existe en runtime, solo en el sistema de tipos. Un `NoteId` **es** un string a todos los
efectos prácticos (se puede concatenar, comparar, usar como clave), pero un string **no es**
un `NoteId`. **Coste en el bundle: cero.**

Para cruzar la frontera están los constructores, los únicos sitios del proyecto donde se
hace el cast:

```ts
export const noteId = (raw: string): NoteId => raw as NoteId
```

#### Unión discriminada y exhaustividad

```ts
interface Text     { readonly type: "text";     readonly id: ContentId; ... }
interface CheckBox { readonly type: "checkbox"; readonly id: ContentId; ... }

type Content = Text | CheckBox
```

La clave es que `type` sea un **literal** (`"text"`, no `string`). Eso le permite al
compilador dos cosas que con `string` son imposibles:

**Estrechar** — dentro de un `if (c.type === "checkbox")`, TypeScript *sabe* que `c` es un
`CheckBox` y deja acceder a `c.children`.

**Comprobar exhaustividad** — si tratas todos los casos, en el `default` la variable tiene
tipo `never`:

```ts
default: {
  const exhaustivo: never = content   // si añades un tipo nuevo, ESTO no compila
  return content
}
```

El día que se añada un tercer tipo de bloque —una imagen, un separador—, ese truco señala
**todos** los sitios que hay que actualizar. Con una interfaz base `{ type: string }` (que
es lo que tenía el prototipo) no habría ni estrechamiento ni exhaustividad: el compilador no
puede saber qué valores puede tomar un `string`.

#### `readonly` y `ReadonlyArray`

```ts
interface CheckBox {
  readonly checked: boolean
  readonly children: ReadonlyArray<CheckBox>
}

c.checked = true        // ❌ no compila
c.children.push(otra)   // ❌ no compila: push no existe en ReadonlyArray
```

`ReadonlyArray<T>` es el mismo array en runtime (coste cero) pero con los métodos mutadores
—`push`, `pop`, `splice`, `sort`, `reverse`— **quitados del tipo**. Los que devuelven copia
—`map`, `filter`, `concat`, `slice`— siguen ahí.

Así la regla "nunca `push`" deja de depender de que alguien se acuerde. Todo el dominio es
`readonly` de arriba abajo por este motivo.

#### `noUncheckedIndexedAccess`

Con esta opción activada, indexar un `Record` devuelve `T | undefined`:

```ts
const nota = state.notes[id]    // Note | undefined, no Note
if (!nota) return state         // hay que tratarlo, no hay escapatoria
```

Es fricción real: obliga a comprobar el caso en **cada** lookup. Se acepta a propósito
porque con un estado normalizado donde todo se busca por id, "ese id no existe" es
exactamente la clase de bug que no quieres descubrir en runtime. Y encaja con la regla del
reducer total: si el id no está, la operación **no hace nada** y devuelve el estado intacto.

#### *Type guard*

Una función que le enseña al compilador a estrechar un tipo. La sintaxis clave es
`x is CheckBox`:

```ts
export const isCheckBox = (content: Content): content is CheckBox =>
  content.type === "checkbox"
```

Con eso, tras `if (isCheckBox(c))` el compilador trata `c` como `CheckBox` y permite
`c.children`.

**Dónde se gana el sueldo:** en el nivel raíz del recorrido del árbol, antes de descender.
`Note.content` es `ReadonlyArray<Content>`, o sea que puede contener textos, y **un `Text` no
tiene hijas**. Sin el guard no hay forma de recorrer el árbol: hay que preguntar "¿esto tiene
hijos por los que bajar?" en cada nodo, y `isCheckBox` es esa pregunta.

#### Tipo explícito en todo, aunque se infiera

La regla de `CLAUDE.md` pide anotar las declaraciones de valor, los parámetros y el retorno de
toda función, callbacks de una línea incluidos. **El porqué es uno:** cuando un tipo cambia,
**se ve en el diff** en vez de que la inferencia lo absorba en silencio. Las cuatro excepciones,
con su motivo:

1. **`for (const x of …)`** — `error TS2483`: lo prohíbe el lenguaje, no el criterio. Es la
   única que no es una elección;
2. **la constante que ES una función** — ese trabajo lo hace su tipo de retorno; sus parámetros
   y su retorno sí van anotados;
3. **`as const`** — la anotación ensancharía justo lo que `as const` estrecha;
4. **destructuring** — no hay dónde ponerla sin repetir la forma del objeto entero.

**`src/` la cumple entera**, comprobado el 2026-09-29 con una sonda sobre el AST. Las pruebas
viejas de `test/core/` y `test/storage/` no, a sabiendas: es deuda medida en `TAREAS.md`, no un
precedente. **No tiene comprobación automática, y es deliberado:** es legibilidad, no
corrección —el compilador ya dice si un tipo está mal—, y los guardianes de este repo tapan cosas
que **funcionan mal en silencio**. El razonamiento completo, en `TAREAS.md`.

---

## 3. La cadena de la identidad

Esto es la síntesis de todo lo anterior, y lo más importante del documento. Lo que en las
convenciones aparece como reglas separadas —"preserva la identidad", "un no-op no hace
nada", "usa `strictEqual`"— **es una sola cosa**:

> **Si una operación no cambió nada, devuelve el objeto de entrada. El mismo, no una copia
> equivalente.**

De esa única invariante cuelgan **cuatro decisiones** en cuatro capas distintas, cada una
consultándola con un `===`:

```
   una operación de dominio devuelve el MISMO objeto
                        │
                        ▼
   ① el REDUCER          ¿el contenido cambió?
                         no → devuelve el estado tal cual,
                              y NO estampa updatedAt ni revision
                        │
                        ▼
   ② la PERSISTENCIA     ¿la entidad quedó sucia?
                         no → no se escribe a disco
                        │
                        ▼
   ③ el STORE            ¿next === state?
                         no cambió → no notifica a nadie
                        │
                        ▼
   ④ el RENDER           ¿esta rama sigue siendo el mismo objeto?
                         sí → no la redibuja
```

Leído al revés: **una sola función mal escrita en el dominio desactiva las cuatro
optimizaciones a la vez.** Si una operación devuelve siempre un objeto nuevo, entonces el
reducer siempre ensucia `updatedAt`, la persistencia siempre escribe, el store siempre
notifica y el render siempre redibuja. Marcar una casilla que ya estaba marcada acaba
provocando una escritura a disco.

Y no falla ningún test obvio. Por eso:

- las operaciones que no aplican **no lanzan**: devuelven la entrada intacta, que es lo que
  mantiene la cadena;
- los casos no-op son **la mitad de la especificación**, no un detalle;
- los tests que importan usan `assert.strictEqual`;
- la operación se llama **`setChecked` y no `toggleChecked`**: un `toggle` no puede ser
  nunca un no-op —siempre cambia algo por definición— mientras que `setChecked(id, true)`
  sobre una casilla ya marcada sí puede devolver el árbol intacto. **El nombre sostiene la
  invariante.**

---

## 4. Hexagonal: puertos y adaptadores

El `core` es puro: define **interfaces** (puertos) para todo lo que sea plataforma, y los
adaptadores las implementan. La dependencia va siempre de fuera hacia dentro; el core no
importa nada de nadie.

```
src/
├── core/          # dominio + casos de uso + puertos. CERO plataforma.
│   ├── domain/    # ← modelo + Position + helper + las 8 operaciones + las de diagrama + Result
│   │   └── errors/#   ← StorageError y MigrationError (§6.5). Sin index.ts
│   ├── ports/     # ← los CINCO: Clock, IdGenerator, Repository, StorageAdapter, BlobStore
│   ├── app/       # ← Action + reduce + Store + useCases + diffState
│   ├── migrations/# ← hydrate + runMigrations (la mitad PURA del arranque)
│   └── index.ts
├── storage/       # ← memory/ + file/ + blobs/ + writeBehind
│   └── blobs/     #   ← las implementaciones de BlobStore, que es OTRO puerto (§6.1)
├── ui/            # vanilla: vistas, listas y el editor. Sólo conoce al core (§7.5)
└── platform/      # composición
    └── web/       # el ÚNICO sitio que decide qué adaptador se inyecta

test/              # las pruebas, fuera de src/ y calcando su árbol (§8.5)
├── core/          # ← domain/ (+ errors/) · app/ · migrations/
├── storage/       # ← contract-tests/ · memory/ · file/ · blobs/
├── platform/web/
└── ui/
```

**Las flechas, medidas en los imports:** el core no importa de nadie; `storage/` y `ui/` sólo
del core; `platform/` de los tres; y **a `platform/` no la importa nadie**.

**`platform/` es la capa de composición**, y es una idea que conviene entender bien: es el
único sitio del proyecto que sabe *a la vez* qué puertos existen y qué implementaciones hay.
Todos los demás módulos conocen solo interfaces. Ahí es donde se decide "en web, el reloj es
`Date.now()`, los ids salen de `crypto.getRandomValues` y el almacenamiento es
`FileStorageAdapter` sobre `LocalStorageBlobStore`" —hoy; el día que el destino sea la carpeta
del usuario, sobre `DirectoryHandleBlobStore`—, y se inyecta hacia dentro. **Construido en la
Fase 4**, en `src/platform/web/`: `boot.ts` monta la pila y `main.ts` decide las piezas (§7.5).

El beneficio se cobra cuando llegue el escritorio: aparece `platform/desktop/` al lado, con
sus propias decisiones de inyección, y **nada más se toca**.

**Reglas de import** (las hace cumplir el campo `imports`, §8.2):

- **Entre módulos**, siempre por el alias y contra el `index.ts`: `#core/index`.
- **Dentro de un módulo**, siempre relativo y con `.js`: `./domain/Note.js` (el porqué, §8.6).
- Un alias **se declara cuando el módulo existe**, no antes.

---

## 5. El dominio

Tres entidades, más nociones de agrupación:

- **Note** — lista de contenido heterogéneo (`Text` | `CheckBox`). Los checkboxes son
  **recursivos** (tienen hijos), para TODOs anidados.
- **Diagrama** — un **lienzo libre** (como Miro o Excalidraw) con **nodos** que el usuario coloca
  arrastrando y **relaciones** entre ellos. Los nodos son pósits iguales por fuera y de dos
  clases por dentro: de texto (`SimpleNode`) y nodo-nota (`NoteNode`), que es el puente: al
  tocarlo entras en una Nota, y enseña su título **en directo**, sin guardar copia. Una relación
  (`DiagramRelation`) une dos nodos, con o sin flecha y con un texto opcional, y entre dos nodos
  puede haber **cualquier número** (multigrafo). En el código, `Diagram` (público, en inglés).
  **Construido entero**: el modelo y sus operaciones en el core, y la pantalla, relaciones
  incluidas (§9.11).

  **Se llamó *Plan* hasta el 2026-10-03**, y se renombró con el usuario antes de planificar la
  Fase 5, por dos motivos: «plan» chocaba con *el plan por fases* y con *planificar*, y daba por
  hecho para qué sirve; «diagrama» nombra la forma, no el uso. Se hizo entonces porque salía
  gratis: no había manera de crear uno, así que no había nada guardado con el nombre viejo ni
  hizo falta migración.
- **Context** — agrupa notas y diagramas, y decide su `defaultView` (la lista, o entrar directo
  a una nota o diagrama concreto). ⚠️ **`defaultView` se queda sin uso**: «abrir
  directamente una nota» lo hace ahora una ventana de tipo nota (§7.4). Sigue en el modelo, con
  su acción `set-default-view`, porque el dominio está cerrado; se revisa con las entidades
  «meta» de UX (`TAREAS.md` → *Ideas aparcadas*).
- **ContextoGeneral** — **vista derivada** de todas las notas y los diagramas, mezclados por
  nombre (§7.4). No es una entidad y no se persiste: guardarlo sería duplicar datos que se pueden calcular. Ahí
  aparecen las notas **huérfanas**, las que no están en ningún contexto. Como no es un contexto,
  se comporta distinto en tres cosas (§7.4): su título **no se renombra**, su papelera **borra
  la nota de verdad** (`delete-note`, con confirmación), y una nota creada desde él **nace sin
  contexto**.
- **ContextoCompuesto** — unión de varios contextos. Sale casi gratis del modelo por
  referencias.
- **Ventanas** — navegación estilo app de móvil. Es **estado de vista, no de dominio**: va
  separado de `AppState`. Mezclarlo llenaría la persistencia de basura de UI y haría que
  abrir un menú marcara notas como sucias. **Sí se guarda** —qué ventanas hay y en qué orden—,
  pero **fuera del core y fuera de `AppState`**: en `localStorage`, con una clave propia que
  gestiona la presentación. Decidido el 2026-09-27; las cuatro opciones evaluadas y su riesgo,
  en §7.4.

### 5.1 Lo que existe hoy en el repo

Para saber qué hay, se mira el repo —`find src test -name '*.ts' | sort` y `npm run check`—, no
este documento: la lista que había aquí se quedaba vieja sola. Las capas y su porqué, en §4–§7. Lo
único que no se deduce de los nombres: **por `src/core/index.ts` no salen, a propósito**, las dos
primitivas del helper (`updateContent.ts` y `updateContainerOf.ts`), `reduce` —se llega a él por
el `Store`— y `diagramOperations.ts`, que hoy sólo usa el core (§9.11).

### 5.2 Estado normalizado, con referencias por ID

Las entidades **no se anidan** unas dentro de otras. `AppState` es plano, como una mini base
de datos, y los contextos guardan **referencias**:

```ts
export type ItemRef =
  | { readonly kind: "note"; readonly id: NoteId }
  | { readonly kind: "diagram"; readonly id: DiagramId }
```

`Context.items` es `ItemRef[]`, **nunca** `(Note | Diagram)[]`. Tres razones independientes,
cada una suficiente por sí sola:

1. **Una nota puede estar en varios contextos.** Con entidades embebidas, cada nota vive
   dentro de un contexto y solo uno — lo que hace imposible el ContextoCompuesto.
2. **Guardar un contexto no reescribe sus notas.** Con las entidades dentro, cualquier
   adaptador de persistencia serio queda condenado a leer y escribir el árbol entero.
3. **`ItemRef` es discriminable en runtime.** `Note` y `Diagram` son ambos `{ id, name, ... }`:
   dado un elemento de la lista no hay forma fiable de saber cuál es. El `kind` lo resuelve.

Dos cambios más respecto al modelo del prototipo, ambos deliberados: **`Content` es una
unión discriminada** (§2.4) y **`Text` también lleva `id`**, que hace falta para direccionar
un bloque concreto al editarlo y para la reconciliación por `data-id` de la UI.

Los checkboxes anidados se direccionan **por `id`**, nunca por ruta de índices: una ruta como
`[0, 2, 1]` se rompe en cuanto insertas o borras un hermano por encima.

#### La asimetría del árbol, y lo que cuesta

```
Note.content: ReadonlyArray<Content>
├── Text                                    ← en la raíz caben textos
├── CheckBox
│   └── children: ReadonlyArray<CheckBox>
│       ├── CheckBox                         ← por debajo, SOLO casillas
│       └── CheckBox
└── Text
```

Viene del modelo del prototipo (`children: CheckBox[]`) y se respetó, pero **no es un detalle
inocente**: los dos arrays no son del mismo tipo, así que el recorrido del árbol **no tiene una
firma recursiva uniforme** y habrá caminos de código separados para el nivel raíz y para los
niveles anidados. Fue el fondo de dos decisiones ya cerradas: la forma del helper (**(e)**,
§5.4) y qué hacía `indent` sobre un `Text` (**(a)**, que se cerró por eliminación al
desaparecer `indent`). Si algún día se decide que un texto pueda colgar de una casilla, la
asimetría se disuelve y el código se acorta bastante.

Otro peaje previsible de los tipos marcados: recorrer un `Record` con claves marcadas obliga a
bajar a `string`, porque `Object.keys` devuelve `string[]` y pierde la marca. Cuando aparezca,
que vaya encerrado y comentado en un solo sitio en vez de repartido.

### 5.3 `Versioned`: los metadatos de escritura

```ts
export interface Versioned {
  readonly updatedAt: number    // del puerto Clock (convención: la verja no lo fuerza)
  readonly revision: Revision   // del puerto IdGenerator; cambia en cada escritura
}

export interface Note extends Versioned { readonly id: NoteId; /* ... */ }
```

**Se llama `Versioned` y no `Entity`** porque no es una entidad: no tiene id ni contenido. Es
la chapa de metadatos que una entidad lleva encima, y así `Note extends Versioned` se lee
como una frase verdadera: "una Nota está versionada".

**No lleva `id`** a propósito. Con `Entity` la herencia empujaría a meter el id dentro, y un
`id: string` heredado tiraría por tierra todo el marcado de `Ids.ts`. Cada entidad declara el
suyo con su tipo propio (`NoteId`, `DiagramId`, `ContextId`).

**`revision` es un token opaco, no un contador.** Lo único que se puede preguntar es si sigue
siendo el mismo. Sirve para escribir condicionalmente ("actualiza esto solo si la revisión
sigue siendo la que leí") y así **detectar** que algo cambió por debajo. Detectar, no
resolver: qué hacer con el conflicto es una política aparte, y "gana el último" **no** es la
elegida.

Se prefiere a comparar `updatedAt` porque los relojes de dos dispositivos no coinciden y
porque "gana el más nuevo" pierde datos sin avisar. Y se descartó un `version: number` —que
daría además orden— porque choca conceptualmente con `schemaVersion`: uno versiona *un dato*
y el otro *el formato de todos*.

Los dos campos van desde el principio aunque hoy no haya sincronización. El argumento que se
venía dando —"añadirlos cuando ya haya notas guardadas sería una migración de datos"— **no es
del todo válido todavía**, porque no hay persistencia y por tanto no hay datos que migrar; y
si valiera, valdría igual para `schemaVersion`, que sí se aplaza a la Fase 2. La justificación
real de `schemaVersion` —que *es* el mecanismo de migración y vive en `StorageAdapter`—, en §9.7.

### 5.4 El helper de copia por camino: son dos primitivas, no una

La técnica está explicada en §2.3 y la invariante que sostiene, en §3. Aquí va **qué forma
tiene exactamente** el helper que la implementa, que era la decisión (e) y está cerrada.

Lo primero, porque cambia el reparto del trabajo de la fase: las operaciones no piden
una sola cosa al helper, piden **dos**.

| | Qué hace | Quién la usa |
|---|---|---|
| **A — transformar un nodo** | llega al nodo con ese id y lo sustituye | `setText`, `setChecked` |
| **B — transformar el array contenedor** | llega al array *donde vive* ese id (o al de sus hijas) y lo reescribe | `insert`, `remove`, `split`, `merge` |

**Esta sección decide A. B se diseña con las operaciones estructurales**, y ya no está
bloqueada: cerrada la decisión (b) —`remove` no borra una casilla con hijas, §9.3— B se queda
en "quita este id del array donde vive" o "mete esto en este array", sin reparentar nada.

Dos avisos para cuando le toque:

- **La extracción va siempre con la guarda.** Sus dos únicos consumidores son `remove` y
  `merge`, y ambos hacen desaparecer una línea, así que ambos se niegan a hacerlo si tiene
  hijas (§9.3). No hace falta exponer una extracción pelada porque **nadie la usaría**. Si
  algún día llega `move` —que sí mueve subárboles enteros sin perder nada—, ese día habrá que
  sacarla, y ese día hay que acordarse de que `move` **no** puede escribirse como `remove` +
  `insert` o heredaría la guarda y dejaría de mover casillas con hijas, en silencio.
- **B no se puede generalizar como se generalizó A.** Una firma
  `<T extends Content>(items: readonly T[]) => readonly T[]` funciona para la extracción
  (`filter` conserva `T`) pero **rompe para `insert`**, porque meter un `Content` en un
  `readonly CheckBox[]` es justo lo que el compilador tiene que rechazar.

#### La decisión: parametrizada por variante, con la recursión escrita una sola vez

La alternativa era dos funciones separadas de ~25 líneas, una para la raíz y otra para la
profundidad. Se descartó. **El eje que importa no es raíz/profundidad, es `Text`/`CheckBox`.**

El problema de tipos es que en la raíz el array es `ReadonlyArray<Content>` y en profundidad
es `ReadonlyArray<CheckBox>`. Con una firma uniforme `(nodo: Content) => Content`, en
profundidad el compilador ya no puede garantizar que una casilla siga siendo casilla, y hay
que meter un `as` o un `isCheckBox(next) ? next : c` que **se traga el error en silencio** —lo
contrario de §1—. Parametrizando por **una transformación por variante**, el cast desaparece y
la recursión solo hace falta en el caso homogéneo:

```ts
const mapPreservandoIdentidad = <T>(items: ReadonlyArray<T>, fn: (x: T) => T): ReadonlyArray<T> => {
  let cambió = false
  const next = items.map(item => {
    const nuevo = fn(item)
    if (nuevo !== item) cambió = true
    return nuevo
  })
  return cambió ? next : items      // ← si nada cambió, el array ORIGINAL
}

/** La recursión. Vive aquí y sólo aquí: el caso homogéneo. */
const updateCheckBoxes = (
  items: ReadonlyArray<CheckBox>,
  id: ContentId,
  fn: (c: CheckBox) => CheckBox,
): ReadonlyArray<CheckBox> =>
  mapPreservandoIdentidad(items, c => {
    if (c.id === id) return fn(c)
    const children = updateCheckBoxes(c.children, id, fn)
    return children === c.children ? c : { ...c, children }
  })

/** La raíz. No es una segunda implementación: es el adaptador de la unión. */
export const updateContent = (
  content: ReadonlyArray<Content>,
  id: ContentId,
  fn: { readonly onText: (t: Text) => Text; readonly onCheckBox: (c: CheckBox) => CheckBox },
): ReadonlyArray<Content> =>
  mapPreservandoIdentidad<Content>(content, item => {
    if (item.id === id) return isCheckBox(item) ? fn.onCheckBox(item) : fn.onText(item)
    if (!isCheckBox(item)) return item
    const children = updateCheckBoxes(item.children, id, fn.onCheckBox)
    return children === item.children ? item : { ...item, children }
  })
```

**Unas 26 líneas las tres**, menos que las dos funciones de 25 que se descartaron, y sin un
solo cast. Los nombres no son sagrados; el reparto sí.

Dos razones, y la segunda es la que decidió:

1. **Un solo recorrido del árbol.** Duplicar el descenso recursivo es donde se esconden los
   bugs de esta clase de código. Y aquí el descenso carga con la invariante de identidad **en
   cada nivel** — escrito dos veces, hay que acertar dos veces.
2. **Los casos no-op salen gratis en vez de ser una rama más.** Mira `setChecked`:

   ```ts
   export const setChecked = (content: ReadonlyArray<Content>, id: ContentId, checked: boolean) =>
     updateContent(content, id, {
       onText: t => t,                                    // ← el no-op "es un Text", sin escribirlo
       onCheckBox: c => (c.checked === checked ? c : { ...c, checked }),
     })
   ```

   Los tres casos no-op de `setChecked` en la tabla de §9.3 —*el id no existe*, *el id es un
   `Text`*, *ya está en ese valor*— **no aparecen como condicionales en ninguna parte**: son
   consecuencia de la forma del helper. Siendo los no-ops la mitad de la especificación, que
   la mitad se sostenga sola es el argumento de peso.

En contra, para que quede escrito: dos funciones sueltas se leen de un vistazo, sin entender
un objeto de callbacks. Es cierto, y se paga **una vez** al leerlas; el descenso duplicado se
paga en cada operación que lo toque.

#### Los tres tests que lo cierran

Los dos del criterio de cierre de la Fase 1, con `assert.strictEqual`:

1. `updateContent(c, idQueNoExiste, …)` **`=== c`** — el array de entrada, no una copia.
2. `updateContent(c, idQueSíExiste, { onCheckBox: x => x, … })` **`=== c`** — el que se olvida.

Y el tercero, en positivo, que es el que demuestra de verdad la copia por camino: sobre el
árbol de la compra de §2.3, tras marcar `"Peras"`, comprobar que `"Limpieza"` **sigue siendo
el mismo objeto** y que `content`, `"Fruta"` y `"Peras"` son nuevos. Tres objetos nuevos, ni
uno más.

---

## 6. Persistencia

**Construido**: los puertos, el adaptador de memoria, el write-behind, el `Result` (§6.5),
`FileStorageAdapter` con el formato en disco y su validación (§6.2), y las dos implementaciones de
`BlobStore` (§6.1). **Sigue siendo sólo diseño** la semántica multi-backend —espejo, outbox,
réplicas— y la carpeta del usuario como destino de la app.

#### El recorrido de un cambio, de un vistazo

El mapa de la sección: qué le pasa a un cambio desde que el usuario toca algo hasta que llega
al disco. Lo que viene después de aquí son los detalles de cada tramo.

**Quién monta esta cadena:** `boot.ts`, en `src/platform/web/` (§7.5), que suscribe el escritor
al `Store` y elige adaptador. Hasta la Fase 4 el único sitio donde estaba montada entera era una
prueba, `test/storage/chain.test.ts`, que sigue ahí.

```
  el usuario marca una casilla
        │
        ▼
  useCases.setChecked(…)        añade meta: { now, revision }  ← el único sitio con Clock e IdGenerator
        │
        ▼
  store.dispatch(action)
        │  next = reduce(state, action)
        ├───── next === state ──→ ✗ MUERE: nada cambió
        │                            no se notifica a nadie y el disco ni se entera
        ▼
  state = next  ·  listener(next)          ← la única mutación del proyecto
        │
        ▼
  writeBehind.onState(state)    pendiente = state
        │                       cancela la espera anterior y programa otra   ← la coalescencia:
        ▼                                                                      diez cambios seguidos
  schedule(flush, 500 ms)                                                      son UNA escritura
        │
        ▼
  flush() → cola.then(escribirPendiente)   ← encadena: el flush a mano y el del temporizador no se solapan
        │
        ├───── detenido !== null ──→ ✗ MUERE: el escritor está detenido
        │                              devuelve el MISMO error y no toca el almacén
        ▼
  diffState(escrito, pendiente)            ← contra lo último ESCRITO, no contra el aviso anterior
        │
        ├───── === NO_CHANGES ──→ ✗ MUERE: nada nuevo que escribir
        │                            escrito = objetivo, y el almacén sin tocar
        ▼
  adapter.transaction(…)
        │   put     notes · diagrams · contexts  ← primero TODO lo que se guarda
        │   delete  notes · diagrams · contexts  ← después lo que se borra
        │
        ├── err io ──────→ pendiente se conserva · escrito NO avanza  →  REINTENTA
        ├── err lo demás ─→ detenido = error · cancela la espera      →  SE DETIENE (sin vuelta atrás)
        │                   y onError(error), UNA vez                    →  la UI enseña el aviso
        ▼
  escrito = objetivo                       el disco está al día
```

**Lo normal es que un cambio no llegue al disco**, y por eso lo que vale de este recorrido son
las tres puertas donde se muere. Cada una tiene su porqué escrito en otro sitio y no se repite
aquí: dos de ellas son eslabones de la cadena de identidad —el `dispatch` es el ③ de §3 y el
`diffState` el ②—, el debounce y el reparto del escritor en dos mitades están en §6.4, el
orden `put`-antes-que-`delete` en §6.2, y las dos salidas del fallo en §6.5.

Dos detalles que no caben en el dibujo sin ensuciarlo. Hay una **cuarta salida, menor**: un
`flush()` que no encuentra pendiente —otro se le adelantó— devuelve `ok` sin mirar nada. Y
`onState` recuerda el estado **también cuando el escritor está detenido**; lo que deja de hacer
es programar la espera. Nada de lo pendiente se pierde mientras la página siga abierta: se queda
en memoria, esperando a un reanudar que hoy no existe. **Al cerrarla sí se pierde**, y por eso el
aviso de `onError` lo dice (§6.5).

**El cambio baja; el error sube.** El segundo dibujo contesta otra pregunta —dónde nace cada
error— porque es donde más se lee mal el reparto de §6.1:

```
                                  QUÉ INVENTA                        try/catch
  ─────────────────────────────────────────────────────────────────────────────
  writeBehind                nada: sólo pregunta «¿kind === io?»         1  el aviso onError
        ▲
        │  Result<…, StorageError>, con el kind INTACTO: nadie reempaqueta
        │
  StorageAdapter
   ├─ MemoryStorageAdapter    nada — un Map no falla                      1  transaction
   │                          (su único io es un fn ajeno que lanzó)
   └─ FileStorageAdapter      la SERIALIZACIÓN y la FORMA → corrupt       5  caminoDe
        ▲                     (y un io si JSON.stringify fallara,            aBytes
        │  Result              o si el aviso onCorrupt lanzara)              parsear
        │                                                                    transaction
        │                                                                    el aviso onCorrupt
      BlobStore
       ├─ LocalStorageBlobStore      quota-exceeded · permission-denied   1  frontera
       │                             · io · corrupt (su propio base64)
       └─ DirectoryHandleBlobStore   permission-denied · not-found        1  frontera
                                     · quota-exceeded · io
                                     (corrupt nunca: no parsea nada)
  ══════════════ LA FRONTERA · por encima de aquí no lanza nadie ══════════════
  la plataforma              localStorage · File System Access API: LANZAN
```

**Las fronteras del dibujo son todas las de la persistencia**, y con la de `runMigrations`
suman diez. Con las cinco de `platform/web/` —dos en `LocalStorageWindows` (leer y escribir la
lista de ventanas), dos en `resetStorage` (`requestReset` apunta la marca de «Borrar todo» y
`resetIfRequested` borra al arrancar, §7.4) y una en `main.ts` (`window.localStorage` **lanza**
si el navegador tiene bloqueados los datos del sitio)— son **quince `try` en todo el código de
producción, y cero `throw`**, medido el 2026-10-04. Eran seis al cerrar la Fase 3, ocho tras
tapar dos fugas (más abajo), la Fase 4 trajo cinco y «Borrar todo» las dos últimas. `ui/` no
tiene ninguno. Qué significa cada `kind` y por qué son esos
cinco está en §6.5; que el `kind` llegue arriba intacto es lo que hace posible la última rama
del primer dibujo, porque es lo único que el escritor mira para decidir si insiste o se para.

### 6.1 Dos puertos, a propósito en dos niveles

**Escritos ya**, en `src/core/ports/`. Sólo las interfaces; las implementaciones viven fuera.

```ts
export interface Repository<T, TId extends string> {
  readonly get:    (id: TId) => Promise<Result<T | null, StorageError>>
  readonly getAll: () => Promise<Result<ReadonlyArray<T>, StorageError>>
  readonly put:    (entity: T) => Promise<Result<void, StorageError>>
  readonly delete: (id: TId) => Promise<Result<void, StorageError>>
}

export interface StorageAdapter {
  readonly notes:    Repository<Note, NoteId>
  readonly diagrams: Repository<Diagram, DiagramId>
  readonly contexts: Repository<Context, ContextId>
  // best-effort. El Result va DENTRO y FUERA — el porqué, abajo
  readonly transaction: <T>(
    fn: () => Promise<Result<T, StorageError>>,
  ) => Promise<Result<T, StorageError>>
  readonly getSchemaVersion: () => Promise<Result<number, StorageError>>
  readonly setSchemaVersion: (v: number) => Promise<Result<void, StorageError>>
}

/** Nivel bajo: solo mueve bytes. No sabe qué es una Nota. */
export interface BlobStore {
  readonly read:   (path: string) => Promise<Result<Uint8Array | null, StorageError>>
  readonly write:  (path: string, data: Uint8Array) => Promise<Result<void, StorageError>>
  readonly delete: (path: string) => Promise<Result<void, StorageError>>
  readonly list:   (prefix: string) => Promise<Result<ReadonlyArray<string>, StorageError>>
}
```

**El `BlobStore` mueve `Uint8Array`, no `string`.** Hoy todo lo que se guarda es JSON, así que
cadenas parecerían suficiente. Se eligen bytes porque son el denominador común de verdad: es lo
que aceptan y devuelven las APIs de fichero, y en cuanto haya que guardar algo que no sea texto
—una imagen pegada en una nota— un `BlobStore` de cadenas no sirve. Codificar y descodificar es
trabajo de quien monta la entidad, no de quien mueve los bytes.

**Los once métodos devuelven `Result`, y ninguno lanza** (§6.5). Dos de esas firmas merecen
explicación, porque no se deducen de la regla general:

- **`transaction` lleva el `Result` dentro y fuera.** Es la única del puerto que ejecuta código
  ajeno, y su cuerpo real hace `put` tras `put`, cada uno devolviendo ya un `Result`. Si `fn`
  devolviera una `T` pelada, el resultado sería `Result<Result<T, …>, …>`: dos sobres para un
  solo fallo. El aplanado está en la firma. Dos reglas más, que son contrato y están probadas:
  un `err` de `fn` **corta la transacción y sale sin reempaquetar** —envolverlo en `io` sería
  decir «reintenta» justo cuando reintentar no sirve—, y una **excepción** lanzada dentro de
  `fn` **no escapa**: se traduce a `io`, porque el puerto promete un `Result` y no un rechazo.
- **`BlobStore` también devuelve `Result`, y no es una concesión a la simetría.** Cada
  implementación traduce los errores de **su** plataforma: `localStorage` sabe cuál es su
  excepción de cuota y la File System Access API cuál es la suya de permisos.
  `FileStorageAdapter` traduce sólo lo suyo, que es la serialización (un `JSON.parse` que falla
  → `corrupt`). Si la traducción de plataforma subiera al adaptador, tendría que conocer las
  excepciones de los cuatro backends de la tabla de abajo — exactamente el acoplamiento que
  este reparto en dos niveles existe para evitar.

**Dónde cae exactamente esa frontera: el sobre y el contenido.** Salió al escribir las
implementaciones, y **no cambia el reparto de arriba**: sólo lo precisa, porque hay un `corrupt`
que sí nace abajo.

| | Qué es | De quién |
|---|---|---|
| **el sobre** | la codificación que el propio `BlobStore` aplicó para meter bytes en un almacén que sólo admite texto | **suyo**: lo escribió él, y si no se puede abrir es `corrupt` |
| **el contenido** | si dentro hay una `Note` bien formada | de `FileStorageAdapter`, que es quien parsea |

El caso real es `LocalStorageBlobStore`, que guarda en base64 porque `localStorage` es un mapa
de texto a texto: si su propio `atob` falla, lo guardado ya no son los bytes que escribió.
Ahí `io` sería mentira —`atob` va a fallar igual la próxima vez, y `io` significa «reintenta»—,
así que sale `corrupt`, con su `path`. `DirectoryHandleBlobStore` **no tiene sobre que abrir**, y
por eso no produce `corrupt` nunca. Lo de arriba sigue siendo serialización y sigue sin bajar.

**Dos cosas cambiaron respecto al boceto que había aquí**, y las dos al escribirlos:

- **El id de `Repository` va marcado**, con un segundo parámetro de tipo, en vez de ser un
  `string` pelado. Con `string` se puede pasar un `ContextId` al repositorio de notas y compila
  tan ricamente, que es justo el fallo que los ids marcados existen para impedir (§2.4).
  Comprobado rompiéndolo: `s.notes.get(unContextId)` da
  `TS2345: Argument of type 'ContextId' is not assignable to parameter of type 'NoteId'`.
- **Son propiedades de función, no métodos** (`readonly get: (id) => …` en vez de `get(id)`).
  No es cosmético: TypeScript comprueba los parámetros de un **método** de forma bivariante
  incluso con `strict`, y los de una **propiedad de función** de forma contravariante, que es lo
  estricto. De paso queda igual que `Clock` e `IdGenerator`.

**Todos los puertos son `async`, incluso los adaptadores sincrónicos.** Si un adaptador en
memoria expone firmas sincrónicas, enchufar red o SQLite después obliga a reescribir todos
los llamantes.

**Un `get` que no encuentra nada devuelve `null`, no `undefined`**, aunque el resto del
proyecto conviva con `undefined` por `noUncheckedIndexedAccess` (§2.4). La diferencia es que
aquí el valor es una **respuesta**: `null` dice «he ido a buscarlo y no está», que no es lo
mismo que «no me han dado nada». Indexar un `Record` es lo segundo; preguntarle a un almacén
es lo primero.

**El `BlobStore` existe porque un fichero local y uno remoto solo difieren en dónde van los
bytes.** Un único `FileStorageAdapter` parametrizado por `BlobStore` da tres backends (eran cuatro
hasta descartar Drive):

| Objetivo | Implementación | Estado |
|---|---|---|
| Desarrollo / fallback | `LocalStorageBlobStore` | **construida**, 108 líneas de código, 22 pruebas |
| Fichero local en disco | `DirectoryHandleBlobStore` con `showDirectoryPicker()` (Chromium) | **construida**, 156 líneas, sin pruebas a propósito (§6.3) |
| Fallback otros navegadores | el **mismo** `DirectoryHandleBlobStore` con OPFS | el código está; sólo cambia quién le pasa el handle |
| ~~Drive~~ | ~~`DriveBlobStore`~~ | **descartado el 2026-10-12**: la nube será Supabase, que es una base de datos y no un `BlobStore` (`TAREAS.md` → *La nube*) |

La File System Access API y OPFS exponen el mismo `FileSystemDirectoryHandle`: solo cambia
**cómo obtienes el handle**, no la implementación.

**Las dos reciben por constructor lo que las ata a la plataforma** —un `Storage`, un
`FileSystemDirectoryHandle`—, y eso no es comodidad para las pruebas: **conseguir esa cosa es
composición**, y la composición vive en `platform/` (§7.5): hoy `main.ts` le pasa
`window.localStorage` a la primera, y a la segunda no la monta nadie todavía. Que salga gratis poder
montarlas en Node con un objeto falso es la consecuencia, no el motivo.

**Y viven en `src/storage/blobs/`, no dentro de `file/`.** La razón es justamente el reparto de
esta sección: `memory/` y `file/` nombran **formas de guardar entidades**, o sea
implementaciones de `StorageAdapter`. `BlobStore` es **otro puerto**, y no está debajo de
`Repository` sino que es **un parámetro** de `FileStorageAdapter`. Meterlas en `file/` diría que
son parte del adaptador de ficheros; `blobs/` nombra el puerto que implementan, que es lo único
que `localStorage`, la carpeta del usuario y OPFS tienen en común.

Nota conceptual sobre el reparto por fases: `Clock` e `IdGenerator` son puertos de **la
semántica de escritura del dominio**; `Repository`, `StorageAdapter` y `BlobStore` son
puertos de **persistencia**. Son dos cosas distintas, y están en fases distintas por eso, no
por inercia.

#### Cómo se relacionan los tres entre sí

El diagrama de «dos niveles» sugiere una relación que no es la que hay. **Las tres relaciones
son de tipo distinto:**

- `StorageAdapter` **tiene** tres `Repository`. Composición.
- `Repository` es una **interfaz** que cada adaptador cumple a su manera.
- `BlobStore` es un **parámetro** de *una* implementación concreta.

Dicho del tirón, porque es lo que más se lee mal: **`BlobStore` no está debajo de
`Repository`, está debajo de `FileStorageAdapter`.** El adaptador de memoria no lo toca jamás.

```
FASE 2 — MemoryStorageAdapter                FASE 3 — FileStorageAdapter
─────────────────────────────                ──────────────────────────────
StorageAdapter                               StorageAdapter
├── notes    ──→ Map<NoteId, Note>           ├── notes    ─┐
├── diagrams ──→ Map<DiagramId, Diagram>     ├── diagrams ─┼─→ serializa a JSON
├── contexts ──→ Map<ContextId, Context>     ├── contexts ─┘   y traduce id → camino
└── schemaVersion ──→ un number              └── schemaVersion       │
                                                                     ▼
    (ni rastro de BlobStore)                                    BlobStore
                                                                     │
                                                  ┌──────────────────┴─────────────┐
                                                  ▼                                ▼
                                            localStorage                    carpeta / OPFS
```

**Cada capa habla un idioma distinto, y la traducción ocurre en un solo sitio:**

| Capa | Su vocabulario | Ejemplo |
|---|---|---|
| `StorageAdapter` / `Repository` | entidades e ids | `notes.put(unaNota)` |
| ⇅ **`FileStorageAdapter`** | *aquí y sólo aquí* se traduce | `Note` → JSON → bytes, y `NoteId` → `"notes/<id>.json"` |
| `BlobStore` | caminos y bytes | `write("notes/abc.json", <bytes>)` |

Que el esquema `notes/<id>.json` viva en **un único fichero** del proyecto es el beneficio
entero del reparto: cambiarlo, o pasar de JSON a otro formato, toca ahí y en ningún otro lado,
y los `BlobStore` ni se enteran.

**Son dos ejes de variación independientes**, y por eso son dos puertos y no uno:

```
¿cómo se guarda?    memoria  ·  ficheros JSON   ←  lo elige el StorageAdapter
¿dónde van?         ——       ·  ls/disco/OPFS   ←  lo elige el BlobStore
                     ↑
              en memoria este eje no existe
```

**Y por qué `Repository` no habla directamente con `BlobStore`**, que es la simplificación que
tienta: porque un `put` no siempre es un blob —§6.2 pone un `manifest.json` junto a las
entidades, y tres repositorios escribiendo por su cuenta lo actualizarían tres veces,
pisándose— y porque la serialización es la misma para las tres clases: puesta en el adaptador
se escribe una vez; puesta en cada repositorio, tres veces casi iguales, que es como empiezan
a divergir.

Ese argumento tiene ahora una consecuencia escrita: **el manifiesto no lleva índice de ids**, y
uno de los tres motivos de que no lo lleve es precisamente éste (§6.2). Hoy sólo lo escribe
`setSchemaVersion`, o sea que tiene **un único escritor**, no tres.

### 6.2 Formato y semántica

**Formato: un fichero por entidad** (`notes/<id>.json`) más un `manifest.json`. Da diffs
pequeños y conflictos por nota en vez de globales. Lo que decide es el grano —**un documento por
entidad**—, no que sea un fichero: una fila por entidad en una base de datos es la misma decisión. **Construido**, en
`src/storage/file/FileStorageAdapter.ts`, que es el único fichero del proyecto donde aparece
este esquema: cambiarlo —o dejar JSON por otro formato— se toca ahí y en ningún sitio más.

```
manifest.json          { "schemaVersion": 1 }
notes/<id>.json        una Note
diagrams/<id>.json     un Diagram
contexts/<id>.json     un Context
```

Los detalles que no se deducen de esas cuatro líneas, y por qué:

- **JSON indentado a dos espacios y con salto de línea final.** Si se parte por entidad para
  tener diffs pequeños, un JSON en una sola línea no los da: cambiar una palabra reescribiría
  la línea entera y el diff volvería a ser «el fichero».
- **El id pasa por `encodeURIComponent` al formar el camino.** Hoy no hace falta —los ids los
  fabricará un `IdGenerator` y no traerán barras—, y es una línea que impide que un id con `/`
  o `..` dentro escriba **fuera de su carpeta**. No se descodifica nunca: el id de vuelta sale
  de dentro del JSON, no del nombre del fichero.
- **`getAll` ignora lo que no reconoce.** Una carpeta de verdad es un sitio compartido: el
  sistema operativo y el usuario dejan ahí sus cosas, y un `.DS_Store` no puede convertir la
  lectura entera en un `corrupt`.
- **Las tres clases no comparten carpeta**, que es lo que hace que un `getAll` de notas no
  tenga que mirar dentro de los diagramas para descartarlos.

#### Lo que se lee se valida campo a campo

Hasta la Fase 4 era **un agujero conocido**: al leer sólo se comprobaba que lo parseado fuera un
objeto con un `id` de texto, y un `notes/x.json` con un `content` inventado entraba en `AppState`
tal cual. **Hoy lo cierra `src/storage/file/schema.ts`**, escrito a mano y sin dependencias:

- **nota, diagrama y contexto, campo a campo**, con el contenido recursivo de la nota incluido;
- en una nota, además, **ningún texto dentro de una casilla** —un texto sólo cabe en la raíz— y
  **ningún id de línea repetido en ningún nivel**, porque con dos iguales toda operación actuaría
  siempre sobre la primera;
- en un diagrama *(desde Fase 5 · Modelo)*, **`nodes` y `relations` tienen que ser mapas** —un
  `nodes: []` de la forma vieja es `corrupt`— y **la clave de cada entrada tiene que ser su id**:
  si no, el reducer buscaría por una clave y escribiría con otra. **No mira que los extremos de
  una relación existan**: eso no es forma, es integridad, y lo limpia `hydrate` (§9.11);
- **los campos de más se ignoran**: se comprueba lo que la app necesita, no que no haya nada más.

Lo que no tiene forma sale como **`corrupt` con el motivo** («la línea «x» está repetida») y va
**por el mismo camino que un JSON ilegible**: con `onCorrupt` se salta y se avisa (§6.5).

**Por qué en `storage/` y no en el core**, que es lo primero que tienta —«la forma de una `Note`
es del dominio»—: lo que se valida aquí no es una `Note`, es **la forma en disco**, y ésa es del
adaptador igual que el nombre del fichero o la indentación. El core recibe entidades ya
construidas y no sabe que existe un JSON; el día que el formato cambie, cambia aquí y la
migración de §9.7 lleva de una forma a otra. Y **a mano, no con una librería**: son tres
entidades y un árbol, y la política de dependencias (§8.4) manda comprobar antes lo nativo.

#### Qué lleva dentro el `manifest.json`: la versión de esquema, y nada más

**Decidido y construido.** El manifiesto lleva **sólo `{ "schemaVersion": n }`**, que es lo que
ya estaba decidido que vive en el almacén y no en `AppState` —es propiedad de lo guardado, §9.7—.
Va como objeto y no como un número pelado para que pueda crecer sin romper lo ya escrito.

**Lo que NO lleva es un índice de ids**, que era la pregunta de verdad, y el porqué es lo que
importa aquí porque es lo que evita que alguien lo «mejore» más adelante:

- **serían dos fuentes de verdad, y se desincronizan.** Con índice, un `put` pasa a ser **dos
  escrituras** —la entidad y el manifiesto— que no hay forma de hacer atómicas (abajo). Morir en
  medio deja o un id fantasma apuntando a un fichero que no existe, o —peor— **una nota guardada
  que el índice no menciona y que por tanto no se abriría nunca**: perder una nota que está en
  disco, intacta. La carpeta ya es una fuente de verdad; la segunda sólo puede contradecirla;
- **los tres repositorios se pisarían sobre el mismo fichero**, que es exactamente el motivo que
  §6.1 da para que `Repository` no hable directamente con `BlobStore`;
- **el `list` del puerto existe para esto.** Con índice no tendría consumidor.

**Precio aceptado, dicho sin esconderlo:** `getAll` se resuelve con un `list(prefijo)` más **una
lectura por entidad**, y en la File System Access API cada lectura es abrir un fichero. Se paga
**una vez al arrancar** —`getAll` es lo que alimentará la hidratación, y nadie más lo llama— y
con cientos de notas es irrelevante. **Si algún día duele, la respuesta es una caché, no una segunda fuente de verdad**:
una caché que se equivoca se tira y se reconstruye; un índice que se equivoca pierde notas.

**Manifiesto ausente = versión 0**, y eso significa «aquí no se ha escrito nunca nada», no
«esquema viejo». Es la misma distinción que ya costó un susto en la Fase 2 (§9.7): confundirlas
hace que el runner busque una migración del 0 al 1 que no existe ni va a existir. Un manifiesto
**ilegible**, en cambio, sí es `corrupt` — migrar sin saber de qué versión se viene es la forma
de estropear lo guardado de verdad.

#### Qué garantiza `transaction` sobre ficheros sueltos, y qué no

El puerto la declara *best-effort* y avisa de que un adaptador sobre ficheros no puede cumplirla
de verdad. «Best-effort» sin más es una promesa que no se puede usar, así que aquí está lo que
significa exactamente. **Garantiza:**

- **que no reordena ni agrupa las escrituras.** No es una perogrullada: **el write-behind
  depende de ello**. Hace primero todos los `put` y después todos los `delete` para que el peor
  caso al morir a mitad sea una nota que sobra —basura inofensiva— y nunca una `ItemRef`
  colgando. Si este adaptador se pusiera a bufferizar y volcar en otro orden, esa garantía se
  perdería aquí **sin que nadie lo notara**;
- **que el `err` de la función corta y sale sin reempaquetar**, con su `kind` de origen intacto;
- **que una excepción de la función no escapa**: se traduce a `io`.

**No garantiza**, y quien la use no debe suponerlo:

- **atomicidad.** No hay rollback y no puede haberlo: lo ya escrito está en disco;
- **aislamiento.** No hay cerrojo, así que dos transacciones concurrentes intercalarían sus
  escrituras. Hoy no hay dos llamantes —el write-behind encadena los suyos— y poner un cerrojo
  sería construir para un consumidor que no existe, con el regalo de un interbloqueo el día que
  alguien anidara dos;
- **lecturas consistentes.** Un `get` desde dentro ve el disco tal y como esté en ese momento.

#### Semántica multi-backend

**Decidida, no construida, y revisada el 2026-10-12:** la nube será **Supabase**, como copia de
seguridad y para sincronizar dispositivos. El diseño entero —el sincronizador, el puerto nuevo, la
copia en conflicto, la sesión en ⚙— está en `TAREAS.md` → *La nube*, y entra aquí cuando se
construya. Lo que sigue en pie: **lo local, siempre primario y fuente de verdad** en cada
dispositivo, y la nube alimentada por **una cola de pendientes** con reintentos, para que la app
nunca se bloquee porque la red o la sesión fallen. El estado de sincronización es **dato
persistido**, no estado en memoria. Lo que cambia: no hay réplicas recibiendo cada escritura por
un `CompositeStorage`. El core habla sólo con lo local, y lo que baja de la nube entra por el core.

**La config de storage no puede vivir en el storage que configura.** Necesita su propio sitio
aparte (`settings.json` o localStorage), o tienes un huevo-y-gallina al arrancar.

**Nada de credenciales en el repo ni en el bundle.** En web, la sesión de un servicio externo se
guarda en el navegador, conectada y revocable desde ⚙. Hasta el 2026-10-12 decía «token en memoria,
**nunca** en localStorage»; se cambió para que abrir la app no pida nunca iniciar sesión, y el
riesgo aceptado está en `TAREAS.md` → *La nube*. En escritorio, keychain del sistema.

#### Las dos decisiones propias de `LocalStorageBlobStore`

**Es el destino de la app hoy, y es provisional**: el 2026-09-20 se decidió arrancar con él para
salir del paso, en vez de con la carpeta del usuario u OPFS. Es barato de revertir —`BlobStore` es
un puerto y el destino se inyecta en un solo sitio de `platform/`—, pero deja tres cabos con
nombre: qué pasa con lo ya escrito en `localStorage` el día que cambie el destino —y con ello qué
borra «Borrar todo» (§7.4)—; el techo de unos 5 MB por origen, que el base64 de abajo infla en un
tercio; y que la lista de ventanas no viaja con las notas (§7.4).

`localStorage` no es un sistema de ficheros, es **un mapa de texto a texto**, y de ahí salen las
dos únicas decisiones que ese adaptador toma por su cuenta. Las dos se confirmaron al
escribirlo.

**1. Los bytes van en base64, y cuesta un 33% de tamaño.** El puerto mueve `Uint8Array` y
`localStorage` sólo guarda texto, así que hay que codificar. La alternativa era una «cadena
binaria» latin1, un carácter por byte, que ocupa ese 33% menos; se descarta porque deja en el
almacén **texto que parece texto y no lo es**, y cualquier herramienta que mire ahí —las de
desarrollo del navegador, una exportación futura— lo estropearía sin avisar. Se paga el tamaño
sobre una cuota que ya es pequeña, y para lo que esta implementación es —desarrollo y
emergencia— es el cambio correcto. `btoa`/`atob` los traen el navegador y Node, así que las
pruebas corren sin instalar nada.

**2. Las claves llevan un espacio de nombres delante.** `localStorage` es un sitio
**compartido**: en el mismo saco están las claves de esta app, las de cualquier script de
terceros y las de cualquier prototipo que alguien dejara ahí. Sin prefijo propio pasarían dos
cosas, y las dos en silencio: `list("")` devolvería **claves ajenas** como si fueran caminos
nuestros —hoy le salvaría a `getAll` el filtro por carpeta y extensión, pero eso es que nos
salva otro fichero, no éste—, y un `write` podría **pisar la clave de otro**, que es peor
porque rompe algo que no es nuestro. El prefijo es un detalle privado: fuera de ese fichero los
caminos son los mismos que ve cualquier otro `BlobStore`. No se hace configurable por
constructor porque no tiene consumidor, la misma regla que dejó fuera `move` y el puerto
`Scheduler`.

### 6.3 Tests de contrato

Una sola especificación (`test/storage/contract-tests`) que **todos** los adaptadores deben pasar.

La idea es esta: en vez de testear cada adaptador por separado —lo que garantiza que cada uno
funcione *a su manera*— se escribe **una sola suite** contra la interfaz, y se ejecuta contra
cada implementación. Un adaptador está terminado **cuando pasa el contrato**, y esa es la
única definición de "modular" que no se degrada con el tiempo: si un backend nuevo se
comporta distinto, el contrato lo cantea.

**Corre TRES veces en cada `npm test`**, no las dos que se previeron, una por adaptador. Son **22
casos** —17 hasta la escritura condicional del 2026-10-03—, así que 66 de las pruebas salen de aquí:

| Pasada | Qué monta | Qué añade sobre la anterior |
|---|---|---|
| `MemoryStorageAdapter` | tres `Map` y un número | el suelo: qué es ser un almacén |
| `FileStorageAdapter` + `BlobStore` falso | la lógica de serialización | que el esquema en disco cumple el contrato, con la plataforma bajo control |
| `FileStorageAdapter` + `LocalStorageBlobStore` | **la pila entera, sin nada de mentira salvo el objeto `Storage`** | que lo que el adaptador *necesita* de un `BlobStore` es lo que un `BlobStore` de verdad *hace* |

**La tercera no estaba prevista y se ganó su sitio sola.** Un falso demasiado amable —uno que
devolviera los mismos bytes que recibió, sin codificar— deja pasar un fallo de codificación que
montado sobre el de verdad no pasa. Y está medido, rompiendo el código a propósito: devolver las
claves de `list` con el espacio de nombres delante tumba **7** pruebas, de las que **5 son de
esta tercera pasada**; hacer que `read` de una clave ausente devuelva `not-found` en vez de
`ok(null)` tumba **6**, de las que **3** son suyas. Ni las pruebas propias del blob ni el
contrato con el falso las cazaban por separado.

**Planificado, no construido:** un segundo modo `integration` contra servicios reales, opt-in
por variable de entorno, que no tiene sentido mientras no haya un backend de verdad que probar.

#### Lo que el contrato exige, y lo que no puede ni ver

Conviene afinar una regla que se lee mal. `MemoryStorageAdapter` **no tiene ni una prueba
propia**, y eso está escrito como el diseño; `FileStorageAdapter` sí las tiene, en un fichero
aparte. **No es una excepción: es la otra cara de la misma regla.**

El contrato está escrito **contra la interfaz**, y la interfaz habla de entidades e ids. **No
sabe que existe un `BlobStore`**, así que no puede decir «haz que la plataforma falle» ni
«comprueba que el fichero se llama `notes/compra.json`» — y esas dos son justamente las cosas
que este adaptador tiene de suyo. Dicho corto:

> El contrato prueba que un adaptador es **un almacén**. El fichero aparte prueba que es **el de
> ficheros**.

La regla verdadera, entonces, no es «los adaptadores no tienen pruebas propias», sino: **lo que
exige la interfaz se prueba en el contrato; lo que sólo tiene esta implementación, aparte.** El
de memoria no tiene ninguna porque no tiene lógica propia —tres `Map` y un número—, no porque
esté prohibido. Y el criterio para saber si una prueba está en el sitio equivocado sigue valiendo
igual: si pudiera escribirse contra la interfaz, es que pertenece al contrato.

Con la misma lógica se decide cuándo vale un doble, que parece contradecirse con lo de abajo y no
se contradice: el `BlobStore` falso con el que corre todo esto es legítimo porque lo que prueba
es **la capa gorda de encima**; lo que se descarta es usar un doble para probar la capa fina que
sólo traduce.

**Lo que el contrato exige sobre los fallos**, desde el paso 0 de la Fase 3: que `get` de algo
no guardado sea `ok(null)` y borrar lo que no está sea `ok` —ausencia no es fallo—, que
`transaction` devuelva el `err` de su función **sin reempaquetar**, y que **una excepción
lanzada dentro de esa función no escape**: se traduce a `io`. Esta última invirtió dos casos de
la suite, que hasta entonces exigían justo lo contrario —propagar la excepción—, y va probada
**dos veces**: con un fallo asíncrono y con uno síncrono. El síncrono no es un duplicado: un
`transaction` sin `async` rompería antes de que existiera promesa alguna, así que ningún
`catch` lo alcanzaría.

Los adaptadores sobre `FileSystemDirectoryHandle` y OPFS necesitan un navegador real y
`node:test` no llega ahí. **Decidido, y antes de empezar la Fase 3: se verifican a mano, con
una lista de pasos escrita en el repo, y sin instalar ningún runner de navegador.**

El reparto en dos niveles reduce el problema a casi nada, y eso **ya está comprobado, no
previsto**: `FileStorageAdapter` —que es donde está toda la lógica— pasa esta misma suite en Node
con un `BlobStore` falso, y `LocalStorageBlobStore` la pasa además con la pila entera montada.
Lo único que queda sin automatizar es `DirectoryHandleBlobStore`.

**Su lista se pasó el 2026-09-13** (`test/storage/blobs/VERIFICACION-MANUAL.md`): en Brave pasan
las cinco secciones —arrancado con `--enable-features=FileSystemAccessAPI`, porque no trae la API
de fábrica—, y en Firefox sólo OPFS, porque no tiene `showDirectoryPicker()`: «este navegador no
puede» es un resultado, no un hueco. Cazó lo que ninguna prueba podía ver —un fichero de 45 bytes
y no de 0, que es el `close()` de abajo, y que un `write` con el permiso revocado de verdad no
escribía: el `mtime` no se movió— y un falso verde del método: el paso B sin recargar reutiliza el
handle en memoria y no prueba nada. ⚠️ Se pasó sobre `dec4306` **con el árbol sucio**, y por eso
**si se toca ese fichero, se vuelve a pasar la lista**.

**Son 156 líneas de código, no las ~50 que se estimaron al decidirlo.**
La decisión no cambia, y conviene decir por qué aguanta, porque el número era el argumento. Lo
que creció son tres cosas concretas, y ninguna es lógica interesante:

- **el clasificador de excepciones** —la mitad larga—, que es precisamente lo que no se puede
  probar con un doble: probarlo sería comprobar *lo que uno cree que lanza la API*, que es la
  crítica de esta sección palabra por palabra;
- **el `list` recursivo**, porque el puerto promete «los caminos que empiezan por ese prefijo» y
  no «los de este nivel». Hoy el esquema en disco es de un solo nivel, así que un `list` plano
  pasaría verde y sólo se notaría el día que el esquema cambie;
- **unas declaraciones de tipo**, que no se ejecutan.

Y un doble ahí sigue sin comprar lo que parece. Prueba **lo que uno cree que hace la API**, no lo
que hace: escribir un fichero con la File System Access API exige un `close()` final que es lo
que vuelca los datos al disco —`createWritable()` abre un temporal aparte, y `close()` es quien
lo vuelca—, y un `BlobStore` de mentira sobre un `Map` pasa en verde con ese `close()` olvidado.
**Cuanto más fina es la capa de traducción, menos vale probarla con un doble.** El razonamiento
completo y qué lo reabriría, en `TAREAS.md`.

De ese mismo mecanismo del temporal sale una consecuencia de diseño que conviene tener escrita:
**no hace falta un `abort()` de limpieza** cuando algo falla a mitad. Si revienta antes del
`close()`, el fichero original queda intacto y lo único que sobra es un temporal que recoge el
navegador. Ahorrárselo es ahorrar un segundo `try/catch` justo en el único fichero sin pruebas.

### 6.4 El write-behind no cabe entero en el core

Salió al planear la Fase 2, y no estaba previsto. §7 lo describe como «un suscriptor con
write-behind y debounce», en singular, como si fuera una pieza. **No puede serlo:** un debounce
necesita un temporizador, y dentro de la verja no hay ninguno.

No es una suposición, está comprobado. Una sonda de una línea en `src/core/app/`:

```ts
export const probe = (fn: () => void) => setTimeout(fn, 10)
```

da `error TS2304: Cannot find name 'setTimeout'` en `npm run typecheck:core`. El motivo es el
mismo que impide `document`: `setTimeout` no vive en `lib.es2020`, vive en `lib.dom.d.ts` y en
`@types/node`, y `src/core/tsconfig.json` va sin `DOM` y con `"types": []`. Conviene subrayar
la diferencia con el reloj: `Date.now()` **sí** compila en el core y hace falta un guardián
aparte para cazarlo; `setTimeout` lo para el compilador solo.

**Así que el write-behind son dos piezas, y se parten por donde se parte todo aquí:**

| | Qué decide | Puro | Dónde vive |
|---|---|---|---|
| **qué está sucio** | comparar `prev` y `next` entidad a entidad con `===` y devolver los ids que cambiaron | sí | `core/app/` |
| **cuándo se escribe** | el debounce, el temporizador, llamar al `StorageAdapter` | no | `src/storage/` |

La de arriba es la que tiene la lógica y es la única que puede equivocarse en silencio —es el
eslabón ② de §3—, y queda del lado puro, comprobable con dos estados y ningún temporizador. La
de abajo es fontanería… con una excepción: **qué hace cuando una escritura falla**, que ya no
es «reintentar y punto». Eso está en §6.5, en «El estado *detenido*».

**Y no se declara un puerto `Scheduler` para esto.** Sería la reacción automática —«si el core
no puede, inyéctalo»— pero no hace falta: partido así, **el core no necesita temporizar nada**.
Un puerto se declara cuando el dominio necesita algo del mundo, no para dar cobijo a código que
en realidad no es del dominio. Para que la parte de abajo se pueda probar sin esperas reales,
recibe la función de programación **por parámetro, con un valor por defecto**; eso no es un
puerto, es un argumento.

### 6.5 Los errores no se propagan: `Result<T, E>`

**Construido**, como paso 0 de la Fase 3 y **antes** del adaptador de fichero, por coste: ése es el
primero que falla de verdad —el de memoria no tiene permisos que revocar ni disco que llenar—, y
escribirlo contra las firmas viejas para convertirlo después habría sido escribirlo dos veces.

> **Toda operación que pueda fallar queda encapsulada y devuelve un resultado explícito en
> lugar de lanzar una excepción.**

Es el séptimo mecanismo de §1, y ataca lo único que los otros seis no pueden ver. Una excepción
**no aparece en ninguna firma**: `put(entity: Note): Promise<void>` es una función que, leída,
promete no fallar nunca. TypeScript no tiene `throws` en el tipo y no va a tenerlo, así que
quien llama no se entera de que hay un caso que tratar, y el compilador tampoco puede avisarle.
Un `Result` mete ese caso **dentro del tipo**, donde el resto de la arquitectura ya trabaja.

```ts
export type Result<T, E> =
  | { readonly ok: true;  readonly value: T }
  | { readonly ok: false; readonly error: E }
```

Unas veinte líneas con sus dos constructores, cero dependencias, y en el mismo estilo de unión
discriminada que ya usan `Content` y `Position` (§2.4): al comprobar `if (r.ok)` el compilador
estrecha, y **leer `r.value` sin comprobar antes no compila**. Esa es toda la fuerza del
mecanismo. No lleva `map`, `andThen` ni `unwrapOr`: aquí no se construye lo que no tiene
consumidor.

Un detalle de los constructores que tiene consecuencias: **`ok` devuelve `Result<T, never>` y
`err` devuelve `Result<never, E>`**, o sea que cada uno deja en `never` la mitad que no
construye y la pone quien recibe. Es lo que hace que `ok(null)` encaje sin más en un
`Result<Note | null, StorageError>`, sin tener que decirle a la llamada qué error no ha
ocurrido.

#### Dónde viven: un error es una entidad del dominio

`StorageError` y `MigrationError` están juntos en **`src/core/domain/errors/`**, una carpeta al
mismo nivel que el resto de entidades — no en `ports/`, ni en `migrations/`, ni en el módulo
que da la casualidad de producirlos. **Un error es parte de lo que la app sabe decir**, igual
que `Note` o `Context`, y quien lo consume —la UI, que decide si reintentar o avisar— no tiene
por qué ir a buscarlo a la carpeta de los puertos. Que los dos estén juntos no los confunde:
`MigrationError` no es un fallo de E/S, es «estos datos no se pueden leer con este código».

La carpeta **no lleva `index.ts`**, como tampoco lo lleva `domain/`: la API pública del módulo
es `src/core/index.ts` y no hay una segunda frontera dentro. Y **`Result.ts` se queda suelto en
`domain/`, fuera de `errors/`**, porque no es un error: es el sobre. Un `Result<Note, never>`
no lleva ninguno dentro.

#### Contar `throw` era la medida equivocada: el peligro es la llamada sin envolver

En el código de producción no queda ni un `throw` —había tres: dos en `runMigrations`, que hoy son
`err(…)`, y un relanzar en `writeBehind`, que hoy devuelve intacto el `Result` del adaptador—, y
aun así se escapaban dos excepciones: `encodeURIComponent` dentro de `caminoDe` y `paso.migrate()`
en el runner. Contar `throw` mide lo que lanzamos nosotros; **la pregunta buena es si alguna
llamada que lanza puede llegar a una firma pública**. Las dos están tapadas y las vigila
`npm run check:fronteras`, con dos límites que conviene tener presentes: **su lista de llamadas
peligrosas se mantiene a mano** —no hay forma de saber desde el código qué API lanza, así que quien
llame a una nueva que lance la añade ahí—; y entiende la **cobertura transitiva** —un ayudante al
que sólo se llama desde dentro de una frontera está a salvo; sin esa regla marcaría media docena de
ayudantes locales—, pero **esa cobertura es frágil**: basta una llamada nueva desde fuera para que
el ayudante deje de estar cubierto. Aplicado al código de antes de los arreglos, el guardián
señalaba exactamente las dos fugas y ninguna más.

**Que hubiera tan poco que convertir no fue suerte: el dominio no puede fallar por diseño.** La
regla «una operación que no aplica NO HACE NADA» (§9.3) eliminó el caso de error en vez de tiparlo,
y el reducer es **total** por contrato. Y tipar el `catch` no habría arreglado nada: con `strict`
va activo `useUnknownInCatchVariables`, así que `catch (fallo)` ya recibe `unknown`; al error no le
falta el tipo en la firma, es que **no existe en ninguna parte**. Hay que mover el fallo al valor de
retorno.

**El argumento que decidió:** con `Promise<void>` no había dónde decir por qué falló una escritura,
así que el write-behind reintentaba a ciegas —un permiso revocado, toda la sesión, en silencio—.
Qué hace ahora, en «El estado *detenido*», más abajo.

#### La taxonomía: el criterio es «¿reintentar sirve de algo?»

Aquí está la razón de que sean casos separados y no un error genérico. La pregunta que decide
**no es qué mensaje sale en pantalla**, sino qué puede hacer el programa a continuación:

| Caso | ¿Reintentar? | Qué hace la app |
|---|---|---|
| `permission-denied` — el permiso de la carpeta ya no vale | **no** | vuelve a pedir la carpeta. Lo no guardado sigue en memoria: no se pierde |
| `not-found` — la carpeta o el fichero han desaparecido | **no** | avisa de que la carpeta ya no existe y ofrece elegir otra |
| `quota-exceeded` — disco lleno o cuota excedida | **no** | deja de intentarlo y avisa de que hay que hacer hueco |
| `corrupt` — el contenido de un fichero no se entiende | **no** | **aísla esa entidad y sigue con el resto**, diciendo cuál |
| `stale` — lo guardado no es lo que se leyó: otra pestaña lo cambió *(2026-10-03)* | **no** | **no pisa**: el escritor se detiene y avisa con un botón Recargar |
| `io` — cualquier otra cosa | **sí** | reintenta en silencio; si persiste, avisa |

```ts
export type StorageError =
  | { readonly kind: "permission-denied" }
  | { readonly kind: "not-found";  readonly path: string }
  | { readonly kind: "quota-exceeded" }
  | { readonly kind: "corrupt";    readonly path: string; readonly cause: unknown }
  | { readonly kind: "stale";      readonly id: string }
  | { readonly kind: "io";         readonly cause: unknown }

export type MigrationError =
  | { readonly kind: "schema-from-future"; readonly stored: number; readonly supported: number }
  | { readonly kind: "missing-migration";  readonly from: number }
  | { readonly kind: "migration-failed";   readonly from: number; readonly cause: unknown }
```

**El tercero de `MigrationError` existe porque `migrate` es código ajeno.** Los dos primeros
describen cosas que el runner comprueba **antes** de tocar nada; `migration-failed`, lo único que no
controla: lo escribe quien migra y trabaja sobre datos con forma vieja. Sin él, una migración que
lanzara se escapaba de `runMigrations` —la función *pura y total*— **al arrancar la app sobre las
notas del usuario**.

**`corrupt` no va dentro de `io`, y es deliberado.** Si un solo fichero de nota está corrupto,
lo correcto es apartar esa nota y abrir todas las demás. Por el camino genérico la app
reintentaría leerla eternamente y **parecería que está todo roto cuando sólo falla una nota**:
la diferencia entre perder una nota y creer que las has perdido todas.

**`cause` existe para depurar, no para enseñar.** Guarda el `unknown` que vino de la
plataforma. Al usuario se le enseña el `kind`, que es lo que está en castellano y lo que tiene
una acción asociada.

**El precio de tener un caso «cualquier otra cosa», dicho sin esconderlo:** un bug de
programación dentro de una transacción —un `TypeError`, no un fallo de disco— acaba traducido a
`io`, y por tanto clasificado como **reintentable**. La app reintentará algo que va a fallar
igual. Se asume: no se añade un sexto caso, porque la taxonomía está cerrada y porque «esto es
un bug mío» no es una categoría que el programa pueda decidir mirando la excepción.

#### Clasificar una excepción de plataforma: el criterio, no la lista

**Construido**, en las dos implementaciones de `BlobStore` (§6.1). La lista completa vive en el
código, donde está cada caso razonado uno a uno; lo que importa aquí es el criterio, porque es lo
que hay que aplicar cuando llegue el tercer backend.

- **Un `kind` se elige por «¿reintentar sirve de algo?», y dos excepciones se agrupan cuando la
  respuesta es la misma**, no cuando se parecen. `NotAllowedError` (el permiso de la carpeta ya no
  vale) y `SecurityError` (el contexto no permite ni pedirlo) son cosas distintas y van las dos a
  `permission-denied` porque quien las recibe hace lo mismo con ellas.
- **Una excepción mal clasificada convierte «no cabe» en «reintenta»**, y ahí es donde se paga el
  estado *detenido* del write-behind. Por eso la cuota de `localStorage` se detecta por **tres
  nombres** —`QuotaExceededError`, `NS_ERROR_DOM_QUOTA_REACHED`, `QUOTA_EXCEEDED_ERR`, uno por
  navegador, de antes de que hubiera estándar— **y dos códigos** (22 y 1014), para los que dejan
  el `name` vacío. Comprobar las dos cosas cuesta una línea.
- **Lo que va a `io` se razona, no se deja caer.** `io` es el único `kind` que dice «insiste», así
  que el cajón se justifica caso por caso en el código. Hay uno que se acepta a sabiendas de que
  no encaja: `TypeMismatchError` —una carpeta donde se esperaba un fichero— no se arregla
  reintentando, pero no hay ningún `kind` que le quede mejor y la taxonomía está cerrada.

**Y una trampa de la File System Access API que hay que conocer antes de tocar ese fichero: lanza
el mismo `NotFoundError` para «falta el fichero» y para «falta la carpeta».** No hay forma de
distinguirlos, así que `read` y `delete` lo traducen a **ausencia** (`ok(null)` y `ok`) y `list` a
**lista vacía** — y esto último hace falta que sea así: en una carpeta recién elegida no existe
`notes/`, y el `getAll` del arranque tiene que devolver cero notas en vez de impedir abrir la app.

**Precio asumido, dicho en voz alta:** si desaparece la carpeta raíz entera —el usuario la borró,
el disco externo no está— la app lee «vacío» en vez de «no la encuentro». No se pierde nada en
disco, nadie borra, y el primer `write` sí dice `not-found`. Distinguirlo exigiría sondear la raíz
en cada lectura, en el fichero que no tiene pruebas, para un caso que habrá que tratar igualmente
con el botón de reconectar la carpeta, el día que la carpeta sea el destino.

#### `getAll` y un fichero ilegible: `onCorrupt`

La tabla de arriba dice que ante un `corrupt` la app **aísla esa entidad y sigue con el resto,
diciendo cuál**. Sin más, `getAll` cortaría al primer fichero ilegible —**una sola nota corrupta
impediría abrir la app**—, porque la firma del puerto es `Result<ReadonlyArray<T>, StorageError>`,
**todo o nada**. Las dos salidas obvias son peores:

- **saltarse la entidad corrupta en silencio** devolvería nueve notas como si fueran todas, y el
  write-behind vería la décima como **borrada** y acabaría limpiándola de los contextos,
  **convirtiendo un fichero recuperable en una pérdida de verdad**;
- **cambiar la firma de `getAll`** sería deshacer lo que el paso 0 estabilizó.

**El arreglo: una opción `onCorrupt` de `FileStorageAdapter`**, que no toca el puerto. Con ella:

- `getAll` **se salta sólo los `corrupt`** —JSON ilegible o forma que no valida (§6.2)— y llama a
  `onCorrupt` con el error, que lleva el `path` del fichero. **Cualquier otro fallo sigue
  cortando**: un `permission-denied` no es «esta nota está rota»;
- **sin `onCorrupt` sigue siendo todo o nada**, que es lo que mantiene la regla de *nunca en
  silencio*: no se puede saltar nada sin que alguien se entere;
- **si el aviso lanza, sale como `io`**: es código ajeno, y va dentro de su frontera (§6.5,
  principio 2);
- la UI enseña **qué fichero** no se ha podido leer.

✅ **El riesgo residual, cerrado el 2026-10-03 (opción A).** Era éste: `hydrate` quitaba de los
contextos las `ItemRef` a notas que no existen (§9.7), y **la nota saltada contaba como
inexistente**; si después ese contexto se guardaba, perdía la referencia para siempre, y arreglado
el fichero la nota volvía sólo al General. **La causa era confundir «ilegible» con «no existe»**,
y eso es lo que se arregló:

- `boot` ya no recibe un aviso ajeno: con **`skipCorrupt`** salta los ilegibles y los devuelve en
  **`App.corrupt`**, para que la UI diga cuáles. Así no hay código ajeno al que proteger;
- **`hydrate(stored, ilegible)`** recibe qué referencias apuntan a algo guardado pero ilegible, y
  **las conserva**; las que apuntan a algo que no existe se siguen quitando, y sin nada ilegible
  devuelve los contextos intactos, como antes;
- las reconoce **`pathOf(item)`**, del adaptador de fichero: el mismo camino que dice
  `onCorrupt`. Se compara camino con camino, sin descodificar, porque `decodeURIComponent` lanza;
- **la regla de integridad cambia de forma**: no hay referencias a algo que **no esté en el
  almacén**. Una a una nota ilegible puede estar en `items` sin estar en `notes`, y quien recorre
  `items` lo tolera —`notasDe` en `windowView.ts` ya lo hacía—.

Lo prueba de punta a punta `boot.test.ts`: nota rota, renombrar su contexto, guardar, arreglar el
fichero, y la nota vuelve **dentro** del contexto.

#### El estado *detenido* del write-behind

Es lo que compró todo lo anterior, y es una decisión nueva: **ante un fallo que no sea `io`, el
escritor se detiene.** Retiene ese error, cancela la espera que tuviera programada, y a partir
de ahí cada `flush()` devuelve **el mismo error, intacto y sin tocar el almacén**. Un aviso
nuevo del `Store` se recuerda —lo pendiente no se pierde— pero ya no programa escritura.

```
io                                                   → reintenta
permission-denied · not-found · quota-exceeded · corrupt  → SE DETIENE
```

**Detenerse no pierde nada, y ese es el punto.** El estado sin escribir sigue entero en
memoria y `escrito` no se actualiza, así que el día que se reanudara se escribiría todo. Lo
único que se deja de hacer es **insistir**, que era justo lo que no servía para nada.

**No hay forma de reanudar un escritor detenido, y es deliberado.** Reanudar significa «vuelve
a pedir la carpeta», y pedir una carpeta es plataforma, que llega con la carpeta del usuario como
destino —hoy fuera de alcance—. Consecuencia asumida y visible: un `permission-denied` deja el
write-behind muerto para el resto de la sesión. Se prefiere a la alternativa —reintentar en
bucle— porque así el error se ve en vez de desaparecer.

**Y desapareció el `catch` de la cola de escrituras**, que no es una limpieza cosmética: un
fallo es ahora un **valor**, así que ya no puede envenenar las escrituras futuras rechazando la
promesa que las encadena. Si algo llegara a rechazar ahí sería un adaptador incumpliendo su
puerto, y eso tiene que hacer ruido en vez de quedar perdonado.

**El aviso: `onError`.** El agujero era que cuando falla un flush
**automático** —el del temporizador— nadie mira su resultado, así que no se enteraba nadie. Hoy
`onError` es una opción de `WriteBehindDeps` y se llama **una sola vez**, cuando un fallo no
reintentable detiene al escritor; **un `io` se sigue reintentando sin avisar**: es justo el caso
en que insistir sirve de algo. El aviso es código ajeno y va dentro de su frontera: si lanza, el fallo
sigue saliendo por `flush()`, así que tragarse esa excepción no esconde nada.

En pantalla (`MountedApp.showSaveError`, en `src/ui/App.ts`) sale arriba, en cualquier vista:
«No se están guardando los cambios», el motivo, y que **lo que se ve se perderá al cerrar la
página**. **Sólo informa**: no hay botón de reintentar, porque con `localStorage` como destino no
hay nada que reanudar (aparcado en `TAREAS.md`). Y como el guardado puede detenerse antes de que
exista la UI, `main.ts` guarda el fallo y lo enseña al montarla.

#### Cuatro principios

1. **Ausencia no es fallo.** `get` de algo que no está guardado devuelve `ok(null)`, no un
   error; y borrar lo que no existe tampoco es error. Eso ya está bien resuelto hoy y **no se
   toca**: el `Result` envuelve sólo el fallo de entrada/salida. Colapsar «no está» y «no he
   podido mirar» en el mismo caso sería perder información que luego hace falta.
2. **El `try/catch` no desaparece: se confina.** JavaScript lanza por su cuenta —`JSON.parse`
   lanza, la File System Access API lanza, un `await` sobre una promesa rechazada lanza—, así
   que «encapsulado» no significa que no haya `catch` en ningún sitio. Significa que **cada
   adaptador tiene una frontera** donde envuelve la llamada de plataforma y la traduce a
   `Result`. Por debajo de esa línea hay `try/catch`; por encima de ella, nada lanza. Es la
   misma costura de §2.2: la cáscara imperativa habla con el mundo, el núcleo recibe valores.
3. **`runMigrations` pasa de pura a pura y total.** Son dos propiedades distintas y merece
   distinguirlas: la **pureza** se la impone la verja del core, la **totalidad** —no lanzar
   nunca— era hasta ahora un contrato que sólo prometía el reducer. Ya devuelve
   `Result<MigrationResult, MigrationError>`, así que las dos funciones que deciden qué estado
   tiene la app lo prometen igual.
4. **El coste, dicho sin esconderlo.** TypeScript no tiene *for-comprehension* ni operador de
   propagación de errores, así que el bucle de seis `await` de `escribirPendiente` pasó de un
   `try` que cubría los seis a **comprobar uno a uno**, con corte al primer fallo. Es más
   ruidoso de leer y no tiene arreglo elegante. Se acepta — y cortar en vez de seguir es
   deliberado: si el permiso está revocado, las otras cinco tandas fallarían igual, y lo que
   interesa devolver es el **primer** error, que es el que explica lo que pasó.

#### La escritura condicional: dos pestañas no se pisan

**El problema:** cada pestaña lee las notas al abrirse y trabaja con su copia. Si A guarda y luego
B guarda la misma nota, B pisaba lo de A sin que nadie se enterara. `revision` existía justo para
detectarlo (§5.3), pero nadie lo usaba.

**Lo construido (opción c, decidida con el usuario):**

- **`Repository.put(entidad, esperada)` y `delete(id, esperada)`.** `esperada` es la `revision`
  que se espera encontrar guardada, o `null` si se espera que no haya nada. Si lo guardado no
  coincide, sale **`stale`** con el id y **no se escribe**. Borrar algo que ya no está es `ok`
  se esperara lo que se esperara: si otro lo borró, queríais lo mismo. Lo exige el contrato, con
  cinco casos que corren contra los tres montajes.
- **El adaptador de fichero lee antes de escribir.** No es atómico —entre leer y escribir cabe
  otra escritura— y sobre ficheros sueltos no se puede cerrar ese hueco; es pequeño. **Precio:**
  cada guardado lee una vez más; en `localStorage` no se nota, con la carpeta habrá que medirlo.
- **El `writeBehind` pasa como `esperada` la revisión de lo que tiene por guardado** —que, por
  construcción, es lo que hay en el disco— y **apunta cada escritura hecha en el momento**, no al
  final de la tanda. Sin eso, una tanda cortada por un `io` a mitad, al reintentarse, volvería a
  escribir lo ya escrito esperando la revisión vieja, y daría un `stale` falso.
- **Ante `stale`, el escritor se detiene y avisa** como con cualquier fallo que no sea `io`, y el
  aviso lleva un botón **Recargar**: lo guardado es lo bueno, y recargar lo trae. Lo escrito en
  esa pestaña desde su último guardado **se pierde** —es el precio de «avisar y recargar», la
  opción más sencilla; la descartada, *guardar como copia en conflicto*, no perdía nada—.

**Descartadas:** **a**, una sola pestaña activa con Web Locks —muy poco código, pero no sirve
para la sincronización—; **b**, recargar al enterarse por el evento `storage` —una pestaña puede
pisar a la otra si escriben a la vez—; **d**, b + c, la más completa y la más trabajosa.
**Precio asumido de la c sola:** una pestaña no se entera de lo que cambia la otra hasta que
intenta guardar; mientras tanto enseña lo viejo, pero **nunca pisa**. Es la pieza que reutilizará
la sincronización entre dispositivos.

---

## 7. La UI

**Construido en `src/ui/`**: la UI web de la Fase 4 y la vista diagrama de la Fase 5, con su
lienzo y sus líneas (§9.11). Sus listas manuales, en `test/ui/`, las dio por pasadas el usuario el
2026-10-10; de la Fase 4 siguen sin contestar las tres preguntas del editor (§9.10). El diseño
de la navegación y las pantallas (§7.4) se cerró el **2026-09-27** a partir de un boceto en PDF del
usuario; el del editor (§7.2 y §7.3), el 2026-09-20, y **se reabrió y precisó al construirlo, el
2026-09-29**. Cómo está hecho por dentro, en §7.5.

Sin framework, vanilla. El core expone reducers puros y un `Store`; la UI se suscribe y
despacha. La inmutabilidad da la detección de cambios gratis por referencia (§3).

**Reconfirmada el 2026-09-20, frente a React, Svelte, Solid, Angular, Redux y htmx:** `Store.ts`
**ya es Redux** —`getState`/`dispatch`/`subscribe` sobre un reducer puro, más la invariante de
identidad que Redux no da—, y un DOM virtual es débil justo donde esta app es difícil,
`contenteditable`. Las dos alternativas que sobrevivieron, **Snabbdom** y un **motor de edición**
(ProseMirror/Lexical), están aparcadas con su disparador en `TAREAS.md` → *Ideas aparcadas*. **El
de Snabbdom son los fallos de sincronizar el DOM, no el tamaño** (cambiado con el usuario el
2026-10-03).

Dos reglas que evitan el dolor conocido de este enfoque:

1. **Reconciliación por clave**, no re-render ciego de listas. Cada bloque de contenido
   lleva su `id` en el DOM, y por eso `Text` y `CheckBox` tienen `id` en el modelo.
2. **El nodo que tiene el foco no se re-renderiza.** Con `contenteditable`, un re-render
   completo te borra el cursor a mitad de escribir. Mientras un nodo está enfocado **el DOM
   es la fuente de verdad**. *(Con una excepción que salió probando, en §7.5: durante una orden
   del propio editor sí se repinta.)*

La persistencia se engancha como **suscriptor con write-behind y debounce**, escribiendo solo
las entidades marcadas como sucias. **La UI sí despacha en cada tecla** (`setText`): quien
agrupa es el write-behind, no el editor, así que el disco no se entera de cada tecla.

El CSS vive en **`src/ui/styles/`**, un fichero por vista —`base`, `ventanas`, `ajustes`,
`hojas`, `barras`, `editor` y `diagrama`— que `index.html` enlaza **en el orden del `<style>` del
que salieron** (el último, el de la Fase 5). Ese orden es parte del diseño: con la misma
especificidad gana la regla de después, y hay choques reales —un botón de «Mover a…» casa con
`.barra button` y con `.selector button`—, así que agrupar las reglas por tema en vez de por tramo
habría cambiado la pantalla. Sin dependencias: **anidamiento nativo** donde no altera la especificidad —nunca bajo
una lista de selectores, que la subiría a la del más específico— y **`@layer base`** sólo para
las variables y los estilos de elemento. `button:disabled` se queda fuera de la capa a
propósito: dentro, perdería contra `.flecha` y los botones apagados enseñarían la mano.

**Al tocar el CSS se compara el estilo calculado antes y después**: una foto del de cada
elemento —y de sus `::before`/`::after`— en varias pantallas, comparadas propiedad a propiedad. Así
se verificó la partición en ficheros (idénticas), y la comparación se probó rompiendo a propósito
—`button:disabled` dentro de la capa—: cazó los tres botones apagados.

**Descartados:** Tailwind y similares (UnoCSS) —compilación, una dependencia, las variables
duplicadas y el estilo dentro del TypeScript—, Sass y CSS Modules —compilación, y el anidamiento
ya es nativo—, y los frameworks sin clases como Pico, que pelearían contra el diseño.

### 7.1 Tres clases de estado, no dos

Es la distinción que más fácil se pasa por alto, y la que decide dónde acaba viviendo cada
cosa:

| | Qué es | Cada cuánto se cambia | Dónde vive |
|---|---|---|---|
| **Contenido** | las líneas, las casillas, lo marcado | constantemente | dentro de la nota, persistido |
| **Modo de escritura** | cómo se comporta el teclado ahora mismo | **muchas veces mientras escribes una sola nota** | en el editor, en memoria, **sin persistir** |
| **Ajustes** | tema, dónde se guarda el fichero, tamaño de letra | una vez y te olvidas | pantalla de ajustes, aparte |

**Y una cuarta cosa que no es ninguna de las tres, y conviene no meterla en ninguna:** *qué
ventanas hay y en qué orden* (§7.4). No es contenido —no dice nada de ninguna nota, sólo cómo
se enseñan— ni modo de escritura, y tampoco es un ajuste en el sentido de la tabla, aunque se
edite en la vista configuración: es **organización de la vista**. Vive en `localStorage`, con
clave propia, **fuera del core y de `AppState`**. Junto a ella se guarda **qué ventana está
activa**, para volver a ella al recargar. Lo que es pura memoria es **qué vista hay encima**, más
el historial del navegador para que funcione el atrás: al recargar se ve la ventana, no la nota
ni la configuración que hubiera abierta.

La fila del medio es la que no existía en este diseño hasta que apareció `WritingMode`. Y
la trampa está en confundirla con la tercera: **un ajuste se busca en un menú y se cambia una
vez al año; el modo de escritura se pulsa veinte veces haciendo la lista de la compra.** Si se
trata como ajuste, acaba escondido en una pantalla de ajustes y es inservible. Se parece mucho
más al pincel de una aplicación de dibujo que al control de brillo.

### 7.2 `WritingMode`: el objeto auxiliar de la nota abierta

**Un interruptor y un disparador**, siempre a la vista mientras editas:

```
[☐ Casilla]   apagado —lo normal— las líneas nuevas son texto; encendido, casillas
[anidar]      ← se arma, actúa UNA vez y se desarma solo. Sólo con la casilla encendida
```

```ts
interface WritingMode { readonly checkbox: boolean; readonly nestArmed: boolean }
```

> **Reabierta y decidida con el usuario el 2026-09-29.** Hasta entonces esto eran **dos modos con
> nombre**, *Texto* ⇄ *Casilla*, con este argumento: «un interruptor con un apagado y un
> encendido obliga al usuario a preguntarse qué significa el apagado; dos herramientas con
> nombre, no». **Aquí no aplica**, y por eso se cambió: el apagado es **escribir texto normal**, lo
> que hace cualquier editor sin tocar nada, y no hay nada que preguntarse.
>
> **El comportamiento no cambió:** encender es lo que era «pasar a *Casilla*», y apagar lo que era
> «pasar a *Texto*», con el mismo efecto sobre la línea actual (§7.3). Y dos reglas que el diseño
> anterior no decía: **anidar sólo se arma con la casilla encendida** —con ella apagada no hay
> dónde anidar, porque un texto sólo cabe en la raíz— y **cambiar el interruptor desarma anidar**:
> lo armado era para el modo de antes.

#### «Anidar» no es un tercer modo, y por eso está fuera del ciclo

Un modo es un estado **en el que te quedas**; anidar ocurre una vez y se acaba. El diseño
anterior los mezclaba en un ciclo de tres —*Texto → Casilla → Casilla hija*— y de ahí salían dos
problemas que parecían independientes y no lo eran:

1. **El escalón infinito.** Si el modo persiste, cada Intro crea una hija de la línea anterior y
   bajas un nivel por pulsación. Sin `outdent` (§9.3) no hay forma de volver a subir.
2. **El segundo nivel costaba tres pulsaciones**, porque había que dar la vuelta entera al ciclo
   para regresar a *Casilla hija*. Y anidar con soltura es justo lo que distingue esta app de un
   bloc de notas: era lo más incómodo precisamente donde más cómodo tenía que ser.

Separándolo se caen los dos a la vez. El disparador **se consume solo** tras crear la hija, así
que lo que ves en la barra siempre es lo que va a pasar; y volver a anidar es pulsar un botón, no
tres. No se acumula: está armado o no lo está, y armarlo dos veces no baja dos niveles — que es
lo que mata el escalón infinito **por construcción** y no por una regla que haya que recordar.

#### Actúa sobre la línea SIGUIENTE, nunca sobre la actual

Es la parte que más fácil se implementa mal, porque el resto de la barra hace lo contrario: el
interruptor sí toca la línea donde estás (la convierte, o la parte). «Anidar» no.

El motivo no es de gusto: **bajar de nivel una línea que ya existe es `indent`**, y `indent` está
cerrado que no existe (§9.3) porque en el teclado de un móvil no hay Tabulador. Cambiar la
**clase** de una línea viva —texto a casilla— es lo que el diseño permite; cambiar su **nivel**
es lo que rechazó. Armar la siguiente respeta la regla de que *el nivel de una línea se elige al
nacer*, y por eso no hace falta ninguna operación nueva en el dominio.

Precio, el ya aceptado en §9.3: una línea escrita en el nivel equivocado **se borra y se
reescribe**.

⚠️ **El armado tiene que verse.** Es la contrapartida directa de lo anterior: si el efecto no
está en la línea que miras sino en la que aún no existe, un disparador invisible convierte la
próxima Intro en una sorpresa.

**Es un objeto auxiliar de la nota abierta, y es deliberadamente desechable:**

- **nace al abrir la nota y muere al salir de ella.** No hay un modo "de la aplicación": cada
  nota que abres empieza con la casilla apagada y anidar desarmado (`INITIAL_MODE`);
- **no se persiste, y perder sus datos no tiene consecuencias.** El usuario ve en qué modo
  está y lo cambia de un toque, así que no hay nada que recuperar;
- por tanto **no hace falta ningún sitio donde guardar preferencias**. La persistencia (§6)
  sigue siendo solo notas, sin un fichero de ajustes que no existía.

Que sea por nota y no global no es un detalle: **un modo global te arrastraría la casilla
encendida de la lista de la compra hasta la entrada del diario**, y te nacerían casillas en
mitad de un párrafo. Es la clase de fallo que no se ve al diseñarlo y molesta cada día al
usarlo.

**Dónde NO vive, y las tres importan:**

1. **No va dentro de la nota.** Sería el mismo ajuste repetido en cada una y contradiciéndose.
2. **No va en el motor.** Al núcleo le llega `insert` con la `Position` **ya elegida**; el
   modo es lo que el editor usa para elegirla. El núcleo no sabe que los modos existen, y así
   debe seguir.
3. **No va con las notas en el mismo saco.** Las notas llevan encima `Versioned` y detección
   de conflictos; una variable desechable no necesita nada de eso, y metiéndola ahí cambiar de
   modo marcaría notas como sucias y las reescribiría en disco (§3).

> **Nombre: `WritingMode`** (2026-09-20), en singular porque el editor guarda **un** modo activo.
> Va en inglés porque es público —sale por el `index.ts` de `ui/`—, no porque el repo entero lo
> esté: el patrón es **lo público en inglés** (`Note`, `AppState`, `guardWindows`) y **la
> maquinaria interna en castellano** (`cambio`, `caminoDe`, `frontera`). Sirve para decidir el
> siguiente nombre.

**Qué más cabe en esa barra, y qué no.** La regla: cabe si cambia el comportamiento mientras
escribes o mientras miras, **y la salida de la vista nota** (el botón exit). No cabe lo que es
contenido (el nombre de la nota) ni lo que es ajuste de la aplicación.

> **Ampliada el 2026-09-27 con el exit.** Se valoró ponerlo en la cabecera, y va abajo porque,
> a juicio del usuario, mejora bastante la UX. Sólo aparece en la **vista
> nota**; cuando la misma nota se edita como ventana, la barra va sin exit, porque de una ventana
> no se sale (§7.4).

Las otras tres candidatas que ya se veían —**"al marcar una casilla, marcar también sus hijas"**
(y aquí es exactamente donde se compone esa cascada que el dominio se niega a hacer, §9.3),
**"esconder las marcadas"**, **"mandar las marcadas al final"**— **quedan fuera**,
aparcadas en `TAREAS.md` con el mismo disparador que las tres preguntas de §9.10: si usando el
editor se echan en falta, se reabren.

### 7.3 El teclado: Intro construye, el Tabulador no

**Intro al final de una línea crea la siguiente**, y el interruptor decide de qué clase es:

| Estado de la barra | Estás en… | Al pulsar Intro nace… | `Position` |
|---|---|---|---|
| **casilla apagada** | un texto | otro texto, **justo debajo** | `after` (la línea actual) |
| **casilla apagada** | una casilla anidada | un texto **debajo de su casilla de la raíz** | `after` (esa casilla de la raíz) |
| **casilla encendida** | una casilla o un texto | una casilla **hermana**, justo debajo | `after` |
| **casilla encendida** + *anidar* **armado** | una casilla | una casilla **hija**, la última de la actual · y anidar se desarma | `last-child-of` |
| **casilla encendida** + *anidar* **armado** | un texto | una casilla **hermana** · y anidar **sigue armado** | `after` |
| nota vacía | — | la primera línea, de la clase que diga el interruptor | `root-end` |

> **Corregida con el usuario el 2026-09-29.** La primera fila decía `root-end`: con él, una línea
> de texto escrita **en medio** de la nota aparecía **al final**. Ahora nace debajo de la actual, y
> `root-end` se queda para la primera línea de una nota vacía. La segunda fila no estaba: un texto
> sólo cabe en la raíz, así que desde una casilla anidada el texto sale debajo de la casilla de la
> raíz que la contiene. Siguen siendo **los mismos tres casos de `Position`**, y el core no se tocó.

La fila de *anidar* es una **combinación**, no un tercer modo (§7.2). Conviene fijarse en lo que
*no* cambia: los tres casos de `Position` siguen usándose los tres, y el editor sigue llamando a
`insert` con la posición ya elegida. Lo que se rediseñó fue quién elige `last-child-of` — antes
un modo persistente, ahora un indicador que se consume—, y eso **no toca el núcleo**.

**Con el cursor en medio de una línea, Intro la parte** (`split`): la primera mitad se queda y
la segunda se va a la línea nueva, que nace de la clase que diga el interruptor.

> **Tres huecos de esta sección, cerrados con el usuario el 2026-09-29** (el cuarto, marcar con el
> teclado, va más abajo):
> - **Anidar armado sobre un texto** → Intro crea una casilla **hermana**, y anidar **sigue
>   armado** para la próxima: un texto no tiene dónde meter una hija, y desarmarlo sin haber
>   anidado sería gastar lo que el usuario pidió. Es la última fila de la tabla.
> - **Partir una casilla anidada con el interruptor apagado** → la mitad nueva sale como **texto a
>   la raíz, debajo de su casilla de la raíz** (y de todas sus hijas), igual que Intro al final de
>   una anidada. *Cambiado con el usuario el 2026-10-03:* antes seguía siendo casilla, porque un
>   texto anidado no existe, y eso contradecía el interruptor apagado. No es un `split`: el editor
>   recorta la línea con `setText` y crea el texto con `insertText` y `after`. Precio: si la
>   anidada tiene hermanas detrás, el texto aparece debajo de ellas.
> - **`split` no anida**: la mitad nueva nace al lado, nunca dentro, y **anidar sigue armado** para
>   la próxima línea que nazca con Intro al final.

**El Tabulador solo mete un carácter de tabulación** dentro de la línea. No mueve nada, no
anida nada, no convierte nada: es texto, como en cualquier editor.

#### Retroceso al principio: dos pulsaciones, dos cosas distintas

Aquí colisionan dos comportamientos que se quieren la misma tecla en la misma posición: quitar
la casilla, y unir con la línea de arriba. **Se resuelve en secuencia**, no eligiendo uno:

| Cursor | La línea es… | Retroceso hace… | Operación |
|---|---|---|---|
| al principio del todo | una **casilla de la raíz** | se va la casilla, la línea queda como texto | `convertToText` |
| al principio del todo | una **casilla anidada** | se une directamente: el texto sube a **la línea que se ve encima** —la última de la hermana de arriba, por honda que esté—, o a la madre si es la primera hija | `merge` |
| al principio del todo | un **texto** | se une con la línea que se ve encima | `merge` |
| en cualquier otro sitio | cualquiera | borra el carácter anterior | (ni toca el modelo) |

O sea: sobre una casilla **de la raíz** hacen falta **dos** pulsaciones para unirla con la de
arriba. La primera le quita el cuadradito, la segunda une. Sobre una casilla **anidada** basta
una, porque el primer paso no existe: una casilla anidada no puede volverse texto, ya que un
texto sólo cabe en la raíz.

El editor no necesita saber a qué profundidad está para elegir: le basta con **intentar quitar
el cuadradito y mirar si cambió algo**. Si el contenido volvió intacto —que es lo que hace un
no-op— pasa a unir. La invariante de identidad (§3) le sirve aquí de condición.

```
☐ Leche             ☐ Leche              ☐ Leche Pan
☐ |Pan       →      |Pan          →
                 (1ª: fuera la casilla)  (2ª: unir)
```

Es como se comporta Notion, y es coherente con el resto: **cada pulsación hace una sola cosa**,
y ninguna se lleva por delante algo que el usuario no esté mirando.

**Se une con lo que se ve encima, no con la hermana anterior.** *Cambiado con el usuario el
2026-10-03*, al usar el editor: un texto debajo de una casilla **con hijas** se unía a **esa
casilla** —la regla de `merge` de entonces, «sube a la hermana anterior»—, y no a su última hija,
que es la línea que se ve justo encima. Se sentía raro. Ahora `merge` sube a la línea anterior **en
orden de lectura** (§9.3), y el cursor la sigue.

#### El interruptor no solo elige: también actúa sobre la línea actual

⚠️ **Esto vale para el interruptor de casilla, no para el botón de anidar**, que hace justo lo
contrario (§7.2): actúa sobre la línea siguiente y deja intacta la actual. Los dos están pegados
en la barra y se comportan al revés, así que es el sitio donde más fácil se implementa uno con
la regla del otro. La asimetría tiene motivo: el interruptor cambia la **clase** de una línea,
que está permitido; anidar cambiaría su **nivel**, que es `indent` y está cerrado que no
existe.

El interruptor no es pasivo, no sólo afecta a las líneas futuras. **Al pulsarlo, la línea donde
estás cambia en el momento**, y lo que pasa depende de dónde tengas el cursor:

| Estás en… | Al encender la casilla pasa… |
|---|---|
| un texto, cursor **al principio** | la línea entera se convierte en casilla |
| un texto, cursor **en medio** | la línea **se parte** y la segunda mitad nace como casilla |
| una **casilla** | nada: ya es una casilla |

Y al **apagarla** estando en una casilla, la casilla pasa a texto si cabe (`convertToText`: no
cabe si está anidada o tiene hijas, y entonces no pasa nada).

El caso de en medio es el que pediste explícitamente:

```
Leche |y pan          Leche
              →       ☐ y pan
```

Y no necesita ninguna operación nueva: es **`split` y luego `convertToCheckBox`**, dos
llamadas que compone el editor. El motor sigue sin saber que los modos existen.

> **Confirmadas las cuatro el 2026-09-20.** Cuatro esquinas que el diseño de arriba dejaba sin
> cubrir. Dejan de ser propuestas: son comportamiento exigible, y entraron en el criterio de
> cierre de la Fase 4. *(Escritas cuando la barra tenía dos modos con nombre; con el
> interruptor del 2026-09-29 dicen lo mismo.)*
> - **Cursor al final de la línea** al encender la casilla → la línea se parte igual, y
>   nace debajo una casilla vacía. Es lo útil cuando acabas un párrafo y empiezas una lista.
> - **Apagar la casilla** estando en una casilla → la casilla se convierte en texto, por
>   simetría con lo que hace Retroceso.
> - **Unir dos textos normales** (`merge` sin ninguna casilla de por medio) → funciona, como en
>   cualquier editor. Se llegó a plantear restringirlo a cuando hay una casilla de por medio, y
>   no hace falta: `merge` ya se niega solo donde importa, que es cuando la línea tiene hijas.
> - **Partir una casilla que tiene hijas** → las hijas se quedan con la **primera** mitad, que
>   es la que conserva su identidad. Parece chocar con la regla de §9.3 —*lo que tiene hijas no
>   se toca*— y no choca: esa regla prohíbe lo que **hace desaparecer** una línea (`remove`,
>   `merge`, `convertToText`), y `split` no destruye nada. Por eso se permite.

#### Marcar, moverse y el Tabulador

- **Marcar o desmarcar una casilla con el teclado es Ctrl/Cmd+Intro** *(decidido con el usuario
  el 2026-09-29: era el cuarto hueco)*. Y el ☐ es un botón: con el foco del teclado encima,
  Espacio lo marca, como cualquier botón. Con el ratón o el dedo, tocándolo. En un texto no hace
  nada.
- **Las flechas arriba y abajo saltan de línea** al llegar al borde de la actual.
- **Dentro de una línea, el Tabulador mete un carácter** (arriba) y no mueve el foco; Mayús+Tab
  sí lo mueve, y es como se llega al ☐ de esa línea, que va delante.

**Y por eso no existen `indent` ni `outdent`** — el motivo está en §9.3. El nivel de una línea
se elige **al nacer**: con el interruptor, y con el disparador de anidar si está armado (§7.2).

### 7.4 La navegación: cuatro vistas y una lista de ventanas

Cerrado con el usuario el **2026-09-27** a partir de su boceto en PDF, precisado al construirlo el
**2026-09-29** y ampliado con la vista diagrama en la Fase 5 (decidido el 2026-10-03). Todo lo de
aquí es **web**, incluido el navegador del móvil —por eso importan la pulsación
larga y el atrás de Android—. Los shells nativos, cuando lleguen, envuelven esta misma UI: lo que
cambia entonces es plataforma (el atrás nativo, el destino de los datos, el keychain), no la UI.

#### Cuatro vistas, con la de ventanas en el centro

- **Vista ventanas** — la principal. Es **la única forma de ver contextos**, y una ventana
  también puede mostrar una nota o un diagrama.
- **Vista nota**, **vista diagrama** y **vista configuración** — las secundarias. A la vista
  diagrama se entra tocando un diagrama en la lista de un contexto o del General, y su cabecera es
  como la de la nota: exit y el nombre, que se renombra tocándolo.

```
            ◀   ventana 1 · ventana 2 · … · ventana n   ▶          ← vista ventanas
                                  │
         ┌────────────────────────┼─────────────────────────┐
   tocar una nota              "+ Nota"                      ⚙
         ▼                        ▼                          ▼
     vista nota          vista nota (recién creada)   vista configuración
         └───────── exit, o atrás: vuelve a la MISMA ventana ─────────┘
```

Las reglas, que son pocas y se sostienen entre sí:

- **Lo de encima se apila, y exit vuelve paso a paso.** De la vista ventanas se entra a una
  secundaria, y de una secundaria sólo a una más: de un diagrama, a una nota —tocando un nodo-nota
  o creando una nota desde el lienzo—. Ventana → diagrama → nota, y exit sale de la nota al
  diagrama y del diagrama a la ventana. **Si el diagrama es ventana**, diagrama → nota es un solo
  nivel, como ventana → nota. Era «un solo nivel» hasta la Fase 5 *(cambiado con el usuario el
  2026-10-03)*.
- **◀ y ▶ recorren las ventanas, y no es circular:** en la primera no hay ◀, en la última no hay
  ▶.
- **En la última, en el sitio de ▶, un «+» verde añade una ventana detrás** *(decidido con el
  usuario el 2026-10-03)*. Abre una **hoja desde abajo** con tres botones verdes, uno bajo otro
  —«+ Contexto nuevo», «+ Nota nueva» y «+ Diagrama nuevo»— y la lista de lo que **todavía no
  tiene ventana** —el General si no está, los contextos y, tras «Notas:», las notas—; lo repetido
  se sigue pudiendo hacer desde ⚙. Al elegir, **se va a la ventana nueva**, y lo recién creado
  llega con el **título ya en edición** para escribir su nombre. **La nota y el diagrama nuevos
  nacen sin contexto**, como los creados desde el General, aunque se esté en la ventana de un
  contexto: no dependen de dónde se pulse *(decidido con el usuario el 2026-10-12)*. Los crea
  `createAsWindow`, en `noteActions.ts`, pura y con pruebas. El selector de ⚙ sigue ofreciendo
  sólo «+ Contexto nuevo», también por decisión suya. La hoja es una
  capa del `backStack`: el atrás, Escape, tocar fuera o «Cancelar» la cierran, y no se apunta en
  el historial al cerrarse por elegir. Lo que ofrece lo decide `addWindowChoices`, pura y con
  pruebas. Durante el modo selección el «+» se apaga, como ◀ ▶ y ⚙.
- **De una secundaria sólo se sale con exit**, y se vuelve **siempre a la ventana desde la que se
  entró**: de una nota, a la del contexto de origen; de configuración, a la ventana —de contexto
  o de nota— desde la que se pulsó ⚙.
- **En la vista nota no hay ◀ ▶ ni ⚙.** El engranaje sólo existe en la vista ventanas, también
  cuando la ventana muestra una nota.

**Todo el estado de navegación son dos datos: qué ventana está activa y qué vistas hay apiladas
encima.** El efecto buscado, y el motivo de que no haya más caminos: **desde una nota no se llega a
configuración** —ni la vista diagrama ni una nota abierta desde él llevan ⚙—, así que no se puede
borrar el contexto de debajo mientras estás dentro de una nota suya. El caso raro no se trata: no
se puede producir.

**Al recargar, vuelves a la ventana en la que estabas; lo que hubiera encima, no.** *(Decidido el
2026-09-27.)* La ventana activa se guarda junto a la lista de ventanas, en `localStorage` y fuera
del core, y se guarda **como referencia a la ventana, no como índice**: un índice se desplaza en
cuanto se quita una ventana anterior y acabaría señalando a otra. Si esa referencia ya no está
entre las visibles —la guarda la ha quitado—, se abre **la primera**, o la pantalla vacía si no
queda ninguna. Esa regla es parte de la guarda pura (abajo), con sus pruebas. La vista nota o la
configuración que hubiera abierta **no se recuerda**: al recargar se ve la ventana.

**El atrás del navegador equivale a exit** en cualquier vista secundaria —incluido el gesto o
botón atrás del sistema en Chrome para Android, que es web—, y en la vista ventanas no hace nada
propio. Se implementa con el historial del navegador: **abrir una vista secundaria se apunta en
el historial; cambiar de ventana, no.** Si ◀ ▶ se apuntaran, el atrás recorrería ventanas y
dejaría de significar «salir».

**Descartado:**

- **El mismo icono ◀ con dos significados** —atrás en una secundaria, ventana anterior en la
  principal—. Por eso en la vista nota no hay flechas y la salida es un exit con su propio icono.
- **Que cada ventana recuerde la nota abierta.** Una ventana muestra **siempre su contenido
  base**. Recordarla añadiría un dato por ventana a un estado de navegación que hoy son dos.

#### Una ventana es una referencia, y la lista se guarda fuera del core

Una ventana es **una referencia en una lista ordenada** (`src/ui/windows.ts`):

```ts
type WindowRef =
  | { readonly kind: "general" }
  | { readonly kind: "context"; readonly id: ContextId }
  | { readonly kind: "note"; readonly id: NoteId }
  | { readonly kind: "diagram"; readonly id: DiagramId }

interface WindowsLayout {
  readonly windows: ReadonlyArray<WindowRef>
  readonly active: WindowRef | null                       // referencia, no índice
}
```

Se guarda como JSON en la clave **`elnotas:windows`** de `localStorage`
(`src/platform/web/LocalStorageWindows.ts`). Lo que se lee pasa por `parseWindowsLayout`: lo que
no tenga forma de ventana se descarta de una en una, y si el conjunto no tiene forma de lista se
empieza como la primera vez. **Un diagrama también puede ser ventana**: el selector lo ofrece tras
las notas, la ventana monta el mismo lienzo que la vista, y la guarda y `parseWindowsLayout` lo
conocen —sin ese caso, una ventana de diagrama se descartaba en silencio al recargar—.

**Dónde se guarda esa lista fue la decisión con más enjundia.** Se evaluaron cuatro opciones:

| | Opción | Veredicto |
|---|---|---|
| **A** | Un campo de orden en `Context` | **Descartada.** Mete un dato de vista en el dominio; reordenar reescribe varios contextos; el General no es entidad y no tendría dónde llevar su posición; y no permite una ventana de tipo nota sin disfrazarla |
| **B** | Una entidad nueva en el core (algo como `Layout`), en su fichero junto a las notas | **Aparcada.** Es la más limpia: una sola fuente, viaja con las notas y el reducer vigila la integridad. Pero reabre `StorageAdapter`, la suite de contratos, `FileStorageAdapter` y el catálogo de acciones, todo cerrado. El usuario prevé entidades «meta» de UX en el core más adelante, y ese es su sitio |
| **C** | **Fuera del core, en `localStorage`**, con clave propia gestionada desde la presentación | **ELEGIDA, para salir del paso** |
| **D** | No guardarla: ordenar por fecha o por nombre | **Descartada.** Contradice que exista una pantalla de configuración donde se ordenan |

El argumento del usuario para la C: **«las ventanas sólo sirven para organizar información que ya
vive en el storage»**. No añaden datos; son una forma de mirarlos.

⚠️ **Riesgo aceptado explícitamente, y conviene tenerlo a la vista:**

- **no viaja con las notas.** Si cambia el destino de guardado (hoy `LocalStorageBlobStore`) o el
  dispositivo, las notas llegan y las ventanas se pierden;
- **hay dos sitios donde se guardan cosas**, el `StorageAdapter` y esta clave;
- **la integridad no la vigila el core.** Por eso existe la guarda de abajo.

#### La guarda de integridad: las ventanas visibles se calculan

Una lista guardada fuera del core puede apuntar a algo que ya no existe, y el
reducer no se va a enterar. La guarda —una «guarda tontorrona», a propósito— es: **las ventanas
visibles son siempre la lista guardada menos las referencias que ya no existen**, y la lista
guardada se limpia de paso.

- **Siempre, no sólo al arrancar.** Si se borra un contexto, una nota o un diagrama que era
  ventana, la ventana desaparece **en la misma sesión**.
- **También resuelve la ventana activa:** si la guardada ya no es visible, la primera visible, o
  ninguna (pantalla vacía).
- **Es una función pura, con pruebas**, y se verifica **rompiéndola a propósito**, como todo lo que
  vigila una invariante en este repo. Hace aquí el trabajo que en la opción B haría el reducer.

Lo que no es la guarda, sino gestión de la lista:

- **Quitar una ventana sólo quita la referencia.** El contexto o la nota siguen en el almacén, y se
  pueden volver a añadir como ventana desde configuración.
- **La ventana del General también se puede quitar** —el General en sí no se borra: no es un
  contexto— y volver a añadir.
- **Sin ninguna ventana, pantalla vacía** con el ⚙ para añadir desde configuración. **No se impide
  quitar la última:** una pantalla vacía con salida no es un estado roto.

> **Tres precisiones, decididas con el usuario el 2026-09-29, al construirla:**
> - **Sin nada guardado —la primera vez— se ve una ventana: el General** (`DEFAULT_LAYOUT`). La
>   pantalla vacía queda para cuando se han quitado todas.
> - **Se permite el mismo contexto en dos ventanas.** Como la activa se guarda por referencia, con
>   duplicados **es la primera que coincide**. Consecuencia en la configuración: esa lista no
>   tiene un id estable por fila, y se reconcilia por posición (§7.5).
> - **Un fallo al guardar la lista de ventanas no avisa**: lo único que se pierde es el orden de
>   las ventanas, no una nota.

#### La lista de un contexto: selección, papelera y «Mover a…»

- **Las listas enseñan elementos, no notas**: notas y diagramas, como `ListItem { ref, name }`
  —una `ItemRef` y su nombre—. **El General los mezcla y ordena por nombre**, porque no tiene
  `items` propios; **un contexto, en el orden de sus `items`** *(decisión de implementación,
  aceptada por el usuario)*. Una referencia a lo que no está no se pinta. La selección va por una
  clave con el tipo (`itemKey`: `note:x`, `diagram:x`), porque una nota y un diagrama podrían
  compartir id, y **una fila de diagrama lleva una raya azul a la izquierda**.
- **La papelera en un contexto quita la nota DE ESE contexto** (`remove-item`), no la borra de
  todas partes: la nota sigue existiendo y se ve en el General. **En el General**, que no tiene de
  dónde quitarla, **borra de verdad** (`delete-note`), con confirmación. **Un diagrama sigue las
  mismas reglas** (`delete-diagram` en el General), y borrarlo no borra las notas a las que apuntan
  sus nodos. La pregunta de borrar cuenta «notas», «diagramas» o «elementos» si van mezclados.
- **«Mover a…»**, la otra acción de la barra de selección *(decidida el 2026-09-27)*. Semántica:
  **mover**, no copiar.
  - **Desde un contexto:** quita las notas seleccionadas de éste (`remove-item`) y las añade al
    elegido (`add-item`). Son dos acciones que encadena la UI (`moveItems`, en
    `src/ui/noteActions.ts`: primero añade y luego quita), así que *una acción, una operación* se
    respeta. Si una nota ya estaba en el destino, `add-item` es no-op y sólo cuenta el
    `remove-item`.
  - **Desde el General**, que no es un contexto: sólo añade al elegido (`add-item`), sin tocar los
    contextos donde ya estuviera. **Es la forma de devolver a un contexto una nota que se quitó.**
  - **El selector de destino** lista los contextos existentes, **ni el General ni el actual**.
  - **No confirma:** no destruye nada.
  - **Descartados** «Añadir a otro» —copiar la referencia— y ofrecer las dos acciones.
  - ⚠️ **No es la operación `move`** de §9.3, que reordenaría líneas dentro de una nota y sigue sin
    existir. Esto mueve **referencias entre contextos**, con acciones que ya existen.
- **Selección por pulsación larga** para el primer elemento; los siguientes, con toques normales
  (el patrón de Android). En modo selección un toque **selecciona y no abre** la nota. Se sale al
  quedarse sin nada seleccionado, con Escape o con atrás.
- **En web, sin dependencias:** Pointer Events y un temporizador (~500 ms, que se cancela si el
  dedo se mueve o se levanta), y en las filas se anulan con CSS y `contextmenu` el menú
  contextual, la selección de texto y el *callout* de iOS. En escritorio se entra también con clic
  derecho y con Ctrl/Cmd+clic, y hay tecla para el teclado (accesibilidad).
- **Durante la selección:** aparece la barra de acciones con la papelera y «Mover a…»,
  desaparecen los botones «+», y ◀ ▶ y ⚙ se apagan (color más apagado).
- **Descartada la casilla de selección manual** que el boceto ponía a la derecha de cada fila:
  allí era simbólica, y la pulsación larga ocupa su lugar.
- **«+ Diagrama»**, un botón azul algo más pequeño **debajo y a la izquierda del «+» verde, por
  encima de su esquina** (boceto del usuario, 2026-10-04). El diagrama **nace en ese contexto**,
  como una nota —`create-diagram` + `add-item`, en `createDiagramIn`—, y llega con el nombre,
  «Nuevo diagrama», **ya en edición**.

Las cifras de la pulsación larga, en §7.5.

#### La vista configuración

**Tres secciones:**

- **Ventanas** — **una fila de fichas que se desliza** `[General ⋮] [Compra ⋮] … (+)`
  *(rediseñada con el usuario el 2026-10-03; antes, una lista vertical que se desplegaba al
  tocar una fila)*:
  - **mantener pulsada una ficha medio segundo la levanta y se arrastra para reordenar**, con
    dedo y con ratón. Antes de levantarse, mover el dedo desliza la fila. Al soltar se llama a
    `moveWindow` —pura, en `windows.ts`— por `WindowsModel.move`; dónde cae lo decide
    `dropIndex`, también pura. Es reordenar **ventanas**, que viven fuera del core: no
    contradice que no exista `move` para las líneas de una nota (§9.3);
  - **⋮ abre una hoja desde abajo** con las tres acciones: **cambiar su contenido**, **añadir
    una ventana nueva detrás** y **quitarla**. Las dos primeras enseñan el selector dentro de la
    misma hoja;
  - **un toque corto en la ficha no hace nada**: la pulsación larga es sólo para arrastrar y el
    menú está en ⋮, para que los dos gestos no compitan en el móvil;
  - la **ficha «+» verde** del final añade una detrás de la última —también con la lista vacía,
    así que ya no hace falta el «+ Ventana»—;
  - **reordenar con teclado, pendiente**: el usuario lo dejó para más adelante.
- **Contextos** — todos los que existen, estén o no en alguna ventana, con **crear** y **borrar**.
  Crear un contexto aquí **no le añade ventana**.
- **Datos** *(pedida por el usuario el 2026-10-04)* — al final, una frase que dice lo que hace y
  el botón rojo **«🗑 Borrar todo»**, que deja la app como recién instalada. Abajo, *«Borrar
  todo»*.

**El selector de contenido** (al añadir detrás o al cambiar contenido) ofrece el General, los
contextos existentes, las notas existentes —tras un rótulo «Notas:»—, desde la Fase 5 los
diagramas —tras «Diagramas:»— y el atajo **«+ Contexto nuevo»**. Qué rótulo va delante de cada
opción lo decide `choiceGroupLabel`, pura y compartida con la hoja del «+» verde (antes, esa
lógica estaba duplicada en las dos vistas).

*Decisiones de implementación, tomadas al construirla y aceptadas por el usuario:*

- ~~con la lista de ventanas vacía hay un botón «+ Ventana»~~ — sustituido el 2026-10-03 por la
  ficha «+», que está siempre;
- **«+ Contexto nuevo» crea uno llamado «Nuevo contexto»**, que se renombra en su ventana;
- **la confirmación de borrar es una hoja propia** que sube desde abajo, con la pregunta, un
  botón rojo «🗑 Borrar» y «Cancelar» (`createConfirm`, en `sheet.ts`; la crea `mountApp` y la
  reparte). *Cambiado con el usuario el 2026-10-03:* antes era `window.confirm`, y en el
  navegador del panel de Claude —y en los que bloquean diálogos— contestaba «no» al instante sin
  enseñarse, así que **la papelera del General no borraba**;
- **lo que se deja a medias en la configuración no se recuerda al salir.**

**Borrar un contexto es `delete-context`, y no borra sus notas:** las que sólo estaban en él quedan
huérfanas y siguen en el General. Las ventanas que apuntaban a él desaparecen por la guarda.

**Confirmación sólo donde se borra sin vuelta atrás**, que son tres: borrar un contexto («¿Borrar
X? Sus notas seguirán en General»), la papelera del General y, desde el 2026-10-04, «Borrar
todo». Quitar una ventana, quitar una nota de un contexto y «Mover a…» **no confirman**: no
destruyen nada. Una ventana quitada se vuelve a añadir desde configuración; una nota quitada
sigue en el General, y desde ahí se recoloca con «Mover a…».

#### «Borrar todo»

**Pregunta con la misma hoja propia**, con el foco en «Cancelar», y **la pregunta cuenta lo que se
pierde**: «¿Borrar 2 notas, 1 diagrama y 1 contexto, y las ventanas? No se puede deshacer.»; sin
nada guardado, «¿Dejar la app en blanco? No hay nada guardado.». La cuenta la hace
`resetQuestion`, pura, en `settingsContent.ts`, y se calcula al pulsar: dice lo que hay ahora.

**Se borra en dos tiempos, y ése es el diseño.** El botón **no borra**: apunta una marca
(`elnotas:borrar-todo`, con `requestReset`) y recarga. Es al arrancar, en `main.ts` **antes de
leer nada**, cuando `resetIfRequested` quita todas las claves que empiezan por `elnotas:` —notas,
diagramas, contextos, manifiesto y ventanas— y **la marca, la última**: si algo falla a medias, la
marca sigue y el siguiente arranque lo reintenta. Un fallo ahí no tumba el arranque.

*Por qué no borrar y recargar sin más:* el guardado en diferido escribe lo pendiente en `pagehide`
y al pasar a segundo plano (§7.5), y eso ocurre **después** de pulsar, mientras la página se va.
Ese último guardado reescribiría parte de lo recién borrado. Borrando al arrancar, lo que se
escriba entre pedirlo y volver a abrir **también se va** —hay una prueba de eso—.

- **Sólo las claves `elnotas:`**: lo que otra cosa guarde en el mismo origen no se toca.
- **Tras borrar queda el manifiesto**: el arranque lo escribe en un almacén vacío (§7.5), así que
  «en blanco» es eso, no un `localStorage` sin ninguna clave.
- **Capas:** la UI no sabe dónde se guarda. `SettingsViewDeps` y `AppDeps` reciben `onResetAll:
  () => boolean`, que pone `main.ts` (apuntar y recargar). Si no se puede apuntar la marca,
  devuelve `false` y la configuración **enseña un aviso** en vez de recargar.
- **Es local**: borra el `localStorage` de **ese navegador**, que es el destino de hoy. Cuando
  cambie el destino —la carpeta, OPFS— hay que revisarlo (`TAREAS.md`).

*Cómo se prueba:* en `test/platform/web/resetStorage.test.ts`, con una prueba que falla en un
borrado **de en medio** —si falla en el primero, quitar la marca antes de tiempo no hace caer
nada—. A mano, en otro origen (`127.0.0.1`), para no tocar los datos del usuario en `localhost`.

#### Las notas

- **Una nota nace en el contexto de la ventana donde se crea**: `create-note` y `add-item`,
  compuestos por el caso de uso o la UI. Son **dos acciones**, así que la regla de *una acción,
  una operación* se respeta. Sólo se crean notas desde ventanas de contexto o del General, y
  **desde el General nace sin contexto** (`create-note` sin `add-item`): sólo se verá ahí.
- **Nombre por defecto: «Nueva Nota».** El nombre se escribe aparte del contenido.
- **Puede haber varias notas con el mismo nombre**, y no es un problema: lo que las distingue es
  su id, que siempre es distinto. El selector de ventanas **no enseña nada más** para
  diferenciarlas —ni el principio del contenido, ni la fecha, ni el id—. *(Decidido con el
  usuario el 2026-09-29, al ver varias «Nueva Nota» iguales en el selector.)*
- **El título aparece sólo en la cabecera** —no repetido dentro del contenido, como hacía el
  boceto— y **se renombra tocándolo**. Igual para los contextos, tocando el título de su ventana.
  La excepción es el General, que no se renombra.
- **Una nota vacía se mantiene.**

> **Por qué se mantiene** (2026-09-27, rectificando un «se descarta» de la misma sesión): «+ Nota»
> crea en el momento y exit sólo vuelve, sin decidir nada al salir; y descartarla **borraría de
> verdad una nota existente que es ventana con sólo vaciarla**. Precio aceptado: un «+» sin querer
> deja una «Nueva Nota» vacía, que se quita con selección y papelera.

**Una nota que es ventana se edita ahí mismo: es el MISMO editor en dos marcos.**

| | Cabecera | Barra de abajo |
|---|---|---|
| **Como ventana** | ◀ ▶, título y ⚙ | modo de escritura, **sin exit** |
| **En la vista nota** | sólo el título | modo de escritura **y exit** (§7.2) |

`WritingMode` sigue siendo de la nota abierta (§7.2): nace al abrir el editor y muere al salir de
él, en cualquiera de los dos marcos. **Construido así:** `WindowRef` ganó el caso `note`, la
ventana monta **el mismo `NoteEditor`** que la vista nota, y la guarda sabe de notas —borrar
desde el General una nota que es ventana la quita en la misma sesión—.

#### Lo que se queda sin uso: `Context.defaultView`

Existía para que un contexto «abriera directamente» una nota o un diagrama. Eso lo hace ahora una
**ventana de tipo nota o de tipo diagrama**, así que **ni `defaultView` ni `set-default-view`
tienen consumidor**. No se eliminan —el dominio está cerrado, y quitarlos tocaría modelo, reducer,
pruebas y formato en disco por algo que no molesta—; se anotan como candidatos a revisar cuando
lleguen las entidades «meta» de UX (`TAREAS.md` → *Ideas aparcadas*).

### 7.5 Cómo está construida

Lo de arriba es el diseño; esto es cómo quedó el código y lo que se decidió al escribirlo. Casi
todo son **decisiones de implementación, aceptadas por el usuario** en bloque, no cerradas una a
una como las de §7.2–§7.4.

#### El patrón: lo que decide es puro; el DOM, delgado

**Lo que decide qué se ve y qué pasa es una función pura, con pruebas en Node; el DOM de encima
es delgado y se verifica en el navegador**, con las listas manuales de `test/ui/`. Por eso
cada pantalla va en dos ficheros: `windowView.ts` decide qué enseña una ventana y `WindowsView.ts`
lo pinta; `settingsContent.ts` y `SettingsView.ts`; `noteActions.ts` + `selection.ts` y
`NoteList.ts`; `writingMode.ts` + `noteTree.ts` + `editor.ts` (el editor entero, sin DOM, probado
fila a fila contra las tablas de §7.3) y `NoteEditor.ts`; `viewport.ts` + `gestures.ts` +
`paintOrder.ts` + `relationGeometry.ts` (las cuentas del lienzo y de sus líneas) y
`DiagramCanvas.ts`.

**Lo que se monta en dos marcos va aparte de su vista.** `NoteEditor` es el editor y `NoteView` el
marco de la vista nota; una ventana de nota monta el mismo `NoteEditor` con otro marco (§7.4).
**`DiagramCanvas` y `DiagramView` siguen el mismo patrón**: el lienzo es uno, y lo montan la vista
diagrama —cabecera con el nombre renombrable y barra con ✕ Salir— y la ventana de diagrama.

**No hay pruebas automáticas del DOM, a propósito, y no se instaló nada para tenerlas.** Encaja
con lo decidido para los adaptadores de navegador (§6.3) —un doble prueba lo que uno cree que
hace el navegador—, y el tacto de un teclado de móvil no lo prueba `node --test`.

#### La composición, en `src/platform/web/`

- **`boot.ts` monta la pila, en este orden:** `FileStorageAdapter` sobre el `BlobStore` que le
  pasen → `getSchemaVersion` → `getAll` de las tres clases → `runMigrations` → `hydrate` →
  `createStore` + `createWriteBehind` suscrito + `createUseCases`. Si algo falla al leer, **no
  arranca a medias**: devuelve el error y no toca lo guardado. Y **en un almacén vacío apunta ya
  la versión del formato** (`setSchemaVersion(CURRENT)`): si no, un almacén con notas seguiría
  diciendo «0» —«nunca se ha escrito nada», §6.2— y la primera migración futura se lo saltaría.
  ⚠️ Queda escrito para ese día: con migraciones que cambien datos, `boot` tendría que **escribir
  lo migrado antes de subir la versión**. Hoy `MIGRATIONS` está vacía y no se llega.
- **`main.ts` decide las piezas de la web**: `systemClock`, `createCryptoIdGenerator(window.crypto)`,
  `LocalStorageBlobStore` y `LocalStorageWindows` sobre `window.localStorage` —que **lanza** si el
  navegador bloquea los datos del sitio, y por eso va en su `try`—. **Antes de `boot`** llama a
  `resetIfRequested` (`resetStorage.ts`), y pone el `onResetAll` de la UI: el «Borrar todo» en
  dos tiempos de §7.4. Hace `flush` en `pagehide` y al pasar a oculta (§2.2). Con **`?depurar`** en la dirección deja `window.elnotas = { store,
  useCases }` para la consola; sin él, no existe.
- **`CryptoIdGenerator` usa `getRandomValues`, no `randomUUID`**: éste sólo existe en **contexto
  seguro**, y el móvil abriendo la app por la IP de la red local (`http://192.168…`) no lo es.
  Monta a mano un UUID v4.

#### Las listas: reconciliación por clave

`reconcile.ts` reconcilia contra una **interfaz mínima de contenedor**, así que se prueba en Node
sin DOM. Cada lista elige su clave:

| Lista | Clave |
|---|---|
| notas de un contexto, contextos de la configuración | `data-id` |
| líneas del editor | `tipo:id` |
| **ventanas de la configuración** | **posición + contenido** |

La tercera no tiene id estable porque **se permiten duplicados** (§7.4). Darle uno exigiría un id
por ventana y **cambiar el formato guardado**, y se descartó. Precio: al quitar o añadir en medio,
las filas de detrás se recrean; por eso en cada paso **se lleva el foco a su sitio**.

#### El atrás: `backStack`

La configuración, la vista nota, el modo selección **y las hojas** comparten el historial del
navegador: al abrirlos se apunta una entrada, así que **el atrás —también el de Android— los
cierra, y el exit ES ir atrás**. **Es una pila** *(desde el 2026-10-03; antes, una capa como
mucho)*: la pregunta de borrar se abre encima del modo selección o de la configuración, y el atrás
cierra primero la de arriba. `close()` pide cerrar la de arriba; llamarlo otra vez antes del
`popstate` pide también la de debajo —es lo que pasa al borrar desde la selección: se cierran la
pregunta y la selección—, pero **nunca más capas de las que hay**, y los `back()` salen de uno en
uno: dos seguidos antes del `popstate` sacaban de la página (fallo cazado probando). Escape en
una hoja no llega al Escape del modo selección.

**Una carrera, arreglada al apilar vistas:** al elegir en una hoja algo que abre
otra capa —«Nota nueva» en el menú del lienzo—, el `popstate` pendiente del cierre de la hoja
llegaba después de apuntar la capa nueva, y la cerraba a ella. **Ahora una capa que se abre con
cierres pendientes espera a que lleguen** antes de su `pushState`.

**Lo de encima se apila** (`App.ts`). Antes había una sola capa encima de
la ventana, y una guarda —`if (back.isOpen()) return`— que existía justamente para impedir el
segundo nivel; se quitó, y ahora cada vista abierta encima es una capa más y sólo se ve la de
arriba. `abrirEncima` esconde lo de debajo **antes** de montar lo nuevo, porque lo nuevo puede
querer el foco —el nombre en edición— y en algo que se va a esconder no se quedaría.

#### La selección

Pulsación larga de **500 ms**, anulada si el dedo se mueve **más de 10 px**. **Cada pulsación
empieza limpia**: el primer toque tras una pulsación larga se perdía (cazado probando).

#### El editor en pantalla

- **Un campo `contenteditable` por línea**, con `plaintext-only` y respaldo para los navegadores
  que no lo entienden (ahí se pega sólo el texto a mano).
- **`setText` en cada tecla**: quien agrupa es el write-behind.
- **El campo con el foco no se repinta, SALVO durante una orden del editor**: partir la línea con
  foco la dejaba con el texto viejo (cazado probando). Es la regla 2 de §7 con su excepción.
- **Los botones de la barra no roban el foco y leen la selección en vivo**: usaban un cursor
  viejo (cazado probando).
- **Intro y Retroceso por `keydown`, con `beforeinput` de respaldo**, porque los teclados de
  Android no siempre mandan `keydown` pero todos dicen en `beforeinput` qué van a hacer.

#### El tercer eslabón, demostrado

§3 promete que un cambio que no cambia nada no llega a ningún sitio, y se demostró eslabón a
eslabón, cada uno en el criterio de cierre de su fase: en la 1, que un `set-checked` redundante
**no notifica** al suscriptor ni toca `updatedAt`; en la 2, que **no escribe**, con un
`StorageAdapter` que cuenta escrituras; y en la 4, que **no toca el DOM**, el único de los tres que
el usuario nota —un re-render con el cursor dentro le borra lo que está escribiendo—. **Medido en
el navegador con `?depurar`:** un `set-checked` redundante da **0 avisos del `Store`, 0 escrituras
y 0 cambios en el DOM**, frente a **1, 1 y 7** de un cambio de verdad.

---

## 8. La infraestructura

Esta sección **sí está construida**: desde la Fase 0, más lo que la Fase 4 añadió para el
navegador (§8.6).

### 8.1 Los cinco tsconfig

La razón de fondo cabe en una frase: **`lib` y `types` se aplican por invocación de `tsc`, no
por fichero.** En el momento en que se decidió que el core no viera el DOM pero la UI sí,
quedaron garantizadas al menos dos configuraciones. Las otras son economía, los tests y el
navegador.

Los límites entre módulos son **carpetas con su `tsconfig`, no un monorepo con workspaces de
npm**. Es decisión cerrada, pero su motivo original no quedó escrito; lo único registrado es
cuándo se reconsideraría: con los shells de escritorio y móvil (`TAREAS.md` → *Ideas aparcadas*).

| Fichero | Para qué |
|---|---|
| `tsconfig.base.json` | opciones comunes. **Sin `paths` ni `baseUrl`** |
| `tsconfig.json` | la app: `include: ["src"]`, con `DOM` |
| `src/core/tsconfig.json` | **la verja de pureza**: `lib: ["ES2020"]`, `types: []` |
| `tsconfig.test.json` | compila `src/` **y `test/`** a `tmp-test/` con tipos de Node |
| `tsconfig.web.json` | hereda de la app y emite ESM a `dist/web/`, para el navegador (§8.6) |

Dos detalles de la verja que no son evidentes:

- **Los tests quedan fuera por vivir en otra carpeta, no por una exclusión.** Ninguno de los
  dos ficheros de arriba lleva ya `"exclude": ["**/*.test.ts"]`: `test/` está fuera de `src/`,
  así que no entra por la forma del `include` (§8.5). La pureza aplica al código de producción;
  un test sí puede usar `node:test` y APIs de plataforma. Esto es justo lo que hace que no haga
  falta implementar `Clock` para testear: un test se fabrica el suyo en una línea.
- **Vive en `src/core/` y se llama `tsconfig.json`**, no `tsconfig.core.json` en la raíz. A
  propósito: el editor busca el `tsconfig.json` más cercano al fichero abierto, así que marca
  el error **mientras escribes**, no solo al lanzar el script.

**No añadir `baseUrl` ni `paths`.** `baseUrl` está deprecado en TS 6 y se retira en TS 7
(silenciarlo con `ignoreDeprecations` solo aplaza el problema), y `paths` es innecesario
porque el campo `imports` ya lo cubre.

**Que el andamiaje compile no demuestra nada:** la verja podría no estar detectando nada y
todo seguiría verde. Estas cuatro pruebas se hicieron metiendo código a propósito y viendo qué
pasaba:

| Prueba | Esperado | Resultado |
|---|---|---|
| `document.title` en el core → `typecheck:core` | falla | `TS2584` ✅ |
| **ese mismo código → `typecheck` de la app** | **pasa** | **sin errores** ✅ |
| `import from "#ui/..."` en el core | falla | `TS2307` ✅ |
| Un bundle importando `#core/index` | resuelve | compilado ✅ |

La segunda fila es la importante: confirma que la verja aplica **solo** al core y no está
estorbando en el resto del proyecto. Una verja que rompiera también la app se acabaría
desactivando.

Lo que la verja **no** cubre: que el core no importe de `storage/` o `ui/`. Mientras esos alias
no existían lo sostenía el *Cannot find module* de la tercera fila; **desde la Fase 4 están
declarados los cuatro**, y el caso real lo sigue pillando la verja por otro camino —la UI usa DOM,
así que arrastrarla al core rompe `typecheck:core`—, con un mensaje menos claro. Comprobado el
2026-09-29 con una sonda fuera de `src/` que importa `#ui/index` con la configuración de la
verja: **187 errores**, el primero `TS2304: Cannot find name 'HTMLElement'`.

### 8.2 Alias entre módulos: el campo `imports` de package.json

El problema: queremos escribir `import { Note } from "#core/index"` y que lo resuelvan
**tres** herramientas distintas — TypeScript al typechequear, Node al ejecutar los tests, y
el bundler al construir. La vía tradicional es declararlo tres veces (`paths` en tsconfig,
`resolve.alias` en webpack, un plugin para el runner) y rezar para que no se desincronicen.

Una sola declaración estándar lo cubre:

```json
"imports": {
  "#core/*": {
    "compiled": "./tmp-test/src/core/*.js",
    "default":  "./src/core/*.ts"
  }
}
```

(El `src/` que asoma en la primera ruta no es decorativo: la compilación de pruebas tiene por
`rootDir` la raíz del repo, así que la salida conserva los nombres de los dos árboles. El
porqué, en §8.5.)

Tres cosas que conviene entender:

- **El `#` es obligatorio.** Node solo reconoce como *subpath import* los especificadores que
  empiezan por almohadilla; es lo que lo distingue de un paquete de `node_modules`.
- **Las claves son condiciones.** Cada consumidor resuelve la primera que reconoce. TypeScript
  y el bundler no saben qué es `"compiled"`, así que caen en `"default"` y apuntan al `.ts`
  fuente. Node, con `--conditions=compiled`, coge la primera y apunta al JS ya compilado.
- **Por eso los tests funcionan.** Corren sobre el JS de `tmp-test/`, pero en el código
  escriben el mismo `#core/index` que escribe la UI.
- **El navegador es la excepción.** No lee `package.json`: los alias le llegan por el `importmap`
  de `index.html`, que los repite apuntando a `dist/web/`. Es la única segunda declaración que
  hay, y el precio de no tener bundler (§8.6). Hoy son cuatro: `#core/*`, `#storage/*`,
  `#platform/*` y `#ui/*`.

### 8.3 Tests: el runner nativo de Node

`node:test` + `node:assert/strict`, sin runner externo. Node 20 no ejecuta TypeScript, así que
`npm test` hace dos cosas: compila `src/` y `test/` a `tmp-test/` (CommonJS) y lanza
`node --conditions=compiled --test tmp-test/test`.

`tsconfig.test.json` usa `module: "nodenext"` en lugar del `ESNext` de la app, por un motivo
práctico: como `package.json` no declara `"type": "module"`, ese ajuste emite CommonJS, y
CommonJS resuelve imports relativos sin extensión. **Los imports relativos entre ficheros de
`test/` siguen sin `.js`**, por eso. **Los de `src/` sí lo llevan desde la Fase 4**, porque ese
código también lo carga el navegador como ESM (§8.6); en Node da igual, y ése es justo el
problema: sin el guardián, un import sin `.js` en `src/` pasa todas las pruebas.

Es más lento que un runner dedicado y no tiene watch mode; es el precio elegido a cambio de
cero dependencias. Se evaluó vitest y se descartó: ~64M en disco para algo que Node ya trae.

**Por qué existe `tools/require-tests.mjs`:** `node --test` sin ningún fichero imprime `1..0` y
sale con código 0, así que `npm test` pasaría en verde **sin ejecutar nada**. El guardián sale
con código 1 si no encuentra ningún `*.test.js` en `tmp-test/test/`. No se quita para «arreglar»
un fallo: el fallo es lo que avisa.

### 8.4 Dependencias: solo lo de la fase actual

No se instala una dependencia hasta la fase en que se usa de verdad, y se desinstala si deja
de usarse. Cero `dependencies` de runtime; `devDependencies` al mínimo.

Antes de añadir un paquete, comprobar si Node, TypeScript o el navegador ya lo hacen
nativamente. Tres casos reales de este proyecto, y son los que justifican la política: los
alias no necesitaron `paths` ni plugins (campo `imports`), los tests no necesitaron runner
(`node:test`), y **la Fase 3 entera se escribió con cero dependencias nuevas y ningún runner de
navegador** — en particular, **sin instalar un `@types` para la File System Access API**: la trae
`lib.dom.d.ts`, que la app ya carga.

La regla que deja, que es la general: **si falta un tipo de plataforma, mirar primero si falta de
verdad o si sólo falta un trozo.** Un trozo se declara a mano —una interfaz local, no exportada,
que se borre el día que sobre— y eso cuesta tres líneas; instalar tipos, o activar una `lib` más
en un `tsconfig` para salir del paso, cuesta bastante más y se queda para siempre. Lo que **no**
vale como excusa para ninguna de las dos es no haber comprobado la versión de TypeScript que hay
instalada: lo que faltaba en una puede venir de serie en la siguiente (`TAREAS.md` tiene un caso
vivo de esto, en `DirectoryHandleBlobStore.ts`).

Efecto medido al aplicarla: de ~350 paquetes y ~160M con 12 vulnerabilidades, a **tres paquetes
—`typescript`, `@types/node` y el `undici-types` que éste arrastra— y 0 vulnerabilidades**, que
siguen siendo los mismos tres el 2026-09-29. Toda la cadena de `webpack-dev-server` era la que
traía esas 12. Si cuentas carpetas de `node_modules` te saldrán más: son directorios vacíos que
dejaron las desinstalaciones. La cifra buena está en `package-lock.json`.

**Y el cuarto caso, el más grande: la Fase 4 entera —la UI, la composición y el arranque en el
navegador— se hizo sin instalar ni un paquete.** Ni bundler, ni framework, ni DOM falso para
probar, ni servidor de desarrollo (§8.6).

### 8.5 Dónde viven las pruebas: `test/`, espejo de `src/`

Hasta aquí cada prueba vivía al lado de su fichero (`operations.ts` y `operations.test.ts`,
hermanos). Ahora viven todas en `test/`, en un árbol que **calca** el de `src/`:

```
test/
├── core/
│   ├── domain/      # + errors/
│   ├── app/
│   └── migrations/
├── storage/
│   ├── contract-tests/
│   ├── memory/
│   ├── file/
│   └── blobs/       # incluye VERIFICACION-MANUAL.md
├── platform/web/    # desde la Fase 4
└── ui/              # desde la Fase 4, con sus listas VERIFICACION-*.md
```

**Lo que se gana no es estética, aunque la razón de partida fuera esa.** Es que la separación
entre código y pruebas deja de depender de un **sufijo en el nombre** y pasa a depender de la
**carpeta**, que es la unidad que ya entendían las herramientas. Antes había tres sitios que
repetían la misma lista negra —`"exclude": ["**/*.test.ts"]` en el tsconfig de la app, otro
igual en la verja del core, y un `.filter()` en `tools/check-core-purity.mjs`—; los tres han
desaparecido, y ninguno se puede olvidar en un fichero nuevo. El sufijo `.test` se queda con
un solo trabajo, que es el suyo: decirle a `node --test` qué ejecutar.

Corolario inmediato, y es lo que arrastró a los tres ayudantes: **un fichero que no contiene
pruebas ya no necesita llamarse `.test.ts`**. `FakeBlobStore.ts`, `FakeStorage.ts` y
`contract-tests/storageContract.ts` llevaban ese sufijo sólo para escapar del tsconfig de la
app; ahora los esconde la carpeta, y el nombre vuelve a decir la verdad — abrir
`storageContract.test.ts` buscando pruebas y encontrar una fábrica era una pequeña mentira
diaria. De paso, `node --test` deja de abrir tres ficheros para no encontrar nada en ellos.

Y arrastró también la lista de verificación manual (§6.3), que estaba pegada al adaptador que
verifica. Su sitio es `test/storage/blobs/`: **es una prueba de `DirectoryHandleBlobStore`**, y
lo único que la distingue de sus vecinas es que la ejecutan unas manos en vez de `node --test`.
Dejarla en `src/` habría sido dejar en la carpeta del código lo único que no es código.

**Los dos precios, que se pagan a sabiendas:**

- **Desde `test/` se importa por alias, y a veces profundo:** `#core/domain/updateContent`,
  `#storage/file/FileStorageAdapter`. Es la excepción a la regla de cruzar siempre contra el
  `index.ts`, y es inevitable: media Fase 1 son pruebas de maquinaria que `index.ts` **no
  exporta a propósito** (el helper de copia, `reduce`), y quien la prueba tiene que poder
  nombrarla. Entre ficheros de `test/` los imports siguen siendo relativos.
- **`tsconfig.test.json` tiene por `rootDir` la raíz del repo**, no `./src`, porque tiene que
  compilar dos árboles hermanos. La salida pasa a ser `tmp-test/src/…` y `tmp-test/test/…`, y
  de ahí el `src/` en la condición `compiled` de §8.2. Es el acoplamiento que conviene tener
  presente: **mover esto de sitio obliga a tocar `package.json`.**

Un efecto lateral que sí es una ganancia: `tools/require-tests.mjs` ahora mira `tmp-test/test/`
y no `tmp-test/` a secas, así que caza un fallo más de los que cazaba — que las pruebas se
compilen a un sitio distinto de donde las busca el runner. Verificado rompiéndolo, como todo lo
demás de esta sección.

### 8.6 El navegador sin bundler: `importmap` y `.js`

**Cómo se carga la app:** `npm run build:web` (`tools/clean-dist.mjs` y luego `tsc -p
tsconfig.web.json`) compila `src/` a `dist/web/` en **ESM**, sin empaquetar nada. `index.html`, en
la raíz del repo, declara un `<script type="importmap">` que **calca el campo `imports`** de
`package.json` —`#core/index`, `#storage/index`, `#platform/index` y `#ui/index`, cada uno a su
`./dist/web/…/index.js`— y carga `./dist/web/platform/web/main.js` como módulo. Se sirve con
cualquier servidor estático desde la raíz: `python3 -m http.server 8000` (y, para abrirla desde
el móvil, `--bind 0.0.0.0` y la IP del ordenador). `dist/` está en `.gitignore`. Publicada, la
sirve GitHub Pages desde la carpeta que arma `npm run build:pages` (§9.12).

**El `importmap` solo NO bastaba, y eso contradijo lo que decía este documento.** §9.10 cerró el
bundler el 2026-09-27 con el argumento de que el `importmap` estaba «ya probado en el repo», en el
andamio de la lista manual de la Fase 3. Lo estaba a medias: un `importmap` resuelve los
**alias** (`#core/index`), pero **no los imports relativos sin extensión** —`./domain/Note`—, y el
navegador no adivina extensiones: pide exactamente eso y recibe un 404. El andamio de la Fase 3 lo
había esquivado compilando con `--noResolve` sólo dos ficheros, así que nunca cargó el core
entero.

**Decidido con el usuario el 2026-09-29, opción A: todos los imports relativos de `src/` llevan
`.js`** —`./domain/Note.js`—. Se hizo en un solo commit (`1037ea1`, 115 líneas de import en `core/` y
`storage/`), que **sólo
toca líneas de import**. `DirectoryHandleBlobStore.ts` sólo importa por alias y no se tocó, así
que su verificación manual sigue valiendo.

**Descartadas:** un script que reescriba el JS emitido añadiendo `.js`, y un servidor propio que
lo añada al servir.

**Y un guardián, `npm run check:extensiones`** (`tools/check-extensiones.mjs`), porque sin él la
regla no la sostiene nada: las pruebas **compilan a CommonJS**, que sí adivina la extensión, así
que un import sin `.js` pasa `npm run check` entero y **sólo se nota al abrir la app**. Es la
misma clase de agujero que tapan los demás guardianes —algo que funciona mal en silencio—.
Recorre el AST de `src/` (los cuatro módulos), mira los `import`, los `export … from` y los
`import()` de tipos, y sólo los relativos: los alias los resuelve el `importmap`. `test/` no
entra, porque no lo carga ningún navegador (§8.3).

**Coste admitido:** los alias se declaran **dos veces**, en `package.json` y en el `importmap`. Un
alias nuevo que se olvide en `index.html` no lo caza nada automático; se nota al abrir la app.

**Las rutas de `index.html` son relativas desde la Fase 6** (`./dist/web/…`, `8f44d2d`), porque
GitHub Pages sirve la app en una subcarpeta, `/ElNotas/` (§9.12). Una ruta absoluta funcionaría en
casa y fallaría publicada; `npm run build:pages` se niega a armar la carpeta si encuentra una.

#### Los comentarios del código: cabeceras cortas y sin `§`

No es infraestructura, pero es una regla sobre los ficheros y no tiene otro sitio mejor. **La
cabecera de un fichero responde a «¿para qué sirve esto?» y para ahí**, de tres a ocho líneas
que entienda quien no programa. **El porqué no va en el código** porque una cabecera que
argumenta una decisión es una sección de este documento copiada, y las copias se separan del
original sin que nadie lo note. **Nada de `§` en el código**: apunta a un número que se renumera
solo y nada comprueba esos punteros; si hay que señalar un documento, se nombra el fichero. **Los
comentarios de dentro se quedan**, cortos y pegados a la línea, porque dicen lo que el código no
dice; al quitar una cabecera, lo que explicara y no esté aquí se trae aquí, no se borra.

---

## 9. El plan por fases, razonado

### 9.1 La frontera entre la Fase 1 y la Fase 2 es `Versioned`

> **Fase 1 = todo lo que opera por debajo de `Versioned`**: funciones cuya entrada y salida son
> *contenido* (`Text | CheckBox`), nunca una entidad.

Producir una entidad obliga a estampar `updatedAt` y `revision`, y eso pide puertos y alguien que
los inyecte; una operación de contenido no depende de nada: array de entrada, array de salida. Y
el reducer *completo* no cabía en la Fase 1, no por los puertos —son cuatro líneas de interfaz—
sino por su **superficie**: escribirlo exige haber decidido cada acción que existe, y eso es un
catálogo de producto, no un problema de árboles. Por eso la Fase 1 se llevó un reducer de un solo
caso, como prueba de la cadena de punta a punta, y el catálogo fue la Fase 2 (§9.7).

### 9.2 Las fases

- **Fase 0 — Andamiaje. ✅ HECHA.** Alias por campo `imports`, verja de pureza, tests con
  `node:test`, y limpieza de los restos del prototipo.

- **Fase 1 — Dominio puro. ✅ HECHA.** El helper con sus dos primitivas, `Position`, las ocho
  operaciones (§9.3), los puertos `Clock` e `IdGenerator` y la rebanada vertical, que verificó la
  cadena de identidad de punta a punta **antes** de escribir las otras siete operaciones: la
  alternativa —escribirlas todas y enchufarlas al final— habría descubierto un fallo de identidad
  cuando ya hubiera ocho sitios donde pudiera estar.

- **Fase 2 — Acciones, persistencia y memory. ✅ HECHA.** Los tres puertos (§6.1),
  `MemoryStorageAdapter` y su suite de contratos (§6.3), el write-behind en sus **dos** piezas
  (§6.4), **las diecisiete acciones** (§9.7) y la mitad pura del arranque. **Se atacó de abajo
  arriba:** primero la persistencia entera con la única acción que ya existía, y sólo después las
  demás. El write-behind era la única pieza con riesgo real, y se quería descubrir que escribe de
  más **con un solo candidato**, no con diecisiete. Valió la pena: la rotura que comprobaba ese
  corte no tumbaba ninguna prueba hasta que se añadió un contador de transacciones.

- **Fase 3 — Fichero local. ✅ HECHA.** Primero el **paso 0** —`Result<T, E>` y las taxonomías de
  error (§6.5)—; luego `FileStorageAdapter` con el formato de §6.2, que pasa la suite de contratos
  **sin tocarla**; y las dos implementaciones de `BlobStore` (§6.1), con la lista manual de la de
  carpeta pasada el 2026-09-13 (§6.3). Deja un detalle de UX con nombre: al recargar **no se puede
  recuperar el permiso de la carpeta en silencio** —el handle se guarda en IndexedDB, pero volver a
  pedir permiso exige un gesto del usuario, el botón de «reconectar carpeta»—, y mientras ese botón
  no exista un `permission-denied` **detiene el write-behind sin vuelta atrás** hasta recargar.

- **Fase 4 — UI. ✅ CERRADA el 2026-10-03, por decisión del usuario y con deuda.** Sólo web,
  incluido el navegador del móvil, y partida en dos (§9.10). Nacen `src/platform/web/` —con las
  primeras implementaciones reales de `Clock` e `IdGenerator` y el arranque de verdad— y `src/ui/`:
  la navegación por ventanas (§7.4), el editor con casillas anidadas (§7.2 y §7.3), `onCorrupt`,
  `onError` y la validación de esquema (§6.2, §6.5). Sale el prototipo viejo. Ninguna dependencia
  nueva. Sus dos listas manuales se dieron por pasadas el 2026-10-10; **siguen sin contestar las
  tres preguntas del editor** (§9.10).

- **Fase 5 — Diagramas. ✅ CERRADA el 2026-10-08**, y su deuda —las listas de Lienzo y
  Relaciones— saldada el 2026-10-10, cuando el usuario las dio por pasadas tras probar la app
  instalada. Un lienzo libre con nodos y relaciones, y la vista diagrama, en tres partes: Modelo,
  Lienzo y Relaciones (§9.11).

- **Fase 6 — PWA. ✅ CERRADA el 2026-10-10**, publicada en
  `https://ildartashtekov.github.io/ElNotas/`. Que ElNotas se instale en el móvil como una app
  —icono, pantalla completa, sin conexión, actualizándose sola— sin depender del ordenador de casa:
  manifiesto, iconos, un *service worker* en `pwa/sw.js`, un script que arma la carpeta publicada y
  GitHub Pages, publicada por GitHub Actions al subir a `main`. **Sin dependencias nuevas y sin
  tocar el core** (§9.12). Con ella el usuario dio por pasadas las listas pendientes de las Fases 4
  y 5.

- **Fase 7 — Refactor. ✅ CERRADA el 2026-10-12**, planificada el 2026-10-11, en la rama
  `fase-7-refactor`, y probada en el móvil por el usuario. Dos
  cosas: arreglar lo que molesta al usar la app en el móvil, y revisar lo que se construyó por
  adelantado o puede no aguantar el volumen **con números y no a ojo** —si al medir algo no duele,
  se cierra sin tocar código—. Hecho en el código: la barra de la nota sube con el teclado
  (`interactive-widget=resizes-content` en el `viewport`, porque Chrome en Android no encogía la
  página; la barra va con `sticky` y ocupa su sitio, para no tapar la última línea), las barras del
  móvil con el color del sistema (§9.12), los puntos del lienzo a media intensidad (`--rejilla`) y
  los pósits de `10rem` a `8rem` (`7rem` los alargaba demasiado hacia abajo). Medido: **el
  arranque no duele** —el techo de `localStorage`, unas 4.000 notas, llega antes—, y **arrastrar un
  nodo sí dolía**: se redibujaban todas las líneas, alternando medir y escribir; ahora sólo las del
  nodo (`relationsOf`), midiendo todo antes de escribir. Las tablas, en `TAREAS.md`. Y a petición
  del usuario, una nota o un diagrama nuevos, sin contexto, desde el «+» de la última ventana.
  Con la barra bastó `interactive-widget`, sin `visualViewport`. **Negrita, cursiva, tachado, subrayado y el texto más grande NO
  entran**, por decisión del usuario: van juntos, sin fase.

### 9.3 Las operaciones de contenido

La lista ha cambiado dos veces y conviene ver el vaivén, porque explica por qué el documento
decía otra cosa hasta hace nada:

1. eran **siete** (`setChecked`, `setText`, `insert`, `remove`, `move`, `indent`, `outdent`);
2. subieron a **nueve** con `split` y `merge`, sin las cuales no se puede escribir con el
   teclado, y a **once** al aparecer las conversiones entre texto y casilla que necesita
   `WritingMode` (§7.2);
3. y bajaron al quitarse `indent` y `outdent`, que ya no tienen quien las use.

#### Por qué no existen `indent` ni `outdent`

Cierra de golpe las decisiones **(a)** y **(g)**, que preguntaban por el comportamiento de dos
operaciones que han dejado de existir. **El motivo es el móvil:** en el teclado de un teléfono
**no hay tecla Tabulador**, así que un diseño que dependa de ella es un diseño solo para
ordenador, y esta app es multiplataforma desde el principio.

En su lugar, **el nivel de una línea se elige al nacer**, con el interruptor de casilla y el
disparador de anidar de `WritingMode` (§7.2, §7.3). El Tabulador queda para meter un carácter de tabulación y nada más.

**El precio, aceptado a conciencia:** una línea creada en el nivel equivocado **no se puede
re-anidar**. Hay que borrarla y volver a escribirla. Y conviene tener presente el filo de esa
decisión: borrar y reescribir **en un móvil duele más que en un ordenador**, no menos, así que
el argumento que quita `indent` no es gratis del todo. Se asume.

#### Por qué tampoco existe `move`

Sin `indent` ni `outdent`, a `move` solo le quedaba un trabajo: **reordenar** hermanas
arrastrando una línea arriba o abajo. Tampoco se construye, y con eso **se cierran de golpe las
decisiones (f) y (c)** — la (c) preguntaba qué hacer si el destino de un `move` cae dentro de
su propio subárbol, y sin `move` no hay destino que comprobar.

El motivo es el mismo que este proyecto aplica a las dependencias: **no se construye nada hasta
que existe quien lo use.** `insert`, `split` y `merge` tienen consumidor con nombre —Intro,
Retroceso, el interruptor de casilla (§7.3)—. `move` no tendrá ninguno mientras no exista un gesto de
arrastrar, y eso es una decisión de la Fase 4, con el editor delante y sabiendo si de verdad se
echa de menos.

Además tiene un precio que no se ve de primeras: **`move` obligaría a reabrir la decisión (d)**.
Con las tres posiciones de §9.4 se puede decir "detrás de esta" pero **no "la primera del
todo"**, y mover algo al principio de una lista es justo lo que se quiere al reordenar. Haría
falta un cuarto caso, `before`, y añadirlo obliga a volver a pasar también la batería de
`insert`, que comparte el tipo.

**El precio de no tenerlo, escrito para que nadie lo descubra usándolo:** una lista se queda
para siempre en el orden en que se escribió. Ni reordenar ni re-anidar. Cualquier error de
estructura se arregla borrando y volviendo a escribir.

**Y no cierra ninguna puerta.** `move` es puramente añadido: no cambia ninguna operación
existente, no cambia el formato en disco, no obliga a migrar nada. Cuesta lo mismo dentro de
seis meses que hoy, más el cuarto caso de `Position`. Queda anotado en `TAREAS.md` →
*Ideas aparcadas* con lo que lo desbloquearía.

#### El coste no está repartido por igual

| Operación | Coste | Por qué |
|---|---|---|
| `setText`, `setChecked` | trivial | encima del helper; no cambian la estructura |
| `insert`, `remove` | medio | cambian un array, en un solo nivel |
| `convertToCheckBox`, `convertToText` | medio | las que pide el interruptor de casilla (§7.2), y `convertToText` también el Retroceso al principio de una casilla (§7.3) |
| `split`, `merge` | medio | **confirmadas.** Intro en medio de una línea y Retroceso al principio. `split` es además la mitad del interruptor de casilla cuando el cursor está en medio |
| ~~`indent`, `outdent`~~ | — | **eliminadas**, ver arriba |
| ~~`move`~~ | — | **eliminada**, ver abajo |

**Son ocho, y ninguna pasa de dificultad media.** Eso cierra la decisión (f), y con ella la
Fase 1 no tiene ni una pregunta abierta.

#### Qué línea conserva su identidad, operación por operación

Tres operaciones producen o destruyen líneas, y en las tres hay que decir **cuál de las líneas
implicadas es la de antes** y cuál es nueva. No es un detalle de implementación: de esto
depende si la operación necesita un `ContentId` inyectado, y depende también que el editor no
te borre el cursor a media palabra —reconcilia por `data-id` (§7), así que una línea que cambia
de id se destruye y se vuelve a crear en el DOM—.

La regla, una para las tres: **sobrevive con su identidad la línea que ya estaba ahí.**

| Operación | Qué conserva su id | Qué es nuevo |
|---|---|---|
| `convertToCheckBox` / `convertToText` | **la propia línea: mismo `ContentId`**. Es la misma línea con otra pinta | nada — **por eso no necesitan `IdGenerator`** |
| `split` | la **primera** mitad: mismo id, y se queda con las hijas y con su `checked` | la **segunda** mitad, con id nuevo por parámetro y **`checked: false`**: es una tarea que nadie ha hecho todavía |
| `merge` | la línea **de arriba**, la que absorbe: conserva id, clase, `checked` e hijas; su texto pasa a ser `arriba.text + abajo.text` | nada — la de abajo desaparece |

Dos consecuencias de la fila de `merge` que van en la especificación porque si no, no se
testean:

- **Los textos se pegan sin añadir espacio.** `partir` y `unir` la misma línea tienen que
  devolver **exactamente** lo que había antes. Un espacio de cortesía al unir haría que partir
  y unir repetidamente fuera ensuciando el texto. Es una propiedad comprobable: partir por
  cualquier punto y volver a unir devuelve el original.
- **Quién recibe el texto depende de dónde estuviera la línea que desaparece:**

  | La línea que se absorbe… | El texto sube a… |
  |---|---|
  | tiene una hermana encima | **la última línea de esa hermana**, por honda que esté —ella misma si no tiene hijas— |
  | es la **primera hija** de una casilla | su **madre**, y las demás hijas se quedan donde estaban |
  | es la primera línea de la nota | nadie: **no hace nada** |

  Dicho de una vez: **sube a la línea anterior en orden de lectura**, la que se ve encima.
  *Cambiado con el usuario el 2026-10-03*: antes la primera fila decía «esa **hermana
  anterior**», y un texto bajo una casilla con hijas se unía a la casilla y no a la hija que se
  ve encima. **Es la única vez que la Fase 4 tocó el core**, y por petición expresa. Se
  implementa como `remove` de la línea más `setText` de la receptora, dos operaciones que ya
  conservan la identidad; las demás reglas (no-op si es la primera, si tiene hijas, si no
  existe) no cambian.

  El caso de la primera hija hace que `merge` no sea sólo "combinar dos elementos de una
  lista": ahí la madre cambia de texto **y** pierde una hija, las dos cosas a la vez.

- **En la raíz, la línea de abajo siempre es un `Text` cuando llega la unión**, porque la
  primera pulsación de Retroceso ya le ha quitado el cuadradito (§7.3). **En profundidad no**:
  una casilla anidada no puede convertirse en texto —no cabría—, así que ahí Retroceso une
  directamente y `merge` sí recibe una casilla. La línea que recibe conserva su clase en los
  dos casos.

Y de la fila de `split`: **la mitad nueva nace sin marcar**, aunque la original estuviera
marcada. Los dos errores posibles no cuestan lo mismo — una tarea que aparece pendiente y ya
estaba hecha la ves y la marcas; una tarea que aparece **hecha sin haberla hecho** desaparece
de tu radar y no te enteras.

#### `split` es la primera —y única— operación que necesita un id nuevo

Al partir una línea nacen dos, y la segunda necesita su propio `ContentId`. Pero **el dominio
no genera IDs** —eso viene del puerto `IdGenerator`, que vive fuera del core (§4)—, así que
`split` lo recibe **ya hecho por parámetro**, exactamente igual que hacen hoy los constructores
de `Content.ts`. Y es **la única** de las ocho que lo necesita: las conversiones reutilizan el
id de la línea, y `merge` no crea nada. Conviene no descubrirlo a mitad de implementarla.

**Los casos no-op son la mitad de la especificación.** Si "una operación que no aplica no hace
nada", enumerar *cuándo* no aplica es la mitad del trabajo de especificarla. Cada fila
necesita su test explícito:

| Operación | No hace nada cuando… |
|---|---|
| `setText` | el id no existe · el texto ya es ese |
| `setChecked` | el id no existe · el id es un `Text` (no tiene `checked`) · ya está en ese valor |
| `insert` | el destino no existe · el destino es un `Text` y se pide meter dentro · **se pide meter un texto suelto en una lista de hijas** — no cabe, y con la primitiva B partida en dos ni siquiera compila · **ya existe una línea con ese id** (ver abajo) |
| `remove` | el id no existe · **es una casilla con hijas** (decisión (b), cerrada: se borra de abajo arriba) |
| `split` | el id no existe · el punto de corte cae fuera de la línea. **Partir por el extremo NO es no-op:** deja una mitad vacía, que es justo lo que quieres al empezar una lista |
| `merge` | el id no existe · es la primera línea **de la nota** (no hay nada encima, ni hermana ni madre) · **la línea que se absorbe tiene hijas** — se quedarían colgando de nada, así que misma regla que `remove` |
| `convertToCheckBox` | el id no existe · ya es una casilla |
| `convertToText` | el id no existe · ya es un texto · **es una casilla con hijas** (un texto no puede tener nada colgando: se convierte de abajo arriba, igual que se borra) · **es una casilla anidada** — un texto sólo puede vivir en la raíz, y sin `outdent` no hay forma de hacerle sitio |

**El id repetido en `insert` no estaba en esta tabla**, y se añadió al implementarla. Merece
su párrafo porque el fallo que evita es de los que no se ven: dos líneas con el mismo id no
rompen nada de inmediato, pero a partir de ahí **toda operación sobre ese id actúa siempre
sobre la primera coincidencia y jamás sobre la segunda**. Marcas una casilla y se marca otra.
Detectarlo cuesta un recorrido del árbol; convivir con ello, mucho más.

**Ocho filas, y las ocho necesitan su test explícito.** Fíjate en que la mitad de ellas dicen
lo mismo con otras palabras —*es una casilla con hijas*—: es la regla de (b) propagándose sola
a todo lo que hace desaparecer una línea.

**Decisión ya cerrada:** marcar una casilla **NO** arrastra a sus hijas. La primitiva es
deliberadamente mínima; la cascada es decisión de producto y se compone en la UI llamando a
`setChecked` sobre los descendientes.

#### `remove` no borra una casilla con hijas

Era la decisión (b), y está cerrada: **`remove` sobre una casilla con hijas es un no-op.** Se
borra de abajo arriba o no se borra. Sólo salen del árbol las hojas —y los `Text`, que no
pueden tener hijas—.

Es la misma forma que la decisión de arriba, y por el mismo motivo: **la primitiva es mínima y
la cascada se compone**. Ninguna operación del dominio hace desaparecer contenido que el
usuario no esté mirando. Un borrado accidental de una rama de cuarenta casillas no es un
`undo` más: es la clase de pérdida que hace que dejes de fiarte de la app.

Y de paso resuelve el bloqueo que tenía la primitiva B (§5.4): si `remove` sólo saca hojas,
**nunca tiene que decidir qué hacer con un subárbol ni reparentar nada**. Se queda en "quita
este id del array donde vive", que es la versión más simple posible.

Se descartaron las dos alternativas: llevarse el subárbol entero (rápido, pero es justo la
pérdida silenciosa que se quiere evitar) y promocionar las hijas al nivel de la madre
(conserva el contenido, pero reordena el documento por debajo del cursor sin que nadie lo
haya pedido).

**Dos consecuencias que hay que tener presentes al implementar, o esto se rompe solo:**

1. **La regla se propaga a `merge`, y ahí es fácil olvidarla.** Absorber una línea la hace
   desaparecer igual que borrarla, así que `merge` sobre una línea con hijas tampoco hace nada.
   Está en su fila de la tabla de arriba. *(Y si algún día llega `move`, ojo: mover **no**
   pierde nada, así que la guarda es de `remove`, no de la extracción — un `move` escrito como
   `remove` + `insert` heredaría la guarda y dejaría de mover casillas con hijas, en silencio.)*
2. **En la Fase 4 hace falta una forma explícita de borrar una rama**, o "seleccionar y pulsar
   Supr" no hará nada y se leerá como un fallo. Se compone recorriendo el subárbol **de las
   hojas hacia arriba** y aplicando `remove` en ese orden. Ojo: se pliegan las N llamadas en
   **una sola acción** desde el caso de uso; si se despachan una a una, cada nodo borrado
   estampa `updatedAt`, notifica al `Store` y escribe a disco (§3). Lo mismo vale para la
   cascada de `setChecked`. ⚠️ **La Fase 4 no lo construyó:** el editor no tiene selección de
   varias líneas, así que no hay un «Supr» sobre una rama que pueda fallar en silencio, y una
   casilla con hijas se borra de abajo arriba a mano. ✅ **Y así se queda, decidido con el
   usuario el 2026-10-03:** no hay borrar una rama; las casillas se borran **una a una**.

Tampoco vale colar un borrado con hijas por la puerta de atrás de `merge`: es una operación
distinta y responde por lo suyo — y responde igual, porque absorber una línea que tiene hijas
las dejaría colgando de nada. Misma regla, escrita en su propia fila de la tabla de no-ops.

### 9.4 El tipo `Position`: el vocabulario del "dónde"

Falta una pieza en el modelo que hasta ahora no se había nombrado: `insert` necesita expresar
*dónde* va algo, y el modelo solo sabe direccionar **nodos**
(`ContentId`), no **posiciones**. Un id dice "esta casilla"; no dice "justo detrás de esta
casilla".

```ts
type Position =
  | { readonly at: "root-end" }
  | { readonly at: "after";         readonly id: ContentId }
  | { readonly at: "last-child-of"; readonly id: ContentId }
```

Con esto `insert(content, bloque, pos)` tiene un vocabulario para el "dónde" en vez de una
firma inventada para el caso.

Es una unión discriminada por `at`, por el mismo motivo que `Content` lo es por `type`: para
que el `switch` que la consuma sea exhaustivo.

**Son esos tres casos y no más.** Era la decisión (d), y está cerrada.

**Y quedó confirmada desde el otro extremo del diseño:** los tres casos cubren, entre los tres,
todo lo que el editor hace al crear una línea (§7.3) — `root-end` para la primera línea de una
nota vacía, `after` para la línea que nace debajo de otra (texto o casilla hermana),
`last-child-of` para una hija. No falta ninguno ni sobra ninguno. Ojo, eso sí: cuando se
decidió, los consumidores previstos eran `insert`, `move`, `indent` y `outdent`; hoy las tres
últimas no existen y **el único consumidor es `insert`**.

> **Y esta correspondencia se enunció mal una segunda vez.** Aquí decía «`root-end` para una línea
> de texto suelta», calcado de la tabla de §7.3, y con eso una línea de texto escrita en medio de
> la nota aparecía al final. Se corrigió con el usuario el **2026-09-29**, al usar el editor: el
> texto nace con `after`, y `root-end` se queda para la nota vacía. **De nuevo sin tocar el
> núcleo**: cambió quién elige cada caso, no los casos.

> **Esta correspondencia se enunció mal una vez, y cómo se rompió vale más que el enunciado.**
> Decía que los tres casos eran «los tres estados de `ModosEscritura`», atándolos a una decisión
> de interfaz. El 2026-09-20 esa decisión cambió —los tres estados pasaron a ser dos modos y un
> disparador (§7.2), y el 2026-09-29 un interruptor y un disparador— y la frase quedó falsa **sin
> que nada fallara**, porque de los tres casos de
> `Position` no sobró ninguno: sólo cambió quién elige `last-child-of`.
>
> Es la prueba desde dentro de que la frontera está donde tiene que estar: **un rediseño entero
> de la barra de edición no costó ni una línea del núcleo**, ni una operación nueva, ni una de
> las 329 pruebas. La lección al escribir: justificar una pieza del dominio por la forma que hoy
> tiene la UI es atarla a lo que más cambia.

Los candidatos que quedan fuera —`before`, `first-child-of`, `root-start`— no son
descabellados; se descartan por coste: **cada caso de `Position` es una rama más que testear**
en quien la consuma. Y las operaciones se expresan enteras con los tres de arriba: `insert` y
`split` colocan detrás o dentro según el modo, y ninguna pide los otros tres.

Lo que **sí** los pediría es un arrastrar y soltar —que hoy no está en la Fase 4: entraría si
las preguntas de §9.10 reabren `move`—, donde soltar *encima* de la
primera casilla de una lista no se puede expresar con `after`. Ese es el disparador concreto
para reabrirlo, y **va en el mismo paquete que `move`**: reordenar arrastrando pide "la primera
del todo", que con estos tres casos no se puede decir. Conviene saber lo que costará entonces:
añadir un caso obliga a **volver a pasar entera la batería de tests de `insert`**, no solo a
escribir la rama nueva. Se acepta ese coste futuro antes que testear hoy ramas que quizá no se
usen nunca.

### 9.5 Definición de "Fase 1 terminada"

Era el criterio de cierre de la Fase 1, ya cumplido. Su crónica, en `TAREAS.md` y `git log`; la
cadena de identidad que demostraba, en §3 y §7.5.

### 9.7 El catálogo de acciones de la Fase 2

El catálogo no se inventó: cada acción sale de un campo del modelo que alguien tiene que poder
cambiar, o de una operación de la Fase 1 que no tenía quien la despachara. **En la Fase 2 fueron
diecisiete**; la Fase 5 añadió las trece de Diagrama (§9.11), treinta en total.

| Grupo | Acciones | De dónde salen |
|---|---|---|
| **Contenido** | `set-checked` · `set-text` · `insert` · `remove` · `split` · `merge` · `convert-to-checkbox` · `convert-to-text` | las ocho operaciones de §9.3. `set-checked` existía desde la rebanada de la Fase 1 |
| **Notas** | `create-note` · `rename-note` · `delete-note` | `Note` tiene `name` y `content`; el contenido ya está cubierto arriba |
| **Contextos** | `create-context` · `rename-context` · `delete-context` · `add-item` · `remove-item` · `set-default-view` | los campos de `Context`: `name`, `defaultView` e `items` |

**Las de contenido son mecánicas.** Su caso de reducer es calcado al de `set-checked`: buscar la
nota, llamar a la operación, comparar con `===`, y si el contenido no cambió devolver el estado tal
cual. Lo único que hay que vigilar es que **nadie se salte la comparación**.

#### Ninguna acción pliega varias operaciones

Una acción, una operación, en toda la Fase 2. Las compuestas que §9.3 anticipa —la cascada de
`setChecked` sobre los descendientes, borrar una rama entera de hojas hacia arriba— **no se
diseñan aquí**: no se sabrá qué gestos existen de verdad hasta tener el editor delante, y
adivinar la forma de la acción sin él es diseñar a ciegas. El aviso de §9.3 sigue en pie: cuando
lleguen, se pliegan en **una sola** acción, porque N despachos son N `updatedAt`, N avisos al
`Store` y N escrituras a disco. **La Fase 4 no trajo ninguna de las dos** —la cascada está
aparcada con las candidatas de la barra (§7.2) y el borrar rama, en §9.3—. Lo que sí encadena
son **dos casos de uso desde la UI** en dos gestos que tocan entidades y no contenido: crear una
nota en un contexto (`create-note` + `add-item`) y «Mover a…» (`add-item` + `remove-item`), §7.4.

#### Qué devuelve un caso de uso: la entidad protagonista, o `null`

*Construido el 2026-09-19; hoy son treinta y dos, todos con esta forma.* Cada caso de uso devuelve
la entidad que ha tocado, o `null` si no aplicó, que sale de la invariante de identidad (`cambio`,
en `useCases.ts`). **No un `Result`**: un no-op **no es un fallo**, y sin esto «hecho» y «no
aplicaba» eran indistinguibles desde la llamada. ⚠️ Es **la protagonista, no todo lo que cambió**
—`deleteNote` devuelve la nota, no las `ItemRef` que limpió—, así que **no sirve de undo**: el undo
será una pila con su propio diseño. El registro entero, en `TAREAS.md` → *Sin decidir*.

#### Lo que de verdad tiene enjundia: la integridad referencial

`delete-note` es **la primera acción del proyecto que toca dos entidades a la vez**. Borrar la
nota no basta: hay que quitarla de todos los contextos que la listaban, o queda una `ItemRef`
apuntando a nada, que es justo lo que prohíbe la regla de integridad referencial.

Tres cosas que hay que hacer bien y que no se parecen a nada de la Fase 1:

- **Todos los contextos tocados reciben el mismo `meta`.** Aquí se cobra la decisión de
  construir `meta` una sola vez por acción (`Action.ts`): la nota y los cuatro contextos que la
  listaban se llevan exactamente la misma marca de tiempo y no cinco milisegundos distintos
  según el orden del bucle.
- **Los contextos que no la listaban se devuelven intactos.** La cadena de identidad de §3 no
  distingue entre entidades: un `map` sobre `contexts` que devuelva copias equivalentes hace que
  la persistencia reescriba en disco cada contexto de la app cada vez que borras una nota.
- **`add-item` es no-op si la entidad referenciada no existe.** Es el otro lado de la misma
  regla, y no hay dónde comprobarlo salvo aquí.

#### El arranque, partido en dos

Por la misma costura que el write-behind (§6.4): **la mitad pura** —`hydrate(entidades) →
AppState` y el runner de migraciones que la precede— es del core y se prueba sin navegador ni
temporizadores; **la impura** —quién abre el almacén, en qué orden, y qué se ve si no hay nada
guardado— es `boot.ts`, en `platform/web/` (§7.5).

#### `schemaVersion` no va en `AppState`

Ya está donde tiene que estar: en `StorageAdapter` (§6.1), con su `get` y su `set`. **No se
añade a `AppState`**. Es una
propiedad de **lo guardado**, no del estado en memoria: en `AppState` no significaría nada, no
la leería nadie, y cada acción tendría que arrastrarla intacta de un estado al siguiente.

La razón no es que añadirlo luego fuera una migración de datos —ese argumento valdría igual para
`Versioned`, que sí se adelantó—: es que **`schemaVersion` *es* el mecanismo de migración**, y un
número de versión que nadie lee no protege nada. Por eso llegó con el runner que lo consume. Y **en
un almacén vacío `boot` apunta ya la versión actual**: si no, uno con notas seguiría diciendo «0»
y la primera migración se lo saltaría (§7.5).

### 9.8 Definición de "Fase 2 terminada"

Era el criterio de cierre de la Fase 2, ya cumplido. Su crónica, en `TAREAS.md` y `git log`.

### 9.9 Definición de "Fase 3 terminada"

Era el criterio de cierre de la Fase 3, ya cumplido. Su crónica, en `TAREAS.md` y `git log`; lo que
dejó de diseño está en §6: el recuento de fronteras y su guardián en §6.5, y la lista manual de
`DirectoryHandleBlobStore` y lo que cazó en §6.3.

### 9.10 La Fase 4: la UI web

Una UI no termina sola —siempre se puede pulir un píxel más—, y ésta fue la primera fase en la que
**algunas decisiones no se pueden cerrar sobre el papel**: «¿se aguanta no poder reordenar una
lista?» no tiene respuesta hasta que alguien hace la compra con la app. La salida no fue saltarse el
criterio de cierre, sino **escribir en él cuáles son esas preguntas y qué cuenta como haberlas
contestado** (abajo). El resumen de la fase y sus commits, en `TAREAS.md`; el detalle, en
`git log`.

#### Partida en dos: primero Contextos, luego Notas

**Decidido el 2026-09-27**, al planificar la navegación (§7.4): **Fase 4 · Contextos** y **Fase 4 ·
Notas**, nombradas por contenido y no por número, en ese orden. De lo global a lo específico, que
fue la propuesta del usuario, por tres motivos:

- **No hay andamio que tirar**: el editor de Notas se abre desde las listas que construye
  Contextos.
- **Sigue el camino por el que se llega a las cosas**: primero se ve una ventana, luego se entra a
  una nota.
- **La rebanada vertical cae sobre la pieza más sencilla.** Si la pila entera —`platform/`,
  `LocalStorageBlobStore`, `hydrate`, el write-behind— no encaja, se descubre con contextos, que
  son un nombre y una lista, y no con el editor.

**Coste admitido:** lo difícil —el editor— llegó segundo, y con él las tres preguntas empezaron a
contestarse más tarde. **Ninguna de las dos partes necesitaba tocar el core**: todas las acciones
existían desde la Fase 2, y el General es cálculo de presentación. Lo tocaron sólo los `.js` de los
imports (§8.6) y, a petición del usuario el 2026-10-03, la regla de `merge` (§9.3) y conservar las
referencias a lo ilegible (§6.5).

**El bundler, cerrado el 2026-09-27: de entrada no se instala**, y la fase entera se hizo sin él;
entra sólo cuando algo concreto lo exija. El argumento con que se cerró era a medias falso; cómo se
resolvió, en §8.6.

#### Las tres preguntas que se contestan con el editor delante

**Siguen sin contestar**, y son la deuda con la que el usuario cerró la Fase 4 el 2026-10-03. La
respuesta va a `TAREAS.md`, con fecha, después de usar la app de verdad —listas reales, varios
días—, no después de una demo de cinco minutos. *(El Retroceso bajo una casilla con hijas, que se
anotó como posible cuarta pregunta, se cambió el 2026-10-03: ahora une con la línea que se ve
encima, §7.3 y §9.3.)*

- **¿Se aguanta no tener `move`?** Hoy una lista se queda en el orden en que se escribió, y
  reordenar es borrar y reescribir (§9.3).
- **¿Se aguanta no tener `indent` ni `outdent`?** Una línea que nace en el nivel equivocado se
  borra y se reescribe. Es el precio aceptado de que el nivel se elija al nacer.
- **¿El disparador de anidar se entiende sin que nadie lo explique?** Es la pieza nueva de §7.2 y
  la única que actúa sobre una línea que todavía no existe.

⚠️ **«No se aguanta» es un resultado válido**, y reabre la decisión correspondiente con datos en
vez de con intuiciones, aunque la fase esté cerrada. Haber escrito estas tres preguntas antes es
justamente lo que compra el derecho a cambiar de opinión después sin que parezca una rendición.

### 9.11 La Fase 5: los Diagramas

**Escrito antes de que existiera una línea de código de diagramas**, y hoy construido entero. Todas
las decisiones de aquí se tomaron **con el usuario el 2026-10-03**; lo que no lleve otra fecha,
lleva ésa. Las que salieron al construirlo sin decidirse con él —el usuario las ha visto y no las
ha rechazado— van marcadas como *decisiones de implementación*.

#### Qué es un diagrama: un lienzo libre

**Un lienzo libre**, como Miro, Excalidraw o tldraw: el usuario **coloca los nodos arrastrando**
donde quiere, y los une con relaciones. Es como el usuario se lo imaginó desde el principio.
**Descartados:**

- **un mapa mental**: es un árbol, y obliga a que cada nodo cuelgue de uno solo;
- **un diagrama de dependencias con colocación automática** —era la recomendación que se le
  hizo—: quita justo lo que el usuario quería, decidir dónde va cada cosa;
- **texto que se dibuja** (estilo Mermaid): el diagrama se escribe, no se toca.

**Al abrir un diagrama siempre se ve el origen** (0, 0) de un mapa X/Y que el usuario no ve. **El
encuadre no se recuerda.**

#### Las relaciones: un multigrafo con flecha opcional

Se llaman **relaciones** —`DiagramRelation` en el código—. Descartados **«edge»**, jerga de
grafos, y **«connection»**, que suena a red o a servidor.

- **Conectar A y luego B crea A→B.**
- **Multigrafo**: entre dos nodos puede haber **cualquier número** de relaciones, en cualquier
  sentido, **repetidas incluidas** —también creadas conectando dos veces—. **El core no pone
  límite**: el límite es la legibilidad, y eso lo juzga quien dibuja.
- **Ciclos permitidos.** La app no da sentido a la flecha; el sentido lo pone quien escribe.
- **Una relación de un nodo a sí mismo no existe**: es un no-op.
- **Cómo se dibujan:** una sola entre un par, **recta**; varias, **en abanico de curvas**
  (Bézier cuadráticas con curvaturas distintas), para que no se tapen.
- **Su menú.** Con flecha: *Invertir dirección · Sin dirección · Texto · Borrar*. Sin dirección:
  *Con dirección · Texto · Borrar* —«Con dirección» devuelve la flecha que tenía, porque una
  relación sin dirección **sigue guardando `from` y `to`**; *Invertir* desaparece, porque no
  significa nada—. **Invertir cuando ya hay otra igual** en el otro sentido no hace nada especial:
  **conviven**, como cualquier repetida.
- **Texto opcional a lo largo de la línea** (`<textPath>` de SVG), **girado para no salir boca
  abajo**, y editado con un campo que aparece encima.

#### Los nodos: pósits iguales, de dos clases

**Todos se ven igual: una caja, un pósit, de ancho fijo, que crece hacia abajo con el texto.**
Por dentro hay dos clases:

- **de texto** (`SimpleNode`), con su texto;
- **nodo-nota** (`NoteNode`), que apunta a una nota y **enseña en directo su título actual**. **No
  guarda copia del título**: el usuario no quiere entidades con copias de nombres que haya que
  mantener al día, y una copia sería una segunda fuente de verdad que se separa en cuanto se
  renombra la nota.

**Cualquier nodo se puede marcar como hecho** (`set-node-done`), y se ve tachado o atenuado. **No
toca las casillas de la nota** a la que apunte: es del nodo.

**Un nodo-nota cuya nota no existe se convierte en un nodo de texto «Nota perdida».** Una sola
regla para los dos caminos por los que puede pasar: **borrar la nota desde la app**
(`delete-note`, abajo) y **perderla por fuera** —su fichero ya no está al arrancar— (`hydrate`,
abajo). Conserva **id, posición, hecho y relaciones**: el dibujo no se rompe, y se ve dónde
estaba. ⚠️ **Una nota ilegible no está perdida**: su nodo sigue siendo nodo-nota, igual que se
conservan las referencias de los contextos a lo ilegible (§6.5); arreglado el fichero, vuelve.
**Precio asumido:** «Nota perdida» es un literal en castellano **dentro del core**, y se guarda
en el fichero.

#### El modelo

```ts
interface DiagramNodeBase {
  readonly id: DiagramNodeId
  readonly positionX: number
  readonly positionY: number
  readonly done: boolean
}                                    // fuera parents y children
interface SimpleNode extends DiagramNodeBase { readonly type: "simple-node"; readonly text: string }
interface NoteNode   extends DiagramNodeBase { readonly type: "note-node";   readonly noteId: NoteId }

interface DiagramRelation {
  readonly id: DiagramRelationId
  readonly from: DiagramNodeId
  readonly to: DiagramNodeId
  readonly directed: boolean         // false = sin punta, pero conserva from y to
  readonly label: string             // "" = sin texto
}

interface Diagram extends Versioned {
  readonly id: DiagramId
  readonly name: string
  readonly nodes: Readonly<Record<DiagramNodeId, DiagramNode>>
  readonly relations: Readonly<Record<DiagramRelationId, DiagramRelation>>
}
```

Así está en `Diagram.ts`, con `DiagramRelationId` y su constructor `diagramRelationId`
exportados por `index.ts`. Lo que cambió respecto al modelo viejo, y por qué:

- **Las aristas salen de los nodos.** Iban en `parents` + `children` de cada nodo: **dos
  fuentes de verdad** de la misma arista, que se pueden contradecir. Y con el multigrafo no
  bastarían: una lista de ids no distingue dos relaciones entre el mismo par, ni lleva su
  dirección ni su texto.
- **`nodes` pasa de array a `Record`**, que ya estaba anotado: las relaciones apuntan por id, y
  con un array toda búsqueda es lineal. Igual `relations`, por lo mismo que las entidades de
  `AppState` (§5.2).
- **Sin migración**: no hay ningún diagrama guardado, porque no había forma de crearlo.
- **`schema.ts` valida la forma nueva**, y además que **la clave de cada `Record` coincida con
  el id de dentro**: si no, el reducer buscaría por una clave y escribiría con otra.

#### Las acciones: trece nuevas, de 17 a 30

**Las operaciones puras van en un fichero propio del dominio**, `diagramOperations.ts`, gemelo de
`operations.ts`, y el reducer las envuelve con **`onDiagram`**, gemelo de `onContent` y
`onContext`: **la comparación de identidad escrita una vez**, y la estampa de `meta` sólo si
cambió algo. **Catorce casos de uso más —se planificaron trece—, y cada uno devuelve el diagrama
o `null`** (§9.7, la regla de siempre). El de más sale de `add-node`, que tiene **dos**,
`addTextNode` y `addNoteNode`, igual que `insert` tiene `insertText` e `insertCheckBox`: el id del
nodo se genera en la capa de casos de uso, y ahí hay que saber qué clase de nodo se construye.
Quedan **treinta y dos casos de uso para treinta acciones**.

| Acción | No-op si… |
|---|---|
| `create-diagram` (vacío, con nombre) | el id ya existe |
| `rename-diagram` | no existe · mismo nombre |
| `delete-diagram` (lo quita también de todos los contextos) | no existe |
| `add-node` (llega construido, con id) | no existe el diagrama · id repetido · nodo-nota a una nota inexistente · posición no finita |
| `set-node-text` | no existe · es nodo-nota · mismo texto |
| `set-node-position` (al soltar) | no existe · misma posición · no finita |
| `set-node-done` | no existe · mismo valor |
| `remove-node` (se lleva sus relaciones en la misma acción) | no existe |
| `add-relation` (llega construida, con id) | no existe el diagrama o algún extremo · `from === to` · id repetido. **Las repetidas, sí** |
| `set-relation-ends` | no existe · mismos extremos · `from === to` · extremo inexistente |
| `set-relation-directed` | no existe · mismo valor |
| `set-relation-label` | no existe · mismo texto |
| `remove-relation` | no existe |

Tres que piden explicación:

- **`set-relation-ends` y no `invert-relation`**: es lo que hay debajo de *Invertir*, y **la UI
  decide los extremos**, igual que `toggleChecked` del editor llama a `setChecked` con el valor ya
  decidido. Un «invertir» nunca podría ser no-op, y el nombre sostiene la invariante de identidad
  (la regla de `setChecked`, §3).
- **`remove-node` se lleva sus relaciones en la misma acción**, y no es plegar dos: dejarlas sería
  una relación apuntando a un nodo que no está, que es justo lo que prohíbe la integridad
  referencial.
- **Nodos y relaciones llegan construidos, con su id**: el reducer no genera ids (`CLAUDE.md`).

**Cómo quedó en el código:** las diez operaciones de `diagramOperations.ts` comparan con dos
ayudantes (`enNodo` y `enRelacion`) y **no salen por `index.ts`**: hoy sólo las usa el core, y se
abren el día que la UI las necesite. `onDiagram` envuelve las once acciones que actúan sobre un
diagrama existente; lógica propia sólo en
`create-diagram`, `delete-diagram` —que lo quita de los contextos y **no borra sus notas**— y
`add-node` de un nodo-nota, que mira que la nota exista. Un nodo nace con `done: false`; una
relación, con `directed: true` y `label: ""`. **Una guarda la vigila el compilador y no una
prueba:** quitar el no-op de `setNodeText` sobre un nodo-nota no compila, porque un `NoteNode` no
tiene `text`.

#### Lo que toca del core fuera de los diagramas

⚠️ **La Fase 5 toca dos piezas del core que ya existen y no son de diagramas**, y conviene
decirlo antes de que nadie lo descubra en un diff:

- **`delete-note` cambia.** Además de quitar la nota de los contextos, **en todos los diagramas
  convierte sus nodos-nota en nodos de texto «Nota perdida»** —mismo id, posición, hecho y
  relaciones—, **con el mismo `meta`** que el resto de la acción. **Los diagramas que no la usaban
  se devuelven por referencia**, como los contextos que no la listaban (§9.7). No lee el título de
  la nota.
- **`hydrate` gana dos limpiezas silenciosas**: las relaciones a nodos que no están en su
  diagrama, o de un nodo a sí mismo, **se tiran**; y un nodo-nota cuya nota no existe —y no es
  ilegible— **pasa a «Nota perdida»**. Las dos **devuelven por referencia lo que no cambie**,
  como hoy con los contextos.

**La regla de «Nota perdida» está escrita una sola vez**, en `loseNote` (con la constante
`LOST_NOTE_TEXT`), y la usan los dos caminos: `delete-note` por `sinNotaEnDiagramas`, gemelo de
`sinReferenciasA`, y `hydrate` por `diagramaLimpio`, que, como con los contextos, **no estampa**.

Lo que **no** cambia: `add-item` ya acepta diagramas y `diffState` ya los cubre.

#### La vista: un corcho con pósits e hilos

**Técnica: «vista mixta».** Los pósits son **HTML**; las líneas, **una capa SVG por debajo**; y
las dos van dentro de **una capa que se mueve y se escala entera con una transformación CSS**. Es
la arquitectura de React Flow y Svelte Flow, sin React. Dicho como se le explicó al usuario: **un
corcho con pósits, y los hilos en una lámina transparente debajo**; mover o acercar el lienzo es
mover el corcho entero.

**Descartados:**

- **todo en `<canvas>`**: acertar con el dedo, editar texto y la accesibilidad, todo a mano.
  Compensa con miles de elementos, y aquí no los habrá;
- **todo en SVG**: el texto de SVG **no se parte en líneas solo**, y un pósit es sobre todo texto.

**Precio:** hay que **medir el tamaño real de cada pósit** para que la flecha acabe en su borde y
no en su centro.

**Desde cero, sin librería**, y no por principio:

- **React Flow, tldraw y Excalidraw exigen React**, y la UI vanilla es decisión cerrada. tldraw,
  además, pide licencia de pago o su marca en producción;
- **Drawflow y JointJS** están pensadas para bloques con puertos y **guardan su propio estado**:
  serían dos fuentes de verdad con el `Store`;
- **Cytoscape** es para visualizar grafos, no para dibujarlos a mano.

**Plan B, aparcado en `TAREAS.md`:** una librería pequeña y sin dependencias **sólo para mover y
acercar**, si el pellizco o el arrastre no se dejan domar en el móvil real. Mismo trato que
Snabbdom y los motores de edición: con su disparador escrito.

**Cómo quedó** —en `DiagramCanvas.ts`, que montan la vista y la ventana (§7.5)—:

- **Los pósits miden `8rem` de ancho** —eran `10rem`, y `7rem` los alargaba demasiado hacia abajo;
  Fase 7— y van en su propio contenedor, para que su `reconcile` no mueva la capa SVG. La rejilla
  de puntos usa `--rejilla`, que es `--dim` al 50 % (Fase 7).
- **La posición de un nodo es su centro, y al abrir el origen se pone en el centro del lienzo**:
  «se abre en el origen» podía ser también la esquina, y el centro deja sitio alrededor
  (*decisiones de implementación*). Se centra la primera vez que el lienzo tiene tamaño, con un
  `ResizeObserver`: al montarse todavía no se ve y mide cero.
- **`viewport.ts`, puro: el encuadre.** Un punto del corcho se ve en `corcho × scale + offset`, con
  la escala entre 0,25 y 4. **El pellizco se calcula siempre desde el encuadre que había al poner el
  segundo dedo**, no paso a paso: así no acumula error de redondeo.
- **Una sola punta de flecha por lienzo, con un id distinto en cada uno**, porque puede haber dos
  montados: la ventana y el diagrama abierto encima.
- **Cada pósit se mide una vez por repintado** (`offsetWidth`/`offsetHeight`, que no cuentan la
  escala: ya son unidades del corcho), y **un `ResizeObserver` por pósit** repinta las líneas cuando
  aparece o crece, también mientras se escribe en él. Sin él las líneas se pintaban antes de que
  los pósits tuvieran tamaño, y una caja de tamaño cero hace salir la línea del centro, con la punta
  tapada (cazado probando).
- **Arrastrando un pósit, sólo se redibujan sus líneas** (`relationsOf`, en `relationGeometry.ts`),
  siguiendo al dedo, y **se mide todo antes de escribir nada**: alternar medir y escribir obliga al
  navegador a recalcular la página antes de cada medida. Al soltar se guarda la posición, y el
  repintado normal las redibuja todas. Antes se redibujaban todas en cada movimiento, alternando, y
  con muchas líneas dolía (medido en la Fase 7; las tablas, en `TAREAS.md`).
- **La geometría, pura, en `relationGeometry.ts`.** `borderPoint` da dónde corta el borde la recta
  que sale del centro. `fanOffsets` agrupa por **par sin sentido** —A→B y B→A son del mismo par—,
  ordena por id y reparte las curvaturas alrededor de cero; una sola, recta. En la cuadrática, el
  lado de la curva se mide **del nodo de id menor al mayor**, así que A→B y B→A con curvaturas
  opuestas no se pisan; el control se separa **el doble** de la curvatura, porque el vértice de una
  cuadrática queda a mitad de camino del control; y **cada extremo sale hacia el control**, no hacia
  el otro centro, para que la línea nazca por el borde por donde de verdad sale. `labelPath` da el
  trazado **al revés si la línea va hacia la izquierda**, para que el texto no salga boca abajo.
- **El texto de una línea** lleva un halo del color del fondo (`paint-order: stroke`) para leerse si
  cruza otra; si es más largo que la línea, se corta.

#### Los gestos: «doble = menú o crear»

**El móvil tiene que ir igual de bien que el escritorio, con los mismos gestos.** Pointer Events,
y `touch-action` para quitar al navegador sus gestos sobre el lienzo.

| Gesto | Escritorio | Móvil |
|---|---|---|
| Mover el lienzo | arrastrar el fondo | arrastrar con un dedo, **también empezando sobre un nodo** |
| Acercar y alejar | rueda, o pellizco en el trackpad | pellizco con dos dedos |
| Mover un nodo | arrastrarlo | **mantener pulsado** y arrastrar, como las fichas de ventanas |
| Crear un nodo | doble clic en el fondo → *Texto · Nota existente · Nota nueva* | doble toque, igual |
| Menú de un nodo | doble clic, o clic derecho | doble toque |
| Menú de una relación | doble clic en la línea, o clic derecho | doble toque |
| Abrir un nodo-nota | clic | toque |
| Tirar una relación | *Conectar* en el menú del nodo, y clic en el de destino | igual, con toques |

Las reglas que salen de la tabla:

- **«Doble = menú o crear».** **No hay concepto de selección.** Un clic en un nodo de texto no
  hace nada.
- **El clic en un nodo-nota espera unos 250 ms** antes de abrir, para distinguirlo del doble
  clic. Descartados **abrir al instante** —el doble clic abriría la nota y nunca el menú— y
  **quitarle el menú** al nodo-nota.
- **Modo conectar:** tras *Conectar* aparece un aviso visible, «Toca el nodo de destino»; el
  siguiente clic en un nodo —también en un nodo-nota, que esta vez no se abre— crea la relación,
  y un clic en el fondo cancela.
- **Cada línea lleva debajo un trazo invisible y grueso**, para acertar con el dedo.
- **Menús de nodo:** el de texto, *Conectar · Editar · Hecho · Borrar*; el nodo-nota, *Conectar ·
  Hecho · Borrar* —su título se cambia dentro de la nota—.
- **Editar el texto, dentro del pósit**, que se vuelve campo; **al salir se guarda**. Un nodo de
  texto nuevo **nace vacío, con el cursor dentro**. **El teclado virtual no debe tapar el pósit
  que se edita.**
- **Mover un nodo guarda UNA vez, al soltar** (`set-node-position`), no en cada píxel.
- **Solapes:** el último nodo movido o creado queda encima. **Ese orden no se guarda**: al abrir,
  el de creación.
- **Pendiente: manejar el lienzo con teclado**, como reordenar las fichas con teclado (§7.4).

**Cómo quedó:**

- **Las cifras de `gestures.ts`:** `LONG_PRESS_MS` 500 y `MOVE_TOLERANCE_PX` 10, **las mismas que
  el arrastre de fichas** (§7.4), para que los dos gestos se sientan igual; `DOUBLE_TAP_MS` 250, que
  es también lo que espera un nodo-nota antes de abrirse; y `DOUBLE_TAP_DISTANCE_PX` 25, porque un
  dedo no repite el sitio exacto. Un doble toque exige además **el mismo objetivo**.
- **Con el ratón, un pósit se arrastra directamente; con el dedo, tras 500 ms.** Mover el corcho
  con el dedo no espera, también empezando sobre un pósit o una línea.
- **El menú del fondo, «Añadir al diagrama»:** *Texto · Nota existente · Nota nueva*. *Nota
  existente* sólo sale si hay notas, y su lista sustituye a las opciones en la misma hoja. **Los
  menús son la hoja de abajo** —la de ⋮ en la configuración—, no un menú flotante (*decisión de
  implementación*).
- **Un nodo-nota cuya nota no se pudo leer** dice «Nota ilegible» y **no se abre**.
- **Conectar es una capa del `backStack`**, como una hoja: lo cancelan el atrás, el fondo, el propio
  origen —una relación a sí mismo no existe—, el clic derecho y una línea, y también que el origen
  se borre mientras tanto. Consecuencia: **con el modo activo, «✕ Salir» primero cancela el modo**
  y hay que pulsarlo otra vez.
- **El texto de un pósit: Intro guarda, Mayúsculas+Intro hace otra línea**; salir del campo guarda,
  y Escape descarta. **Precio:** en el móvil, sin Mayúsculas a mano, un pósit no puede tener varias
  líneas. El texto de una línea se edita en un campo sobre su punto medio: Intro o tocar fuera
  guardan, Escape descarta, y vacío lo quita.
- *Decisiones de implementación*, también: **borrar un pósit o una línea no pide confirmación**;
  **un pósit vacío se queda**, y enseña «Sin texto»; **una raya azul a la izquierda** distingue los
  nodos-nota y las filas de diagrama en las listas; **una línea se pone azul al pasar el ratón**; y
  su trazo invisible para el dedo mide 16 de grueso.

#### Crear nodos-nota

- **De una nota existente**, con el selector —el mismo de «Mover a…»—.
- **De una nota nueva, creada desde el lienzo**: la nota se referencia en **todos los contextos
  donde está el diagrama**, y si el diagrama no está en ninguno, sólo se ve en el General. La UI
  encadena `create-note` + un `add-item` por contexto + `add-node`, **sin acción nueva**: es la
  misma forma que crear una nota en un contexto (§9.7). Crearla **te lleva dentro de la nota**, y
  al salir vuelves al lienzo.

#### Lo que se prueba en Node y lo que se verifica a mano

El patrón de §7.5, sin cambios: **las cuentas van en funciones puras con pruebas en Node** —pasar
de pantalla a corcho y de vuelta, acercar alrededor del punto del pellizco, distinguir clic,
doble clic y pulsación larga, el punto donde la línea corta el borde del pósit, el abanico, la
orientación del texto— y **el DOM se verifica a mano**, con `test/ui/VERIFICACION-MANUAL-LIENZO.md`
y `-RELACIONES.md`.

#### Partida en tres, en este orden

**Fase 5 · Modelo → Fase 5 · Lienzo → Fase 5 · Relaciones**, nombradas por contenido como las de
la Fase 4: el core y `storage/` sin pantalla; todo menos las líneas; y las líneas. **Por qué ese
orden:** las relaciones son la parte con más geometría, y separarlas dejaba probar el lienzo en el
móvil antes, cuando todavía podía entrar el plan B de la librería de mover y acercar.

**El usuario decidió el 2026-10-04 pasar las listas manuales pendientes todas juntas, al final, en
una sentada** —la del lienzo, la de las relaciones y la deuda móvil de la Fase 4—, sabiendo el
riesgo: si los gestos fallaban en su móvil, se descubriría con las relaciones, que usan los mismos
gestos, construidas encima. Separar las partes siguió sirviendo para construir por piezas.

### 9.12 La Fase 6: la PWA

**Qué es:** que ElNotas se **instale en el móvil como una app** —icono, pantalla completa, sin
conexión, actualizándose sola— **sin depender del ordenador de casa**. Antes se servía sólo con
`python3 -m http.server` en la red local (§8.6), que sólo funciona en casa, con el ordenador
encendido, y por `http://`, que para el navegador no es un sitio seguro. **Sin dependencias
nuevas y sin tocar el core.**

| Pieza | Qué hace | Dónde |
|---|---|---|
| Rutas relativas | que la app funcione dentro de una subcarpeta | `index.html` |
| Manifiesto | nombre, icono, pantalla completa, color de arranque | `manifest.webmanifest` |
| Iconos | el busto del «nerd» sobre azul, 192 y 512 | `assets/icono/` |
| Script de compilación | arma la carpeta que se publica y le pone la huella | `tools/build-pages.mjs` |
| *Service worker* | guarda la app en el móvil y la sirve sin conexión | `pwa/sw.js` |
| `persist()` | pide que el navegador no borre los datos por su cuenta | `src/platform/web/main.ts` |
| La versión | una línea en la configuración que dice qué versión corre | `SettingsView.ts` |
| La receta de publicación | compila, comprueba y publica al subir a `main` | `.github/workflows/publicar.yml` |

#### Qué es una PWA, y por qué hace falta publicarla

Una *Progressive Web App* es una web que el navegador deja **instalar**: sale un icono en el
escritorio del móvil, se abre a pantalla completa sin la barra del navegador y funciona sin
conexión. No es una app nativa: por dentro sigue siendo la misma página, en el mismo navegador.

Para ofrecer la instalación, el navegador pide tres cosas: un **manifiesto** (nombre, iconos,
cómo se abre), un ***service worker*** y que la página venga de un **sitio seguro**, con
`https://` (o `localhost`, la excepción para desarrollar). La red de casa no cumple lo tercero, y
por eso hace falta **publicarla en internet**.

**Internet hace falta para instalarla y para actualizarla; para usarla, no.** El *service
worker* guarda todos los ficheros de la app en el móvil al instalarla, y a partir de ahí la abre
desde lo guardado. **Las notas nunca salen del móvil**: el sitio publicado aloja el programa, no
los datos. Si el sitio desapareciera, la app instalada seguiría funcionando con la última versión
que bajó.

#### El *service worker*, desde cero

Es un **programa pequeño que el navegador guarda junto a la app** y que se pone entre ella y la
red: cada fichero que la página pide pasa por él, y él decide si lo sirve de lo guardado o lo va
a buscar. Vive aparte de la página —no ve el DOM— y sigue registrado aunque se cierre.

Su ciclo de vida explica casi todas las decisiones de abajo:

1. **Se instala**: la primera vez, descarga la lista de ficheros de la app y los guarda en una
   caché con nombre propio.
2. **Se activa**: toma el mando y borra las cachés de versiones anteriores.
3. **Sirve**: desde ahí, cada petición sale de su caché.
4. **Al abrir la app con conexión**, el navegador baja el `sw.js` publicado y lo compara con el
   que tiene. Si ha cambiado aunque sea un byte, **instala el nuevo por detrás**, que espera su
   turno mientras el viejo sigue sirviendo.

#### Las decisiones, cerradas con el usuario el 2026-10-08

**1. GitHub Pages, porque el repo es público.** Gratis, con HTTPS y siempre encendido, en
`https://ildartashtekov.github.io/ElNotas/`. Con un repo privado habría hecho falta otro sitio
(Netlify o Cloudflare Pages), porque Pages en privado es de pago.

**2. Se publica con GitHub Actions al subir a `main`.** GitHub Actions es un **robot que ejecuta
una receta en los ordenadores de GitHub** cada vez que pasa algo en el repo. La receta:
`npm ci` —instala **exactamente** lo de `package-lock.json`, nada nuevo—, `npm run check`,
`npm run build:web`, `npm run build:pages` y publicar la carpeta. **Si `check` falla, no se
publica nada** y en el móvil sigue la versión anterior. Se lanza también a mano con un botón
(`workflow_dispatch`), dos publicaciones seguidas no se pisan (`concurrency`) y sólo usa piezas
oficiales de GitHub (`actions/…`), ninguna de terceros. El `git push` y activar Pages
(*Settings → Pages → Source: GitHub Actions*) los hace el usuario: en esta máquina `git push` está
denegado en `.claude/settings.json`, a propósito. Las versiones de las piezas de GitHub se
comprueban el día de escribir la receta: de memoria salen unas de años antes.

*Descartado:* compilar en el ordenador y subir la carpeta a mano a una rama `gh-pages`. Funciona,
pero son varios pasos por actualización, nada impide publicar algo que no pasa `check` y el
historial se llena de ficheros generados. El robot no añade nada al proyecto más que un fichero de
receta, y **no es una dependencia de npm**.

**3. La actualización es en silencio.** El *service worker* nuevo llama a `self.skipWaiting()` al
instalarse y entra en cuanto termina de descargar: **la versión nueva se ve en la siguiente
apertura**. Sin `skipWaiting`, el nuevo espera a que la app se cierre **del todo** —quitarla
también de las recientes—, y en Android eso pueden ser días.

*Descartado:* un aviso «Hay una versión nueva — tocar para actualizar». Más código y otra cosa en
pantalla para una app de un solo usuario que sabe cuándo ha publicado.

*Lo que hace seguro `skipWaiting`:* la página vieja sigue abierta mientras el nuevo borra la caché
vieja, así que si pidiera un fichero **después de arrancar** recibiría el de la versión nueva,
mezclando versiones. **No pasa porque la app carga todos sus módulos al arrancar**: comprobado el
2026-10-08, en `src/` no hay ni un `import()` dinámico. Si algún día lo hay, esta decisión se
revisa.

**4. Exportar e importar las notas queda fuera de la fase**, pendiente en `TAREAS.md`. Importa
porque la app publicada es **otro sitio** para el navegador —los datos se guardan por origen— y
**empieza vacía**: no ve lo escrito en `http://192.168.…:8000`. **El usuario acepta perderlo**
(2026-10-08).

**5. Se pide almacenamiento persistente**, con `navigator.storage.persist()` al arrancar, en
`src/platform/web/main.ts` —la composición, no el core—. Sin él, cuando el móvil anda corto de
espacio el navegador **puede borrar por su cuenta** los datos de un sitio; con él, se compromete a
no hacerlo. A una app instalada Chrome suele concederlo sin preguntar. La respuesta no cambia nada
en pantalla. ⚠️ **No protege de que el usuario —o el «limpiar» de MIUI— borre los datos de la app a
mano**: contra eso sólo sirve la exportación del punto 4. **No va en un `try` ni en
`check:fronteras`**: se llama con `navigator.storage?.persist()` y su rechazo lo recoge un
`.catch`; sin HTTPS `navigator.storage` no existe y no se llama, y con él la llamada no lanza.

**6. El icono, tal como está**, con las esquinas redondeadas y transparentes, `purpose: "any"`.
Android recorta los iconos a su forma y podría dejar un borde; *descartado* hacer además una
versión *maskable* (que rellena el cuadrado entero para que el recorte no se note).

**7. El *service worker*, en JavaScript plano.** TypeScript necesita saber qué existe donde corre
el código, y eso lo dice la `lib` del tsconfig: la app usa `DOM`, y un *service worker* usa
`WebWorker`, que **no conviven en el mismo tsconfig** —declaran las mismas cosas de dos formas—.
Haría falta un sexto tsconfig sólo para él. Son unas cincuenta líneas, y lo que cambia en cada
versión —la lista de ficheros y la huella— lo escribe el script de compilación; lo que se pierde
sin el compilador lo cubre la prueba en el móvil. Vive **fuera de `src/`** (en `pwa/`) porque
`src/` es TypeScript y sus guardianes lo dan por hecho.

**8. El merge a `main`, justo antes de publicar**, después de probar la carpeta montada en
`localhost`, para que lo primero que llegara a `main` —y lo primero que se publicara— estuviera
probado. Fue un *fast-forward*: `main` seguía en el prototipo. Desde entonces se trabaja en `main`,
y la Fase 7 en su propia rama, `fase-7-refactor`.

**Y tres detalles más:**

- **La versión, a la vista en la configuración**, en una línea discreta al final («Versión
  2026-10-08 · a1b2c3»): la fecha de compilación y el principio de la huella. Con la actualización
  en silencio no se nota qué versión corre, y la caché **ya dio guerra en el móvil** al actualizar.
  El script la escribe en el `index.html` publicado (`<meta name="elnotas-version">`), `main.ts` la
  lee y se la pasa a la vista; en desarrollo no hay meta y la línea dice «desarrollo».
- **La pantalla puede girar** (sin `orientation` en el manifiesto). No cuesta código: toda la app
  es una columna centrada de ancho máximo (`max-width: 40rem`, `min-height: 100dvh`, en
  `base.css`), y en horizontal queda la columna en el centro, igual que hoy al girar el móvil en el
  navegador. La vista diagrama es la que más puede notarlo, y la lista del móvil la mira.
- **La pantalla de carga la monta Android sola**, con tres cosas del manifiesto: el icono en el
  centro, el nombre debajo («ElNotas») y `background_color` detrás. **El azul de la app,
  `#3552d6`** (`--accent` en `base.css`), porque el manifiesto admite **un solo color** y la app
  tiene modo claro y oscuro: con el blanco, en modo oscuro habría un fogonazo blanco en cada
  apertura; el azul se ve igual en los dos.
- **Las barras del sistema llevan su color, no el azul.** *El usuario decidió el 2026-10-09* que
  fueran azules siempre (`theme-color` en `index.html` y `theme_color` en el manifiesto), en vez del
  color del fondo de cada modo; **revisado en la Fase 7, el 2026-10-11, por decisión del usuario**:
  en horizontal la barra azul hacía una L con la de navegación, así que se quitaron las dos. **El
  azul queda repetido fuera de `base.css` en un solo sitio**, el `background_color` del manifiesto,
  que no lee variables de CSS: rompe la regla de que los colores viven sólo en `base.css`, y está
  pendiente en `TAREAS.md`.

#### Las rutas: relativas, porque Pages sirve en una subcarpeta

`index.html` pedía `/dist/web/…` y `/src/ui/styles/…`: **rutas absolutas**, desde la raíz del
dominio. Con `python3 -m http.server` la raíz es el repo y funciona; en Pages la app vive en
`/ElNotas/`, así que `/dist/web/…` apuntaría a `ildartashtekov.github.io/dist/web/…`, que no
existe. **Pasaron a relativas** (`./dist/web/…`), en el `importmap`, en el `<script>` de entrada y
en los estilos: se resuelven contra la dirección de la página y funcionan en los dos sitios. El
manifiesto, igual: `start_url` y `scope` son `"./"`. Comprobado el 2026-10-08: en `src/ui` y
`src/platform` no hay otras rutas absolutas.

#### La carpeta publicada: un trozo del repo con su misma forma

No se publica el repo entero —`node_modules/`, `test/`, el TypeScript—, sino lo que el navegador
carga: `index.html`, `manifest.webmanifest`, `assets/icono/`, `dist/web/`, `src/ui/styles/` y
`sw.js`. **Con las mismas rutas que en el repo**, así que lo que funciona en desarrollo funciona
publicado sin reescribir nada, salvo dos añadidos al `index.html` copiado.

La arma **`tools/build-pages.mjs`** (`npm run build:pages`, después de `build:web`), sólo con
`node:fs`, `node:path` y `node:crypto`, en `dist/pages/` —ya en `.gitignore`—:

1. Copia los ficheros de arriba.
2. **Calcula la huella**: un SHA-256 del contenido de todos ellos, del que se usan los primeros
   caracteres. Cambia un byte de cualquier fichero y cambia la huella. Cuenta también
   `pwa/sw.js`, que no se publica tal cual.
3. **Escribe `sw.js`** a partir de `pwa/sw.js`, con la lista de ficheros y la huella dentro. Así
   cada versión tiene **su caché con su nombre** (`elnotas-<huella>`), y como el `sw.js` cambia, el
   navegador se entera de que hay versión nueva.
4. **Añade al `index.html` copiado** el registro del *service worker* —un `<script>` en línea,
   que si falla lo dice en la consola— y la meta de la versión.
5. **Se niega a terminar** si el `index.html` tiene alguna ruta absoluta, o si falta un fichero de
   los que la página enlaza: es el error que **sólo se notaría en el móvil**.

#### Sin *service worker* en desarrollo

**El registro sólo existe en la copia publicada**, porque lo añade el script; el `index.html` del
repo no lo lleva. En `localhost` el navegador sí permite *service workers*, y uno registrado
**serviría desde su caché lo que se está cambiando**: se edita un fichero, se recarga y sigue
saliendo el viejo. Así no hace falta preguntar en qué máquina se está, y `src/` no se entera de que
existe.

#### La caché del navegador, que ya dio problemas

Hay **dos cachés** y conviene no confundirlas: la del *service worker*, que controlamos, y la
**HTTP** del navegador, que Pages rellena con una validez de unos diez minutos. Si el *service
worker* nuevo descarga sus ficheros a través de la caché HTTP, puede **guardar en la caché nueva
ficheros viejos**, con el nombre de la versión nueva: justo el problema que se vio en el móvil.
Por eso **al instalarse descarga con `cache: "reload"`**, que salta la caché HTTP. El propio
`sw.js` no tiene ese problema: el navegador lo comprueba siempre contra la red.

#### Lo que se prueba en Node y lo que se verifica a mano

**Casi nada de la fase es lógica**, así que casi no hay pruebas nuevas en Node: sólo `versionLine`,
la línea de la versión. El script se verifica ejecutándolo y **rompiendo a propósito** sus dos
negativas (una ruta absoluta, un fichero que falta). El *service worker* y el manifiesto sólo se
pueden probar en un navegador: primero en el ordenador, sirviendo `dist/pages/` en `localhost`, y
después en el móvil, con `test/ui/VERIFICACION-MANUAL-PWA.md`.

**El navegador del panel de Claude no deja registrar *service workers***, ni en `127.0.0.1` ni en
`localhost`: la petición del script ni llega al servidor. Se verificó en el Brave del usuario,
mirando el registro del servidor: al instalarse pide todos los ficheros; después, la app no pide
nada; y con otra huella publicada los vuelve a bajar **con 200 y ni un 304**, que es
`cache: "reload"` saltándose la caché HTTP. **La actualización en el móvil no consta que se viera**:
necesita publicar un cambio.

---

## Apéndice: el prototipo viejo

`src/scripts/` era el prototipo anterior al rediseño. **Se borró en la Fase 4** (`cdfb816`, punto
9 de Fase 4 · Notas), con `webpack.config.js` y `public/` entero; su CSS no se aprovechó. No
reflejaba esta arquitectura, y hasta entonces `CLAUDE.md` gastaba un párrafo por sesión en decir
que no se imitara.

Arrastraba dos bugs conocidos que se resolvieron sustituyéndolo, no parcheándolo: `context.items`
apuntaba al array `notes` original que luego se reasignaba, así que el contexto se quedaba vacío
para siempre; y `deleteNoteBtn` no limpiaba `selectedNotesId`.
