# Firma del operario en Entregas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el operario firme en pantalla (o el encargado registre una excepción con motivo) al confirmar una entrega individual, dejando la firma guardada en Drive y visible en el historial del operario.

**Architecture:** Backend Apps Script (`.gs`) que suma 4 columnas a la hoja `ENTREGAS`, sube la firma como PNG a una carpeta de Drive y estampa la validación en cada fila. Frontend SPA (`index.html`) que intercepta el botón "Confirmar" individual con un modal de firma (canvas + excepción) y muestra badges de validación en el historial. El lote ("Confirmar seleccionadas") no cambia salvo estampar `VALIDACION='LOTE'`.

**Tech Stack:** Google Apps Script (V8), Google Sheets, DriveApp, HTML/JS vanilla (SPA en `index.html`), clasp para deploy, puppeteer-core (Chrome del sistema) para verificación del front.

## Global Constraints

- **No romper filas históricas de `ENTREGAS`.** Se lee/escribe por nombre de encabezado (`leerObjetos_` / `appendFilaPorHeader_`); las columnas nuevas van al final y las filas viejas quedan con esas celdas vacías.
- **`ENTREGAS` es append-only.** Ninguna función edita ni borra filas.
- **Toda respuesta de `apiCall` es JSON `{ok, data|error}`.** El front nunca recibe una excepción cruda.
- **Los strings de encabezado con acentos viven solo en `Schema.gs`** (`COLS` y mapa `E`). No hardcodear encabezados en otros módulos.
- **Gate de sintaxis obligatorio antes de cada commit:** `node --check <archivo>` sobre cada `.gs` tocado y sobre el `<script>` extraído del `index.html`.
- **Regla CSS existente:** hay un `input { width:100% }` global. Cualquier `<input type=checkbox/radio>` nuevo necesita `width:auto` (ya hay override global). El canvas no es input, no aplica.
- **Idioma UI: español rioplatense**, consistente con el resto del front.
- **Deploy:** `clasp push --force` + `clasp redeploy AKfycbwWPz0KiSGEmgJDGYgaBsWGJaYuIQl0dG2OfpC9yCiF6qB3xpzaUtRboDB0d7hOi3nZJw -d "<qué cambió>"`.

## File Structure

- **`Schema.gs`** (modificar) — agrega las 4 columnas a `COLS.ENTREGAS` y 4 claves al mapa `E`.
- **`Config.gs`** (modificar) — agrega `PARAM.CARPETA_FIRMAS`.
- **`Entregas.gs`** (modificar) — `asegurarColumnasEntregas_()`, `ensureCarpetaFirmas_()`, `subirFirma_()`, y extiende `registrarEntrega_`, `confirmarEntregas_`, `confirmarEntregasVarias_`, `historialOperario_`.
- **`Api.gs`** (sin cambios de firma de ruta; ya pasa `p.datos` y `usuario`) — se revisa que `confirmarEntregas` reciba `datos.validacion`. No requiere edición si el payload viaja dentro de `datos`.
- **`index.html`** (modificar) — modal de firma (canvas + excepción), `confirmarPersona` reescrito, badges en `verEntregasOperario`, CSS del canvas.
- **`scratchpad/`** (temporal, no se commitea) — harness puppeteer para verificar el modal.

---

### Task 1: Esquema de `ENTREGAS` + migración de columnas

**Files:**
- Modify: `Schema.gs` (`COLS.ENTREGAS` línea ~18, mapa `E` línea ~50)
- Modify: `Entregas.gs` (nueva función `asegurarColumnasEntregas_`, cerca de `ensureNoEntregasSheet_` línea ~212)

**Interfaces:**
- Produces: `COLS.ENTREGAS` con encabezados `..., VALIDACION, FIRMA_URL, VALIDADO_POR, MOTIVO_VALIDACION`. Mapa `E` con `VALIDACION`, `FIRMA_URL`, `VALIDADO_POR`, `MOTIVO_VAL`. Función `asegurarColumnasEntregas_()` que agrega a la hoja viva cualquier encabezado de `COLS.ENTREGAS` que falte, al final, sin tocar datos.

- [ ] **Step 1: Actualizar `COLS.ENTREGAS` y el mapa `E` en `Schema.gs`**

