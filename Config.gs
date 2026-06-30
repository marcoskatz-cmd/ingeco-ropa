/**
 * Config.gs — Constantes, parámetros de negocio y acceso a la base de datos.
 *
 * La base de datos es una planilla de Google cuyo ID se guarda en Script
 * Properties (SHEET_ID). La crea Setup.gs en el primer arranque; ninguna
 * función de negocio necesita un ID hardcodeado.
 */

// Nombres de las hojas que son base de datos (persistentes).
var SHEETS = {
  CONFIG: 'CONFIG',
  LISTAS: 'LISTAS',
  USUARIOS: 'USUARIOS',
  PERSONAL: 'PERSONAL',
  ENTREGAS: 'ENTREGAS',
  PROVEEDORES: 'PROVEEDORES',
  HISTORIAL: 'HISTORIAL_COMPRAS'
};

// Las tres prendas. El reloj de cada una corre por separado.
var PRENDAS = ['PANTALON', 'CAMISA', 'BOTIN'];

// Motivos válidos de una entrega.
var MOTIVOS = ['CICLO', 'ROTURA', 'CICLO INICIAL'];

// Claves de parámetros en la hoja CONFIG.
var PARAM = {
  VIDA_UTIL: 'vida_util_meses',
  CADENCIA: 'cadencia_meses',
  TECHO: 'techo_meses',
  FECHA_ANCLA: 'fecha_ancla_corrida',
  DIAS_PREVISION: 'dias_prevision'
};

// Valores por defecto (los que siembra Setup; editables en CONFIG).
var DEFAULTS = {
  vida_util_meses: 6,
  cadencia_meses: 2,
  dias_prevision: 30
};

var PROP_SHEET_ID = 'SHEET_ID';

// Cache de un solo execution para no releer CONFIG en cada llamada.
var _memo = {};

/** Devuelve la planilla base de datos. Lanza si Setup no corrió. */
function getSpreadsheet_() {
  if (_memo.ss) return _memo.ss;
  var id = PropertiesService.getScriptProperties().getProperty(PROP_SHEET_ID);
  if (!id) {
    throw new Error('El sistema no está inicializado. Ejecutá inicializarSistema() una vez.');
  }
  _memo.ss = SpreadsheetApp.openById(id);
  return _memo.ss;
}

/** Hoja por nombre, o null si no existe. */
function getSheet_(nombre) {
  return getSpreadsheet_().getSheetByName(nombre);
}

/** Hoja por nombre; lanza si falta (debería existir tras Setup). */
function requireSheet_(nombre) {
  var sh = getSheet_(nombre);
  if (!sh) throw new Error('Falta la hoja "' + nombre + '". Ejecutá inicializarSistema().');
  return sh;
}

/* ----------------------------- CONFIG ----------------------------- */

/** Lee CONFIG (PARAMETRO, VALOR) a un mapa, cacheado por execution. */
function getConfigMap_() {
  if (_memo.config) return _memo.config;
  var sh = requireSheet_(SHEETS.CONFIG);
  var data = sh.getDataRange().getValues();
  var map = {};
  for (var i = 1; i < data.length; i++) {
    var k = String(data[i][0] || '').trim();
    if (k) map[k] = data[i][1];
  }
  _memo.config = map;
  return map;
}

function getParamNum_(clave, porDefecto) {
  var v = getConfigMap_()[clave];
  var n = Number(v);
  return isFinite(n) && v !== '' && v !== null ? n : porDefecto;
}

function getVidaUtilMeses_() { return getParamNum_(PARAM.VIDA_UTIL, DEFAULTS.vida_util_meses); }
function getCadenciaMeses_() { return getParamNum_(PARAM.CADENCIA, DEFAULTS.cadencia_meses); }

/**
 * Techo duro = vida útil + cadencia. SIEMPRE se calcula, nunca se hardcodea:
 * si cambia la cadencia, el techo se mueve solo.
 */
function getTechoMeses_() { return getVidaUtilMeses_() + getCadenciaMeses_(); }

function getDiasPrevision_() { return getParamNum_(PARAM.DIAS_PREVISION, DEFAULTS.dias_prevision); }

/** Fecha ancla de la grilla de corridas. */
function getFechaAncla_() {
  var v = getConfigMap_()[PARAM.FECHA_ANCLA];
  var d = aFecha_(v);
  if (!d) throw new Error('CONFIG: falta una fecha_ancla_corrida válida.');
  return d;
}

/* ----------------------------- LISTAS ----------------------------- */

/**
 * Devuelve las listas cerradas configurables (columnas de la hoja LISTAS).
 * Encabezados esperados: COLOR ROPA, TIPO BOTIN, CATEGORIA, CENTRO DE COSTO,
 * TALLE PANT, TALLE CAM, TALLE BOTIN.
 */
function getListas_() {
  if (_memo.listas) return _memo.listas;
  var sh = getSheet_(SHEETS.LISTAS);
  var listas = {};
  if (sh) {
    var data = sh.getDataRange().getValues();
    var headers = (data[0] || []).map(function (h) { return String(h || '').trim(); });
    for (var c = 0; c < headers.length; c++) {
      if (!headers[c]) continue;
      var col = [];
      for (var r = 1; r < data.length; r++) {
        var val = String(data[r][c] || '').trim();
        if (val) col.push(val);
      }
      listas[headers[c]] = col;
    }
  }
  _memo.listas = listas;
  return listas;
}

/** Invalida la cache de execution (tras escribir CONFIG/LISTAS). */
function invalidarCache_() { _memo = {}; }
