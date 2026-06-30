/**
 * Main.gs — Entrada del Web App. doGet sirve la SPA (index.html); el resto de
 * la app vive en los archivos HTML incluidos. Toda la lógica de datos pasa por
 * apiCall (Api.gs); acá no hay reglas de negocio.
 */

function doGet() {
  return HtmlService.createTemplateFromFile('index')
    .evaluate()
    .setTitle('INGECO — Compra de Ropa')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setFaviconUrl('https://www.google.com/images/icons/product/sheets-32.png');
}

/** Permite <?!= include('NombreArchivo') ?> dentro de los HTML. */
function include(nombre) {
  return HtmlService.createHtmlOutputFromFile(nombre).getContent();
}
