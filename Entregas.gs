/**
 * Entregas.gs — ENTREGAS es un log append-only. Cada fila = una prenda
 * entregada a un operario. Registrar una entrega reinicia el reloj de esa
 * prenda (sea CICLO o ROTURA: la rotura es un reinicio completo).
 *
 * NINGUNA función edita ni borra filas de ENTREGAS.
 */

/** Todas las entregas como objetos, con FECHA ya como Date. */
function leerEntregas_() {
  var data = leerObjetos_(SHEETS.ENTREGAS);
  data.filas.forEach(function (f) { f._fecha = aFecha_(f[E.FECHA]); });
  return data;
}

/**
 * Mapa { claveLegajo: { PANTALON: Date|null, CAMISA: ..., BOTIN: ... } } con la
 * ÚLTIMA entrega de cada prenda. Ese es el reloj de cada prenda.
 */
function ultimaEntregaPorPrenda_() {
  var data = leerEntregas_();
  var mapa = {};
  data.filas.forEach(function (f) {
    var leg = claveLegajo_(f[E.LEGAJO]);
    var prenda = String(f[E.PRENDA] || '').toUpperCase();
    var fecha = f._fecha;
    if (!leg || PRENDAS.indexOf(prenda) < 0 || !fecha) return;
    if (!mapa[leg]) mapa[leg] = { PANTALON: null, CAMISA: null, BOTIN: null };
    if (!mapa[leg][prenda] || fecha.getTime() > mapa[leg][prenda].getTime()) {
      mapa[leg][prenda] = fecha;
    }
  });
  return mapa;
}

/**
 * Registra una entrega (una o varias prendas de una persona, en un paso).
 * datos = {
 *   legajo, fecha (Date|string), motivo ('CICLO'|'ROTURA'|'CICLO INICIAL'),
 *   observaciones,
 *   items: [{ prenda:'PANTALON'|'CAMISA'|'BOTIN', talle?, observaciones? }]
 * }
 * Si no se pasa talle, se toma el de PERSONAL.
 */
function registrarEntrega_(datos) {
  var op = buscarOperario_(datos.legajo);
  if (!op) throw new Error('No existe el legajo ' + datos.legajo + ' en PERSONAL.');

  var fecha = aFecha_(datos.fecha) || hoy_();
  var motivo = String(datos.motivo || 'CICLO').toUpperCase();
  if (MOTIVOS.indexOf(motivo) < 0) throw new Error('Motivo inválido: ' + motivo);

  var items = datos.items || [];
  if (!items.length) throw new Error('No se eligió ninguna prenda para entregar.');

  var nombre = op[P.NOMBRE];
  var registradas = [];
  items.forEach(function (it) {
    var prenda = String(it.prenda || '').toUpperCase();
    if (PRENDAS.indexOf(prenda) < 0) throw new Error('Prenda inválida: ' + it.prenda);
    var talle = (it.talle !== undefined && it.talle !== '') ? it.talle : op[talleHeaderDePrenda_(prenda)];
    appendFilaPorHeader_(SHEETS.ENTREGAS, {
      'FECHA': fecha,
      'LEGAJO': op[P.LEGAJO],
      'APELLIDO Y NOMBRE': nombre,
      'PRENDA': prenda,
      'TALLE': talle || '',
      'MOTIVO': motivo,
      'OBSERVACIONES': it.observaciones || datos.observaciones || ''
    });
    registradas.push(prenda);
  });

  return { ok: true, legajo: op[P.LEGAJO], prendas: registradas, fecha: fmtFecha_(fecha) };
}

/* ===================== Pendientes de la última compra (Fase 5) ===================== */

/**
 * Lista de trabajo "Entregar": qué falta entregar de la ÚLTIMA compra congelada.
 *
 * No hay hoja ni esfera nueva: el pendiente se DERIVA cruzando dos cosas que ya
 * existen — la corrida congelada (HISTORIAL.DETALLE_JSON.incluidas: lista por
 * persona con legajo/prenda/talle/grupo/estado) contra ENTREGAS posteriores a su
 * congelado. Una prenda deja de estar pendiente apenas se registra su entrega
 * con fecha >= FECHA_CONGELADO (registrar reinicia el reloj y auto-cumple el
 * pendiente). Backdatear antes del congelado la deja pendiente, a propósito.
 */
function entregasPendientes_() {
  var hist = leerObjetos_(SHEETS.HISTORIAL);
  if (!hist.filas.length) {
    return { hayCompra: false, total: 0, personas: [] };
  }
  var ultima = hist.filas[hist.filas.length - 1]; // append-only: la última es la más nueva
  var detalle = {};
  try { detalle = JSON.parse(ultima.DETALLE_JSON || '{}'); } catch (e) { detalle = {}; }
  var incluidas = detalle.incluidas || [];

  var fechaCongelado = aFecha_(ultima.FECHA_CONGELADO);
  var entregadas = entregadasDesde_(fechaCongelado);

  // Agrupa pendientes por persona, conservando el orden de la corrida.
  var porLegajo = {}, orden = [];
  incluidas.forEach(function (f) {
    var leg = claveLegajo_(f.legajo);
    var prenda = String(f.prenda || '').toUpperCase();
    if (!leg || PRENDAS.indexOf(prenda) < 0) return;
    if (entregadas[leg + '|' + prenda]) return; // ya entregada desde el congelado
    if (!porLegajo[leg]) {
      porLegajo[leg] = { legajo: f.legajo, nombre: f.nombre || '', items: [] };
      orden.push(leg);
    }
    porLegajo[leg].items.push({
      prenda: prenda,
      talle: f.talle || '',
      grupo: f.grupo || '',
      estado: f.estado || ''
    });
  });

  var personas = orden.map(function (leg) { return porLegajo[leg]; });
  var total = personas.reduce(function (n, p) { return n + p.items.length; }, 0);

  return {
    hayCompra: true,
    idCorrida: ultima.ID_CORRIDA,
    fechaCorrida: ultima.FECHA_CORRIDA,
    fechaCongelado: ultima.FECHA_CONGELADO,
    total: total,
    personas: personas
  };
}

/** { "claveLegajo|PRENDA": true } de toda entrega con fecha >= desde (o todas si desde es null). */
function entregadasDesde_(desde) {
  var data = leerEntregas_();
  var t = desde ? desde.getTime() : 0;
  var mapa = {};
  data.filas.forEach(function (f) {
    if (!f._fecha || f._fecha.getTime() < t) return;
    var leg = claveLegajo_(f[E.LEGAJO]);
    var prenda = String(f[E.PRENDA] || '').toUpperCase();
    if (!leg || PRENDAS.indexOf(prenda) < 0) return;
    mapa[leg + '|' + prenda] = true;
  });
  return mapa;
}

/**
 * Confirma la entrega de un pendiente desde la lista de trabajo. Reusa
 * registrarEntrega_ (reinicia relojes igual que una entrega suelta) y devuelve
 * la lista de pendientes ya refrescada, para que el front no haga otra vuelta.
 */
function confirmarEntregas_(datos) {
  var entrega = registrarEntrega_(datos);
  return { ok: true, entrega: entrega, pendientes: entregasPendientes_() };
}
