/**
 * MigracionPadron.gs — TEMPORAL. Reinicia el padrón (PERSONAL) para que el
 * conjunto ACTIVO coincida con la nómina nueva de RRHH (2026-07-07, 133
 * operarios), conservando talles y atributos de los que se repiten.
 *
 * Uso (desde el editor de Apps Script):
 *   1) Correr previewReinicioPadron()  → NO cambia nada; mira el registro (Ver > Registros).
 *   2) Revisar counts y "posibles typos de legajo".
 *   3) Correr aplicarReinicioPadron()  → hace backup y aplica.
 *
 * Reglas: cruce SIEMPRE por legajo; nunca borra filas; nunca pisa talles.
 * Se elimina este archivo del proyecto una vez validado el resultado.
 */

var NOMINA_NUEVA = [
  { legajo: "837", nombre: "DE GREGORIO, GUSTAVO PEDRO", centro: "Adm. Yerba Buena" },
  { legajo: "844", nombre: "LESCANO, ALBERTO ANTONIO", centro: "Adm. Predio Warnes" },
  { legajo: "845", nombre: "SAGUIR, ESTEBAN MIGUEL", centro: "Adm. Yerba Buena" },
  { legajo: "852", nombre: "CRUZ, JAVIER MARCELO", centro: "Adm. Yerba Buena" },
  { legajo: "1331", nombre: "CASTRO, RENE ROBERTO", centro: "BELLA VISTA" },
  { legajo: "1442", nombre: "SINGH, LUIS ALBERTO", centro: "Adm. Yerba Buena" },
  { legajo: "1533", nombre: "GALVEZ, MAURO ANDRES", centro: "Taller" },
  { legajo: "1776", nombre: "JAIME, CARLOS JAVIER", centro: "Pta.Asfalto" },
  { legajo: "1802", nombre: "CERVILLA, JOSE MANUEL", centro: "Adm. Yerba Buena" },
  { legajo: "1889", nombre: "MONTEROS, ROBERTO DOMINGO", centro: "Pta.Asfalto" },
  { legajo: "1983", nombre: "CANGEMI, SERGIO DANIEL", centro: "Adm. Dpto Ingenieros" },
  { legajo: "1984", nombre: "CARRIZO, LUIS ORLANDO", centro: "Pavimentacion" },
  { legajo: "2014", nombre: "BARBOZA, DOMINGO GERONIMO", centro: "Predio Wargne" },
  { legajo: "2046", nombre: "GRAMAJO, NESTOR FABIAN", centro: "Infraest. Alderetes" },
  { legajo: "2057", nombre: "FLORES, JUAN CARLOS", centro: "Pavimentacion" },
  { legajo: "2120", nombre: "CASTAÑO, HUGO DIEGO", centro: "Asfalto" },
  { legajo: "2285", nombre: "LIMA MANUEL BERNABE", centro: "Asfalto" },
  { legajo: "2395", nombre: "JIMENEZ, PABLO SEBASTIAN", centro: "Country Pilar" },
  { legajo: "2405", nombre: "FRIAS, CARLOS JESUS", centro: "Infraest. Alderetes" },
  { legajo: "2430", nombre: "SANTILLAN, WALTER OMAR", centro: "Predio Wargne" },
  { legajo: "2489", nombre: "LLORENS, JULIO CESAR", centro: "Pavimentacion" },
  { legajo: "2506", nombre: "CASTAÑO, MARCOS MATIAS", centro: "Asfalto" },
  { legajo: "2514", nombre: "PEREYRA, PABLO ALEJANDRO", centro: "Trituradora" },
  { legajo: "2552", nombre: "PAREDES, JOSE MARTIRES", centro: "Ruta 357 - Quilmes" },
  { legajo: "2557", nombre: "GODOY, MARCOS DANIEL", centro: "Pta.Asfalto" },
  { legajo: "2561", nombre: "SANCHEZ, JOSE LUIS", centro: "Predio Wargne" },
  { legajo: "2642", nombre: "PEREZ, JUAN FERNANDO", centro: "Predio Wargne" },
  { legajo: "2653", nombre: "CAÑETE, LUCAS MATIAS", centro: "Ruta 357 - Quilmes" },
  { legajo: "2671", nombre: "TORRENTE, CARLOS MARCELO", centro: "Asfalto" },
  { legajo: "2684", nombre: "SOLIZ, FERNANDO ALBERTO", centro: "Adm. Yerba Buena" },
  { legajo: "2697", nombre: "DIAZ, LUIS IVAN", centro: "Ruta 357 - Quilmes" },
  { legajo: "2735", nombre: "ARAGON, SERGIO ANTONIO", centro: "Asfalto" },
  { legajo: "2744", nombre: "VERA, PATRICIA LILIANA", centro: "Maestranza" },
  { legajo: "2800", nombre: "RODRIGUEZ, SERGIO LUIS", centro: "Transporte" },
  { legajo: "2913", nombre: "PEREZ, ADRIAN ANTONIO", centro: "Predio Wargne" },
  { legajo: "2921", nombre: "CONCHA, ALFREDO FEDERICO", centro: "Pta.Asfalto" },
  { legajo: "2928", nombre: "COA, JORGE DAVID", centro: "Asfalto" },
  { legajo: "2947", nombre: "CASARES, NESTOR LEANDRO", centro: "Transporte" },
  { legajo: "2963", nombre: "JIMENEZ, MARIO GUSTAVO", centro: "Pta.Asfalto" },
  { legajo: "2996", nombre: "JIMENEZ, MIGUEL ALEJANDRO", centro: "Ruta 357 - Quilmes" },
  { legajo: "3000", nombre: "GUALINCHAY, DARIO ALBERTO", centro: "Asfalto" },
  { legajo: "3006", nombre: "SUAREZ, SEBASTIAN ERNESTO", centro: "Asfalto" },
  { legajo: "3010", nombre: "JAIME, JAVIER OSCAR", centro: "Taller" },
  { legajo: "3033", nombre: "SALAS, BENJAMIN JAVIER", centro: "Predio Wargne" },
  { legajo: "3064", nombre: "SALAS, MIGUEL GONZALO", centro: "Pavimentacion" },
  { legajo: "3103", nombre: "LINARES, JOSE SEGUNDO", centro: "Adm. Predio Warnes" },
  { legajo: "3128", nombre: "GALVEZ, FRANCISCO MATIAS", centro: "Taller" },
  { legajo: "3142", nombre: "NUÑEZ, JORGE ADRIAN", centro: "Asfalto" },
  { legajo: "3195", nombre: "ORELLANA, MAURO ELIO", centro: "Adm. Yerba Buena" },
  { legajo: "3216", nombre: "GONZALEZ, JORGE MARIO", centro: "Adm. Yerba Buena" },
  { legajo: "3267", nombre: "CORONEL, EDUARDO DARIO", centro: "Ruta 357 - Quilmes" },
  { legajo: "3293", nombre: "BOSSINI, JOSE SEBASTIAN", centro: "Adm. Yerba Buena" },
  { legajo: "3295", nombre: "GIL, MARIO ALEJANDRO", centro: "Serenos" },
  { legajo: "3298", nombre: "BROVIO, ROQUE ROBERTO", centro: "Serenos" },
  { legajo: "3337", nombre: "ALLENDE, MARIO ABELARDO", centro: "Adm. Yerba Buena" },
  { legajo: "3360", nombre: "SINGH, ALBERTO RUBEN DARIO", centro: "Adm. Dpto Ingenieros" },
  { legajo: "3365", nombre: "SIERRA, JOSE MARIA", centro: "Taller" },
  { legajo: "3422", nombre: "ROMERO, JUAN RAMON", centro: "Ruta 357 - Quilmes" },
  { legajo: "3462", nombre: "TALEVI, GONZALO DAVID", centro: "Adm. Yerba Buena" },
  { legajo: "3474", nombre: "LOPEZ, ROMINA HAYDEE", centro: "Adm. Yerba Buena" },
  { legajo: "3496", nombre: "REYES, ROBERTO MARCELO", centro: "Adm. Predio Warnes" },
  { legajo: "3508", nombre: "AUAD TANNOUS, CARLOS ALBERTO", centro: "Adm. Dpto Ingenieros" },
  { legajo: "3561", nombre: "MOYENTAL, JUAN ANGEL", centro: "Ruta 357 - Quilmes" },
  { legajo: "3565", nombre: "DE GREGORIO, AGUSTIN", centro: "Adm. Dpto Ingenieros" },
  { legajo: "3568", nombre: "ESTRADA RAMIREZ, BERNABE MARCE", centro: "Adm. Dpto Ingenieros" },
  { legajo: "3578", nombre: "LIMA, FRANCO RAFAEL", centro: "Asfalto" },
  { legajo: "3593", nombre: "AGUIRRE, CARLOS RAMON DARIO", centro: "Trituradora" },
  { legajo: "3599", nombre: "KONICEK, CARLOS GUILLERMO", centro: "Adm. Predio Warnes" },
  { legajo: "3621", nombre: "MONTERO, LUIS OMAR", centro: "Predio Wargne" },
  { legajo: "3632", nombre: "ACUÑA, WALTER DANIEL", centro: "Ruta 357 - Quilmes" },
  { legajo: "3635", nombre: "CASTILLO, RENE DARIO", centro: "Pta.Asfalto" },
  { legajo: "3680", nombre: "SUAREZ, GUSTAVO SILVANO", centro: "Ruta 357 - Quilmes" },
  { legajo: "3696", nombre: "MONTEROS, ALEXIS ROBERTO", centro: "Pta.Asfalto" },
  { legajo: "3754", nombre: "DE GREGORIO, FELIPE", centro: "Adm. Yerba Buena" },
  { legajo: "3766", nombre: "GRAMAJO, MATIAS ENRIQUE", centro: "Trituradora" },
  { legajo: "3791", nombre: "GOMEZ, HUMBERTO ARIEL", centro: "Cantera La Reduccion" },
  { legajo: "3836", nombre: "NUÑEZ, SANTIAGO ARIEL", centro: "Asfalto" },
  { legajo: "3837", nombre: "ROLDAN, SILVESTRE DANIEL", centro: "Serenos" },
  { legajo: "3846", nombre: "FIGUEROA, NAHUEL MATIAS", centro: "Pta.Asfalto" },
  { legajo: "3847", nombre: "ZELAYA, FRANCO NICOLAS", centro: "Asfalto" },
  { legajo: "3848", nombre: "ALMARAZ, DANIEL ALBERTO", centro: "Serenos" },
  { legajo: "3852", nombre: "PAZ, MARIO ENRIQUE", centro: "Serenos" },
  { legajo: "3854", nombre: "SORAIRE, JULIO ORLANDO", centro: "Pavimentacion" },
  { legajo: "3855", nombre: "ALMARAZ, FRANCO JONAS", centro: "Predio Wargne" },
  { legajo: "3878", nombre: "MAITA, LUIS ALBERTO", centro: "Serenos" },
  { legajo: "3879", nombre: "GONZALEZ, RAUL ALBERTO", centro: "Serenos" },
  { legajo: "3884", nombre: "MAITA, JOSE EVARISTO", centro: "Ruta 357 - Quilmes" },
  { legajo: "3885", nombre: "GALVAN, MAURICIO LUIS E.", centro: "Ruta 357 - Quilmes" },
  { legajo: "3886", nombre: "VELARDEZ, JOEL DARIO NAHUEL", centro: "Ruta 357 - Quilmes" },
  { legajo: "3888", nombre: "MONTERO, CARLOS AGUSTIN", centro: "Taller" },
  { legajo: "3893", nombre: "REYES, MARTIN GERARDO", centro: "Serenos" },
  { legajo: "3895", nombre: "CORDOBA, SILVIA DANIELA", centro: "Adm. Dpto Ingenieros" },
  { legajo: "3899", nombre: "GALLARDO, CLAUDIO ARMANDO", centro: "Asfalto" },
  { legajo: "3908", nombre: "ALMARAZ , MIGUEL", centro: "Serenos" },
  { legajo: "3909", nombre: "CEJAS , OSCAR ALBERTO", centro: "Serenos" },
  { legajo: "3910", nombre: "SIERRA , MARIO AGUSTIN", centro: "Pta.Asfalto" },
  { legajo: "3911", nombre: "VALENZUELA, JOSE ROBERTO", centro: "UOCRA" },
  { legajo: "3912", nombre: "ESPINOSA, JUAN ANTONIO", centro: "Ruta 357 - Quilmes" },
  { legajo: "3913", nombre: "PASTRANA, GUILLERMO ALEJANDRO", centro: "Ruta 357 - Quilmes" },
  { legajo: "3914", nombre: "DELGADO, CESAR EMANUEL", centro: "Ruta 357 - Quilmes" },
  { legajo: "3915", nombre: "AVALOS, LUCAS ADRIAN ALFREDO", centro: "Ruta 357 - Quilmes" },
  { legajo: "3916", nombre: "VELARDEZ, FELIX JONATHAN", centro: "Ruta 357 - Quilmes" },
  { legajo: "3917", nombre: "DALL ´AGATA , BRUNO NICOLAS", centro: "Adm. Predio Warnes" },
  { legajo: "3919", nombre: "NAVARRO CATA, ISMAEL NORBERTO", centro: "Ruta 357 - Quilmes" },
  { legajo: "3922", nombre: "ROMERO, CARLOS ALBERTO", centro: "Serenos" },
  { legajo: "3927", nombre: "MEDINA, RICARDO ALBERTO", centro: "Asfalto" },
  { legajo: "3928", nombre: "EZQUER , FACUNDO", centro: "Taller" },
  { legajo: "3929", nombre: "BARRIONUEVO, KEVIN RAMIRO", centro: "Taller" },
  { legajo: "3932", nombre: "BARROS, HECTOR LUIS", centro: "Adm. Dpto Ingenieros" },
  { legajo: "3933", nombre: "FABIAN, LEONARDO ANDRES", centro: "Ruta 357 - Quilmes" },
  { legajo: "3934", nombre: "GUERRERO HAMADA, GERARDO ANDRE", centro: "Adm. Predio Warnes" },
  { legajo: "3935", nombre: "ALBARRACIN, NELSON IVAN", centro: "Serenos" },
  { legajo: "3936", nombre: "GARCIA, GABRIEL ESTEBAN", centro: "Serenos" },
  { legajo: "3937", nombre: "GONZALEZ, LUIS ARMANDO", centro: "Ruta 357 - Quilmes" },
  { legajo: "3938", nombre: "CATA, MAICO EZEQUIEL", centro: "Ruta 357 - Quilmes" },
  { legajo: "3939", nombre: "GALLARDO, ARNALDO ARIEL", centro: "Asfalto" },
  { legajo: "3940", nombre: "GRANERO, HECTOR GUSTAVO", centro: "Transporte" },
  { legajo: "3941", nombre: "QUIROGA, AGUSTO ALEJANDRO", centro: "Trituradora" },
  { legajo: "3943", nombre: "LLAMPA, CAYETANO DANTE", centro: "Ruta 357 - Quilmes" },
  { legajo: "3944", nombre: "BARRIONUEVO ADET, ANA LUCIA", centro: "Adm. Predio Warnes" },
  { legajo: "3946", nombre: "ARAGON, SERGIO YAHIR", centro: "Asfalto" },
  { legajo: "3947", nombre: "CATA CRUZ, FERNANDO JESUS A.", centro: "Ruta 357 - Quilmes" },
  { legajo: "3948", nombre: "GUZMAN, SANTIAGO GABRIEL", centro: "Pta.Asfalto" },
  { legajo: "3949", nombre: "IBARRA, ALEXIS EMANUEL", centro: "Pta.Asfalto" },
  { legajo: "3950", nombre: "MAMANI , JORGE LUIS", centro: "Ruta 357 - Quilmes" },
  { legajo: "3951", nombre: "MAMANI, NAZARENO AMERICO", centro: "Ruta 357 - Quilmes" },
  { legajo: "3952", nombre: "PEREA, JONATHAN YVAN", centro: "Pavimentacion" },
  { legajo: "3953", nombre: "KATZ, JULIA", centro: "Adm. Terminal" },
  { legajo: "3954", nombre: "RASGIDO , DIEGO DANIEL", centro: "Ruta 357 - Quilmes" },
  { legajo: "3955", nombre: "BOYDO, FABIAN ANTONIO", centro: "Taller" },
  { legajo: "3956", nombre: "GONZALEZ, WAITIN CATRIEL", centro: "Ruta 357 - Quilmes" },
  { legajo: "3957", nombre: "RAMIREZ, JUAN MANUEL", centro: "Ruta 357 - Quilmes" },
  { legajo: "3958", nombre: "DIAZ, LUCAS DAMIAN", centro: "Pta.Asfalto" }
];


