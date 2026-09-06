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
class Store {
  private state: AppState
  private listeners: Array<(s: AppState) => void> = []

  dispatch(action: Action) {
    const next = reduce(this.state, action)
    if (next === this.state) return      // nada cambió → nadie se entera
    this.state = next
    for (const l of [...this.listeners]) l(next)
  }

  subscribe(l: (s: AppState) => void) { /* ... */ }
}
```

Fíjate en `this.state = next`: eso es una **mutación**. Y es deliberada. El `Store` es **lo
único mutable de todo el sistema**: todo lo demás —dominio, operaciones, reducer— es puro y
devuelve valores nuevos. El estado tiene que cambiar en algún sitio, porque la app avanza
en el tiempo; la decisión de diseño es que ese sitio sea **uno solo, pequeño y localizable**
en lugar de estar repartido por toda la base de código.

Un detalle real: al notificar se recorre **una copia** de la lista de suscriptores
(`[...this.listeners]`). Así un suscriptor puede darse de baja durante su propia
notificación sin corromper la iteración. Es la clase de bug que solo aparece en producción
y de forma intermitente.

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
const marcarCasilla = (clock: Clock, ids: IdGenerator, store: Store) =>
  (noteId: NoteId, contentId: ContentId, checked: boolean) =>
    store.dispatch({
      type: "set-checked", noteId, contentId, checked,
      meta: { now: clock.now(), revision: revision(ids.newId()) },   // ← aquí, y solo aquí
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
│   ├── domain/    # ← lo ÚNICO que existe hoy (y solo tipos)
│   ├── ports/     # (F1) Clock, IdGenerator · (F2) Repository, StorageAdapter, BlobStore
│   ├── app/       # (F1) Store + reducer con UN caso · (F2) el catálogo completo
│   ├── migrations/# (F2)
│   └── index.ts
├── storage/       # (F2 memory · F3 file)
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

**8 ficheros, 306 líneas, cero tests.** Solo tipos y constructores; ninguna operación.

| Fichero | Líneas | Qué es |
|---|---|---|
| `domain/Ids.ts` | 50 | IDs marcados, `Revision` e `ItemRef` |
| `domain/Content.ts` | 66 | `Text` \| `CheckBox`, *type guards* y constructores |
| `domain/Versioned.ts` | 36 | `updatedAt` y `revision` |
| `domain/Note.ts` | 10 | La entidad Nota |
| `domain/Plan.ts` | 42 | Solo tipos, sin operaciones |
| `domain/Context.ts` | 26 | Agrupación por referencias |
| `domain/AppState.ts` | 29 | El estado raíz, normalizado |
| `index.ts` | 47 | API pública del módulo |

Que no haya tests no es un descuido: lo único escrito son tipos, y de su corrección responde
el typecheck. Los primeros tests llegan con las operaciones. Ojo con la trampa asociada:
`node --test` sin ficheros **sale con código 0**, así que hoy `npm test` pasa en verde sin
comprobar nada (anotado en `TAREAS.md`).

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

```ts
export interface Repository<T> {
  get(id: string): Promise<T | null>
  getAll(): Promise<T[]>
  put(entity: T): Promise<void>
  delete(id: string): Promise<void>
}

export interface StorageAdapter {
  readonly notes:    Repository<Note>
  readonly plans:    Repository<Plan>
  readonly contexts: Repository<Context>
  transaction<T>(fn: () => Promise<T>): Promise<T>   // best-effort según adaptador
  getSchemaVersion(): Promise<number>
  setSchemaVersion(v: number): Promise<void>
}

/** Nivel bajo: solo mueve bytes. No sabe qué es una Nota. */
export interface BlobStore {
  read(path: string): Promise<Uint8Array | null>
  write(path: string, data: Uint8Array): Promise<void>
  delete(path: string): Promise<void>
  list(prefix: string): Promise<string[]>
}
```

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

Queda un problema **abierto**: los adaptadores sobre `FileSystemDirectoryHandle` y OPFS
necesitan un navegador real, y `node:test` no llega ahí (ver `TAREAS.md`).

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
| al principio del todo | una **casilla de la raíz** | se va la casilla, la línea queda como texto | `convertirEnTexto` |
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

Y no necesita ninguna operación nueva: es **`split` y luego `convertirEnCasilla`**, dos
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

- **Fase 1 — Dominio puro. 🟡 A MEDIAS.** Hecho el modelo de datos (§5.1). Falta, en este
  orden:
  1. **El helper de copia por camino** y sus tests de identidad. Va **primero y solo**: es la
     única pieza con dificultad real, y todo lo demás se apoya en ella.
  2. **Las operaciones de contenido** (§9.3).
  3. **El tipo `Position`** (§9.4).
  4. **`core/ports/Clock.ts` e `core/ports/IdGenerator.ts`** — solo las interfaces, cuatro
     líneas, dentro del core. **Sin implementaciones:** ver §9.6.
  5. **Una rebanada vertical:** `Store`, un reducer con un único caso (`set-checked`), un caso
     de uso, y un suscriptor de prueba que **cuente notificaciones**. Verifica la cadena de
     identidad de punta a punta *antes* de escribir las otras ocho operaciones; la alternativa
     —escribirlas todas y enchufarlas al final— descubriría un fallo de identidad cuando ya
     hay nueve sitios donde puede estar. De paso ejercita por primera vez el alias `#core/` en
     modo `compiled`, que hoy nunca se ha ejecutado porque no hay tests.

  Todo esto se escribió una vez y **se borró a propósito** para asentar antes el modelo. Hay
  que rehacerlo; hoy no queda ni una línea.

- **Fase 2 — Acciones, puertos de persistencia y memory.** El resto del catálogo de acciones
  y los casos de reducer que faltan; los puertos `Repository` / `StorageAdapter` / `BlobStore`;
  `MemoryStorageAdapter` y la suite de contratos; el enganche store↔persistencia con
  write-behind; `schemaVersion` y el runner de migraciones.

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
| `convertirEnCasilla`, `convertirEnTexto` | medio | las que pide el botón de modo (§7.2), y `convertirEnTexto` también el Retroceso al principio de una casilla (§7.3) |
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
| `convertirEnCasilla` / `convertirEnTexto` | **la propia línea: mismo `ContentId`**. Es la misma línea con otra pinta | nada — **por eso no necesitan `IdGenerator`** |
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
| `convertirEnCasilla` | el id no existe · ya es una casilla |
| `convertirEnTexto` | el id no existe · ya es un texto · **es una casilla con hijas** (un texto no puede tener nada colgando: se convierte de abajo arriba, igual que se borra) · **es una casilla anidada** — un texto sólo puede vivir en la raíz, y sin `outdent` no hay forma de hacerle sitio |

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
   `split`, `merge`, `convertirEnCasilla` y `convertirEnTexto`.
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

---

## Apéndice: el prototipo viejo

`src/scripts/` es anterior al rediseño. Sigue en el repo porque es lo único que hace algo
visible, pero **no refleja esta arquitectura y no hay que imitarlo**. Se sustituye en la
Fase 4, y ahora mismo **no se puede construir ni servir**: webpack está desinstalado hasta esa
fase, así que `npm run build` y `npm run serve` no existen.

Arrastra dos bugs conocidos que se resuelven sustituyéndolo, no parcheándolo: `context.items`
apunta al array `notes` original que luego se reasigna, así que el contexto se queda vacío
para siempre; y `deleteNoteBtn` no limpia `selectedNotesId`.
