# Firma del operario en Entregas — Diseño

**Fecha:** 2026-07-03
**Sistema:** Compra de Ropa de Trabajo INGECO (Apps Script + Google Sheets)
**Repo:** `marcoskatz-cmd/ingeco-ropa`

## Objetivo

Reemplazar (con excepciones) el respaldo en papel de las entregas de ropa por una
**firma digital del operario en pantalla**. El encargado abre **Entregar**, ubica al
operario, el operario firma que recibió, y así queda validada la entrega.

## Decisiones tomadas (brainstorming)

1. **Firma obligatoria con excepción** en el flujo individual: no se puede confirmar
   una entrega individual sin firma, salvo que el encargado marque una excepción
   (*Firma en papel* o *Ausente*) con un **motivo obligatorio**.
2. **El botón "Confirmar seleccionadas" (lote) se mantiene como está**: confirma sin
   pedir firma. Funciona como vía rápida / equivalente al respaldo en papel de siempre.
   La obligatoriedad de firma aplica **solo al flujo individual**.
3. **Guardado en Drive + link**: cada firma es un PNG en una carpeta de Google Drive; en
   `ENTREGAS` queda el link. Igual patrón que Pedidos de Compra.
4. **Se puede ver la firma después** en el modal "Entregas" del operario (sección Personal).

## 1. Flujo de usuario

El encargado abre **Entregar**, ubica la tarjeta del operario (ya se listan por nombre)
y toca **"Confirmar"**. En vez de registrar directamente, se abre un **modal de firma**:

- Título con el nombre del operario y las prendas que se están entregando (las tildadas).
- Un **canvas** donde el operario firma con el dedo/mouse + botón **"Borrar"**.
- Un enlace chico **"El operario no puede firmar ahora"** que despliega la **excepción**:
  elegir *Firma en papel* o *Ausente* + un campo de **motivo obligatorio**.
- Botón **"Confirmar entrega"**, habilitado cuando hay firma dibujada **o** una excepción
  con motivo.

El botón **"Confirmar seleccionadas"** (lote) no cambia.

## 2. Modelo de datos

Se agregan a la hoja `ENTREGAS` cuatro columnas nuevas, al final del encabezado actual.
Una migración `asegurarColumnasEntregas_()` las crea al vuelo si faltan (mismo espíritu
que `ensureNoEntregasSheet_`). `ENTREGAS` se lee/escribe por **nombre de encabezado**
(`leerObjetos_` / `appendFilaPorHeader_`), así que agregar columnas no rompe filas
históricas: quedan con esas celdas vacías.

Encabezado actual:
`FECHA, LEGAJO, APELLIDO Y NOMBRE, PRENDA, TALLE, MOTIVO, OBSERVACIONES`

Columnas nuevas:

| Columna | Contenido |
|---|---|
| `VALIDACION` | `FIRMA` · `PAPEL` · `AUSENTE` · `LOTE` · vacío (histórico) |
| `FIRMA_URL` | link al PNG en Drive (solo cuando `VALIDACION = FIRMA`) |
| `VALIDADO_POR` | usuario de sesión (encargado) que registró la entrega |
| `MOTIVO_VALIDACION` | motivo de la excepción (solo `PAPEL` / `AUSENTE`) |

Se actualiza `COLS.ENTREGAS` en `Schema.gs` y el mapa simbólico `E` con las 4 claves nuevas.

**Granularidad:** una entrega = una acción de "Confirmar" de **una persona**, que puede
incluir varias prendas (varias filas de `ENTREGAS`). La **misma validación se estampa en
todas las filas** de esa persona en esa confirmación. La firma se sube **una sola vez** a
Drive y su URL se repite en cada fila del evento.

## 3. Guardado de la firma

- Carpeta en Google Drive; su id se guarda en `CONFIG` como parámetro `CARPETA_FIRMAS`.
- `ensureCarpetaFirmas_()` la crea al primer uso y devuelve la carpeta.
- `subirFirma_(base64, legajo, fecha)`: decodifica el dataURL PNG, crea el archivo
  `firma_<legajo>_<yyyymmdd_hhmmss>.png` en la carpeta, devuelve la URL del archivo.
- El link (`FIRMA_URL`) se estampa en las filas de esa entrega.

## 4. Backend