Reemplazar el bloque `ENTREGAS` de `COLS`:

```javascript
  ENTREGAS: ['FECHA', 'LEGAJO', 'APELLIDO Y NOMBRE', 'PRENDA', 'TALLE',
             'MOTIVO', 'OBSERVACIONES',
             'VALIDACION', 'FIRMA_URL', 'VALIDADO_POR', 'MOTIVO_VALIDACION'],
```

Reemplazar el mapa `E`:

```javascript
var E = {
  FECHA: 'FECHA', LEGAJO: 'LEGAJO', NOMBRE: 'APELLIDO Y NOMBRE',
  PRENDA: 'PRENDA', TALLE: 'TALLE', MOTIVO: 'MOTIVO', OBS: 'OBSERVACIONES',
  VALIDACION: 'VALIDACION', FIRMA_URL: 'FIRMA_URL',
  VALIDADO_POR: 'VALIDADO_POR', MOTIVO_VAL: 'MOTIVO_VALIDACION'
};
```

- [ ] **Step 2: Agregar `asegurarColumnasEntregas_` en `Entregas.gs`**

Insertar después de `ensureNoEntregasSheet_` (o junto a las demás `ensure*`):

```javascript
/**
 * Agrega a la hoja ENTREGAS cualquier encabezado de COLS.ENTREGAS que falte,
 * al final, sin tocar los datos existentes. Idempotente. Migración para las
 * columnas de validación (firma). Se llama antes de escribir una entrega.
 */
function asegurarColumnasEntregas_() {
  var sh = requireSheet_(SHEETS.ENTREGAS);
  var headers = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), 1)).getValues()[0]
    .map(function (h) { return String(h || '').trim(); });
  COLS.ENTREGAS.forEach(function (h) {
    if (headers.indexOf(h) < 0) {
      sh.getRange(1, sh.getLastColumn() + 1).setValue(h);
      headers.push(h);
    }
  });
  return sh;
}
```

- [ ] **Step 3: Gate de sintaxis**

Run: `node --check Schema.gs && node --check Entregas.gs`
Expected: sin salida (exit 0).

- [ ] **Step 4: Commit**

```bash
git add Schema.gs Entregas.gs
git commit -m "feat(entregas): columnas de validacion en ENTREGAS + migracion asegurarColumnasEntregas_"
```

---

### Task 2: Carpeta de Drive y subida de firma

**Files:**
- Modify: `Config.gs` (mapa `PARAM`, línea ~28)
- Modify: `Entregas.gs` (nuevas `ensureCarpetaFirmas_`, `subirFirma_`)

**Interfaces:**
- Consumes: `escribirConfig_(clave, valor)`, `getConfigMap_()` (Config.gs); `fmtFechaHoraArchivo_` no existe — se define inline.
- Produces: `PARAM.CARPETA_FIRMAS = 'carpeta_firmas_id'`. `ensureCarpetaFirmas_()` → objeto Folder de Drive (crea al primer uso, guarda id en CONFIG). `subirFirma_(base64, legajo)` → string URL del PNG creado (`getUrl()`).

- [ ] **Step 1: Agregar la clave de parámetro en `Config.gs`**

En el objeto `PARAM`, agregar:

```javascript
  PIN_HASH: 'pin_acceso_hash',
  CARPETA_FIRMAS: 'carpeta_firmas_id'
```

(agregando la coma al final de la línea `PIN_HASH` anterior).

- [ ] **Step 2: Agregar `ensureCarpetaFirmas_` y `subirFirma_` en `Entregas.gs`**

Insertar en la sección de Drive (después de `asegurarColumnasEntregas_`):

