# Métodos de confirmación de entrega (firma vs planilla) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Separar claramente los dos métodos de confirmación de entrega (firma en el momento vs planilla en papel) y permitir adjuntar foto/archivo de la planilla firmada.

**Architecture:** App de Google Apps Script + Google Sheets con un front SPA en un único `index.html`. El modal de confirmación individual pasa a tener un selector de 2 métodos (Firma / Planilla) que muestra solo el panel activo. El backend exige `VALIDACION='FIRMA'` o `'PAPEL'` para toda entrega de prendas; `PAPEL` sube el archivo a Drive y guarda su URL en `FIRMA_URL`. El botón de lote sube una foto compartida opcional que abarca a todos los seleccionados.

**Tech Stack:** Google Apps Script (`.gs`), HTML/CSS/JS vanilla (ES5, sin frameworks), Google Drive API (`DriveApp`), Google Sheets. Verificación: `node --check` como gate de sintaxis + harness Chrome headless con `puppeteer-core`.

## Global Constraints

- **JS del front en ES5** (sin `let`/`const`/arrow/template literals): el `<script>` de `index.html` usa `var` y `function`. Mantener ese estilo.
- **Regla CSS global peligrosa:** existe `input { width:100% }`; los checkboxes/radios ya tienen override `input[type="checkbox"],input[type="radio"]{width:auto}`. Cuidado al agregar inputs nuevos.
- **Sin columnas nuevas en ENTREGAS:** la planilla reutiliza `VALIDACION='PAPEL'` y `FIRMA_URL` (ya existen). Sin migración de esquema.
- **Deploy (NO copiar/pegar):** `clasp push --force` + `clasp redeploy AKfycbwWPz0KiSGEmgJDGYgaBsWGJaYuIQl0dG2OfpC9yCiF6qB3xpzaUtRboDB0d7hOi3nZJw -d "..."`. Solo al final y con OK del usuario.
- **Verificación (no hay framework de tests):** cada tarea que toca `.gs` cierra con `node --check` sobre una copia `.js`; cada tarea de front cierra con `node --check` sobre el `<script>` extraído. La verificación integrada final es el harness puppeteer-core contra el Chrome del sistema (`C:/Program Files/Google/Chrome/Application/chrome.exe`).
- **Carpeta local del repo:** `C:\Users\Usuario\Desktop\ingeco-ropa`. Scratchpad para archivos temporales: `C:\Users\Usuario\AppData\Local\Temp\claude\C--Users-Usuario\<sesión>\scratchpad`.

---

## File Structure

- `Entregas.gs` — nueva `subirPlanilla_`; `confirmarEntregas_` (rama PAPEL, sin AUSENTE); `confirmarEntregasVarias_` (acepta `planillaBase64`).
- `Api.gs` — ruta `confirmarEntregasVarias` pasa `p.planillaBase64`.
- `index.html` — CSS del panel de planilla; helper `prepararArchivoPlanilla_`; reestructura del modal individual (`abrirModalFirma_` + `finalizarFirma_`); mini-modal de lote (`confirmarSeleccionadas_`) + rename del botón.

---

## Task 1: Backend — `subirPlanilla_` (subida de foto/PDF a Drive)

**Files:**
- Modify: `Entregas.gs` (agregar función después de `subirFirma_`, ~línea 304)
- Test: `node --check` sobre copia `.js`

**Interfaces:**
- Consumes: `ensureCarpetaFirmas_()`, `claveLegajo_(v)`, `Utilities.base64Decode`, `DriveApp` (ya existen).
- Produces: `subirPlanilla_(dataUrl, legajo) -> string (URL de Drive)`. Acepta dataURL `data:image/jpeg|image/png|application/pdf;base64,...`. Lanza error si el mime no es soportado o el dataURL es inválido.

- [ ] **Step 1: Agregar la función `subirPlanilla_`**

En `Entregas.gs`, inmediatamente después del cierre de `subirFirma_` (después de la línea `  return archivo.getUrl();\n}` de `subirFirma_`, ~línea 304), insertar:

