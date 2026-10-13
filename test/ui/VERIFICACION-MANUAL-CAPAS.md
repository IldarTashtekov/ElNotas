# Verificación manual de volver a lo abierto al recargar

**Esto no es documentación de diseño: es un procedimiento**, como sus vecinas
`VERIFICACION-MANUAL.md` y `VERIFICACION-MANUAL-TERMINAL.md`. Se pasa en escritorio **y** en el
móvil, con la app instalada.

## Por qué existe

Las pruebas de Node ven qué se guarda y qué se descarta (`test/ui/openLayers.test.ts`), pero no
ven las vistas volver a montarse, ni el atrás después de recargar, ni el caso que lo motivó: **el
móvil cerrando la app en segundo plano**, que no se puede provocar desde Node.

## Cuándo hay que volver a pasarla

- al tocar `src/ui/App.ts`, `src/ui/backStack.ts` o `src/ui/openLayers.ts`;
- al probar un navegador o un móvil nuevos.

**Cada pasada se anota abajo, debajo de la anterior.**

## Reglas al ejecutarla

> **Se pasa sobre un commit con el árbol limpio**, y se anota el commit.

> **Si algo no se puede provocar en ese navegador, se anota eso mismo.**

---

## Preparación

La misma que `VERIFICACION-MANUAL.md`: `npm run build:web`, servir, y abrir por `localhost` o,
en el móvil, por la IP del ordenador. Para C6, la copia publicada e instalada. Hace falta **una
ventana con una nota** en la lista y **un diagrama con un nodo-nota**, también puesto como ventana.

---

## C. Volver a lo abierto

- **C1.** Abrir una nota desde la lista de una ventana y **recargar**. Se ve **esa nota**, no la
  ventana. **Salir** lleva a la ventana.
- **C2.** En la ventana del diagrama, abrir la nota de un nodo y **recargar**. Se ve **la nota**;
  salir lleva **al diagrama** que hace de ventana.
- **C3.** Abrir el diagrama en su vista (desde una lista), abrir encima la nota de un nodo y
  **recargar**. Se ve la nota. **El atrás** del navegador lleva al diagrama, y otro atrás a la
  ventana.
- **C4.** Abrir ⚙ y **recargar**. Se ve **la ventana**, no la configuración.
- **C5.** Abrir una nota, salir, y **recargar**. Se ve la ventana: salir olvida lo abierto.
- **C6.** *(Móvil, app instalada.)* Abrir una nota encima del diagrama, pasar a otras apps
  pesadas hasta que el sistema cierre ElNotas (o cerrarla desde las recientes) y volver. Se ve
  **la nota**.
- **C7.** Con la nota abierta, borrarla desde otra pestaña y recargar esta. Se abre lo de debajo
  (el diagrama, o la ventana), **sin aviso ni fallo**.

---

## Pasadas

- **2026-10-13**, sin commit todavía (árbol con el cambio a medio comitear). Validado por el
  usuario en el móvil, por la red de casa (`http://<IP>:8000`, sin instalar): «validado». No se
  anotó paso a paso.
