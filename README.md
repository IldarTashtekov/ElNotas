# ElNotas

Repositorio provisional para un software de notas hecho por y para mi.

App de notas personal en TypeScript, **web primero** (también en el navegador del móvil), sin
framework y sin dependencias de runtime. El código vive en `src/` —`core/` (el dominio),
`storage/` (la persistencia), `platform/` (la composición) y `ui/`— y las pruebas aparte, en
`test/`, en un árbol que calca el de `src/`.

**Estado:** fases 1, 2 y 3 terminadas. **La Fase 4, la UI web, tiene el código hecho y está sin
cerrar**: ventanas, contextos, configuración y el editor con casillas anidadas funcionan, y
faltan pasar a mano sus dos listas de verificación (`test/ui/VERIFICACION-MANUAL.md` y
`test/ui/VERIFICACION-MANUAL-EDITOR.md`) y usarla unos días. Hoy guarda en el `localStorage` del
navegador. Los Planes son la Fase 5.

La cuenta de arriba envejece sola: lo que manda es `npm run check` y `CLAUDE.md`.

## Abrir la app

Sin bundler ni servidor de desarrollo: `tsc` compila a `dist/web/` y cualquier servidor estático
sirve la raíz del repo, donde está `index.html`.

```bash
npm install                 # sólo typescript y @types/node
npm run build:web           # compila src/ a dist/web/
python3 -m http.server 8000 # y se abre http://localhost:8000
```

Para abrirla desde el móvil, en la misma red: `python3 -m http.server 8000 --bind 0.0.0.0` y
`http://<IP del ordenador>:8000`. Con `?depurar` en la dirección, la consola tiene
`window.elnotas` con el estado y los casos de uso.

## Documentación

| Fichero | Qué hay dentro |
|---|---|
| [`CLAUDE.md`](CLAUDE.md) | las reglas del proyecto y el estado real del repo |
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | el diseño y sus **por qués**, los conceptos desde cero, el plan por fases |
| [`TAREAS.md`](TAREAS.md) | qué está pendiente, qué está sin decidir, qué ideas hay aparcadas |

## Comandos

```bash
npm run check             # las seis de abajo. Esto antes de commit
npm run typecheck         # tsc de la app: sólo src/
npm run typecheck:core    # la verja: falla si el core toca la plataforma
npm run check:purity      # guardián: falla si el core lee el reloj o el azar
npm run check:fronteras   # guardián: falla si una excepción puede escaparse de su frontera
npm run check:extensiones # guardián: falla si un import relativo de src/ no lleva .js
npm test                  # compila src/ y test/ a tmp-test/ y lanza node --test

npm run build:web         # compila la app para el navegador, a dist/web/
```