```javascript
/**
 * Sube una planilla firmada (dataURL base64 de imagen JPG/PNG o PDF) a la
 * carpeta de firmas y devuelve su URL. El tipo se detecta del prefijo del
 * dataURL. Lanza error si el tipo no es soportado.
 */
function subirPlanilla_(dataUrl, legajo) {
  var s = String(dataUrl || '');
  var m = s.match(/^data:([^;]+);base64,(.*)$/);
  if (!m) throw new Error('La planilla vino vacía o en formato inválido.');
  var mime = m[1], b64 = m[2];
  var ext = mime === 'image/png' ? 'png'
    : (mime === 'image/jpeg' ? 'jpg'
    : (mime === 'application/pdf' ? 'pdf' : ''));
  if (!ext) throw new Error('Tipo de planilla no soportado: ' + mime);
  if (!b64) throw new Error('La planilla vino vacía.');
  var bytes = Utilities.base64Decode(b64);
  var blob = Utilities.newBlob(bytes, mime);
  var d = new Date();
  var stamp = d.getFullYear() +
    ('0' + (d.getMonth() + 1)).slice(-2) + ('0' + d.getDate()).slice(-2) + '_' +
    ('0' + d.getHours()).slice(-2) + ('0' + d.getMinutes()).slice(-2) + ('0' + d.getSeconds()).slice(-2);
  blob.setName('planilla_' + (claveLegajo_(legajo) || 'LOTE') + '_' + stamp + '.' + ext);
  var archivo = ensureCarpetaFirmas_().createFile(blob);
  return archivo.getUrl();
}
```

- [ ] **Step 2: Verificar sintaxis**

```bash
cp Entregas.gs /tmp/Entregas.check.js && node --check /tmp/Entregas.check.js && echo OK
```
Expected: `OK` (sin errores de parseo).

- [ ] **Step 3: Commit**

```bash
git add Entregas.gs
git commit -m "feat(entregas): subirPlanilla_ (foto/PDF de planilla a Drive)"
```

---

## Task 2: Backend — `confirmarEntregas_` acepta PAPEL con archivo, elimina AUSENTE

**Files:**
- Modify: `Entregas.gs:180-193` (bloque de validación dentro de `confirmarEntregas_`)
- Test: `node --check`

**Interfaces:**
- Consumes: `subirFirma_`, `subirPlanilla_` (Task 1).
- Produces: contrato nuevo de `datos.validacion` para entregas con prendas — `{ tipo:'FIRMA', firmaBase64 }` **o** `{ tipo:'PAPEL', planillaBase64, motivo? }`. Cualquier otro `tipo` (incluido `AUSENTE`) → error. `motivo` opcional en PAPEL.

- [ ] **Step 1: Reemplazar el bloque de validación**

En `Entregas.gs`, dentro de `confirmarEntregas_`, reemplazar el bloque actual:

```javascript
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
```

por:

```javascript
    var val = datos.validacion || {};
    var tipo = String(val.tipo || '').toUpperCase();
    if (tipo === 'FIRMA') {
      if (!val.firmaBase64) throw new Error('Falta la firma del operario.');
      val.firmaUrl = subirFirma_(val.firmaBase64, datos.legajo);
    } else if (tipo === 'PAPEL') {
      if (!val.planillaBase64) throw new Error('Adjuntá la foto o el archivo de la planilla firmada.');
      val.firmaUrl = subirPlanilla_(val.planillaBase64, datos.legajo);
    } else {
      throw new Error('Confirmá la entrega con la firma del operario o con la planilla.');
    }
    datos.validacion = val;
    datos.__validadoPor = usuario || '';
```

Nota: `registrarEntrega_` toma `val.motivo` como `MOTIVO_VALIDACION` y no lo exige, así que la observación opcional de PAPEL fluye sola sin cambios extra.

- [ ] **Step 2: Verificar sintaxis**

```bash
cp Entregas.gs /tmp/Entregas.check.js && node --check /tmp/Entregas.check.js && echo OK
```
Expected: `OK`.

- [ ] **Step 3: Commit**