```javascript
/**
 * Carpeta de Drive donde viven los PNG de firmas. Su id se guarda en CONFIG
 * (PARAM.CARPETA_FIRMAS). Se crea al primer uso. Devuelve el Folder.
 */
function ensureCarpetaFirmas_() {
  var id = getConfigMap_()[PARAM.CARPETA_FIRMAS];
  if (id) {
    try { return DriveApp.getFolderById(String(id)); } catch (e) { /* recrear abajo */ }
  }
  var carpeta = DriveApp.createFolder('Firmas Ropa INGECO');
  escribirConfig_(PARAM.CARPETA_FIRMAS, carpeta.getId());
  return carpeta;
}

/**
 * Sube una firma (dataURL PNG base64) a la carpeta de firmas y devuelve su URL.
 * base64 puede venir con o sin el prefijo "data:image/png;base64,".
 */
function subirFirma_(base64, legajo) {
  var s = String(base64 || '');
  var coma = s.indexOf(',');
  if (s.indexOf('data:image') === 0 && coma >= 0) s = s.slice(coma + 1);
  if (!s) throw new Error('La firma vino vacía.');
  var bytes = Utilities.base64Decode(s);
  var blob = Utilities.newBlob(bytes, 'image/png');
  var d = new Date();
  var stamp = d.getFullYear() +
    ('0' + (d.getMonth() + 1)).slice(-2) + ('0' + d.getDate()).slice(-2) + '_' +
    ('0' + d.getHours()).slice(-2) + ('0' + d.getMinutes()).slice(-2) + ('0' + d.getSeconds()).slice(-2);
  blob.setName('firma_' + claveLegajo_(legajo) + '_' + stamp + '.png');
  var archivo = ensureCarpetaFirmas_().createFile(blob);
  return archivo.getUrl();
}
```

- [ ] **Step 3: Gate de sintaxis**

Run: `node --check Config.gs && node --check Entregas.gs`
Expected: sin salida (exit 0).

- [ ] **Step 4: Commit**

```bash
git add Config.gs Entregas.gs
git commit -m "feat(entregas): carpeta de firmas en Drive + subirFirma_"
```

---

### Task 3: Backend — registrar la validación en cada fila

**Files:**
- Modify: `Entregas.gs` (`registrarEntrega_` ~línea 45, `confirmarEntregas_` ~línea 160, `confirmarEntregasVarias_` ~línea 185)

**Interfaces:**
- Consumes: `asegurarColumnasEntregas_()`, `subirFirma_(base64, legajo)`, mapa `E` (Task 1/2).
- Produces: `registrarEntrega_(datos)` acepta `datos.validacion = { tipo, firmaUrl?, motivo? }` y estampa `E.VALIDACION`, `E.FIRMA_URL`, `E.VALIDADO_POR`, `E.MOTIVO_VAL` en cada fila. `confirmarEntregas_(datos, usuario)`: individual, valida obligatoriedad y resuelve la firma (sube a Drive) antes de escribir. `confirmarEntregasVarias_` estampa `VALIDACION='LOTE'`.

**Contrato del payload individual** (lo que manda el front en `datos.validacion`):
- `{ tipo:'FIRMA', firmaBase64:'data:image/png;base64,...' }`
- `{ tipo:'PAPEL', motivo:'...' }`
- `{ tipo:'AUSENTE', motivo:'...' }`

- [ ] **Step 1: Extender `registrarEntrega_` para estampar la validación**

En `registrarEntrega_`, agregar tras calcular `nombre` (antes del `items.forEach`):

```javascript
  var val = datos.validacion || {};
  var valTipo = String(val.tipo || '').toUpperCase();     // FIRMA|PAPEL|AUSENTE|LOTE|''
  var valUrl = val.firmaUrl || '';
  var valMotivo = String(val.motivo || '').trim();
  var validadoPor = datos.__validadoPor || '';
```

Y dentro del `items.forEach`, agregar al objeto de `appendFilaPorHeader_` las 4 columnas nuevas:

```javascript
    appendFilaPorHeader_(SHEETS.ENTREGAS, {
      'FECHA': fecha,
      'LEGAJO': op[P.LEGAJO],
      'APELLIDO Y NOMBRE': nombre,
      'PRENDA': prenda,
      'TALLE': talle || '',
      'MOTIVO': motivo,
      'OBSERVACIONES': it.observaciones || datos.observaciones || '',
      'VALIDACION': valTipo,
      'FIRMA_URL': valUrl,
      'VALIDADO_POR': validadoPor,
      'MOTIVO_VALIDACION': valMotivo
    });
```

Al inicio de `registrarEntrega_` (primera línea del cuerpo), asegurar las columnas:

