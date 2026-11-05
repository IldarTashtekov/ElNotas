/**
 * Las nueve operaciones sobre el contenido de una nota.
 *
 * Viven juntas a propósito: comparten una misma disciplina, y leerlas seguidas es
 * como se comprueba que se aplica igual en todas.
 *
 *     Una operación que no aplica NO HACE NADA, en lugar de fallar.
 *     Y "no hacer nada" significa devolver el array de ENTRADA,
 *     no una copia equivalente.
 *
 * Enumerar cuándo no aplica cada una es **la mitad de su especificación**, y cada
 * caso tiene su prueba.
 *
 * Todas son puras: no generan IDs, no leen el reloj y no lanzan excepciones.
 */

import type { CheckBox, Content, Text } from "./Content.js"
import { checkBox, isCheckBox, isText, text } from "./Content.js"
import type { ContentId } from "./Ids.js"
import type { Position } from "./Position.js"
import { after } from "./Position.js"
import { updateContainerOf } from "./updateContainerOf.js"
import { mapPreservingIdentity, updateContent } from "./updateContent.js"

/* ───────────────────────── Sin tocar la estructura ─────────────────────────
    Las dos triviales: cambian un campo de una línea y nada más. */

/**
 * Cambia el texto de un bloque, sea un texto suelto o una casilla: los dos lo
 * tienen.
 *
 * **No hace nada si:** el id no existe · el texto ya es ese.
 */
export const setText = (content: ReadonlyArray<Content>, id: ContentId, value: string): ReadonlyArray<Content> =>
  updateContent(content, id, {
    onText: (block: Text): Text => (block.text === value ? block : { ...block, text: value }),
    onCheckBox: (block: CheckBox): CheckBox => (block.text === value ? block : { ...block, text: value }),
  })

/**
 * Marca o desmarca una casilla.
 *
 * Se llama `setChecked` **y no `toggleChecked`** a conciencia: un *toggle* no
 * puede ser nunca un no-op —siempre cambia algo por definición—, mientras que
 * `setChecked(id, true)` sobre una casilla ya marcada sí puede devolver el árbol
 * intacto. El nombre es lo que sostiene la invariante.
 *
 * **No arrastra a las hijas**, y es decisión cerrada: la primitiva es
 * deliberadamente mínima y la cascada se compone arriba, en la barra de
 * `ModosEscritura`.
 *
 * **No hace nada si:** el id no existe · el id es un `Text`, que no tiene
 * `checked` · ya está en ese valor. Los tres salen de la forma del helper, sin
 * un solo condicional extra: fíjate en que `onText` devuelve la entrada tal cual.
 */
export const setChecked = (content: ReadonlyArray<Content>, id: ContentId, checked: boolean): ReadonlyArray<Content> =>
  updateContent(content, id, {
    onText: (block: Text): Text => block,
    onCheckBox: (block: CheckBox): CheckBox => (block.checked === checked ? block : { ...block, checked }),
  })

/* ──────────────────────────── Cambiando la estructura ────────────────────────────
    Las que hacen que una lista crezca o mengüe. Se apoyan en la primitiva B
    (`updateContainerOf`), salvo `insert` como hija, que resulta ser la A. */

/** ¿Existe ya esa línea en el árbol, a cualquier profundidad? */
const existsIn = (items: ReadonlyArray<Content>, id: ContentId): boolean =>
  items.some((item: Content): boolean => item.id === id || (isCheckBox(item) && existsIn(item.children, id)))

/**
 * Mete el bloque justo al lado de `targetId`: detrás (`1`) o delante (`0`).
 * Lista intacta si `targetId` no está.
 */
const insertNextTo = <T extends Content>(
  items: ReadonlyArray<T>,
  targetId: ContentId,
  block: T,
  side: 0 | 1,
): ReadonlyArray<T> => {
  const index: number = items.findIndex((item: T): boolean => item.id === targetId)
  if (index === -1) return items
  return [...items.slice(0, index + side), block, ...items.slice(index + side)]
}

/**
 * Mete un bloque en el sitio que diga la posición.
 *
 * **No hace nada si:** el destino no existe · el destino es un `Text` y se pide
 * meter dentro · se pide meter un texto suelto en una lista de hijas · **ya
 * existe una línea con ese id**.
 *
 * El último no estaba en la tabla original y se añadió al implementarla: un id
 * repetido corrompe el árbol **en silencio**, porque a partir de ahí toda
 * operación sobre ese id actúa siempre sobre la primera coincidencia y jamás
 * sobre la segunda. Sale más barato negarse que detectarlo después.
 */
