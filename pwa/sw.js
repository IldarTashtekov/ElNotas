/**
 * El service worker de ElNotas: al instalarse guarda la app entera en el móvil, y
 * desde ahí la sirve de lo guardado, con conexión o sin ella. Cada versión, en su
 * propia caché; al entrar una nueva, las viejas se borran.
 *
 * No se publica tal cual: tools/build-pages.mjs le pone delante HUELLA y FICHEROS
 * —la lista de lo publicado— y lo escribe como sw.js en la carpeta publicada.
 */

const CACHE = `elnotas-${HUELLA}`

self.addEventListener("install", (evento) => {
  evento.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE)
      // «reload» salta la caché HTTP del navegador: si no, podría guardar ficheros
      // viejos con el nombre de la versión nueva.
      await cache.addAll(FICHEROS.map((ruta) => new Request(ruta, { cache: "reload" })))
      // Entra en cuanto termina, sin esperar a que se cierre la app del todo.
      await self.skipWaiting()
    })(),
  )
})

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    (async () => {
      const nombres = await caches.keys()
      const viejas = nombres.filter((nombre) => nombre.startsWith("elnotas-") && nombre !== CACHE)
      await Promise.all(viejas.map((nombre) => caches.delete(nombre)))
    })(),
  )
})

self.addEventListener("fetch", (evento) => {
  if (evento.request.method !== "GET") return
  evento.respondWith(servir(evento.request))
})

async function servir(peticion) {
  const cache = await caches.open(CACHE)
  // ignoreSearch: «?depurar» es la misma página.
  const guardada = await cache.match(peticion, { ignoreSearch: true })
  if (guardada !== undefined) return guardada
  // Abrir la app es pedir la carpeta («/ElNotas/»), que en la caché es index.html.
  if (peticion.mode === "navigate") {
    const indice = await cache.match("index.html")
    if (indice !== undefined) return indice
  }
  return fetch(peticion)
}
