/**
 * La vista configuración: las ventanas, como una fila de fichas que se desliza
 * —arrastrar una para reordenar, ⋮ para cambiar lo que enseña, añadir otra detrás
 * o quitarla—, los contextos, con crear y borrar, el color de la pantalla, y abajo
 * los datos: exportar e importar una copia, y «Borrar todo», que deja la app en
 * blanco tras preguntar.
 *
 * Se monta al abrirla y se desmonta al salir, así que lo que hubiera a medias
 * no sobrevive a salir y volver.
 */

import type { AppState, Context, Logger, Unsubscribe, Store, UseCases } from "#core/index"
import type { BackStack } from "./backStack.js"
import type { BackupActions, ExportResult, ImportPreparation } from "./backup.js"
import { elemento } from "./dom.js"
import { newWindowButtons } from "./newWindowButtons.js"
import { NEW_CONTEXT_NAME } from "./noteActions.js"
import { attachDragReorder } from "./dragReorder.js"
import type { Phosphor, PhosphorChoice, PhosphorSetting } from "./phosphor.js"
import { PHOSPHORS } from "./phosphor.js"
import type { Confirm, Sheet } from "./sheet.js"
import { createSheet } from "./sheet.js"
import { reconcile, setAttrIfChanged, setTextIfChanged } from "./reconcile.js"
import type { SettingsContent, WindowRow } from "./settingsContent.js"
import {
  IMPORT_NOT_APPLIED,
  choiceGroupLabel,
  exportMessage,
  importProblem,
  importQuestion,
  resetQuestion,
  settingsContent,
  versionLine,
} from "./settingsContent.js"
import type { WindowRef, WindowsLayout } from "./windows.js"
import type { WindowsModel } from "./windowsModel.js"

