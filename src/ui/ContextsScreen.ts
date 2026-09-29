/**
 * La pantalla mínima de la primera rebanada: la lista de contextos, un campo para
 * crear uno nuevo y, si al arrancar hubo ficheros ilegibles, el aviso de cuáles.
 *
 * Es provisional a propósito: sólo demuestra que lo creado aquí sobrevive a
 * recargar. La sustituye la vista ventanas.
 */

import type { AppState, Context, StorageError, Store, UseCases } from "#core/index"
import { describeStorageError } from "./messages.js"

export interface ContextsScreenDeps {
  readonly store: Store
  readonly useCases: UseCases
  /** Los ficheros que no se pudieron leer al arrancar. Vacío es lo normal. */
  readonly corrupt: ReadonlyArray<StorageError>
}

const NOMBRE_POR_DEFECTO: string = "Nuevo contexto"

const elemento = <K extends keyof HTMLElementTagNameMap>(
  etiqueta: K,
  texto?: string,
): HTMLElementTagNameMap[K] => {
  const el: HTMLElementTagNameMap[K] = document.createElement(etiqueta)
  if (texto !== undefined) el.textContent = texto
  return el
}

const avisoDeIlegibles = (corrupt: ReadonlyArray<StorageError>): HTMLElement => {
  const aviso: HTMLElement = elemento("div")
  aviso.className = "aviso"
  aviso.setAttribute("role", "alert")
  aviso.append(
    elemento(
      "p",
      corrupt.length === 1
        ? "Un fichero no se ha podido leer y se ha dejado fuera:"
        : `${corrupt.length} ficheros no se han podido leer y se han dejado fuera:`,
    ),
  )
  const lista: HTMLUListElement = elemento("ul")
  lista.append(
    ...corrupt.map((fallo: StorageError): HTMLLIElement => elemento("li", describeStorageError(fallo))),
  )
  aviso.append(lista, elemento("p", "Siguen guardados sin tocar. El resto está bien."))
  return aviso
}

const ordenados = (state: AppState): ReadonlyArray<Context> =>
  [...Object.values<Context>(state.contexts)].sort((a: Context, b: Context): number =>
    a.name.localeCompare(b.name),
  )

export const mountContextsScreen = (
  raiz: HTMLElement,
  { store, useCases, corrupt }: ContextsScreenDeps,
): void => {
  const lista: HTMLUListElement = elemento("ul")
  lista.className = "contextos"

  const pintarLista = (state: AppState): void => {
    lista.replaceChildren(
      ...ordenados(state).map((ctx: Context): HTMLLIElement => {
        const fila: HTMLLIElement = elemento("li", ctx.name)
        fila.dataset["id"] = ctx.id
        return fila
      }),
    )
  }

  const campo: HTMLInputElement = elemento("input")
  campo.placeholder = NOMBRE_POR_DEFECTO
  campo.setAttribute("aria-label", "Nombre del contexto")
  const formulario: HTMLFormElement = elemento("form")
  formulario.append(campo, elemento("button", "+ Contexto"))
  formulario.addEventListener("submit", (evento: SubmitEvent): void => {
    evento.preventDefault()
    const nombre: string = campo.value.trim()
    useCases.createContext(nombre === "" ? NOMBRE_POR_DEFECTO : nombre)
    campo.value = ""
  })

  raiz.replaceChildren(
    ...(corrupt.length > 0 ? [avisoDeIlegibles(corrupt)] : []),
    elemento("h1", "ElNotas"),
    formulario,
    lista,
  )

  /* Sólo se repinta si cambiaron los contextos: el core devuelve el MISMO objeto
     cuando no hay cambios, así que basta con comparar identidades. */
  let pintados: AppState["contexts"] = store.getState().contexts
  pintarLista(store.getState())
  store.subscribe((state: AppState): void => {
    if (state.contexts === pintados) return
    pintados = state.contexts
    pintarLista(state)
  })
}
