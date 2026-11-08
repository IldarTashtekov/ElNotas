/**
 * La vista configuración: los contextos, con crear y borrar, el color de la
 * pantalla y el idioma, y abajo los datos: exportar e importar una copia, y «Borrar todo»,
 * que deja la app en blanco tras preguntar.
 *
 * Se monta al abrirla y se desmonta al salir, así que lo que hubiera a medias
 * no sobrevive a salir y volver.
 */

import type { AppState, Context, Logger, Unsubscribe, Store, UseCases } from "#core/index"
import type { BackupActions, ExportResult, ImportPreparation } from "./backup.js"
import { elemento } from "./dom.js"
import type { Language, LanguageChoice, LanguageSetting } from "./language.js"
import { languageChoices } from "./language.js"
import type { Phosphor, PhosphorChoice, PhosphorSetting } from "./phosphor.js"
import { phosphorChoices } from "./phosphor.js"
import type { Confirm } from "./sheet.js"
import { reconcile, setTextIfChanged } from "./reconcile.js"
import type { SettingsContent } from "./settingsContent.js"
import {
  exportMessage,
  importProblem,
  importQuestion,
  resetQuestion,
  settingsContent,
  versionLine,
} from "./settingsContent.js"
import { textos } from "./textos/idioma.js"

export interface SettingsViewDeps {
  readonly store: Store
  readonly useCases: UseCases
  readonly phosphor: PhosphorSetting
  readonly language: LanguageSetting
  /** Pregunta antes de borrar. Lo pone quien monta la vista. */
  readonly confirm: Confirm
  readonly onExit: () => void
  /**
   * Deja la app en blanco: lo hace quien sabe dónde se guarda, porque la UI no
   * lo sabe. `false` si no se pudo.
   */
  readonly onResetAll: () => boolean
  /** Exportar e importar la copia: también lo hace quien sabe dónde se guarda. */
  readonly backup: BackupActions
  /** La versión publicada; `null` en desarrollo. */
  readonly version: string | null
  readonly logger: Logger
}

const boton = (texto: string, alPulsar: () => void, clase?: string): HTMLButtonElement => {
  const b: HTMLButtonElement = elemento("button", texto)
  b.type = "button"
  if (clase !== undefined) b.className = clase
  b.addEventListener("click", alPulsar)
  return b
}