```javascript
  asegurarColumnasEntregas_();
```

- [ ] **Step 2: Extender `confirmarEntregas_` (flujo individual) con la obligatoriedad + subida de firma**

Reemplazar el cuerpo de `confirmarEntregas_` por:

```javascript
function confirmarEntregas_(datos, usuario) {
  datos = datos || {};
  var hayItems = datos.items && datos.items.length;
  var noEnt = datos.noEntrega || null;
  var hayNota = noEnt && String(noEnt.comentario || '').trim();
  if (!hayItems && !hayNota) {
    throw new Error('Elegí al menos una prenda para entregar o escribí el motivo de no-entrega.');
  }

  // Validación obligatoria SOLO cuando hay entrega de prendas (registrarEntrega_).
  if (hayItems) {
    var val = datos.validacion || {};
    var tipo = String(val.tipo || '').toUpperCase();
    if (tipo === 'FIRMA') {
      if (!val.firmaBase64) throw new Error('Falta la firma del operario.');
      val.firmaUrl = subirFirma_(val.firmaBase64, datos.legajo);
    } else if (tipo === 'PAPEL' || tipo === 'AUSENTE') {
      if (!String(val.motivo || '').trim()) throw new Error('Escribí el motivo de la excepción (papel / ausente).');
    } else {
      throw new Error('Falta la firma del operario o una excepción con motivo.');
    }
    datos.validacion = val;
    datos.__validadoPor = usuario || '';
  }

  var resultado = { ok: true };
  if (hayItems) resultado.entrega = registrarEntrega_(datos);
  if (hayNota) {
    registrarNoEntrega_({
      legajo: datos.legajo, fecha: datos.fecha,
      prendas: noEnt.prendas || [], comentario: noEnt.comentario
    }, usuario);
  }
  resultado.pendientes = entregasPendientes_();
  return resultado;
}
```

- [ ] **Step 3: Estampar `LOTE` en `confirmarEntregasVarias_`**

Dentro del `lista.forEach` de `confirmarEntregasVarias_`, antes de `if (hayItems) registrarEntrega_(datos);`, agregar:

```javascript
      if (hayItems) {
        datos.validacion = { tipo: 'LOTE' };
        datos.__validadoPor = usuario || '';
      }
```

(La línea `if (hayItems) registrarEntrega_(datos);` queda igual, justo después.)

- [ ] **Step 4: Gate de sintaxis**

Run: `node --check Entregas.gs`
Expected: sin salida (exit 0).

- [ ] **Step 5: Commit**

```bash
git add Entregas.gs
git commit -m "feat(entregas): obligar firma/excepcion en confirmarEntregas y estampar validacion"
```

---

### Task 4: Backend — exponer la validación en el historial del operario

**Files:**
- Modify: `Entregas.gs` (`historialOperario_` ~línea 269, el `.map` que arma `entregas`)

**Interfaces:**
- Consumes: mapa `E` con las claves nuevas (Task 1).
- Produces: cada objeto de `historialOperario_().entregas` incluye `validacion`, `firmaUrl`, `validadoPor`, `motivoValidacion`.

- [ ] **Step 1: Agregar los campos al map de `entregas`**

En `historialOperario_`, reemplazar el `.map` que arma `var entregas`:

```javascript
  var entregas = propias.map(function (f) {
    return {
      fecha: f._fecha ? fmtFecha_(f._fecha) : String(f[E.FECHA] || ''),
      prenda: f[E.PRENDA] || '',
      talle: f[E.TALLE] || '',
      motivo: f[E.MOTIVO] || '',
      observaciones: f[E.OBS] || '',
      validacion: f[E.VALIDACION] || '',
      firmaUrl: f[E.FIRMA_URL] || '',
      validadoPor: f[E.VALIDADO_POR] || '',
      motivoValidacion: f[E.MOTIVO_VAL] || ''
    };
  });
```

- [ ] **Step 2: Gate de sintaxis**

Run: `node --check Entregas.gs`
Expected: sin salida (exit 0).

- [ ] **Step 3: Commit**

```bash
git add Entregas.gs
git commit -m "feat(entregas): historialOperario_ devuelve validacion y firma"
```

---

### Task 5: Frontend — modal de firma en el botón "Confirmar" individual