/** Índice de la nómina nueva por clave de legajo. */
function nominaPorLegajo_() {
  var map = {};
  NOMINA_NUEVA.forEach(function (o) { map[claveLegajo_(o.legajo)] = o; });
  return map;
}

/** Clasifica el cruce padrón vs nómina. No escribe nada. */
function clasificarReinicio_() {
  var data = leerPersonal_();
  var nom = nominaPorLegajo_();

  var mantienen = [], reingresos = [], altas = [], bajas = [];

  // Cada legajo de la nómina cae en mantiene / reingreso / alta.
  NOMINA_NUEVA.forEach(function (o) {
    var hit = data.porLegajo[claveLegajo_(o.legajo)];
    if (hit) {
      if (esSi_(hit.obj[P.ACTIVO])) mantienen.push(o);
      else reingresos.push(o);
    } else {
      altas.push(o);
    }
  });

  // Bajas: activos del padrón cuyo legajo no está en la nómina.
  data.filas.forEach(function (op) {
    if (!esSi_(op[P.ACTIVO])) return;
    if (nom[claveLegajo_(op[P.LEGAJO])]) return;
    bajas.push({ legajo: op[P.LEGAJO], nombre: op[P.NOMBRE] });
  });

  // Posibles typos: mismo nombre normalizado en altas y en bajas a la vez.
  var nombresBaja = {};
  bajas.forEach(function (b) { nombresBaja[normalizar_(b.nombre)] = b; });
  var typos = [];
  altas.forEach(function (a) {
    var b = nombresBaja[normalizar_(a.nombre)];
    if (b) typos.push({ nombre: a.nombre, legajoNomina: a.legajo, legajoPadron: b.legajo });
  });

  var activos = data.filas.filter(function (f) { return esSi_(f[P.ACTIVO]); }).length;
  return {
    totalPadron: data.filas.length, activos: activos,
    mantienen: mantienen, reingresos: reingresos, altas: altas, bajas: bajas, typos: typos
  };
}

