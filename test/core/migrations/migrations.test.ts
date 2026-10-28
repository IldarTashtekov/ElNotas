/**
 * La hidratación y el runner de migraciones: la parte pura del arranque.
 *
 * Las migraciones se prueban con una lista **inventada aquí**, no con
 * `MIGRATIONS`, que está vacía a propósito porque todavía no hay nada guardado
 * con un esquema viejo. Probar el runner no exige inventarse un pasado: exige
 * inyectarle una lista, que es justo por lo que la recibe por parámetro.
 */

import { test } from "node:test"
import assert from "node:assert/strict"

import type { Day } from "#core/domain/calendar"
import { parseDay } from "#core/domain/calendar"
import type { CalendarEvent } from "#core/domain/CalendarEvent"
import type { Context } from "#core/domain/Context"
import type { EventGroup } from "#core/domain/EventGroup"
import type { Diagram, DiagramNode, DiagramRelation, NoteNode, SimpleNode } from "#core/domain/Diagram"
import type { MigrationError } from "#core/domain/errors/MigrationError"
import type { DiagramNodeId, DiagramRelationId, ItemRef, NoteId } from "#core/domain/Ids"
import {
  contextId,
  diagramId,
  diagramNodeId,
  diagramRef,
  diagramRelationId,
  eventGroupId,
  eventId,
  noteId,
  noteRef,
  revision,
} from "#core/domain/Ids"
import type { Note } from "#core/domain/Note"
import type { Result } from "#core/domain/Result"
import type { StoredEntities } from "#core/migrations/hydrate"
import { hydrate } from "#core/migrations/hydrate"
import type { Migration, MigrationResult } from "#core/migrations/runMigrations"
import {
  CURRENT_SCHEMA_VERSION,
  EMPTY_STORE_VERSION,
  MIGRATIONS,
  runMigrations,
} from "#core/migrations/runMigrations"

/**
 * Abre un resultado que se espera **bueno**, y falla la prueba con un mensaje
 * útil si venía un error. Existe sólo para no repetir el `if (!r.ok)` en cada
 * prueba: `assert.ok(r.ok)` no estrecha el tipo, así que sin esto habría que
 * escribir la guarda a mano cinco veces.
 */
const valorDe = (r: Result<MigrationResult, MigrationError>): MigrationResult => {
  if (!r.ok) {
    assert.fail(`se esperaba un resultado correcto y vino ${r.error.kind}`)
  }
  return r.value
}

/** Y el simétrico, para los dos caminos que fallan. */
const errorDe = (r: Result<MigrationResult, MigrationError>): MigrationError => {
  if (r.ok) {
    assert.fail("se esperaba un error y la migración dijo que fue bien")
  }
  return r.error
}

/* ────────────────────────────── El escenario ────────────────────────────── */

const ID_COMPRA = noteId("compra")
const ID_FANTASMA = noteId("borrada-hace-tiempo")
const ID_CASA = contextId("casa")
const ID_VACIO = contextId("vacio")

const COMPRA: Note = {
  id: ID_COMPRA,
  name: "Compra",
  content: [],
  updatedAt: 0,
  revision: revision("rev-compra"),
}

const contexto = (id: typeof ID_CASA, items: Context["items"]): Context => ({
  id,
  name: "Un contexto",
  defaultView: { type: "context" },
  items,
  updatedAt: 0,
  revision: revision(`rev-${id}`),
})

/* ──────────────────────────────── hydrate ─────────────────────────────────── */

test("hydrate pasa de listas a mapas por id", () => {
  const stored: StoredEntities = {
    notes: [COMPRA],
    diagrams: [],
    contexts: [contexto(ID_CASA, [noteRef(ID_COMPRA)])],
  }

  const state = hydrate(stored)
  assert.strictEqual(state.notes[ID_COMPRA], COMPRA)
  assert.equal(Object.keys(state.contexts).length, 1)
})

test("hydrate de un almacén vacío da un estado vacío", () => {
  const state = hydrate({ notes: [], diagrams: [], contexts: [] })
  assert.deepEqual(state, { notes: {}, diagrams: {}, contexts: {}, events: {}, eventGroups: {} })
})

