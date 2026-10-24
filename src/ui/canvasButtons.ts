/**
 * Los botones del lienzo, que van flotando sobre él o en la barra de quien lo
 * monta: la mira, que vuelve al origen, y el de seleccionar nodos. No son del
 * lienzo: tocarlos no arrastra el corcho ni abre ningún menú.
 */

import { elemento } from "./dom.js"

/** Un elemento SVG: `elemento` crea los de HTML, y éstos van en otro espacio de nombres. */
export const svg = <K extends keyof SVGElementTagNameMap>(etiqueta: K): SVGElementTagNameMap[K] =>
  document.createElementNS("http://www.w3.org/2000/svg", etiqueta)

/** Un dibujo de 24 × 24, en el color del texto del botón. */
const dibujo = (...partes: ReadonlyArray<SVGElement>): SVGSVGElement => {
  const el: SVGSVGElement = svg("svg")
  el.setAttribute("viewBox", "0 0 24 24")
  el.setAttribute("aria-hidden", "true")
  el.append(...partes)
  return el
}

/** La mira: un círculo con cuatro marcas y un punto. */
const dibujoMira = (): SVGSVGElement => {
  const circulo: SVGCircleElement = svg("circle")
  circulo.setAttribute("cx", "12")
  circulo.setAttribute("cy", "12")
  circulo.setAttribute("r", "7")
  const marcas: SVGPathElement = svg("path")
  marcas.setAttribute("d", "M12 1v6M12 17v6M1 12h6M17 12h6")
  const punto: SVGCircleElement = svg("circle")
  punto.setAttribute("class", "punto")
  punto.setAttribute("cx", "12")
  punto.setAttribute("cy", "12")
  punto.setAttribute("r", "1.5")
  return dibujo(circulo, marcas, punto)
}

/** Seleccionar: un rectángulo de trazos, el que se dibuja con el dedo. */
const dibujoSeleccion = (): SVGSVGElement => {
  const marco: SVGRectElement = svg("rect")
  marco.setAttribute("x", "3.5")
  marco.setAttribute("y", "3.5")
  marco.setAttribute("width", "17")
  marco.setAttribute("height", "17")
  marco.setAttribute("stroke-dasharray", "3 2.5")
  return dibujo(marco)
}

/** Un botón con dibujo y sin texto, que no deja pasar su toque al lienzo. */
const botonDeLienzo = (
  clase: string,
  nombre: string,
  dibujado: SVGSVGElement,
  alPulsar: () => void,
): HTMLButtonElement => {
  const b: HTMLButtonElement = elemento("button")
  b.type = "button"
  b.className = clase
  b.setAttribute("aria-label", nombre)
  b.title = nombre
  b.append(dibujado)
  b.addEventListener("pointerdown", (evento: PointerEvent): void => evento.stopPropagation())
  b.addEventListener("contextmenu", (evento: MouseEvent): void => evento.stopPropagation())
  b.addEventListener("click", alPulsar)
  return b
}

/** La mira, para el lienzo o para una barra. */
export const crosshairButton = (alPulsar: () => void): HTMLButtonElement =>
  botonDeLienzo("mira", "Volver al inicio", dibujoMira(), alPulsar)

/** El de seleccionar nodos. Quien lo crea le pone `aria-pressed` según el modo. */
export const selectButton = (alPulsar: () => void): HTMLButtonElement => {
  const b: HTMLButtonElement = botonDeLienzo(
    "seleccionar",
    "Seleccionar nodos",
    dibujoSeleccion(),
    alPulsar,
  )
  b.setAttribute("aria-pressed", "false")
  return b
}
