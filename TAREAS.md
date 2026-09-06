# Tareas de ElNotas

Qué está pendiente, qué está sin decidir y qué ideas hay aparcadas. El diseño y sus por qués
están en `ARCHITECTURE.md`; las reglas para agentes, en `CLAUDE.md`.

**La disciplina que mantiene vivo este fichero: cada entrada tiene que ser cerrable.**
"Mejorar la UI" no se cierra nunca y no entra aquí. "Que `npm test` falle sin ficheros de
test" sí. Si una entrada no se puede marcar como hecha, o está mal escrita o es una idea
aparcada.

---

## Pendiente

### Fase 1 — Dominio puro (en curso)

En este orden. El helper va primero y solo: es la única pieza con dificultad real y todo lo
demás se apoya en ella.

- [ ] **El helper de copia por camino**, con sus tests de identidad. Tiene que devolver el
      array de entrada **intacto** en dos casos: id ausente, y transformación que no cambia
      nada. El segundo es el que se olvida. Depende de la decisión **(e)**.
- [ ] **El tipo `Position`**, que es el vocabulario del "dónde" que hoy falta en el modelo.
      Los tres casos de la propuesta (`root-end`, `after`, `last-child-of`) son
      **provisionales, no acordados**: cuáles son exactamente es la decisión **(d)**.
- [ ] **Las nueve operaciones de contenido**, en orden de coste:
  - [ ] `setText`, `setChecked` — triviales encima del helper; no cambian la estructura.
  - [ ] `insert`, `remove` — coste medio. `remove` depende de la decisión **(b)**.
  - [ ] `move` — **aquí está el trabajo real de la fase.** Ojo al destino dentro del propio
        subárbol: hay que detectarlo o generas un ciclo (decisión **(c)**).
  - [ ] `indent`, `outdent` — **son `move` disfrazado**: `indent` es "muévete a última hija de
        tu hermano anterior" y `outdent` es "muévete a hermano siguiente de tu madre". Si
        `move` está bien hecho salen en **~3 líneas cada una**. No escribir un recorrido de
        árbol propio para ellas. `indent` depende de la decisión **(a)**; `outdent`, de la
        **(g)**.
  - [ ] `split`, `merge` — pendientes de confirmar (decisión **(f)**).
- [ ] **Un test explícito por cada caso no-op** de la tabla de `ARCHITECTURE.md` §9.3. Con
      `assert.strictEqual`, nunca `deepEqual`.
- [ ] **`core/ports/Clock.ts` y `core/ports/IdGenerator.ts`** — solo las interfaces, cuatro
      líneas, dentro del core. Sin implementaciones: no hacen falta hasta la Fase 4.
- [ ] **La rebanada vertical:** `Store`, un reducer con un único caso (`set-checked`), un caso
      de uso, y un suscriptor de prueba que cuente notificaciones. Debe demostrar que un
      `set-checked` redundante **no notifica y no toca `updatedAt`**.
- [ ] **Exportar todo lo nuevo por `src/core/index.ts`**, que es la API pública del módulo.
      Fácil de olvidar: si no está ahí, para el resto del proyecto no existe.

Criterio de cierre de la fase: los seis puntos de `ARCHITECTURE.md` §9.5.

### Infraestructura (`infra-agent`)

Las cuatro son de `src/`, `package.json` o los tsconfig, así que **no las toca el rol de
documentación**.

- [ ] **Que `npm test` falle si no hay ficheros de test.** Hoy `node --test` sin ficheros
      imprime `1..0` y **sale con código 0**, así que `npm run check` pasa entero sin
      comprobar ni un comportamiento. Mientras siga así, "los tests pasan" no significa nada.
- [ ] **Un `grep` en `npm run check` que falle ante `Date.now()`, `Math.random()` o
      `new Date(` en `src/core`** (excluyendo `**/*.test.ts`). Tapa el único hueco de la verja
      de pureza: `Date` y `Math` están en `lib.es5.d.ts`, o sea dentro de `lib: ["ES2020"]`, y
      **compilan** dentro del core. `IdGenerator` lo protege el compilador; `Clock` hoy solo
      lo protege la convención.
- [ ] **Corregir el comentario de `src/core/domain/Versioned.ts:16`**, que afirma que
      `updatedAt` viene del puerto `Clock` "nunca de `Date.now()` — dentro del core eso no
      compila". La primera mitad es la regla y sigue en pie; **la segunda es falsa** y
      comprobada como tal.
- [ ] **Borrar la mención a vitest del comentario de `src/core/tsconfig.json`** (línea 21:
      "los tests sí pueden usar APIs de plataforma y el paquete de vitest"). Vitest se evaluó
      y se descartó; es un comentario muerto que contradice a `CLAUDE.md`.

---

## Sin decidir

**No las resuelva por su cuenta quien implemente.** Si te topas con una, pregunta.

### Las siete de la Fase 1

