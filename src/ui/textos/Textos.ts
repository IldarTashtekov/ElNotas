/**
 * La forma de los textos de la app: todo lo que escribe ella, no el usuario.
 *
 * Cada idioma es un objeto con esta forma, así que a uno al que le falte una
 * frase no compila. Van agrupados por dónde se ven; las frases con datos son
 * funciones.
 */

export interface Textos {
  /** El código del idioma, para `Intl` y el `lang` de la página. */
  readonly codigo: "es" | "en"
  /** El nombre del idioma escrito en él mismo: así sale en el selector de ⚙. */
  readonly nombreIdioma: string
  readonly fallos: {
    readonly ilegible: (ruta: string) => string
    readonly sinPermiso: string
    readonly noEncontrado: string
    readonly sinSitio: string
    readonly otraPestana: string
    readonly alLeerOGuardar: string
    readonly versionMasNueva: string
    readonly migracionImposible: string
    /** La pantalla de una importación a medias; `boton` es el que la abandona, debajo. */
    readonly importacionSinTerminar: (fallo: string, boton: string) => string
  }
  readonly comun: {
    readonly borrar: string
    readonly quitar: string
    readonly cancelar: string
    readonly salir: string
    readonly ordenar: string
    readonly guardar: string
    readonly nombre: string
  }
  readonly arranque: {
    readonly reintentar: string
    readonly abandonarImportacion: string
  }
  readonly avisos: {
    readonly noSeGuarda: (fallo: string) => string
    readonly seguiraAqui: string
    readonly recargar: string
    readonly ficherosIlegibles: (n: number) => string
    readonly ficherosSinTocar: (n: number) => string
  }
  readonly nombres: {
    readonly nuevoContexto: string
    readonly nuevaNota: string
    readonly nuevoDiagrama: string
    /** El motivo que se le pone a un evento sin motivo, como «Nueva Nota» a una nota. */
    readonly evento: string
    readonly sinNombre: string
  }
  readonly ventanas: {
    readonly general: string
    readonly calendario: string
    readonly anadir: string
    readonly pestanas: string
    readonly sinVentanas: string
    readonly cerrar: (titulo: string) => string
    readonly rotuloNotas: string
    readonly rotuloDiagramas: string
    readonly contextoNuevo: string
    readonly notaNueva: string
    readonly diagramaNuevo: string
  }
  readonly lista: {
    readonly vacia: string
    readonly nuevaNota: string
    readonly nuevoDiagrama: string
    readonly moverA: string
    readonly ocultos: (n: number) => string
    readonly seleccionadas: (n: number) => string
    readonly mostrar: string
    readonly ocultar: string
    readonly variasNotas: (n: number) => string
    readonly variosDiagramas: (n: number) => string
    readonly variosElementos: (n: number) => string
    readonly preguntaBorrarUno: (nombre: string) => string
    readonly preguntaBorrarVarios: (cuantos: string) => string
  }
  readonly enlaces: {
    readonly textoDelEnlace: string
    readonly pegarDireccion: string
    /** El botón que enlaza la dirección pegada. */
    readonly enlazar: string
    /** El título de la hoja de elegir enlace. */
    readonly tituloEnlazar: string
    readonly grupoNotas: string
    readonly grupoDiagramas: string
    readonly grupoEventos: string
    readonly grupoRutinas: string
    readonly abrir: string
    readonly cambiar: string
    readonly textoPorDefecto: string
    readonly yaNoExiste: string
    readonly direccionNoValida: string
    readonly cambiarEnlace: string
    readonly enlazarPuntos: string
    readonly quitarEnlace: string
  }
  readonly eventos: {
    readonly nuevo: string
    readonly ninguno: string
    readonly pasados: (n: number) => string
    readonly diaInvalido: string
    readonly horaInvalida: string
    readonly sinEventosDia: string
    readonly motivo: string
    readonly dia: string
    readonly hora: string
    readonly preguntaBorrar: string
    readonly volverAlDia: string
    readonly eventoNuevo: string
    readonly editar: string
  }
  readonly calendario: {
    readonly salir: string
    readonly mesAnterior: string
    readonly mesSiguiente: string
    readonly hoy: string
    /** Lo que se lee de un día del mes; `hechas`, null si no se enseñan las rutinas. */
    readonly diaAria: (titulo: string, conEventos: boolean, hechas: number | null, total: number) => string
    readonly pestanaEventos: string
    readonly pestanaRutinas: string
  }
  readonly diagrama: {
    readonly salir: string
    readonly nombre: string
    readonly volverAlInicio: string
    readonly seleccionarNodos: string
    readonly borrarMarcados: string
    readonly lienzo: string
    readonly tocaElDestino: string
    readonly textoDelNodo: string
    readonly textoDeLaRelacion: string
    readonly sinTexto: string
    /** En el menú del fondo: crea un nodo de texto. */
    readonly nodoDeTexto: string
    /** En el menú de una relación: edita su texto. */
    readonly textoRelacion: string
    readonly anadirAlDiagrama: string
    readonly preguntaBorrarNodos: (n: number) => string
    readonly invertir: string
    readonly sinDireccion: string
    readonly conDireccion: string
    readonly nodo: string
    readonly conectar: string
    readonly editar: string
    readonly marcarHecho: string
    readonly desmarcarHecho: string
  }
  readonly nota: {
    readonly nombre: string
    readonly vacia: string
    readonly casillaAria: (marcada: boolean, atajo: boolean) => string
    readonly preguntaBorrarLineas: (n: number) => string
    readonly casilla: string
    readonly anidar: string
    readonly anidarArmado: string
  }
  readonly ajustes: {
    readonly titulo: string
    readonly salir: string
    readonly nombreContextoNuevo: string
    readonly masContexto: string
    readonly preguntaBorrarContexto: (nombre: string) => string
    readonly colorPantalla: string
    readonly fosforoVerde: string
    readonly fosforoAmbar: string
    readonly fosforoMagenta: string
    readonly sinBorrar: string
    readonly borrarTodo: string
    readonly explicacionBorrarTodo: string
    readonly seccionContextos: string
    readonly seccionPantalla: string
    readonly seccionIdioma: string
    readonly seccionDatos: string
    readonly preguntaEnBlanco: string
    readonly preguntaBorrarTodo: (lista: string) => string
    readonly versionDesarrollo: string
    readonly version: (version: string) => string
  }
  readonly recuentos: {
    readonly notas: (n: number) => string
    readonly diagramas: (n: number) => string
    readonly contextos: (n: number) => string
    readonly unir: (partes: ReadonlyArray<string>) => string
  }
  readonly copia: {
    readonly descripcionFichero: string
    /** El título de la hoja «Compartir» de Android al exportar desde la app. */
    readonly compartirEn: string
    readonly explicacion: string
    readonly exportar: string
    readonly importar: string
    readonly leyendo: string
    readonly sustituirTodo: string
    readonly vacia: string
    readonly trae: (lista: string) => string
    readonly ilegibles: (n: number) => string
    readonly preguntaImportar: (trae: string, ilegibles: string) => string
    readonly ficheroNoSeLee: string
    readonly noEsCopia: string
    readonly copiaNueva: string
    readonly copiaInutil: (fallo: string) => string
    /** Cuando se confirmó, pero la copia no cabe para apuntarla. */
    readonly noCabe: string
    readonly guardadaSinLoUltimo: string
    readonly guardada: string
    /** En la app de Android: la copia se pasó a otra app, que es lo único que se sabe. */
    readonly enviadaSinLoUltimo: string
    readonly enviada: string
    readonly noSePudoEscribir: string
    readonly noSePudoHacer: (fallo: string) => string
  }
  readonly rutinas: {
    readonly verElMes: string
    readonly verLaGrafica: string
    readonly opcionesDe: (nombre: string) => string
    readonly nueva: string
    readonly archivadas: (n: number) => string
    readonly sinMeta: string
    readonly tituloNueva: string
    readonly diasPorSemana: string
    readonly crear: string
    readonly renombrar: string
    readonly cambiarMeta: string
    readonly archivar: string
    readonly desarchivar: string
    readonly preguntaBorrar: (nombre: string, dias: number) => string
    readonly eligeUna: string
  }
}
