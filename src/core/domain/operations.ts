/**
 * Las operaciones de contenido de una nota.
 *
 * Son ocho (`ARCHITECTURE.md` §9.3) y viven juntas a propósito: comparten una
 * misma disciplina, y leerlas seguidas es como se comprueba que se aplica igual
 * en todas.
 *
 *     Una operación que no aplica NO HACE NADA, en lugar de fallar.
 *     Y "no hacer nada" significa devolver el array de ENTRADA,
 *     no una copia equivalente.
 *
 * Enumerar cuándo no aplica cada una es **la mitad de su especificación**: la
 * tabla está en §9.3 y cada fila tiene su prueba en `operations.test.ts`.
 *
 * Todas son puras: no generan IDs, no leen el reloj y no lanzan excepciones.
 */

import type { Content } from "./Content"
import { checkBox, isCheckBox, isText, text } from "./Content"
import type { ContentId } from "./Ids"
import type { Position } from "./Position"
import { updateContainerOf } from "./updateContainerOf"
import { mapPreservingIdentity, updateContent } from "./updateContent"

/* ───────────────────────── Sin tocar la estructura ─────────────────────────
    Las dos triviales: cambian un campo de una línea y nada más. */

/**
 * Cambia el texto de un bloque, sea un texto suelto o una casilla: los dos lo
 * tienen.
 *
 * **No hace nada si:** el id no existe · el texto ya es ese.
 */
export const setText = (
  content: ReadonlyArray<Content>,
  id: ContentId,
  value: string,
): ReadonlyArray<Content> =>
  updateContent(content, id, {
    onText: (block) => (block.text === value ? block : { ...block, text: value }),
    onCheckBox: (block) => (block.text === value ? block : { ...block, text: value }),
  })

/**
 * Marca o desmarca una casilla.
 *
 * Se llama `setChecked` **y no `toggleChecked`** a conciencia: un *toggle* no
 * puede ser nunca un no-op —siempre cambia algo por definición—, mientras que
 * `setChecked(id, true)` sobre una casilla ya marcada sí puede devolver el árbol
 * intacto. El nombre es lo que sostiene la invariante (§3).
 *
 * **No arrastra a las hijas**, y es decisión cerrada: la primitiva es
 * deliberadamente mínima y la cascada se compone arriba, en la barra de
 * `ModosEscritura` (§7.2).
 *
 * **No hace nada si:** el id no existe · el id es un `Text`, que no tiene
 * `checked` · ya está en ese valor. Los tres salen de la forma del helper, sin
 * un solo condicional extra: fíjate en que `onText` devuelve la entrada tal cual.
 */
export const setChecked = (
  content: ReadonlyArray<Content>,
  id: ContentId,
  checked: boolean,
): ReadonlyArray<Content> =>
  updateContent(content, id, {
    onText: (block) => block,
    onCheckBox: (block) => (block.checked === checked ? block : { ...block, checked }),
  })

/* ──────────────────────────── Cambiando la estructura ────────────────────────────
    Las que hacen que una lista crezca o mengüe. Se apoyan en la primitiva B
    (`updateContainerOf`), salvo `insert` como hija, que resulta ser la A. */

/** ¿Existe ya esa línea en el árbol, a cualquier profundidad? */
const existsIn = (items: ReadonlyArray<Content>, id: ContentId): boolean =>
  items.some((item) => item.id === id || (isCheckBox(item) && existsIn(item.children, id)))

