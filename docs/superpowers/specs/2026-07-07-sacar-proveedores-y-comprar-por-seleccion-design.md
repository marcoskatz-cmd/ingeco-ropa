# Sacar Proveedores + Comprar por selección (inclusión) — Diseño

Fecha: 2026-07-07
Estado: aprobado (brainstorming)

## Problema

1. Ya no se quiere la **comparación de proveedores** dentro del sistema (se compra
   por fuera). Hay que sacar el módulo por completo.
2. En **Comprar**, hoy todo entra por defecto y se marca lo que NO va (modelo por
   exclusión). Se quiere lo inverso: mostrar los pendientes **sin preseleccionar**
   y que el usuario **elija a quién comprar**, con **selección masiva por filtros**
   (típicamente por centro: solo Taller, solo Asfalto).

## Decisiones (aprobadas)

- Proveedores: **removal completo** (UI + backend). Las columnas históricas de
  costo en HISTORIAL se conservan pero no se muestran ni se llenan.
- Selección **por persona** (un tilde selecciona todas sus prendas comprables) con
  **ajuste por prenda** (chips).
- Selección masiva: **filtro por centro** + botón **"Seleccionar todo lo visible"**.
- Se **saca** el campo de motivo de "no compra" del front.

## Parte A — Sacar Proveedores

### Backend
- **Borrar `Proveedores.gs`** (valorizarPedido_, calcularSplit_,
  leerPreciosProveedores_, listarProveedores_, guardarProveedores_).
- `Pedido.gs armarDesdeFilas_`: quitar `proveedores: valorizarPedido_(totales)`
  del objeto devuelto.
- `Historial.gs`:
  - `congelarCompra_`: quitar cálculo de `ganador`; escribir `''` en
    `PROVEEDOR_GANADOR` y `COSTO_GANADOR`; quitar `proveedorGanador`/`costoGanador`
    del objeto de retorno; `resumenParaHistorial_` sin `proveedores`.
  - `editarCompraCongelada_`: quitar `valorizarPedido_`/ganador; escribir `''` en
    las mismas columnas; `detalle.proveedores` fuera.
  - `listarHistorial_`/`detalleHistorial_`: dejan de exponer ganador/costo (o los
    devuelven vacíos; el front ya no los usa).
- `Api.gs`: quitar rutas `listarProveedores` y `guardarProveedores`.
- `Seed.gs`: quitar el bloque de round-trip de proveedores (usa
  `listarProveedores_`/`guardarProveedores_`).
- `Setup.gs` y la hoja `PROVEEDORES` se dejan como están (creación/seed inocua en
  instalaciones nuevas; la hoja queda sin uso). Las columnas
  `PROVEEDOR_GANADOR`/`COSTO_GANADOR` siguen en `COLS.HISTORIAL` (datos viejos).

### Front (`index.html`)
- Quitar `proveedoresHtml` y su llamado en `pedidoPaneHtml`.
- Ajustes: quitar `cargarAjProveedores`/`pintarAjProveedores`, el contenedor
  `#ajProv` y su llamado; ajustar el texto de la sección.
- Historial lista: quitar columnas **Ganador** y **Costo** (`renderHistorial`).
- Historial detalle: quitar la línea de **Ganador**.
- Modal de congelar: quitar la línea "Proveedor ganador".
- Ayuda: quitar/ajustar menciones a proveedores/comparación/ganador.
- Quitar CSS `.pill-ganador`.

## Parte B — Comprar por inclusión

### Backend
- `armarDesdeFilas_(filas, seleccion)`: `seleccion` = lista de claves
  `LEGAJO|PRENDA` a **incluir**. Regla: `sel[clave] && !faltaTalle` → incluidas;
  `sel[clave] && faltaTalle` → sinTalle; el resto → no entra (bucket `noSel`, no se
  muestra). Matrices/totales igual que hoy sobre `incluidas`.
- `armarPedido_(seleccion, horizonte)` y `vistaComprar_(horizonte, seleccion)`
  reenvían `seleccion` a `armarDesdeFilas_`.
- `congelarCompra_(usuario, seleccion, horizonte)` → `armarPedido_(seleccion, horizonte)`.
- `Api.gs`: `vistaComprar`/`armarPedido`/`congelarCompra` toman `p.seleccion || []`.

### Front (`index.html`)
- `S.seleccion` (mapa `clave→true`) reemplaza `S.exclusiones`. Default vacío.
- `renderComprarTabla` (por persona, ya existente): cada persona = renglón con
  - **checkbox de persona** (`.pSelPersona`): tildado si TODAS sus prendas
    comprables (no faltaTalle) están en `S.seleccion`; togglear
    selecciona/deselecciona todas sus comprables.
  - **chips** `.pchip`: clase `.sel` cuando la clave está seleccionada (relleno);
    tocar togglea esa clave; los `faltaTalle` no son seleccionables.
- **Barra de selección** (arriba del listado, solo editable):
  - Filtro **Centro**: `<select>` con `Todos` + centros distintos presentes en
    `comprarFilas` (nuevo `FILTROS.comprar.centro`, aplicado en el filtro de
    `renderComprarTabla`).
  - Botón **"Seleccionar todo lo visible"**: agrega a `S.seleccion` la clave de
    cada fila visible (según buscador + prenda + centro) que **no** sea faltaTalle.
  - Botón **"Limpiar selección"**.
  - Contador: "N prendas seleccionadas".
- Toggle de chip / persona / bulk → `renderComprarTabla()` + `programarRefrescoPedido()`.
- `refrescarPedido`/`cargarComprar`/`confirmarCongelar` mandan
  `seleccion: Object.keys(S.seleccion)`.
- **Sacar** el motivo de no-compra: quitar `motivosPersonaHtml`,
  `wireMotivosNoCompra`, el CSS `.mnc-*` y la ruta `registrarNoCompra` del front
  (backend `registrarNoCompra_` queda, sin uso).
- El pedido arranca **vacío** (seleccion vacía → 0 unidades → sin botón Congelar).
  "Sin talle — quedaron afuera" ahora lista solo seleccionados sin talle.

## Verificación

- `node --check` sobre el `<script>` del `index.html`, `Pedido.gs`, `Historial.gs`,
  `Api.gs`, `Seed.gs`.
- Harness puppeteer-core con stub de `google.script.run`:
  - Pedido arranca vacío (sin `#pCongelar`) hasta seleccionar.
  - Tildar la persona agrega sus prendas comprables a `seleccion` (payload
    `armarPedido`).
  - Filtro Centro + "Seleccionar todo lo visible" selecciona solo las de ese
    centro.
  - Congelar manda `seleccion` (no `exclusiones`).
  - El pedido pane ya no contiene "Comparación de proveedores".