- `confirmarEntregas_(datos, usuario)` recibe además
  `datos.validacion = { tipo, firmaBase64?, motivo? }`.
  - Flujo individual: la validación es **obligatoria**. Validaciones:
    - `tipo = 'FIRMA'` → exige `firmaBase64`; sube el PNG y obtiene la URL.
    - `tipo = 'PAPEL' | 'AUSENTE'` → exige `motivo` no vacío.
    - Sin `validacion` → error ("Falta la firma del operario o una excepción con motivo.").
  - `registrarEntrega_(datos)` estampa las 4 columnas nuevas en cada fila que escribe.
- `confirmarEntregasVarias_(lista, usuario)` (lote): sin cambios de firma; estampa
  `VALIDACION = 'LOTE'` y `VALIDADO_POR` en las filas que registra.
- Nuevas funciones: `ensureCarpetaFirmas_()`, `subirFirma_(base64, legajo, fecha)`,
  `asegurarColumnasEntregas_()`.

## 5. Ver la firma después

- `historialOperario_(legajo)` incluye por cada entrega: `validacion`, `firmaUrl`,
  `validadoPor`, `motivo` (leídos de las nuevas columnas).
- En el modal **"Entregas"** del operario (sección Personal), cada fila de entrega muestra
  un badge según `validacion`:
  - `FIRMA` → ✍️ *Firmada* con link para abrir el PNG.
  - `PAPEL` → 📄 *Papel* con el motivo.
  - `AUSENTE` → 🚫 *Ausente* con el motivo.
  - `LOTE` / vacío → sin badge (entregas en lote o históricas).

## 6. Componentes y límites

- **`Schema.gs`** — define la forma de `ENTREGAS` (columnas + mapa `E`). Único lugar con
  los strings de encabezado.
- **`Entregas.gs`** — lógica de negocio: registrar entrega, migración de columnas, subida
  de firma a Drive, historial por operario. Depende de `Schema.gs`, `Util.gs`, `Config.gs`.
- **`Api.gs`** — enruta `confirmarEntregas` / `confirmarEntregasVarias` (payload extendido
  con `validacion`). Sin lógica nueva de negocio.
- **`index.html` (front SPA)** — modal de firma (canvas + excepción), recolección del
  payload, badges en el modal de historial. Depende solo del contrato JSON de `Api.gs`.

Cada unidad se puede entender y probar por separado: el front solo conoce el contrato
`{ validacion: {...} }`; el backend no sabe nada del canvas, solo recibe `firmaBase64`.

## 7. Errores y bordes

- Firma vacía (canvas sin trazos) tratada como "no firmó" → el botón del modal no habilita.
- Excepción elegida sin motivo → botón no habilita; backend revalida por las dudas.
- `firmaBase64` malformado / no PNG → `subirFirma_` lanza error claro; no se escribe la fila.
- Falla al crear/leer la carpeta de Drive → error propagado; la entrega no se registra a
  medias (la subida ocurre antes de escribir las filas).
- Filas históricas sin columnas nuevas → `leerObjetos_` devuelve `''`; el front no muestra badge.
- Cuota/tamaño de Drive: el PNG de una firma pesa pocos KB; sin riesgo práctico.

## 8. Verificación (patrón ya usado en este repo)

- `node --check` sobre el `<script>` extraído del `index.html` como gate de sintaxis del front.
- Harness Chrome-headless (puppeteer-core apuntando al Chrome del sistema + stub de
  `google.script.run`) en scratchpad, probando: el canvas dibuja, la excepción exige
  motivo, el botón se habilita/deshabilita correctamente y el payload saliente trae
  `validacion` bien formado (FIRMA con base64 / PAPEL con motivo / AUSENTE con motivo).
- Smoke test manual en la planilla en vivo tras el deploy: registrar una entrega firmada,
  verificar el PNG en Drive y las 4 columnas en `ENTREGAS`, y el badge en el historial.
- Deploy: `clasp push --force` + `clasp redeploy <deploymentId> -d "firma en entregas"`.

## Fuera de alcance (YAGNI)

- Firma en el flujo de lote.
- Firma por prenda individual (es por persona/evento).
- Editar/anular firmas ya registradas (`ENTREGAS` es append-only).
- Notificaciones o exportes de firmas.
