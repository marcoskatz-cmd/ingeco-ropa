# Auth PIN único — Implementation Plan (Fase 1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar el login multi-usuario (selector de nombres + PIN contra la hoja USUARIOS) por un único PIN de acceso guardado como hash en CONFIG, con identidad fija "Compras".

**Architecture:** El PIN vive como un parámetro más en la hoja CONFIG (`pin_acceso_hash`, formato `salt$hash`). `loginPin_(pin)` lo valida y emite el mismo token HMAC que ya existe, con `u = "Compras"`. Se elimina la hoja USUARIOS del modelo de datos y las cuatro funciones de gestión de usuarios. El frontend pierde el desplegable de nombres: queda un solo campo PIN. La firma/validación de tokens (`emitirToken_`, `validarToken_`, `getSecret_`, `hashPin_`, `verifyPin_`) no se toca.

**Tech Stack:** Google Apps Script (V8) + Google Sheets como DB. Frontend HtmlService (index.html + Estilos.html + App.html con `include()`). Sin build system; los bundles `CODIGO_COMPLETO.txt` / `HTML_COMPLETO.txt` se pegan en el editor para desplegar.

---

## Nota de verificación (este codebase NO tiene test runner local)

Apps Script corre `PropertiesService`, `SpreadsheetApp`, `Utilities` sólo en el runtime de Google. No hay `pytest`/`vitest` posible en la PC. Por eso la cadencia de verificación de este plan es:

1. **`node --check <archivo>.gs`** — gate de sintaxis después de cada edición de backend. (Apps Script es JS; `node --check` valida que parsea. No ejecuta nada de GAS.)
2. **Corrida manual en el editor de Apps Script** — para comportamiento. Cada tarea que toca lógica deja una función `_probar...()` temporal que se corre desde el editor y se mira el `Logger.log`. Esa función se borra al final (Tarea 7).
3. **Prueba end-to-end en el Web App desplegado** — pegar bundles, reinicializar, abrir la URL, loguear con PIN.

`node --check` **no** sirve para `App.html`/`index.html` (son HTML, no JS puro). Esos se verifican por inspección y en la prueba E2E.

---

## File Structure

Archivos que toca la Fase 1 (todos ya existen salvo `build_bundles.js`):

- `Config.gs` — agrega `PARAM.PIN_HASH`, helpers `getPinHash_` / `escribirConfig_`; quita `SHEETS.USUARIOS`.
- `Auth.gs` — agrega `loginPin_` / `cambiarPinAcceso_` + constante `IDENTIDAD_FIJA`; elimina `loginConPin_`, `listarNombresLogin_`, `crearUsuario_`, `cambiarPin_`.
- `Api.gs` — dispatcher: `METODOS_PUBLICOS = { loginPin: true }`; rutea `loginPin` / `cambiarPinAcceso`; quita rutas viejas.
- `Schema.gs` — quita `COLS.USUARIOS` y el símbolo `U`.
- `Setup.gs` — quita `ensureHoja_(USUARIOS)` y `sembrarUsuarioAdmin_`; agrega `sembrarPinAcceso_`.
- `index.html` — quita el `<label>` "Usuario" con `<select id="loginNombre">`.
- `App.html` — reescribe `hacerLogin()`, elimina `initLogin()`, ajusta el arranque.
- `build_bundles.js` — **nuevo**: regenera `CODIGO_COMPLETO.txt` y `HTML_COMPLETO.txt` desde las fuentes (deploy prep reproducible).

**Orden de las tareas (dependencias):** Config (helpers) → Auth (usa los helpers) → Api (rutea Auth) → quita hoja USUARIOS (Schema+Config+Setup juntos) → index.html → App.html → bundles + E2E.

---

### Task 1: Config.gs — helper de lectura/escritura del PIN en CONFIG

**Files:**
- Modify: `Config.gs` (agrega `PARAM.PIN_HASH`, `getPinHash_`, `escribirConfig_`)

- [ ] **Step 1: Agregar la clave `PIN_HASH` al objeto `PARAM`**

