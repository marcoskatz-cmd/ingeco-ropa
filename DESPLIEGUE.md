# INGECO Ropa — Despliegue

Web App de Google Apps Script (proyecto **standalone**, no ligado a la planilla). La planilla es solo la base de datos: la crea el propio sistema en el primer arranque. Los usuarios entran por una URL con **login por PIN** (no necesitan cuenta de Google).

## 1. Requisitos

- Node.js instalado.
- clasp: `npm install -g @google/clasp`
- Una cuenta de Google **personal** (NO @grupoingeco.com.ar) que va a ser dueña del proyecto y del despliegue. El Workspace de INGECO bloquea el acceso anónimo a los Web App; por eso se despliega desde una cuenta personal.

## 2. Subir el código con clasp

```bash
clasp login                       # logueate con la cuenta personal dueña
cd ingeco-ropa
clasp create --type webapp --title "INGECO Ropa"   # crea el proyecto standalone
clasp push                        # sube todos los .gs y .html
```

`clasp create` genera el `.clasp.json` con el `scriptId`. Si ya tenés un proyecto creado, copiá su `scriptId` en `.clasp.json` y hacé `clasp push`.

## 3. Provisionar la base de datos (una sola vez)

Abrí el editor (`clasp open`) y ejecutá la función **`inicializarSistema`** una vez. Eso:

- Crea la planilla "INGECO Ropa — Base de Datos" y guarda su ID en Script Properties (`SHEET_ID`). No hay que pegar ningún ID a mano.
- Arma las hojas: CONFIG, LISTAS, USUARIOS, PERSONAL, ENTREGAS, PROVEEDORES, HISTORIAL_COMPRAS, con encabezados, validaciones y formato.
- Siembra un usuario de acceso: **Administrador / PIN 1234** (cambialo en cuanto entres).

Volvé a correr `inicializarSistema` cuando quieras: es idempotente, no pisa datos.

## 4. Desplegar el Web App

En el editor: **Implementar → Nueva implementación → Aplicación web**.

- **Ejecutar como:** Yo (el dueño).
- **Quién tiene acceso:** *Cualquier usuario* (anónimo). Si tu cuenta no ofrece "anónimo", elegí *Cualquier persona con cuenta de Google*: los usuarios entran con cualquier Gmail y después el PIN los identifica. El login por PIN protege la app en los dos casos.

Copiá la URL `/exec`. Esa es la app.

(Con clasp: `clasp deploy` y `clasp deployments` para ver la URL.)

## 5. Cargar el padrón inicial

El padrón de ~100 operarios con su última fecha de entrega se importa con motivo **CICLO INICIAL** (eso arranca el reloj de cada prenda). Ver `Seed.gs`:

1. Abrí la planilla "INGECO Ropa — Base de Datos" y creá una hoja nueva llamada **IMPORTAR**.
2. Pegá ahí tu Excel, **con fila de encabezados**. Se reconocen (por nombre, no por orden): `LEGAJO` (obligatorio), `APELLIDO Y NOMBRE`, `CATEGORIA`, `CENTRO DE COSTO`, `COLOR ROPA`, `TIPO BOTIN`, `TALLE PANT`, `TALLE CAM`, `TALLE BOTIN`, `ULTIMA ENTREGA`, `OBSERVACIONES`. Opcional: `FECHA PANT` / `FECHA CAM` / `FECHA BOTIN` si la última entrega difiere por prenda (si no, `ULTIMA ENTREGA` aplica a las tres).
3. En el editor, ejecutá **`sembrarPadronInicial`**. Crea las filas de PERSONAL y una entrega CICLO INICIAL por prenda con fecha. Si una prenda no trae fecha, queda SIN DATO. Es idempotente: los legajos ya existentes se saltean.
4. Borrá la hoja IMPORTAR cuando termine (o dejala; `inicializarSistema` la elimina por ser ajena al modelo — pero `sembrarPadronInicial` nunca borra nada).

Alternativa sin hoja: pasar el array 2D (encabezados + filas) directo a `importarPadronDesdeValores(valores)`.

## Notas

- **Cambiar de PC:** clonás el repo, `clasp login` con la misma cuenta personal, `clasp push`. El `SHEET_ID` vive en Script Properties del proyecto, no en el repo.
- **Zona horaria:** America/Argentina/Tucuman (en `appsscript.json`).
- La planilla DB se puede abrir y editar a mano (PERSONAL, talles) además de por la app: las dos vías escriben a la misma fuente.
