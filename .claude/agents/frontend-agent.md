---
name: frontend-agent
description: PENDIENTE DE DEFINIR — nace en la Fase 4. Escribirá la UI en src/ui/, la composición en src/platform/ y los shells nativos. Su definición está sin escribir a propósito: si estás pensando en usarlo, primero hay que acordarla con el usuario.
tools: Read, Grep, Glob
---

# ⚠️ Este agente todavía no está definido

Existe solo para registrar la decisión de que **va a existir**, y con qué carril. Nace en
la **Fase 4**, y hoy no existen ni `src/ui/` ni `src/platform/`.

**Si te han invocado: para.** No empieces a escribir código con esto por única guía — un
stub sin reglas es peor que no tener agente, porque parece legítimo y no lo es. Lo primero
es cerrar con el usuario lo que queda abierto aquí abajo. De eso se encarga
`coordinador-agent`.

## Carril previsto

- **`src/ui/`** — los componentes y el `render(state)`.
- **`src/platform/*`** — la composición: el único sitio que decide qué adaptador se inyecta.
- **Los shells nativos** — `src-tauri/`, configuración de Capacitor.

Se llama `frontend-agent` y no `ui-agent` porque el nombre tenía que cubrir también la
composición y los shells. Nota: en este proyecto no hay backend, así que el nombre no
discrimina en rigor — se eligió por ser el que cualquiera entiende de inmediato.

## Por qué es uno y no tres

**Hay una sola UI.** Tauri y Capacitor envuelven el output del build web; no hay un árbol
de componentes por plataforma. Tres agentes (web / móvil / escritorio) serían tres dueños
de un mismo código, y peor: crearían presión para bifurcarlo, que es exactamente lo que la
arquitectura existe para evitar.

Por eso las diferencias de plataforma entran **por capacidades**, no por código bifurcado:
«¿existe `showDirectoryPicker`?», no «¿estoy en móvil?».

## Lo que hay que decidir antes de usarlo

**1. Dónde acaba esto y empieza `infra-agent`.** Los shells son de este agente, pero el
bundler es de infra, y ambos son «hacer que la app se construya y arranque». La costura
está sin trazar del todo.

**2. Si algún día se separa lo nativo.** Cuando lleguen keychain, permisos nativos y
plugins de Tauri, eso ya no es UI ni cableado. El disparador para dividir es el mismo que
el proyecto usa para los workspaces: **cuando haya cuerpos de trabajo con árboles de
dependencias distintos.** No antes.

## Lo que heredará

En `CLAUDE.md`, sección «UI: vanilla, con store y `render(state)`». Las dos reglas ya
decididas y que no hay que rediscutir: **reconciliación por `data-id`** en lugar de
re-render ciego de listas, y **el nodo que tiene el foco no se re-renderiza** — con
`contenteditable`, un re-render completo borra el cursor a mitad de escribir, así que
mientras un nodo está enfocado el DOM es la fuente de verdad y se despacha en `blur` o con
debounce.

Del prototipo viejo hereda el CSS, que se reutiliza casi tal cual, y la tarea de
sustituirlo: `src/scripts/` desaparece en esta fase.

Y de la política general: **no instala dependencias**, las pide. Aquí hay dos que llegan
con la fase — recuperar webpack, o valorar Vite.
