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