| | Pregunta | Qué depende de ella |
|---|---|---|
| **(a)** | `indent` sobre un `Text`: ¿no-op, o lo convierte en `CheckBox`? Surge porque `CheckBox.children` es `ReadonlyArray<CheckBox>`, así que un `Text` no cabe dentro de una casilla. | `indent`, y `move` con destino `last-child-of`. |
| **(b)** | `remove` de una casilla con hijas: ¿se va el subárbol entero, o las hijas suben al nivel donde estaba la madre? | `remove`. Es **la que más cambia cómo se siente la app** al usarla; las dos son defendibles. |
| **(c)** | `move` con destino dentro del propio subárbol: es no-op por convención, pero **hay que detectarlo** o generas un ciclo. | `move`. Va en la especificación aunque parezca implementación: si no está escrito, no se testea. |
| **(d)** | Qué casos tiene exactamente `Position`. Faltan candidatos evidentes (`before`, `first-child-of`, `root-start`). | `insert`, `move`, `indent`, `outdent`. Cada caso extra es una rama más que testear en `move`, que ya es la operación más cara. |
| **(e)** | El helper: ¿dos funciones separadas de ~25 líneas, o una parametrizada por dos transformaciones? La asimetría raíz/profundidad impide una firma recursiva uniforme. | **Todo lo demás de la fase.** Es la única decisión de diseño con dificultad real. |
| **(f)** | ¿Se confirma que son **nueve** operaciones (con `split` y `merge`) y no siete? | La Fase 4: sin `split` y `merge` no se puede escribir con el teclado. |
| **(g)** | `outdent`: al sacar una casilla de su madre, ¿qué pasa con **los hermanos que quedaban por debajo** de ella? ¿Se quedan donde están, o se van con ella? | `outdent`. La implementación borrada hacía lo primero (no los adoptaba) y varios outliners populares hacen lo segundo — pero **eso nunca se registró como decisión**, así que hoy está abierta. Es el ejemplo de cómo se cuela una: resuelta en el código, en ningún documento. |

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

### La justificación escrita de `schemaVersion` no es la real

`Versioned` (`updatedAt` + `revision`) se adelantó a la Fase 1 con el argumento de que
"añadirlo cuando ya haya notas guardadas sería una migración de datos". `schemaVersion` se
aplaza a la Fase 2.

El problema: **como todavía no hay persistencia, ese argumento no aplica a ninguno de los
dos.** No hay datos guardados que migrar, así que no distingue un caso del otro.

La decisión aguanta, pero **por otra razón**: `schemaVersion` **es** el mecanismo de migración,
y no tiene sentido que preceda al runner que lo consume — un número de versión sin nadie que
lo lea no protege nada. Lo que hay que decidir es si se adopta esa razón como la oficial y se
reescribe, o si el reparto era arbitrario y hay que replantearlo.

### El arranque de la app no tiene fase asignada

El plan cubre modelo → operaciones → reducers → puertos → adaptadores → UI, pero **nunca dice
cómo arranca la app**: leer del storage, hidratar `AppState`, aplicar migraciones si la versión
del esquema es vieja, y qué se muestra si no hay nada guardado (¿primer arranque? ¿nota de
bienvenida? ¿contexto vacío?).

Vive a caballo entre `core/app/` y `platform/web/`, y **no tiene dueño de fase**. Encaja en la
2 (con el runner de migraciones) o en la 4 (con la composición real en `platform/web/`), pero
mientras no se asigne es lo típico que se descubre el día que se necesita.

---

## Ideas aparcadas

Lo que se contempló y no se eligió. Cada una con **qué haría falta para que mereciera la
pena**: esa última parte es la que evita volver a discutirlo desde cero.

| Idea | Por qué no ahora | Qué la desbloquearía |
|---|---|---|
| **Adaptador de MongoDB** | Requiere un backend HTTP propio: el driver de Mongo habla TCP y no funciona desde navegador, y la Data API de Atlas está retirada. | Que hubiera ya un backend propio por otro motivo. Montar uno solo para esto no sale a cuenta. |
| **Adaptador de Google Drive** | Escribir **siempre** exige OAuth (scope `drive.file`), aunque la carpeta sea pública. Eso arrastra registro de app, PKCE y gestión de tokens. | Querer de verdad sincronizar entre dispositivos, y aceptar el coste de OAuth. Antes tendría que estar cerrado el `BlobStore`. |
| **`CompositeStorage` y outbox durable** | Sin consumidor mientras haya un solo backend. La semántica (local primario + réplicas con reintentos) ya está decidida. | Que exista un segundo backend real. Ni un día antes: es infraestructura para un problema que aún no se tiene. |
| **`storageTarget` por contexto** (enrutar notas privadas a un backend concreto) | Presupone varios backends, que no existen. | Lo mismo que el anterior, más una necesidad real de separar notas por destino. |
| **El editor de grafos de los Planes** | Los tipos de `Plan` están, pero no hay ni una operación. Es una app dentro de la app. | Que la parte de Notas esté terminada y en uso. Anotado: si llega, `Plan.nodes` probablemente deba pasar de array a `Record`, porque las aristas se guardan por id y con array toda búsqueda es lineal. |
| **Shells de escritorio y móvil (Tauri / Capacitor)** | Envuelven el output del build web; no hay build web todavía. | Una Fase 4 terminada. Y ese es el momento de reconsiderar los workspaces de npm, no antes. |
| **Sync entre dispositivos, CRDTs, colaboración en tiempo real** | Salto enorme de complejidad. `revision` ya deja la puerta abierta a detectar conflictos, que es el 10% que sí hacía falta desde el principio. | Uso real en dos dispositivos y una política de conflictos elegida a conciencia. "Gana el último" ya está descartada. |
| **Migrar de webpack a Vite** | Webpack sigue siendo el bundler previsto para la Fase 4, hoy desinstalado. Migrar **no afecta a la arquitectura**, así que no urge. | Llegar a la Fase 4 y comparar los dos entonces. Está fuera de "decisiones cerradas" a propósito: es una opción abierta, no un compromiso. |
| **Prototipo desechable del editor** (solo DOM, sin core y sin persistencia) | Es trabajo que se tira. | Nada: **puede que merezca la pena ya.** El editor con `contenteditable` es la parte más difícil del proyecto, está **al final del plan** y es la única sin verificación automática posible. Un prototipo de un rato responde pronto a la pregunta que más riesgo esconde: ¿aguanta en la práctica la regla de que "el nodo enfocado no se re-renderiza"? Si no aguanta, es mejor saberlo antes de construir tres fases encima. |
