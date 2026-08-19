/**
 * API pública del core.
 *
 * Todo lo que consuman ui/, storage/ o platform/ se importa desde aquí (vía el
 * alias #core/ declarado en package.json), nunca apuntando a ficheros internos:
 * es lo que hace que el límite del módulo exista de verdad y que moverlo a
 * packages/core algún día sea trivial.
 *
 * Dentro del core, en cambio, los imports son relativos.
 *
 * Vacío a propósito: el dominio (Note, Plan, Context, reducers, Store) entra en
 * la Fase 1. El fichero existe porque src/core/tsconfig.json necesita al menos
 * un .ts en el directorio para poder ejecutar la verja de pureza.
 */
export {}