```bash
git add Entregas.gs
git commit -m "feat(entregas): entrega exige FIRMA o PAPEL con archivo; saca AUSENTE del alta"
```

---

## Task 3: Backend — lote con foto compartida (`confirmarEntregasVarias_` + ruta Api)

**Files:**
- Modify: `Entregas.gs:212-238` (`confirmarEntregasVarias_`)
- Modify: `Api.gs:64` (ruta `confirmarEntregasVarias`)
- Test: `node --check` sobre ambos

**Interfaces:**
- Consumes: `subirPlanilla_` (Task 1).
- Produces: `confirmarEntregasVarias_(lista, usuario, planillaBase64)`. Si `planillaBase64` viene, sube UNA vez y estampa `{ tipo:'PAPEL', firmaUrl }` en cada entrega; si no, `{ tipo:'LOTE' }` como antes.

- [ ] **Step 1: Reemplazar `confirmarEntregasVarias_`**

En `Entregas.gs`, reemplazar la función completa (líneas ~207-238) por:

```javascript
/**
 * Confirma varias personas de una (botón "Confirmar por planilla (varios)").
 * Si viene `planillaBase64` (foto/archivo compartido de la planilla firmada por
 * todos), se sube UNA sola vez y su URL se estampa en cada entrega con
 * VALIDACION='PAPEL'. Sin foto, se usa VALIDACION='LOTE' (respaldo sin evidencia
 * digital). Recalcula los pendientes UNA sola vez al final.
 * lista = [ { legajo, fecha, motivo, items:[...], noEntrega?:{...} }, ... ]
 */
function confirmarEntregasVarias_(lista, usuario, planillaBase64) {
  lista = lista || [];
  var urlPlanilla = planillaBase64 ? subirPlanilla_(planillaBase64, 'lote') : '';
  var confirmados = [], errores = [];
  lista.forEach(function (datos) {
    try {
      var hayItems = datos.items && datos.items.length;
      var noEnt = datos.noEntrega || null;
      var hayNota = noEnt && String(noEnt.comentario || '').trim();
      if (!hayItems && !hayNota) return; // nada que hacer para esta persona
      if (hayItems) {
        datos.validacion = urlPlanilla
          ? { tipo: 'PAPEL', firmaUrl: urlPlanilla }
          : { tipo: 'LOTE' };
        datos.__validadoPor = usuario || '';
      }
      if (hayItems) registrarEntrega_(datos);
      if (hayNota) {
        registrarNoEntrega_({
          legajo: datos.legajo, fecha: datos.fecha,
          prendas: noEnt.prendas || [], comentario: noEnt.comentario
        }, usuario);
      }
      confirmados.push(datos.legajo);
    } catch (e) {
      errores.push({ legajo: datos.legajo, error: e.message });
    }
  });
  return { ok: true, confirmados: confirmados, errores: errores, pendientes: entregasPendientes_() };
}
```

- [ ] **Step 2: Pasar `planillaBase64` desde la ruta Api**

En `Api.gs`, línea 64, reemplazar:

```javascript
    case 'confirmarEntregasVarias': return confirmarEntregasVarias_(p.lista || [], usuario);
```
por:
```javascript
    case 'confirmarEntregasVarias': return confirmarEntregasVarias_(p.lista || [], usuario, p.planillaBase64 || '');
```

- [ ] **Step 3: Verificar sintaxis de ambos**

```bash
cp Entregas.gs /tmp/Entregas.check.js && node --check /tmp/Entregas.check.js && \
cp Api.gs /tmp/Api.check.js && node --check /tmp/Api.check.js && echo OK
```
Expected: `OK`.

- [ ] **Step 4: Commit**

```bash
git add Entregas.gs Api.gs
git commit -m "feat(entregas): lote con foto compartida de planilla (VALIDACION=PAPEL)"
```

---

## Task 4: Front — helper `prepararArchivoPlanilla_` (leer + comprimir imagen / validar PDF)

**Files:**
- Modify: `index.html` (agregar la función dentro del `<script>`, junto a los helpers de firma, después de `limpiarFirma_` ~línea 1093)
- Test: `node --check` sobre el `<script>` extraído

