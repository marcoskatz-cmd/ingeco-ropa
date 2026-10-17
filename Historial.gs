/**
 * Historial.gs — "Congelar compra" toma la corrida actual (con las exclusiones
 * que el usuario marcó), arma el pedido y lo guarda como un registro inmutable
 * en HISTORIAL_COMPRAS: la foto de qué se compró en esta corrida.
 *
 * Congelar NO toca ENTREGAS ni PERSONAL. Es solo dejar constancia. La entrega
 * efectiva (que reinicia el reloj) se registra aparte, cuando la ropa llega.
 */

/** Congela la compra de lo SELECCIONADO (corrida actual o previsión). */
function congelarCompra_(usuario, seleccion, horizonte) {
  var pedido = armarPedido_(seleccion, horizonte);
  if (!pedido.totales.unidades) {
    throw new Error('No hay unidades para congelar. Elegí al menos una prenda.');
  }
  var id = nuevoIdCorrida_();

  var fila = {
    'ID_CORRIDA': id,
    'FECHA_CORRIDA': pedido.fechaCorrida || '',
    'FECHA_CONGELADO': fmtFecha_(hoy_()),
    'USUARIO': usuario || '',
    'TOTAL_PANTALON': pedido.totales.PANTALON || 0,
    'TOTAL_CAMISA': pedido.totales.CAMISA || 0,
    'TOTAL_BOTIN': pedido.totales.BOTIN || 0,
    'TOTAL_UNIDADES': pedido.totales.unidades || 0,
    'PROVEEDOR_GANADOR': '',
    'COSTO_GANADOR': '',
    'DETALLE_JSON': JSON.stringify(resumenParaHistorial_(pedido))
  };
  appendFilaPorHeader_(SHEETS.HISTORIAL, fila);
  try { notificarAppIngeco_('ROPA', { destinatarios: [{ con_modulo: 'ROPA' }], tipo: 'aviso_general', prioridad: 'normal', titulo: 'Compra de ropa congelada: ' + fila.TOTAL_UNIDADES + ' unidades', cuerpo: fila.TOTAL_PANTALON + ' pantalones · ' + fila.TOTAL_CAMISA + ' camisas · ' + fila.TOTAL_BOTIN + ' botines' + (fila.PROVEEDOR_GANADOR ? ' · ' + fila.PROVEEDOR_GANADOR : '') + (usuario ? ' · por ' + usuario : ''), clave_unica: 'ropa-' + id }); } catch (eAv) { }

  return {
    ok: true,
    id: id,
    fechaCorrida: fila.FECHA_CORRIDA,
    totales: pedido.totales
  };
}

/** ID único y legible de corrida: CORR-yyyyMMdd-HHmmss. */
function nuevoIdCorrida_() {
  var tz = Session.getScriptTimeZone() || 'America/Argentina/Tucuman';
  return 'CORR-' + Utilities.formatDate(new Date(), tz, 'yyyyMMdd-HHmmss');
}

/** Reduce el pedido a lo esencial para guardar como JSON (no toda la corrida). */
function resumenParaHistorial_(pedido) {
  return {
    fechaCorrida: pedido.fechaCorrida,
    totales: pedido.totales,
    matrices: pedido.matrices,
    incluidas: (pedido.incluidas || []).map(filaResumenHistorial_),
    excluidas: (pedido.excluidas || []).map(filaResumenHistorial_),
    sinTalle: (pedido.sinTalle || []).map(filaResumenHistorial_)
  };
}

function filaResumenHistorial_(f) {
  return {
    legajo: f.legajo, nombre: f.nombre, prenda: f.prenda,
    talle: f.talle, grupo: f.grupo, estado: f.estado
  };
}

/** Lista el historial de compras congeladas, más nuevo primero. */
function listarHistorial_() {
  var data = leerObjetos_(SHEETS.HISTORIAL);
  var filas = data.filas.map(function (f) {
    return {
      id: f.ID_CORRIDA,
      fechaCorrida: f.FECHA_CORRIDA,
      fechaCongelado: f.FECHA_CONGELADO,
      usuario: f.USUARIO,
      totalPantalon: Number(f.TOTAL_PANTALON) || 0,
      totalCamisa: Number(f.TOTAL_CAMISA) || 0,
      totalBotin: Number(f.TOTAL_BOTIN) || 0,
      totalUnidades: Number(f.TOTAL_UNIDADES) || 0,
      proveedorGanador: f.PROVEEDOR_GANADOR,
      costoGanador: f.COSTO_GANADOR === '' || f.COSTO_GANADOR === null ? null : Number(f.COSTO_GANADOR)
    };
  });
  filas.reverse(); // append-only: el último escrito es el más nuevo
  return filas;
}

