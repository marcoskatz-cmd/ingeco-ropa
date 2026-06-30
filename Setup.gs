/**
 * Setup.gs — Provisiona la base de datos: crea la planilla (si no existe),
 * arma todas las hojas con encabezados, formato (azul cobalto #223D85),
 * validaciones de listas cerradas y semillas mínimas. Idempotente.
 *
 * Ejecutar inicializarSistema() una vez tras subir el código.
 */

var COBALTO = '#223D85';
var BLANCO = '#FFFFFF';
var ROJO = '#F4C7C3';      // crítico / innegociable
var AMARILLO = '#FCE8B2';  // elegible
var GRIS = '#D9D9D9';      // sin dato

function inicializarSistema() {
  var ss = crearOAbrirDB_();

  ensureHoja_(ss, SHEETS.CONFIG, COLS.CONFIG);
  ensureHoja_(ss, SHEETS.LISTAS, COLS.LISTAS);
  ensureHoja_(ss, SHEETS.USUARIOS, COLS.USUARIOS);
  ensureHoja_(ss, SHEETS.PERSONAL, COLS.PERSONAL);
  ensureHoja_(ss, SHEETS.ENTREGAS, COLS.ENTREGAS);
  ensureHoja_(ss, SHEETS.PROVEEDORES, COLS.PROVEEDORES);
  ensureHoja_(ss, SHEETS.HISTORIAL, COLS.HISTORIAL);

  limpiarHojasExtra_(ss);

  sembrarConfig_(ss);
  sembrarListas_(ss);
  sembrarProveedores_(ss);
  sembrarUsuarioAdmin_(ss);

  aplicarValidaciones_(ss);
  aplicarFormatosFecha_(ss);

  invalidarCache_();
  Logger.log('Sistema inicializado. Planilla: ' + ss.getUrl());
  return ss.getUrl();
}

/** Devuelve la planilla DB; la crea y guarda su ID si no existe. */
function crearOAbrirDB_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty(PROP_SHEET_ID);
  if (id) {
    try { return SpreadsheetApp.openById(id); } catch (e) { /* recrear abajo */ }
  }
  var ss = SpreadsheetApp.create('INGECO Ropa — Base de Datos');
  props.setProperty(PROP_SHEET_ID, ss.getId());
  _memo = {};
  return ss;
}

/** Crea la hoja si falta y (re)escribe encabezados con formato cobalto. */
function ensureHoja_(ss, nombre, headers) {
  var sh = ss.getSheetByName(nombre);
  if (!sh) sh = ss.insertSheet(nombre);
  sh.getRange(1, 1, 1, headers.length).setValues([headers]);
  formatearHeader_(sh, headers.length);
  sh.setFrozenRows(1);
  return sh;
}

function formatearHeader_(sh, nCols) {
  var rng = sh.getRange(1, 1, 1, nCols);
  rng.setBackground(COBALTO).setFontColor(BLANCO).setFontFamily('Arial')
     .setFontWeight('bold').setVerticalAlignment('middle');
  sh.getRange(1, 1, sh.getMaxRows(), nCols).setFontFamily('Arial');
}

/** Borra hojas que no son parte del modelo (ej. la "Hoja 1" por defecto). */
function limpiarHojasExtra_(ss) {
  var validas = {};
  Object.keys(SHEETS).forEach(function (k) { validas[SHEETS[k]] = true; });
  ss.getSheets().forEach(function (sh) {
    if (!validas[sh.getName()] && ss.getSheets().length > 1) {
      ss.deleteSheet(sh);
    }
  });
}

/* ----------------------------- Semillas ----------------------------- */

function sembrarConfig_(ss) {
  var sh = ss.getSheetByName(SHEETS.CONFIG);
  if (sh.getLastRow() > 1) return; // ya sembrado
  var hoy = hoy_();
  var filas = [
    [PARAM.VIDA_UTIL, DEFAULTS.vida_util_meses,
      'Vida útil de cada prenda en meses. Es el objetivo de recambio.'],
    [PARAM.CADENCIA, DEFAULTS.cadencia_meses,
      'Cada cuántos meses hay una corrida de compra. Divide a la vida útil.'],
    [PARAM.TECHO, '=B2+B3',
      'Techo duro = vida útil + cadencia. NO EDITAR: se recalcula solo. Ninguna prenda debe superarlo.'],
    [PARAM.FECHA_ANCLA, hoy,
      'Fecha de una corrida conocida. Define la grilla (ancla, ancla+cadencia, ...). AJUSTAR a una corrida real.'],
    [PARAM.DIAS_PREVISION, DEFAULTS.dias_prevision,
      'Horizonte de la previsión anticipada, en días.']
  ];
  sh.getRange(2, 1, filas.length, 3).setValues(filas);
  sh.setColumnWidth(3, 480);
  sh.getRange(2, 3, filas.length, 1).setWrap(true).setFontColor('#666666');
}

