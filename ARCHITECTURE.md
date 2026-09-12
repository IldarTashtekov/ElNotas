# Arquitectura de ElNotas

El diseño y **sus por qués**. Se lee a demanda, no en cada sesión: `CLAUDE.md` tiene las
reglas y `TAREAS.md` lo pendiente; aquí está el razonamiento que las sostiene, para no
volver a discutirlo desde cero.

Incluye una **sección de conceptos desde cero** (§2) para quien sepa TypeScript pero no
arquitectura de front. Si algún término del resto del documento suena a jerga —reducer,
puerto, copia por camino—, está explicado ahí con ejemplos de notas y casillas.

> **Ojo al leer:** este documento describe **el diseño**, que en su mayor parte **todavía
> no está construido**. Lo que existe hoy en el repo es solo el modelo de datos (§5.1).
> Cada sección dice si lo que describe existe o está planificado. Antes de dar algo por
> hecho, compruébalo contra el repo.

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

Seis mecanismos, una sola filosofía:

| Mecanismo | Regla que hace cumplir | Sin él |
|---|---|---|
| **Verja de pureza** (`src/core/tsconfig.json` sin `DOM` y con `types: []`) | el core no toca la plataforma | un `document.` acaba en el dominio y no te enteras |
| **`readonly` / `ReadonlyArray`** en todo el dominio | inmutabilidad | un `push` silencioso rompe la detección de cambios |
| **Tipos marcados** (`NoteId`, `PlanId`…) | no confundir un id con otro | pasas un `PlanId` donde va un `NoteId` y falla en runtime |
| **Unión discriminada** (`Content = Text \| CheckBox`) | tratar todos los casos | añades un tipo de bloque y nada te avisa de dónde falta |
| **`noUncheckedIndexedAccess`** | tratar el "ese id no existe" | `undefined` se cuela por un lookup en un estado normalizado |
| **Alias no declarado** (`#ui/*` no existe todavía) | el core no importa de fuera | una dependencia al revés pasa desapercibida |

El sexto es el más curioso, porque no se diseñó: sale gratis de la regla "un alias se
declara cuando el módulo existe". Como `#ui/*` no está en el campo `imports`, importarlo
desde el core falla con un limpio *Cannot find module*.

**El orden importa.** Todo esto es la Fase 0 y se montó *antes* de escribir una línea de
dominio. Si la verja hubiera llegado después, habría llegado tarde.

**Lo que la verja NO cubre** (medido, no supuesto): `Date`, `Math` y `new Date()` están en
`lib.es5.d.ts`, o sea dentro de `lib: ["ES2020"]`, así que **compilan** dentro del core.
Solo caen `crypto`, `performance` y `document`, que viven en `lib.dom` / `@types/node`.
Consecuencia: **`IdGenerator` está protegido por el compilador; `Clock` solo por
convención.** No se puede tapar por `lib` sin renunciar a medio ES2020, así que el hueco se
tapa con un `grep` en `npm run check` (pendiente, ver `TAREAS.md`).

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
│   ├── domain/    # ← modelo + Position + helper + las 8 operaciones
│   ├── ports/     # ← los CINCO: Clock, IdGenerator, Repository, StorageAdapter, BlobStore
│   ├── app/       # ← Action + reduce + Store + useCases + diffState
│   ├── migrations/# (F2, sin empezar)
│   └── index.ts
├── storage/       # ← contract-tests/ + memory/ + writeBehind · (F3) file/
├── ui/            # (F4) vanilla: componentes + render(state)
└── platform/      # (F4) composición
    └── web/       # el ÚNICO sitio que decide qué adaptador se inyecta
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

**Las fases 1 y 2 enteras: ~2570 líneas de código, ~3320 de pruebas, y 216 pruebas en verde.**
Esta tabla se queda desactualizada sola: antes de afirmar nada sobre ella,
`find src -name '*.ts' | sort` y `npm run check`.

| Fichero | Líneas | Qué es |
|---|---|---|
| **`domain/` — el modelo** | | |
| `Ids.ts` | 50 | IDs marcados, `Revision` e `ItemRef` |
| `Content.ts` | 66 | `Text` \| `CheckBox`, *type guards* y constructores |
| `Versioned.ts` | 43 | `updatedAt` y `revision` |
| `Note.ts` · `Plan.ts` · `Context.ts` | 78 | Las tres entidades |
| `AppState.ts` | 29 | El estado raíz, normalizado |
| `Position.ts` | 46 | El vocabulario del "dónde", tres casos |
| **`domain/` — la maquinaria** | | |
| `updateContent.ts` | 102 | Primitiva **A**: transformar un nodo. No sale por `index.ts` |
| `updateContainerOf.ts` | 93 | Primitiva **B**: transformar el contenedor de una línea. Tampoco |
| `operations.ts` | 363 | **Las ocho operaciones**, todas exportadas |
| **`ports/` — cinco interfaces, cero implementaciones** | | |
| `Clock.ts` · `IdGenerator.ts` | 66 | Fase 1 |
| `Repository.ts` · `StorageAdapter.ts` · `BlobStore.ts` | 144 | Fase 2 |
| **`app/` — la capa de aplicación** | | |
| `Action.ts` | 227 | **Las diecisiete acciones**: 8 de contenido, 3 de Nota, 6 de Contexto |
| `reduce.ts` | 297 | Los diecisiete casos. **No sale por `index.ts`** |
| `Store.ts` | 79 | Una **función**, no una clase |
| `useCases.ts` | 46 | La frontera entre lo impuro y lo puro |
| `diffState.ts` | 108 | La mitad **pura** del write-behind |
| `index.ts` | 82 | API pública del core |
| **`migrations/` — la mitad pura del arranque** | | |
| `hydrate.ts` | 69 | De listas a mapas, limpiando `ItemRef` rotas |
| `runMigrations.ts` | 118 | El runner. `MIGRATIONS` **vacía a propósito** |
| **`src/storage/` — el primer módulo que implementa puertos** | | |
| `contract-tests/storageContract.test.ts` | 224 | **La suite que todo adaptador debe pasar** |
| `memory/MemoryStorageAdapter.ts` | 106 | Tres `Map` y un número |
| `writeBehind.ts` | 156 | La mitad **impura**: debounce y temporizador |