**Interfaces:**
- Produces: `prepararArchivoPlanilla_(file) -> Promise<{ dataUrl, nombre }>`. Imágenes: redimensiona a máx 1600px lado mayor y exporta JPEG 0.8. PDF: valida ≤10 MB y devuelve el dataURL tal cual. Rechaza otros tipos.

- [ ] **Step 1: Agregar el helper**

En `index.html`, después de la función `limpiarFirma_` (que termina en `    _firma.trazos = false;\n  }`, ~línea 1093), insertar:

```javascript
  /**
   * Lee un archivo de planilla (imagen o PDF) y devuelve {dataUrl, nombre}.
   * Las imágenes se redimensionan a máx 1600px y se exportan JPEG (subida más
   * liviana desde el celular). Los PDF se devuelven tal cual, con tope 10 MB.
   */
  function prepararArchivoPlanilla_(file) {
    return new Promise(function (resolve, reject) {
      if (!file) { reject(new Error('No se eligió archivo.')); return; }
      var tipo = file.type || '';
      var esImagen = tipo.indexOf('image/') === 0;
      var esPdf = tipo === 'application/pdf' || /\.pdf$/i.test(file.name || '');
      if (!esImagen && !esPdf) { reject(new Error('Subí una foto (JPG/PNG) o un PDF.')); return; }
      if (esPdf) {
        if (file.size > 10 * 1024 * 1024) { reject(new Error('El PDF supera 10 MB. Reducilo e intentá de nuevo.')); return; }
        var frp = new FileReader();
        frp.onload = function () { resolve({ dataUrl: String(frp.result), nombre: file.name }); };
        frp.onerror = function () { reject(new Error('No se pudo leer el archivo.')); };
        frp.readAsDataURL(file);
        return;
      }
      var fr = new FileReader();
      fr.onload = function () {
        var img = new Image();
        img.onload = function () {
          var max = 1600, w = img.width, h = img.height;
          if (w > max || h > max) {
            if (w >= h) { h = Math.round(h * max / w); w = max; }
            else { w = Math.round(w * max / h); h = max; }
          }
          var cv = document.createElement('canvas');
          cv.width = w; cv.height = h;
          cv.getContext('2d').drawImage(img, 0, 0, w, h);
          resolve({ dataUrl: cv.toDataURL('image/jpeg', 0.8), nombre: file.name });
        };
        img.onerror = function () { reject(new Error('No se pudo procesar la imagen.')); };
        img.src = String(fr.result);
      };
      fr.onerror = function () { reject(new Error('No se pudo leer el archivo.')); };
      fr.readAsDataURL(file);
    });
  }
```

- [ ] **Step 2: Verificar sintaxis del front**

