/**
 * Los textos de la app en inglés.
 *
 * Tiene la forma de `Textos`, como `es`: si le falta una frase, no compila. Las
 * comillas son las inglesas (“…”); las fechas no están aquí, las escribe `Intl`.
 */

import type { Textos } from "./Textos.js"

/** «1 note», «2 notes»: el plural inglés con una -s, para los que la llevan. */
const contar = (n: number, uno: string, varios: string): string => `${n} ${n === 1 ? uno : varios}`

export const en: Textos = {
  codigo: "en",
  nombreIdioma: "English",
  fallos: {
    ilegible: (ruta: string): string => `The file ${ruta} can't be read.`,
    sinPermiso: "The browser won't let ElNotas read or save its data.",
    noEncontrado: "Can't find where the notes are saved.",
    sinSitio: "There's no room left to save anything else.",
    otraPestana:
      "Another tab has changed the same thing as this one. So as not to overwrite it, this tab has stopped saving.",
    alLeerOGuardar: "Something went wrong while reading or saving.",
    versionMasNueva: "These notes were saved with a newer version of ElNotas. Open them with that version.",
    migracionImposible: "These notes come from an old version of ElNotas and couldn't be brought up to date.",
    importacionSinTerminar: (fallo: string, boton: string): string =>
      `The backup didn't finish importing. ${fallo} It will be retried on reload; if it never gets in, “${boton}” starts with whatever already got in.`,
  },
  comun: {
    borrar: "Delete",
    quitar: "Remove",
    cancelar: "Cancel",
    salir: "Exit",
    ordenar: "Reorder",
    guardar: "Save",
    nombre: "Name",
  },
  arranque: {
    reintentar: "Retry",
    abandonarImportacion: "Abandon import",
  },
  avisos: {
    noSeGuarda: (fallo: string): string => `Changes aren't being saved. ${fallo}`,
    seguiraAqui: "What you see is still here, but it will be lost when you close the page.",
    recargar: "Reload",
    ficherosIlegibles: (n: number): string =>
      n === 1
        ? "One file couldn't be read and has been left out:"
        : `${n} files couldn't be read and have been left out:`,
    ficherosSinTocar: (n: number): string =>
      n === 1
        ? "It's still saved, untouched. Everything else is fine."
        : "They're still saved, untouched. Everything else is fine.",
  },
  nombres: {
    nuevoContexto: "New context",
    nuevaNota: "New Note",
    nuevoDiagrama: "New diagram",
    evento: "Event",
    sinNombre: "Untitled",
  },
  ventanas: {
    general: "General",
    calendario: "Calendar",
    anadir: "Add window",
    pestanas: "Windows",
    sinVentanas: "There are no windows.",
    cerrar: (titulo: string): string => `Close “${titulo}”`,
    rotuloNotas: "Notes:",
    rotuloDiagramas: "Diagrams:",
    contextoNuevo: "+ New context",
    notaNueva: "+ New note",
    diagramaNuevo: "+ New diagram",
  },
  lista: {
    vacia: "This window has no notes or diagrams.",
    nuevaNota: "New note",
    nuevoDiagrama: "New diagram",
    moverA: "Move to…",
    ocultos: (n: number): string => `Hidden (${n})`,
    seleccionadas: (n: number): string => `${n} selected`,
    mostrar: "Show",
    ocultar: "Hide",
    variasNotas: (n: number): string => `${n} notes`,
    variosDiagramas: (n: number): string => `${n} diagrams`,
    variosElementos: (n: number): string => `${n} items`,
    preguntaBorrarUno: (nombre: string): string => `Delete “${nombre}”? This can't be undone.`,
    preguntaBorrarVarios: (cuantos: string): string => `Delete ${cuantos}? This can't be undone.`,
  },
  enlaces: {
    textoDelEnlace: "Link text",
    pegarDireccion: "Paste an address",
    enlazar: "Link",
    tituloEnlazar: "Link to",
    grupoNotas: "Notes",
    grupoDiagramas: "Diagrams",
    grupoEventos: "Events",
    grupoRutinas: "Routines",
    abrir: "↗ Open",
    cambiar: "Change",
    textoPorDefecto: "link",
    yaNoExiste: "The link no longer exists",
    direccionNoValida: "That address can't be linked",
    cambiarEnlace: "Change link",
    enlazarPuntos: "Link…",
    quitarEnlace: "Remove link",
  },
  eventos: {
    nuevo: "+ Event",
    ninguno: "No events.",
    pasados: (n: number): string => `Past (${n})`,
    diaInvalido: "Enter a valid day.",
    horaInvalida: "Enter a valid time, like 18:00.",
    sinEventosDia: "No events this day.",
    motivo: "Title",
    dia: "Day",
    hora: "Time",
    preguntaBorrar: "Delete this event? This can't be undone.",
    volverAlDia: "‹ Back to the day",
    eventoNuevo: "New event",
    editar: "Edit event",
  },
  calendario: {
    salir: "Exit calendar",
    mesAnterior: "Previous month",
    mesSiguiente: "Next month",
    hoy: "Today",
    diaAria: (titulo: string, conEventos: boolean, hechas: number | null, total: number): string =>
      `${titulo}${conEventos ? ", with events" : ""}${hechas === null ? "" : `, routines ${hechas} of ${total}`}`,
    pestanaEventos: "Events",
    pestanaRutinas: "Routines",
  },
  diagrama: {
    salir: "✕ Exit",
    nombre: "Diagram name",
    volverAlInicio: "Back to the start",
    seleccionarNodos: "Select nodes",
    borrarMarcados: "Delete selected",
    lienzo: "Diagram canvas",
    tocaElDestino: "Tap the target node",
    textoDelNodo: "Node text",
    textoDeLaRelacion: "Connection label",
    sinTexto: "No text",
    nodoDeTexto: "Text",
    textoRelacion: "Edit label",
    anadirAlDiagrama: "Add to the diagram",
    preguntaBorrarNodos: (n: number): string => (n === 1 ? "Delete 1 node?" : `Delete ${n} nodes?`),
    invertir: "Reverse direction",
    sinDireccion: "No direction",
    conDireccion: "With direction",
    nodo: "Node",
    conectar: "Connect",
    editar: "Edit",
    marcarHecho: "Mark done",
    desmarcarHecho: "Mark not done",
  },
  nota: {
    nombre: "Note name",
    vacia: "This note is empty. Tap to write.",
    casillaAria: (marcada: boolean, atajo: boolean): string =>
      `${marcada ? "Uncheck" : "Check"}${atajo ? " today" : ""}`,
    preguntaBorrarLineas: (n: number): string => (n === 1 ? "Delete 1 line?" : `Delete ${n} lines?`),
    casilla: "Checkbox",
    anidar: "Nest",
    anidarArmado: "Nest armed",
  },
  ajustes: {
    titulo: "Settings",
    salir: "Exit settings",
    nombreContextoNuevo: "New context name",
    masContexto: "+ Context",
    preguntaBorrarContexto: (nombre: string): string => `Delete “${nombre}”? Its notes will stay in General.`,
    colorPantalla: "Screen color",
    fosforoVerde: "Green",
    fosforoAmbar: "Amber",
    fosforoMagenta: "Magenta",
    sinBorrar: "Couldn't delete: the browser won't let the site's data be written.",
    borrarTodo: "Delete everything",
    explicacionBorrarTodo:
      "Deletes every note, diagram, context and window in this browser, and leaves the app as if freshly installed.",
    seccionContextos: "Contexts",
    seccionPantalla: "Screen",
    seccionIdioma: "Language",
    seccionDatos: "Data",
    preguntaEnBlanco: "Reset the app? There's nothing saved.",
    preguntaBorrarTodo: (lista: string): string => `Delete ${lista}, and the windows? This can't be undone.`,
    versionDesarrollo: "Development version",
    version: (version: string): string => `Version ${version}`,
  },
  recuentos: {
    notas: (n: number): string => contar(n, "note", "notes"),
    diagramas: (n: number): string => contar(n, "diagram", "diagrams"),
    contextos: (n: number): string => contar(n, "context", "contexts"),
    unir: (partes: ReadonlyArray<string>): string =>
      partes.length === 1
        ? (partes[0] ?? "")
        : `${partes.slice(0, -1).join(", ")} and ${partes[partes.length - 1] ?? ""}`,
  },
  copia: {
    descripcionFichero: "ElNotas backup",
    compartirEn: "Save the backup to…",
    explicacion:
      "The backup saves the notes, diagrams, contexts, windows and the color to a file. Importing one replaces everything in this browser.",
    exportar: "Export backup",
    importar: "Import backup",
    leyendo: "Reading the backup…",
    sustituirTodo: "Replace everything",
    vacia: "The backup is empty.",
    trae: (lista: string): string => `The backup has ${lista}.`,
    ilegibles: (n: number): string =>
      n === 0
        ? ""
        : n === 1
          ? " 1 file can't be read: it comes in anyway, but won't be shown."
          : ` ${n} files can't be read: they come in anyway, but won't be shown.`,
    preguntaImportar: (trae: string, ilegibles: string): string =>
      `${trae}${ilegibles} Replace everything in this browser with it? What's here now will be lost.`,
    ficheroNoSeLee: "The file couldn't be read.",
    noEsCopia: "That file isn't an ElNotas backup.",
    copiaNueva: "That backup is from a newer version of ElNotas. Update the app and try again.",
    copiaInutil: (fallo: string): string => `That backup can't be used. ${fallo}`,
    noCabe: "The backup doesn't fit in the browser. Nothing has changed.",
    guardadaSinLoUltimo: "Backup saved, but without the latest changes: saving is stopped.",
    guardada: "Backup saved.",
    enviadaSinLoUltimo: "Backup sent, but without the latest changes: saving is stopped.",
    enviada: "Backup sent.",
    noSePudoEscribir: "The backup couldn't be written.",
    noSePudoHacer: (fallo: string): string => `The backup couldn't be made. ${fallo}`,
  },
  rutinas: {
    verElMes: "See the month",
    verLaGrafica: "See the chart",
    opcionesDe: (nombre: string): string => `Options for ${nombre}`,
    nueva: "+ Routine",
    archivadas: (n: number): string => `Archived (${n})`,
    sinMeta: "No goal",
    tituloNueva: "New routine",
    diasPorSemana: "Days per week",
    crear: "Create",
    renombrar: "Rename",
    cambiarMeta: "Change goal",
    archivar: "Archive",
    desarchivar: "Unarchive",
    preguntaBorrar: (nombre: string, dias: number): string =>
      `Delete the routine “${nombre}”? Its ${contar(dias, "checked day", "checked days")} will be lost and this can't be undone. To set it aside without losing them, archive it.`,
    eligeUna: "Pick a routine",
  },
}
