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
  var notas = notasNoEntregaPorLegajo_();

  // Agrupa pendientes por persona, conservando el orden de la corrida.
  var porLegajo = {}, orden = [];
  incluidas.forEach(function (f) {
    var leg = claveLegajo_(f.legajo);
    var prenda = String(f.prenda || '').toUpperCase();
    if (!leg || PRENDAS.indexOf(prenda) < 0) return;
    if (entregadas[leg + '|' + prenda]) return; // ya entregada desde el congelado
    if (!porLegajo[leg]) {
      var n = notas[leg];
      porLegajo[leg] = {
        legajo: f.legajo, nombre: f.nombre || '', items: [],
        notaNoEntrega: n ? { fecha: n.fecha, comentario: n.comentario } : null
      };
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
 * Confirma una persona desde la lista de trabajo. Puede registrar entregas
 * (reinicia relojes), y/o anotar un motivo de NO-entrega para lo que quedó sin
 * dar. Cualquiera de las dos partes es opcional, pero al menos una debe venir.
 * datos = { legajo, fecha, motivo, items:[...], noEntrega?:{ prendas:[...], comentario } }
 */
function confirmarEntregas_(datos, usuario) {
  datos = datos || {};
  var hayItems = datos.items && datos.items.length;
  var noEnt = datos.noEntrega || null;
  var hayNota = noEnt && String(noEnt.comentario || '').trim();
  if (!hayItems && !hayNota) {
    throw new Error('Elegí al menos una prenda para entregar o escribí el motivo de no-entrega.');
  }
  var resultado = { ok: true };
  if (hayItems) resultado.entrega = registrarEntrega_(datos);
  if (hayNota) {
    registrarNoEntrega_({
      legajo: datos.legajo, fecha: datos.fecha,
      prendas: noEnt.prendas || [], comentario: noEnt.comentario
    }, usuario);
  }
  resultado.pendientes = entregasPendientes_();
  return resultado;
}

/* ===================== No-entregas (motivos) ===================== */

/** Crea la hoja NO_ENTREGAS con encabezados si todavía no existe. */
function ensureNoEntregasSheet_() {
  var ss = getSpreadsheet_();
  var sh = ss.getSheetByName(SHEETS.NO_ENTREGAS);
  if (!sh) {
    sh = ss.insertSheet(SHEETS.NO_ENTREGAS);
    sh.getRange(1, 1, 1, COLS.NO_ENTREGAS.length).setValues([COLS.NO_ENTREGAS]);
    sh.setFrozenRows(1);
  }
  return sh;
}

/** Registra un motivo de no-entrega (una nota por persona y pasada). Append-only. */
function registrarNoEntrega_(datos, usuario) {
  var op = buscarOperario_(datos.legajo);
  var prendas = (datos.prendas || [])
    .map(function (p) { return String(p || '').toUpperCase(); })
    .filter(function (p) { return PRENDAS.indexOf(p) >= 0; });
  ensureNoEntregasSheet_();
  appendFilaPorHeader_(SHEETS.NO_ENTREGAS, {
    'FECHA': aFecha_(datos.fecha) || hoy_(),
    'LEGAJO': op ? op[P.LEGAJO] : datos.legajo,
    'APELLIDO Y NOMBRE': op ? op[P.NOMBRE] : '',
    'PRENDAS': prendas.join(', '),
    'COMENTARIO': String(datos.comentario || '').trim(),
    'USUARIO': usuario || ''
  });
  return { ok: true };
}

/** { claveLegajo: { fecha, comentario, prendas } } con la nota MÁS reciente por persona. */
function notasNoEntregaPorLegajo_() {
  var sh = getSheet_(SHEETS.NO_ENTREGAS);
  if (!sh) return {};
  var data = leerObjetos_(SHEETS.NO_ENTREGAS);
  var mapa = {};
  data.filas.forEach(function (f) {
    var leg = claveLegajo_(f.LEGAJO);
    if (!leg) return;
    var fe = aFecha_(f.FECHA);
    var nota = {
      fecha: fe ? fmtFecha_(fe) : String(f.FECHA || ''),
      _t: fe ? fe.getTime() : 0,
      comentario: f.COMENTARIO || '',
      prendas: f.PRENDAS || ''
    };
    if (!mapa[leg] || nota._t >= mapa[leg]._t) mapa[leg] = nota;
  });
  return mapa;
}

/* ===================== Historial por operario ===================== */

/**
 * Historial de entregas de UN operario: todas sus filas de ENTREGAS de la más
 * nueva a la más vieja, más la última fecha por prenda. Solo lectura.
 * Sirve para responder "qué se le dio a esta persona y cuándo".
 */
function historialOperario_(legajo) {
  var clave = claveLegajo_(legajo);
  if (!clave) throw new Error('Legajo vacío.');
  var op = buscarOperario_(legajo);
  var data = leerEntregas_();
  var propias = data.filas.filter(function (f) { return claveLegajo_(f[E.LEGAJO]) === clave; });
  propias.sort(function (a, b) {
    var ta = a._fecha ? a._fecha.getTime() : 0, tb = b._fecha ? b._fecha.getTime() : 0;
    return tb - ta; // más nueva primero
  });

  var ultima = { PANTALON: null, CAMISA: null, BOTIN: null };
  propias.forEach(function (f) {
    var pr = String(f[E.PRENDA] || '').toUpperCase();
    if (PRENDAS.indexOf(pr) < 0 || !f._fecha) return;
    if (!ultima[pr] || f._fecha.getTime() > ultima[pr].getTime()) ultima[pr] = f._fecha;
  });

  var entregas = propias.map(function (f) {
    return {
      fecha: f._fecha ? fmtFecha_(f._fecha) : String(f[E.FECHA] || ''),
      prenda: f[E.PRENDA] || '',
      talle: f[E.TALLE] || '',
      motivo: f[E.MOTIVO] || '',
      observaciones: f[E.OBS] || ''
    };
  });

  var notas = [];
  if (getSheet_(SHEETS.NO_ENTREGAS)) {
    leerObjetos_(SHEETS.NO_ENTREGAS).filas
      .filter(function (f) { return claveLegajo_(f.LEGAJO) === clave; })
      .forEach(function (f) {
        var fe = aFecha_(f.FECHA);
        notas.push({ _t: fe ? fe.getTime() : 0, fecha: fe ? fmtFecha_(fe) : String(f.FECHA || ''),
          prendas: f.PRENDAS || '', comentario: f.COMENTARIO || '' });
      });
    notas.sort(function (a, b) { return b._t - a._t; });
    notas = notas.map(function (n) { return { fecha: n.fecha, prendas: n.prendas, comentario: n.comentario }; });
  }

  return {
    legajo: op ? op[P.LEGAJO] : legajo,
    nombre: op ? op[P.NOMBRE] : (propias[0] ? propias[0][E.NOMBRE] : ''),
    ultimaPorPrenda: {
      PANTALON: ultima.PANTALON ? fmtFecha_(ultima.PANTALON) : null,
      CAMISA: ultima.CAMISA ? fmtFecha_(ultima.CAMISA) : null,
      BOTIN: ultima.BOTIN ? fmtFecha_(ultima.BOTIN) : null
    },
    entregas: entregas,
    notasNoEntrega: notas
  };
}
