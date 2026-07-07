/**
 * MigracionHistorial.gs — TEMPORAL. Vacía HISTORIAL_COMPRAS (corridas de compra
 * congeladas) para arrancar limpio el ciclo nuevo. Hace un backup de la hoja
 * antes de borrar. NO toca ENTREGAS ni PERSONAL.
 *
 * Uso (editor de Apps Script): correr borrarHistorialCompras() una vez.
 * Se elimina este archivo del proyecto una vez hecho.
 */
function borrarHistorialCompras() {
  var ss = getSpreadsheet_();
  var sh = requireSheet_(SHEETS.HISTORIAL);

  // Backup de la hoja completa antes de borrar.
  var d = new Date();
  var stamp = d.getFullYear() + ('0' + (d.getMonth() + 1)).slice(-2) + ('0' + d.getDate()).slice(-2) + '_' +
    ('0' + d.getHours()).slice(-2) + ('0' + d.getMinutes()).slice(-2) + ('0' + d.getSeconds()).slice(-2);
  var nombreBackup = 'HISTORIAL_BACKUP_' + stamp;
  sh.copyTo(ss).setName(nombreBackup);

  // Vaciar solo las filas de datos; conservar la hoja y su encabezado.
  var lastRow = sh.getLastRow();
  var filas = Math.max(lastRow - 1, 0);
  if (filas > 0) {
    sh.getRange(2, 1, filas, Math.max(sh.getLastColumn(), 1)).clearContent();
  }

  Logger.log('=== HISTORIAL DE COMPRAS BORRADO ===');
  Logger.log('Backup: ' + nombreBackup + ' | corridas borradas: ' + filas);
  Logger.log('Entregar queda vacío hasta congelar una corrida nueva. ENTREGAS y PERSONAL intactos.');
  return { backup: nombreBackup, borradas: filas };
}
