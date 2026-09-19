# Arquitectura de ElNotas

El diseño y **sus por qués**. Se lee a demanda, no en cada sesión: `CLAUDE.md` tiene las
reglas y `TAREAS.md` lo pendiente; aquí está el razonamiento que las sostiene, para no
volver a discutirlo desde cero.

Incluye una **sección de conceptos desde cero** (§2) para quien sepa TypeScript pero no
arquitectura de front. Si algún término del resto del documento suena a jerga —reducer,
puerto, copia por camino—, está explicado ahí con ejemplos de notas y casillas.

> **Ojo al leer:** este documento describe **el diseño**, y no todo él está construido. Hoy
> lo están las **fases 1 y 2 enteras** y **todo el código de la Fase 3**: el paso 0,
> `FileStorageAdapter` con el formato en disco de §6.2 y **las dos implementaciones de
> `BlobStore`** (§5.1). La Fase 3 **no está terminada**: le falta el único punto de §9.9 que
> no es código —la pasada manual del punto 5, que necesita un navegador—. Siguen siendo sólo
> diseño la UI (§7) y todo lo que dependa de `platform/`. Cada sección dice si lo que describe
> existe o está planificado. Antes de dar algo por hecho, compruébalo contra el repo.

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
| **Tipos marcados** (`NoteId`, `PlanId`…) | no confundir un id con otro | pasas un `PlanId` donde va un `NoteId` y falla en runtime |
| **Unión discriminada** (`Content = Text \| CheckBox`) | tratar todos los casos | añades un tipo de bloque y nada te avisa de dónde falta |
| **`noUncheckedIndexedAccess`** | tratar el "ese id no existe" | `undefined` se cuela por un lookup en un estado normalizado |
| **Alias no declarado** (`#ui/*` no existe todavía) | el core no importa de fuera | una dependencia al revés pasa desapercibida |
| **`Result<T, E>`** en vez de excepciones (§6.5) | tratar el fallo de E/S | un `throw` sube sin tipo hasta arriba y nadie sabe que existe |

El sexto es el más curioso, porque no se diseñó: sale gratis de la regla "un alias se
declara cuando el módulo existe". Como `#ui/*` no está en el campo `imports`, importarlo
desde el core falla con un limpio *Cannot find module*.

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
`AppState`, y contiene todas las notas, todos los planes y todos los contextos:

```ts
interface AppState {
  readonly notes:    Readonly<Record<NoteId, Note>>
  readonly plans:    Readonly<Record<PlanId, Plan>>
  readonly contexts: Readonly<Record<ContextId, Context>>
}
```

Lo contrario —y lo que hace el prototipo viejo de `src/scripts/`— es tener los datos
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
forzando la escritura pendiente al cerrar —un `flush()` colgado de `beforeunload`—, que es
plataforma y por tanto Fase 4.

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
export type PlanId = Branded<string, "PlanId">
```

El problema que resuelve: con estado normalizado **todo** se referencia por id y todos los
ids son strings. Sin marcarlos, pasar un `PlanId` donde se espera un `NoteId` compila
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
│   ├── domain/    # ← modelo + Position + helper + las 8 operaciones + Result
│   │   └── errors/#   ← StorageError y MigrationError (§6.5). Sin index.ts
│   ├── ports/     # ← los CINCO: Clock, IdGenerator, Repository, StorageAdapter, BlobStore
│   ├── app/       # ← Action + reduce + Store + useCases + diffState
│   ├── migrations/# ← hydrate + runMigrations (la mitad PURA del arranque)
│   └── index.ts
├── storage/       # ← memory/ + file/ + blobs/ + writeBehind
│   └── blobs/     #   ← las implementaciones de BlobStore, que es OTRO puerto (§6.1)
├── ui/            # (F4) vanilla: componentes + render(state)
└── platform/      # (F4) composición
    └── web/       # el ÚNICO sitio que decide qué adaptador se inyecta

test/              # las pruebas, fuera de src/ y calcando su árbol (§8.5)
├── core/          # ← domain/ (+ errors/) · app/ · migrations/
└── storage/       # ← contract-tests/ · memory/ · file/ · blobs/
```

**`platform/` es la capa de composición**, y es una idea que conviene entender bien: es el
único sitio del proyecto que sabe *a la vez* qué puertos existen y qué implementaciones hay.
Todos los demás módulos conocen solo interfaces. Ahí es donde se decide "en web, el reloj es
`Date.now()` y el almacenamiento es `FileStorageAdapter` sobre `DirectoryHandleBlobStore`",
y se inyecta hacia dentro.

El beneficio se cobra cuando llegue el escritorio: aparece `platform/desktop/` al lado, con
sus propias decisiones de inyección, y **nada más se toca**.

**Reglas de import** (las hace cumplir el campo `imports`, §8.2):

- **Entre módulos**, siempre por el alias y contra el `index.ts`: `#core/index`.
- **Dentro de un módulo**, siempre relativo: `./domain/Note`.
- Un alias **se declara cuando el módulo existe**, no antes.

---

## 5. El dominio

Tres entidades, más nociones de agrupación:

- **Note** — lista de contenido heterogéneo (`Text` | `CheckBox`). Los checkboxes son
  **recursivos** (tienen hijos), para TODOs anidados.
- **Plan** — un **grafo** de nodos (`SimpleNode` | `NoteNode`) con posición X/Y y aristas
  por ID, para esquematizar tareas. Un `NoteNode` es el puente: al pincharlo entras en una
  Nota.
- **Context** — agrupa notas y planes, y decide su `defaultView` (la lista, o entrar directo
  a una nota o plan concreto).
- **ContextoGeneral** — **vista derivada** de todas las notas y planes. No es una entidad y
  no se persiste: guardarlo sería duplicar datos que se pueden calcular.
- **ContextoCompuesto** — unión de varios contextos. Sale casi gratis del modelo por
  referencias.
- **Ventanas** — navegación estilo app de móvil. Es **estado de vista, no de dominio**: va
  separado de `AppState`. Mezclarlo llenaría la persistencia de basura de UI y haría que
  abrir un menú marcara notas como sucias.

### 5.1 Lo que existe hoy en el repo

**Las fases 1 y 2 enteras y todo el código de la Fase 3: ~4240 líneas de código y ~4930 de
pruebas.** `npm run check` está en verde con **314 pruebas** (eran 274 al terminar el adaptador
de fichero y 232 al cerrar el paso 0). **Que el código esté no significa que la fase esté
terminada:** falta la pasada manual del punto 5 de §9.9. Esta tabla se queda desactualizada
sola: antes de afirmar nada sobre ella, `find src test -name '*.ts' | sort` y `npm run check`.