export const insert = (content: ReadonlyArray<Content>, block: Content, position: Position): ReadonlyArray<Content> => {
  if (existsIn(content, block.id)) return content

  switch (position.at) {
    case "root-end":
      return [...content, block]

    case "after":
    case "before": {
      const targetId: ContentId = position.id
      const side: 0 | 1 = position.at === "after" ? 1 : 0
      return updateContainerOf(content, targetId, {
        onRoot: (items: ReadonlyArray<Content>): ReadonlyArray<Content> => insertNextTo(items, targetId, block, side),
        onParent: (parent: CheckBox): CheckBox => {
          // Un texto suelto no cabe entre hijas. Sin este descarte no compila.
          if (!isCheckBox(block)) return parent
          const children: ReadonlyArray<CheckBox> = insertNextTo(parent.children, targetId, block, side)
          return children === parent.children ? parent : { ...parent, children }
        },
      })
    }

    case "last-child-of":
      // Aquí no hace falta la primitiva B: el destino no es el contenedor de
      // nadie todavía, es el propio nodo al que le crecen las hijas.
      return updateContent(content, position.id, {
        onText: (target: Text): Text => target, // un texto no tiene hijas donde meter nada
        onCheckBox: (target: CheckBox): CheckBox =>
          isCheckBox(block) ? { ...target, children: [...target.children, block] } : target,
      })

    default:
      // Exhaustividad: si `Position` gana un caso algún día, esto deja de
      // compilar en vez de tratarlo en silencio. Y una posición que llega sin
      // tipos (la consola con `?depurar`) no hace nada: devolverla a ella
      // guardaba la posición como si fuera el contenido.
      position satisfies never
      return content
  }
}

/** La lista sin las elegidas, cada una con todas sus hijas. Sin cambios, la MISMA. */
const removeFrom = <T extends Content>(items: ReadonlyArray<T>, fuera: ReadonlySet<ContentId>): ReadonlyArray<T> => {
  const quedan: ReadonlyArray<T> = items
    .filter((item: T): boolean => !fuera.has(item.id))
    .map((item: T): T => {
      if (!isCheckBox(item) || item.children.length === 0) return item
      const children: ReadonlyArray<CheckBox> = removeFrom(item.children, fuera)
      return children === item.children ? item : { ...item, children }
    })
  const iguales: boolean =
    quedan.length === items.length && quedan.every((item: T, i: number): boolean => item === items[i])
  return iguales ? items : quedan
}

/**
 * Saca esas líneas de la nota, todas en un paso. **Una casilla se va con todo
 * su árbol**: sus hijas, y las hijas de sus hijas, vayan elegidas o no.
 *
 * **No hace nada si:** ninguno de los ids existe.
 */
export const remove = (content: ReadonlyArray<Content>, ids: ReadonlyArray<ContentId>): ReadonlyArray<Content> =>
  removeFrom(content, new Set<ContentId>(ids))

/* ───────────────────────────── Moviendo ─────────────────────────────
    La del modo Ordenar: varias líneas, cada una con sus hijas, a otro sitio. */

/** Las elegidas que no van ya dentro de otra elegida, en orden de lectura. */
const ramasElegidas = (items: ReadonlyArray<Content>, elegidas: ReadonlySet<ContentId>): ReadonlyArray<Content> =>
  items.flatMap((item: Content): ReadonlyArray<Content> =>
    elegidas.has(item.id) ? [item] : isCheckBox(item) ? ramasElegidas(item.children, elegidas) : [],
  )

/** La casilla sin las hijas que se van, a cualquier profundidad; sin ninguna, la MISMA. */
const podar = (casilla: CheckBox, fuera: ReadonlySet<ContentId>): CheckBox => {
  const hijas: ReadonlyArray<CheckBox> = casilla.children
    .filter((hija: CheckBox): boolean => !fuera.has(hija.id))
    .map((hija: CheckBox): CheckBox => podar(hija, fuera))
  const iguales: boolean =
    hijas.length === casilla.children.length &&
    hijas.every((hija: CheckBox, i: number): boolean => hija === casilla.children[i])
  return iguales ? casilla : { ...casilla, children: hijas }
}

/** ¿Los mismos ids, en el mismo orden y anidados igual? Mover no cambia nada más. */
const mismaForma = (a: ReadonlyArray<Content>, b: ReadonlyArray<Content>): boolean =>
  a.length === b.length &&
  a.every((x: Content, i: number): boolean => {
    const y: Content | undefined = b[i]
    if (y === undefined || x.id !== y.id) return false
    return isCheckBox(x) && isCheckBox(y) ? mismaForma(x.children, y.children) : x.type === y.type
  })