/** PASO 1: preview. No cambia nada; escribe todo en el registro. */
function previewReinicioPadron() {
  var c = clasificarReinicio_();
  Logger.log('=== PREVIEW REINICIO PADRON (no se cambio nada) ===');
  Logger.log('Padron actual: %s filas (%s activos, %s inactivos)', c.totalPadron, c.activos, c.totalPadron - c.activos);
  Logger.log('Nomina nueva: %s operarios', NOMINA_NUEVA.length);
  Logger.log('SE MANTIENEN (ya activos, en ambos): %s', c.mantienen.length);
  Logger.log('REINGRESOS (existian inactivos, se reactivan): %s', c.reingresos.length);
  c.reingresos.forEach(function (o) { Logger.log('   reingreso ' + o.legajo + ' ' + o.nombre); });
  Logger.log('ALTAS NUEVAS (talles vacios): %s', c.altas.length);
  c.altas.forEach(function (o) { Logger.log('   alta ' + o.legajo + ' ' + o.nombre); });
  Logger.log('BAJAS (activos que no estan en la nomina -> ACTIVO=NO): %s', c.bajas.length);
  c.bajas.forEach(function (o) { Logger.log('   baja ' + o.legajo + ' ' + o.nombre); });
  if (c.typos.length) {
    Logger.log('*** POSIBLES TYPOS DE LEGAJO (mismo nombre en alta y baja): %s ***', c.typos.length);
    c.typos.forEach(function (t) { Logger.log('   ' + t.nombre + ' -> nomina legajo ' + t.legajoNomina + ' vs padron legajo ' + t.legajoPadron); });
  } else {
    Logger.log('Sin posibles typos de legajo detectados.');
  }
  return c;
}

