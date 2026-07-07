/**
 * MigracionTalles.gs — TEMPORAL. Carga talle pantalón/camisa/botín + COLOR ROPA +
 * TIPO BOTÍN al padrón (PERSONAL) desde la entrega del 25/03/2026 (98 registros,
 * cruce por legajo, sobrescribe). Incluye fixes: 2014->2046 (GRAMAJO), Diaz Lucas
 * -> 3958, "Jean" -> "JEANS".
 *
 * Uso (editor de Apps Script):
 *   1) previewCargaTalles()   → NO cambia nada; log de actual vs nuevo y contadores.
 *   2) aplicarCargaTalles()   → backup + asegura LISTAS + escribe.
 *
 * Se elimina este archivo una vez validado.
 */

var TALLES_ENTREGA = [
  { legajo: "1533", color: "PETROLEO", tipoBotin: "PUNTA DE ACERO", pant: "50", cam: "50", botin: "45" },
  { legajo: "1776", color: "JEANS", tipoBotin: "BOTA PETROLERA", pant: "46", cam: "46", botin: "41" },
  { legajo: "1889", color: "JEANS", tipoBotin: "PUNTA DE ACERO", pant: "46", cam: "46", botin: "42" },
  { legajo: "2014", color: "BEIGE", tipoBotin: "PUNTA DE ACERO", pant: "56", cam: "50", botin: "44" },
  { legajo: "2046", color: "BEIGE", tipoBotin: "PUNTA DE ACERO", pant: "50", cam: "50", botin: "40" },
  { legajo: "2057", color: "NARANJA", tipoBotin: "PUNTA DE ACERO", pant: "42", cam: "42", botin: "43" },
  { legajo: "2120", color: "Cargo Azul", tipoBotin: "FUNCIONAL", pant: "50", cam: "48", botin: "42" },
  { legajo: "2285", color: "NARANJA", tipoBotin: "FUNCIONAL", pant: "42", cam: "42", botin: "40" },
  { legajo: "2395", color: "NARANJA", tipoBotin: "FUNCIONAL", pant: "46", cam: "44", botin: "44" },
  { legajo: "2405", color: "JEANS", tipoBotin: "BOTA PETROLERA", pant: "52", cam: "48", botin: "48" },
  { legajo: "2430", color: "NARANJA", tipoBotin: "PUNTA DE ACERO", pant: "52", cam: "50", botin: "42" },
  { legajo: "2489", color: "JEANS", tipoBotin: "PUNTA DE ACERO", pant: "46", cam: "46", botin: "42" },
  { legajo: "2506", color: "JEANS", tipoBotin: "FUNCIONAL", pant: "46", cam: "46", botin: "41" },
  { legajo: "2514", color: "JEANS", tipoBotin: "PUNTA DE ACERO", pant: "46", cam: "46", botin: "40" },
  { legajo: "2552", color: "NARANJA", tipoBotin: "PUNTA DE ACERO", pant: "44", cam: "44", botin: "44" },
  { legajo: "2557", color: "JEANS", tipoBotin: "BOTA PETROLERA", pant: "52", cam: "50", botin: "44" },
  { legajo: "2561", color: "JEANS", tipoBotin: "BOTA PETROLERA", pant: "48", cam: "50", botin: "42" },
  { legajo: "2642", color: "BEIGE", tipoBotin: "PUNTA DE ACERO", pant: "46", cam: "44", botin: "41" },
  { legajo: "2653", color: "NARANJA", tipoBotin: "PUNTA DE ACERO", pant: "56", cam: "50", botin: "50" },
  { legajo: "2671", color: "PETROLEO", tipoBotin: "PUNTA DE ACERO", pant: "56", cam: "56", botin: "44" },
  { legajo: "2697", color: "JEANS", tipoBotin: "PUNTA DE ACERO", pant: "46", cam: "44", botin: "44" },
  { legajo: "2735", color: "NARANJA", tipoBotin: "FUNCIONAL", pant: "54", cam: "54", botin: "43" },
  { legajo: "2800", color: "PETROLEO", tipoBotin: "PUNTA DE ACERO", pant: "60", cam: "60", botin: "44" },
  { legajo: "2913", color: "BEIGE", tipoBotin: "PUNTA DE ACERO", pant: "50", cam: "48", botin: "43" },
  { legajo: "2921", color: "JEANS", tipoBotin: "PUNTA DE ACERO", pant: "46", cam: "44", botin: "39" },
  { legajo: "2928", color: "NARANJA", tipoBotin: "FUNCIONAL", pant: "48", cam: "48", botin: "41" },
  { legajo: "2947", color: "PETROLEO", tipoBotin: "PUNTA DE ACERO", pant: "46", cam: "46", botin: "41" },
  { legajo: "2963", color: "JEANS", tipoBotin: "BOTA PETROLERA", pant: "50", cam: "46", botin: "42" },
  { legajo: "2996", color: "JEANS", tipoBotin: "PUNTA DE ACERO", pant: "48", cam: "46", botin: "46" },
  { legajo: "3000", color: "NARANJA", tipoBotin: "FUNCIONAL", pant: "46", cam: "46", botin: "40" },
  { legajo: "3006", color: "NARANJA", tipoBotin: "FUNCIONAL", pant: "44", cam: "44", botin: "39" },
  { legajo: "3010", color: "JEANS", tipoBotin: "PUNTA DE ACERO", pant: "48", cam: "44", botin: "40" },
  { legajo: "3033", color: "JEANS", tipoBotin: "PUNTA DE ACERO", pant: "46", cam: "46", botin: "42" },
  { legajo: "3064", color: "NARANJA", tipoBotin: "PUNTA DE ACERO", pant: "50", cam: "46", botin: "41" },
  { legajo: "3128", color: "PETROLEO", tipoBotin: "PUNTA DE ACERO", pant: "54", cam: "50", botin: "44" },
  { legajo: "3142", color: "NARANJA", tipoBotin: "FUNCIONAL", pant: "48", cam: "48", botin: "43" },
  { legajo: "3267", color: "NARANJA", tipoBotin: "PUNTA DE ACERO", pant: "42", cam: "42", botin: "42" },
  { legajo: "3295", color: "PETROLEO", tipoBotin: "PUNTA DE ACERO", pant: "46", cam: "46", botin: "46" },
  { legajo: "3298", color: "PETROLEO", tipoBotin: "PUNTA DE ACERO", pant: "44", cam: "42", botin: "42" },
  { legajo: "3365", color: "PETROLEO", tipoBotin: "PUNTA DE ACERO", pant: "48", cam: "48", botin: "43" },
  { legajo: "3422", color: "JEANS", tipoBotin: "PUNTA DE ACERO", pant: "40", cam: "38", botin: "38" },
  { legajo: "3561", color: "JEANS", tipoBotin: "PUNTA DE ACERO", pant: "56", cam: "54", botin: "43" },
  { legajo: "3578", color: "NARANJA", tipoBotin: "FUNCIONAL", pant: "42", cam: "42", botin: "40" },
  { legajo: "3593", color: "JEANS", tipoBotin: "BOTA PETROLERA", pant: "56", cam: "60", botin: "41" },
  { legajo: "3621", color: "JEANS", tipoBotin: "PUNTA DE ACERO", pant: "48", cam: "46", botin: "42" },
  { legajo: "3632", color: "NARANJA", tipoBotin: "PUNTA DE ACERO", pant: "42", cam: "42", botin: "42" },
  { legajo: "3635", color: "JEANS", tipoBotin: "PUNTA DE ACERO", pant: "42", cam: "40", botin: "39" },
  { legajo: "3680", color: "JEANS", tipoBotin: "PUNTA DE ACERO", pant: "48", cam: "46", botin: "46" },
  { legajo: "3696", color: "JEANS", tipoBotin: "PUNTA DE ACERO", pant: "44", cam: "42", botin: "42" },
  { legajo: "3766", color: "JEANS", tipoBotin: "PUNTA DE ACERO", pant: "46", cam: "46", botin: "40" },
  { legajo: "3791", color: "JEANS", tipoBotin: "PUNTA DE ACERO", pant: "44", cam: "40", botin: "42" },
  { legajo: "3836", color: "NARANJA", tipoBotin: "FUNCIONAL", pant: "42", cam: "40", botin: "39" },
  { legajo: "3837", color: "PETROLEO", tipoBotin: "PUNTA DE ACERO", pant: "44", cam: "44", botin: "44" },
  { legajo: "3846", color: "JEANS", tipoBotin: "PUNTA DE ACERO", pant: "44", cam: "42", botin: "40" },
  { legajo: "3847", color: "NARANJA", tipoBotin: "FUNCIONAL", pant: "48", cam: "46", botin: "42" },
  { legajo: "3848", color: "PETROLEO", tipoBotin: "PUNTA DE ACERO", pant: "46", cam: "42", botin: "42" },
  { legajo: "3852", color: "PETROLEO", tipoBotin: "PUNTA DE ACERO", pant: "50", cam: "54", botin: "54" },
  { legajo: "3854", color: "NARANJA", tipoBotin: "PUNTA DE ACERO", pant: "54", cam: "54", botin: "42" },
  { legajo: "3855", color: "JEANS", tipoBotin: "PUNTA DE ACERO", pant: "52", cam: "52", botin: "41" },
  { legajo: "3884", color: "JEANS", tipoBotin: "PUNTA DE ACERO", pant: "50", cam: "46", botin: "46" },
  { legajo: "3885", color: "JEANS", tipoBotin: "PUNTA DE ACERO", pant: "56", cam: "50", botin: "50" },
  { legajo: "3886", color: "NARANJA", tipoBotin: "PUNTA DE ACERO", pant: "46", cam: "42", botin: "42" },
  { legajo: "3888", color: "PETROLEO", tipoBotin: "PUNTA DE ACERO", pant: "60", cam: "54", botin: "45" },
  { legajo: "3899", color: "NARANJA", tipoBotin: "FUNCIONAL", pant: "44", cam: "42", botin: "41" },
  { legajo: "3908", color: "PETROLEO", tipoBotin: "PUNTA DE ACERO", pant: "44", cam: "42", botin: "42" },
  { legajo: "3909", color: "PETROLEO", tipoBotin: "PUNTA DE ACERO", pant: "50", cam: "50", botin: "50" },
  { legajo: "3910", color: "JEANS", tipoBotin: "PUNTA DE ACERO", pant: "56", cam: "48", botin: "42" },
  { legajo: "3912", color: "NARANJA", tipoBotin: "PUNTA DE ACERO", pant: "50", cam: "50", botin: "50" },
  { legajo: "3913", color: "NARANJA", tipoBotin: "PUNTA DE ACERO", pant: "50", cam: "50", botin: "50" },
  { legajo: "3914", color: "NARANJA", tipoBotin: "PUNTA DE ACERO", pant: "42", cam: "42", botin: "42" },
  { legajo: "3915", color: "JEANS", tipoBotin: "PUNTA DE ACERO", pant: "48", cam: "48", botin: "48" },
  { legajo: "3916", color: "NARANJA", tipoBotin: "PUNTA DE ACERO", pant: "46", cam: "42", botin: "42" },
  { legajo: "3919", color: "NARANJA", tipoBotin: "PUNTA DE ACERO", pant: "46", cam: "38", botin: "38" },
  { legajo: "3922", color: "PETROLEO", tipoBotin: "PUNTA DE ACERO", pant: "58", cam: "58", botin: "58" },
  { legajo: "3927", color: "NARANJA", tipoBotin: "FUNCIONAL", pant: "48", cam: "48", botin: "42" },
  { legajo: "3928", color: "PETROLEO", tipoBotin: "PUNTA DE ACERO", pant: "48", cam: "48", botin: "43" },
  { legajo: "3929", color: "PETROLEO", tipoBotin: "PUNTA DE ACERO", pant: "50", cam: "46", botin: "43" },
  { legajo: "3933", color: "NARANJA", tipoBotin: "PUNTA DE ACERO", pant: "50", cam: "48", botin: "48" },
  { legajo: "3935", color: "PETROLEO", tipoBotin: "PUNTA DE ACERO", pant: "48", cam: "46", botin: "46" },
  { legajo: "3936", color: "PETROLEO", tipoBotin: "PUNTA DE ACERO", pant: "50", cam: "48", botin: "48" },
  { legajo: "3937", color: "NARANJA", tipoBotin: "PUNTA DE ACERO", pant: "50", cam: "50", botin: "50" },
  { legajo: "3938", color: "NARANJA", tipoBotin: "PUNTA DE ACERO", pant: "46", cam: "44", botin: "44" },
  { legajo: "3939", color: "NARANJA", tipoBotin: "FUNCIONAL", pant: "44", cam: "42", botin: "42" },
  { legajo: "3940", color: "PETROLEO", tipoBotin: "FUNCIONAL", pant: "48", cam: "48", botin: "42" },
  { legajo: "3941", color: "NARANJA", tipoBotin: "PUNTA DE ACERO", pant: "48", cam: "48", botin: "43" },
  { legajo: "3943", color: "NARANJA", tipoBotin: "PUNTA DE ACERO", pant: "50", cam: "52", botin: "52" },
  { legajo: "3946", color: "NARANJA", tipoBotin: "FUNCIONAL", pant: "48", cam: "48", botin: "43" },
  { legajo: "3947", color: "NARANJA", tipoBotin: "PUNTA DE ACERO", pant: "46", cam: "44", botin: "44" },
  { legajo: "3948", color: "JEANS", tipoBotin: "PUNTA DE ACERO", pant: "40", cam: "38", botin: "39" },
  { legajo: "3949", color: "JEANS", tipoBotin: "PUNTA DE ACERO", pant: "40", cam: "38", botin: "40" },
  { legajo: "3950", color: "NARANJA", tipoBotin: "PUNTA DE ACERO", pant: "46", cam: "42", botin: "42" },
  { legajo: "3951", color: "NARANJA", tipoBotin: "PUNTA DE ACERO", pant: "42", cam: "42", botin: "42" },
  { legajo: "3952", color: "JEANS", tipoBotin: "PUNTA DE ACERO", pant: "50", cam: "50", botin: "50" },
  { legajo: "3954", color: "NARANJA", tipoBotin: "PUNTA DE ACERO", pant: "50", cam: "46", botin: "46" },
  { legajo: "3955", color: "PETROLEO", tipoBotin: "PUNTA DE ACERO", pant: "42", cam: "42", botin: "41" },
  { legajo: "3956", color: "NARANJA", tipoBotin: "PUNTA DE ACERO", pant: "46", cam: "44", botin: "44" },
  { legajo: "3957", color: "NARANJA", tipoBotin: "PUNTA DE ACERO", pant: "48", cam: "48", botin: "48" },
  { legajo: "3958", color: "JEANS", tipoBotin: "PUNTA DE ACERO", pant: "48", cam: "46", botin: "41" }
];

