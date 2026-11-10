/**
 * Si la página corre dentro de la app de Android y no en un navegador. Es el
 * único sitio que lo decide: lo que cambia en la app (dónde van las notas, qué
 * se borra) lo pregunta aquí.
 *
 * Dentro de la app, Capacitor deja en `window` su puente, que dice que es una
 * plataforma nativa; en un navegador no está.
 */

/** Lo que mira del puente; TypeScript no lo trae. */
interface ConPuente {
  readonly Capacitor?: { readonly isNativePlatform?: () => boolean }
}

export const dentroDeLaApp = (ventana: object): boolean =>
  (ventana as ConPuente).Capacitor?.isNativePlatform?.() === true