```bash
node -e "var fs=require('fs');var h=fs.readFileSync('index.html','utf8');var m=h.match(/<script>[\s\S]*?<\/script>/g);var s=m[m.length-1].replace(/<\/?script>/g,'');fs.writeFileSync('/tmp/front.check.js',s);" && node --check /tmp/front.check.js && echo OK
```
Expected: `OK`.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat(entregas): helper prepararArchivoPlanilla_ (comprime imagen / valida PDF)"
```

---

## Task 5: Front — reestructura del modal individual (selector Firma / Planilla)

**Files:**
- Modify: `index.html:1041-1063` (`abrirModalFirma_`)
- Modify: `index.html:1096-1109` (`finalizarFirma_`)
- Modify: `index.html:358` (CSS: reemplazar `.firma-exc` por estilos de planilla)
- Test: `node --check` sobre el `<script>` extraído

**Interfaces:**
- Consumes: `prepararArchivoPlanilla_` (Task 4), `abrirModal`, `cerrarModal`, `initFirmaCanvas_`, `limpiarFirma_`, `enviarEntrega_`, `toast`, `_firma`.
- Produces: modal con `.seg` de 2 métodos; estado en variable `_planilla` (`{dataUrl,nombre}` o `null`); `finalizarFirma_` arma `validacion` FIRMA o PAPEL según método activo.

- [ ] **Step 1: Agregar estado `_planilla` y reemplazar `abrirModalFirma_`**

En `index.html`, reemplazar el bloque de `var _firma = null;` … fin de `abrirModalFirma_` (líneas ~1039-1063) por:

```javascript
  /** Estado del canvas de firma abierto (para leer si tiene trazos). */
  var _firma = null;
  /** Archivo de planilla ya preparado ({dataUrl, nombre}) o null. */
  var _planilla = null;

  function abrirModalFirma_(card, datos) {
    _planilla = null;
    var per = datos.items.map(function (it) { return it.prenda; }).join(', ');
    var nombre = card.querySelector('b') ? card.querySelector('b').textContent : ('legajo ' + datos.legajo);
    var html =
      '<p class="muted" style="margin-top:0">Entrega a <b>' + esc(nombre) + '</b> · ' + esc(per) + '.</p>' +
      '<div class="seg" role="tablist">' +
        '<button type="button" class="seg-btn activo" id="metFirma">✍️ Firma en el momento</button>' +
        '<button type="button" class="seg-btn" id="metPapel">📄 Por planilla</button>' +
      '</div>' +
      '<div id="panelFirma">' +
        '<p class="muted" style="margin:0 0 4px">Que el operario firme abajo para confirmar que la recibió.</p>' +
        '<div class="firma-wrap"><canvas id="firmaCanvas" class="firma-canvas"></canvas>' +
          '<p class="firma-hint muted">Firmá con el dedo o el mouse. ' +
            '<button type="button" id="firmaBorrar" class="btn-link">Borrar</button></p></div>' +
      '</div>' +
      '<div id="panelPapel" class="oculto">' +
        '<p class="muted" style="margin:0 0 6px">Subí una foto o el archivo de la planilla firmada en papel.</p>' +
        '<label class="campo"><span>Planilla firmada (foto o PDF)</span>' +
          '<input type="file" id="planillaFile" accept="image/*,application/pdf" capture="environment"></label>' +
        '<p id="planillaPreview" class="muted" style="margin:6px 0 0"></p>' +
        '<label class="campo" style="margin-top:8px"><span>Observación (opcional)</span>' +
          '<input type="text" id="planillaObs" placeholder="Ej.: planilla del centro tal, del día X"></label>' +
      '</div>' +
      '<button id="firmaConfirmar" class="btn btn-primary btn-block" style="margin-top:12px">Confirmar entrega</button>';
    abrirModal('Confirmar entrega', html);
    setTimeout(function () { initFirmaCanvas_(); }, 20);
    $('firmaBorrar').addEventListener('click', function () { limpiarFirma_(); });
    $('metFirma').addEventListener('click', function () { seleccionarMetodoEntrega_('FIRMA'); });
    $('metPapel').addEventListener('click', function () { seleccionarMetodoEntrega_('PAPEL'); });
    $('planillaFile').addEventListener('change', function () { onPlanillaElegida_(this.files && this.files[0]); });
    $('firmaConfirmar').addEventListener('click', function () { finalizarFirma_(card, datos); });
  }

  /** Cambia el panel visible según el método (FIRMA / PAPEL). */
  function seleccionarMetodoEntrega_(metodo) {
    var esFirma = metodo === 'FIRMA';
    $('metFirma').classList.toggle('activo', esFirma);
    $('metPapel').classList.toggle('activo', !esFirma);
    $('panelFirma').classList.toggle('oculto', !esFirma);
    $('panelPapel').classList.toggle('oculto', esFirma);
  }

  /** Método de entrega activo en el modal ('FIRMA' | 'PAPEL'). */
  function metodoEntregaActivo_() {
    return $('metPapel') && $('metPapel').classList.contains('activo') ? 'PAPEL' : 'FIRMA';
  }

  /** Procesa el archivo elegido y actualiza el preview / estado _planilla. */
  function onPlanillaElegida_(file) {
    var prev = $('planillaPreview');
    if (!file) { _planilla = null; if (prev) prev.textContent = ''; return; }
    if (prev) prev.textContent = 'Procesando…';
    prepararArchivoPlanilla_(file).then(function (r) {
      _planilla = r;
      if (prev) prev.textContent = '✔️ ' + r.nombre;
    }).catch(function (e) {
      _planilla = null;
      if (prev) prev.textContent = '';
      toast(e.message, 'err');
    });
  }
