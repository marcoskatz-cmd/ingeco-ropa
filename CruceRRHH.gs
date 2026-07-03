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

/**
 * Cruza el texto pegado contra PERSONAL.
 *
 * El cruce primario es por LEGAJO. Como red de seguridad contra errores de
 * tipeo en el legajo, cuando una línea de RRHH no matchea por legajo se busca
 * un ACTIVO del padrón con el MISMO nombre; si hay exactamente uno, en vez de
 * marcarlo como alta nueva (y dejar al del padrón como baja) se lo pone en la
 * lista `revisar` para que el usuario confirme si es la misma persona. NUNCA
 * se resuelve solo: `revisar` es una sugerencia.
 */
function cruzarRRHH_(textoPegado) {
  var rrhh = parsearListadoRRHH_(textoPegado);
  var rrhhPorLegajo = {};
  rrhh.forEach(function (r) { rrhhPorLegajo[claveLegajo_(r.legajo)] = r; });

  var data = leerPersonal_();

  // Índice de ACTIVOS del padrón por nombre normalizado (para el fallback).
  var activosPorNombre = {};
  data.filas.forEach(function (op) {
    if (!esSi_(op[P.ACTIVO])) return;
    var nom = normalizar_(op[P.NOMBRE]);
    if (!nom) return;
    (activosPorNombre[nom] = activosPorNombre[nom] || []).push(op);
  });

  var matchedPorNombre = {}; // claveLegajo del padrón ya "tomado" por un match de nombre
  var altas = [], coinciden = [], revisar = [];

  // ALTAS / COINCIDEN / REVISAR: recorro el listado de RRHH.
  rrhh.forEach(function (r) {
    var hit = data.porLegajo[claveLegajo_(r.legajo)];
    if (hit) {
      if (!esSi_(hit.obj[P.ACTIVO])) {
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
      return;
    }

    // No matcheó por legajo → probar por nombre entre activos aún no tomados.
    // Excluyo también a los que YA fueron confirmados por legajo en otra línea
    // de RRHH (rrhhPorLegajo): si RRHH ya los listó por legajo, no son un typo,
    // y un homónimo nuevo debe caer como alta, no arrastrar a esa persona a revisar.
    var cand = (activosPorNombre[normalizar_(r.nombre)] || []).filter(function (op) {
      var k = claveLegajo_(op[P.LEGAJO]);
      return !matchedPorNombre[k] && !rrhhPorLegajo[k];
    });
    if (cand.length === 1) {
      var op = cand[0];
      matchedPorNombre[claveLegajo_(op[P.LEGAJO])] = true;
      revisar.push({
        legajoRRHH: r.legajo,
        legajoPadron: op[P.LEGAJO],
        nombre: op[P.NOMBRE] || r.nombre,
        categoriaRRHH: String(r.categoria || '').trim(),
        categoriaPadron: String(op[P.CATEGORIA] || '').trim()
      });
      return;
    }
    // Sin homónimo activo (o varios) → alta nueva. Marco si hubo ambigüedad.
    altas.push({
      legajo: r.legajo, nombre: r.nombre, categoria: r.categoria, motivo: 'NUEVO',
      sinTalle: true, homonimos: cand.length > 1 ? cand.length : undefined
    });
  });

  // BAJAS: activos del padrón que no están en RRHH por legajo NI fueron tomados
  // por un match de nombre (esos van a `revisar`, no a baja).
  var bajas = [];
  data.filas.forEach(function (op) {
    if (!esSi_(op[P.ACTIVO])) return;
    var leg = claveLegajo_(op[P.LEGAJO]);
    if (rrhhPorLegajo[leg] || matchedPorNombre[leg]) return;
    bajas.push({
      legajo: op[P.LEGAJO], nombre: op[P.NOMBRE], categoria: op[P.CATEGORIA],
      talles: op[P.TALLE_PANT] + ' / ' + op[P.TALLE_CAM] + ' / ' + op[P.TALLE_BOTIN]
    });
  });

  return {
    bajas: bajas, altas: altas, coinciden: coinciden, revisar: revisar,
    resumen: {
      bajas: bajas.length, altas: altas.length, coinciden: coinciden.length,
      revisar: revisar.length, leidos: rrhh.length
    }
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
