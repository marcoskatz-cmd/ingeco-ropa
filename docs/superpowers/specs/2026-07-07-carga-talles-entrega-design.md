# Carga de talles desde la entrega del 25/03/2026 — Diseño

Fecha: 2026-07-07
Estado: aprobado (brainstorming)

## Problema

Tras el reinicio del padrón, varios operarios quedaron sin talle. RRHH/Compras
pasó la planilla de la última entrega (25/03/2026) con talle pantalón/camisa/botín,
COLOR ROPA y TIPO BOTÍN por persona. Hay que cargar esos datos al padrón
(`PERSONAL`), matcheando por legajo, para que la compra calcule bien.

## Decisiones (aprobadas)

- Se cargan **talles + COLOR ROPA + TIPO BOTÍN** (color y tipo botín definen el
  grupo de compra).
- Para quien ya tiene talle en el padrón, la entrega **sobrescribe** (es la última
  entrega real = fuente de verdad). Se loguean las diferencias que se pisan.
- Cruce por **legajo**. Solo se toca a los que están en la nómina activa.

## Datos de origen (cruzados y validados)

De las ~114 filas de la entrega, quedan **98 registros cargables** (legajo válido,
talle válido, y el legajo está en la nómina activa), con estas correcciones:

- **Legajo 2014 mal tipeado**: la fila "GRAMAJO NESTOR FABIAN / 2014" corresponde
  al legajo **2046** (así figura en la nómina). Queda 2014 = BARBOZA DOMINGO
  GERONIMO (56/50/44), 2046 = GRAMAJO NESTOR FABIAN (50/50/40).
- **"Diaz Lucas" sin legajo** → **3958** DIAZ, LUCAS DAMIAN (48/46/41), por nombre.
- **"Jean" → "JEANS"** normalizado. "Cargo Azul" (CASTAÑO HUGO, 2120) se deja como
  viene y se marca (único valor de color atípico).

Quedan **35 sin talle** (no se tocan): 30 altas de administración que no están en
la entrega, y 5 reingresos con fila inválida en la entrega (1984 CARRIZO, 3878
MAITA LUIS, 3879 GONZALEZ RAUL, 3893 REYES MARTIN, 3911 VALENZUELA) — conservan lo
que ya tuvieran.

**Se descartan:** 9 filas inválidas (`#N/A`/`0/0/0`); 7 filas sin legajo no
identificables (2× "Gonzalez, pedido el 30/04", "Zelaya Matias/Jorge/Ramon",
"Cuellar Nicolas", "Olivera Daniel"); 3 legajos fuera de la nómina (3835, 2616,
3314, inactivos).

Valores presentes a cargar: colores {BEIGE, Cargo Azul, JEANS, NARANJA, PETROLEO},
botines {BOTA PETROLERA, FUNCIONAL, PUNTA DE ACERO}, talles 38–60.

## Diseño

Archivo temporal `MigracionTalles.gs` con `TALLES_ENTREGA` embebido (98 registros
`{ legajo, color, tipoBotin, pant, cam, botin }`, con los fixes ya aplicados). Tres
funciones, corridas desde el editor de Apps Script:

### `previewCargaTalles()` — solo lectura

Lee `PERSONAL`, y por cada registro loguea el **actual vs nuevo** de talle/color/
tipo botín marcando si difiere, más contadores: a actualizar, sin cambio, no
encontrados en el padrón. No escribe nada.

### `asegurarValoresEnListas_()`

Agrega a LISTAS los valores que falten para que la validación de datos de PERSONAL
no rechace la escritura (misma clase de bug que con CENTRO): COLOR ROPA → col A,
TIPO BOTÍN → col B, TALLE PANT → col E, TALLE CAM → col F, TALLE BOTÍN → col G.
Compara normalizado; idempotente.

### `aplicarCargaTalles()`

1. Backup `PERSONAL_BACKUP_<yyyyMMdd_HHmmss>` (`sheet.copyTo`).
2. `asegurarValoresEnListas_()`.
3. Por cada registro cuyo legajo exista en `PERSONAL`: `setValue` de `TALLE PANT`,
   `TALLE CAM`, `TALLE BOTÍN`, `COLOR ROPA`, `TIPO BOTÍN`. Sobrescribe.
4. Loguea resumen (actualizados, no encontrados) y las diferencias pisadas.

### Interfaces / dependencias

- Consume: `leerPersonal_()`, `claveLegajo_()`, `normalizar_()`, `colPorHeader_()`,
  `getSpreadsheet_()`, `requireSheet_()`, `SHEETS`, `P.*`.
- No modifica archivos existentes; todo vive en `MigracionTalles.gs`.

## Verificación

- `node --check` sobre `MigracionTalles.gs`.
- `previewCargaTalles()` antes de aplicar: revisar diferencias y el conteo de "no
  encontrados" (debería ser 0). Backup para revertir.

## Limpieza

Tras aplicar y validar, se elimina `MigracionTalles.gs` y se hace `clasp push
--force`. El backup queda en el spreadsheet.