**Files:**
- Modify: `index.html` (`confirmarPersona` ~línea 1017; CSS en el `<style>`; nuevas funciones de firma)
- Test (temporal, no commit): `scratchpad/measure-firma.js`, `scratchpad/_preview_firma.html`, `scratchpad/static-server.js`

**Interfaces:**
- Consumes: `recolectarEntrega_(card)` (devuelve `datos` o null), `abrirModal(titulo, html)`, `cerrarModal()`, `api('confirmarEntregas', {datos})`, `toast`, `esc`, `pintarPendientes`.
- Produces: al confirmar una tarjeta se abre el modal de firma; el `datos` enviado incluye `datos.validacion = {tipo:'FIRMA', firmaBase64}` o `{tipo:'PAPEL'|'AUSENTE', motivo}`.

- [ ] **Step 1: CSS del canvas de firma**

Agregar al `<style>` (junto a otras reglas de modal/card):

```css
  .firma-wrap { margin: 6px 0 10px; }
  .firma-canvas {
    width: 100%; height: 180px; touch-action: none;
    border: 1.5px dashed var(--bord, #b9c2cf); border-radius: 10px;
    background: #fff; display: block; cursor: crosshair;
  }
  .firma-hint { font-size: 12px; margin: 4px 0 0; }
  .firma-exc { margin-top: 10px; }
```

(Si `--bord` no existe como variable, usar el color literal `#b9c2cf`.)

- [ ] **Step 2: Reescribir `confirmarPersona` para abrir el modal de firma**

Reemplazar `confirmarPersona(card)` por:

```javascript
  function confirmarPersona(card) {
    var datos = recolectarEntrega_(card);
    if (!datos) {
      toast('Elegí al menos una prenda, o escribí el motivo de por qué no se entrega.', 'err');
      return;
    }
    // Si no se entrega ninguna prenda (solo motivo de no-entrega), no se pide firma.
    if (!datos.items.length) { enviarEntrega_(card, datos); return; }
    abrirModalFirma_(card, datos);
  }
```

- [ ] **Step 3: Agregar el modal de firma y su lógica**

Agregar estas funciones cerca de `confirmarPersona`:

