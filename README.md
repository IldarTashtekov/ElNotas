# ElNotas

Repositorio provisional para un software de notas hecho por y para mi.

App de notas personal en TypeScript, **web primero** (también en el navegador del móvil), sin
framework y sin dependencias de runtime. El código vive en `src/` —`core/` (el dominio),
`storage/` (la persistencia), `platform/` (la composición) y `ui/`— y las pruebas aparte, en
`test/`, en un árbol que calca el de `src/`.

**Publicada** en <https://ildartashtekov.github.io/ElNotas/>, y se instala en el móvil como app
(PWA). Hace notas con casillas anidadas, las agrupa en contextos y las enseña en ventanas que se
pasan de lado; dibuja diagramas en un lienzo libre, con pósits y líneas entre ellos. Tiene aspecto
de terminal de fósforo, ámbar o verde. Guarda en el `localStorage` del navegador, y en
⚙ → Datos se **exporta una copia** a un fichero y se **importa** sustituyendo todo.

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

**Publicar es subir a `main`**: GitHub Actions pasa `npm run check`, arma la carpeta publicada y la
sube a GitHub Pages. Cada origen guarda sus notas aparte, así que lo escrito en `localhost` no
aparece en la publicada: para pasarlo, se exporta una copia en una y se importa en la otra.

## Documentación

| Fichero | Qué hay dentro |
|---|---|
| [`CLAUDE.md`](CLAUDE.md) | las reglas del proyecto y el estado real del repo |
| [`ARCHITECTURE.md`](ARCHITECTURE.md) | el diseño y sus **por qués**, los conceptos desde cero, el plan por fases |
| [`TAREAS.md`](TAREAS.md) | qué está pendiente, qué está sin decidir, qué ideas hay aparcadas |
| [`TERMINADAS.md`](TERMINADAS.md) | lo cerrado: las fases resumidas, y las tareas, los descartes y las decisiones |

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
npm run build:pages       # tras build:web: arma dist/pages/, lo que se publica
```