test("hydrate pasa los eventos y los grupos a mapas, y quita de un grupo lo que no existe ni una vez repetido", () => {
  const cita: CalendarEvent = {
    id: eventId("cita"),
    day: parseDay("2026-07-02") as Day,
    title: "Cita",
    done: false,
    updatedAt: 0,
    revision: revision("r-cita"),
  }
  const sano: EventGroup = {
    id: eventGroupId("sano"),
    name: "Sano",
    events: [cita.id],
    updatedAt: 0,
    revision: revision("r-sano"),
  }
  const roto: EventGroup = {
    id: eventGroupId("roto"),
    name: "Roto",
    events: [cita.id, eventId("fantasma"), cita.id],
    updatedAt: 0,
    revision: revision("r-roto"),
  }

  const state = hydrate({ notes: [], diagrams: [], contexts: [], events: [cita], eventGroups: [sano, roto] })

  assert.strictEqual(state.events[cita.id], cita)
  assert.deepEqual(state.eventGroups[roto.id]?.events, [cita.id])
  assert.strictEqual(state.eventGroups[sano.id], sano, "el grupo sano sale intacto, por referencia")
})

test("hydrate tira las ItemRef que apuntan a algo que ya no está", () => {
  const stored: StoredEntities = {
    notes: [COMPRA],
    diagrams: [],
    contexts: [contexto(ID_CASA, [noteRef(ID_COMPRA), noteRef(ID_FANTASMA)])],
  }

  const state = hydrate(stored)
  assert.deepEqual(state.contexts[ID_CASA]?.items, [noteRef(ID_COMPRA)])
})

test("hydrate tira también las referencias a diagramas inexistentes", () => {
  const stored: StoredEntities = {
    notes: [],
    diagrams: [],
    contexts: [contexto(ID_CASA, [diagramRef(diagramId("no-existe"))])],
  }

  assert.deepEqual(hydrate(stored).contexts[ID_CASA]?.items, [])
})

test("un arranque NORMAL devuelve los contextos INTACTOS, por referencia", () => {
  /*
      ⚠️ La prueba que evita que la app se reescriba entera cada vez que arranca.
      `filter` crea siempre un array nuevo: si `hydrate` copiara los contextos sin
      necesidad, el primer diff contra lo guardado los daría todos por sucios y el
      write-behind los volcaría a disco sin que nada hubiera cambiado.
  */
  const sano = contexto(ID_CASA, [noteRef(ID_COMPRA)])
  const vacio = contexto(ID_VACIO, [])

  const state = hydrate({ notes: [COMPRA], diagrams: [], contexts: [sano, vacio] })

  assert.strictEqual(state.contexts[ID_CASA], sano)
  assert.strictEqual(state.contexts[ID_VACIO], vacio)
})

/* La nota rota: existe en el almacén, pero no se pudo leer y no está en `notes`. */
const ID_ROTA = noteId("rota")
const esRota = (item: ItemRef): boolean => item.kind === "note" && item.id === ID_ROTA

test("hydrate CONSERVA la referencia a una nota ilegible, y tira la inexistente", (): void => {
  const stored: StoredEntities = {
    notes: [COMPRA],
    diagrams: [],
    contexts: [contexto(ID_CASA, [noteRef(ID_ROTA), noteRef(ID_COMPRA), noteRef(ID_FANTASMA)])],
  }

  const items: ReadonlyArray<ItemRef> | undefined = hydrate(stored, esRota).contexts[ID_CASA]?.items
  assert.deepEqual(items, [noteRef(ID_ROTA), noteRef(ID_COMPRA)])
})

test("con sólo una ilegible de más, el contexto queda INTACTO, por referencia", (): void => {
  const conRota: Context = contexto(ID_CASA, [noteRef(ID_COMPRA), noteRef(ID_ROTA)])
  const state = hydrate({ notes: [COMPRA], diagrams: [], contexts: [conRota] }, esRota)
  assert.strictEqual(state.contexts[ID_CASA], conRota)
})

test("la nota ilegible NO entra en el estado: sólo se conserva su referencia", (): void => {
  const state = hydrate(
    { notes: [COMPRA], diagrams: [], contexts: [contexto(ID_CASA, [noteRef(ID_ROTA)])] },
    esRota,
  )
  assert.equal(state.notes[ID_ROTA], undefined)
})

/* Lo oculto de un contexto: siempre dentro de `items`. */

