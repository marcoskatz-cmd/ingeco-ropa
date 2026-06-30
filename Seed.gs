/**
 * Seed.gs — Carga inicial del padrón desde un Excel/listado. Se corre UNA sola
 * vez, a mano, desde el editor de Apps Script. NO es parte del flujo normal de
 * la app.
 *
 * Dos formas de usarlo:
 *   1) Pegá tu Excel en una hoja nueva llamada IMPORTAR dentro de la planilla
 *      base (con fila de encabezados) y ejecutá  sembrarPadronInicial().
 *   2) O pasá vos el array 2D (encabezados + filas) a importarPadronDesdeValores().
 *
 * Encabezados reconocidos (importa el nombre, no el orden):
 *   LEGAJO*           — obligatorio
 *   APELLIDO Y NOMBRE — (o NOMBRE)
 *   CATEGORIA
 *   CENTRO DE COSTO   — (o CENTRO / OBRA)
 *   COLOR ROPA        — (o COLOR)
 *   TIPO BOTIN
 *   TALLE PANT        — (o TALLE PANTALON)
 *   TALLE CAM         — (o TALLE CAMISA)
 *   TALLE BOTIN
 *   ULTIMA ENTREGA    — (o FECHA / FECHA ENTREGA) fecha que aplica a las 3 prendas
 *   FECHA PANT | FECHA CAM | FECHA BOTIN — opcional, fecha por prenda (pisa la anterior)
 *   OBSERVACIONES
 *
 * Reglas:
 *   - Cada fecha sembrada genera una ENTREGA con motivo 'CICLO INICIAL'.
 *   - Si una prenda no tiene fecha, queda SIN DATO (no se siembra entrega).
 *   - Idempotente: si el legajo ya existe en PERSONAL, esa fila se saltea.
 */

function sembrarPadronInicial() {
  return importarPadronDesdeHoja_('IMPORTAR');
}

function importarPadronDesdeHoja_(nombreHoja) {
  var sh = getSheet_(nombreHoja);
  if (!sh) {
    throw new Error('No existe la hoja "' + nombreHoja + '". Pegá ahí tu listado con encabezados y volvé a correr.');
  }
  return importarPadronDesdeValores(sh.getDataRange().getValues());
}

function importarPadronDesdeValores(valores) {
  if (!valores || valores.length < 2) throw new Error('No hay filas para importar (¿falta el encabezado?).');

  var headers = valores[0].map(function (h) { return normalizar_(h); });
  var idx = {
    legajo:   buscarCol_(headers, ['LEGAJO']),
    nombre:   buscarCol_(headers, ['APELLIDO Y NOMBRE', 'APELLIDO Y NOMBRES', 'NOMBRE']),
    categoria:buscarCol_(headers, ['CATEGORIA']),
    centro:   buscarCol_(headers, ['CENTRO DE COSTO', 'CENTRO', 'OBRA']),
    color:    buscarCol_(headers, ['COLOR ROPA', 'COLOR']),
    tipoBotin:buscarCol_(headers, ['TIPO BOTIN', 'BOTIN TIPO']),
    tallePant:buscarCol_(headers, ['TALLE PANT', 'TALLE PANTALON']),
    talleCam: buscarCol_(headers, ['TALLE CAM', 'TALLE CAMISA']),
    talleBotin:buscarCol_(headers, ['TALLE BOTIN']),
    ultima:   buscarCol_(headers, ['ULTIMA ENTREGA', 'FECHA ENTREGA', 'FECHA', 'ULTIMA']),
    fPant:    buscarCol_(headers, ['FECHA PANT', 'FECHA PANTALON']),
    fCam:     buscarCol_(headers, ['FECHA CAM', 'FECHA CAMISA']),
    fBotin:   buscarCol_(headers, ['FECHA BOTIN']),
    obs:      buscarCol_(headers, ['OBSERVACIONES', 'OBS'])
  };
  if (idx.legajo < 0) throw new Error('Falta la columna LEGAJO en el encabezado.');

  var res = { creados: 0, existentes: 0, entregas: 0, errores: [] };

  for (var r = 1; r < valores.length; r++) {
    var fila = valores[r];
    var legajo = String(celda_(fila, idx.legajo)).trim();
    if (!legajo) continue;

    try {
      if (buscarOperario_(legajo)) { res.existentes++; }
      else {
        crearOperario_({
          legajo: legajo,
          nombre: celda_(fila, idx.nombre),
          categoria: celda_(fila, idx.categoria),
          centro: celda_(fila, idx.centro),
          color: celda_(fila, idx.color),
          tipoBotin: celda_(fila, idx.tipoBotin),
          tallePant: celda_(fila, idx.tallePant),
          talleCam: celda_(fila, idx.talleCam),
          talleBotin: celda_(fila, idx.talleBotin),
          observaciones: celda_(fila, idx.obs),
          activo: true
        });
        res.creados++;
      }

      var ultima = aFecha_(celda_(fila, idx.ultima));
      var porPrenda = {
        PANTALON: aFecha_(celda_(fila, idx.fPant)) || ultima,
        CAMISA:   aFecha_(celda_(fila, idx.fCam))  || ultima,
        BOTIN:    aFecha_(celda_(fila, idx.fBotin)) || ultima
      };
      PRENDAS.forEach(function (prenda) {
        var fecha = porPrenda[prenda];
        if (!fecha) return;
        registrarEntrega_({
          legajo: legajo, fecha: fecha, motivo: 'CICLO INICIAL',
          observaciones: 'Carga inicial del padrón',
          items: [{ prenda: prenda }]
        });
        res.entregas++;
      });
    } catch (e) {
      res.errores.push('Legajo ' + legajo + ': ' + (e.message || e));
    }
  }

  invalidarCache_();
  return res;
}

/** Índice (0-based) de la primera columna cuyo encabezado normalizado matchea. */
function buscarCol_(headersNorm, alias) {
  for (var a = 0; a < alias.length; a++) {
    var obj = normalizar_(alias[a]);
    for (var i = 0; i < headersNorm.length; i++) {
      if (headersNorm[i] === obj) return i;
    }
  }
  return -1;
}

function celda_(fila, idx) {
  return idx >= 0 && idx < fila.length ? fila[idx] : '';
}
