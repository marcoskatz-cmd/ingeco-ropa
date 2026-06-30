/**
 * Util.gs — Helpers de uso general: fechas, lectura/escritura de hojas,
 * normalización de texto. Sin estado propio.
 */

var MS_DIA = 24 * 60 * 60 * 1000;
var DIAS_MES = 30.44; // promedio usado para meses de uso

/** Hoy a medianoche (zona horaria del proyecto). */
function hoy_() {
  var n = new Date();
  return new Date(n.getFullYear(), n.getMonth(), n.getDate());
}

/** Coacciona un valor de celda a Date, o null. */
function aFecha_(v) {
  if (v instanceof Date && !isNaN(v.getTime())) {
    return new Date(v.getFullYear(), v.getMonth(), v.getDate());
  }
  if (typeof v === 'number') {
    // Serial de Sheets (días desde 1899-12-30).
    var base = new Date(1899, 11, 30);
    return new Date(base.getTime() + v * MS_DIA);
  }
  if (typeof v === 'string' && v.trim()) {
    var s = v.trim();
    // dd/mm/yyyy
    var m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (m) {
      var yy = Number(m[3]); if (yy < 100) yy += 2000;
      return new Date(yy, Number(m[2]) - 1, Number(m[1]));
    }
    var d = new Date(s);
    if (!isNaN(d.getTime())) return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }
  return null;
}

/** Meses de uso entre dos fechas (días / 30.44). */
function mesesEntre_(desde, hasta) {
  if (!desde || !hasta) return null;
  return (hasta.getTime() - desde.getTime()) / MS_DIA / DIAS_MES;
}

/** Suma n meses calendario a una fecha. */
function sumarMeses_(fecha, n) {
  return new Date(fecha.getFullYear(), fecha.getMonth() + n, fecha.getDate());
}

/** Diferencia entera de meses calendario (b - a). */
function difMesesCalendario_(a, b) {
  return (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
}

/** Formatea Date a dd/mm/yyyy en la zona del proyecto. */
function fmtFecha_(fecha) {
  if (!fecha) return '';
  var tz = Session.getScriptTimeZone() || 'America/Argentina/Tucuman';
  return Utilities.formatDate(fecha, tz, 'dd/MM/yyyy');
}

/* ------------------------- Lectura de hojas ------------------------- */

/**
 * Lee una hoja como lista de objetos { header: valor }.
 * Devuelve { headers: [...], filas: [{...}], indiceFila: [n] } donde
 * indiceFila[i] es el número de fila real (1-based) de filas[i].
 */
function leerObjetos_(nombreHoja) {
  var sh = requireSheet_(nombreHoja);
  var data = sh.getDataRange().getValues();
  var headers = (data[0] || []).map(function (h) { return String(h || '').trim(); });
  var filas = [];
  var indiceFila = [];
  for (var r = 1; r < data.length; r++) {
    var fila = data[r];
    if (fila.every(function (c) { return c === '' || c === null; })) continue;
    var obj = {};
    for (var c = 0; c < headers.length; c++) {
      if (headers[c]) obj[headers[c]] = fila[c];
    }
    filas.push(obj);
    indiceFila.push(r + 1);
  }
  return { headers: headers, filas: filas, indiceFila: indiceFila, hoja: sh };
}

/** Índice de columna (1-based) por encabezado, o 0 si no está. */
function colPorHeader_(headers, nombre) {
  for (var i = 0; i < headers.length; i++) {
    if (String(headers[i]).trim().toUpperCase() === String(nombre).trim().toUpperCase()) return i + 1;
  }
  return 0;
}

/** Agrega una fila al final respetando el orden de encabezados. */
function appendFilaPorHeader_(nombreHoja, obj) {
  var sh = requireSheet_(nombreHoja);
  var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0]
    .map(function (h) { return String(h || '').trim(); });
  var fila = headers.map(function (h) { return (h in obj) ? obj[h] : ''; });
  sh.appendRow(fila);
  return sh.getLastRow();
}

/* ------------------------- Texto ------------------------- */

/** Normaliza para comparar: sin acentos, mayúsculas, espacios colapsados. */
function normalizar_(s) {
  if (s === null || s === undefined) return '';
  var t = String(s).trim().toUpperCase().replace(/\s+/g, ' ');
  t = t.replace(/[ÁÀÂÄÃ]/g, 'A').replace(/[ÉÈÊË]/g, 'E').replace(/[ÍÌÎÏ]/g, 'I')
       .replace(/[ÓÒÔÖÕ]/g, 'O').replace(/[ÚÙÛÜ]/g, 'U').replace(/Ñ/g, 'N');
  return t;
}

/** Legajo normalizado para usar como clave de cruce (sin espacios, mayús). */
function claveLegajo_(v) {
  return String(v === null || v === undefined ? '' : v).trim().toUpperCase().replace(/\s+/g, '');
}

/** SÍ/NO -> booleano. */
function esSi_(v) {
  var t = normalizar_(v);
  return t === 'SI' || t === 'SÍ' || t === 'TRUE' || t === 'VERDADERO' || t === 'X' || t === '1';
}
