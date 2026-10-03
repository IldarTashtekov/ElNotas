/**
 * La vista configuración: las ventanas, como una fila de fichas que se desliza
 * —arrastrar una para reordenar, ⋮ para cambiar lo que enseña, añadir otra detrás
 * o quitarla—, y los contextos, con crear y borrar.
 *
 * Se monta al abrirla y se desmonta al salir, así que lo que hubiera a medias
 * no sobrevive a salir y volver.
 */

import type { AppState, Context, Unsubscribe, Store, UseCases } from "#core/index"
import type { BackStack } from "./backStack.js"
import { elemento } from "./dom.js"
import { attachDragReorder } from "./dragReorder.js"
import type { Confirm, Sheet } from "./sheet.js"
import { createSheet } from "./sheet.js"
import { reconcile, setAttrIfChanged, setTextIfChanged } from "./reconcile.js"
import type { SettingsContent, WindowRow } from "./settingsContent.js"
import { settingsContent } from "./settingsContent.js"
import type { WindowRef, WindowsLayout } from "./windows.js"
import type { WindowsModel } from "./windowsModel.js"

export interface SettingsViewDeps {
  readonly store: Store
  readonly useCases: UseCases
  readonly windows: WindowsModel
  /** Pregunta antes de borrar. Lo pone quien monta la vista. */
  readonly confirm: Confirm
  /** Para la hoja de ⋮, que se cierra con el atrás. */
  readonly back: BackStack
  readonly onExit: () => void
}

export const NEW_CONTEXT_NAME: string = "Nuevo contexto"

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
  { store, useCases, windows, confirm, back, onExit }: SettingsViewDeps,
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
    const nuevo: HTMLButtonElement = boton("+ Contexto nuevo", (): void => {
      const creado: Context | null = useCases.createContext(NEW_CONTEXT_NAME)
      if (creado !== null) elegido({ kind: "context", id: creado.id })
    }, "hoja-nuevo")
    const caja: HTMLElement = elemento("div")
    caja.className = "selector"
    /* Las notas, detrás de un rótulo: sin él, una nota y un contexto con el
       mismo nombre no se distinguirían. */
    const primeraNota: number = vista.choices.findIndex((o: WindowRow): boolean => o.ref.kind === "note")
    const grupo: HTMLElement = elemento("span", "Notas:")
    grupo.className = "grupo"
    caja.append(
      ...vista.choices.flatMap((opcion: WindowRow, i: number): ReadonlyArray<HTMLElement> => [
        ...(i === primeraNota ? [grupo] : []),
        boton(opcion.title, (): void => elegido(opcion.ref)),
      ]),
    )
    return [nuevo, caja]
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
            /* Una de las dos únicas confirmaciones de la app: no tiene vuelta atrás. */
            confirm(`¿Borrar «${nombre}»? Sus notas seguirán en General.`, "🗑 Borrar", (): void => {
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

  raiz.replaceChildren(
    cabecera,
    seccion("Ventanas", listaVentanas),
    seccion("Contextos", formulario, listaContextos),
    hoja.element,
  )
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
