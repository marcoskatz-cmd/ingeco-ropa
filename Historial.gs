/**
 * Historial.gs — "Congelar compra" toma la corrida actual (con las exclusiones
 * que el usuario marcó), arma el pedido y lo guarda como un registro inmutable
 * en HISTORIAL_COMPRAS: la foto de qué se compró en esta corrida.
 *
 * Congelar NO toca ENTREGAS ni PERSONAL. Es solo dejar constancia. La entrega
 * efectiva (que reinicia el reloj) se registra aparte, cuando la ropa llega.
 */

/** Congela la compra de la corrida actual. Devuelve el registro guardado. */
function congelarCompra_(usuario, exclusiones) {
  var pedido = armarPedido_(exclusiones);
  if (!pedido.totales.unidades) {
    throw new Error('No hay unidades para congelar en esta corrida.');
  }
  var id = nuevoIdCorrida_();
  var ganador = (pedido.proveedores && pedido.proveedores.ganador) || null;

  var fila = {
    'ID_CORRIDA': id,
    'FECHA_CORRIDA': pedido.fechaCorrida || '',
    'FECHA_CONGELADO': fmtFecha_(hoy_()),
    'USUARIO': usuario || '',
    'TOTAL_PANTALON': pedido.totales.PANTALON || 0,
    'TOTAL_CAMISA': pedido.totales.CAMISA || 0,
    'TOTAL_BOTIN': pedido.totales.BOTIN || 0,
    'TOTAL_UNIDADES': pedido.totales.unidades || 0,
    'PROVEEDOR_GANADOR': ganador ? ganador.nombre : '',
    'COSTO_GANADOR': ganador ? ganador.total : '',
    'DETALLE_JSON': JSON.stringify(resumenParaHistorial_(pedido))
  };
  appendFilaPorHeader_(SHEETS.HISTORIAL, fila);

  return {
    ok: true,
    id: id,
    fechaCorrida: fila.FECHA_CORRIDA,
    totales: pedido.totales,
    proveedorGanador: fila.PROVEEDOR_GANADOR,
    costoGanador: fila.COSTO_GANADOR
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
    proveedores: pedido.proveedores,
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
