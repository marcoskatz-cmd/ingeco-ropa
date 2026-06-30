/**
 * CruceRRHH.gs — Compara el listado vigente de RRHH (pegado en la app) contra
 * PERSONAL y arma tres bloques: BAJAS, ALTAS y COINCIDEN.
 *
 * Reglas críticas:
 *  - El cruce se hace SIEMPRE por LEGAJO, nunca por nombre.
 *  - El sistema marca y sugiere; NO ejecuta nada solo. Las altas/bajas se
 *    aplican una por una, solo las que el usuario confirma.
 *  - El cruce NUNCA toca los talles de PERSONAL.
 *  - El listado de RRHH trae nombre + legajo + categoría (sin centro de costo).
 */

/** Cruza el texto pegado contra PERSONAL. */
function cruzarRRHH_(textoPegado) {
  var rrhh = parsearListadoRRHH_(textoPegado);
  var rrhhPorLegajo = {};
  rrhh.forEach(function (r) { rrhhPorLegajo[claveLegajo_(r.legajo)] = r; });

  var data = leerPersonal_();

  var bajas = [], altas = [], coinciden = [];

  // BAJAS: activos en PERSONAL que no están en el listado de RRHH.
  data.filas.forEach(function (op) {
    if (!esSi_(op[P.ACTIVO])) return;
    var leg = claveLegajo_(op[P.LEGAJO]);
    if (!rrhhPorLegajo[leg]) {
      bajas.push({
        legajo: op[P.LEGAJO], nombre: op[P.NOMBRE], categoria: op[P.CATEGORIA],
        talles: op[P.TALLE_PANT] + ' / ' + op[P.TALLE_CAM] + ' / ' + op[P.TALLE_BOTIN]
      });
    }
  });

  // ALTAS y COINCIDEN: recorro el listado de RRHH.
  rrhh.forEach(function (r) {
    var hit = data.porLegajo[claveLegajo_(r.legajo)];
    if (!hit) {
      altas.push({ legajo: r.legajo, nombre: r.nombre, categoria: r.categoria, motivo: 'NUEVO', sinTalle: true });
    } else if (!esSi_(hit.obj[P.ACTIVO])) {
      altas.push({
        legajo: r.legajo, nombre: hit.obj[P.NOMBRE] || r.nombre,
        categoria: r.categoria || hit.obj[P.CATEGORIA], motivo: 'REINGRESO',
        sinTalle: false,
        talleGuardado: hit.obj[P.TALLE_PANT] + ' / ' + hit.obj[P.TALLE_CAM] + ' / ' + hit.obj[P.TALLE_BOTIN]
      });
    } else {
      var catPersonal = String(hit.obj[P.CATEGORIA] || '').trim();
      var catRRHH = String(r.categoria || '').trim();
      var difCategoria = catRRHH !== '' && normalizar_(catRRHH) !== normalizar_(catPersonal);
      coinciden.push({
        legajo: r.legajo, nombre: hit.obj[P.NOMBRE],
        categoriaPersonal: catPersonal, categoriaRRHH: catRRHH, difCategoria: difCategoria
      });
    }
  });

  return {
    bajas: bajas, altas: altas, coinciden: coinciden,
    resumen: { bajas: bajas.length, altas: altas.length, coinciden: coinciden.length, leidos: rrhh.length }
  };
}

/**
 * Parsea el texto pegado. Soporta columnas separadas por tab (copia de Excel)
 * o por ';', en orden LEGAJO, NOMBRE, CATEGORÍA. Si una línea no tiene
 * separador, toma el primer token como legajo y el resto como nombre.
 */
function parsearListadoRRHH_(texto) {
  var out = [];
  if (!texto) return out;
  var lineas = String(texto).split(/\r?\n/);
  for (var i = 0; i < lineas.length; i++) {
    var linea = lineas[i];
    if (!linea || !linea.trim()) continue;
    var partes;
    if (linea.indexOf('\t') >= 0) {
      partes = linea.split('\t');
    } else if (linea.indexOf(';') >= 0) {
      partes = linea.split(';');
    } else {
      var m = linea.match(/^(\S+)\s+(.*)$/);
      partes = m ? [m[1], m[2], ''] : [linea.trim()];
    }
    var legajo = String(partes[0] || '').trim();
    var nombre = String(partes[1] || '').trim();
    var categoria = String(partes[2] || '').trim();
    if (!legajo) continue;
    if (normalizar_(legajo) === 'LEGAJO') continue; // saltear encabezado
    out.push({ legajo: legajo, nombre: nombre, categoria: categoria });
  }
  return out;
}

/**
 * Aplica las acciones que el usuario confirmó, una por una. NUNCA toca talles.
 * cambios = [{ legajo, accion:'DAR DE BAJA'|'DAR DE ALTA'|'IGNORAR', nombre?, categoria? }]
 */
function aplicarCambiosCruce_(cambios) {
  var resultados = [];
  (cambios || []).forEach(function (c) {
    var accion = normalizar_(c.accion);
    try {
      if (accion === 'DAR DE BAJA') {
        setActivoOperario_(c.legajo, false);
        resultados.push({ legajo: c.legajo, accion: 'BAJA', ok: true });
      } else if (accion === 'DAR DE ALTA') {
        var existe = buscarOperario_(c.legajo);
        if (existe) {
          setActivoOperario_(c.legajo, true); // reingreso: talle intacto
          resultados.push({ legajo: c.legajo, accion: 'REINGRESO', ok: true });
        } else {
          crearOperario_({ legajo: c.legajo, nombre: c.nombre || '', categoria: c.categoria || '', activo: true });
          resultados.push({ legajo: c.legajo, accion: 'ALTA', ok: true });
        }
      } else {
        resultados.push({ legajo: c.legajo, accion: 'IGNORADO', ok: true });
      }
    } catch (e) {
      resultados.push({ legajo: c.legajo, accion: accion, ok: false, error: e.message });
    }
  });
  return { ok: true, resultados: resultados };
}
