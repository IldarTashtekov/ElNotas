/**
 * La lista de roturas a propósito que pasa `check-roturas.mjs`.
 *
 * Cada una cambia `buscar` por `poner` en `fichero` —el texto tiene que estar
 * una sola vez— y dice qué tiene que cazarla: `pruebas` (y, si se da, qué
 * `prueba` tiene que caer), o el nombre de un script de npm (un guardián, o
 * `typecheck`). Una guarda nueva, una rotura nueva aquí.
 */

export const ROTURAS = [
  /* ── El core: identidad e integridad ── */
  {
    nombre: "core: una edición que no cambia nada devuelve el mismo estado",
    fichero: "src/core/app/reduce.ts",
    buscar: "  if (content === note.content) return state // ← la línea que lo sostiene todo\n",
    poner: "",
    caza: "pruebas",
    prueba: "set-text con el mismo texto es no-op",
  },
  {
    nombre: "core: setChecked a lo que ya era devuelve la misma línea",
    fichero: "src/core/domain/operations.ts",
    buscar: "block.checked === checked ? block : { ...block, checked }",
    poner: "({ ...block, checked })",
    caza: "pruebas",
    prueba: "reduce: marcar lo ya marcado devuelve EL MISMO estado y no ensucia updatedAt",
  },
  {
    nombre: "core: borrar una nota la quita de sus contextos",
    fichero: "src/core/app/reduce.ts",
    buscar: "  if (afectados.length === 0) return contexts\n",
    poner: "  if (afectados.length >= 0) return contexts\n",
    caza: "pruebas",
    prueba: "delete-note la quita de TODOS los contextos que la listaban",
  },
  {
    nombre: "core: si ningún contexto la lista, los mismos contextos",
    fichero: "src/core/app/reduce.ts",
    buscar: "  if (afectados.length === 0) return contexts\n",
    poner: "  if (afectados.length === 0) return { ...contexts }\n",
    caza: "pruebas",
    prueba: "delete-note de una nota que no está en ningún contexto no toca ninguno",
  },

  /* ── storage ── */
  {
    nombre: "localStorage: leer lo que no está es ok(null), no not-found",
    fichero: "src/storage/blobs/LocalStorageBlobStore.ts",
    buscar: "    if (texto === null) return ok(null)\n",
    poner: '    if (texto === null) return err({ kind: "not-found", path: camino })\n',
    caza: "pruebas",
    prueba: "read de un camino que no existe devuelve ok(null)",
  },
  {
    nombre: "localStorage: list devuelve los caminos sin el espacio de nombres",
    fichero: "src/storage/blobs/LocalStorageBlobStore.ts",
    buscar: "encontrados.push(clave.slice(ESPACIO_DE_NOMBRES.length))",
    poner: "encontrados.push(clave)",
    caza: "pruebas",
    prueba: "list devuelve los caminos SIN prefijo y sólo los del prefijo pedido",
  },
  {
    nombre: "writeBehind: un fallo que no se arregla reintentando lo detiene",
    fichero: "src/storage/writeBehind.ts",
    buscar: "      if (!esReintentable(resultado.error)) {\n",
    poner: "      if (!esReintentable(resultado.error) && (false as boolean)) {\n",
    caza: "pruebas",
    prueba: "un fallo de permission-denied DETIENE al escritor",
  },
  {
    nombre: "writeBehind: un guardado programado que falla se registra",
    fichero: "src/storage/writeBehind.ts",
    buscar: 'logger.failure("falló un guardado programado", guardado.error)',
    poner: "void logger",
    caza: "pruebas",
    prueba: "un guardado automático que falla queda en el registro; uno pedido con flush, no",
  },

  /* ── El fósforo ── */
  {
    nombre: "fósforo: elegir el que ya estaba no hace nada",
    fichero: "src/ui/phosphor.ts",
    buscar: "      if (phosphor === actual) return\n",
    poner: "",
    caza: "pruebas",
    prueba: "elegir el que ya está no hace nada: ni aplica ni guarda",
  },
  {
    nombre: "fósforo: lo que no es un fósforo conocido es el de siempre",
    fichero: "src/ui/phosphor.ts",
    buscar: "?.value ??\n  DEFAULT_PHOSPHOR",
    poner: "?.value ??\n  (guardado as Phosphor)",
    caza: "pruebas",
    prueba: "parsePhosphor convierte cualquier otra cosa en el de siempre",
  },
  {
    nombre: "fósforo: se pinta al crearlo",
    fichero: "src/ui/phosphor.ts",
    buscar: "  apply(actual)\n  return {",
    poner: "  return {",
    caza: "pruebas",
    prueba: "al crearlo aplica lo guardado, sin volver a guardarlo",
  },
  {
    nombre: "fósforo: un fallo al guardar se registra",
    fichero: "src/ui/phosphor.ts",
    buscar: 'logger.failure("no se guardó el fósforo", guardado.error)',
    poner: "void logger",
    caza: "pruebas",
    prueba: "un fallo al guardar queda en el registro, y un guardado bueno no",
  },

  /* ── Las ventanas ── */
  {
    nombre: "ventanas: un fallo al guardar se registra",
    fichero: "src/ui/windowsModel.ts",
    buscar: 'logger.failure("no se guardaron las ventanas", guardado.error)',
    poner: "void logger",
    caza: "pruebas",
    prueba: "un fallo al guardar la lista queda en el registro",
  },
  {
    nombre: "ventanas: un contexto nuevo desde ⚙ se llama como debe",
    fichero: "src/ui/noteActions.ts",
    buscar: "useCases.createContext(NEW_CONTEXT_NAME)",
    poner: 'useCases.createContext("")',
    caza: "pruebas",
    prueba: "+ Contexto nuevo como ventana: un «Nuevo contexto» vacío, y su ventana",
  },

  /* ── Las capas abiertas encima ── */
  {
    nombre: "capas: se corta lo que ya no está, y lo de encima con ello",
    fichero: "src/ui/openLayers.ts",
    buscar: "  return corte === -1 ? layers : layers.slice(0, corte)",
    poner: "  return corte === -2 ? layers.slice(0, corte) : layers",
    caza: "pruebas",
    prueba: "un diagrama borrado no se abre, ni la nota que iba encima",
  },
  {
    nombre: "capas: si no se corta nada, las mismas capas",
    fichero: "src/ui/openLayers.ts",
    buscar: "corte === -1 ? layers :",
    poner: "corte === -1 ? [...layers] :",
    caza: "pruebas",
    prueba: "si están todas, devuelve LAS MISMAS capas",
  },
  {
    nombre: "capas: sólo una nota encima de un diagrama",
    fichero: "src/ui/openLayers.ts",
    buscar: "if (capa === null || !cabeEncima(capas, capa)) break",
    poner: "if (capa === null || (!cabeEncima(capas, capa) && (false as boolean))) break",
    caza: "pruebas",
    prueba: "lo que en la app no puede abrirse así se corta: sólo una nota encima de un diagrama",
  },
  {
    nombre: "capas: al arrancar se reabre sólo lo que existe",
    fichero: "src/ui/openLayers.ts",
    buscar: "leido.ok ? guardOpenLayers(parseOpenLayers(leido.value), state) : NO_LAYERS",
    poner: "leido.ok ? ([parseOpenLayers(leido.value), state][0] as OpenLayers) : NO_LAYERS",
    caza: "pruebas",
    prueba: "al arrancar, lo guardado que ya no está no se abre",
  },

  /* ── El encuadre de los diagramas ── */
  {
    nombre: "encuadre: se olvidan los de diagramas que ya no están",
    fichero: "src/ui/diagramFraming.ts",
    buscar: "  if (vivos.length === ids.length) return framings\n",
    poner: "  return framings\n",
    caza: "pruebas",
    prueba: "se olvidan los encuadres de diagramas que no están",
  },
  {
    nombre: "encuadre: si no sobra ninguno, los mismos encuadres",
    fichero: "src/ui/diagramFraming.ts",
    buscar: "  if (vivos.length === ids.length) return framings\n",
    poner: "  if (vivos.length === ids.length) return { ...framings }\n",
    caza: "pruebas",
    prueba: "si no sobra ninguno, devuelve LOS MISMOS encuadres",
  },
  {
    nombre: "encuadre: sólo se escribe si hay algo nuevo",
    fichero: "src/ui/diagramFraming.ts",
    buscar: "      if (!sucio) return\n",
    poner: "      if (!sucio && (false as boolean)) return\n",
    caza: "pruebas",
    prueba: "guardar escribe lo apuntado una vez; sin nada nuevo, no vuelve a escribir",
  },
  {
    nombre: "encuadre: la escala leída, dentro de sus topes",
    fichero: "src/ui/diagramFraming.ts",
    buscar: "return { x: cx, y: cy, scale: clampScale(scale) }",
    poner: "return { x: cx, y: cy, scale: clampScale(scale) && scale }",
    caza: "pruebas",
    prueba: "una escala leída fuera de los topes entra, pero en el tope",
  },
  {
    nombre: "encuadre: un fallo al guardar se registra",
    fichero: "src/ui/diagramFraming.ts",
    buscar: 'logger.failure("no se guardó el encuadre", guardado.error)',
    poner: "void logger",
    caza: "pruebas",
    prueba: "un fallo al guardar queda en el registro",
  },
  {
    nombre: "encuadre: se recuerda el punto del centro, no la esquina",
    fichero: "src/ui/viewport.ts",
    buscar: "toCanvas(v, { x: width / 2, y: height / 2 })",
    poner: "toCanvas(v, { x: width * 0, y: height * 0 })",
    caza: "pruebas",
    prueba: "lo recordado es el punto del corcho en el centro y la escala; al volver, se ve igual",
  },
  {
    nombre: "copia: sin encuadres que leer, la copia los lleva a null",
    fichero: "src/platform/web/exportBackup.ts",
    buscar: "framing: encuadres.ok ? encuadres.value : null",
    poner: "framing: encuadres.ok ? encuadres.value : {}",
    caza: "pruebas",
    prueba: "ventanas, fósforo o encuadres que no se pueden leer van a null, sin fallar",
  },
  {
    nombre: "copia: una copia sin encuadres no escribe encuadres",
    fichero: "src/platform/web/importStorage.ts",
    buscar: "  if (copia.framing !== null) {\n",
    poner: "  if (true as boolean) {\n",
    caza: "pruebas",
    prueba: "si la copia no trae ventanas, fósforo ni encuadres, los de antes también se van",
  },

  /* ── El editor ── */
  {
    nombre: "editor: tocar el hueco escribe tras la última línea",
    fichero: "src/ui/noteTree.ts",
    buscar: "  return todas[todas.length - 1] ?? null\n",
    poner: "  return todas[0] ?? null\n",
    caza: "pruebas",
    prueba: "la última línea que se ve, aunque sea una hija honda; ninguna si la nota está vacía",
  },

  /* ── Los guardianes y la verja ── */
  {
    nombre: "verja: el core no conoce el DOM",
    fichero: "src/core/domain/Result.ts",
    buscar: "export const ok = ",
    poner: "export const _d: unknown = document.title\nexport const ok = ",
    caza: "typecheck:core",
  },
  {
    nombre: "check:purity: el core no lee el reloj",
    fichero: "src/core/domain/Result.ts",
    buscar: "export const ok = ",
    poner: "export const _t: number = Date.now()\nexport const ok = ",
    caza: "check:purity",
  },
  {
    nombre: "check:fronteras: getItem fuera de su try",
    fichero: "src/platform/web/LocalStoragePhosphor.ts",
    buscar: "    try {\n      return ok(almacen.getItem(PHOSPHOR_KEY))\n",
    poner: "    return ok(almacen.getItem(PHOSPHOR_KEY))\n    try {\n      return ok(almacen.getItem(PHOSPHOR_KEY))\n",
    caza: "check:fronteras",
  },
  {
    nombre: "check:fronteras: pushState fuera de su try",
    fichero: "src/ui/backStack.ts",
    buscar: "    try {\n      window.history.pushState({ capa }, \"\")\n",
    poner: "    window.history.pushState({ capa }, \"\")\n    try {\n",
    caza: "check:fronteras",
  },
  {
    nombre: "check:fronteras: replaceState fuera de su try",
    fichero: "src/ui/backStack.ts",
    buscar: "  try {\n    window.history.replaceState(null, \"\")\n",
    poner: "  window.history.replaceState(null, \"\")\n  try {\n",
    caza: "check:fronteras",
  },
  {
    nombre: "check:extensiones: un import relativo sin .js",
    fichero: "src/ui/App.ts",
    buscar: 'import { createBackStack } from "./backStack.js"',
    poner: 'import { createBackStack } from "./backStack"',
    caza: "check:extensiones",
  },
  {
    nombre: "check:descartes: un Result tirado con void",
    fichero: "src/ui/phosphor.ts",
    buscar: "const guardado: Result<void, StorageError> = persistence.save(actual)",
    poner: "void persistence.save(actual); const guardado: Result<void, StorageError> = ok(undefined)",
    caza: "check:descartes",
  },
]