```

- [ ] **Step 2: Reemplazar `finalizarFirma_`**

Reemplazar `finalizarFirma_` (líneas ~1096-1109) por:

```javascript
  /** Lee el método activo del modal, arma datos.validacion y envía. */
  function finalizarFirma_(card, datos) {
    if (metodoEntregaActivo_() === 'PAPEL') {
      if (!_planilla || !_planilla.dataUrl) { toast('Adjuntá la foto o el archivo de la planilla firmada.', 'err'); return; }
      var obs = $('planillaObs') ? $('planillaObs').value.trim() : '';
      datos.validacion = { tipo: 'PAPEL', planillaBase64: _planilla.dataUrl, motivo: obs };
    } else {
      if (!_firma || !_firma.trazos) { toast('El operario tiene que firmar, o cambiá a "Por planilla".', 'err'); return; }
      datos.validacion = { tipo: 'FIRMA', firmaBase64: _firma.canvas.toDataURL('image/png') };
    }
    var fb = $('firmaConfirmar'); if (fb) fb.disabled = true;
    cerrarModal();
    enviarEntrega_(card, datos);
  }
```

- [ ] **Step 3: Reemplazar el CSS `.firma-exc` por estilos de planilla**

En `index.html`, línea ~358, reemplazar:

```css
  .firma-exc { margin-top: 10px; }
```
por:
```css
  #panelPapel input[type="file"] { width: 100%; font-size: 13px; }
  #panelPapel .campo { margin-top: 0; }
```

- [ ] **Step 4: Verificar sintaxis del front**

```bash
node -e "var fs=require('fs');var h=fs.readFileSync('index.html','utf8');var m=h.match(/<script>[\s\S]*?<\/script>/g);var s=m[m.length-1].replace(/<\/?script>/g,'');fs.writeFileSync('/tmp/front.check.js',s);" && node --check /tmp/front.check.js && echo OK
```
Expected: `OK`.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat(entregas): modal con selector Firma/Planilla + subida de planilla"
```

---

## Task 6: Front — lote "por planilla (varios)" con foto compartida

**Files:**
- Modify: `index.html:971` (texto del botón `ePendConfSel`)
- Modify: `index.html:1126-1141` (`confirmarSeleccionadas_`)
- Test: `node --check` sobre el `<script>` extraído

**Interfaces:**
- Consumes: `recolectarEntrega_`, `prepararArchivoPlanilla_` (Task 4), `abrirModal`, `cerrarModal`, `api`, `toast`, `pintarPendientes`, `manejar`.
- Produces: mini-modal de lote; envía `api('confirmarEntregasVarias', { lista, planillaBase64 })`.

- [ ] **Step 1: Renombrar el botón del lote**

En `index.html`, línea ~971, reemplazar:

```javascript
        '<button id="ePendConfSel" class="btn btn-primary btn-sm">Confirmar seleccionadas</button>' +
```
por:
```javascript
        '<button id="ePendConfSel" class="btn btn-primary btn-sm">Confirmar por planilla (varios)</button>' +
```

- [ ] **Step 2: Reemplazar `confirmarSeleccionadas_`**

Reemplazar la función completa (líneas ~1126-1141) por:

