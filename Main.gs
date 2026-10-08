/**
 * Main.gs — Entrada del Web App. La SPA entera vive en UN solo archivo HTML
 * (index.html, con los estilos y el script incrustados). Se sirve como HTML
 * plano: no se usa el motor de templates, así nada del JS se confunde con un
 * scriptlet <? ?>. Toda la lógica de datos pasa por apiCall (Api.gs).
 */

function doGet(e) {
  var out = HtmlService.createHtmlOutputFromFile('index')
    .setTitle('INGECO — Compra de Ropa')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setFaviconUrl('https://www.google.com/images/icons/product/sheets-32.png')
    // Embebible dentro de la app INGECO (shell).
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  // Acceso desde la app INGECO: ?t=<token del shell>. Se inyecta sanitizado para que el front lo canjee.
  var t = (e && e.parameter && e.parameter.t) ? String(e.parameter.t) : '';
  if (/^[A-Za-z0-9_-]{20,120}$/.test(t)) out.append('<script>window.SHELL_TOKEN=' + JSON.stringify(t) + ';</script>');
  return out;
}
