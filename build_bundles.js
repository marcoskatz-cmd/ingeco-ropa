/**
 * build_bundles.js — Regenera el bundle de backend para pegar en Apps Script.
 *
 *   CODIGO_COMPLETO.txt = todos los .gs concatenados (un solo archivo .gs).
 *
 * El front es UN solo archivo: index.html (ya trae <style> y <script>
 * incrustados). Se pega tal cual en el archivo HTML "index" del editor; no
 * necesita ningún bundle.
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
    ' * El front va aparte, en UN solo archivo HTML del editor:\n' +
    ' *   - index.html  (Archivo > Nuevo > HTML, con nombre "index")\n' +
    ' * Y el manifiesto del proyecto:\n' +
    ' *   - appsscript.json\n' +
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

buildCodigo();
console.log('Backend regenerado. El front es index.html (un solo archivo, se pega tal cual).');