/**
 * Lleva esas líneas, cada una con sus hijas, al sitio que diga la posición. Quedan
 * **juntas y en el orden en que se leían**, sea cual sea el orden de `ids`; una
 * elegida que va dentro de otra elegida viaja con su madre. Su marca no cambia.
 *
 * **No hace nada si:** ninguno de los ids existe · el destino no existe, o es una
 * de las que se mueven o va dentro de una · se pide meter un texto suelto entre
 * hijas o un texto como destino de `last-child-of` · **quedan donde estaban**.
 *
 * No se escribe como `remove` + `insert`: `remove` tira las hijas, y aquí viajan
 * con ella.
 */
export const move = (
  content: ReadonlyArray<Content>,
  ids: ReadonlyArray<ContentId>,
  position: Position,
): ReadonlyArray<Content> => {
  const elegidas: ReadonlySet<ContentId> = new Set(ids)
  const ramas: ReadonlyArray<Content> = ramasElegidas(content, elegidas)
  const [primera, ...resto] = ramas
  if (primera === undefined) return content

  const fuera: ReadonlySet<ContentId> = new Set(ramas.map((r: Content): ContentId => r.id))
  const sinEllas: ReadonlyArray<Content> = content
    .filter((item: Content): boolean => !fuera.has(item.id))
    .map((item: Content): Content => (isCheckBox(item) ? podar(item, fuera) : item))

  /* La primera va a la posición pedida, y cada una de las demás, detrás de la anterior. */
  interface Paso {
    readonly lista: ReadonlyArray<Content>
    readonly previa: ContentId
  }
  const { lista: movido }: Paso = resto.reduce(
    (paso: Paso, rama: Content): Paso => ({
      lista: insert(paso.lista, rama, after(paso.previa)),
      previa: rama.id,
    }),
    { lista: insert(sinEllas, primera, position), previa: primera.id },
  )

  /* Un `insert` que no aplicó deja fuera alguna: entonces no se mueve ninguna. */
  if (!ramas.every((r: Content): boolean => existsIn(movido, r.id))) return content
  return mismaForma(movido, content) ? content : movido
}

/* ───────────────────────────── Cambiando de clase ─────────────────────────────
    Las dos que dispara el botón de `ModosEscritura`, y también el
    Retroceso al principio de una casilla de la raíz.

    Las dos conservan el `ContentId` de la línea: es la MISMA línea con otra
    pinta, no una nueva. Si cambiara de id, el editor —que reconcilia por
    `data-id`— la borraría de la pantalla y dibujaría otra, y perderías el cursor
    en cada pulsación del botón. Y al no hacer falta id nuevo, ninguna de las dos
    necesita el `IdGenerator`.

    Nótese que las DOS usan la primitiva B y no la A. La A no sirve aquí por
    diseño: sus transformaciones son `Text → Text` y `CheckBox → CheckBox`, o sea
    que no puede cambiar de variante. Que es justo lo que hacen éstas. */

/**
 * Un texto suelto pasa a ser una casilla, sin marcar y sin hijas.
 *
 * **No hace nada si:** el id no existe · ya es una casilla. Lo segundo cubre de
 * paso todas las líneas anidadas, porque **una línea anidada es siempre una
 * casilla**: ahí no hay textos que convertir, y por eso `onParent` devuelve la
 * madre tal cual.
 */
export const convertToCheckBox = (content: ReadonlyArray<Content>, id: ContentId): ReadonlyArray<Content> =>
  updateContainerOf(content, id, {
    onRoot: (items: ReadonlyArray<Content>): ReadonlyArray<Content> =>
      mapPreservingIdentity(items, (item: Content): Content =>
        item.id === id && isText(item) ? checkBox(item.id, item.text) : item,
      ),
    onParent: (parent: CheckBox): CheckBox => parent,
  })

/**
 * Una casilla pasa a ser un texto suelto.
 *
 * **No hace nada si:** el id no existe · ya es un texto · **es una casilla con
 * hijas** · **es una casilla anidada**.
 *
 * Los dos últimos son la misma idea vista desde dos sitios: un texto **no puede
 * tener nada colgando** y **sólo cabe en la raíz**. Con hijas, convertir las
 * dejaría colgando de nada —se convierte de abajo arriba—; anidada, el resultado no cabría donde está, y sin `outdent` no hay
 * forma de hacerle sitio.
 *
 * El caso de la anidada no está escrito como condición en ninguna parte: sale de
 * que `onParent` devuelva la madre intacta.
 */
export const convertToText = (content: ReadonlyArray<Content>, id: ContentId): ReadonlyArray<Content> =>
  updateContainerOf(content, id, {
    onRoot: (items: ReadonlyArray<Content>): ReadonlyArray<Content> =>
      mapPreservingIdentity(items, (item: Content): Content =>
        item.id === id && isCheckBox(item) && item.children.length === 0 ? text(item.id, item.text) : item,
      ),
    onParent: (parent: CheckBox): CheckBox => parent,
  })