En `Config.gs`, el objeto `PARAM` (líneas 27-33) queda así (se agrega la última línea):

```javascript
// Claves de parámetros en la hoja CONFIG.
var PARAM = {
  VIDA_UTIL: 'vida_util_meses',
  CADENCIA: 'cadencia_meses',
  TECHO: 'techo_meses',
  FECHA_ANCLA: 'fecha_ancla_corrida',
  DIAS_PREVISION: 'dias_prevision',
  PIN_HASH: 'pin_acceso_hash'
};
```

- [ ] **Step 2: Agregar `getPinHash_` y `escribirConfig_` al final de la sección CONFIG**

En `Config.gs`, justo después de `getFechaAncla_()` (termina en la línea 109, antes del comentario `/* ----------------------------- LISTAS ----------------------------- */`), insertar:

```javascript
/** Hash del PIN de acceso (formato salt$hash), o '' si todavía no se sembró. */
function getPinHash_() {
  var v = getConfigMap_()[PARAM.PIN_HASH];
  return v ? String(v) : '';
}

/**
 * Upsert de un parámetro en CONFIG (columnas PARAMETRO / VALOR). Si la clave
 * existe reescribe su VALOR; si no, agrega una fila al final. Invalida la cache
 * de execution para que la próxima lectura vea el valor nuevo.
 */
function escribirConfig_(clave, valor) {
  var sh = requireSheet_(SHEETS.CONFIG);
  var data = sh.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0] || '').trim() === clave) {
      sh.getRange(i + 1, 2).setValue(valor);
      invalidarCache_();
      return;
    }
  }
  sh.appendRow([clave, valor, '']);
  invalidarCache_();
}
```

- [ ] **Step 3: Verificar sintaxis**

Run: `node --check Config.gs`
Expected: sin salida (exit 0). Si imprime un `SyntaxError`, revisar llaves/comas.

- [ ] **Step 4: Commit**

```bash
git add Config.gs
git commit -m "feat(auth): helper de PIN de acceso en CONFIG (getPinHash_/escribirConfig_)"
```

---

### Task 2: Auth.gs — login por PIN único + cambio de PIN

**Files:**
- Modify: `Auth.gs` (agrega `IDENTIDAD_FIJA`, `loginPin_`, `cambiarPinAcceso_`; elimina `loginConPin_`, `listarNombresLogin_`, `crearUsuario_`, `cambiarPin_`)

- [ ] **Step 1: Actualizar el comentario de cabecera y agregar la constante de identidad**

En `Auth.gs`, reemplazar el bloque de comentario inicial + las constantes (líneas 1-12) por:

```javascript
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
```

- [ ] **Step 2: Reemplazar todo el bloque de Login + gestión de usuarios**

En `Auth.gs`, borrar desde el comentario `/* ----------------------------- Login ----------------------------- */` (línea 82) hasta el final del archivo (línea 139, fin de `cambiarPin_`) y reemplazarlo por:

```javascript
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
```

> Nota: `hashPin_`, `verifyPin_`, `_hashConSalt_`, `_bytesAHex_`, `getSecret_`, `emitirToken_`, `_firmar_`, `validarToken_` (líneas 14-80) **no se tocan**.

- [ ] **Step 3: Verificar sintaxis**

Run: `node --check Auth.gs`
Expected: sin salida (exit 0).

- [ ] **Step 4: Confirmar que ya no quedan referencias a USUARIOS ni a `U.` en Auth.gs**

Run: `node --check Auth.gs` ya pasó. Buscar referencias muertas con el editor o con grep del IDE: `loginConPin_`, `listarNombresLogin_`, `crearUsuario_`, `cambiarPin_`, `SHEETS.USUARIOS`, `U.NOMBRE` deben dar 0 resultados dentro de `Auth.gs`.
Expected: 0 coincidencias en `Auth.gs`.

- [ ] **Step 5: Commit**

```bash
git add Auth.gs
git commit -m "feat(auth): loginPin_ y cambiarPinAcceso_; elimina login multi-usuario"
```

---

### Task 3: Api.gs — dispatcher con PIN único