function sembrarListas_(ss) {
  var sh = ss.getSheetByName(SHEETS.LISTAS);
  if (sh.getLastRow() > 1) return;
  // Valores por defecto editables. Reemplazar por los reales de INGECO.
  var cols = {
    'COLOR ROPA': ['AZUL', 'NARANJA', 'GRIS', 'VERDE'],
    'TIPO BOTIN': ['PUNTERA ACERO', 'PUNTERA COMPOSITE', 'DIELECTRICO'],
    'CATEGORIA': ['OFICIAL', 'MEDIO OFICIAL', 'AYUDANTE', 'MAQUINISTA', 'CHOFER'],
    'CENTRO DE COSTO': ['OBRA 1', 'OBRA 2', 'TALLER', 'ADMINISTRACION'],
    'TALLE PANT': ['38', '40', '42', '44', '46', '48', '50', '52', '54'],
    'TALLE CAM': ['S', 'M', 'L', 'XL', 'XXL', 'XXXL'],
    'TALLE BOTIN': ['38', '39', '40', '41', '42', '43', '44', '45', '46']
  };
  COLS.LISTAS.forEach(function (header, idx) {
    var valores = cols[header] || [];
    if (valores.length) {
      sh.getRange(2, idx + 1, valores.length, 1)
        .setValues(valores.map(function (v) { return [v]; }));
    }
  });
}

function sembrarProveedores_(ss) {
  var sh = ss.getSheetByName(SHEETS.PROVEEDORES);
  if (sh.getLastRow() > 1) return;
  sh.getRange(2, 1, PRENDAS.length, 1)
    .setValues(PRENDAS.map(function (p) { return [p]; }));
}

function sembrarUsuarioAdmin_(ss) {
  var sh = ss.getSheetByName(SHEETS.USUARIOS);
  if (sh.getLastRow() > 1) return;
  sh.getRange(2, 1, 1, 3).setValues([['Administrador', hashPin_('1234'), 'SÍ']]);
}

/* --------------------------- Validaciones --------------------------- */

function aplicarValidaciones_(ss) {
  var N = 2000;
  // PERSONAL: cada categórico apunta a su columna en LISTAS.
  valRango_(ss, SHEETS.PERSONAL, 3, N, 'LISTAS!C2:C200');   // CATEGORÍA
  valRango_(ss, SHEETS.PERSONAL, 4, N, 'LISTAS!D2:D200');   // CENTRO DE COSTO
  valRango_(ss, SHEETS.PERSONAL, 5, N, 'LISTAS!A2:A200');   // COLOR ROPA
  valRango_(ss, SHEETS.PERSONAL, 6, N, 'LISTAS!B2:B200');   // TIPO BOTÍN
  valRango_(ss, SHEETS.PERSONAL, 7, N, 'LISTAS!E2:E200');   // TALLE PANT
  valRango_(ss, SHEETS.PERSONAL, 8, N, 'LISTAS!F2:F200');   // TALLE CAM
  valRango_(ss, SHEETS.PERSONAL, 9, N, 'LISTAS!G2:G200');   // TALLE BOTÍN
  valLista_(ss, SHEETS.PERSONAL, 10, N, ['SÍ', 'NO']);      // ACTIVO

  // ENTREGAS: prenda y motivo cerrados.
  valLista_(ss, SHEETS.ENTREGAS, 4, 5000, PRENDAS);
  valLista_(ss, SHEETS.ENTREGAS, 6, 5000, MOTIVOS);

  // PROVEEDORES: prenda cerrada.
  valLista_(ss, SHEETS.PROVEEDORES, 1, 50, PRENDAS);
}

function valRango_(ss, hoja, col, nFilas, a1Rango) {
  var sh = ss.getSheetByName(hoja);
  var fuente = ss.getRange(a1Rango);
  var regla = SpreadsheetApp.newDataValidation()
    .requireValueInRange(fuente, true).setAllowInvalid(false).build();
  sh.getRange(2, col, nFilas, 1).setDataValidation(regla);
}

function valLista_(ss, hoja, col, nFilas, valores) {
  var sh = ss.getSheetByName(hoja);
  var regla = SpreadsheetApp.newDataValidation()
    .requireValueInList(valores, true).setAllowInvalid(false).build();
  sh.getRange(2, col, nFilas, 1).setDataValidation(regla);
}

function aplicarFormatosFecha_(ss) {
  ss.getSheetByName(SHEETS.ENTREGAS).getRange(2, 1, 5000, 1).setNumberFormat('dd/MM/yyyy');
  // fecha_ancla está en CONFIG fila 5 (orden de semilla), columna VALOR (B).
  ss.getSheetByName(SHEETS.CONFIG).getRange(5, 2).setNumberFormat('dd/MM/yyyy');
}
