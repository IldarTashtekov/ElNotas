# ElNotas

Repositorio provisional para un software de notas hecho por y para mi.

App de notas personal en TypeScript, **web primero**. En rediseño: el prototipo viejo sigue en
`src/scripts/` y la arquitectura nueva se está construyendo en `src/core/` y `src/storage/`.
Las pruebas viven aparte, en `test/`, en un árbol que calca el de `src/`.

**Estado:** fases 1, 2 y 3 terminadas —dominio puro, las diecisiete acciones, los cinco
puertos, el adaptador en memoria, el write-behind, los errores devueltos en vez de lanzados, el
adaptador de fichero con su formato en disco y las dos implementaciones de `BlobStore`, con la
lista manual de
[`test/storage/blobs/VERIFICACION-MANUAL.md`](test/storage/blobs/VERIFICACION-MANUAL.md) pasada—.
`npm run check` en verde con 329 pruebas. Falta la UI: la Fase 4, planificada y partida en dos
(*Contextos* y luego *Notas*), sólo web. **No hay build ni servidor de desarrollo**; la Fase 4
arrancará con un `importmap`, sin bundler.

La cuenta de arriba envejece sola: lo que manda es `npm run check` y `CLAUDE.md`.

## Documentación

| Fichero | Qué hay dentro |
|---|---|
| [`CLAUDE.md`](CLAUDE.md) | las reglas del proyecto y el estado real del repo |
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | el diseño y sus **por qués**, los conceptos desde cero, el plan por fases |
| [`TAREAS.md`](TAREAS.md) | qué está pendiente, qué está sin decidir, qué ideas hay aparcadas |

## Comandos

```bash
npm run check           # las cinco de abajo. Esto antes de commit
npm test                # compila src/ y test/ a tmp-test/ y lanza node --test
npm run typecheck       # tsc de la app: sólo src/
npm run typecheck:core  # la verja: falla si el core toca la plataforma
npm run check:purity    # guardián: falla si el core lee el reloj o el azar
npm run check:fronteras # guardián: falla si una excepción puede escaparse de su frontera
```