/** Devuelve la función que la desmonta. */
export const mountSettingsView = (
  raiz: HTMLElement,
  { store, useCases, phosphor, language, confirm, onExit, onResetAll, backup, version, logger }: SettingsViewDeps,
): (() => void) => {
  const titulo: HTMLHeadingElement = elemento("h1", textos.ajustes.titulo)
  titulo.className = "titulo"
  const cabecera: HTMLElement = elemento("header")
  cabecera.className = "cabecera"
  const salir: HTMLButtonElement = boton("✕", onExit, "flecha")
  salir.setAttribute("aria-label", textos.ajustes.salir)
  cabecera.append(titulo, salir)

  const listaContextos: HTMLUListElement = elemento("ul")
  listaContextos.className = "ajustes"

  const campo: HTMLInputElement = elemento("input")
  campo.placeholder = textos.nombres.nuevoContexto
  campo.setAttribute("aria-label", textos.ajustes.nombreContextoNuevo)
  const formulario: HTMLFormElement = elemento("form")
  formulario.className = "crear"
  formulario.append(campo, elemento("button", textos.ajustes.masContexto))
  formulario.addEventListener("submit", (evento: SubmitEvent): void => {
    evento.preventDefault()
    const nombre: string = campo.value.trim()
    /* Crear aquí NO le da ventana: para eso está el «+» de las pestañas. */
    useCases.createContext(nombre === "" ? textos.nombres.nuevoContexto : nombre)
    campo.value = ""
  })

  /* ── Pintar ── */

  let pintadoEstado: AppState | null = null

  const pintar = (): void => {
    const estado: AppState = store.getState()
    if (estado === pintadoEstado) return
    pintadoEstado = estado
    const vista: SettingsContent = settingsContent(estado)

    /* Por `data-id`: renombrar un contexto no rehace las demás filas. */
    reconcile<Context, Element>(listaContextos, vista.contexts, {
      key: (ctx: Context): string => ctx.id,
      keyOf: (el: Element): string | null => el.getAttribute("data-id"),
      create: (ctx: Context): Element => {
        const li: HTMLLIElement = elemento("li")
        li.dataset["id"] = ctx.id
        li.append(
          elemento("span"),
          boton(
            textos.comun.borrar,
            (): void => {
              /* El nombre se lee al pulsar: la fila sobrevive a los renombrados. */
              const nombre: string = store.getState().contexts[ctx.id]?.name ?? ctx.name
              /* Una de las pocas confirmaciones de la app: no tiene vuelta atrás. */
              confirm(textos.ajustes.preguntaBorrarContexto(nombre), textos.comun.borrar, (): void => {
                useCases.deleteContext(ctx.id)
              })
            },
            "secundario",
          ),
        )
        return li
      },
      update: (li: Element, ctx: Context): void => {
        const nombre: Element | null = li.firstElementChild
        if (nombre !== null) setTextIfChanged(nombre, ctx.name)
      },
    })
  }

  const seccion = (nombre: string, ...hijos: ReadonlyArray<HTMLElement>): HTMLElement => {
    const s: HTMLElement = elemento("section")
    s.append(elemento("h2", nombre), ...hijos)
    return s
  }

  /* ── La pantalla: un botón por fósforo, el elegido en vídeo inverso ── */

  const fosforos: HTMLElement = elemento("div")
  fosforos.className = "fosforos"
  fosforos.setAttribute("role", "group")
  fosforos.setAttribute("aria-label", textos.ajustes.colorPantalla)
  const marcarElegido = (): void => {
    const elegido: Phosphor = phosphor.get()
    for (const b of fosforos.children) {
      b.setAttribute("aria-pressed", String(b.getAttribute("data-phosphor") === elegido))
    }
  }
  fosforos.append(
    ...phosphorChoices().map((opcion: PhosphorChoice): HTMLButtonElement => {
      const b: HTMLButtonElement = boton(opcion.label, (): void => {
        phosphor.set(opcion.value)
        marcarElegido()
      })
      b.dataset["phosphor"] = opcion.value
      return b
    }),
  )
  marcarElegido()

  /* ── El idioma: igual, cada uno escrito en el suyo; elegir otro recarga ── */

  const idiomas: HTMLElement = elemento("div")
  idiomas.className = "fosforos idiomas"
  idiomas.setAttribute("role", "group")
  idiomas.setAttribute("aria-label", textos.ajustes.idioma)
  const actual: Language = language.get()
  idiomas.append(
    ...languageChoices().map((opcion: LanguageChoice): HTMLButtonElement => {
      const b: HTMLButtonElement = boton(opcion.label, (): void => language.set(opcion.value))
      b.lang = opcion.value
      b.dataset["language"] = opcion.value
      b.setAttribute("aria-pressed", String(opcion.value === actual))
      return b
    }),
  )

  /* ── Borrar todo ── */

  const sinBorrar: HTMLParagraphElement = elemento("p", textos.ajustes.sinBorrar)
  sinBorrar.className = "aviso"
  sinBorrar.setAttribute("role", "alert")
  sinBorrar.hidden = true
  const borrarTodo: HTMLButtonElement = boton(
    textos.ajustes.borrarTodo,
    (): void => {
      /* La pregunta se cuenta al pulsar: dice lo que hay ahora. */
      confirm(resetQuestion(store.getState()), textos.ajustes.borrarTodo, (): void => {
        sinBorrar.hidden = onResetAll()
      })
    },
    "borrar-todo",
  )
  const explicacion: HTMLParagraphElement = elemento("p", textos.ajustes.explicacionBorrarTodo)
  explicacion.className = "explicacion"

  /* ── La copia: exportar e importar ── */

  const sobreLaCopia: HTMLParagraphElement = elemento("p", textos.copia.explicacion)
  sobreLaCopia.className = "explicacion"
  /* Lo que pasó con la última copia; vacío y escondido hasta entonces. */
  const estadoCopia: HTMLParagraphElement = elemento("p")
  estadoCopia.className = "estado-copia"
  estadoCopia.setAttribute("role", "status")
  estadoCopia.hidden = true
  const decir = (texto: string | null): void => {
    estadoCopia.textContent = texto ?? ""
    estadoCopia.hidden = texto === null
  }

  const exportarCopia = async (): Promise<void> => {
    ocupar(true)
    decir(null)
    const resultado: ExportResult = await backup.exportAll()
    ocupar(false)
    decir(exportMessage(resultado))
  }
  const exportar: HTMLButtonElement = boton(textos.copia.exportar, (): void => {
    exportarCopia().catch((fallo: unknown): void => logger.failure("falló exportar la copia", fallo))
  })

  /* El selector de ficheros del sistema, escondido: lo abre el botón. */
  const elegirFichero: HTMLInputElement = elemento("input")
  elegirFichero.type = "file"
  elegirFichero.accept = ".json,application/json"
  elegirFichero.hidden = true
  elegirFichero.addEventListener("change", (): void => {
    const fichero: File | undefined = elegirFichero.files?.[0]
    /* Vacío otra vez: así elegir el mismo fichero dos veces vuelve a avisar. */
    elegirFichero.value = ""
    if (fichero !== undefined) {
      importar(fichero).catch((fallo: unknown): void => logger.failure("falló importar la copia", fallo))
    }
  })
  const importarBoton: HTMLButtonElement = boton(textos.copia.importar, (): void => elegirFichero.click())

  const ocupar = (ocupado: boolean): void => {
    exportar.disabled = ocupado
    importarBoton.disabled = ocupado
  }

  const importar = async (fichero: File): Promise<void> => {
    ocupar(true)
    decir(textos.copia.leyendo)
    const preparada: ImportPreparation = await backup.prepareImport(fichero)
    ocupar(false)
    if (preparada.kind !== "ready") {
      decir(importProblem(preparada))
      return
    }
    decir(null)
    /* Pregunta antes, como «Borrar todo»: lo de ahora no vuelve. */
    confirm(importQuestion(preparada.summary), textos.copia.sustituirTodo, (): void => {
      if (!preparada.apply()) decir(textos.copia.noCabe)
    })
  }

  const botonesCopia: HTMLElement = elemento("div")
  botonesCopia.className = "copia"
  botonesCopia.append(exportar, importarBoton, elegirFichero)

  /* «Datos» va abajo del todo de la pantalla, lejos de lo que se toca a diario. */
  const datos: HTMLElement = seccion(
    textos.ajustes.seccionDatos,
    sobreLaCopia,
    botonesCopia,
    estadoCopia,
    explicacion,
    borrarTodo,
    sinBorrar,
  )
  datos.className = "datos"
  /* Con la actualización en silencio, la única forma de saber qué versión corre. */
  const pie: HTMLParagraphElement = elemento("p", versionLine(version))
  pie.className = "version"
  const vista: HTMLElement = elemento("div")
  vista.className = "vista-ajustes"
  vista.append(
    cabecera,
    seccion(textos.ajustes.seccionContextos, formulario, listaContextos),
    seccion(textos.ajustes.seccionPantalla, fosforos, idiomas),
    datos,
    pie,
  )
  raiz.replaceChildren(vista)
  pintar()
  const baja: Unsubscribe = store.subscribe((): void => pintar())

  return (): void => {
    baja()
    raiz.replaceChildren()
  }
}