| Fichero | Líneas | Qué es |
|---|---|---|
| **`domain/` — el modelo** | | |
| `Ids.ts` | 50 | IDs marcados, `Revision` e `ItemRef` |
| `Content.ts` | 66 | `Text` \| `CheckBox`, *type guards* y constructores |
| `Versioned.ts` | 43 | `updatedAt` y `revision` |
| `Note.ts` · `Plan.ts` · `Context.ts` | 78 | Las tres entidades |
| `AppState.ts` | 32 | El estado raíz, normalizado |
| `Position.ts` | 46 | El vocabulario del "dónde", tres casos |
| `Result.ts` | 43 | El sobre: `ok` y `err`. **Fuera de `errors/` a propósito** |
| `errors/StorageError.ts` · `errors/MigrationError.ts` | 96 | Las dos taxonomías (§6.5). **La carpeta no lleva `index.ts`** |
| **`domain/` — la maquinaria** | | |
| `updateContent.ts` | 102 | Primitiva **A**: transformar un nodo. No sale por `index.ts` |
| `updateContainerOf.ts` | 93 | Primitiva **B**: transformar el contenedor de una línea. Tampoco |
| `operations.ts` | 363 | **Las ocho operaciones**, todas exportadas |
| **`ports/` — cinco interfaces, cero implementaciones** | | |
| `Clock.ts` · `IdGenerator.ts` | 66 | Fase 1 |
| `Repository.ts` · `StorageAdapter.ts` · `BlobStore.ts` | 263 | Fase 2, y **todos sus métodos devuelven `Result`** desde el paso 0 de la Fase 3 |
| **`app/` — la capa de aplicación** | | |
| `Action.ts` | 224 | **Las diecisiete acciones**: 8 de contenido, 3 de Nota, 6 de Contexto |
| `reduce.ts` | 307 | Los diecisiete casos. **No sale por `index.ts`** |
| `Store.ts` | 79 | Una **función**, no una clase |
| `useCases.ts` | 169 | La frontera entre lo impuro y lo puro |
| `diffState.ts` | 108 | La mitad **pura** del write-behind |
| `index.ts` | 139 | API pública del core |
| **`migrations/` — la mitad pura del arranque** | | |
| `hydrate.ts` | 67 | De listas a mapas, limpiando `ItemRef` rotas |
| `runMigrations.ts` | 139 | El runner, **puro y total**. `MIGRATIONS` **vacía a propósito** |
| **`src/storage/` — el primer módulo que implementa puertos** | | |
| `memory/MemoryStorageAdapter.ts` | 137 | Tres `Map` y un número. Una sola frontera con `try/catch`: `transaction` |
| `writeBehind.ts` | 258 | La mitad **impura**: debounce, temporizador y el estado *detenido* |
| **`src/storage/file/` — el adaptador de fichero** | | |
| `FileStorageAdapter.ts` | 499 | El formato en disco de §6.2, parametrizado por `BlobStore`. Tres fronteras con `try/catch`: `aBytes`, `parsear` y `transaction` |
| **`src/storage/blobs/` — las dos implementaciones de `BlobStore`** | | |
| `LocalStorageBlobStore.ts` | 320 · **108 sin comentarios** | Desarrollo y emergencia: espacio de nombres, base64 y la traducción de las excepciones de `localStorage`. Una frontera |
| `DirectoryHandleBlobStore.ts` | 415 · **156 sin comentarios** | La carpeta del usuario, y OPFS con otro handle. **Sin pruebas a propósito** (§6.3). Una frontera |
| **`test/storage/` — las pruebas de esa capa, que viven aparte (§8.5)** | | |
| `contract-tests/storageContract.ts` | 288 | **La suite que todo adaptador debe pasar**: 17 casos. **Sin `.test` en el nombre**: es una fábrica, no un fichero de pruebas |
| `file/FakeBlobStore.ts` | 167 | El doble **con inyección de fallos**, que es lo que permite verificar el adaptador entero en Node |
| `file/FileStorageAdapter.test.ts` | 26 | Engancha la suite de contratos. Tan corto como el de memoria |
| `file/FileStorageAdapter.errors.test.ts` | 345 | Lo que el contrato **no puede ver**: el esquema en disco y la traducción de errores |
| `blobs/FakeStorage.ts` | 121 | El `Storage` de mentira, **con inyección de excepciones**: es lo que permite probar la cuota sin llenar nada |
| `blobs/LocalStorageBlobStore.test.ts` | 266 | 22 pruebas: lo que ese fichero inventa por encima del puerto |
| `blobs/LocalStorageBlobStore.contract.test.ts` | 28 | **La tercera pasada del contrato** (§6.3): la pila entera sobre un `BlobStore` de producción |
| `blobs/VERIFICACION-MANUAL.md` · `verificacion-manual.html` | 198 · 150 | El procedimiento del punto 5 de §9.9 y el andamio para ejecutarlo. **No es TypeScript y no entra en `npm run check`** |

Las pruebas son ~4930 de esas líneas, más que el código que vigilan, y eso es lo esperado en
una capa donde cada invariante se verifica rompiéndola a propósito. Desde que viven en `test/`
(§8.5) la cuenta es además directa: `src/` es código y `test/` son pruebas, sin tener que
separar por el sufijo del nombre.

**Dos columnas de líneas sólo en `blobs/`, y no es un capricho:** en esos dos ficheros la
proporción de comentario es altísima —son los que hablan con navegadores de verdad— y la cifra
que decide algo es **la de código**, porque es la que mide cuánto queda sin probar (§6.3).

### 5.2 Estado normalizado, con referencias por ID

Las entidades **no se anidan** unas dentro de otras. `AppState` es plano, como una mini base
de datos, y los contextos guardan **referencias**:

```ts
export type ItemRef =
  | { readonly kind: "note"; readonly id: NoteId }
  | { readonly kind: "plan"; readonly id: PlanId }
```

`Context.items` es `ItemRef[]`, **nunca** `(Note | Plan)[]`. Tres razones independientes,
cada una suficiente por sí sola:

1. **Una nota puede estar en varios contextos.** Con entidades embebidas, cada nota vive
   dentro de un contexto y solo uno — lo que hace imposible el ContextoCompuesto.
2. **Guardar un contexto no reescribe sus notas.** Con las entidades dentro, cualquier
   adaptador de persistencia serio queda condenado a leer y escribir el árbol entero.
3. **`ItemRef` es discriminable en runtime.** `Note` y `Plan` son ambos `{ id, name, ... }`:
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
suyo con su tipo propio (`NoteId`, `PlanId`, `ContextId`).

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
si valiera, valdría igual para `schemaVersion`, que sí se aplaza a la Fase 2. Está anotado en
`TAREAS.md` para reescribir la justificación real.

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

Los dos del criterio de §9.5, con `assert.strictEqual`:

1. `updateContent(c, idQueNoExiste, …)` **`=== c`** — el array de entrada, no una copia.
2. `updateContent(c, idQueSíExiste, { onCheckBox: x => x, … })` **`=== c`** — el que se olvida.

Y el tercero, en positivo, que es el que demuestra de verdad la copia por camino: sobre el
árbol de la compra de §2.3, tras marcar `"Peras"`, comprobar que `"Limpieza"` **sigue siendo
el mismo objeto** y que `content`, `"Fruta"` y `"Peras"` son nuevos. Tres objetos nuevos, ni
uno más.

---

## 6. Persistencia

**Construido: los puertos, el adaptador de memoria, el write-behind, el `Result` (§6.5),
`FileStorageAdapter` con el formato en disco de §6.2 y las dos implementaciones de `BlobStore`
(§6.1).** Sigue siendo sólo diseño la semántica multi-backend —espejo, outbox, réplicas—. La
pasada manual que el punto 5 de §9.9 exige **está hecha** (2026-09-13, Brave y Firefox), así que
`DirectoryHandleBlobStore` ya se ha visto correr contra una carpeta de verdad y **la Fase 3 está
terminada**.

#### El recorrido de un cambio, de un vistazo

El mapa de la sección: qué le pasa a un cambio desde que el usuario toca algo hasta que llega
al disco. Lo que viene después de aquí son los detalles de cada tramo.

**Antes del dibujo, lo que el dibujo no puede decir: esta cadena no la monta nadie en
producción.** Cada pieza existe y encaja con la siguiente, pero quien las enchufa —quien
suscribe el escritor al `Store` y elige adaptador— es `platform/`, que no nace hasta la Fase 4
(§9.7). Hoy el único sitio del repo donde está montada entera es una prueba,
`test/storage/chain.test.ts`.

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
        │   put     notes · plans · contexts     ← primero TODO lo que se guarda
        │   delete  notes · plans · contexts     ← después lo que se borra
        │
        ├── err io ──────→ pendiente se conserva · escrito NO avanza  →  REINTENTA
        ├── err lo demás ─→ detenido = error · cancela la espera      →  SE DETIENE (sin vuelta atrás)
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
es programar la espera. Nada de lo pendiente se pierde: se queda en memoria, esperando a un
reanudar que hoy no existe.

**El cambio baja; el error sube.** El segundo dibujo contesta otra pregunta —dónde nace cada
error— porque es donde más se lee mal el reparto de §6.1:

```
                                  QUÉ INVENTA                        try/catch
  ─────────────────────────────────────────────────────────────────────────────
  writeBehind                nada: sólo pregunta «¿kind === io?»         0
        ▲
        │  Result<…, StorageError>, con el kind INTACTO: nadie reempaqueta
        │
  StorageAdapter
   ├─ MemoryStorageAdapter    nada — un Map no falla                      1  transaction
   │                          (su único io es un fn ajeno que lanzó)
   └─ FileStorageAdapter      la SERIALIZACIÓN → corrupt                  3  aBytes
        ▲                     (y un io si JSON.stringify fallara)            parsear
        │  Result                                                            transaction
        │
      BlobStore
       ├─ LocalStorageBlobStore      quota-exceeded · permission-denied   1  frontera
       │                             · io · corrupt (su propio base64)
       └─ DirectoryHandleBlobStore   permission-denied · not-found        1  frontera
                                     · quota-exceeded · io
                                     (corrupt nunca: no parsea nada)
  ══════════════ LA FRONTERA · por encima de aquí no lanza nadie ══════════════
  la plataforma              localStorage · File System Access API: LANZAN
```

**Las fronteras del dibujo son todas las que hay**, medido en el código de producción de
`core/` y `storage/`: **ocho `try`, cero `throw`** —eran seis hasta que se taparon dos fugas,
ver más abajo—. Qué significa cada `kind` y por qué son esos
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
  readonly plans:    Repository<Plan, PlanId>
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
bytes.** Un único `FileStorageAdapter` parametrizado por `BlobStore` da cuatro backends:

| Objetivo | Implementación | Estado |
|---|---|---|
| Desarrollo / fallback | `LocalStorageBlobStore` | **construida**, 108 líneas de código, 22 pruebas |
| Fichero local en disco | `DirectoryHandleBlobStore` con `showDirectoryPicker()` (Chromium) | **construida**, 156 líneas, sin pruebas a propósito (§6.3) |
| Fallback otros navegadores | el **mismo** `DirectoryHandleBlobStore` con OPFS | el código está; sólo cambia quién le pasa el handle |
| Drive (más adelante) | `DriveBlobStore` | fuera de alcance (`TAREAS.md`) |