/* ───────────────────────────── Partir y unir ─────────────────────────────
    Las del teclado: Intro en medio de una línea la parte, Retroceso al
    principio la une con la de arriba. Son inversas, y esa simetría es
    comprobable: partir por cualquier punto y volver a unir devuelve el original.
    Por eso al unir NO se añade un espacio de cortesía. */

/**
 * Parte una línea por el punto de corte y deja las dos mitades seguidas.
 *
 * **La primera mitad es la línea de antes**: conserva su `ContentId`, su marca y
 * sus hijas. La segunda es nueva, **nace sin marcar**, y recibe su id por
 * parámetro porque el dominio no genera IDs — es la única de las ocho que lo
 * necesita.
 *
 * Que la mitad nueva nazca sin marcar es deliberado: los dos errores posibles no
 * cuestan lo mismo. Una tarea que aparece pendiente y ya estaba hecha la ves y la
 * marcas; una que aparece **hecha sin haberla hecho** desaparece de tu radar.
 *
 * **No hace nada si:** el id no existe · el punto de corte cae fuera de la línea
 * · ya existe una línea con `newId`. **Partir por un extremo NO es no-op:** deja
 * una mitad vacía, que es justo lo que quieres al empezar una lista.
 */
const splitAt = <T extends Content>(
  items: ReadonlyArray<T>,
  id: ContentId,
  offset: number,
  makeSecond: (target: T, rest: string) => T,
): ReadonlyArray<T> => {
  const index: number = items.findIndex((item: T): boolean => item.id === id)
  const target: T | undefined = items[index] // con index -1 sale `undefined`: una comprobación cubre las dos
  if (target === undefined) return items
  if (offset < 0 || offset > target.text.length) return items

  const first: T = { ...target, text: target.text.slice(0, offset) }
  const second: T = makeSecond(target, target.text.slice(offset))
  return [...items.slice(0, index), first, second, ...items.slice(index + 1)]
}

export const split = (
  content: ReadonlyArray<Content>,
  id: ContentId,
  offset: number,
  newId: ContentId,
): ReadonlyArray<Content> => {
  if (existsIn(content, newId)) return content

  return updateContainerOf(content, id, {
    onRoot: (items: ReadonlyArray<Content>): ReadonlyArray<Content> =>
      splitAt(items, id, offset, (target: Content, rest: string): Content =>
        // La mitad nueva es de la misma clase que la que se parte.
        isCheckBox(target) ? checkBox(newId, rest) : text(newId, rest),
      ),
    onParent: (parent: CheckBox): CheckBox => {
      // Aquí no hay que discriminar: entre hijas todo son casillas.
      const children: ReadonlyArray<CheckBox> = splitAt(
        parent.children,
        id,
        offset,
        (_: CheckBox, rest: string): CheckBox => checkBox(newId, rest),
      )
      return children === parent.children ? parent : { ...parent, children }
    },
  })
}

/** Todas las líneas en el orden en que se leen: cada casilla y, detrás, sus hijas. */
const enOrdenDeLectura = (content: ReadonlyArray<Content>): ReadonlyArray<Content> =>
  content.flatMap((line: Content): ReadonlyArray<Content> =>
    isCheckBox(line) ? [line, ...enOrdenDeLectura(line.children)] : [line],
  )

/**
 * Une una línea con la de arriba: la línea desaparece y su texto sube.
 *
 * **La de arriba es la que se ve encima**, leyendo de arriba abajo:
 *
 *     tiene una hermana encima  →  la última línea de esa hermana, por honda que
 *                                  esté (ella misma si no tiene hijas)
 *     es la primera hija        →  su madre, y las demás hijas se quedan donde estaban
 *     es la primera de la nota  →  nadie: no hace nada
 *
 * La línea que recibe **conserva su clase, su marca y sus hijas**; lo único que
 * le cambia es el texto. Y los textos se pegan **sin añadir espacio**, para que
 * partir y volver a unir devuelva exactamente lo que había.
 *
 * **No hace nada si:** el id no existe · es la primera línea de la nota · **la
 * línea que se absorbe tiene hijas** — se quedarían colgando de nada.
 */
export const merge = (content: ReadonlyArray<Content>, id: ContentId): ReadonlyArray<Content> => {
  const lineas: ReadonlyArray<Content> = enOrdenDeLectura(content)
  const index: number = lineas.findIndex((line: Content): boolean => line.id === id)
  const target: Content | undefined = lineas[index]
  const receiver: Content | undefined = lineas[index - 1]
  /* No existe, o es la primera de la nota: no hay nada encima. */
  if (target === undefined || receiver === undefined) return content
  if (isCheckBox(target) && target.children.length > 0) return content

  /* Las dos operaciones conservan lo que no tocan; las hijas ya se descartaron arriba. */
  return setText(remove(content, [id]), receiver.id, receiver.text + target.text)
}