**Files:**
- Modify: `Api.gs` (`METODOS_PUBLICOS` + rutas en `enrutar_`)

- [ ] **Step 1: Cambiar el set de métodos públicos**

En `Api.gs`, reemplazar la línea 13:

```javascript
// Métodos que NO requieren token (pantalla de login).
var METODOS_PUBLICOS = { login: true, listarNombresLogin: true };
```

por:

```javascript
// Métodos que NO requieren token (pantalla de login).
var METODOS_PUBLICOS = { loginPin: true };
```

- [ ] **Step 2: Actualizar las rutas de pre-login y de sesión/usuarios**

En `Api.gs`, dentro de `enrutar_`, reemplazar este bloque (líneas 32-39):

```javascript
    // --- Pre-login ---
    case 'login': return loginConPin_(p.nombre, p.pin);
    case 'listarNombresLogin': return listarNombresLogin_();

    // --- Sesión / usuarios ---
    case 'sesion': return { nombre: usuario };
    case 'cambiarPin': return cambiarPin_(usuario, p.pinNuevo);
    case 'crearUsuario': return crearUsuario_(p.nombre, p.pin);
```

por:

```javascript
    // --- Pre-login ---
    case 'loginPin': return loginPin_(p.pin);

    // --- Sesión / PIN ---
    case 'sesion': return { nombre: usuario };
    case 'cambiarPinAcceso': return cambiarPinAcceso_(p.pinNuevo);
```

- [ ] **Step 3: Verificar sintaxis**

Run: `node --check Api.gs`
Expected: sin salida (exit 0).

- [ ] **Step 4: Commit**

```bash
git add Api.gs
git commit -m "feat(auth): dispatcher rutea loginPin/cambiarPinAcceso, quita rutas de usuarios"
```

---

### Task 4: Eliminar la hoja USUARIOS del modelo de datos

**Files:**
- Modify: `Schema.gs` (quita `COLS.USUARIOS` y `var U`)
- Modify: `Config.gs` (quita `SHEETS.USUARIOS`)
- Modify: `Setup.gs` (quita `ensureHoja_(USUARIOS)` + `sembrarUsuarioAdmin_`; agrega `sembrarPinAcceso_`)

- [ ] **Step 1: Schema.gs — quitar la fila `USUARIOS` de `COLS`**

En `Schema.gs`, borrar estas líneas del objeto `COLS` (líneas 14-15, incluida la línea en blanco que las separa):

```javascript
  USUARIOS: ['NOMBRE', 'PIN_HASH', 'ACTIVO'],

```

(Quedan `CONFIG`, `LISTAS`, `PERSONAL`, `ENTREGAS`, `PROVEEDORES`, `HISTORIAL`.)

- [ ] **Step 2: Schema.gs — quitar el símbolo `U`**

En `Schema.gs`, borrar la línea 52:

```javascript
var U = { NOMBRE: 'NOMBRE', PIN: 'PIN_HASH', ACTIVO: 'ACTIVO' };
```

- [ ] **Step 3: Config.gs — quitar `USUARIOS` de `SHEETS`**

En `Config.gs`, borrar la línea 13 del objeto `SHEETS`:

```javascript
  USUARIOS: 'USUARIOS',
```

(`SHEETS` queda con CONFIG, LISTAS, PERSONAL, ENTREGAS, PROVEEDORES, HISTORIAL.)

- [ ] **Step 4: Setup.gs — quitar el `ensureHoja_` de USUARIOS**

En `Setup.gs`, borrar la línea 20:

```javascript
  ensureHoja_(ss, SHEETS.USUARIOS, COLS.USUARIOS);
```

- [ ] **Step 5: Setup.gs — cambiar la semilla de admin por semilla de PIN**

En `Setup.gs`, reemplazar la llamada `sembrarUsuarioAdmin_(ss);` (línea 31) por:

```javascript
  sembrarPinAcceso_(ss);
```

Y reemplazar la función `sembrarUsuarioAdmin_` completa (líneas 134-138):