/** Agrega a LISTAS (col dada) los valores que falten (comparando normalizado). */
function agregarValoresListas_(sh, col, valores) {
  var alto = Math.max(sh.getMaxRows() - 1, 1);
  var colVals = sh.getRange(2, col, alto, 1).getValues();
  var set = {}, ultima = 1;
  for (var i = 0; i < colVals.length; i++) {
    var v = String(colVals[i][0] === null || colVals[i][0] === undefined ? '' : colVals[i][0]).trim();
    if (v) { set[normalizar_(v)] = true; ultima = i + 2; }
  }
  var faltan = [];
  valores.forEach(function (raw) {
    var v = String(raw).trim();
    if (!v) return;
    var k = normalizar_(v);
    if (set[k]) return;
    set[k] = true;
    faltan.push(v);
  });
  if (faltan.length) {
    sh.getRange(ultima + 1, col, faltan.length, 1).setValues(faltan.map(function (v) { return [v]; }));
  }
  return faltan;
}

/** Asegura en LISTAS los colores/tipos de botin/talles de la entrega. */
function asegurarValoresEnListas_() {
  var sh = requireSheet_(SHEETS.LISTAS);
  var colores = [], botines = [], pant = [], cam = [], botinT = [];
  TALLES_ENTREGA.forEach(function (r) {
    colores.push(r.color); botines.push(r.tipoBotin);
    pant.push(String(r.pant)); cam.push(String(r.cam)); botinT.push(String(r.botin));
  });
  var add = {};
  add.color = agregarValoresListas_(sh, 1, colores);   // COLOR ROPA = A
  add.botin = agregarValoresListas_(sh, 2, botines);    // TIPO BOTIN = B
  add.pant = agregarValoresListas_(sh, 5, pant);        // TALLE PANT = E
  add.cam = agregarValoresListas_(sh, 6, cam);          // TALLE CAM = F
  add.botinT = agregarValoresListas_(sh, 7, botinT);    // TALLE BOTIN = G
  return add;
}

