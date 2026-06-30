/**
 * Calculo.gs — Motor central. Aplica las reglas de negocio (4, 5, 6) para
 * decidir qué prenda entra a una corrida y con qué estado. Lo comparten
 * "Calcular corrida" (fecha objetivo = corrida) y "Generar previsión"
 * (fecha objetivo = hoy + dias_prevision).
 *
 * Reglas implementadas exactamente:
 *  - Entra si meses_uso(fecha_objetivo) >= vida_util.
 *  - INNEGOCIABLE si meses_uso(hoy) >= vida_util (postergar una corrida lo
 *    llevaría a vida_util + cadencia = techo).
 *  - CRÍTICO si es innegociable o meses_uso(objetivo) >= techo.
 *  - SIN DATO si la prenda nunca se entregó.
 */

/** Fecha de la corrida de grilla más cercana a `fecha` (default hoy). */
function corridaMasCercana_(fecha) {
  var ref = fecha || hoy_();
  var ancla = getFechaAncla_();
  var cad = getCadenciaMeses_();
  var difMeses = difMesesCalendario_(ancla, ref);
  var k = Math.round(difMeses / cad);
  return sumarMeses_(ancla, k * cad);
}

/**
 * Evalúa todo el padrón activo (3 prendas c/u) a una fecha objetivo.
 * Devuelve solo las prendas que ENTRAN (incluye SIN DATO). Cada registro es
 * un objeto plano listo para la UI.
 */
function evaluarPadron_(fechaObjetivo, hoy) {
  var vida = getVidaUtilMeses_();
  var techo = getTechoMeses_();
  var relojes = ultimaEntregaPorPrenda_();
  var activos = listarPersonal_(true);
  var out = [];

  activos.forEach(function (op) {
    var leg = claveLegajo_(op[P.LEGAJO]);
    var reloj = relojes[leg] || {};
    PRENDAS.forEach(function (prenda) {
      var rec = evaluarPrenda_(op, prenda, reloj[prenda] || null,
        fechaObjetivo, hoy, vida, techo);
      if (rec) out.push(rec);
    });
  });

  // Orden: críticos/innegociables primero, luego por meses de uso desc.
  out.sort(function (a, b) {
    var pa = rankEstado_(a), pb = rankEstado_(b);
    if (pa !== pb) return pa - pb;
    return (b.mesesUso || 0) - (a.mesesUso || 0);
  });
  return out;
}

function rankEstado_(r) {
  if (r.estado === 'CRITICO') return 0;
  if (r.estado === 'ELEGIBLE') return 1;
  return 2; // SIN DATO
}

/** Evalúa una prenda de un operario. Devuelve el registro o null si no entra. */
function evaluarPrenda_(op, prenda, ultimaFecha, fechaObjetivo, hoy, vida, techo) {
  var talle = op[talleHeaderDePrenda_(prenda)];
  var grupo = op[grupoHeaderDePrenda_(prenda)];
  var base = {
    legajo: op[P.LEGAJO],
    nombre: op[P.NOMBRE],
    centro: op[P.CENTRO],
    categoria: op[P.CATEGORIA],
    prenda: prenda,
    grupo: grupo || '',
    talle: (talle === null || talle === undefined) ? '' : String(talle),
    faltaTalle: !(talle !== null && talle !== undefined && String(talle).trim())
  };

  if (!ultimaFecha) {
    // Nunca recibió esta prenda: entra, pero es SIN DATO.
    base.ultimaEntrega = '';
    base.mesesUso = null;
    base.mesesHoy = null;
    base.estado = 'SIN DATO';
    base.innegociable = false;
    return base;
  }

  var mesesObj = mesesEntre_(ultimaFecha, fechaObjetivo);
  var mesesHoy = mesesEntre_(ultimaFecha, hoy);
  if (mesesObj < vida) return null; // no entra todavía

  var innegociable = mesesHoy >= vida;
  base.ultimaEntrega = fmtFecha_(ultimaFecha);
  base.mesesUso = Math.round(mesesObj * 10) / 10;
  base.mesesHoy = Math.round(mesesHoy * 10) / 10;
  base.innegociable = innegociable;
  base.estado = (innegociable || mesesObj >= techo) ? 'CRITICO' : 'ELEGIBLE';
  return base;
}
