/**
 * La vista configuración: el orden de las ventanas —cambiar lo que enseña una,
 * añadir otra detrás, quitarla— y los contextos, con crear y borrar.
 *
 * Se monta al abrirla y se desmonta al salir, así que lo que hubiera a medias
 * —una fila tocada, un selector abierto— no sobrevive a salir y volver.
 */

import type { AppState, Context, Unsubscribe, Store, UseCases } from "#core/index"
import { elemento } from "./dom.js"
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

  /* ── Aplicar lo elegido ── */

  const aplicar = (e: Eleccion, ref: WindowRef): void => {
    if (e.modo === "cambiar") windows.replaceAt(e.i, ref)
    else windows.insertAfter(e.i, ref)
    tocada = null
    eleccion = null
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
        pintar(true)
      }),
      boton("Añadir detrás", (): void => {
        eleccion = { modo: "añadir", i }
        pintar(true)
      }),
      /* Quitar no confirma: sólo quita la referencia, y se vuelve a añadir. */
      boton("Quitar", (): void => {
        windows.removeAt(i)
        tocada = null
        pintar(true)
      }),
    )
    return caja
  }

  /* ── Pintar ── */

  let pintadoEstado: AppState | null = null
  let pintadoLayout: WindowsLayout | null = null

  const pintar = (forzar: boolean = false): void => {
    const estado: AppState = store.getState()
    const layout: WindowsLayout = windows.getLayout()
    if (!forzar && estado === pintadoEstado && layout === pintadoLayout) return
    pintadoEstado = estado
    pintadoLayout = layout
    const vista: SettingsContent = settingsContent(layout, estado)

    const filas: ReadonlyArray<HTMLLIElement> = vista.windows.map(
      (ventana: WindowRow, i: number): HTMLLIElement => {
        const li: HTMLLIElement = elemento("li")
        const abierta: boolean = tocada === i
        const fila: HTMLButtonElement = boton(ventana.title, (): void => {
          tocada = abierta ? null : i
          eleccion = null
          pintar(true)
        }, "fila")
        fila.setAttribute("aria-expanded", abierta ? "true" : "false")
        li.append(fila)
        if (eleccion !== null && eleccion.i === i) li.append(selector(eleccion, vista))
        else if (abierta) li.append(acciones(i))
        return li
      },
    )
    const ol: HTMLOListElement = elemento("ol")
    ol.className = "ajustes"
    ol.append(...filas)

    /* Sin ventanas no hay fila que tocar: se añade la primera desde aquí. */
    const primera: ReadonlyArray<HTMLElement> =
      vista.windows.length > 0
        ? []
        : eleccion !== null && eleccion.i === -1
          ? [selector(eleccion, vista)]
          : [
              boton("+ Ventana", (): void => {
                eleccion = { modo: "añadir", i: -1 }
                pintar(true)
              }),
            ]
    listaVentanas.replaceChildren(ol, ...primera)

    listaContextos.replaceChildren(
      ...vista.contexts.map((ctx: Context): HTMLLIElement => {
        const li: HTMLLIElement = elemento("li")
        li.dataset["id"] = ctx.id
        li.append(
          elemento("span", ctx.name),
          boton("Borrar", (): void => {
            /* Una de las dos únicas confirmaciones de la app: no tiene vuelta atrás. */
            if (confirm(`¿Borrar «${ctx.name}»? Sus notas seguirán en General.`)) {
              useCases.deleteContext(ctx.id)
            }
          }, "secundario"),
        )
        return li
      }),
    )
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