La File System Access API y OPFS exponen el mismo `FileSystemDirectoryHandle`: solo cambia
**cómo obtienes el handle**, no la implementación.

**Las dos reciben por constructor lo que las ata a la plataforma** —un `Storage`, un
`FileSystemDirectoryHandle`—, y eso no es comodidad para las pruebas: **conseguir esa cosa es
composición**, y la composición vive en `platform/` (Fase 4, §9.7). Que salga gratis poder
montarlas en Node con un objeto falso es la consecuencia, no el motivo.

**Y viven en `src/storage/blobs/`, no dentro de `file/`.** La razón es justamente el reparto de
esta sección: `memory/` y `file/` nombran **formas de guardar entidades**, o sea
implementaciones de `StorageAdapter`. `BlobStore` es **otro puerto**, y no está debajo de
`Repository` sino que es **un parámetro** de `FileStorageAdapter`. Meterlas en `file/` diría que
son parte del adaptador de ficheros; `blobs/` nombra el puerto que implementan, que es lo único
que `localStorage`, la carpeta del usuario y el futuro Drive tienen en común.

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
├── plans    ──→ Map<PlanId, Plan>           ├── plans    ─┼─→ serializa a JSON
├── contexts ──→ Map<ContextId, Context>     ├── contexts ─┘   y traduce id → camino
└── schemaVersion ──→ un number              └── schemaVersion       │
                                                                     ▼
    (ni rastro de BlobStore)                                    BlobStore
                                                                     │
                                                  ┌──────────────────┼─────────────┐
                                                  ▼                  ▼             ▼
                                            localStorage     carpeta / OPFS      Drive
```

**Cada capa habla un idioma distinto, y la traducción ocurre en un solo sitio:**

| Capa | Su vocabulario | Ejemplo |
|---|---|---|
| `StorageAdapter` / `Repository` | entidades e ids | `notes.put(unaNota)` |
| ⇅ **`FileStorageAdapter`** | *aquí y sólo aquí* se traduce | `Note` → JSON → bytes, y `NoteId` → `"notes/<id>.json"` |
| `BlobStore` | caminos y bytes | `write("notes/abc.json", <bytes>)` |

Que el esquema `notes/<id>.json` viva en **un único fichero** del proyecto es el beneficio
entero del reparto: cambiarlo, o pasar de JSON a otro formato, toca ahí y en ningún otro lado,
y los cuatro `BlobStore` ni se enteran.

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
pequeños y conflictos por nota en vez de globales. **Construido**, en
`src/storage/file/FileStorageAdapter.ts`, que es el único fichero del proyecto donde aparece
este esquema: cambiarlo —o dejar JSON por otro formato— se toca ahí y en ningún sitio más.

```
manifest.json          { "schemaVersion": 1 }
notes/<id>.json        una Note
plans/<id>.json        un Plan
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
  tenga que mirar dentro de los planes para descartarlos.

**Un agujero conocido, y anotado en `TAREAS.md` en vez de tapado:** al leer sólo se comprueba
que lo parseado sea un objeto con un `id` de texto. Un `notes/x.json` con un `content`
inventado se acepta y entra en `AppState` tal cual. Validar campo a campo **es un validador, no
una frontera**, no hay hoy nada en el repo que lo haga y escribirlo a mano para tres entidades
recursivas es una pieza con entidad propia. Queda dicho para que nadie lo dé por cubierto: lo
que hay es una comprobación de forma mínima, no una validación de esquema.

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

**Decidida, no construida:** espejo con **el fichero local siempre
como primario y fuente de verdad**. Los backends remotos son réplicas alimentadas por un
**outbox durable** con reintentos, para que la app nunca se bloquee porque la red o un token
fallen. El estado de sincronización es **dato persistido**, no estado en memoria.

**La config de storage no puede vivir en el storage que configura.** Necesita su propio sitio
aparte (`settings.json` o localStorage), o tienes un huevo-y-gallina al arrancar.

**Nada de credenciales en el repo ni en el bundle.** En web, OAuth con PKCE y token en
memoria, **nunca** en localStorage. En escritorio, keychain del sistema.

#### Las dos decisiones propias de `LocalStorageBlobStore`

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

**Hoy corre TRES veces en cada `npm test`**, no dos, que es lo que anticipaba el punto 7 de
§9.9. Son **17 casos**, así que 51 de las pruebas salen de aquí:

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

**Corrección de una cifra que se repetía aquí y en §9.9: son 156 líneas de código, no ~50.**
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

**Decisión cerrada, y CONSTRUIDA** — es el paso 0 de la Fase 3, terminado. Se aplicó **antes**
del adaptador de fichero (el porqué del momento, al final de la sección).

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

#### El punto de partida era bueno, y eso hizo el cambio barato

Medido sobre el repo, no supuesto. **Había tres `throw` en todo el código de producción**, y
ninguno en `src/core/domain/`. **Hoy no queda ninguno vivo:**

| Dónde estaba | Qué era | En qué quedó |
|---|---|---|
| `core/migrations/runMigrations.ts` | lo guardado es de un esquema **más nuevo** que el que este código entiende | `err({ kind: "schema-from-future", … })` |
| `core/migrations/runMigrations.ts` | falta un paso de migración en la cadena | `err({ kind: "missing-migration", … })` |
| `storage/writeBehind.ts` | **no creaba un error: lo relanzaba.** Restauraba `pendiente` y propagaba | el `Result` del adaptador, devuelto **intacto** por `flush()` |

⚠️ **Y contar `throw` era la medida equivocada, cosa que se descubrió más tarde.** Cuenta lo que
lanzamos nosotros; no cuenta **lo que llamamos sin envolver**, que es por donde se escapaban de
verdad dos excepciones con cero `throw` en el repo: `encodeURIComponent` dentro de `caminoDe` y
`paso.migrate()` en el runner. Las dos están tapadas y las vigila `npm run check:fronteras`.

Los `try/catch` que quedan en el código de producción están todos donde manda el principio 2 de
más abajo: **la frontera del adaptador**. En `MemoryStorageAdapter` es una sola —la de
`transaction`, que es lo único de ese fichero que ejecuta código ajeno—; en
`FileStorageAdapter` son cuatro, y las cuatro se justifican solas: `transaction` por lo mismo,
`caminoDe` porque `encodeURIComponent` lanza, y las
dos de la serialización, porque `JSON.parse` lanza y un `TextDecoder` con `fatal: true` también.

Y **cero aserciones no-nulas** (`algo!.campo`) en el código, así que tampoco había excepciones
implícitas esperando su turno.

Que hubiera tan poco no es suerte: **el dominio no puede fallar por diseño.** La regla «una
operación que no aplica NO HACE NADA» (§9.3) eliminó el caso de error en vez de tiparlo, y el
reducer es **total** por contrato. Por eso el único sitio del core que lanzaba era
`runMigrations` — ahí dentro no había nada más que convertir.

También conviene deshacer un malentendido sobre el `catch`. Con `strict` va activo
`useUnknownInCatchVariables`, así que hoy `catch (fallo)` ya recibe **`unknown`**: no es que al
error le falte el tipo en la firma, es que **no existe en ninguna parte**. Tipar el `catch` no
arreglaría nada; hay que mover el fallo al valor de retorno.

#### El argumento que decidió: se reintentaba a ciegas

`writeBehind` no distinguía por qué había fallado una escritura, así que **reintentaba
siempre**. Si el usuario revocaba el permiso de la carpeta, la app se pasaba la sesión entera
reintentando en silencio, sin conseguirlo jamás y sin poder avisar de nada. No era un fallo de
implementación: con `Promise<void>` **no hay dónde poner esa información**, porque el valor de
retorno no tiene sitio para ella. Qué hace ahora, en «El estado *detenido*», más abajo.

#### La taxonomía: el criterio es «¿reintentar sirve de algo?»

Aquí está la razón de que sean casos separados y no un error genérico. La pregunta que decide
**no es qué mensaje sale en pantalla**, sino qué puede hacer el programa a continuación:

| Caso | ¿Reintentar? | Qué hace la app |
|---|---|---|
| `permission-denied` — el permiso de la carpeta ya no vale | **no** | vuelve a pedir la carpeta. Lo no guardado sigue en memoria: no se pierde |
| `not-found` — la carpeta o el fichero han desaparecido | **no** | avisa de que la carpeta ya no existe y ofrece elegir otra |
| `quota-exceeded` — disco lleno o cuota excedida | **no** | deja de intentarlo y avisa de que hay que hacer hueco |
| `corrupt` — el contenido de un fichero no se entiende | **no** | **aísla esa entidad y sigue con el resto**, diciendo cuál |
| `io` — cualquier otra cosa | **sí** | reintenta en silencio; si persiste, avisa |