test("hydrate tira de hidden lo que no está en items, y lo que ya no existe", (): void => {
  const casa: Context = {
    ...contexto(ID_CASA, [noteRef(ID_COMPRA), noteRef(ID_FANTASMA)]),
    hidden: [noteRef(ID_COMPRA), noteRef(ID_FANTASMA), diagramRef(diagramId("suelto"))],
  }
  const state = hydrate({ notes: [COMPRA], diagrams: [], contexts: [casa] })
  assert.deepEqual(state.contexts[ID_CASA]?.hidden, [noteRef(ID_COMPRA)])
})

test("hydrate CONSERVA oculta una nota ilegible del contexto", (): void => {
  const casa: Context = { ...contexto(ID_CASA, [noteRef(ID_ROTA)]), hidden: [noteRef(ID_ROTA)] }
  const state = hydrate({ notes: [], diagrams: [], contexts: [casa] }, esRota)
  assert.strictEqual(state.contexts[ID_CASA], casa)
})

test("con algo oculto y nada que tirar, el contexto queda INTACTO, por referencia", (): void => {
  const casa: Context = { ...contexto(ID_CASA, [noteRef(ID_COMPRA)]), hidden: [noteRef(ID_COMPRA)] }
  const state = hydrate({ notes: [COMPRA], diagrams: [], contexts: [casa] })
  assert.strictEqual(state.contexts[ID_CASA], casa)
})

test("hydrate no se inventa un hidden en un contexto que no lo tenía", (): void => {
  const state = hydrate({
    notes: [],
    diagrams: [],
    contexts: [contexto(ID_CASA, [noteRef(ID_FANTASMA)])],
  })
  assert.equal(state.contexts[ID_CASA] !== undefined && "hidden" in state.contexts[ID_CASA], false)
})

/* ─────────────────────────── hydrate y los diagramas ───────────────────────────
    Dos limpiezas: la relación con un extremo que no está (o de un nodo a sí
    mismo) se tira, y el nodo de una nota que ya no existe —y no está ilegible—
    pasa a «Nota perdida». */

const ID_A: DiagramNodeId = diagramNodeId("a")
const ID_B: DiagramNodeId = diagramNodeId("b")
const ID_NODO_NOTA: DiagramNodeId = diagramNodeId("nodo-nota")

const nodoTexto = (id: DiagramNodeId): SimpleNode => ({
  type: "simple-node",
  id,
  text: id,
  positionX: 0,
  positionY: 0,
  done: false,
})

const nodoDeNota = (nota: NoteId): NoteNode => ({
  type: "note-node",
  id: ID_NODO_NOTA,
  noteId: nota,
  positionX: 7,
  positionY: 8,
  done: true,
})

const relacion = (id: string, from: DiagramNodeId, to: DiagramNodeId): DiagramRelation => ({
  id: diagramRelationId(id),
  from,
  to,
  directed: true,
  label: "",
})

const diagramaCon = (
  nodos: ReadonlyArray<DiagramNode>,
  relaciones: ReadonlyArray<DiagramRelation>,
): Diagram => ({
  id: diagramId("mudanza"),
  name: "Mudanza",
  nodes: Object.fromEntries(nodos.map((n: DiagramNode): readonly [DiagramNodeId, DiagramNode] => [n.id, n])),
  relations: Object.fromEntries(
    relaciones.map((r: DiagramRelation): readonly [DiagramRelationId, DiagramRelation] => [r.id, r]),
  ),
  updatedAt: 0,
  revision: revision("rev-mudanza"),
})

const hidratado = (d: Diagram, notas: ReadonlyArray<Note>, ilegible?: (item: ItemRef) => boolean): Diagram => {
  const r: Diagram | undefined = hydrate({ notes: notas, diagrams: [d], contexts: [] }, ilegible).diagrams[d.id]
  if (r === undefined) assert.fail("el diagrama no ha llegado al estado")
  return r
}

test("hydrate tira la relación con un extremo que no está, y conserva la sana", (): void => {
  const sana: DiagramRelation = relacion("sana", ID_A, ID_B)
  const d: Diagram = diagramaCon(
    [nodoTexto(ID_A), nodoTexto(ID_B)],
    [sana, relacion("rota-from", diagramNodeId("x"), ID_B), relacion("rota-to", ID_A, diagramNodeId("x"))],
  )
  const r: Diagram = hidratado(d, [])
  assert.deepEqual(Object.keys(r.relations), ["sana"])
  assert.strictEqual(r.relations[sana.id], sana)
  assert.strictEqual(r.nodes, d.nodes)
})

