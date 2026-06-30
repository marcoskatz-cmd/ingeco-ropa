/**
 * Api.gs — Único punto de entrada desde el frontend. El navegador llama
 * google.script.run.apiCall(metodo, payloadJson). Acá se valida el token de
 * sesión (salvo los métodos de pre-login) y se enruta a la función de negocio.
 *
 * Todo viaja como JSON string para no pelear con la serialización de
 * google.script.run (fechas, objetos anidados). La respuesta SIEMPRE es un
 * JSON { ok:true, data } o { ok:false, error } — el front nunca recibe una
 * excepción cruda.
 */

// Métodos que NO requieren token (pantalla de login).
var METODOS_PUBLICOS = { loginPin: true };

function apiCall(metodo, payloadJson) {
  try {
    var payload = payloadJson ? JSON.parse(payloadJson) : {};
    var sesion = null;
    if (!METODOS_PUBLICOS[metodo]) {
      sesion = validarToken_(payload.__token || '');
    }
    var data = enrutar_(metodo, payload, sesion);
    return JSON.stringify({ ok: true, data: data === undefined ? null : data });
  } catch (e) {
    return JSON.stringify({ ok: false, error: (e && e.message) ? e.message : String(e) });
  }
}

function enrutar_(metodo, p, sesion) {
  var usuario = sesion ? sesion.nombre : '';
  switch (metodo) {
    // --- Pre-login ---
    case 'loginPin': return loginPin_(p.pin);

    // --- Sesión / PIN ---
    case 'sesion': return { nombre: usuario };
    case 'cambiarPinAcceso': return cambiarPinAcceso_(p.pinNuevo);

    // --- Tablero (inicio) ---
    case 'resumenTablero': return resumenTablero_();

    // --- Config / listas (para poblar selects y rótulos del front) ---
    case 'getConfig': return configParaUI_();
    case 'getListas': return getListas_();

    // --- Escritura de configuración (Ajustes) ---
    case 'guardarParametros': return guardarParametros_(p.datos || p);
    case 'guardarListas': return guardarListas_(p.datos || p);
    case 'listarProveedores': return listarProveedores_();
    case 'guardarProveedores': return guardarProveedores_(p.datos || p);

    // --- Padrón (PERSONAL) ---
    case 'listarPersonal': return listarPersonal_(p.soloActivos !== false);
    case 'datosOperario': return datosOperarioParaEntrega_(p.legajo);
    case 'crearOperario': return crearOperario_(p.datos || p);
    case 'actualizarOperario': return actualizarOperario_(p.legajo, p.datos || {});
    case 'setActivoOperario': return setActivoOperario_(p.legajo, !!p.activo);

    // --- Entregas ---
    case 'registrarEntrega': return registrarEntrega_(p.datos || p);
    case 'entregasPendientes': return entregasPendientes_();
    case 'confirmarEntregas': return confirmarEntregas_(p.datos || p);
    case 'historialOperario': return historialOperario_(p.legajo);

    // --- Comprar (corrida + previsión + pedido, unificado) ---
    case 'vistaComprar': return vistaComprar_(p.horizonte, p.exclusiones || []);
    case 'calcularCorrida': return calcularCorrida_();
    case 'generarPrevision': return generarPrevision_();
    case 'armarPedido': return armarPedido_(p.exclusiones || [], p.horizonte);

    // --- Cruce RRHH ---
    case 'cruzarRRHH': return cruzarRRHH_(p.texto || '');
    case 'aplicarCambiosCruce': return aplicarCambiosCruce_(p.cambios || []);

    // --- Historial (congelar compra) ---
    case 'congelarCompra': return congelarCompra_(usuario, p.exclusiones || []);
    case 'listarHistorial': return listarHistorial_();
    case 'detalleHistorial': return detalleHistorial_(p.id);

    // --- Roturas ---
    case 'reporteRoturas': return reporteRoturas_();

    default: throw new Error('Método desconocido: ' + metodo);
  }
}

/** Snapshot de parámetros de negocio para que el front muestre rótulos. */
function configParaUI_() {
  return {
    vidaUtil: getVidaUtilMeses_(),
    cadencia: getCadenciaMeses_(),
    techo: getTechoMeses_(),
    diasPrevision: getDiasPrevision_(),
    fechaAncla: fmtFecha_(getFechaAncla_()),
    prendas: PRENDAS,
    motivos: MOTIVOS
  };
}
