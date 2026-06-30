/**
 * Personal.gs — PERSONAL es la fuente de verdad del padrón. Una fila por
 * operario. La baja es ACTIVO=NO (nunca se borra la fila, el talle y el
 * historial quedan atados al legajo para siempre).
 *
 * Los talles solo se cargan/editan a mano (acá, vía la app, o en la hoja).
 * Ninguna función automática los toca: el cruce con RRHH no escribe estas
 * columnas.
 */

/** Lee PERSONAL como lista de objetos + índice por legajo. */
function leerPersonal_() {
  var data = leerObjetos_(SHEETS.PERSONAL);
  var porLegajo = {};
  for (var i = 0; i < data.filas.length; i++) {
    porLegajo[claveLegajo_(data.filas[i][P.LEGAJO])] = {
      obj: data.filas[i], fila: data.indiceFila[i]
    };
  }
  data.porLegajo = porLegajo;
  return data;
}

/** Operarios, opcionalmente solo activos. Devuelve objetos planos. */
function listarPersonal_(soloActivos) {
  var data = leerPersonal_();
  return data.filas.filter(function (f) {
    return soloActivos ? esSi_(f[P.ACTIVO]) : true;
  });
}

function buscarOperario_(legajo) {
  var data = leerPersonal_();
  var hit = data.porLegajo[claveLegajo_(legajo)];
  return hit ? hit.obj : null;
}

/** Datos que necesita el formulario de entrega (autocompletar). */
function datosOperarioParaEntrega_(legajo) {
  var op = buscarOperario_(legajo);
  if (!op) throw new Error('No existe el legajo ' + legajo + ' en PERSONAL.');
  return {
    legajo: op[P.LEGAJO],
    nombre: op[P.NOMBRE],
    activo: esSi_(op[P.ACTIVO]),
    talles: {
      PANTALON: op[P.TALLE_PANT], CAMISA: op[P.TALLE_CAM], BOTIN: op[P.TALLE_BOTIN]
    },
    grupos: { color: op[P.COLOR], tipoBotin: op[P.TIPO_BOTIN] }
  };
}

/** Alta de operario. El talle puede venir vacío (queda SIN DATO). */
function crearOperario_(datos) {
  var legajo = String(datos.legajo || '').trim();
  if (!legajo) throw new Error('El legajo es obligatorio.');
  if (buscarOperario_(legajo)) throw new Error('Ya existe el legajo ' + legajo + '.');
  appendFilaPorHeader_(SHEETS.PERSONAL, {
    'LEGAJO': legajo,
    'APELLIDO Y NOMBRE': datos.nombre || '',
    'CATEGORÍA': datos.categoria || '',
    'CENTRO DE COSTO': datos.centro || '',
    'COLOR ROPA': datos.color || '',
    'TIPO BOTÍN': datos.tipoBotin || '',
    'TALLE PANT': datos.tallePant || '',
    'TALLE CAM': datos.talleCam || '',
    'TALLE BOTÍN': datos.talleBotin || '',
    'ACTIVO': datos.activo === false ? 'NO' : 'SÍ',
    'OBSERVACIONES': datos.observaciones || ''
  });
  return { ok: true, legajo: legajo };
}

/**
 * Actualiza campos de un operario (edición manual por la app). Solo escribe
 * los campos presentes en `datos`; el resto queda intacto.
 */
function actualizarOperario_(legajo, datos) {
  var data = leerPersonal_();
  var hit = data.porLegajo[claveLegajo_(legajo)];
  if (!hit) throw new Error('No existe el legajo ' + legajo + '.');
  var mapa = {
    nombre: P.NOMBRE, categoria: P.CATEGORIA, centro: P.CENTRO, color: P.COLOR,
    tipoBotin: P.TIPO_BOTIN, tallePant: P.TALLE_PANT, talleCam: P.TALLE_CAM,
    talleBotin: P.TALLE_BOTIN, observaciones: P.OBS
  };
  Object.keys(mapa).forEach(function (k) {
    if (k in datos) {
      var col = colPorHeader_(data.headers, mapa[k]);
      if (col) data.hoja.getRange(hit.fila, col).setValue(datos[k]);
    }
  });
  return { ok: true };
}

/** Da de baja (ACTIVO=NO) o de alta (ACTIVO=SÍ) sin tocar el resto. */
function setActivoOperario_(legajo, activo) {
  var data = leerPersonal_();
  var hit = data.porLegajo[claveLegajo_(legajo)];
  if (!hit) throw new Error('No existe el legajo ' + legajo + '.');
  var col = colPorHeader_(data.headers, P.ACTIVO);
  data.hoja.getRange(hit.fila, col).setValue(activo ? 'SÍ' : 'NO');
  return { ok: true, legajo: legajo, activo: !!activo };
}