```javascript
function sembrarUsuarioAdmin_(ss) {
  var sh = ss.getSheetByName(SHEETS.USUARIOS);
  if (sh.getLastRow() > 1) return;
  sh.getRange(2, 1, 1, 3).setValues([['Administrador', hashPin_('1234'), 'SÍ']]);
}
```

por:

```javascript
/**
 * Siembra el PIN de acceso (hash) en CONFIG si todavía no está. PIN inicial 1234.
 * Idempotente e independiente de sembrarConfig_: en una DB ya inicializada
 * (donde sembrarConfig_ corta temprano) igual agrega el PIN si falta.
 */
function sembrarPinAcceso_(ss) {
  var sh = ss.getSheetByName(SHEETS.CONFIG);
  var data = sh.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0] || '').trim() === PARAM.PIN_HASH) return; // ya configurado
  }
  sh.appendRow([PARAM.PIN_HASH, hashPin_('1234'),
    'Hash del PIN de acceso (salt$hash). Cambialo desde Ajustes. NO compartir ni borrar.']);
}
```

- [ ] **Step 6: Verificar sintaxis de los tres archivos**

Run: `node --check Schema.gs && node --check Config.gs && node --check Setup.gs`
Expected: sin salida (exit 0) en los tres.

- [ ] **Step 7: Confirmar que no quedan referencias colgadas a USUARIOS/`U.`/`sembrarUsuarioAdmin_`**

Buscar en TODO el proyecto (`*.gs`): `SHEETS.USUARIOS`, `COLS.USUARIOS`, `sembrarUsuarioAdmin_`, `\bU\.` deben dar 0 resultados.
Expected: 0 coincidencias. (Si aparece alguna, es código muerto que quedó de una tarea anterior — eliminarla.)

- [ ] **Step 8: Commit**

```bash
git add Schema.gs Config.gs Setup.gs
git commit -m "feat(auth): elimina hoja USUARIOS; siembra pin_acceso_hash en CONFIG"
```

---

### Task 5: index.html — quitar el selector de usuario

**Files:**
- Modify: `index.html` (elimina el `<label>` "Usuario")

- [ ] **Step 1: Borrar el bloque del desplegable de nombres**

En `index.html`, borrar estas líneas (14-17):

```html
      <label class="campo">
        <span>Usuario</span>
        <select id="loginNombre"></select>
      </label>
```

La tarjeta de login queda: logo, subtítulo, el `<label>` del PIN, el botón Entrar, y el `<div id="loginError">`. El resto del archivo no cambia.

- [ ] **Step 2: Verificar por inspección**

Abrir `index.html` y confirmar que ya no existe `loginNombre` y que el primer (y único) campo del login es el PIN (`<input id="loginPin" ...>`).
Expected: 0 ocurrencias de `loginNombre` en `index.html`.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat(auth): login sin desplegable de usuario (solo PIN)"
```

---

### Task 6: App.html — login por PIN, sin `initLogin`

**Files:**
- Modify: `App.html` (`hacerLogin`, eliminar `initLogin`, ajustar arranque)

- [ ] **Step 1: Eliminar `initLogin()` y reescribir `hacerLogin()`**

En `App.html`, reemplazar el bloque de la sección Login (líneas 114-145, desde el comentario `/* ===================== Login ===================== */` hasta el cierre de `hacerLogin`) por:

```javascript
  /* ===================== Login ===================== */
  function mostrarLoginError(msg) {
    var d = $('loginError');
    d.textContent = msg;
    d.classList.remove('oculto');
  }
  function hacerLogin() {
    var pin = $('loginPin').value;
    $('loginError').classList.add('oculto');
    if (!pin) { mostrarLoginError('Escribí el PIN.'); return; }
    $('btnLogin').disabled = true;
    rawCall('loginPin', { pin: pin }).then(function (res) {
      S.token = res.token;
      S.usuario = res.nombre;
      try { sessionStorage.setItem('ropa_token', res.token); sessionStorage.setItem('ropa_user', res.nombre); } catch (e) {}
      iniciarApp();
    }).catch(function (e) {
      $('btnLogin').disabled = false;
      mostrarLoginError(e.message);
    });
  }