/**
 * Agrega a LISTAS (columna CENTRO DE COSTO = D) los centros de la nómina que
 * todavía no estén, para que la validación de datos de PERSONAL los acepte.
 * Devuelve la lista de centros agregados. Idempotente (compara normalizado).
 */
function asegurarCentrosEnListas_() {
  var sh = requireSheet_(SHEETS.LISTAS);
  var COL = 4; // CENTRO DE COSTO
  var alto = Math.max(sh.getMaxRows() - 1, 1);
  var colVals = sh.getRange(2, COL, alto, 1).getValues();
  var set = {};
  var ultimaConDato = 1; // fila 1 = encabezado
  for (var i = 0; i < colVals.length; i++) {
    var v = String(colVals[i][0] || '').trim();
    if (v) { set[normalizar_(v)] = true; ultimaConDato = i + 2; }
  }
  var faltan = [];
  NOMINA_NUEVA.forEach(function (o) {
    var c = String(o.centro || '').trim();
    if (!c) return;
    var k = normalizar_(c);
    if (set[k]) return;
    set[k] = true;
    faltan.push(c);
  });
  if (faltan.length) {
    sh.getRange(ultimaConDato + 1, COL, faltan.length, 1)
      .setValues(faltan.map(function (c) { return [c]; }));
  }
  return faltan;
}

