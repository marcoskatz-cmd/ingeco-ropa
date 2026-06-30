/**
 * Auth.gs — Acceso por un único PIN y sesión por token firmado. Aunque el
 * Web App se publique anónimo, sin el PIN correcto no se hace nada.
 *
 * El PIN se guarda como hash (salt$hash) en CONFIG (pin_acceso_hash). El token
 * lleva una identidad fija "Compras" para la trazabilidad (quién congeló/registró).
 */

var TOKEN_TTL_MS = 8 * 60 * 60 * 1000; // 8 horas
var HASH_ITER = 10000;
var PROP_SECRET = 'TOKEN_SECRET';
var IDENTIDAD_FIJA = 'Compras'; // única identidad en tokens e Historial

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

/** Valida el PIN de acceso contra CONFIG y devuelve un token (identidad "Compras"). */
function loginPin_(pin) {
  var hash = getPinHash_();
  if (!hash) {
    throw new Error('El sistema no tiene PIN configurado. Ejecutá inicializarSistema().');
  }
  if (!verifyPin_(pin, hash)) {
    throw new Error('PIN incorrecto.');
  }
  return { ok: true, token: emitirToken_(IDENTIDAD_FIJA), nombre: IDENTIDAD_FIJA };
}

/** Cambia el PIN de acceso. Sólo accesible desde una sesión válida. */
function cambiarPinAcceso_(pinNuevo) {
  if (!/^\d{4}$/.test(String(pinNuevo))) {
    throw new Error('El PIN debe tener 4 dígitos.');
  }
  escribirConfig_(PARAM.PIN_HASH, hashPin_(pinNuevo));
  return { ok: true };
}
