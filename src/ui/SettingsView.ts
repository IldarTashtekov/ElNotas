/**
 * La vista configuración: el orden de las ventanas —cambiar lo que enseña una,
 * añadir otra detrás, quitarla— y los contextos, con crear y borrar.
 *
 * Se monta al abrirla y se desmonta al salir, así que lo que hubiera a medias
 * —una fila tocada, un selector abierto— no sobrevive a salir y volver.
 */

import type { AppState, Context, Unsubscribe, Store, UseCases } from "#core/index"
import { elemento } from "./dom.js"
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
  readonly confirm: (pregunta: string) => boolean
  readonly onExit: () => void
}

export const NEW_CONTEXT_NAME: string = "Nuevo contexto"

/** Para qué se ha abierto el selector de contenido, y sobre qué ventana. */
interface Eleccion {
  readonly modo: "cambiar" | "añadir"
  readonly i: number
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
  { store, useCases, windows, confirm, onExit }: SettingsViewDeps,
): (() => void) => {
  let tocada: number | null = null
  let eleccion: Eleccion | null = null

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

  /* ── El foco, que no se pierde al repintar ── */

  /** Adónde va el foco tras el próximo repintado. `-1` es la lista vacía. */
  interface Foco {
    readonly fila: number
    readonly en: "fila" | "opcion"
  }
  let foco: Foco | null = null

  const ol: HTMLOListElement = elemento("ol")
  ol.className = "ajustes"
  /* Lo de la lista vacía: el «+ Ventana» o su selector. */
  const sinVentanas: HTMLElement = elemento("div")
  listaVentanas.append(ol, sinVentanas)

  const aplicarFoco = (): void => {
    if (foco === null) return
    const { fila, en }: Foco = foco
    foco = null
    const caja: Element | null | undefined = fila === -1 ? sinVentanas : ol.children[fila]
    const objetivo: Element | null | undefined =
      en === "fila" ? caja?.querySelector("button") : caja?.querySelector(".selector button")
    if (objetivo instanceof HTMLElement) objetivo.focus()
  }

  /* ── Aplicar lo elegido ── */

  const aplicar = (e: Eleccion, ref: WindowRef): void => {
    if (e.modo === "cambiar") windows.replaceAt(e.i, ref)
    else windows.insertAfter(e.i, ref)
    tocada = null
    eleccion = null
    /* A la ventana que se ha cambiado o añadido. */
    foco = { fila: e.modo === "cambiar" ? e.i : e.i + 1, en: "fila" }
    pintar(true)
  }

  const selector = (e: Eleccion, vista: SettingsContent): HTMLElement => {
    const caja: HTMLElement = elemento("div")
    caja.className = "selector"
    caja.append(
      ...vista.choices.map((opcion: WindowRow): HTMLButtonElement =>
        boton(opcion.title, (): void => aplicar(e, opcion.ref)),
      ),
      boton("+ Contexto nuevo", (): void => {
        const nuevo: Context | null = useCases.createContext(NEW_CONTEXT_NAME)
        if (nuevo !== null) aplicar(e, { kind: "context", id: nuevo.id })
      }),
      boton("Cancelar", (): void => {
        eleccion = null
        foco = { fila: e.i, en: "fila" }
        pintar(true)
      }, "secundario"),
    )
    return caja
  }

  const acciones = (i: number): HTMLElement => {
    const caja: HTMLElement = elemento("div")
    caja.className = "acciones"
    caja.append(
      boton("Cambiar contenido", (): void => {
        eleccion = { modo: "cambiar", i }
        foco = { fila: i, en: "opcion" }
        pintar(true)
      }),
      boton("Añadir detrás", (): void => {
        eleccion = { modo: "añadir", i }
        foco = { fila: i, en: "opcion" }
        pintar(true)
      }),
      /* Quitar no confirma: sólo quita la referencia, y se vuelve a añadir. */
      boton("Quitar", (): void => {
        const quedan: number = windows.getLayout().windows.length - 1
        windows.removeAt(i)
        tocada = null
        /* A la que ocupa su sitio, a la de antes si era la última, o al «+ Ventana». */
        foco = { fila: quedan === 0 ? -1 : Math.min(i, quedan - 1), en: "fila" }
        pintar(true)
      }),
    )
    return caja
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
    ref.kind === "general" ? "general" : `context:${ref.id}`

  const pintar = (forzar: boolean = false): void => {
    const estado: AppState = store.getState()
    const layout: WindowsLayout = windows.getLayout()
    if (!forzar && estado === pintadoEstado && layout === pintadoLayout) return
    pintadoEstado = estado
    pintadoLayout = layout
    const vista: SettingsContent = settingsContent(layout, estado)
    /* Si cambian las opciones con un selector abierto, ése se rehace. */
    const firmaOpciones: string = vista.choices
      .map((o: WindowRow): string => `${claveDe(o.ref)}=${o.title}`)
      .join("|")

    /* Por posición y contenido: sin ventanas duplicadas que confundir, y lo que
       no cambió —la fila que tiene el foco incluida— se queda como estaba. */
    reconcile<FilaVentana, Element>(
      ol,
      vista.windows.map((ventana: WindowRow, i: number): FilaVentana => ({ ventana, i })),
      {
        key: ({ ventana, i }: FilaVentana): string => `${i}:${claveDe(ventana.ref)}`,
        keyOf: (el: Element): string | null => el.getAttribute("data-key"),
        create: ({ ventana, i }: FilaVentana): Element => {
          const li: HTMLLIElement = elemento("li")
          li.dataset["key"] = `${i}:${claveDe(ventana.ref)}`
          li.append(
            boton("", (): void => {
              tocada = tocada === i ? null : i
              eleccion = null
              pintar(true)
            }, "fila"),
          )
          return li
        },
        update: (li: Element, { ventana, i }: FilaVentana): void => {
          const fila: Element | null = li.firstElementChild
          if (fila !== null) {
            setTextIfChanged(fila, ventana.title)
            setAttrIfChanged(fila, "aria-expanded", tocada === i ? "true" : "false")
          }
          const e: Eleccion | null = eleccion !== null && eleccion.i === i ? eleccion : null
          const deseado: string =
            e !== null ? `selector:${e.modo}:${firmaOpciones}` : tocada === i ? "acciones" : ""
          if (li.getAttribute("data-extra") === deseado) return
          li.querySelector(":scope > .acciones, :scope > .selector")?.remove()
          if (e !== null) li.append(selector(e, vista))
          else if (tocada === i) li.append(acciones(i))
          li.setAttribute("data-extra", deseado)
        },
      },
    )

    /* Sin ventanas no hay fila que tocar: se añade la primera desde aquí. */
    const vacia: Eleccion | null = eleccion !== null && eleccion.i === -1 ? eleccion : null
    sinVentanas.replaceChildren(
      ...(vista.windows.length > 0
        ? []
        : vacia !== null
          ? [selector(vacia, vista)]
          : [
              boton("+ Ventana", (): void => {
                eleccion = { modo: "añadir", i: -1 }
                foco = { fila: -1, en: "opcion" }
                pintar(true)
              }),
            ]),
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
            if (confirm(`¿Borrar «${nombre}»? Sus notas seguirán en General.`)) {
              useCases.deleteContext(ctx.id)
            }
          }, "secundario"),
        )
        return li
      },
      update: (li: Element, ctx: Context): void => {
        const nombre: Element | null = li.firstElementChild
        if (nombre !== null) setTextIfChanged(nombre, ctx.name)
      },
    })

    aplicarFoco()
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
  )
  pintar()
  const bajas: ReadonlyArray<Unsubscribe> = [
    store.subscribe((): void => pintar()),
    windows.subscribe((): void => pintar()),
  ]

  return (): void => {
    for (const baja of bajas) baja()
    raiz.replaceChildren()
  }
}