```javascript
  /** Abre el mini-modal de confirmación por planilla para las personas tildadas. */
  function confirmarSeleccionadas_() {
    var cont = $('pendCards'); if (!cont) return;
    var seleccionadas = Array.prototype.slice.call(cont.querySelectorAll('.pend-card'))
      .filter(function (card) { var s = card.querySelector('.pSelPer'); return s && s.checked; });
    if (!seleccionadas.length) { toast('Seleccioná al menos una persona.', 'err'); return; }
    var lista = [];
    seleccionadas.forEach(function (card) { var d = recolectarEntrega_(card); if (d) lista.push(d); });
    if (!lista.length) { toast('Las personas seleccionadas no tienen prendas tildadas ni motivo.', 'err'); return; }

    _planilla = null;
    var html =
      '<p class="muted" style="margin-top:0">Vas a confirmar la entrega de <b>' + lista.length + '</b> persona(s) ' +
        'por <b>planilla en papel</b>, con la fecha y las prendas tildadas.</p>' +
      '<label class="campo"><span>Foto de la planilla firmada por todos (opcional)</span>' +
        '<input type="file" id="loteFile" accept="image/*,application/pdf" capture="environment"></label>' +
      '<p id="planillaPreview" class="muted" style="margin:6px 0 0"></p>' +
      '<button id="loteConfirmar" class="btn btn-primary btn-block" style="margin-top:12px">Confirmar entregas</button>';
    abrirModal('Confirmar por planilla (varios)', html);
    $('loteFile').addEventListener('change', function () { onPlanillaElegida_(this.files && this.files[0]); });
    $('loteConfirmar').addEventListener('click', function () { enviarLotePlanilla_(lista); });
  }

  /** Envía el lote con la foto compartida (si se adjuntó). */
  function enviarLotePlanilla_(lista) {
    var payload = { lista: lista };
    if (_planilla && _planilla.dataUrl) payload.planillaBase64 = _planilla.dataUrl;
    var btn = $('loteConfirmar'); if (btn) btn.disabled = true;
    cerrarModal();
    var barBtn = $('ePendConfSel'); if (barBtn) barBtn.disabled = true;
    api('confirmarEntregasVarias', payload).then(function (r) {
      var okN = (r.confirmados || []).length, errN = (r.errores || []).length;
      toast('Entregas confirmadas: ' + okN + (errN ? ' · ' + errN + ' con error' : '') + '.', errN ? 'err' : 'ok');
      pintarPendientes(r.pendientes);
    }).catch(function (e) { if (barBtn) barBtn.disabled = false; manejar(e); });
  }
```

Nota: se reutiliza `onPlanillaElegida_` y la misma variable de estado `_planilla` (Task 5); el preview usa el id `planillaPreview` como en el modal individual.

- [ ] **Step 3: Verificar sintaxis del front**

```bash
node -e "var fs=require('fs');var h=fs.readFileSync('index.html','utf8');var m=h.match(/<script>[\s\S]*?<\/script>/g);var s=m[m.length-1].replace(/<\/?script>/g,'');fs.writeFileSync('/tmp/front.check.js',s);" && node --check /tmp/front.check.js && echo OK
```
Expected: `OK`.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat(entregas): lote por planilla con foto compartida (mini-modal)"
```

---

## Task 7: Verificación integrada (Chrome headless + payload)

**Files:**
- Create: `scratchpad/measure-entrega.js` (harness puppeteer-core, temporal, no se commitea)
- Create: `scratchpad/_preview_mock.html` (index.html con stub de `google.script.run`)

**Interfaces:**
- Consumes: todo lo anterior. Verifica el payload que el front manda a `apiCall`.

- [ ] **Step 1: Armar el mock del front**

Copiar `index.html` a `scratchpad/_preview_mock.html` y, antes de `</body>`, inyectar un stub que reemplace `google.script.run` capturando el último `apiCall(metodo, payloadJson)` en `window.__ultimoPayload`, devolviendo datos falsos: para `loginPin` un token; para `entregasPendientes` una persona con 1 prenda pendiente; para `confirmarEntregas`/`confirmarEntregasVarias` un `{ok:true, data:{pendientes:{hayCompra:true,personas:[]},entrega:{prendas:['PANTALON'],fecha:'07/07/2026'}}}`. Auto-login sembrando `S.token` vía `sessionStorage` o llamando el flujo de login con el PIN mockeado. (Mismo patrón documentado que funcionó en la tanda @18.)

- [ ] **Step 2: Escribir el harness `measure-entrega.js`**

Con `puppeteer-core` apuntando a `C:/Program Files/Google/Chrome/Application/chrome.exe`, servir el mock (`node scratchpad/static-server.js` en un puerto libre, ej. 4600) y:
1. Navegar, entrar a la pestaña **Entregar**, tocar **Confirmar** en la tarjeta.
2. **Aserción A (firma):** con el método Firma activo, dibujar en el canvas (mouse down/move/up), tocar "Confirmar entrega", leer `window.__ultimoPayload` → `metodo==='confirmarEntregas'` y `JSON.parse(payload).datos.validacion.tipo==='FIRMA'` con `firmaBase64` no vacío.
3. **Aserción B (planilla obligatoria):** reabrir, tocar "📄 Por planilla", tocar "Confirmar entrega" SIN archivo → no debe enviar (payload sin cambios) y aparece toast de error.
4. **Aserción C (planilla con archivo):** setear un archivo en `#planillaFile` vía `elementHandle.uploadFile` (un PNG chico del scratchpad), esperar el preview `✔️`, confirmar → `datos.validacion.tipo==='PAPEL'` con `planillaBase64` no vacío.
5. **Aserción D (lote con foto):** volver, tildar la persona, tocar "Confirmar por planilla (varios)", subir archivo, confirmar → `metodo==='confirmarEntregasVarias'` y `payload.planillaBase64` no vacío.
Imprimir `OK` si las 4 pasan; salir con código ≠0 si alguna falla.