```ts
export type StorageError =
  | { readonly kind: "permission-denied" }
  | { readonly kind: "not-found";  readonly path: string }
  | { readonly kind: "quota-exceeded" }
  | { readonly kind: "corrupt";    readonly path: string; readonly cause: unknown }
  | { readonly kind: "io";         readonly cause: unknown }

export type MigrationError =
  | { readonly kind: "schema-from-future"; readonly stored: number; readonly supported: number }
  | { readonly kind: "missing-migration";  readonly from: number }
  | { readonly kind: "migration-failed";   readonly from: number; readonly cause: unknown }
```

**El tercero de `MigrationError` llegó después, y por un agujero medido.** Los dos primeros
describen cosas que el runner comprueba **antes** de tocar nada; `migration-failed` describe lo
único que no controla: **`migrate` es código ajeno**, lo escribe quien migra y trabaja sobre
datos con forma vieja. Hasta que se envolvió, una migración que lanzara **se escapaba de
`runMigrations` como excepción** —comprobado con una sonda—, justo desde la función que esta
sección llama *pura y total*. No era alcanzable en producción sólo porque `MIGRATIONS` está
vacía; la primera migración de verdad es exactamente este caso, y corre **al arrancar la app
sobre las notas del usuario**.

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
en cada lectura, en el fichero que no tiene pruebas, para un caso que la Fase 4 va a tener que
tratar igualmente con el botón de reconectar la carpeta.

#### ⚠️ La contradicción de `getAll`: aceptada a conciencia y aplazada a la Fase 4

La tabla de arriba dice que ante un `corrupt` la app **aísla esa entidad y sigue con el resto,
diciendo cuál**. Eso es lo que justifica que `corrupt` no viva dentro de `io`. **Y hoy el código
no lo hace:** `FileStorageAdapter.getAll` corta al primer fichero ilegible y devuelve el error
con el `path` del culpable, así que **una sola nota corrupta impide abrir la app** — justo el
«creer que las has perdido todas» que la taxonomía existe para evitar.

Esto no es un descuido, es una decisión del usuario, y se documenta con su porqué completo
porque una contradicción sin explicar se lee como un olvido. Sale de que la firma del puerto es
`Result<ReadonlyArray<T>, StorageError>`, o sea **todo o nada**: no hay dónde poner «estas nueve
notas, y esta décima está rota». Las dos salidas obvias son peores:

- **saltarse la entidad corrupta en silencio** devolvería nueve notas como si fueran todas. Un
  contexto que listara la décima se quedaría con una `ItemRef` apuntando a nada, lo que **rompe
  la integridad referencial**; y peor: el write-behind vería esa nota como **borrada** y acabaría
  limpiándola de los contextos, **convirtiendo un fichero recuperable en una pérdida de verdad**;
- **cambiar la firma de `getAll`** es deshacer lo que el paso 0 acaba de estabilizar, y ahora
  además con un adaptador escrito encima.

**El arreglo bueno, que no toca el puerto: un `onCorrupt` en las dependencias de este adaptador**
—saltar la entidad y avisar de cuál—. Va en **el mismo paquete que el `onError` del
write-behind** y se aplaza por el mismo motivo de siempre: hoy no hay a quién avisar, y aquí no
se construye lo que no tiene consumidor. Anotado en `TAREAS.md`, al lado del `onError`.

La prueba que fija este comportamiento está marcada con ⚠️ en
`FileStorageAdapter.errors.test.ts`, para que el día que la decisión cambie **se vea en el
diff** en vez de descubrirse por el camino.

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
a pedir la carpeta», y pedir una carpeta es plataforma: Fase 4. Consecuencia asumida y visible:
hoy un `permission-denied` deja el write-behind muerto para el resto de la sesión. Se prefiere
a la alternativa —reintentar en bucle— porque al menos así el error sale por `flush()` en vez
de desaparecer.

**Y desapareció el `catch` de la cola de escrituras**, que no es una limpieza cosmética: un
fallo es ahora un **valor**, así que ya no puede envenenar las escrituras futuras rechazando la
promesa que las encadena. Si algo llegara a rechazar ahí sería un adaptador incumpliendo su
puerto, y eso tiene que hacer ruido en vez de quedar perdonado.

**Qué falta, y está anotado en `TAREAS.md`:** cuando falla un flush **automático** —el del
temporizador— nadie mira su resultado, así que entre el fallo y la siguiente llamada manual a
`flush()` no se entera nadie. La solución es un `onError` en las dependencias del escritor, y
espera a la Fase 4 por el motivo de siempre: hoy no hay UI a la que avisar.

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

#### Por qué antes y no después del adaptador de fichero

Dos razones, las dos de coste, y las dos se confirmaron al hacerlo:

- **El adaptador de fichero es lo primero que falla de verdad.** El de memoria no tiene permisos
  que revocar ni disco que llenar; el de fichero tiene las dos cosas. Escribirlo contra las
  firmas viejas y convertirlo después habría sido escribirlo dos veces.
- **La suite de contratos cambia con los puertos, y había UN adaptador.** Después de la Fase 3
  habría dos, y el contrato es precisamente lo que ambos comparten. A partir de aquí
  `FileStorageAdapter` la reusa **sin tocarla**.

#### Lo que queda abierto: la escritura condicional

Falta un caso que **va a hacer falta y hoy no se puede escribir**: dos pestañas abiertas sobre
la misma nota, y la segunda pisando lo que guardó la primera. El modelo ya tiene la pieza para
detectarlo —`revision` existe justo para eso (§5.3)— pero el mecanismo de «escribe sólo si
nadie lo ha tocado» **no está construido**: `Repository.put` no recibe revisión.

Añadir hoy un caso de error para eso sería inventar un aviso que nadie puede disparar, y choca
con la regla del proyecto de no construir lo que no tiene consumidor. Queda anotado en
`TAREAS.md` → *Sin decidir* como **lo primero que se añadirá a `StorageError`** el día que el
mecanismo exista.

---

## 7. La UI

**Nada de esta sección está construido.** Es diseño para la Fase 4, y es el corazón de la
app.

Sin framework, vanilla. El core expone reducers puros y un `Store`; la UI se suscribe y
despacha. La inmutabilidad da la detección de cambios gratis por referencia (§3).

Dos reglas que evitan el dolor conocido de este enfoque:

1. **Reconciliación por `data-id`**, no re-render ciego de listas. Cada bloque de contenido
   lleva su `id` en el DOM, y por eso `Text` y `CheckBox` tienen `id` en el modelo.
2. **El nodo que tiene el foco no se re-renderiza.** Con `contenteditable`, un re-render
   completo te borra el cursor a mitad de escribir. Mientras un nodo está enfocado **el DOM
   es la fuente de verdad**, y se hace `dispatch` en `blur` o con debounce.

La persistencia se engancha como **suscriptor con write-behind y debounce**, escribiendo solo
las entidades marcadas como sucias. Nunca guardar en cada tecla.

El CSS del prototipo se reutiliza casi tal cual.

### 7.1 Tres clases de estado, no dos

Es la distinción que más fácil se pasa por alto, y la que decide dónde acaba viviendo cada
cosa:

| | Qué es | Cada cuánto se cambia | Dónde vive |
|---|---|---|---|
| **Contenido** | las líneas, las casillas, lo marcado | constantemente | dentro de la nota, persistido |
| **Modo de escritura** | cómo se comporta el teclado ahora mismo | **muchas veces mientras escribes una sola nota** | en el editor, en memoria, **sin persistir** |
| **Ajustes** | tema, dónde se guarda el fichero, tamaño de letra | una vez y te olvidas | pantalla de ajustes, aparte |

La fila del medio es la que no existía en este diseño hasta que apareció `ModosEscritura`. Y
la trampa está en confundirla con la tercera: **un ajuste se busca en un menú y se cambia una
vez al año; el modo de escritura se pulsa veinte veces haciendo la lista de la compra.** Si se
trata como ajuste, acaba escondido en una pantalla de ajustes y es inservible. Se parece mucho
más al pincel de una aplicación de dibujo que al control de brillo.

### 7.2 `ModosEscritura`: el objeto auxiliar de la nota abierta

Un selector con **tres estados en ciclo**, siempre a la vista mientras editas:

```
Texto  →  Casilla  →  Casilla hija  →  Texto  →  ...
```

Los tres tienen nombre propio a propósito: ninguno es "desactivado". Un interruptor con un
apagado y dos encendidos obliga al usuario a preguntarse qué significa el apagado; tres
herramientas con nombre, no.

**Es un objeto auxiliar de la nota abierta, y es deliberadamente desechable:**

- **nace al abrir la nota y muere al salir de ella.** No hay un modo "de la aplicación": cada
  nota que abres empieza en *Texto*;
- **no se persiste, y perder sus datos no tiene consecuencias.** El usuario ve en qué modo
  está y lo cambia de un toque, así que no hay nada que recuperar;
- por tanto **no hace falta ningún sitio donde guardar preferencias**. La persistencia (§6)
  sigue siendo solo notas, sin un fichero de ajustes que no existía.

Que sea por nota y no global no es un detalle: **un modo global te arrastraría el modo
*Casilla* de la lista de la compra hasta la entrada del diario**, y te nacerían casillas en
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