test("hydrate tira la relación de un nodo a sí mismo", (): void => {
  const d: Diagram = diagramaCon([nodoTexto(ID_A)], [relacion("bucle", ID_A, ID_A)])
  assert.deepEqual(hidratado(d, []).relations, {})
})

test("hydrate pasa a «Nota perdida» el nodo de una nota que no existe", (): void => {
  const d: Diagram = diagramaCon([nodoDeNota(ID_FANTASMA)], [])
  assert.deepEqual(hidratado(d, []).nodes[ID_NODO_NOTA], {
    type: "simple-node",
    id: ID_NODO_NOTA,
    positionX: 7,
    positionY: 8,
    done: true,
    text: "Nota perdida",
  })
})

test("hydrate CONSERVA el nodo de una nota ilegible: no está perdida", (): void => {
  const d: Diagram = diagramaCon([nodoDeNota(ID_ROTA)], [])
  assert.strictEqual(hidratado(d, [], esRota), d)
})

test("hydrate conserva el nodo de una nota que existe", (): void => {
  const d: Diagram = diagramaCon([nodoDeNota(ID_COMPRA)], [])
  assert.strictEqual(hidratado(d, [COMPRA]), d)
})

test("hydrate hace las dos limpiezas en el mismo diagrama, y conserva las relaciones del nodo perdido", (): void => {
  const d: Diagram = diagramaCon(
    [nodoTexto(ID_A), nodoDeNota(ID_FANTASMA)],
    [relacion("al-perdido", ID_A, ID_NODO_NOTA), relacion("rota", ID_A, diagramNodeId("x"))],
  )
  const r: Diagram = hidratado(d, [])
  assert.deepEqual(Object.keys(r.relations), ["al-perdido"])
  assert.equal(r.nodes[ID_NODO_NOTA]?.type, "simple-node")
})

test("un arranque NORMAL devuelve los diagramas INTACTOS, por referencia", (): void => {
  /* La misma razón que con los contextos: un diagrama copiado sin necesidad
     saldría sucio en el primer diff y se reescribiría en disco. */
  const d: Diagram = diagramaCon(
    [nodoTexto(ID_A), nodoTexto(ID_B), nodoDeNota(ID_COMPRA)],
    [relacion("r", ID_A, ID_B)],
  )
  assert.strictEqual(hidratado(d, [COMPRA]), d)
})

/* ───────────────────────────── runMigrations ──────────────────────────────── */

test("un almacén vacío no migra nada y queda en la versión actual", () => {
  const r: MigrationResult = valorDe(runMigrations({ nada: true }, EMPTY_STORE_VERSION))

  assert.equal(r.applied, 0, "ha intentado migrar un almacén vacío")
  assert.equal(r.version, CURRENT_SCHEMA_VERSION)
})

test("un almacén ya en la versión actual no migra nada", () => {
  const datos: { readonly notes: ReadonlyArray<Note> } = { notes: [] }
  const r: MigrationResult = valorDe(runMigrations(datos, CURRENT_SCHEMA_VERSION))

  assert.equal(r.applied, 0)
  assert.strictEqual(r.data, datos, "ha tocado los datos sin necesidad")
})

test("las migraciones se aplican en cadena y en orden", () => {
  const pasos: ReadonlyArray<Migration> = [
    { from: 2, migrate: (d) => `${String(d)}→3` },
    { from: 1, migrate: (d) => `${String(d)}→2` }, // a propósito, desordenada
  ]

  const r: MigrationResult = valorDe(runMigrations("v1", 1, { migrations: pasos, target: 3 }))

  assert.equal(r.applied, 2)
  assert.equal(r.version, 3)
  // El orden lo marca `from`, no la posición en la lista.
  assert.equal(r.data, "v1→2→3")
})

test("se aplican SÓLO las que faltan, no la cadena entera", () => {
  const pasos: ReadonlyArray<Migration> = [
    { from: 1, migrate: (d) => `${String(d)}→2` },
    { from: 2, migrate: (d) => `${String(d)}→3` },
  ]

  const r: MigrationResult = valorDe(runMigrations("v2", 2, { migrations: pasos, target: 3 }))

  assert.equal(r.applied, 1, "ha vuelto a aplicar una migración ya aplicada")
  assert.equal(r.data, "v2→3")
})

