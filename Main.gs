/**
 * Main.gs — Entrada del Web App. La SPA entera vive en UN solo archivo HTML
 * (index.html, con los estilos y el script incrustados). Se sirve como HTML
 * plano: no se usa el motor de templates, así nada del JS se confunde con un
 * scriptlet <? ?>. Toda la lógica de datos pasa por apiCall (Api.gs).
 */

function doGet() {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('INGECO — Compra de Ropa')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setFaviconUrl('https://www.google.com/images/icons/product/sheets-32.png');
}