> **Nombre pendiente de un detalle.** `ModosEscritura` es el nombre del **concepto**, y como
> tal se usa en esta documentación. El identificador en el código está sin fijar: todo lo
> demás está en inglés (`Note`, `CheckBox`, `AppState`), así que lo coherente sería
> `WritingMode` —y en singular, porque lo que el editor guarda es **un** modo activo, no el
> conjunto—. Cambiar la convención y pasar el código nuevo a castellano también es defendible,
> pero entonces se decide una vez y para todo.

**Qué más cabe en esa barra, y qué no.** La regla: cabe si cambia el comportamiento mientras
escribes o mientras miras. Candidatos que ya se ven —**"al marcar una casilla, marcar también
sus hijas"** (y aquí es exactamente donde se compone esa cascada que el dominio se niega a
hacer, §9.3), **"esconder las marcadas"**, **"mandar las marcadas al final"**—. No cabe lo que
es contenido (el nombre de la nota) ni lo que es ajuste de la aplicación.

### 7.3 El teclado: Intro construye, el Tabulador no

**Intro es quien crea la línea siguiente**, y el modo activo decide de qué clase es:

| Modo | Al pulsar Intro nace… | `Position` que usa el editor |
|---|---|---|
| **Texto** | otra línea de texto | `root-end` |
| **Casilla** | una casilla **hermana**, al mismo nivel | `after` |
| **Casilla hija** | una casilla **hija**, un nivel dentro | `last-child-of` |

**Con el cursor en medio de una línea, Intro la parte** (`split`): la primera mitad se queda y
la segunda se va a la línea nueva, que nace de la clase que diga el modo.

**El Tabulador solo mete un carácter de tabulación** dentro de la línea. No mueve nada, no
anida nada, no convierte nada: es texto, como en cualquier editor.

#### Retroceso al principio: dos pulsaciones, dos cosas distintas

Aquí colisionan dos comportamientos que se quieren la misma tecla en la misma posición: quitar
la casilla, y unir con la línea de arriba. **Se resuelve en secuencia**, no eligiendo uno:

| Cursor | La línea es… | Retroceso hace… | Operación |
|---|---|---|---|
| al principio del todo | una **casilla de la raíz** | se va la casilla, la línea queda como texto | `convertToText` |
| al principio del todo | una **casilla anidada** | se une directamente: el texto sube a la hermana anterior, o a la madre si es la primera hija | `merge` |
| al principio del todo | un **texto** | se une con la de arriba | `merge` |
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

#### El botón de modo no solo elige: también actúa sobre la línea actual

`ModosEscritura` no es un interruptor pasivo que solo afecte a las líneas futuras. **Al
pulsarlo, la línea donde estás cambia en el momento**, y lo que pasa depende de dónde tengas
el cursor:

| Estás en… | Al llegar a *Casilla* pasa… |
|---|---|
| un texto, cursor **al principio** | la línea entera se convierte en casilla |
| un texto, cursor **en medio** | la línea **se parte** y la segunda mitad nace como casilla |
| una **casilla** | nada: ya es una casilla |

El caso de en medio es el que pediste explícitamente:

```
Leche |y pan          Leche
              →       ☐ y pan
```

Y no necesita ninguna operación nueva: es **`split` y luego `convertToCheckBox`**, dos
llamadas que compone el editor. El motor sigue sin saber que los modos existen.

> **Propuesto, pendiente de confirmar.** Cuatro esquinas que el diseño de arriba deja sin
> cubrir, con lo que haría falta que fuera:
> - **Cursor al final de la línea** al pulsar el botón de modo → la línea se parte igual, y
>   nace debajo una casilla vacía. Es lo útil cuando acabas un párrafo y empiezas una lista.
> - **Ir de *Casilla* a *Texto*** con el botón, estando en una casilla → la casilla se
>   convierte en texto, por simetría con lo que hace Retroceso.
> - **Unir dos textos normales** (`merge` sin ninguna casilla de por medio) → funciona, como
>   en cualquier editor. Tu frase *"si estamos en una casilla o encima nuestra hay una"* sonaba
>   a restringirlo, y creo que no hace falta restringir nada.
> - **Partir una casilla que tiene hijas** → las hijas se quedan con la **primera** mitad, que
>   es la que conserva su identidad. `split` no destruye nada, así que se permite.

**Y por eso no existen `indent` ni `outdent`** — el motivo está en §9.3. El nivel de una línea
se elige **al nacer**, con el modo activo en ese momento.

> **Sin cerrar.** En modo *Casilla hija*, si cada Intro creara una hija de la línea actual,
> irías bajando un escalón por pulsación y sin `outdent` no habría forma de volver a subir. La
> regla tiene que ser que **el modo baja un nivel una sola vez** y a partir de ahí las
> siguientes son hermanas en ese nivel nuevo, pero está pendiente de confirmar, igual que qué
> hace exactamente el botón para bajar un segundo nivel.

---

## 8. La infraestructura

Esta sección **sí está construida** (Fase 0, commiteada).

### 8.1 Los cuatro tsconfig

La razón de fondo cabe en una frase: **`lib` y `types` se aplican por invocación de `tsc`, no
por fichero.** En el momento en que se decidió que el core no viera el DOM pero la UI sí,
quedaron garantizadas al menos dos configuraciones. Las otras dos son economía y los tests.

| Fichero | Para qué |
|---|---|
| `tsconfig.base.json` | opciones comunes. **Sin `paths` ni `baseUrl`** |
| `tsconfig.json` | la app: `include: ["src"]`, con `DOM` |
| `src/core/tsconfig.json` | **la verja de pureza**: `lib: ["ES2020"]`, `types: []` |
| `tsconfig.test.json` | compila `src/` **y `test/`** a `tmp-test/` con tipos de Node |

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

Lo que la verja **no** cubre: que el core no importe de `ui/` o `storage/` hoy se sostiene
porque esos alias aún no están declarados. Cuando existan, seguirá pillando el caso real —la
UI usa DOM, así que arrastrarla al core rompe el typecheck— pero el mensaje de error será
menos claro que un limpio *Cannot find module*.

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
  escriben el mismo `#core/index` que escribiría la UI.

### 8.3 Tests: el runner nativo de Node

`node:test` + `node:assert/strict`, sin runner externo. Node 20 no ejecuta TypeScript, así que
`npm test` hace dos cosas: compila `src/` y `test/` a `tmp-test/` (CommonJS) y lanza
`node --conditions=compiled --test tmp-test/test`.

`tsconfig.test.json` usa `module: "nodenext"` en lugar del `ESNext` de la app, por un motivo
práctico: como `package.json` no declara `"type": "module"`, ese ajuste emite CommonJS, y
CommonJS resuelve imports relativos sin extensión. Con ESM habría que escribir `./Note.js` en
el fuente TypeScript, que es un peaje que no merece la pena pagar en los tests.

Es más lento que un runner dedicado y no tiene watch mode; es el precio elegido a cambio de
cero dependencias. Se evaluó vitest y se descartó: ~64M en disco para algo que Node ya trae.

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
—`typescript`, `@types/node` y el `undici-types` que éste arrastra—, 27M y 0 vulnerabilidades**.
Toda la cadena de `webpack-dev-server` era la que traía esas 12. Si cuentas carpetas de
`node_modules` te saldrán diecisiete: son directorios vacíos que dejaron las desinstalaciones.
La cifra buena está en `package-lock.json`.

### 8.5 Dónde viven las pruebas: `test/`, espejo de `src/`

Hasta aquí cada prueba vivía al lado de su fichero (`operations.ts` y `operations.test.ts`,
hermanos). Ahora viven todas en `test/`, en un árbol que **calca** el de `src/`:

