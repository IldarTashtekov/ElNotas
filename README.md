# ElNotas

Repositorio provisional para un software de notas hecho por y para mi.

App de notas personal en TypeScript, **web primero**. En rediseño: el prototipo viejo sigue en
`src/scripts/` y la arquitectura nueva se está construyendo en `src/core/`.

**Estado:** Fase 1 de 4 en curso. Del core existe solo el modelo de datos (306 líneas), sin
tests todavía. No hay build ni servidor de desarrollo hasta la Fase 4.

## Documentación

| Fichero | Qué hay dentro |
|---|---|
| [`CLAUDE.md`](CLAUDE.md) | las reglas del proyecto y el estado real del repo |
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | el diseño y sus **por qués**, los conceptos desde cero, el plan por fases |
| [`TAREAS.md`](TAREAS.md) | qué está pendiente, qué está sin decidir, qué ideas hay aparcadas |

## Comandos

```bash
npm run check           # typecheck app + verja de pureza del core + tests
npm test                # compila a tmp-test/ y lanza node --test
npm run typecheck       # tsc de la app (excluye tests)
npm run typecheck:core  # falla si el core toca la plataforma
```