```javascript
  /** Estado del canvas de firma abierto (para leer si tiene trazos). */
  var _firma = null;

  function abrirModalFirma_(card, datos) {
    var per = datos.items.map(function (it) { return it.prenda; }).join(', ');
    var nombre = card.querySelector('b') ? card.querySelector('b').textContent : ('legajo ' + datos.legajo);
    var html =
      '<p class="muted" style="margin-top:0">Entrega a <b>' + esc(nombre) + '</b> · ' + esc(per) + '.<br>' +
        'Que el operario firme abajo para confirmar que la recibió.</p>' +
      '<div class="firma-wrap"><canvas id="firmaCanvas" class="firma-canvas"></canvas>' +
        '<p class="firma-hint muted">Firmá con el dedo o el mouse. ' +
          '<button type="button" id="firmaBorrar" class="btn-link">Borrar</button></p></div>' +
      '<details class="firma-exc"><summary class="btn-link">El operario no puede firmar ahora</summary>' +
        '<div class="grid2" style="margin-top:8px">' +
          '<label class="campo"><span>Excepción</span><select id="firmaExcTipo">' +
            '<option value="">— elegir —</option>' +
            '<option value="PAPEL">Firma en papel</option>' +
            '<option value="AUSENTE">Ausente</option></select></label>' +
          '<label class="campo"><span>Motivo</span><input type="text" id="firmaExcMotivo" placeholder="Ej.: firmó la planilla en papel"></label>' +
        '</div></details>' +
      '<button id="firmaConfirmar" class="btn btn-primary btn-block" style="margin-top:12px">Confirmar entrega</button>';
    abrirModal('Firma de recepción', html);
    setTimeout(function () { initFirmaCanvas_(); }, 20);
    $('firmaBorrar').addEventListener('click', function () { limpiarFirma_(); });
    $('firmaConfirmar').addEventListener('click', function () { finalizarFirma_(card, datos); });
  }

  function initFirmaCanvas_() {
    var c = $('firmaCanvas'); if (!c) return;
    // Ajustar el tamaño real del canvas al tamaño en pantalla (nitidez).
    var rect = c.getBoundingClientRect();
    c.width = Math.max(1, Math.round(rect.width));
    c.height = Math.max(1, Math.round(rect.height));
    var ctx = c.getContext('2d');
    ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#12233a';
    _firma = { canvas: c, ctx: ctx, dib: false, trazos: false };
    function pos(e) {
      var r = c.getBoundingClientRect();
      var t = (e.touches && e.touches[0]) ? e.touches[0] : e;
      return { x: t.clientX - r.left, y: t.clientY - r.top };
    }
    function down(e) { e.preventDefault(); _firma.dib = true; var p = pos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); }
    function move(e) { if (!_firma.dib) return; e.preventDefault(); var p = pos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); _firma.trazos = true; }
    function up() { _firma.dib = false; }
    c.addEventListener('mousedown', down); c.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    c.addEventListener('touchstart', down, { passive: false });
    c.addEventListener('touchmove', move, { passive: false });
    c.addEventListener('touchend', up);
  }

  function limpiarFirma_() {
    if (!_firma) return;
    _firma.ctx.clearRect(0, 0, _firma.canvas.width, _firma.canvas.height);
    _firma.trazos = false;
  }

  /** Lee el modal, arma datos.validacion y envía. Prioriza la excepción si está completa. */
  function finalizarFirma_(card, datos) {
    var excTipo = $('firmaExcTipo') ? $('firmaExcTipo').value : '';
    var excMotivo = $('firmaExcMotivo') ? $('firmaExcMotivo').value.trim() : '';
    if (excTipo) {
      if (!excMotivo) { toast('Escribí el motivo de la excepción.', 'err'); return; }
      datos.validacion = { tipo: excTipo, motivo: excMotivo };
    } else {
      if (!_firma || !_firma.trazos) { toast('El operario tiene que firmar, o elegí una excepción con motivo.', 'err'); return; }
      datos.validacion = { tipo: 'FIRMA', firmaBase64: _firma.canvas.toDataURL('image/png') };
    }
    cerrarModal();
    enviarEntrega_(card, datos);
  }

  /** Manda la entrega ya con validacion resuelta (o sin items, solo no-entrega). */
  function enviarEntrega_(card, datos) {
    var btn = card.querySelector('.pConf');
    if (btn) btn.disabled = true;
    api('confirmarEntregas', { datos: datos }).then(function (r) {
      var msg = r.entrega
        ? ('Entrega registrada: ' + r.entrega.prendas.join(', ') + ' (' + r.entrega.fecha + ').' +
            (datos.noEntrega ? ' Motivo guardado.' : ''))
        : 'Motivo de no-entrega guardado.';
      toast(msg, 'ok');
      pintarPendientes(r.pendientes);
    }).catch(function (e) { if (btn) btn.disabled = false; manejar(e); });
  }
```

- [ ] **Step 4: Gate de sintaxis del front**

Extraer el `<script>` del `index.html` y correr `node --check`. Comando (Git Bash):

```bash
node -e "const fs=require('fs');const h=fs.readFileSync('index.html','utf8');const m=h.match(/<script>([\s\S]*?)<\/script>/g).map(s=>s.replace(/<\/?script>/g,'')).join('\n;\n');fs.writeFileSync('scratchpad/_front.js',m);"
node --check scratchpad/_front.js
```
Expected: sin salida (exit 0).

- [ ] **Step 5: Harness puppeteer del modal**

Crear `scratchpad/_preview_firma.html` = copia de `index.html` con un `<script>` stub de `google.script.run` que:
- para `loginPin` devuelve token falso,
- para `entregasPendientes`/pantalla inicial devuelve 1 persona con 2 prendas,
- para `confirmarEntregas` **loguea el payload recibido en `window.__ultimoPayload`** y devuelve `{ok:true, data:{entrega:{prendas:['PANTALON'],fecha:'03/07/2026'}, pendientes:{hayCompra:true,total:0,personas:[]}}}`.

