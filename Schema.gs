/**
 * Schema.gs — Forma de las tablas: encabezados exactos de cada hoja y
 * mapeos prenda -> columna de talle / grupo. Centralizado para que Setup y
 * los módulos usen exactamente los mismos strings (ojo con los acentos).
 */

// Encabezados, en orden, de cada hoja base de datos.
var COLS = {
  CONFIG: ['PARAMETRO', 'VALOR', 'NOTA'],

  LISTAS: ['COLOR ROPA', 'TIPO BOTIN', 'CATEGORIA', 'CENTRO DE COSTO',
           'TALLE PANT', 'TALLE CAM', 'TALLE BOTIN'],

  USUARIOS: ['NOMBRE', 'PIN_HASH', 'ACTIVO'],

  PERSONAL: ['LEGAJO', 'APELLIDO Y NOMBRE', 'CATEGORÍA', 'CENTRO DE COSTO',
             'COLOR ROPA', 'TIPO BOTÍN', 'TALLE PANT', 'TALLE CAM',
             'TALLE BOTÍN', 'ACTIVO', 'OBSERVACIONES'],

  ENTREGAS: ['FECHA', 'LEGAJO', 'APELLIDO Y NOMBRE', 'PRENDA', 'TALLE',
             'MOTIVO', 'OBSERVACIONES'],

  PROVEEDORES: ['PRENDA', 'PROVEEDOR 1', 'PROVEEDOR 2', 'PROVEEDOR 3',
                'PROVEEDOR 4', 'PROVEEDOR 5'],

  HISTORIAL: ['ID_CORRIDA', 'FECHA_CORRIDA', 'FECHA_CONGELADO', 'USUARIO',
              'TOTAL_PANTALON', 'TOTAL_CAMISA', 'TOTAL_BOTIN',
              'TOTAL_UNIDADES', 'PROVEEDOR_GANADOR', 'COSTO_GANADOR',
              'DETALLE_JSON']
};

// Acceso simbólico a columnas de PERSONAL (evita repetir strings con acentos).
var P = {
  LEGAJO: 'LEGAJO',
  NOMBRE: 'APELLIDO Y NOMBRE',
  CATEGORIA: 'CATEGORÍA',
  CENTRO: 'CENTRO DE COSTO',
  COLOR: 'COLOR ROPA',
  TIPO_BOTIN: 'TIPO BOTÍN',
  TALLE_PANT: 'TALLE PANT',
  TALLE_CAM: 'TALLE CAM',
  TALLE_BOTIN: 'TALLE BOTÍN',
  ACTIVO: 'ACTIVO',
  OBS: 'OBSERVACIONES'
};

var E = {
  FECHA: 'FECHA', LEGAJO: 'LEGAJO', NOMBRE: 'APELLIDO Y NOMBRE',
  PRENDA: 'PRENDA', TALLE: 'TALLE', MOTIVO: 'MOTIVO', OBS: 'OBSERVACIONES'
};

var U = { NOMBRE: 'NOMBRE', PIN: 'PIN_HASH', ACTIVO: 'ACTIVO' };

/** Columna de PERSONAL con el talle de cada prenda. */
function talleHeaderDePrenda_(prenda) {
  switch (String(prenda).toUpperCase()) {
    case 'PANTALON': return P.TALLE_PANT;
    case 'CAMISA': return P.TALLE_CAM;
    case 'BOTIN': return P.TALLE_BOTIN;
    default: throw new Error('Prenda desconocida: ' + prenda);
  }
}

/**
 * Columna de PERSONAL que define el GRUPO de compra: color para pantalón y
 * camisa, tipo de botín para botín.
 */
function grupoHeaderDePrenda_(prenda) {
  return String(prenda).toUpperCase() === 'BOTIN' ? P.TIPO_BOTIN : P.COLOR;
}