```
test/
├── core/
│   ├── domain/      # + errors/
│   ├── app/
│   └── migrations/
└── storage/
    ├── contract-tests/
    ├── memory/
    ├── file/
    └── blobs/       # incluye VERIFICACION-MANUAL.md
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

---

## 9. El plan por fases, razonado

### 9.1 La frontera entre la Fase 1 y la Fase 2 es `Versioned`

Antes el reparto era una lista de tareas sin criterio, y se contradecía a sí mismo: la tabla
de carpetas ponía los reducers en la Fase 2 y el plan por fases los ponía en la Fase 1. La
regla que lo resuelve:

> **Fase 1 = todo lo que opera por debajo de `Versioned`.** Funciones cuya entrada y salida
> son *contenido* (`Text | CheckBox`), nunca una entidad.

El razonamiento: producir una entidad nueva obliga a estampar `updatedAt` y `revision`, y eso
obliga a tener los puertos y a alguien que los inyecte. Una operación de contenido no toca
`Versioned`, así que no depende de nada: se escribe y se testea sola, array de entrada, array
de salida.

**Un matiz que es fácil documentar mal.** El motivo por el que el reducer *completo* no cabe
en la Fase 1 **no es que falten los puertos**: los puertos son cuatro líneas de interfaz y se
adelantan sin coste. El motivo real es la **superficie**. La superficie de un reducer es *el
comportamiento entero de la aplicación*: escribirlo completo exige haber decidido antes cada
acción que existe (crear nota, borrar, renombrar, meter en un contexto, cambiar
`defaultView`…), y eso es un catálogo de producto, no un problema de árboles. La superficie
de una operación de contenido es un array.

De ahí el reparto: la Fase 1 se lleva un reducer de **un solo caso**, como prueba de que la
cadena funciona de punta a punta; el catálogo entero es Fase 2.

### 9.2 Las fases

- **Fase 0 — Andamiaje. ✅ HECHA.** Alias por campo `imports`, verja de pureza, tests con
  `node:test`, y limpieza de los restos del prototipo.

- **Fase 1 — Dominio puro. ✅ HECHA.** El helper con sus dos primitivas, `Position`, las ocho
  operaciones (§9.3), los puertos `Clock` e `IdGenerator` y la rebanada vertical. Los seis
  puntos del criterio de cierre (§9.5), cumplidos, con 99 pruebas. La rebanada fue lo que
  verificó la cadena de identidad de punta a punta **antes** de escribir las otras siete
  operaciones: la alternativa —escribirlas todas y enchufarlas al final— habría descubierto un
  fallo de identidad cuando ya hubiera ocho sitios donde pudiera estar.

- **Fase 2 — Acciones, persistencia y memory. ✅ HECHA.** Los seis puntos del criterio de
  cierre (§9.8), cumplidos, con 216 pruebas al cerrarla: los tres puertos (§6.1),
  `MemoryStorageAdapter` y su suite de contratos (§6.3), el write-behind en sus **dos** piezas
  (§6.4), **las diecisiete acciones** (§9.7) y la mitad pura del arranque.

  **Se atacó de abajo arriba, no de arriba abajo:** primero la persistencia entera verificada
  con la única acción que ya existía, y sólo después las quince que faltaban. Mismo
  razonamiento que la rebanada vertical de la Fase 1 — el write-behind era la única pieza con
  riesgo real de la fase, y se quería descubrir que escribe de más **con un solo candidato**,
  no con diecisiete. Valió la pena: la rotura que comprobaba ese corte no tumbaba **ninguna**
  prueba hasta que se añadió un contador de transacciones, y eso se vio con una acción en el
  catálogo en vez de con diecisiete.

- **Fase 3 — Fichero local. ✅ HECHA.** Los siete puntos de §9.9, cumplidos, con **314 pruebas**.
  Hechos el **paso 0** —`Result<T, E>`, las dos taxonomías en `domain/errors/`, los once métodos
  de puerto, `runMigrations` ya total, `MemoryStorageAdapter`, el write-behind con su estado
  *detenido* y la suite de contratos (§6.5), con **232 pruebas** en ese punto—,
  **`FileStorageAdapter`** con el formato en disco de §6.2 —pasa la suite **sin tocarla** y lleva
  su propio fichero para lo que el contrato no puede ver (§6.3), **274 pruebas**— y **las dos
  implementaciones de `BlobStore`**, en `src/storage/blobs/`: **314 pruebas**, y el contrato
  corriendo **tres** veces. **Y el punto 5, que era lo único que no es código: la lista de
  verificación manual, ejecutada el 2026-09-13** en Brave —las cinco secciones pasan— y en
  Firefox, que anota que sin `showDirectoryPicker()` cuatro de ellas no se pueden probar ahí.
  **Cuándo se da por terminada: §9.9**, escrito antes de que el adaptador exista. Ojo al detalle
  de UX: al recargar
  **no se puede recuperar el permiso de la carpeta en silencio** — el handle se guarda en
  IndexedDB, pero volver a pedir permiso exige un gesto del usuario (botón de "reconectar
  carpeta"). Y ojo a la consecuencia, que ahora tiene nombre: mientras ese botón no exista, un
  `permission-denied` **detiene el write-behind sin vuelta atrás** hasta recargar.

- **Fase 4 — UI.** `render(state)`, reconciliación, el editor de contenido con checkboxes
  anidados (§7) y, con él, `src/platform/web/` con las implementaciones reales de `Clock` e
  `IdGenerator`.

### 9.3 Las operaciones de contenido

La lista ha cambiado dos veces y conviene ver el vaivén, porque explica por qué el documento
decía otra cosa hasta hace nada:

1. eran **siete** (`setChecked`, `setText`, `insert`, `remove`, `move`, `indent`, `outdent`);
2. subieron a **nueve** con `split` y `merge`, sin las cuales no se puede escribir con el
   teclado, y a **once** al aparecer las conversiones entre texto y casilla que necesita
   `ModosEscritura` (§7.2);
3. y bajaron al quitarse `indent` y `outdent`, que ya no tienen quien las use.

#### Por qué no existen `indent` ni `outdent`

Cierra de golpe las decisiones **(a)** y **(g)**, que preguntaban por el comportamiento de dos
operaciones que han dejado de existir. **El motivo es el móvil:** en el teclado de un teléfono
**no hay tecla Tabulador**, así que un diseño que dependa de ella es un diseño solo para
ordenador, y esta app es multiplataforma desde el principio.

En su lugar, **el nivel de una línea se elige al nacer**, con el modo activo de
`ModosEscritura` (§7.3). El Tabulador queda para meter un carácter de tabulación y nada más.

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
Retroceso, el botón de modo (§7.3)—. `move` no tendrá ninguno mientras no exista un gesto de
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
| `convertToCheckBox`, `convertToText` | medio | las que pide el botón de modo (§7.2), y `convertToText` también el Retroceso al principio de una casilla (§7.3) |
| `split`, `merge` | medio | **confirmadas.** Intro en medio de una línea y Retroceso al principio. `split` es además la mitad del botón de modo cuando el cursor está en medio |
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
  | tiene una hermana encima | esa **hermana anterior** |
  | es la **primera hija** de una casilla | su **madre**, y las demás hijas se quedan donde estaban |
  | es la primera línea de la nota | nadie: **no hace nada** |

  El segundo caso es el que no se ve venir, y es el que hace que `merge` no sea sólo "combinar
  dos elementos de una lista": ahí la madre cambia de texto **y** pierde una hija, las dos
  cosas a la vez.

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
   cascada de `setChecked`.

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

**Y quedó confirmada por segunda vez desde el otro extremo del diseño:** los tres casos
resultaron ser, uno a uno, los tres estados de `ModosEscritura` (§7.3) — `root-end` es el modo
*Texto*, `after` es *Casilla*, `last-child-of` es *Casilla hija*. No falta ninguno ni sobra
ninguno. Ojo, eso sí: cuando se decidió, los consumidores previstos eran `insert`, `move`,
`indent` y `outdent`; hoy las tres últimas no existen y **el único consumidor es `insert`**.

Los candidatos que quedan fuera —`before`, `first-child-of`, `root-start`— no son
descabellados; se descartan por coste: **cada caso de `Position` es una rama más que testear**
en quien la consuma. Y las operaciones se expresan enteras con los tres de arriba: `insert` y
`split` colocan detrás o dentro según el modo, y ninguna pide los otros tres.

Lo que **sí** los pediría es el arrastrar y soltar de la Fase 4, donde soltar *encima* de la
primera casilla de una lista no se puede expresar con `after`. Ese es el disparador concreto
para reabrirlo, y **va en el mismo paquete que `move`**: reordenar arrastrando pide "la primera
del todo", que con estos tres casos no se puede decir. Conviene saber lo que costará entonces:
añadir un caso obliga a **volver a pasar entera la batería de tests de `insert`**, no solo a
escribir la rama nueva. Se acepta ese coste futuro antes que testear hoy ramas que quizá no se
usen nunca.

### 9.5 Definición de "Fase 1 terminada"

No la tenía. Las fases 2 y 3 sí, aunque implícita: *terminan cuando el adaptador pasa el
contrato*. Sin criterio, "terminada" acaba queriendo decir "me he cansado". Son seis:

1. El helper devuelve el array de entrada **intacto** en sus dos casos: id ausente, y
   transformación que no cambia nada.
2. **Las ocho operaciones existen** (§9.3): `setText`, `setChecked`, `insert`, `remove`,
   `split`, `merge`, `convertToCheckBox` y `convertToText`.
3. Cada una tiene tests de **valor** y de **identidad** (`assert.strictEqual`, nunca
   `deepEqual`).
4. Cada caso no-op de la tabla está testeado explícitamente.
5. La rebanada vertical demuestra que un `set-checked` redundante **no notifica al suscriptor
   y no toca `updatedAt`**.
6. `npm run check` en verde, y `npm test` ya **incapaz de pasar en falso**.

### 9.6 `src/platform/` no nace en la Fase 1

Podría parecer que declarar los puertos obliga a implementarlos ya. No: **las
implementaciones no hacen falta hasta la Fase 4.** Un test se fabrica las suyas en una línea
—`const clock: Clock = { now: () => 1000 }`— y los tests están excluidos de la verja de
pureza, así que ni siquiera necesitan permiso para tocar plataforma.

Hasta que haya código de producción que arranque la app de verdad, una implementación real
**no tiene consumidor**. Así que no se crea `src/platform/` y no se declara el alias
`#platform/*`: un alias se declara cuando el módulo existe.