test("falta la migración que hace falta: lo DEVUELVE en vez de corromper", () => {
  const fallo: MigrationError = errorDe(runMigrations("viejo", 1, { migrations: [], target: 2 }))

  assert.equal(fallo.kind, "missing-migration")
  if (fallo.kind === "missing-migration") {
    // El escalón exacto que falta, para que se pueda decir cuál hay que escribir.
    assert.equal(fallo.from, 1)
  }
})

test("una migración que REVIENTA se devuelve, no se escapa lanzando", () => {
  /*
      ⚠️ El agujero que esto cierra era real y estaba medido: `paso.migrate()`
      se llamaba sin `try`, así que una migración que lanzara **salía de
      `runMigrations` como excepción** — por una firma que promete `Result` y
      desde la función que este fichero llama "pura y TOTAL".

      No era alcanzable en producción sólo porque `MIGRATIONS` está vacía. La
      primera migración de verdad es exactamente este caso, y corre al arrancar
      la app sobre las notas del usuario: el peor sitio para una excepción
      suelta.

      `migrate` es código ajeno, igual que el `fn` de `transaction`, y por eso
      se trata igual.
  */
  const explosivo: Error = new Error("el fichero viejo no tenía ese campo")
  const pasos: ReadonlyArray<Migration> = [
    {
      from: 1,
      migrate: (): unknown => {
        throw explosivo
      },
    },
  ]

  const fallo: MigrationError = errorDe(
    runMigrations("viejo", 1, { migrations: pasos, target: 2 }),
  )

  assert.equal(fallo.kind, "migration-failed")
  if (fallo.kind === "migration-failed") {
    // Qué paso reventó, sin lo cual no hay forma de arreglarlo.
    assert.equal(fallo.from, 1)
    // Y la excepción original INTACTA, no un mensaje reescrito.
    assert.strictEqual(fallo.cause, explosivo)
  }
})

test("si una migración revienta, las siguientes NI SE INTENTAN", () => {
  let segundaLlamada: boolean = false
  const pasos: ReadonlyArray<Migration> = [
    {
      from: 1,
      migrate: (): unknown => {
        throw new Error("boom")
      },
    },
    {
      from: 2,
      migrate: (d: unknown): unknown => {
        segundaLlamada = true
        return d
      },
    },
  ]

  errorDe(runMigrations("viejo", 1, { migrations: pasos, target: 3 }))

  /* Seguir encadenando sobre datos que se quedaron a medias es justo la forma
     de corromperlos, que es lo que esta taxonomía existe para evitar. */
  assert.equal(segundaLlamada, false)
})

test("datos de una versión MÁS NUEVA que el código: lo DEVUELVE", () => {
  /*
      Pasa de verdad: alguien abre su fichero con una versión nueva de la app y
      luego con una vieja. Seguir adelante leyendo campos que no entiende y
      volviendo a escribir corrompería sus notas, así que aquí sigue siendo un
      error y no un no-op — a diferencia del reducer, que ante una acción rara no
      hace nada. Lo que cambia es que ahora viaja en el valor de retorno.
  */
  const fallo: MigrationError = errorDe(runMigrations({}, CURRENT_SCHEMA_VERSION + 1))

  assert.equal(fallo.kind, "schema-from-future")
  if (fallo.kind === "schema-from-future") {
    assert.equal(fallo.stored, CURRENT_SCHEMA_VERSION + 1)
    assert.equal(fallo.supported, CURRENT_SCHEMA_VERSION)
  }
})

test("runMigrations es TOTAL: no lanza ni con lo que antes lanzaba", () => {
  /*
      ⚠️ La prueba que fija la propiedad nueva. Los dos caminos de arriba ya
      comprueban el `Result`, pero ninguno impediría que alguien volviera a meter
      un `throw` en otro sitio de la función; esto sí, y es lo que distingue
      "pura" de "pura y total".
  */
  assert.doesNotThrow(() => runMigrations({}, CURRENT_SCHEMA_VERSION + 1))
  assert.doesNotThrow(() => runMigrations("viejo", 1, { migrations: [], target: 2 }))
})

test("la lista de migraciones está vacía, y es correcto", () => {
  // No hay nada guardado con un esquema viejo: el primero es el primero.
  // Escribir una migración de ejemplo sería inventarse un pasado que no existe.
  assert.deepEqual(MIGRATIONS, [])
  assert.equal(CURRENT_SCHEMA_VERSION, 1)
})
