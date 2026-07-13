# Comprar: congelar previsión + listado por persona + sin-talle por nombre — Diseño

Fecha: 2026-07-07
Estado: aprobado (brainstorming)

## Problema

Tres ajustes a la pestaña **Comprar**:
1. El horizonte **"+30 días" (previsión)** es solo lectura: no deja congelar/comprar.
2. Las **tarjetas por persona** (`persona-card` con `prenda-row` apiladas) quedan
   muy altas; se pide un **listado** más compacto.
3. La lista **"Sin talle — quedaron afuera"** muestra una entrada por (persona ×
   prenda); se pide una sola entrada por persona (nombre).

## Decisiones (aprobadas)

- Previsión pasa a ser **editable y congelable**, igual que "Ahora".
- Listado = **una fila por persona**, con las prendas como chips; el "no comprar"
  se hace tocando el chip de la prenda; el motivo aparece por prenda al marcarla.
- "Sin talle": **una entrada por persona** (dedupe por legajo).

## Diseño

### 1. Congelar desde previsión

- **Backend `Historial.gs`**: `congelarCompra_(usuario, exclusiones, horizonte)`
  pasa `horizonte` a `armarPedido_(exclusiones, horizonte)` (hoy llama sin
  horizonte → siempre congela "ahora").
- **`Api.gs`**: `case 'congelarCompra': return congelarCompra_(usuario,
  p.exclusiones || [], p.horizonte);`
- **Front `index.html`**:
  - `pintarComprar`: `comprarEditable = true` en ambos horizontes. El aviso de
    previsión deja de decir "acá no se compra ni se congela".
  - `pedidoPaneHtml`: en previsión, si `t.unidades`, muestra el botón
    **"Congelar esta compra"** (mismo que "ahora") en vez del texto informativo.
  - `wirePedidoPane`: cablea el botón en ambos horizontes.
  - `confirmarCongelar`: envía `horizonte: S.horizonteComprar` en la llamada
    `congelarCompra`. El texto del modal aclara si es previsión.

### 2. Listado por persona (`renderComprarTabla` / nuevo `filaPersonaComprar`)

- Se mantiene el agrupado por persona (`porLeg`, orden por `f.orden`), pero cada
  persona se renderiza como **un renglón** `.persona-linea` en vez de una tarjeta:
  - `.pl-head`: `NOMBRE · legajo · centro`.
  - `.pl-prendas`: cada prenda es un `<button class="pchip">` con
    `PRENDA_LABEL · [grupo] · talle · badgeEstado`. `data-clave="LEG|PRENDA"`.
    Las de `faltaTalle` muestran "falta talle" y llevan `.pchip-sintalle`
    (no togglean; ya quedan afuera).
  - Tocar un `.pchip` (editable) togglea la exclusión (`S.exclusiones[clave]`),
    aplica clase `.excluida` (tachado/gris) y dispara `programarRefrescoPedido`.
  - `.pl-motivos`: por cada prenda excluida de esa persona, un `.mnc-input`
    (mismo guardado por blur que hoy, ruta `registrarNoCompra`). Se muestra solo
    si hay excluidas.
- Un texto de ayuda arriba del listado: "Tocá una prenda para marcarla como 'no
  comprar'." (solo en modo editable).
- Se reemplazan `filaPrendaComprar` y el wiring `wireFilas`/`wireMotivosNoCompra`
  por los nuevos, adaptados a `.pchip` y a los motivos por persona.
- Buscador, filtro por prenda y "Ordenar por" se mantienen igual.

### 3. Sin talle por persona (`pedidoPaneHtml`)

- La lista `p.sinTalle` se **dedupe por legajo** y se muestra `legajo nombre`
  (sin la prenda). Ej.: `3958 DIAZ, LUCAS DAMIAN · 844 LESCANO, ALBERTO`.

## Interfaces

- `congelarCompra_(usuario, exclusiones, horizonte)` — nuevo 3º parámetro.
- `filaPersonaComprar(persona, editable)` — reemplaza `filaPrendaComprar`.
- CSS nuevo: `.persona-linea`, `.pl-head`, `.pl-prendas`, `.pchip`,
  `.pchip.excluida`, `.pchip-sintalle`, `.pl-motivos`.

## Verificación

- `node --check` sobre el `<script>` del `index.html` y sobre `Historial.gs` /
  `Api.gs`.
- Harness puppeteer-core con stub de `google.script.run`:
  - En previsión aparece el botón "Congelar esta compra" y al confirmar el payload
    de `congelarCompra` incluye `horizonte: 'prevision'`.
  - Tocar un `.pchip` agrega la clave a exclusiones (payload de `armarPedido`).
  - "Sin talle" muestra una entrada por legajo (no repetida por prenda).