/** PASO 1: preview. No cambia nada; loguea actual vs nuevo y contadores. */
function previewCargaTalles() {
  var data = leerPersonal_();
  var actualizar = 0, iguales = 0, noEnc = 0;
  Logger.log('=== PREVIEW CARGA TALLES (no se cambio nada) ===');
  TALLES_ENTREGA.forEach(function (r) {
    var hit = data.porLegajo[claveLegajo_(r.legajo)];
    if (!hit) { noEnc++; Logger.log('NO ENCONTRADO en padron: ' + r.legajo); return; }
    var o = hit.obj;
    var actP = String(o[P.TALLE_PANT] || '').trim(), actC = String(o[P.TALLE_CAM] || '').trim(), actB = String(o[P.TALLE_BOTIN] || '').trim();
    var actCol = String(o[P.COLOR] || '').trim(), actTB = String(o[P.TIPO_BOTIN] || '').trim();
    var difiere = (actP !== String(r.pant)) || (actC !== String(r.cam)) || (actB !== String(r.botin)) ||
      (normalizar_(actCol) !== normalizar_(r.color)) || (normalizar_(actTB) !== normalizar_(r.tipoBotin));
    if (difiere) {
      actualizar++;
      Logger.log('CAMBIA ' + r.legajo + ' ' + (o[P.NOMBRE] || '') +
        ' | talle ' + actP + '/' + actC + '/' + actB + ' -> ' + r.pant + '/' + r.cam + '/' + r.botin +
        ' | color ' + (actCol || '-') + ' -> ' + r.color + ' | botin ' + (actTB || '-') + ' -> ' + r.tipoBotin);
    } else { iguales++; }
  });
  Logger.log('--- Total: ' + TALLES_ENTREGA.length + ' | a actualizar: ' + actualizar + ' | sin cambio: ' + iguales + ' | no encontrados: ' + noEnc);
  return { total: TALLES_ENTREGA.length, actualizar: actualizar, iguales: iguales, noEnc: noEnc };
}

