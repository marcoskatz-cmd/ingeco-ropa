/**
 * Corrida.gs — Vistas calculadas que se muestran en la web app (no son hojas):
 *  - calcularCorrida: qué corresponde AHORA, a la fecha de la corrida más
 *    cercana a hoy.
 *  - generarPrevision: qué va a corresponder a hoy + dias_prevision, para
 *    asegurar el fondo con anticipación.
 */

/** PENDIENTES: prendas que entran en la corrida actual. */
function calcularCorrida_() {
  var hoy = hoy_();
  var corrida = corridaMasCercana_(hoy);
  var filas = evaluarPadron_(corrida, hoy);
  return {
    titulo: 'Corrida ' + fmtFecha_(corrida),
    fechaCorrida: fmtFecha_(corrida),
    fechaObjetivo: fmtFecha_(corrida),
    filas: filas,
    resumen: resumir_(filas)
  };
}

/** PREVISIÓN: prendas que cruzarán la vida útil a hoy + dias_prevision. */
function generarPrevision_() {
  var hoy = hoy_();
  var dias = getDiasPrevision_();
  var objetivo = new Date(hoy.getTime() + dias * MS_DIA);
  var filas = evaluarPadron_(objetivo, hoy);
  return {
    titulo: 'Previsión a ' + dias + ' días (' + fmtFecha_(objetivo) + ')',
    fechaObjetivo: fmtFecha_(objetivo),
    dias: dias,
    filas: filas,
    resumen: resumir_(filas)
  };
}

function resumir_(filas) {
  var r = { total: filas.length, criticos: 0, elegibles: 0, sinDato: 0, innegociables: 0, faltaTalle: 0 };
  filas.forEach(function (f) {
    if (f.estado === 'CRITICO') r.criticos++;
    else if (f.estado === 'ELEGIBLE') r.elegibles++;
    else r.sinDato++;
    if (f.innegociable) r.innegociables++;
    if (f.faltaTalle) r.faltaTalle++;
  });
  return r;
}

/**
 * Resumen para el tablero de inicio. Compone sobre el motor de cálculo, sin
 * recalcular nada nuevo:
 *  - comprar  : qué toca comprar AHORA (corrida más cercana).
 *  - sinTalle : prendas que entran a la corrida pero no se pueden pedir por
 *               falta de talle (poka-yoke: van adelante).
 *  - prevision: qué va a vencer dentro del horizonte configurado.
 *  - entregasPendientes: de la última compra congelada (Fase 5; hoy 0).
 */
function resumenTablero_() {
  var corrida = calcularCorrida_();
  var prevision = generarPrevision_();
  var rc = corrida.resumen || {};
  var rp = prevision.resumen || {};
  return {
    comprar: {
      total: rc.total || 0,
      criticos: rc.criticos || 0,
      elegibles: rc.elegibles || 0,
      sinDato: rc.sinDato || 0,
      fecha: corrida.fechaCorrida
    },
    sinTalle: rc.faltaTalle || 0,
    prevision: {
      dias: prevision.dias,
      total: rp.total || 0,
      criticos: rp.criticos || 0,
      fecha: prevision.fechaObjetivo
    },
    entregasPendientes: entregasPendientes_().total // pendientes de la última compra congelada
  };
}
