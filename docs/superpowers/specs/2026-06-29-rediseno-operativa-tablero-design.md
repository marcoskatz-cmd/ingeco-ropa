# Rediseño de la operativa — Sistema de Compra de Ropa INGECO

**Fecha:** 2026-06-29
**Estado:** Diseño aprobado, pendiente review escrito
**Enfoque elegido:** B — Tablero de acciones

## 1. Objetivo

El sistema funciona pero la operativa es confusa: 8 tabs planas, login multi-usuario innecesario, y la carga del padrón/precios depende de tocar la planilla a mano. Lo opera **Compras** (una persona), que **no guarda stock**: compra exactamente lo que cada operario necesita y lo entrega apenas llega. El rediseño busca tres cosas:

1. **Auth trivial** — un PIN, sin usuarios.
2. **Navegación simple e infalible (poka-yoke)** — un tablero de acciones, no 8 tabs.
3. **Carga 100% por interfaz** — nunca más editar la planilla.

## 2. Insight central: no hay stock

Como se compra y se entrega casi en el mismo acto, **el pedido y las entregas son la misma decisión vista dos veces**: la lista de "quién necesita qué" (corrida) es también la lista de "qué voy a entregar". Hoy el sistema obliga a re-tipear cada legajo a mano en "Registrar entrega" después de haber armado el pedido. Eso es el error que se elimina: **las entregas se confirman desde la misma lista que se compró, sin re-tipear**.

## 3. Decisiones tomadas

| Tema | Decisión |
|---|---|
| Auth | Un único PIN (hash en CONFIG). Se elimina la hoja USUARIOS y el desplegable de nombres. Token de sesión se mantiene (6 h). Identidad fija "Compras" en Historial. |
| Navegación | Tablero (home) con tarjetas de estado+acción. |
| Previsión | Deja de ser tab: pasa a ser un toggle *Ahora / +30 días* dentro de Comprar, y una tarjeta en el tablero. |
| Comprar | Corrida + Armar pedido fusionados en una vista. |
| Entregar | Lista precargada desde la última compra congelada; confirmación en lote; + "entrega suelta" por legajo para roturas. |
| Listas (categorías/centros/colores/talles) | **Editor** en Ajustes (no auto-derivadas). |
| Cruce RRHH | **Se mantiene** como punto único de sincronización del padrón (en mantenimiento, no en el tablero). Es la única importación pegada, y obliga a confirmar alta/baja una por una. |
| Carga por UI | Se agregan editores de Parámetros, Proveedores (precios) y Listas. |
| Acceso externo | Sin cambios (deployment anónimo). El bloqueo de la sesión @grupoingeco es del lado del visitante, no se resuelve en código. |

## 4. Modelo de navegación

**Tablero (pantalla de inicio)** — tarjetas:

- 🛒 **Comprar ahora** — cantidad de prendas críticas → abre Comprar.
- ⚠️ **Sin talle** — operarios activos con prenda elegible pero sin talle (solo aparece si > 0) → abre Personal filtrado. *Poka-yoke: lo que no tiene talle no se puede comprar, se pone adelante.*
- 📦 **Entregar** — entregas pendientes de la última compra congelada → abre Entregar.
- 📅 **Previsión 30 días** — prendas que vencen en el horizonte → abre Comprar en modo previsión.
- Accesos secundarios: **Personal · Historial · Roturas · Ajustes**. El Cruce RRHH vive **dentro de Personal** (es mantenimiento del padrón).

Las tarjetas linkean; no hay wizard lineal (eso era el enfoque A, descartado).

## 5. Acciones (vistas)

- **Comprar**: corrida + pedido en una vista. Toggle de horizonte (Ahora / +30 días). Se destildan prendas, se ve la matriz talle×grupo y la comparación de proveedores, se congela la compra. Reusa `calcularCorrida_`, `generarPrevision_`, `armarPedido_`, `congelarCompra_`.
- **Entregar**: alimentada por la lista por-persona guardada al congelar la última compra. Cada renglón con check "entregado", talle y fecha precargados; confirmación en lote registra las entregas (motivo CICLO) y reinicia relojes. Botón "entrega suelta" → buscar legajo (flujo actual) con motivo ROTURA para roturas/casos individuales.
- **Personal**: ABM existente + filtro "sin talle".
- **Historial / Roturas**: consultas, sin cambios funcionales.
- **Ajustes** (nuevo): cambiar PIN; parámetros (vida útil, cadencia, días de previsión, fecha ancla); precios de Proveedores; editor de Listas.