/** PASO 2: aplica. Backup, asegura LISTAS y escribe talles/color/botin (sobrescribe). */
function aplicarCargaTalles() {
  var ss = getSpreadsheet_();
  var hojaPersonal = requireSheet_(SHEETS.PERSONAL);
  var d = new Date();
  var stamp = d.getFullYear() + ('0' + (d.getMonth() + 1)).slice(-2) + ('0' + d.getDate()).slice(-2) + '_' +
    ('0' + d.getHours()).slice(-2) + ('0' + d.getMinutes()).slice(-2) + ('0' + d.getSeconds()).slice(-2);
  var nombreBackup = 'PERSONAL_BACKUP_' + stamp;
  hojaPersonal.copyTo(ss).setName(nombreBackup);
  Logger.log('Backup creado: ' + nombreBackup);

  var add = asegurarValoresEnListas_();
  Logger.log('Agregados a LISTAS -> colores: ' + add.color.length + ', botines: ' + add.botin.length +
    ', tallePant: ' + add.pant.length + ', talleCam: ' + add.cam.length + ', talleBotin: ' + add.botinT.length);

  var data = leerPersonal_();
  var colP = colPorHeader_(data.headers, P.TALLE_PANT);
  var colC = colPorHeader_(data.headers, P.TALLE_CAM);
  var colB = colPorHeader_(data.headers, P.TALLE_BOTIN);
  var colCol = colPorHeader_(data.headers, P.COLOR);
  var colTB = colPorHeader_(data.headers, P.TIPO_BOTIN);

  var actualizados = 0, noEnc = [];
  TALLES_ENTREGA.forEach(function (r) {
    var hit = data.porLegajo[claveLegajo_(r.legajo)];
    if (!hit) { noEnc.push(r.legajo); return; }
    data.hoja.getRange(hit.fila, colP).setValue(r.pant);
    data.hoja.getRange(hit.fila, colC).setValue(r.cam);
    data.hoja.getRange(hit.fila, colB).setValue(r.botin);
    data.hoja.getRange(hit.fila, colCol).setValue(r.color);
    data.hoja.getRange(hit.fila, colTB).setValue(r.tipoBotin);
    actualizados++;
  });

  Logger.log('=== CARGA APLICADA ===');
  Logger.log('Actualizados: ' + actualizados + ' | no encontrados: ' + noEnc.length + (noEnc.length ? ' (' + noEnc.join(', ') + ')' : ''));
  Logger.log('Backup: ' + nombreBackup);
  return { actualizados: actualizados, noEncontrados: noEnc, backup: nombreBackup };
}