```

> Esto borra `initLogin()` (que llamaba a `listarNombresLogin`) y saca la lectura de `loginNombre` de `hacerLogin`. La función `salir()` que viene justo después (líneas 146-153) no cambia.

- [ ] **Step 2: Ajustar el arranque para que no llame a `initLogin`**

En `App.html`, en el bloque `DOMContentLoaded` (cerca de la línea 812), reemplazar:

```javascript
    if (tok) { S.token = tok; S.usuario = usr || ''; iniciarApp(); }
    else { initLogin(); }
```

por:

```javascript
    if (tok) { S.token = tok; S.usuario = usr || ''; iniciarApp(); }
    else { $('loginPin').focus(); }
```

- [ ] **Step 3: Confirmar que no quedan referencias a `initLogin` ni `loginNombre` ni `'login'`**

Buscar en `App.html`: `initLogin`, `loginNombre`, `listarNombresLogin`, y la llamada `rawCall('login'` (con la coma) deben dar 0 resultados. (El `$('login')` del div sigue existiendo y está bien.)
Expected: 0 coincidencias de `initLogin`, `loginNombre`, `listarNombresLogin`; la única llamada de login es `rawCall('loginPin'`.

- [ ] **Step 4: Commit**

```bash
git add App.html
git commit -m "feat(auth): frontend usa loginPin (un solo campo), elimina initLogin"
```

---

### Task 7: Regenerar bundles + prueba end-to-end

**Files:**
- Create: `build_bundles.js`
- Regenerate: `CODIGO_COMPLETO.txt`, `HTML_COMPLETO.txt`

- [ ] **Step 1: Crear `build_bundles.js`**

Crear `build_bundles.js` en la raíz del repo con este contenido exacto:

```javascript
/**
 * build_bundles.js — Regenera los bundles para pegar en el editor de Apps Script.
 *
 *   CODIGO_COMPLETO.txt  = todos los .gs concatenados (un solo archivo de backend).
 *   HTML_COMPLETO.txt    = index.html con los include() de Estilos y App expandidos.
 *
 * Uso:  node build_bundles.js   (sin dependencias). Correr antes de desplegar.
 */
const fs = require('fs');
const path = require('path');
const DIR = __dirname;

const ORDEN_GS = [
  'Config', 'Util', 'Schema', 'Setup', 'Auth', 'Personal', 'Entregas',
  'Calculo', 'Corrida', 'Pedido', 'Proveedores', 'CruceRRHH', 'Historial',
  'Roturas', 'Api', 'Main', 'Seed'
];

function hoyISO() {
  const d = new Date();
  const p = (n) => (n < 10 ? '0' : '') + n;
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

function buildCodigo() {
  const cabecera =
    '/* ============================================================\n' +
    ' * INGECO Ropa - CODIGO COMPLETO (todos los .gs en un archivo)\n' +
    ' *\n' +
    ' * Pega TODO esto en un unico archivo .gs del editor de Apps Script\n' +
    ' * (por ej. el "Codigo.gs" por defecto). Es el backend entero.\n' +
    ' *\n' +
    ' * Aparte van como archivos separados (no entran en un .gs):\n' +
    ' *   - 3 HTML: index, Estilos, App  (Archivo > Nuevo > HTML)\n' +
    ' *   - appsscript.json (manifiesto del proyecto)\n' +
    ' *\n' +
    ' * Generado ' + hoyISO() + '.\n' +
    ' * Orden: ' + ORDEN_GS.join(', ') + '\n' +
    ' * ============================================================ */\n';

  const partes = ORDEN_GS.map((nombre) => {
    const src = fs.readFileSync(path.join(DIR, nombre + '.gs'), 'utf8');
    const banner =
      '/* ================================================================\n' +
      '   ' + nombre + '.gs\n' +
      '   ================================================================ */\n';
    return banner + '\n' + src.replace(/\s*$/, '') + '\n';
  });

  fs.writeFileSync(
    path.join(DIR, 'CODIGO_COMPLETO.txt'),
    cabecera + '\n\n' + partes.join('\n') + '\n',
    'utf8'
  );
  console.log('CODIGO_COMPLETO.txt: ' + ORDEN_GS.length + ' archivos .gs');
}

function buildHtml() {
  let index = fs.readFileSync(path.join(DIR, 'index.html'), 'utf8');
  const estilos = fs.readFileSync(path.join(DIR, 'Estilos.html'), 'utf8').replace(/\s*$/, '');
  const app = fs.readFileSync(path.join(DIR, 'App.html'), 'utf8').replace(/\s*$/, '');
  index = index.replace(/<\?!=\s*include\('Estilos'\);?\s*\?>/, estilos);
  index = index.replace(/<\?!=\s*include\('App'\);?\s*\?>/, app);
  fs.writeFileSync(path.join(DIR, 'HTML_COMPLETO.txt'), index, 'utf8');
  console.log('HTML_COMPLETO.txt: index + Estilos + App');
}

buildCodigo();
buildHtml();
console.log('Bundles regenerados.');
```

- [ ] **Step 2: Verificar sintaxis del generador**

Run: `node --check build_bundles.js`
Expected: sin salida (exit 0).

- [ ] **Step 3: Regenerar los bundles**

Run: `node build_bundles.js`
Expected:
```
CODIGO_COMPLETO.txt: 17 archivos .gs
HTML_COMPLETO.txt: index + Estilos + App
Bundles regenerados.
```

- [ ] **Step 4: Confirmar que los bundles reflejan el código nuevo**

Buscar en `CODIGO_COMPLETO.txt`: debe contener `function loginPin_` y `function cambiarPinAcceso_`, y NO debe contener `function loginConPin_` ni `function listarNombresLogin_` ni `sembrarUsuarioAdmin_`.
Buscar en `HTML_COMPLETO.txt`: debe contener `rawCall('loginPin'` y NO debe contener `loginNombre` ni `initLogin`.
Expected: las cuatro condiciones se cumplen.

- [ ] **Step 5: Commit del generador + bundles**

```bash
git add build_bundles.js CODIGO_COMPLETO.txt HTML_COMPLETO.txt
git commit -m "build: generador de bundles + bundles regenerados con auth PIN único"
```

- [ ] **Step 6: Desplegar y reinicializar (manual, en el editor de Apps Script)**

1. Pegar `CODIGO_COMPLETO.txt` en el archivo `.gs` único del proyecto. Pegar `index.html` / `Estilos.html` / `App.html` en sus respectivos archivos HTML (o usar `HTML_COMPLETO.txt` como referencia de un solo archivo).
2. **Correr `inicializarSistema()` una vez.** Esto: (a) borra la hoja USUARIOS huérfana vía `limpiarHojasExtra_` (ya no está en `SHEETS`); (b) agrega la fila `pin_acceso_hash` a CONFIG con el PIN inicial **1234** vía `sembrarPinAcceso_`. El padrón (PERSONAL) y las entregas NO se tocan (las semillas cortan temprano si ya hay datos).
3. Mirar el `Logger.log`: debe imprimir `Sistema inicializado. Planilla: ...`.

Expected: en la planilla, la hoja USUARIOS desaparece y CONFIG tiene una fila nueva `pin_acceso_hash` con un valor `salt$hash`.

- [ ] **Step 7: Probar el backend de auth desde el editor (función temporal)**

Pegar temporalmente esta función en el `.gs`, correrla, mirar el `Logger.log`, y **borrarla después**:

```javascript
function _probarAuthPin() {
  Logger.log('hash sembrado presente: ' + (getPinHash_() ? 'SÍ' : 'NO'));
  Logger.log('login 1234: ' + JSON.stringify(loginPin_('1234')));
  try { loginPin_('9999'); Logger.log('FALLA: 9999 no debió entrar'); }
  catch (e) { Logger.log('OK rechazo 9999: ' + e.message); }
  cambiarPinAcceso_('4321');
  try { loginPin_('1234'); Logger.log('FALLA: 1234 viejo entró'); }
  catch (e) { Logger.log('OK 1234 viejo rechazado: ' + e.message); }
  Logger.log('login 4321: ' + JSON.stringify(loginPin_('4321')));
  cambiarPinAcceso_('1234'); // restaurar PIN inicial
  Logger.log('PIN restaurado a 1234');
}
```

Expected en el log: `hash sembrado presente: SÍ`; el login 1234 devuelve `{"ok":true,"token":"...","nombre":"Compras"}`; rechaza 9999; tras cambiar a 4321 rechaza el 1234 viejo y acepta 4321; restaura a 1234.

- [ ] **Step 8: Prueba E2E en el Web App**

1. Abrir la URL del Web App (la del redirect en `docs/index.html`).
2. La pantalla de login muestra **un solo campo PIN** (sin desplegable de usuario).
3. Entrar con **1234** → carga el sistema, el rótulo de usuario arriba muestra "Compras".
4. Si había una sesión vieja guardada (token de un usuario anterior), hacer **Salir** una vez para descartarla; en el próximo login la identidad ya es "Compras". (Los tokens viejos siguen siendo válidos hasta vencer porque el `TOKEN_SECRET` no cambió — esto se auto-resuelve al vencer a las 8 h o al salir.)

Expected: login con PIN funciona; no aparece ningún resto del desplegable de nombres.

---

## Notas de despliegue / riesgos (Fase 1)

- **El PIN inicial es 1234.** No hay UI para cambiarlo en esta fase (la pantalla **Ajustes** llega en la Fase 6). Mientras tanto se cambia corriendo `cambiarPinAcceso_('XXXX')` desde el editor. Decirle a Marcos que lo rote antes del uso real.
- **`inicializarSistema()` es obligatorio post-deploy.** Sin esa corrida, CONFIG no tiene `pin_acceso_hash` y `loginPin_` tira "El sistema no tiene PIN configurado". Es idempotente con el padrón ya cargado.
- **Sesiones viejas:** los tokens emitidos antes del cambio (con `u` = nombre de un usuario viejo) siguen validando hasta vencer. Cosmético (el rótulo de arriba) y se resuelve con un "Salir". No rompe nada.
- **Acceso externo (gente fuera de @grupoingeco):** esto depende del *nivel de acceso* del deployment del Web App ("Cualquiera"/"Cualquiera con el enlace"), que se setea en el editor al publicar — no es código. Esta fase deja el PIN como única barrera, que era el objetivo. Confirmar el nivel de acceso al publicar.

---

## Self-review (hecho al cerrar el plan)

- **Cobertura del spec (§6 Auth + §10 Fase 1):** `loginPin` ✔ (Tarea 2/3), `cambiarPinAcceso` ✔ (Tarea 2/3), `METODOS_PUBLICOS = { loginPin: true }` ✔ (Tarea 3), quita `listarNombresLogin`/`crearUsuario`/`login`/`cambiarPin` ✔ (Tarea 2/3), seed `pin_acceso_hash` en CONFIG ✔ (Tarea 4), identidad fija "Compras" ✔ (`IDENTIDAD_FIJA`, Tarea 2), elimina hoja USUARIOS ✔ (Tarea 4), login UI de un solo PIN ✔ (Tareas 5/6), token HMAC intacto ✔ (no se toca `emitirToken_`/`validarToken_`).
- **Placeholders:** ninguno. Todo el código va completo; comandos con salida esperada.
- **Consistencia de tipos/nombres:** `loginPin_`/`cambiarPinAcceso_` (Auth) ↔ rutas `loginPin`/`cambiarPinAcceso` (Api) ↔ `rawCall('loginPin', { pin })` (App.html) ↔ `p.pin`/`p.pinNuevo` (Api). `PARAM.PIN_HASH = 'pin_acceso_hash'` usado igual en Config/Setup/Auth. `IDENTIDAD_FIJA = 'Compras'` definido en Auth, devuelto en `loginPin_`. `getPinHash_`/`escribirConfig_` definidos en Config (Tarea 1) y usados en Auth (Tarea 2) y Setup (Tarea 4). Sin discrepancias.
