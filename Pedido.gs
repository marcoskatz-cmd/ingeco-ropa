/**
 * Pedido.gs — Arma el desglose para el proveedor a partir de la corrida
 * actual. Agrega las prendas que entran en matrices (talle x grupo),
 * excluyendo las que el usuario marcó como "no entregar" y las SIN DATO sin
 * talle. Suma totales y valoriza contra PROVEEDORES.
 *
 * exclusiones: lista de claves "LEGAJO|PRENDA" a dejar afuera (lo que el
 * usuario marcó como no entregado en la pantalla de la corrida).
 */
function armarPedido_(exclusiones, horizonte) {
  var esPrev = (horizonte === 'prevision');
  var vista = esPrev ? generarPrevision_() : calcularCorrida_();
  var ped = armarDesdeFilas_(vista.filas, exclusiones);
  ped.horizonte = esPrev ? 'prevision' : 'ahora';
  ped.fechaCorrida = vista.fechaCorrida || vista.fechaObjetivo;
  ped.fechaObjetivo = vista.fechaObjetivo;
  ped.dias = vista.dias || 0;
  return ped;
}

/**
 * Vista unificada de la pantalla "Comprar": en UNA pasada calcula la lista del
 * horizonte elegido (corrida actual o previsión) y arma el pedido (matrices +
 * proveedores) sobre esas mismas filas, así evaluarPadron_ corre una sola vez.
 *  horizonte: 'ahora' (default) | 'prevision'.
 */
function vistaComprar_(horizonte, exclusiones) {
  var esPrev = (horizonte === 'prevision');
  var vista = esPrev ? generarPrevision_() : calcularCorrida_();

  // Adjunta a cada fila el motivo guardado de "no compra" (si lo hay).
  var notas = notasNoCompraPorClave_();
  vista.filas.forEach(function (f) {
    var n = notas[claveLegajo_(f.legajo) + '|' + String(f.prenda).toUpperCase()];
    f.motivoNoCompra = n ? n.comentario : '';
  });

  return {
    horizonte: esPrev ? 'prevision' : 'ahora',
    titulo: vista.titulo,
    fechaCorrida: vista.fechaCorrida || vista.fechaObjetivo,
    fechaObjetivo: vista.fechaObjetivo,
    dias: vista.dias || getDiasPrevision_(),
    filas: vista.filas,
    resumen: vista.resumen,
    pedido: armarDesdeFilas_(vista.filas, exclusiones)
  };
}

/* ===================== No-compras (motivos) ===================== */

/** Crea la hoja NO_COMPRAS con encabezados si todavía no existe. */
function ensureNoComprasSheet_() {
  var ss = getSpreadsheet_();
  var sh = ss.getSheetByName(SHEETS.NO_COMPRAS);
  if (!sh) {
    sh = ss.insertSheet(SHEETS.NO_COMPRAS);
    sh.getRange(1, 1, 1, COLS.NO_COMPRAS.length).setValues([COLS.NO_COMPRAS]);
    sh.setFrozenRows(1);
  }
  return sh;
}

/** Registra el motivo de por qué una prenda NO se compra. Append-only. */
function registrarNoCompra_(datos, usuario) {
  datos = datos || {};
  var legajo = String(datos.legajo || '').trim();
  var prenda = String(datos.prenda || '').toUpperCase();
  if (!legajo) throw new Error('Falta el legajo.');
  if (PRENDAS.indexOf(prenda) < 0) throw new Error('Prenda inválida: ' + datos.prenda);
  ensureNoComprasSheet_();
  appendFilaPorHeader_(SHEETS.NO_COMPRAS, {
    'FECHA': hoy_(),
    'LEGAJO': legajo,
    'PRENDA': prenda,
    'COMENTARIO': String(datos.comentario || '').trim(),
    'USUARIO': usuario || ''
  });
  return { ok: true };
}