/** Mete el bloque justo detrás de `afterId`. Lista intacta si `afterId` no está. */
const insertAfter = <T extends Content>(
  items: ReadonlyArray<T>,
  afterId: ContentId,
  block: T,
): ReadonlyArray<T> => {
  const index = items.findIndex((item) => item.id === afterId)
  if (index === -1) return items
  return [...items.slice(0, index + 1), block, ...items.slice(index + 1)]
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
export const insert = (
  content: ReadonlyArray<Content>,
  block: Content,
  position: Position,
): ReadonlyArray<Content> => {
  if (existsIn(content, block.id)) return content

  switch (position.at) {
    case "root-end":
      return [...content, block]

    case "after": {
      const targetId = position.id
      return updateContainerOf(content, targetId, {
        onRoot: (items) => insertAfter(items, targetId, block),
        onParent: (parent) => {
          // Un texto suelto no cabe entre hijas. Sin este descarte no compila.
          if (!isCheckBox(block)) return parent
          const children = insertAfter(parent.children, targetId, block)
          return children === parent.children ? parent : { ...parent, children }
        },
      })
    }

    case "last-child-of":
      // Aquí no hace falta la primitiva B: el destino no es el contenedor de
      // nadie todavía, es el propio nodo al que le crecen las hijas.
      return updateContent(content, position.id, {
        onText: (target) => target, // un texto no tiene hijas donde meter nada
        onCheckBox: (target) =>
          isCheckBox(block) ? { ...target, children: [...target.children, block] } : target,
      })

    default: {
      // Exhaustividad: si `Position` gana un caso algún día, esto deja de
      // compilar en vez de tratarlo en silencio (§9.4).
      const nunca: never = position
      return nunca
    }
  }
}

/** Quita esa línea de la lista, salvo que sea una casilla con hijas. */
const removeFrom = <T extends Content>(
  items: ReadonlyArray<T>,
  id: ContentId,
): ReadonlyArray<T> => {
  const target = items.find((item) => item.id === id)
  if (target === undefined) return items
  if (isCheckBox(target) && target.children.length > 0) return items
  return items.filter((item) => item.id !== id)
}

/**
 * Saca una línea de la nota.
 *
 * **No hace nada si:** el id no existe · **es una casilla con hijas**. Lo
 * segundo es decisión cerrada (§9.3): se borra de abajo arriba o no se borra.
 * Ninguna operación del dominio hace desaparecer contenido que el usuario no
 * esté mirando, y borrar una rama de cuarenta casillas por accidente no es un
 * *deshacer* más.
 */
export const remove = (
  content: ReadonlyArray<Content>,
  id: ContentId,
): ReadonlyArray<Content> =>
  updateContainerOf(content, id, {
    onRoot: (items) => removeFrom(items, id),
    onParent: (parent) => {
      const children = removeFrom(parent.children, id)
      return children === parent.children ? parent : { ...parent, children }
    },
  })

/* ───────────────────────────── Cambiando de clase ─────────────────────────────
    Las dos que dispara el botón de `ModosEscritura` (§7.2), y también el
    Retroceso al principio de una casilla de la raíz (§7.3).

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
export const convertToCheckBox = (
  content: ReadonlyArray<Content>,
  id: ContentId,
): ReadonlyArray<Content> =>
  updateContainerOf(content, id, {
    onRoot: (items) =>
      mapPreservingIdentity(items, (item) =>
        item.id === id && isText(item) ? checkBox(item.id, item.text) : item,
      ),
    onParent: (parent) => parent,
  })

/**
 * Una casilla pasa a ser un texto suelto.
 *
 * **No hace nada si:** el id no existe · ya es un texto · **es una casilla con
 * hijas** · **es una casilla anidada**.
 *
 * Los dos últimos son la misma idea vista desde dos sitios: un texto **no puede
 * tener nada colgando** y **sólo cabe en la raíz**. Con hijas, convertir las
 * dejaría colgando de nada —misma regla que `remove`, se convierte de abajo
 * arriba—; anidada, el resultado no cabría donde está, y sin `outdent` no hay
 * forma de hacerle sitio.
 *
 * El caso de la anidada no está escrito como condición en ninguna parte: sale de
 * que `onParent` devuelva la madre intacta.
 */
export const convertToText = (
  content: ReadonlyArray<Content>,
  id: ContentId,
): ReadonlyArray<Content> =>
  updateContainerOf(content, id, {
    onRoot: (items) =>
      mapPreservingIdentity(items, (item) =>
        item.id === id && isCheckBox(item) && item.children.length === 0
          ? text(item.id, item.text)
          : item,
      ),
    onParent: (parent) => parent,
  })
