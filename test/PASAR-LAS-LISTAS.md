# Cómo se pasa una lista manual

**Un procedimiento, no diseño.** Vale para todas las `VERIFICACION-*.md` de `test/`. Cada lista
dice qué se comprueba; esto dice cómo se pasa y cómo se apunta.

## Quién la pasa

- **El verificador** (`.claude/agents/verificador.md`), con el navegador del panel, todo lo que el
  panel puede hacer: es lo primero. Claude apunta lo que devuelve.
- **El usuario, en el móvil**, lo que sólo se ve ahí: la PWA instalada, el selector de Android,
  el teclado del móvil. Lo menos posible.

**Cuánto:** en cada tarea, sólo los pasos que toca el cambio; al cerrar la fase, la lista entera.

## Reglas

> **Se apunta el commit, y qué ficheros llevaba sin comitear.** En una tarea se pasa sobre su
> cambio aún sin comitear, para arreglar lo que falle antes de que entre en la rama; al cerrar la
> fase, sobre el árbol limpio.

> **Antes del primer paso, se recarga sin caché**, o se pasa sobre el CSS y los módulos de antes:
> el servidor no impide que el navegador los guarde. La orden, en la ficha del verificador.

> **Lo que borra, en un origen aparte**: `localhost:8001` (`web-8001` en `.claude/launch.json`)
> empieza vacío y no toca lo que haya en `localhost:8000`.

> **Una captura en cada paso que se ve**: el verificador cuenta lo que muestra (sus capturas no
> salen de él). Si un ❌ hay que verlo, Claude repite el paso en el panel y se lo enseña al usuario.
> No se guardan en el repo.

> **Nada se descarga ni se instala.** Lo que la página pide al sistema —«Guardar como», elegir un
> fichero— se **simula** dentro de la página, y se apunta como tal.

## Cómo se marca cada paso

| Marca | Cuándo |
|---|---|
| ✅ | pasa tal cual dice la lista |
| ❌ | no pasa: se apunta qué se vio, palabra por palabra, y abre una tarea en `TAREAS.md` |
| 🔁 simulado | pasa, pero un diálogo del sistema se sustituyó dentro de la página: se dice cuál y cómo. Lo que se prueba es la app, no el diálogo |
| ⏭ no se puede aquí | el panel no lo puede hacer (otro navegador, el móvil): se dice quién y dónde lo pasa |

## Cómo se apunta

Al final de la lista, en su sección de resultados (**Pasadas** u **Hoja de resultados**), **la más reciente arriba**:

```
Fecha:        AAAA-MM-DD
Navegador:    (nombre y versión: navigator.userAgent)
Quién:        el verificador, en el panel · o · el usuario, en (móvil y navegador)
Commit:       (git rev-parse --short HEAD), árbol limpio · o · más lo sin comitear (qué ficheros)
Origen:       (localhost:8001, la publicada…)

E1  🔁 simulado — el «Guardar como», por uno que guarda en memoria; …
E2  ✅
E3  ⏭ no se puede aquí — el diálogo del sistema; lo pasa el usuario
…

Notas: lo que no cabe en una línea, y los mensajes exactos.
```

Un paso ❌ no se arregla en la misma pasada: se apunta, se arregla aparte y se vuelve a pasar.
