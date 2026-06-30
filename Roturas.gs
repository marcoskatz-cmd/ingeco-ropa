/**
 * Roturas.gs — Reporte de roturas. Recorre el log de ENTREGAS, toma cada
 * entrega con MOTIVO = ROTURA y calcula la "edad" de la prenda al romperse
 * (meses entre la entrega anterior de esa misma prenda y la rotura).
 *
 *  - Rotura TARDÍA: la prenda ya estaba vieja al romperse (edad >= vida-cadencia).
 *    Casi cumplió su vida útil; es desgaste esperable.
 *  - Rotura TEMPRANA: se rompió bastante antes (edad < vida-cadencia). Es la que
 *    interesa vigilar: mala calidad o mal uso.
 *  - SIN REFERENCIA: no hay entrega anterior de esa prenda (no se puede medir edad).
 *
 * Agrega por operario y por centro de costo para ver dónde se concentran.
 */

/** Umbral de meses a partir del cual una rotura se considera "tardía". */
function umbralRoturaTardia_() {
  return Math.max(0, getVidaUtilMeses_() - getCadenciaMeses_());
}

function reporteRoturas_() {
  var data = leerEntregas_();
  var personal = leerPersonal_();
  var umbral = umbralRoturaTardia_();

  // Agrupar entregas por legajo+prenda, ordenadas por fecha ascendente.
  var grupos = {};
  data.filas.forEach(function (f) {
    var leg = claveLegajo_(f[E.LEGAJO]);
    var prenda = String(f[E.PRENDA] || '').toUpperCase();
    if (!leg || PRENDAS.indexOf(prenda) < 0 || !f._fecha) return;
    var k = leg + '|' + prenda;
    if (!grupos[k]) grupos[k] = [];
    grupos[k].push(f);
  });
  Object.keys(grupos).forEach(function (k) {
    grupos[k].sort(function (a, b) { return a._fecha.getTime() - b._fecha.getTime(); });
  });

  // Detectar cada rotura y medir su edad contra la entrega previa.
  var conFecha = [];
  Object.keys(grupos).forEach(function (k) {
    var arr = grupos[k];
    for (var i = 0; i < arr.length; i++) {
      var f = arr[i];
      if (String(f[E.MOTIVO] || '').toUpperCase() !== 'ROTURA') continue;
      var anterior = i > 0 ? arr[i - 1] : null;
      var edad = anterior ? Math.round(mesesEntre_(anterior._fecha, f._fecha) * 10) / 10 : null;
      var tardia = (edad !== null && edad >= umbral);
      var leg = claveLegajo_(f[E.LEGAJO]);
      var op = personal.porLegajo[leg];
      conFecha.push({
        ts: f._fecha.getTime(),
        ev: {
          legajo: f[E.LEGAJO],
          nombre: f[E.NOMBRE] || (op ? op.obj[P.NOMBRE] : ''),
          centro: op ? op.obj[P.CENTRO] : '',
          prenda: String(f[E.PRENDA] || '').toUpperCase(),
          fecha: fmtFecha_(f._fecha),
          edadMeses: edad,
          tardia: tardia,
          temprana: (edad !== null && !tardia),
          observaciones: f[E.OBS] || ''
        }
      });
    }
  });

  conFecha.sort(function (a, b) { return b.ts - a.ts; }); // más recientes primero
  var eventos = conFecha.map(function (x) { return x.ev; });

  return {
    resumen: {
      total: eventos.length,
      tempranas: contarRoturas_(eventos, 'temprana'),
      tardias: contarRoturas_(eventos, 'tardia'),
      sinReferencia: eventos.filter(function (e) { return e.edadMeses === null; }).length,
      umbralTardiaMeses: umbral
    },
    eventos: eventos,
    porLegajo: agruparRoturas_(eventos, 'legajo'),
    porCentro: agruparRoturas_(eventos, 'centro')
  };
}

function contarRoturas_(eventos, flag) {
  return eventos.filter(function (e) { return e[flag]; }).length;
}

/**
 * Agrupa eventos de rotura por una clave ('legajo' o 'centro'), contando
 * totales, tempranas/tardías y unidades por prenda. Ordena por total desc.
 */
function agruparRoturas_(eventos, claveCampo) {
  var mapa = {};
  eventos.forEach(function (ev) {
    var clave = claveCampo === 'legajo' ? claveLegajo_(ev.legajo)
                                        : String(ev.centro || '(sin centro)');
    if (!mapa[clave]) {
      mapa[clave] = {
        legajo: claveCampo === 'legajo' ? ev.legajo : undefined,
        nombre: claveCampo === 'legajo' ? ev.nombre : undefined,
        centro: ev.centro || '(sin centro)',
        total: 0, tempranas: 0, tardias: 0,
        PANTALON: 0, CAMISA: 0, BOTIN: 0
      };
    }
    var r = mapa[clave];
    r.total++;
    if (ev.tardia) r.tardias++;
    else if (ev.temprana) r.tempranas++;
    if (r[ev.prenda] !== undefined) r[ev.prenda]++;
  });
  return Object.keys(mapa).map(function (k) { return mapa[k]; })
    .sort(function (a, b) { return b.total - a.total; });
}