/**
 * Edita los ítems (personas/prendas) de una compra congelada del historial.
 * Reescribe esa foto: recalcula matrices, totales y valorización desde las
 * incluidas nuevas y actualiza la fila del HISTORIAL. Conserva excluidas /
 * sinTalle como estaban (informativo). NO toca ENTREGAS ni PERSONAL.
 *
 * Si se edita la ÚLTIMA compra congelada, la lista de "Entregar" (que se deriva
 * de esa foto) queda automáticamente actualizada.
 *
 * items = [{ legajo, prenda, talle?, grupo?, nombre?, estado? }, ...]
 */
function editarCompraCongelada_(idCorrida, items, usuario) {
  var data = leerObjetos_(SHEETS.HISTORIAL);
  var idx = -1;
  for (var i = 0; i < data.filas.length; i++) {
    if (String(data.filas[i].ID_CORRIDA) === String(idCorrida)) { idx = i; break; }
  }
  if (idx < 0) throw new Error('No existe la corrida ' + idCorrida + ' en el historial.');
  var filaHoja = data.indiceFila[idx];

  var detalle = {};
  try { detalle = JSON.parse(data.filas[idx].DETALLE_JSON || '{}'); } catch (e) { detalle = {}; }

  // Normaliza/enriquece cada ítem: nombre, talle y grupo desde PERSONAL si faltan.
  var personal = leerPersonal_();
  var incluidas = (items || []).map(function (it) {
    var prenda = String(it.prenda || '').toUpperCase();
    if (PRENDAS.indexOf(prenda) < 0) throw new Error('Prenda inválida: ' + it.prenda);
    var hit = personal.porLegajo[claveLegajo_(it.legajo)];
    var op = hit ? hit.obj : null;
    var talle = (it.talle !== undefined && String(it.talle).trim() !== '')
      ? String(it.talle).trim()
      : (op ? String(op[talleHeaderDePrenda_(prenda)] || '') : '');
    var grupo = (it.grupo !== undefined && String(it.grupo).trim() !== '')
      ? String(it.grupo).trim()
      : (op ? String((prenda === 'BOTIN' ? op[P.TIPO_BOTIN] : op[P.COLOR]) || '') : '');
    return {
      legajo: it.legajo, nombre: it.nombre || (op ? op[P.NOMBRE] : ''),
      prenda: prenda, talle: talle, grupo: grupo, estado: it.estado || ''
    };
  });

  // Recalcula matrices, totales y valorización desde las incluidas (solo con talle).
  var matrices = {}, totales = { unidades: 0 };
  PRENDAS.forEach(function (pr) {
    var rows = incluidas.filter(function (f) { return f.prenda === pr && String(f.talle || '').trim() !== ''; });
    var m = matrizPrenda_(rows);
    matrices[pr] = m;
    totales[pr] = m.total;
    totales.unidades += m.total;
  });
  detalle.totales = totales;
  detalle.matrices = matrices;
  detalle.incluidas = incluidas.map(filaResumenHistorial_);
  detalle.editado = fmtFecha_(hoy_());
  detalle.editadoPor = usuario || '';

  function setCol(header, val) {
    var c = colPorHeader_(data.headers, header);
    if (c) data.hoja.getRange(filaHoja, c).setValue(val);
  }
  setCol('TOTAL_PANTALON', totales.PANTALON || 0);
  setCol('TOTAL_CAMISA', totales.CAMISA || 0);
  setCol('TOTAL_BOTIN', totales.BOTIN || 0);
  setCol('TOTAL_UNIDADES', totales.unidades || 0);
  setCol('PROVEEDOR_GANADOR', '');
  setCol('COSTO_GANADOR', '');
  setCol('DETALLE_JSON', JSON.stringify(detalle));

  return { ok: true, id: idCorrida, totales: totales };
}

/** Detalle completo (DETALLE_JSON parseado) de una corrida del historial. */
function detalleHistorial_(idCorrida) {
  var data = leerObjetos_(SHEETS.HISTORIAL);
  var hit = null;
  data.filas.forEach(function (f) {
    if (String(f.ID_CORRIDA) === String(idCorrida)) hit = f;
  });
  if (!hit) throw new Error('No existe la corrida ' + idCorrida + ' en el historial.');
  var detalle = {};
  try { detalle = JSON.parse(hit.DETALLE_JSON || '{}'); } catch (e) { detalle = {}; }
  return {
    id: hit.ID_CORRIDA,
    fechaCorrida: hit.FECHA_CORRIDA,
    fechaCongelado: hit.FECHA_CONGELADO,
    usuario: hit.USUARIO,
    detalle: detalle
  };
}