Las pruebas son ~1950 de esas líneas, más que el código que vigilan, y eso es lo esperado en
una capa donde cada invariante se verifica rompiéndola a propósito.

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

**Nada de esta sección está construido.** Es diseño para las fases 2 y 3.

### 6.1 Dos puertos, a propósito en dos niveles

**Escritos ya**, en `src/core/ports/`. Sólo las interfaces; las implementaciones viven fuera.

```ts
export interface Repository<T, TId extends string> {
  readonly get:    (id: TId) => Promise<T | null>
  readonly getAll: () => Promise<ReadonlyArray<T>>
  readonly put:    (entity: T) => Promise<void>
  readonly delete: (id: TId) => Promise<void>
}

export interface StorageAdapter {
  readonly notes:    Repository<Note, NoteId>
  readonly plans:    Repository<Plan, PlanId>
  readonly contexts: Repository<Context, ContextId>
  readonly transaction: <T>(fn: () => Promise<T>) => Promise<T>  // best-effort
  readonly getSchemaVersion: () => Promise<number>
  readonly setSchemaVersion: (v: number) => Promise<void>
}

/** Nivel bajo: solo mueve bytes. No sabe qué es una Nota. */
export interface BlobStore {
  readonly read:   (path: string) => Promise<Uint8Array | null>
  readonly write:  (path: string, data: Uint8Array) => Promise<void>
  readonly delete: (path: string) => Promise<void>
  readonly list:   (prefix: string) => Promise<ReadonlyArray<string>>
}
```

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

**El `BlobStore` existe porque un fichero local y uno remoto solo difieren en dónde van los
bytes.** Un único `FileStorageAdapter` parametrizado por `BlobStore` da cuatro backends:

| Objetivo | Implementación |
|---|---|
| Desarrollo / fallback | `LocalStorageBlobStore` (~30 líneas) |
| Fichero local en disco | `DirectoryHandleBlobStore` con `showDirectoryPicker()` (Chromium) |
| Fallback otros navegadores | el **mismo** `DirectoryHandleBlobStore` con OPFS |
| Drive (más adelante) | `DriveBlobStore` |

La File System Access API y OPFS exponen el mismo `FileSystemDirectoryHandle`: solo cambia
**cómo obtienes el handle**, no la implementación.

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
tienta: porque un `put` no siempre es un blob —§6.2 prevé un `manifest.json` junto a las
entidades, y tres repositorios escribiendo por su cuenta lo actualizarían tres veces,
pisándose— y porque la serialización es la misma para las tres clases: puesta en el adaptador
se escribe una vez; puesta en cada repositorio, tres veces casi iguales, que es como empiezan
a divergir.

### 6.2 Formato y semántica

**Formato: un fichero por entidad** (`notes/<id>.json`) más un `manifest.json`. Da diffs
pequeños y conflictos por nota en vez de globales.

**Semántica multi-backend (decidida, no construida):** espejo con **el fichero local siempre
como primario y fuente de verdad**. Los backends remotos son réplicas alimentadas por un
**outbox durable** con reintentos, para que la app nunca se bloquee porque la red o un token
fallen. El estado de sincronización es **dato persistido**, no estado en memoria.

**La config de storage no puede vivir en el storage que configura.** Necesita su propio sitio
aparte (`settings.json` o localStorage), o tienes un huevo-y-gallina al arrancar.

**Nada de credenciales en el repo ni en el bundle.** En web, OAuth con PKCE y token en
memoria, **nunca** en localStorage. En escritorio, keychain del sistema.

### 6.3 Tests de contrato

Una sola especificación (`storage/contract-tests`) que **todos** los adaptadores deben pasar.

La idea es esta: en vez de testear cada adaptador por separado —lo que garantiza que cada uno
funcione *a su manera*— se escribe **una sola suite** contra la interfaz, y se ejecuta contra
cada implementación. Un adaptador está terminado **cuando pasa el contrato**, y esa es la
única definición de "modular" que no se degrada con el tiempo: si un backend nuevo se
comporta distinto, el contrato lo cantea.

