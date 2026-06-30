/**
 * Proveedores.gs — Comparación de precios (hasta 5 proveedores). El precio es
 * por tipo de prenda (no varía por color ni talle).
 *
 *  - Total todo-o-nada por proveedor: valoriza el pedido completo con sus
 *    precios. Si no cotiza una prenda que el pedido necesita, queda incompleto
 *    (no se inventa un total).
 *  - Ganador = menor total completo (criterio: comprar todo a un proveedor).
 *  - Split informativo: cada prenda al más barato. Solo informa el ahorro vs.
 *    el ganador; NO parte el pedido.
 */
function valorizarPedido_(totales) {
  var precios = leerPreciosProveedores_();
  var necesarias = PRENDAS.filter(function (p) { return (totales[p] || 0) > 0; });

  var hayPrecios = precios.proveedores.some(function (prov) {
    return PRENDAS.some(function (p) { return prov.precios[p] !== null; });
  });
  if (!hayPrecios || necesarias.length === 0) {
    return { hayPrecios: hayPrecios, proveedores: [], ganador: null, split: null };
  }

  var evaluados = precios.proveedores.map(function (prov) {
    var faltan = [], detalle = {}, total = 0, completo = true;
    necesarias.forEach(function (p) {
      var precio = prov.precios[p];
      if (precio === null) { faltan.push(p); completo = false; return; }
      var sub = precio * totales[p];
      detalle[p] = { precio: precio, subtotal: sub };
      total += sub;
    });
    return {
      nombre: prov.nombre,
      completo: completo,
      total: completo ? total : null,
      faltan: faltan,
      detalle: detalle
    };
  });

  var ganador = null;
  evaluados.forEach(function (e) {
    if (e.completo && (ganador === null || e.total < ganador.total)) {
      ganador = { nombre: e.nombre, total: e.total };
    }
  });

  var split = calcularSplit_(necesarias, totales, precios.proveedores, ganador);

  return { hayPrecios: true, proveedores: evaluados, ganador: ganador, split: split };
}

/** Costo con cada prenda al proveedor más barato (solo informativo). */
function calcularSplit_(necesarias, totales, proveedores, ganador) {
  var porPrenda = {}, total = 0, completo = true;
  necesarias.forEach(function (p) {
    var mejor = null;
    proveedores.forEach(function (prov) {
      var precio = prov.precios[p];
      if (precio !== null && (mejor === null || precio < mejor.precio)) {
        mejor = { proveedor: prov.nombre, precio: precio };
      }
    });
    if (!mejor) { completo = false; return; }
    var sub = mejor.precio * totales[p];
    porPrenda[p] = { proveedor: mejor.proveedor, precio: mejor.precio, subtotal: sub };
    total += sub;
  });
  if (!completo) return { completo: false, total: null, porPrenda: porPrenda, ahorro: null };
  var ahorro = ganador ? (ganador.total - total) : null;
  return { completo: true, total: total, porPrenda: porPrenda, ahorro: ahorro };
}

/**
 * Lee PROVEEDORES: { proveedores: [{ nombre, precios: {PANTALON, CAMISA, BOTIN} }] }.
 * Los encabezados (col 2 en adelante) son los nombres reales de proveedor.
 * Celda vacía o no numérica = ese proveedor no cotiza esa prenda (null).
 */
function leerPreciosProveedores_() {
  var sh = requireSheet_(SHEETS.PROVEEDORES);
  var data = sh.getDataRange().getValues();
  var headers = data[0] || [];
  var proveedores = [];
  for (var c = 1; c < headers.length; c++) {
    var nombre = String(headers[c] || '').trim();
    if (!nombre) continue;
    proveedores.push({ col: c, nombre: nombre, precios: { PANTALON: null, CAMISA: null, BOTIN: null } });
  }
  for (var r = 1; r < data.length; r++) {
    var prenda = String(data[r][0] || '').trim().toUpperCase();
    if (PRENDAS.indexOf(prenda) < 0) continue;
    proveedores.forEach(function (prov) {
      var v = data[r][prov.col];
      var n = Number(v);
      prov.precios[prenda] = (v !== '' && v !== null && isFinite(n) && n > 0) ? n : null;
    });
  }
  return { proveedores: proveedores };
}