### 9.7 El catálogo de acciones de la Fase 2

Hoy `Action` tiene **un solo miembro**, así que ni siquiera es una unión. El catálogo no se ha
inventado: cada acción sale de un campo del modelo que alguien tiene que poder cambiar, o de
una operación de la Fase 1 que ya existe y no tiene quien la despache. **Son diecisiete.**

| Grupo | Acciones | De dónde salen |
|---|---|---|
| **Contenido** | `set-text` · `insert` · `remove` · `split` · `merge` · `convert-to-checkbox` · `convert-to-text` | las siete operaciones de §9.3 que aún no tienen acción. La octava, `set-checked`, ya está |
| **Notas** | `create-note` · `rename-note` · `delete-note` | `Note` tiene `name` y `content`; el contenido ya está cubierto arriba |
| **Contextos** | `create-context` · `rename-context` · `delete-context` · `add-item` · `remove-item` · `set-default-view` | los cuatro campos de `Context`: `name`, `defaultView` e `items` |

**Las siete de contenido son mecánicas.** Su caso de reducer es calcado al de `set-checked`:
buscar la nota, llamar a la operación, comparar con `===`, y si el contenido no cambió devolver
el estado tal cual. Copiar catorce líneas siete veces. Lo único que hay que vigilar es que
**nadie se salte la comparación** en ninguna de las siete.

#### Ninguna acción pliega varias operaciones

Una acción, una operación, en toda la Fase 2. Las compuestas que §9.3 anticipa —la cascada de
`setChecked` sobre los descendientes, borrar una rama entera de hojas hacia arriba— **no se
diseñan aquí**: no se sabrá qué gestos existen de verdad hasta tener el editor delante, y
adivinar la forma de la acción sin él es diseñar a ciegas. El aviso de §9.3 sigue en pie y se
cobra en la Fase 4: cuando lleguen, se pliegan en **una sola** acción, porque N despachos son N
`updatedAt`, N avisos al `Store` y N escrituras a disco.

#### Los Planes se persisten, pero no se operan

`AppState.plans` existe y `StorageAdapter` lleva su `Repository<Plan>`, así que un Plan se
guarda y se lee como cualquier otra entidad. Pero **no hay ni una acción de Plan** en el
catálogo, ni siquiera `create-plan`.

Es la misma regla que quitó `move` (§9.3): no se construye lo que no tiene consumidor. El
editor de grafos está aparcado en `TAREAS.md`, así que una acción de Plan no tendría quien la
despachara ni forma de comprobarse contra un uso real. **La consecuencia asumida y visible:**
`add-item` acepta un `ItemRef` de tipo `plan` —el tipo lo permite y sería raro mutilarlo— pero
en la Fase 2 no hay manera de crear un Plan que referenciar, así que ese camino queda muerto
hasta que alguien lo despierte. Añadirlas luego es puramente aditivo.

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

#### La hidratación entra; el arranque de verdad, no

Se parte por la misma costura que el write-behind (§6.4), y por el mismo motivo:

- **puro y en la Fase 2** — `hydrate(entidades) → AppState`, y el runner de migraciones que la
  precede. Son funciones de datos a datos, se prueban sin navegador y sin temporizadores.
- **impuro y en la Fase 4** — quién abre el storage, en qué orden, y qué se le enseña al
  usuario si no hay nada guardado. Eso vive en `platform/web/`, que no nace hasta entonces.

Esto cierra la entrada de `TAREAS.md` que decía que el arranque no tenía dueño de fase. Tenía
dos, y por eso no encajaba en ninguna.

#### `schemaVersion` no va en `AppState`

Ya está donde tiene que estar: en `StorageAdapter` (§6.1), con su `get` y su `set`. **No se
añade a `AppState`**, aunque el comentario de `AppState.ts` diga hoy que falta. Es una
propiedad de **lo guardado**, no del estado en memoria: en `AppState` no significaría nada, no
la leería nadie, y cada acción tendría que arrastrarla intacta de un estado al siguiente.

Y de paso se corrige la justificación, que `TAREAS.md` marcaba como no-real. El argumento
escrito era que «añadirlo cuando ya haya notas guardadas sería una migración de datos», y **no
aplica**: no hay nada guardado todavía, así que ese argumento valdría igual para `Versioned`,
que sí se adelantó. La razón verdadera es otra: **`schemaVersion` *es* el mecanismo de
migración**, y un número de versión que nadie lee no protege nada. Por eso llega con el runner
que lo consume, en esta fase, y ni un día antes.

### 9.8 Definición de "Fase 2 terminada"

Al estilo de §9.5, porque sin criterio «terminada» acaba queriendo decir «me he cansado». Son
seis:

1. Los tres puertos de persistencia existen como **interfaces** (§6.1), todos `async`.
2. **`MemoryStorageAdapter` pasa la suite de contratos entera**, y la suite está escrita contra
   la interfaz, no contra él. Esa es la única definición de terminado que no se degrada.
3. **Un `set-checked` redundante no llega a disco.** Es el punto 5 de §9.5 llevado un eslabón
   más abajo: la Fase 1 demostró que no notifica al suscriptor; la Fase 2 tiene que demostrar
   que **tampoco escribe**. Con un `StorageAdapter` que cuente escrituras.
4. **Las diecisiete acciones existen**, cada una con su caso de reducer, y el `switch` vuelve a
   ser exhaustivo por el compilador.
5. **`delete-note` deja los contextos consistentes** —ninguna `ItemRef` colgando— **y devuelve
   intactos los que no la listaban**, comprobado con `strictEqual`.
6. `npm run check` en verde, con la verja y el guardián de pureza incluidos.

### 9.9 Definición de "Fase 3 terminada"

Al estilo de §9.5 y §9.8, y **escrito antes de que el adaptador esté hecho**, que es el único
momento en que sirve: un criterio decidido con el trabajo delante se decide siempre a favor de
lo que se hizo.

Esta fase lo necesita más que las dos anteriores por un motivo propio: **es la primera cuya
última pieza no la comprueba ninguna prueba** (§6.3). Está decidido que `DirectoryHandleBlobStore`
se verifica a mano, y «a mano» sin una lista escrita y ejecutada significa en la práctica «no se
verifica». El criterio es lo que impide que esa decisión se convierta en un agujero.

**Son siete, y los siete están cumplidos: la Fase 3 está TERMINADA.** El 5 —la lista manual— fue
el último en caer, el **2026-09-13**, y era el único que separaba «el código está entero» de «la
fase está terminada», que es exactamente el agujero que este criterio existe para no dejar
abierto:

1. **✅ El paso 0, hecho** (§6.5) — el único punto ya cerrado al escribir esto: los once métodos de
   puerto devuelven `Result`, `runMigrations` es pura **y total**, y la suite de contratos se
   convirtió con las firmas, antes de que hubiera dos adaptadores que convertir.
2. **✅ `FileStorageAdapter` pasa la suite de contratos entera, en Node y con un `BlobStore`
   falso** — y es comprobable en el diff: **de la suite de contratos no se toca nada**
   después del paso 0. El fichero que lo engancha es tan corto como el de memoria; si hace falta
   alargarlo, es que se está probando un detalle que los otros backends no cumplen.
3. **✅ Lo que sólo tiene él va probado aparte: la traducción de errores.** El contrato está escrito
   contra la interfaz, así que no puede cubrir esto —el adaptador de memoria no tiene nada que
   serializar—, y son justamente los caminos que fallan en silencio:
   - un JSON ilegible que devuelve el `BlobStore` sale como **`corrupt`**, no como `io`, que es
     lo suyo porque es quien parsea (§6.1);
   - un `err` que sube del `BlobStore` llega arriba **sin reclasificar**: un `permission-denied`
     no se convierte en `io`. Reclasificar ahí convierte un «no insistas» en un «insiste» y, por
     el camino, resucita un write-behind que tenía que haberse detenido (§6.5).

   Y verificado **rompiéndolo**, como todo aquí. Van **en un fichero aparte**, no alargando el
   que engancha el contrato, que se queda en dos `import` y una llamada, como el de memoria. Por
   qué esto no contradice a `MemoryStorageAdapter` —que no tiene ni una prueba propia, a
   propósito— está en §6.3: aquél no tiene lógica propia y éste sí.
4. **✅ Existen las dos implementaciones de `BlobStore`**, no sólo la de desarrollo:
   `LocalStorageBlobStore`, probada en Node con un `Storage` falso **que sabe lanzar
   excepciones** —sin eso la cuota no se puede provocar—, y `DirectoryHandleBlobStore`. Viven en
   `src/storage/blobs/` y el porqué de la carpeta está en §6.1. La fase se llama *fichero local*;
   cerrarla sin el de la carpeta real sería cerrarla sin lo que le da nombre.