Corre en dos modos: `unit` (memory, directorio temporal) en cada commit, e `integration`
(servicios reales) opt-in por variable de entorno.

Los adaptadores sobre `FileSystemDirectoryHandle` y OPFS necesitan un navegador real y
`node:test` no llega ahí. **Decidido, y antes de empezar la Fase 3: se verifican a mano, con
una lista de pasos escrita en el repo, y sin instalar ningún runner de navegador.**

El reparto en dos niveles reduce el problema a casi nada: `FileStorageAdapter` —que es donde
está toda la lógica— pasa esta misma suite en Node con un `BlobStore` falso, y lo único que
queda sin automatizar son las ~50 líneas de `DirectoryHandleBlobStore`, que **no tienen lógica
propia: sólo traducen a la API del navegador**.

Y un doble ahí no compra lo que parece. Prueba **lo que uno cree que hace la API**, no lo que
hace: escribir un fichero con la File System Access API exige un `close()` final que es lo que
vuelca los datos al disco, y un `BlobStore` de mentira sobre un `Map` pasa en verde con ese
`close()` olvidado. **Cuanto más fina es la capa de traducción, menos vale probarla con un
doble.** El razonamiento completo y qué lo reabriría, en `TAREAS.md`.

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
de abajo es fontanería.

**Y no se declara un puerto `Scheduler` para esto.** Sería la reacción automática —«si el core
no puede, inyéctalo»— pero no hace falta: partido así, **el core no necesita temporizar nada**.
Un puerto se declara cuando el dominio necesita algo del mundo, no para dar cobijo a código que
en realidad no es del dominio. Para que la parte de abajo se pueda probar sin esperas reales,
recibe la función de programación **por parámetro, con un valor por defecto**; eso no es un
puerto, es un argumento.

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
| `tsconfig.json` | la app (con `DOM`), excluye los tests |
| `src/core/tsconfig.json` | **la verja de pureza**: `lib: ["ES2020"]`, `types: []` |
| `tsconfig.test.json` | compila los tests a `tmp-test/` con tipos de Node |

Dos detalles de la verja que no son evidentes:

- **Los tests están excluidos** (`"exclude": ["**/*.test.ts"]`). La pureza aplica al código de
  producción; un test sí puede usar `node:test` y APIs de plataforma. Esto es justo lo que
  hace que no haga falta implementar `Clock` para testear: un test se fabrica el suyo en una
  línea.
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
    "compiled": "./tmp-test/core/*.js",
    "default":  "./src/core/*.ts"
  }
}
```

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
`npm test` hace dos cosas: compila `src/` a `tmp-test/` (CommonJS) y lanza
`node --conditions=compiled --test tmp-test`.

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
nativamente. Dos casos reales de este proyecto, y son los que justifican la política: los
alias no necesitaron `paths` ni plugins (campo `imports`), y los tests no necesitaron runner
(`node:test`).

Efecto medido al aplicarla: de ~350 paquetes y ~160M con 12 vulnerabilidades, a **17
paquetes, 27M y 0 vulnerabilidades**. Toda la cadena de `webpack-dev-server` era la que traía
esas 12.

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
  cierre (§9.8), cumplidos, con 216 pruebas: los tres puertos (§6.1), `MemoryStorageAdapter` y
  su suite de contratos (§6.3), el write-behind en sus **dos** piezas (§6.4), **las diecisiete
  acciones** (§9.7) y la mitad pura del arranque.

  **Se atacó de abajo arriba, no de arriba abajo:** primero la persistencia entera verificada
  con la única acción que ya existía, y sólo después las quince que faltaban. Mismo
  razonamiento que la rebanada vertical de la Fase 1 — el write-behind era la única pieza con
  riesgo real de la fase, y se quería descubrir que escribe de más **con un solo candidato**,
  no con diecisiete. Valió la pena: la rotura que comprobaba ese corte no tumbaba **ninguna**
  prueba hasta que se añadió un contador de transacciones, y eso se vio con una acción en el
  catálogo en vez de con diecisiete.

- **Fase 3 — Fichero local.** `FileStorageAdapter` sobre `LocalStorageBlobStore`, luego
  `DirectoryHandleBlobStore`. Ojo al detalle de UX: al recargar **no se puede recuperar el
  permiso de la carpeta en silencio** — el handle se guarda en IndexedDB, pero volver a pedir
  permiso exige un gesto del usuario (botón de "reconectar carpeta").

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

---

## Apéndice: el prototipo viejo

`src/scripts/` es anterior al rediseño. Sigue en el repo porque es lo único que hace algo
visible, pero **no refleja esta arquitectura y no hay que imitarlo**. Se sustituye en la
Fase 4, y ahora mismo **no se puede construir ni servir**: webpack está desinstalado hasta esa
fase, así que `npm run build` y `npm run serve` no existen.

Arrastra dos bugs conocidos que se resuelven sustituyéndolo, no parcheándolo: `context.items`
apunta al array `notes` original que luego se reasigna, así que el contexto se queda vacío
para siempre; y `deleteNoteBtn` no limpia `selectedNotesId`.
