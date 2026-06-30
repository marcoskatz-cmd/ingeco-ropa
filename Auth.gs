/**
 * Auth.gs — Login por PIN y sesión por token firmado. Independiente del nivel
 * de acceso de Google del Web App: aunque el deploy sea anónimo, sin PIN válido
 * no se hace nada.
 *
 * USUARIOS: NOMBRE | PIN_HASH (formato salt$hash) | ACTIVO. El token identifica
 * al usuario para la trazabilidad (quién registró/congeló cada cosa).
 */

var TOKEN_TTL_MS = 8 * 60 * 60 * 1000; // 8 horas
var HASH_ITER = 10000;
var PROP_SECRET = 'TOKEN_SECRET';

/* ----------------------------- Hash de PIN ----------------------------- */

function hashPin_(pin) {
  var salt = Utilities.getUuid().replace(/-/g, '');
  return salt + '$' + _hashConSalt_(String(pin), salt);
}

function verifyPin_(pin, almacenado) {
  if (!almacenado || String(almacenado).indexOf('$') < 0) return false;
  var parts = String(almacenado).split('$');
  var salt = parts[0];
  var esperado = parts[1];
  return _hashConSalt_(String(pin), salt) === esperado;
}

function _hashConSalt_(pin, salt) {
  var v = salt + '|' + pin;
  for (var i = 0; i < HASH_ITER; i++) {
    var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + v);
    v = _bytesAHex_(bytes);
  }
  return v;
}

function _bytesAHex_(bytes) {
  var s = '';
  for (var i = 0; i < bytes.length; i++) {
    var b = (bytes[i] + 256) % 256;
    s += (b < 16 ? '0' : '') + b.toString(16);
  }
  return s;
}

/* ----------------------------- Token ----------------------------- */

function getSecret_() {
  var props = PropertiesService.getScriptProperties();
  var s = props.getProperty(PROP_SECRET);
  if (!s) {
    s = Utilities.getUuid() + Utilities.getUuid();
    props.setProperty(PROP_SECRET, s);
  }
  return s;
}

function emitirToken_(nombre) {
  var payload = { u: nombre, exp: Date.now() + TOKEN_TTL_MS };
  var b64 = Utilities.base64EncodeWebSafe(JSON.stringify(payload));
  return b64 + '.' + _firmar_(b64);
}

function _firmar_(b64) {
  var sig = Utilities.computeHmacSha256Signature(b64, getSecret_());
  return Utilities.base64EncodeWebSafe(sig);
}

/** Valida el token; devuelve { nombre } o lanza. */
function validarToken_(token) {
  if (!token || String(token).indexOf('.') < 0) throw new Error('Sesión inválida. Volvé a entrar.');
  var parts = String(token).split('.');
  var b64 = parts[0];
  var sig = parts[1];
  if (_firmar_(b64) !== sig) throw new Error('Sesión inválida. Volvé a entrar.');
  var payload = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(b64)).getDataAsString());
  if (!payload.exp || Date.now() > payload.exp) throw new Error('Tu sesión venció. Volvé a entrar.');
  return { nombre: payload.u };
}

/* ----------------------------- Login ----------------------------- */

/** Valida nombre + PIN contra USUARIOS y devuelve un token. */
function loginConPin_(nombre, pin) {
  var objetivo = normalizar_(nombre);
  var data = leerObjetos_(SHEETS.USUARIOS);
  for (var i = 0; i < data.filas.length; i++) {
    var f = data.filas[i];
    if (normalizar_(f[U.NOMBRE]) === objetivo && esSi_(f[U.ACTIVO])) {
      if (verifyPin_(pin, f[U.PIN])) {
        return { ok: true, token: emitirToken_(f[U.NOMBRE]), nombre: f[U.NOMBRE] };
      }
      break;
    }
  }
  throw new Error('Nombre o PIN incorrecto.');
}

/** Lista de nombres activos para poblar el selector de login. */
function listarNombresLogin_() {
  var data = leerObjetos_(SHEETS.USUARIOS);
  return data.filas
    .filter(function (f) { return esSi_(f[U.ACTIVO]); })
    .map(function (f) { return f[U.NOMBRE]; });
}

/* ------------------------- Gestión de usuarios ------------------------- */

function crearUsuario_(nombre, pin) {
  if (!nombre || !/^\d{4}$/.test(String(pin))) {
    throw new Error('Nombre y PIN de 4 dígitos son obligatorios.');
  }
  var existentes = leerObjetos_(SHEETS.USUARIOS);
  var objetivo = normalizar_(nombre);
  for (var i = 0; i < existentes.filas.length; i++) {
    if (normalizar_(existentes.filas[i][U.NOMBRE]) === objetivo) {
      throw new Error('Ya existe un usuario con ese nombre.');
    }
  }
  appendFilaPorHeader_(SHEETS.USUARIOS, {
    'NOMBRE': nombre, 'PIN_HASH': hashPin_(pin), 'ACTIVO': 'SÍ'
  });
  return { ok: true };
}

function cambiarPin_(nombre, pinNuevo) {
  if (!/^\d{4}$/.test(String(pinNuevo))) throw new Error('El PIN debe tener 4 dígitos.');
  var data = leerObjetos_(SHEETS.USUARIOS);
  var colPin = colPorHeader_(data.headers, U.PIN);
  for (var i = 0; i < data.filas.length; i++) {
    if (normalizar_(data.filas[i][U.NOMBRE]) === normalizar_(nombre)) {
      data.hoja.getRange(data.indiceFila[i], colPin).setValue(hashPin_(pinNuevo));
      return { ok: true };
    }
  }
  throw new Error('Usuario no encontrado.');
}