5. **✅ La lista de pasos manual está escrita en el repo Y ejecutada, con su resultado anotado** —
   fecha, navegador y versión, y qué pasó. El «una vez» ya venía en la decisión (§6.3); esto sólo
   lo hace comprobable. **Escrita**, en `test/storage/blobs/VERIFICACION-MANUAL.md`, junto a las
   demás pruebas de ese rincón (dónde vivía era un hueco de *Sin decidir* y está cerrado; se mudó
   ahí con el resto, §8.5). **Y ejecutada el 2026-09-13, con DOS pasadas anotadas:**
   - **Brave 1.95.101** (Chromium 153.0.8010.37, Ubuntu 22.04) — pasan **las cinco** secciones,
     incluida la E de OPFS que este criterio no exige. ⚠️ Brave **no trae la API de fábrica**: se
     arrancó con `--enable-features=FileSystemAccessAPI`, y eso queda anotado porque es parte de
     poder repetir la pasada;
   - **Firefox 153.0.4** — A, B, C y D **«no se ha podido probar»**, porque no tiene
     `showDirectoryPicker()`. Eso **también cierra el punto**: la regla de oro de la lista es que
     se cierra con el resultado que haya y no con el bueno, y «este navegador no puede» es
     información, no un hueco. Sólo pasa OPFS.

   **Lo que la pasada cazó, y que ninguna prueba automática podía ver:** el fichero apareció con
   **45 bytes y no 0** —ése es el `close()` que §6.3 usa como ejemplo de lo que un doble deja
   pasar en verde—, y el `permission-denied` del paso C resultó **no ser cosmético**: el `mtime`
   del fichero no se movió tras el `write` denegado. También se corrigió un falso verde del
   método: el paso B hecho sin recargar reutiliza el handle en memoria y **no prueba nada** —«B
   sin F5 no es B»—.

   ⚠️ **El asterisco, que se conserva en vez de taparlo:** las dos pasadas se hicieron sobre el
   commit `dec4306` **con el árbol sucio**, o sea que lo verificado no es literalmente lo que hay
   en ese commit. Es la debilidad conocida de este punto, y lo que la compensa es la regla de
   `CLAUDE.md`: **si se toca `DirectoryHandleBlobStore.ts`, se repasa la lista.**
   Lo mínimo que cubre es lo que un doble no puede ver:
   - que los bytes **llegan de verdad al disco** — el `close()` olvidado de §6.3 pasa en verde
     contra un `Map`, y contra una carpeta real no;
   - que lo escrito **se relee en una sesión nueva**, tras recargar y volver a conceder permiso;
   - que revocar el permiso sale por `Result` como `permission-denied` y **no como excepción**.
     Si el navegador no deja provocarlo a mano, se anota eso mismo: el punto se cierra con el
     resultado, sea cual sea, no con el resultado bueno.
6. **✅ Nada lanza por encima de la frontera de cada adaptador** (§6.5, principio 2): en cada pieza
   nueva —el adaptador y los dos `BlobStore`— el `try/catch` está **confinado a las funciones que
   hablan con lo que lanza**, y por encima ni un `throw`. No es «una y sólo una»: en
   `FileStorageAdapter` son tres, y las tres se justifican solas —`transaction`, que ejecuta
   código ajeno, y las dos de la serialización, porque `JSON.parse` lanza y un `TextDecoder` con
   `fatal: true` también—; en cada `BlobStore` es **una**, y en el de la carpeta esa única
   frontera lleva el `await` dentro a propósito: sin él una promesa rechazada se escaparía del
   `try`. **Medido al cerrar la fase: seis `try` en todo el código de producción de `core/` y
   `storage/`, y cero `throw`.** La fase no podía ser la que estrenara uno.

   ⚠️ **Y ese recuento se quedó corto, cosa que se descubrió DESPUÉS de cerrar la fase.**
   Contar `try` y `throw` mide lo que nosotros lanzamos; no mide **lo que llamamos sin
   envolver**, que resultó ser el agujero de verdad. Había dos, los dos medidos con una sonda:
   `encodeURIComponent` dentro de `caminoDe` —`URIError` con un surrogate suelto, y `get`, `put`
   y `delete` lo llamaban fuera de toda frontera— y `paso.migrate()` en `runMigrations`, que es
   código ajeno. Hoy son **ocho `try`** y el punto se sostiene de verdad. **Esto no reabre la
   fase** —el criterio se cumplía con lo que se sabía medir entonces— pero sí corrige el método:
   la pregunta buena no es «¿cuántos `throw` hay?» sino «¿alguna llamada que lanza puede llegar
   a una firma pública?».

   **Y el guardián ya existe: `npm run check:fronteras`.** No entraba en el criterio —`TAREAS.md`
   lo marcaba opcional y una fase no se bloquea por una casilla opcional—, y se escribió al
   encontrar las dos fugas. Entiende la cobertura **transitiva**, que es lo que lo hace
   utilizable: seis ayudantes locales están a salvo sólo porque se les llama desde dentro de una
   frontera, y sin esa regla el guardián los marcaría a los seis. Aplicado al código de antes de
   los arreglos, señala exactamente las dos fugas y ninguna más. Cae por tanto el precio que
   este punto daba por asumido: esa regla ya no la sostiene la revisión sino la comprobación,
   como todo lo demás aquí.
7. **✅ `npm run check` en verde**, con la verja y el guardián de pureza, y **el recuento de
   pruebas anotado al cerrarla**, como en §9.5 y §9.8. **La cifra de cierre son 314 pruebas**
   —99 al cerrar la Fase 1, 216 al cerrar la 2—. Y una previsión que salió mal y
   conviene dejar corregida: esto decía que la suite de contratos pasaría a correr **dos** veces,
   una por adaptador, y corre **tres** — la tercera monta el adaptador de fichero sobre un
   `BlobStore` de producción, y el porqué está en §6.3.

#### Lo que NO entra en la Fase 3

Dicho explícitamente para que nadie lo dé por hecho, igual que en §9.7:

- **La UI.** Fase 4.
- **El arranque real de la app** —quién abre el storage, en qué orden, y qué se ve cuando no hay
  nada guardado—. Ya estaba partido (§9.7): la mitad pura se hizo en la Fase 2 y la impura vive
  en `platform/web/`, que no nace hasta la Fase 4. Consecuencia que conviene tener presente:
  **en esta fase el `FileStorageAdapter` no tiene quien lo monte en la app real**; sus únicos
  consumidores son las pruebas y la lista manual.
- **El `onError` del write-behind, el `onCorrupt` de `getAll` y el botón de «reconectar
  carpeta».** Van los tres juntos y van a la Fase 4 (§6.5), por el mismo motivo: hoy no hay a
  quién avisar. Sus dos consecuencias —un `permission-denied` deja el escritor detenido para el
  resto de la sesión, y una nota corrupta impide abrir la app— **se anotan, no se arreglan aquí**.
- **Validar el esquema de lo que se lee del disco** (§6.2). Lo que hay es una comprobación de
  forma mínima; un validador de verdad es una pieza aparte y no la pide ningún punto de arriba.
- **La escritura condicional.** Sigue abierta (§6.5) y sería lo primero que se añadiría a
  `StorageError`; no bloquea esta fase, porque sin un segundo escritor real nadie puede
  dispararla.
- **El modo `integration` de la suite de contratos** (§6.3): planificado y no construido, sin
  backend real que probar.
- **Un runner de navegador.** Cerrado que no (§6.3), y qué lo reabriría está en `TAREAS.md`.

Y **queda una** cosa que no se cierra arriba a propósito, porque no está decidida y no se decide
escribiendo un criterio: **si la fase exige además una pasada manual sobre OPFS**. Está en la
lista como sección opcional, y ningún punto de arriba la pide. Con su porqué, en `TAREAS.md` →
*Sin decidir*. **Eran tres, y las otras dos ya están cerradas:** qué lleva dentro el
`manifest.json` —sólo `schemaVersion`, sin índice de ids— se cerró al escribir el adaptador
(§6.2), y **dónde vive la lista manual** se cerró al escribirla: junto a las pruebas del mismo
rincón del código —hoy `test/storage/blobs/`, tras la mudanza de §8.5—, que es lo que evita
convertirla en un cuarto documento.

---

## Apéndice: el prototipo viejo

`src/scripts/` es anterior al rediseño. Sigue en el repo porque es lo único que hace algo
visible, pero **no refleja esta arquitectura y no hay que imitarlo**. Se sustituye en la
Fase 4, y ahora mismo **no se puede construir ni servir**: webpack está desinstalado hasta esa
fase, así que `npm run build` y `npm run serve` no existen.

Arrastra dos bugs conocidos que se resuelven sustituyéndolo, no parcheándolo: `context.items`
apunta al array `notes` original que luego se reasigna, así que el contexto se queda vacío
para siempre; y `deleteNoteBtn` no limpia `selectedNotesId`.