- [ ] **Step 3: Correr el harness**

```bash
node scratchpad/measure-entrega.js
```
Expected: `A OK`, `B OK`, `C OK`, `D OK`, `TODO OK`.

- [ ] **Step 4: Gate de sintaxis final (front + gs)**

```bash
node -e "var fs=require('fs');var h=fs.readFileSync('index.html','utf8');var m=h.match(/<script>[\s\S]*?<\/script>/g);var s=m[m.length-1].replace(/<\/?script>/g,'');fs.writeFileSync('/tmp/front.check.js',s);" && node --check /tmp/front.check.js && \
cp Entregas.gs /tmp/Entregas.check.js && node --check /tmp/Entregas.check.js && \
cp Api.gs /tmp/Api.check.js && node --check /tmp/Api.check.js && echo "TODO OK"
```
Expected: `TODO OK`.

- [ ] **Step 5: Deploy (con OK explícito del usuario)**

```bash
clasp push --force
clasp redeploy AKfycbwWPz0KiSGEmgJDGYgaBsWGJaYuIQl0dG2OfpC9yCiF6qB3xpzaUtRboDB0d7hOi3nZJw -d "entregas: selector firma/planilla + subida de planilla y lote con foto compartida"
```

---

## Self-Review

**Spec coverage:**
- Selector 2 métodos en modal individual → Task 5. ✓
- Panel firma = canvas; panel planilla = archivo obligatorio + observación → Task 5 + Task 2 (backend exige archivo). ✓
- Compresión de imagen / tope PDF / tipos JPG-PNG-PDF → Task 4. ✓
- Backend exige FIRMA o PAPEL, saca AUSENTE → Task 2. ✓
- `subirPlanilla_` a Drive, reutiliza FIRMA_URL / VALIDACION=PAPEL, sin columnas nuevas → Task 1 (+ Task 2/3 lo usan). ✓
- Botón lote renombrado + foto compartida opcional que abarca a todos → Task 3 (backend) + Task 6 (front). ✓
- Verificación node --check + puppeteer → Task 7. ✓

**Placeholder scan:** sin TBD/TODO; todo el código de front y backend está completo. Task 7 describe el harness en prosa (patrón ya usado y documentado en la tanda @18) porque el mock depende de datos falsos ad-hoc; es verificación, no código de producción.

**Type consistency:** `subirPlanilla_(dataUrl, legajo)` usado igual en Task 2 y 3. `_planilla={dataUrl,nombre}` y `onPlanillaElegida_` compartidos entre Task 5 y 6. `validacion.planillaBase64` producido en Task 5/6 y consumido en Task 2/3. `metodoEntregaActivo_`/`seleccionarMetodoEntrega_` definidos y usados en Task 5. Consistente.