Crear `scratchpad/measure-firma.js` (puppeteer-core apuntando a `C:/Program Files/Google/Chrome/Application/chrome.exe`) que:
1. navega al server estático, auto-login,
2. va a Entregar, abre una tarjeta y toca "Confirmar",
3. verifica que aparece `#firmaCanvas`,
4. **caso firma:** simula trazos con `page.mouse` sobre el canvas, toca "Confirmar entrega", lee `window.__ultimoPayload` y asserta `validacion.tipo==='FIRMA'` y que `firmaBase64` empieza con `data:image/png`,
5. **caso excepción:** reabre, elige `PAPEL` sin motivo → asserta que NO se envió (sigue el toast de error); luego con motivo → asserta `validacion.tipo==='PAPEL'` y `motivo` presente,
6. **caso firma vacía:** reabre, toca "Confirmar entrega" sin firmar ni excepción → asserta que NO se envió.

Run:
```bash
PORT=4599 node scratchpad/static-server.js &   # sirve scratchpad/_preview_firma.html
node scratchpad/measure-firma.js
```
Expected: imprime `OK firma`, `OK papel`, `OK vacio` (los tres asserts pasan).

- [ ] **Step 6: Commit** (solo `index.html`; el scratchpad está gitignored / no se agrega)

```bash
git add index.html
git commit -m "feat(entregas): modal de firma del operario al confirmar entrega individual"
```

---

### Task 6: Frontend — badges de validación en el historial del operario

**Files:**
- Modify: `index.html` (`verEntregasOperario` ~línea 2038; nueva helper `badgeValidacion`)

**Interfaces:**
- Consumes: `historialOperario_().entregas[i]` con `validacion`, `firmaUrl`, `validadoPor`, `motivoValidacion` (Task 4). `esc`, `tabla`.
- Produces: la tabla de entregas del modal muestra una columna "Validación" con badge + link.

- [ ] **Step 1: Agregar helper `badgeValidacion` cerca de `badgeMotivo`**

```javascript
  function badgeValidacion(e) {
    var v = String(e.validacion || '').toUpperCase();
    if (v === 'FIRMA') {
      return e.firmaUrl
        ? '<a href="' + esc(e.firmaUrl) + '" target="_blank" rel="noopener">✍️ Firmada</a>'
        : '<span class="badge tag">✍️ Firmada</span>';
    }
    if (v === 'PAPEL') return '<span class="badge tag" title="' + esc(e.motivoValidacion || '') + '">📄 Papel</span>';
    if (v === 'AUSENTE') return '<span class="badge critico" title="' + esc(e.motivoValidacion || '') + '">🚫 Ausente</span>';
    return '<span class="muted">—</span>'; // LOTE o histórico
  }
```

- [ ] **Step 2: Agregar la columna "Validación" a la tabla de entregas**

En `verEntregasOperario`, reemplazar el `.map` de `rows` y la llamada a `tabla`:

```javascript
        var rows = h.entregas.map(function (e) {
          return '<tr><td>' + esc(e.fecha) + '</td><td>' + esc(e.prenda) + '</td>' +
            '<td>' + esc(e.talle || '—') + '</td>' +
            '<td>' + badgeMotivo(e.motivo) + '</td>' +
            '<td>' + badgeValidacion(e) + '</td>' +
            '<td class="muted">' + esc(e.observaciones || '') + '</td></tr>';
        }).join('');
        cuerpo = '<p class="muted"><b>' + h.entregas.length + '</b> entrega(s), de la más nueva a la más vieja.</p>' +
          tabla(['Fecha', 'Prenda', 'Talle', 'Motivo', 'Validación', 'Obs.'], rows);
```

- [ ] **Step 3: Gate de sintaxis del front**