/** { "claveLegajo|PRENDA": { comentario } } con el motivo MÁS reciente. */
function notasNoCompraPorClave_() {
  var sh = getSheet_(SHEETS.NO_COMPRAS);
  if (!sh) return {};
  var data = leerObjetos_(SHEETS.NO_COMPRAS);
  var mapa = {};
  data.filas.forEach(function (f) {
    var leg = claveLegajo_(f.LEGAJO);
    var prenda = String(f.PRENDA || '').toUpperCase();
    if (!leg || PRENDAS.indexOf(prenda) < 0) return;
    var fe = aFecha_(f.FECHA);
    var clave = leg + '|' + prenda;
    var nota = { _t: fe ? fe.getTime() : 0, comentario: f.COMENTARIO || '' };
    if (!mapa[clave] || nota._t >= mapa[clave]._t) mapa[clave] = nota;
  });
  return mapa;
}

/**
 * Núcleo del armado: a partir de filas ya evaluadas separa incluidas /
 * excluidas / sin talle y construye matrices y valorización. No recalcula el
 * padrón: trabaja sobre las filas que recibe.
 */
function armarDesdeFilas_(filas, exclusiones) {
  var excl = {};
  (exclusiones || []).forEach(function (k) { excl[String(k).toUpperCase()] = true; });

  var incluidas = [], excluidas = [], sinTalle = [];
  (filas || []).forEach(function (f) {
    var clave = claveLegajo_(f.legajo) + '|' + f.prenda;
    if (excl[clave]) { excluidas.push(f); return; }
    if (f.faltaTalle) { sinTalle.push(f); return; }
    incluidas.push(f);
  });

  var matrices = {}, totales = { unidades: 0 };
  PRENDAS.forEach(function (prenda) {
    var rows = incluidas.filter(function (f) { return f.prenda === prenda; });
    var m = matrizPrenda_(rows);
    matrices[prenda] = m;
    totales[prenda] = m.total;
    totales.unidades += m.total;
  });

  return {
    matrices: matrices,
    totales: totales,
    incluidas: incluidas,
    excluidas: excluidas,
    sinTalle: sinTalle,
    proveedores: valorizarPedido_(totales)
  };
}

/** Construye la matriz talle x grupo (con totales) de una prenda. */
function matrizPrenda_(rows) {
  var tallesSet = {}, gruposSet = {}, celdas = {};
  var total = 0;
  rows.forEach(function (f) {
    var t = String(f.talle || '(sin talle)');
    var g = String(f.grupo || '(sin grupo)');
    tallesSet[t] = true; gruposSet[g] = true;
    if (!celdas[t]) celdas[t] = {};
    celdas[t][g] = (celdas[t][g] || 0) + 1;
    total++;
  });

  var talles = Object.keys(tallesSet).sort(cmpTalle_);
  var grupos = Object.keys(gruposSet).sort();

  var totalPorGrupo = {}, totalPorTalle = {};
  grupos.forEach(function (g) { totalPorGrupo[g] = 0; });
  talles.forEach(function (t) {
    totalPorTalle[t] = 0;
    grupos.forEach(function (g) {
      var n = (celdas[t] && celdas[t][g]) || 0;
      totalPorTalle[t] += n;
      totalPorGrupo[g] += n;
    });
  });

  return {
    talles: talles, grupos: grupos, celdas: celdas,
    totalPorGrupo: totalPorGrupo, totalPorTalle: totalPorTalle, total: total
  };
}

/** Orden de talles: numérico si se puede, si no alfabético (S<M<L<XL...). */
function cmpTalle_(a, b) {
  var na = Number(a), nb = Number(b);
  if (isFinite(na) && isFinite(nb)) return na - nb;
  var orden = ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];
  var ia = orden.indexOf(String(a).toUpperCase());
  var ib = orden.indexOf(String(b).toUpperCase());
  if (ia >= 0 && ib >= 0) return ia - ib;
  return String(a).localeCompare(String(b));
}
