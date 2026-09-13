# ElNotas

Repositorio provisional para un software de notas hecho por y para mi.

App de notas personal en TypeScript, **web primero**. En rediseño: el prototipo viejo sigue en
`src/scripts/` y la arquitectura nueva se está construyendo en `src/core/` y `src/storage/`.

**Estado:** fases 1 y 2 terminadas —dominio puro, las diecisiete acciones, los cinco puertos,
el adaptador en memoria y el write-behind— y la Fase 3 en curso: hechos su paso 0, el que hace
que los errores se devuelvan en vez de lanzarse, y el adaptador de fichero con su formato en
disco. `npm run check` en verde con 274 pruebas al terminarlo. Faltan las implementaciones de
`BlobStore` (Fase 3) y la UI (Fase 4); **no hay build ni servidor de desarrollo hasta
entonces**.

La cuenta de arriba envejece sola: lo que manda es `npm run check` y `CLAUDE.md`.

## Documentación

| Fichero | Qué hay dentro |
|---|---|
| [`CLAUDE.md`](CLAUDE.md) | las reglas del proyecto y el estado real del repo |
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | el diseño y sus **por qués**, los conceptos desde cero, el plan por fases |
| [`TAREAS.md`](TAREAS.md) | qué está pendiente, qué está sin decidir, qué ideas hay aparcadas |

## Comandos

```bash
npm run check           # las cuatro de abajo, en orden. Esto antes de commit
npm test                # compila a tmp-test/ y lanza node --test
npm run typecheck       # tsc de la app (excluye tests)
npm run typecheck:core  # la verja: falla si el core toca la plataforma
npm run check:purity    # el otro guardián: falla si el core lee el reloj o el azar
```
