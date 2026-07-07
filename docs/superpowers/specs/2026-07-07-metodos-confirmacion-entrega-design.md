# Métodos de confirmación de entrega: firma vs planilla

Fecha: 2026-07-07
Estado: aprobado (brainstorming)

## Problema

Al confirmar una entrega en la pestaña **Entregar**, el modal actual ("Firma de
recepción") muestra **siempre** el canvas de firma y esconde la alternativa de
papel dentro de un `<details>` ("El operario no puede firmar ahora") con un
`<select>` PAPEL/AUSENTE + motivo. Además, arriba convive el botón
"Confirmar seleccionadas" (lote, `VALIDACION='LOTE'`, sin firma). Resultado: los
dos métodos de confirmación aparecen mezclados y no queda claro cuándo se usa
cada uno. Falta también poder **adjuntar la foto/archivo** de la planilla firmada
en papel.

## Principio rector

Una prenda **solo** se puede dar por **entregada** con evidencia: **firma en el
momento** o **planilla en papel**. No hay tercera vía. Si el operario está
ausente, eso **no es una entrega** — se maneja con el flujo ya existente de
**no-entrega** (destildar la prenda + cargar motivo). El método `AUSENTE` deja de
ser una forma válida de registrar una entrega.

## Alcance

1. Rediseñar el modal de confirmación individual con un **selector de 2 métodos**
   arriba (Firma / Planilla), mostrando solo el panel del método elegido.
2. Permitir **subir foto o archivo** (JPG/PNG/PDF) de la planilla firmada, con la
   foto **obligatoria** en la confirmación individual por planilla.
3. Renombrar el botón de lote a **"Confirmar por planilla (varios)"** y permitir
   adjuntar una **foto compartida** (opcional) que abarca a todos los
   seleccionados como entregados.

Fuera de alcance: el flujo de no-entrega (se mantiene igual), la entrega suelta,
y las filas históricas con `VALIDACION='AUSENTE'` (quedan como están).

## Diseño

### Front — modal individual (`abrirModalFirma_` y helpers)

- Encabezado del modal: **selector segmentado** de 2 botones/pestañas:
  - **✍️ Firma en el momento** (default) → panel con el canvas + "Borrar"
    (idéntico al actual).
  - **📄 Por planilla** → panel con:
    - input de archivo (`accept="image/*,application/pdf"`, `capture` habilitado
      para cámara del cel) — **obligatorio**;
    - nombre del archivo elegido + miniatura si es imagen (confirmación visual);
    - campo **"Observación"** opcional (texto libre).
- Se muestra **solo** el panel del método activo; al cambiar de método se oculta
  el otro. Nunca ambos a la vez.
- Se elimina el `<details>` de excepción y el `<select>` PAPEL/AUSENTE.
- `finalizarFirma_` ramifica por método activo:
  - Firma: exige `_firma.trazos`; arma `datos.validacion = { tipo:'FIRMA',
    firmaBase64 }` (igual que hoy).
  - Planilla: exige archivo adjunto; arma `datos.validacion = { tipo:'PAPEL',
    planillaBase64: <dataURL>, motivo: <observación opcional> }`.
  - Sin evidencia → `toast` de error claro; no confirma.

### Front — subida de archivo

- Lectura del archivo con `FileReader.readAsDataURL` → dataURL base64.
- **Imágenes**: se comprimen en el navegador antes de enviar — se dibujan en un
  `<canvas>`, se redimensionan a un máximo de ~1600px del lado mayor y se
  exportan como JPEG (~0.8) para que la subida no se cuelgue con señal mala en el
  celular.
- **PDF**: se envía tal cual, con un tope de tamaño (~10 MB); si se pasa, aviso y
  no se envía.
- Un solo archivo por adjunto.

### Front — lote (`confirmarSeleccionadas_`)

- El botón "Confirmar seleccionadas" se renombra a **"Confirmar por planilla
  (varios)"**.
- Al tocarlo se abre un **mini-modal**: "Confirmás la entrega de N personas por
  planilla" + input de archivo **opcional** para la foto compartida de la
  planilla + botón confirmar.
- Envía `api('confirmarEntregasVarias', { lista, planillaBase64? })`.
  - Con foto → misma URL en cada entrega, `VALIDACION='PAPEL'`.
  - Sin foto → `VALIDACION='LOTE'` (respaldo sin evidencia digital; la planilla
    física es el respaldo).

### Backend (`Entregas.gs`)

- **Nueva** `subirPlanilla_(dataUrl, legajo)` (hermana de `subirFirma_`): detecta
  el mime del prefijo `data:...;base64,` (image/jpeg, image/png, application/pdf),
  elige extensión (`.jpg`/`.png`/`.pdf`), guarda en la carpeta de Drive "Firmas
  Ropa INGECO" como `planilla_<claveLegajo>_<stamp>.<ext>` y devuelve `getUrl()`.
  Rechaza mimes no soportados.
- `confirmarEntregas_`: cuando hay entrega de prendas, la validación válida es
  **`FIRMA`** o **`PAPEL`**:
  - `FIRMA`: como hoy (`subirFirma_`).
  - `PAPEL`: exige `val.planillaBase64`; sube con `subirPlanilla_` → `val.firmaUrl`.
    El motivo/observación es **opcional**.
  - Cualquier otro tipo (incluido `AUSENTE`) → error "Falta la firma o la planilla
    del operario." Ya no se acepta `AUSENTE` como entrega.
- `confirmarEntregasVarias_(lista, usuario, planillaBase64)`: si viene
  `planillaBase64`, se sube **una sola vez** con `subirPlanilla_` y esa URL se
  aplica a cada `datos.validacion = { tipo:'PAPEL', firmaUrl }`; si no viene,
  cada entrega usa `{ tipo:'LOTE' }` como hoy.
- `Api.gs`: la ruta `confirmarEntregasVarias` pasa el nuevo parámetro
  `planillaBase64` al backend.

### Datos

- No hacen falta columnas nuevas: la planilla reutiliza `FIRMA_URL` y
  `VALIDACION='PAPEL'` que ya existen (tanda @18). Sin migración de esquema.

## Verificación

- `node --check` sobre el `<script>` extraído de `index.html` (gate de sintaxis
  del front) y sobre los `.gs` copiados a `.js` temporal.
- Harness de Chrome headless (puppeteer-core apuntando al Chrome del sistema) con
  stub de `google.script.run` que captura el payload:
  - Firma → `validacion.tipo === 'FIRMA'` con `firmaBase64`.
  - Planilla → `validacion.tipo === 'PAPEL'` con `planillaBase64`; falla si no se
    adjuntó archivo.
  - Sin evidencia → no envía, muestra error.
  - Lote con foto compartida → `planillaBase64` presente a nivel lista.
- Deploy con `clasp push --force` + `clasp redeploy` (ver memoria de despliegue).
