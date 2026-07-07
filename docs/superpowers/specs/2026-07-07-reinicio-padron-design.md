# Reinicio del padrón desde nómina nueva — Diseño

Fecha: 2026-07-07
Estado: aprobado (brainstorming)

## Problema

El padrón de operarios (`PERSONAL`) quedó desactualizado. RRHH entregó una nómina
nueva (`Nomina Personal.xlsx`, 134 operarios: legajo, nombre, centro de costo).
Hay que reiniciar el padrón para que el conjunto **activo** coincida con la nómina
nueva, **sin perder los talles** ya cargados de las personas que se repiten.

## Principios del sistema (heredados)

- El cruce se hace **siempre por LEGAJO**, nunca por nombre.
- **Nunca se borra una fila.** La baja es `ACTIVO=NO`; el talle y el historial
  quedan atados al legajo para siempre.
- Los talles **nunca** se pisan por procesos automáticos.

## Decisiones (aprobadas)

- **Bajas** (activos del padrón que no están en la nómina): pasan a `ACTIVO=NO`
  (fila, talle e historial conservados). No se borran.
- **Repetidos** (en ambos): se conservan talles, `COLOR ROPA`, `TIPO BOTÍN` y
  `CATEGORÍA`; se actualizan `APELLIDO Y NOMBRE` y `CENTRO DE COSTO` desde la
  nómina; `ACTIVO=SÍ`.
- **Ejecución**: migración de una sola vez, corrida desde el editor de Apps
  Script (o vía `clasp run` si la API executable está habilitada). Sin UI nueva.

## Datos de la nómina (validados)

- 134 filas de datos. Sin legajos duplicados ni vacíos. Legajos numéricos.
- Columnas: `LEG`, `APELLID NOMBRE`, `CTRO COSTO`. 20 centros distintos (uno vacío).
- La nómina **no** trae talles ni categoría → para altas nuevas esos campos quedan
  vacíos; para repetidos se conservan los del padrón.

## Diseño

Archivo temporal `MigracionPadron.gs` con la nómina embebida como literal
(`NOMINA_NUEVA = [{ legajo, nombre, centro }, ...]`, 134 entradas). Dos funciones:

### `previewReinicioPadron()` — solo lectura

Lee `PERSONAL`, cruza por legajo y loguea (con `Logger.log`), sin cambiar nada:
- Total del padrón actual (activos / inactivos).
- **Se mantienen**: legajos en ambos que ya estaban activos.
- **Reingresos**: legajos de la nómina que existen pero estaban `ACTIVO=NO`.
- **Altas nuevas**: legajos de la nómina que no existen en el padrón.
- **Bajas**: activos del padrón que no están en la nómina.
- **⚠️ Posibles typos de legajo**: nombres (normalizados) que aparecen a la vez en
  la lista de altas y en la de bajas (señal de legajo mal tipeado). Se listan para
  revisión manual; el proceso **no** los resuelve solo.

### `aplicarReinicioPadron()` — escribe

1. **Backup**: `PERSONAL.copyTo(ss)` renombrada a `PERSONAL_BACKUP_<yyyyMMdd_HHmmss>`.
2. Lee `PERSONAL` una vez (índice por legajo).
3. Por cada `{ legajo, nombre, centro }` de la nómina:
   - Si el legajo **existe**: `setValue` de `APELLIDO Y NOMBRE`=nombre,
     `CENTRO DE COSTO`=centro, `ACTIVO`='SÍ'. No toca talles/color/tipo botín/
     categoría/observaciones.
   - Si **no existe**: `appendFilaPorHeader_` con legajo, nombre, centro,
     `ACTIVO`='SÍ' y el resto vacío.
4. Por cada fila del padrón cuyo legajo **no** está en la nómina y hoy está
   `ACTIVO=SÍ`: `setValue` `ACTIVO`='NO'.
5. `Logger.log` del resumen: mantenidos, reingresos, altas, bajas.

**Idempotente**: correrla dos veces da el mismo estado (el segundo backup es
redundante pero inofensivo).

### Interfaces / dependencias

- Consume: `leerPersonal_()`, `claveLegajo_()`, `esSi_()`, `normalizar_()`,
  `appendFilaPorHeader_()`, `colPorHeader_()`, `getSpreadsheet_()`,
  `SHEETS.PERSONAL`, `P.*` (Schema).
- No modifica ningún archivo existente; todo vive en `MigracionPadron.gs`.

## Verificación

- `node --check` sobre `MigracionPadron.gs` copiado a `.js` (gate de sintaxis).
- `previewReinicioPadron()` corrido **antes** de aplicar: revisar counts y la
  lista de posibles typos. El backup permite revertir si algo sale mal.

## Limpieza

Tras aplicar y validar, se elimina `MigracionPadron.gs` del repo y se hace
`clasp push --force` para no dejar la función de migración colgada en el proyecto.
El backup `PERSONAL_BACKUP_*` queda en el spreadsheet.