export interface SettingsViewDeps {
  readonly store: Store
  readonly useCases: UseCases
  readonly windows: WindowsModel
  readonly phosphor: PhosphorSetting
  /** Pregunta antes de borrar. Lo pone quien monta la vista. */
  readonly confirm: Confirm
  /** Para la hoja de ⋮, que se cierra con el atrás. */
  readonly back: BackStack
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
  {
    store,
    useCases,
    windows,
    phosphor,
    confirm,
    back,
    onExit,
    onResetAll,
    backup,
    version,
    logger,
  }: SettingsViewDeps,
): (() => void) => {
  const titulo: HTMLHeadingElement = elemento("h1", "Configuración")
  titulo.className = "titulo"
  const cabecera: HTMLElement = elemento("header")
  cabecera.className = "cabecera"
  const salir: HTMLButtonElement = boton("✕", onExit, "flecha")
  salir.setAttribute("aria-label", "Salir de la configuración")
  cabecera.append(titulo, salir)

  const listaVentanas: HTMLElement = elemento("div")
  const listaContextos: HTMLUListElement = elemento("ul")
  listaContextos.className = "ajustes"

  const campo: HTMLInputElement = elemento("input")
  campo.placeholder = NEW_CONTEXT_NAME
  campo.setAttribute("aria-label", "Nombre del contexto nuevo")
  const formulario: HTMLFormElement = elemento("form")
  formulario.className = "crear"
  formulario.append(campo, elemento("button", "+ Contexto"))
  formulario.addEventListener("submit", (evento: SubmitEvent): void => {
    evento.preventDefault()
    const nombre: string = campo.value.trim()
    /* Crear aquí NO le da ventana: para eso está la sección de arriba. */
    useCases.createContext(nombre === "" ? NEW_CONTEXT_NAME : nombre)
    campo.value = ""
  })

  /* ── Las ventanas: fichas en una fila que se desliza, y una «+» al final ── */

  const fichas: HTMLOListElement = elemento("ol")
  const mas: HTMLButtonElement = boton("+", (): void => {
    const ultima: number = windows.getLayout().windows.length - 1
    elegir("Añadir ventana", (ref: WindowRef): void => windows.insertAfter(ultima, ref))
  }, "ficha-mas")
  mas.setAttribute("aria-label", "Añadir ventana")
  const fila: HTMLElement = elemento("div")
  fila.className = "fichas"
  fila.append(fichas, mas)
  listaVentanas.append(fila)

  /* Arrastrar es mantener pulsada una ficha; el ⋮ no la levanta. */
  const soltarArrastre: () => void = attachDragReorder(fila, {
    fichas: "li.ficha",
    ignorar: "button",
    onMove: (de: number, a: number): void => windows.move(de, a),
  })

  /* ── La hoja de ⋮: las tres acciones, y elegir contenido dentro de ella ── */

  const hoja: Sheet = createSheet(back)

  /** Lo que se puede poner en una ventana, y qué hacer con lo elegido. */
  const opciones = (alElegir: (ref: WindowRef) => void): ReadonlyArray<HTMLElement> => {
    const vista: SettingsContent = settingsContent(windows.getLayout(), store.getState())
    const elegido = (ref: WindowRef): void => {
      hoja.close()
      alElegir(ref)
    }
    /* Lo mismo que el «+» de la última ventana: contexto, nota o diagrama nuevos. */
    const nuevos: HTMLElement = newWindowButtons(useCases, elegido)
    const caja: HTMLElement = elemento("div")
    caja.className = "selector"
    /* Las notas y los diagramas, detrás de su rótulo: sin él, una nota y un
       contexto con el mismo nombre no se distinguirían. */
    caja.append(
      ...vista.choices.flatMap((opcion: WindowRow, i: number): ReadonlyArray<HTMLElement> => {
        const texto: string | null = choiceGroupLabel(vista.choices, i)
        const grupo: HTMLElement = elemento("span", texto ?? "")
        grupo.className = "grupo"
        return [
          ...(texto === null ? [] : [grupo]),
          boton(opcion.title, (): void => elegido(opcion.ref)),
        ]
      }),
    )
    return [nuevos, caja]
  }

  const elegir = (titulo: string, alElegir: (ref: WindowRef) => void): void =>
    hoja.open(titulo, opciones(alElegir))

  const menu = (i: number, titulo: string): void => {
    const caja: HTMLElement = elemento("div")
    caja.className = "hoja-acciones"
    /* Cambiar y añadir siguen en la misma hoja: la lista sustituye a las acciones. */
    const enLaHoja = (alElegir: (ref: WindowRef) => void): void =>
      caja.replaceChildren(...opciones(alElegir))
    caja.append(
      boton("Cambiar contenido", (): void =>
        enLaHoja((ref: WindowRef): void => windows.replaceAt(i, ref)),
      ),
      boton("Añadir detrás", (): void =>
        enLaHoja((ref: WindowRef): void => windows.insertAfter(i, ref)),
      ),
      /* Quitar no confirma: sólo quita la referencia, y se vuelve a añadir. */
      boton("Quitar", (): void => {
        hoja.close()
        windows.removeAt(i)
      }, "peligro"),
    )
    hoja.open(titulo, [caja])
  }

  /* ── Pintar ── */

  let pintadoEstado: AppState | null = null
  let pintadoLayout: WindowsLayout | null = null

  /** Una fila de la lista de ventanas, con su posición: es lo que la identifica. */
  interface FilaVentana {
    readonly ventana: WindowRow
    readonly i: number
  }

  const claveDe = (ref: WindowRef): string =>
    ref.kind === "general" ? "general" : `${ref.kind}:${ref.id}`

  const pintar = (forzar: boolean = false): void => {
    const estado: AppState = store.getState()
    const layout: WindowsLayout = windows.getLayout()
    if (!forzar && estado === pintadoEstado && layout === pintadoLayout) return
    pintadoEstado = estado
    pintadoLayout = layout
    const vista: SettingsContent = settingsContent(layout, estado)

    /* Por posición y contenido: sin ventanas duplicadas que confundir, y lo que
       no cambió se queda como estaba. */
    reconcile<FilaVentana, Element>(
      fichas,
      vista.windows.map((ventana: WindowRow, i: number): FilaVentana => ({ ventana, i })),
      {
        key: ({ ventana, i }: FilaVentana): string => `${i}:${claveDe(ventana.ref)}`,
        keyOf: (el: Element): string | null => el.getAttribute("data-key"),
        create: ({ ventana, i }: FilaVentana): Element => {
          const li: HTMLLIElement = elemento("li")
          li.className = "ficha"
          li.dataset["key"] = `${i}:${claveDe(ventana.ref)}`
          const nombre: HTMLSpanElement = elemento("span")
          nombre.className = "nombre"
          /* El título se lee al pulsar: la ficha sobrevive a los renombrados. */
          const puntos: HTMLButtonElement = boton("⋮", (): void =>
            menu(i, nombre.textContent ?? ""),
          "menu")
          li.append(nombre, puntos)
          return li
        },
        update: (li: Element, { ventana }: FilaVentana): void => {
          const nombre: Element | null = li.firstElementChild
          if (nombre !== null) setTextIfChanged(nombre, ventana.title)
          const puntos: Element | null = li.lastElementChild
          if (puntos !== null) setAttrIfChanged(puntos, "aria-label", `Acciones de «${ventana.title}»`)
        },
      },
    )

    /* Por `data-id`: renombrar un contexto no rehace las demás filas. */
    reconcile<Context, Element>(listaContextos, vista.contexts, {
      key: (ctx: Context): string => ctx.id,
      keyOf: (el: Element): string | null => el.getAttribute("data-id"),
      create: (ctx: Context): Element => {
        const li: HTMLLIElement = elemento("li")
        li.dataset["id"] = ctx.id
        li.append(
          elemento("span"),
          boton("Borrar", (): void => {
            /* El nombre se lee al pulsar: la fila sobrevive a los renombrados. */
            const nombre: string = store.getState().contexts[ctx.id]?.name ?? ctx.name
            /* Una de las pocas confirmaciones de la app: no tiene vuelta atrás. */
            confirm(`¿Borrar «${nombre}»? Sus notas seguirán en General.`, "Borrar", (): void => {
              useCases.deleteContext(ctx.id)
            })
          }, "secundario"),
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
  fosforos.setAttribute("aria-label", "Color de la pantalla")
  const marcarElegido = (): void => {
    const elegido: Phosphor = phosphor.get()
    for (const b of fosforos.children) {
      b.setAttribute("aria-pressed", String(b.getAttribute("data-phosphor") === elegido))
    }
  }
  fosforos.append(
    ...PHOSPHORS.map((opcion: PhosphorChoice): HTMLButtonElement => {
      const b: HTMLButtonElement = boton(opcion.label, (): void => {
        phosphor.set(opcion.value)
        marcarElegido()
      })
      b.dataset["phosphor"] = opcion.value
      return b
    }),
  )
  marcarElegido()

  /* ── Borrar todo ── */

  const sinBorrar: HTMLParagraphElement = elemento(
    "p",
    "No se ha podido borrar: el navegador no deja escribir en los datos del sitio.",
  )
  sinBorrar.className = "aviso"
  sinBorrar.setAttribute("role", "alert")
  sinBorrar.hidden = true
  const borrarTodo: HTMLButtonElement = boton("Borrar todo", (): void => {
    /* La pregunta se cuenta al pulsar: dice lo que hay ahora. */
    confirm(resetQuestion(store.getState()), "Borrar todo", (): void => {
      sinBorrar.hidden = onResetAll()
    })
  }, "borrar-todo")
  const explicacion: HTMLParagraphElement = elemento(
    "p",
    "Borra todas las notas, diagramas, contextos y ventanas de este navegador, y deja la app como recién instalada.",
  )
  explicacion.className = "explicacion"

  /* ── La copia: exportar e importar ── */

  const sobreLaCopia: HTMLParagraphElement = elemento(
    "p",
    "La copia guarda en un fichero las notas, diagramas, contextos, ventanas y el color. Importar una sustituye todo lo de este navegador.",
  )
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
  const exportar: HTMLButtonElement = boton("Exportar copia", (): void => {
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
  const importarBoton: HTMLButtonElement = boton("Importar copia", (): void => elegirFichero.click())

  const ocupar = (ocupado: boolean): void => {
    exportar.disabled = ocupado
    importarBoton.disabled = ocupado
  }

  const importar = async (fichero: File): Promise<void> => {
    ocupar(true)
    decir("Leyendo la copia…")
    const preparada: ImportPreparation = await backup.prepareImport(fichero)
    ocupar(false)
    if (preparada.kind !== "ready") {
      decir(importProblem(preparada))
      return
    }
    decir(null)
    /* Pregunta antes, como «Borrar todo»: lo de ahora no vuelve. */
    confirm(importQuestion(preparada.summary), "Sustituir todo", (): void => {
      if (!preparada.apply()) decir(IMPORT_NOT_APPLIED)
    })
  }

  const botonesCopia: HTMLElement = elemento("div")
  botonesCopia.className = "copia"
  botonesCopia.append(exportar, importarBoton, elegirFichero)

  /* «Datos» va abajo del todo de la pantalla, lejos de lo que se toca a diario. */
  const datos: HTMLElement = seccion(
    "Datos",
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
    seccion("Ventanas", listaVentanas),
    seccion("Contextos", formulario, listaContextos),
    seccion("Pantalla", fosforos),
    datos,
    pie,
    hoja.element,
  )
  raiz.replaceChildren(vista)
  pintar()
  const bajas: ReadonlyArray<Unsubscribe> = [
    store.subscribe((): void => pintar()),
    windows.subscribe((): void => pintar()),
  ]

  return (): void => {
    for (const baja of bajas) baja()
    soltarArrastre()
    raiz.replaceChildren()
  }
}