Run (mismo extractor que Task 5 Step 4):
```bash
node -e "const fs=require('fs');const h=fs.readFileSync('index.html','utf8');const m=h.match(/<script>([\s\S]*?)<\/script>/g).map(s=>s.replace(/<\/?script>/g,'')).join('\n;\n');fs.writeFileSync('scratchpad/_front.js',m);"
node --check scratchpad/_front.js
```
Expected: sin salida (exit 0).

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat(entregas): badge de validacion/firma en el historial del operario"
```

---

### Task 7: Deploy y smoke test en vivo

**Files:** ninguno (deploy + verificación manual).

- [ ] **Step 1: Push y redeploy con clasp**

```bash
clasp push --force
clasp redeploy AKfycbwWPz0KiSGEmgJDGYgaBsWGJaYuIQl0dG2OfpC9yCiF6qB3xpzaUtRboDB0d7hOi3nZJw -d "firma del operario en entregas"
```
Expected: `Pushed N files.` y redeploy OK. Si sale `invalid_grant/invalid_rapt` → `clasp login` (interactivo, cuenta marcoskatz@grupoingeco.com.ar) y reintentar.

- [ ] **Step 2: Smoke test manual — firma**

Abrir `https://marcoskatz-cmd.github.io/ingeco-ropa/`, ir a **Entregar**, tomar una persona con pendientes, tocar **Confirmar**, firmar en el canvas, **Confirmar entrega**. Verificar:
- Toast "Entrega registrada…".
- En la hoja `ENTREGAS`: la(s) fila(s) nueva(s) tienen `VALIDACION=FIRMA`, `FIRMA_URL` con link, `VALIDADO_POR=Compras`.
- El link de `FIRMA_URL` abre el PNG en Drive (carpeta "Firmas Ropa INGECO").

- [ ] **Step 3: Smoke test manual — excepción**

Otra persona → **Confirmar** → "El operario no puede firmar ahora" → *Papel* + motivo → **Confirmar entrega**. Verificar en `ENTREGAS`: `VALIDACION=PAPEL`, `MOTIVO_VALIDACION` con el texto, `FIRMA_URL` vacío. Repetir sin motivo y confirmar que **no deja** enviar.

- [ ] **Step 4: Smoke test manual — historial y lote**

En **Personal**, abrir "Entregas" de esa persona: la tabla muestra la columna **Validación** con "✍️ Firmada" (link) y "📄 Papel" (motivo en el tooltip). Probar además "Confirmar seleccionadas" (lote) con otra persona y verificar `VALIDACION=LOTE` en `ENTREGAS`.

- [ ] **Step 5: Actualizar la memoria del proyecto**

Actualizar `ingeco-ropa-deploy.md` con la nueva tanda: columnas de validación en `ENTREGAS`, carpeta de firmas en Drive (`PARAM.CARPETA_FIRMAS`), modal de firma en Entregar y badges en el historial.

---

## Self-Review

**Spec coverage:**
- §1 Flujo de usuario → Task 5 (modal firma + excepción).
- §2 Modelo de datos (4 columnas + migración) → Task 1.
- §3 Guardado en Drive → Task 2.
- §4 Backend (obligatoriedad, subirFirma, lote=LOTE) → Task 3.
- §5 Ver firma en historial → Task 4 (backend) + Task 6 (front).
- §6 Componentes/límites → reflejado en File Structure y separación de tasks.
- §7 Errores y bordes → cubiertos: firma vacía (Task 5 Step 3 `_firma.trazos`), excepción sin motivo (Task 5 `finalizarFirma_` + Task 3 revalida), base64 malformado (Task 2 `subirFirma_`), filas históricas (Task 6 `badgeValidacion` caso `—`), Drive falla antes de escribir (Task 3: `subirFirma_` corre antes de `registrarEntrega_`).
- §8 Verificación → node --check en cada task, harness puppeteer en Task 5, smoke en Task 7.

**Placeholder scan:** sin TBD/TODO; todo el código concreto está en los steps.

**Type consistency:** `datos.validacion = {tipo, firmaBase64|firmaUrl, motivo}` es consistente entre front (Task 5 manda `firmaBase64`) y backend (Task 3 lo convierte a `firmaUrl` vía `subirFirma_` antes de estampar). Mapa `E` (Task 1) usado igual en Task 3 (escritura) y Task 4 (lectura). `badgeValidacion` (Task 6) consume exactamente los campos que produce Task 4.

**Nota de bordes cubierta:** en `confirmarEntregas_` la obligatoriedad se aplica solo cuando `hayItems` (hay prendas a entregar). Un confirm de **solo no-entrega** (sin prendas) no pide firma — correcto, no hay recepción que firmar. Esto es coherente con Task 5 Step 2, que saltea el modal si `datos.items.length === 0`.