/** PASO 2: aplica. Hace backup, actualiza/crea desde la nomina y da de baja al resto. */
function aplicarReinicioPadron() {
  var ss = getSpreadsheet_();
  var hojaPersonal = requireSheet_(SHEETS.PERSONAL);

  // 1) Backup de PERSONAL.
  var d = new Date();
  var stamp = d.getFullYear() + ('0' + (d.getMonth() + 1)).slice(-2) + ('0' + d.getDate()).slice(-2) + '_' +
    ('0' + d.getHours()).slice(-2) + ('0' + d.getMinutes()).slice(-2) + ('0' + d.getSeconds()).slice(-2);
  var nombreBackup = 'PERSONAL_BACKUP_' + stamp;
  hojaPersonal.copyTo(ss).setName(nombreBackup);
  Logger.log('Backup creado: ' + nombreBackup);

  // 1.b) Los centros de la nómina deben existir en LISTAS o la validación de
  // datos de la columna CENTRO DE COSTO rechaza la escritura. Se agregan los que
  // falten (así también aparecen en el desplegable de la app).
  var centrosAgregados = asegurarCentrosEnListas_();
  Logger.log('Centros nuevos agregados a LISTAS: ' + centrosAgregados.length +
    (centrosAgregados.length ? ' (' + centrosAgregados.join(', ') + ')' : ''));

  var nom = nominaPorLegajo_();
  var data = leerPersonal_();
  var colNombre = colPorHeader_(data.headers, P.NOMBRE);
  var colCentro = colPorHeader_(data.headers, P.CENTRO);
  var colActivo = colPorHeader_(data.headers, P.ACTIVO);

  var mantenidos = 0, reingresos = 0, altas = 0, bajas = 0;

  // 2) Nomina -> actualizar existentes (conservando talles) / crear altas.
  NOMINA_NUEVA.forEach(function (o) {
    var hit = data.porLegajo[claveLegajo_(o.legajo)];
    if (hit) {
      if (colNombre) data.hoja.getRange(hit.fila, colNombre).setValue(o.nombre);
      if (colCentro) data.hoja.getRange(hit.fila, colCentro).setValue(o.centro);
      var eraActivo = esSi_(hit.obj[P.ACTIVO]);
      if (colActivo) data.hoja.getRange(hit.fila, colActivo).setValue('SÍ');
      if (eraActivo) mantenidos++; else reingresos++;
    } else {
      appendFilaPorHeader_(SHEETS.PERSONAL, {
        'LEGAJO': o.legajo, 'APELLIDO Y NOMBRE': o.nombre, 'CENTRO DE COSTO': o.centro, 'ACTIVO': 'SÍ'
      });
      altas++;
    }
  });

  // 3) Bajas: activos del padron que no estan en la nomina -> ACTIVO=NO.
  data.filas.forEach(function (op, i) {
    if (!esSi_(op[P.ACTIVO])) return;
    if (nom[claveLegajo_(op[P.LEGAJO])]) return;
    data.hoja.getRange(data.indiceFila[i], colActivo).setValue('NO');
    bajas++;
  });

  Logger.log('=== REINICIO APLICADO ===');
  Logger.log('Mantenidos: ' + mantenidos + ' | Reingresos: ' + reingresos + ' | Altas: ' + altas + ' | Bajas: ' + bajas);
  Logger.log('Backup: ' + nombreBackup);
  return { mantenidos: mantenidos, reingresos: reingresos, altas: altas, bajas: bajas, backup: nombreBackup };
}