## 6. Cambios de backend

**Auth (reescritura de `Auth.gs` + dispatcher):**
- `loginPin(pin)` reemplaza `login(nombre,pin)`. Valida contra hash en CONFIG (`pin_acceso_hash`). Token con identidad fija "Compras".
- `cambiarPinAcceso(pinNuevo)` reemplaza el `cambiarPin_` por-usuario.
- Se quitan del dispatcher `listarNombresLogin`, `crearUsuario`. `METODOS_PUBLICOS` pasa a `{ loginPin: true }`.

**Escritura de configuración (nuevo):**
- `guardarParametros(datos)` → escribe CONFIG (vida_util, cadencia, dias_prevision, fecha_ancla). Invalida cache.
- `guardarListas(datos)` → reescribe la hoja LISTAS por columnas.
- `listarProveedores()` / `guardarProveedores(datos)` → lee/escribe la matriz PROVEEDORES (prenda × proveedor). Hoy solo existe `leerPreciosProveedores_` (lectura).

**Tablero (nuevo):**
- `resumenTablero()` → `{ criticos, sinTalle, entregasPendientes, prevision }`. Compone sobre `calcularCorrida_`, `generarPrevision_` y la lista pendiente de entrega.

**Entregar desde compra (nuevo):**
- `congelarCompra_` se extiende para persistir la **lista por-persona** (legajo, prenda, talle, grupo) al momento de congelar, además de las matrices que ya guarda.
- `entregasPendientes()` → devuelve esa lista menos los renglones que ya tienen una entrega registrada posterior a la fecha de congelado.
- `confirmarEntregas(seleccion)` → registra en lote (reusa `registrarEntrega_` por renglón, motivo CICLO).

## 7. Qué se mantiene / qué se elimina

- **Se mantiene:** motor de cálculo (vida_util 6 / cadencia 2 / techo 8), corrida, previsión, pedido, proveedores, historial, roturas, ABM Personal, cruce RRHH, token de sesión HMAC.
- **Se elimina:** hoja USUARIOS y login multi-usuario, desplegable de nombres, `crearUsuario`, `cambiarPin` por-usuario, la tab "Previsión" como ítem de nav independiente.

## 8. Fuera de scope

- Gestión de stock / depósito (explícitamente no hay stock).
- Orden de compra formal al proveedor (se hace fuera del sistema).
- Notificaciones por mail/WhatsApp (in-app únicamente).
- Migrar datos: el padrón (124 operarios) ya está cargado.

## 9. Riesgos y decisiones incómodas

- **Cruce RRHH se queda** pese a ser entrada pegada: se justifica porque es la única vía de traer el roster oficial sin re-tipear 140 personas, y es en sí un poka-yoke (confirmación alta/baja). No se usa a diario.
- **Listas con editor** (no auto-derivadas): evita que un typo en un centro se vuelva opción válida, a costa de mantener el editor.
- **Entregar atado a "compra congelada":** si Compras compra sin congelar, no hay lista pendiente. El flujo asume que congelar = "compré esto". Hay que dejarlo claro en la UI.
- **Reescritura de Auth:** hay que asegurar que el token viejo siga validando o forzar re-login en el deploy.

## 10. Fases de implementación (para el plan)

1. **Auth PIN único** — aislado, bajo riesgo. Reescribe Auth + login UI.
2. **Escritura de config** — `guardarParametros`, `guardarListas`, `listarProveedores`/`guardarProveedores`.
3. **Tablero + nav** — `resumenTablero`, reestructura de `App.html` (home + secciones).
4. **Comprar** — fusión corrida+pedido con toggle horizonte.
5. **Entregar desde compra** — persistir lista al congelar + `entregasPendientes`/`confirmarEntregas` + UI.
6. **Ajustes** — UI de PIN/parámetros/proveedores/listas.
7. **Reubicar Cruce RRHH** + filtro "sin talle" en Personal.
