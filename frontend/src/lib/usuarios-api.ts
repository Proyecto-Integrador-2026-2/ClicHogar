/// <reference types="astro/client" />
/**
 * API del backend: registro, login, perfil, disponibilidad, tareas, chat y
 * calificaciones. La identidad siempre viene del token de sesión verificado
 * en el backend, nunca del body.
 * La URL se configura con `PUBLIC_API_URL` (ver `frontend/.env.example`).
 */

/** Se lee en cada llamada (no al importar) para poder cambiarla en pruebas. */
function apiUrl(): string {
  return (
    import.meta.env.PUBLIC_API_URL ??
    (import.meta.env.DEV ? 'http://localhost:3000' : '')
  );
}

const MENSAJE_SIN_URL =
  'Falta PUBLIC_API_URL. Crea frontend/.env desde .env.example.';
const MENSAJE_SIN_RED =
  'No hay conexión con el servidor. Revisa tu internet e inténtalo de nuevo.';

/**
 * Sesión expirada o ausente (US-006, Escenario 7): el backend respondió
 * 401. El formulario la traduce a redirect a `/login?expirada=1`.
 */
export class ErrorSesionExpirada extends Error {
  constructor() {
    super('Tu sesión ha expirado. Inicia sesión de nuevo.');
    this.name = 'ErrorSesionExpirada';
  }
}

/**
 * La tarea ya no se puede ver (US-009, Escenario 3): no existe (404) o dejó
 * de estar abierta (410), p. ej. la asignaron mientras se miraba el tablero.
 */
export class ErrorTareaNoDisponible extends Error {
  constructor() {
    super('Lo sentimos, esta tarea ya no se encuentra disponible');
    this.name = 'ErrorTareaNoDisponible';
  }
}

/** El afiliado ya envió una oferta a esta tarea (US-011, Escenario 3). */
export class ErrorYaPostulado extends Error {
  constructor() {
    super('Ya te has postulado a esta tarea');
    this.name = 'ErrorYaPostulado';
  }
}

/**
 * La tarea dejó de estar abierta justo al enviar la oferta (US-011,
 * Escenario 5): la asignaron o la cancelaron.
 */
export class ErrorTareaNoAceptaOfertas extends Error {
  constructor() {
    super(
      'Lo sentimos, esta tarea ya no acepta nuevas ofertas en este momento'
    );
    this.name = 'ErrorTareaNoAceptaOfertas';
  }
}

type OpcionesPedir = {
  /** Convierte un fallo de `fetch` (sin red) en un mensaje amigable. */
  mensajeSinRed?: boolean;
  /** Traduce un 401 a `ErrorSesionExpirada`. */
  detectarSesionExpirada?: boolean;
  /** Traduce ciertos códigos de estado a un error propio (por código HTTP). */
  traducirEstados?: Record<number, () => Error>;
};

/** Tareas: sin red con mensaje amigable y 401 como sesión expirada. */
const OPCIONES_TAREAS: OpcionesPedir = {
  mensajeSinRed: true,
  detectarSesionExpirada: true,
};

/**
 * Única puerta de salida al backend: comprueba la URL, añade el token (si
 * hay) y unifica el manejo de errores (sin red, 401 y mensaje del backend).
 * Lanza Error con el mensaje del backend si la respuesta no es 2xx.
 */
async function pedir<T>(
  ruta: string,
  token: string | null,
  init: RequestInit = {},
  {
    mensajeSinRed = false,
    detectarSesionExpirada = false,
    traducirEstados = {},
  }: OpcionesPedir = {}
): Promise<T> {
  const base = apiUrl();
  if (!base) {
    throw new Error(MENSAJE_SIN_URL);
  }
  let respuesta: Response;
  try {
    respuesta = await fetch(`${base}${ruta}`, {
      ...init,
      headers: token
        ? { ...init.headers, Authorization: `Bearer ${token}` }
        : init.headers,
    });
  } catch (err: unknown) {
    throw mensajeSinRed ? new Error(MENSAJE_SIN_RED) : err;
  }

  if (detectarSesionExpirada && respuesta.status === 401) {
    throw new ErrorSesionExpirada();
  }
  const traducir = traducirEstados[respuesta.status];
  if (traducir) throw traducir();
  if (!respuesta.ok) {
    const detalle = await respuesta.json().catch(() => null);
    const mensaje =
      (detalle as { message?: string } | null)?.message ??
      `El backend respondió ${respuesta.status}.`;
    throw new Error(mensaje);
  }
  return (await respuesta.json()) as T;
}

/** Cabeceras y cuerpo JSON de una petición con payload. */
function conJson(metodo: string, cuerpo: unknown): RequestInit {
  return {
    method: metodo,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cuerpo),
  };
}

export type RolBackend = 'cliente' | 'afiliado';

export type UsuarioPublico = {
  id: string;
  nombre: string;
  email: string;
  rol: RolBackend;
  fotoUrl: string | null;
  descripcion: string | null;
  ubicacion: string | null;
  creadoEn: string;
};

/** 'Usuario' (etiqueta UI) -> 'cliente' (valor backend). 'Afiliado' se minúsculiza. */
export function normalizarRolParaBackend(
  rol: 'Usuario' | 'Afiliado' | string
): RolBackend {
  return rol.trim().toLowerCase() === 'afiliado' ? 'afiliado' : 'cliente';
}

export type RespuestaAuth = { token: string; usuario: UsuarioPublico };

/** Crea la cuenta y abre sesión (`POST /api/auth/register`). */
export function registrar(args: {
  nombre: string;
  email: string;
  password: string;
  rol: 'Usuario' | 'Afiliado' | string;
}): Promise<RespuestaAuth> {
  return pedir(
    '/api/auth/register',
    null,
    conJson('POST', {
      nombre: args.nombre,
      email: args.email,
      password: args.password,
      rol: normalizarRolParaBackend(args.rol),
    })
  );
}

/** Abre sesión con correo y contraseña (`POST /api/auth/login`). */
export function iniciarSesion(args: {
  email: string;
  password: string;
}): Promise<RespuestaAuth> {
  return pedir(
    '/api/auth/login',
    null,
    conJson('POST', { email: args.email, password: args.password })
  );
}

/**
 * Lee el perfil local del usuario autenticado (US-002, redirección por rol).
 * Requiere el token de sesión; el backend resuelve el rol desde Postgres. Lanza Error con el mensaje del backend si algo falla.
 */
export function obtenerPerfil(token: string): Promise<UsuarioPublico> {
  return pedir('/api/usuarios/yo', token, {}, { detectarSesionExpirada: true });
}

export type MensajeApi = {
  id: string;
  remitente_id: string;
  destinatario_id: string;
  contenido: string;
  creado_en: string;
};

export type CalificacionApi = {
  id: string;
  tarea_id: string | null;
  autor_id: string;
  destinatario_id: string;
  puntuacion: number;
  comentario: string | null;
  creado_en: string;
};

export function enviarMensaje(args: {
  token: string;
  destinatarioId: string;
  contenido: string;
}): Promise<MensajeApi> {
  return pedir(
    '/api/chat/mensajes',
    args.token,
    conJson('POST', {
      destinatarioId: args.destinatarioId,
      contenido: args.contenido,
    }),
    OPCIONES_TAREAS
  );
}

export function listarConversacion(args: {
  token: string;
  usuarioId: string;
}): Promise<MensajeApi[]> {
  return pedir(
    `/api/chat/conversacion/${args.usuarioId}`,
    args.token,
    {},
    OPCIONES_TAREAS
  );
}

export function crearCalificacion(args: {
  token: string;
  destinatarioId: string;
  tareaId?: string | null;
  puntuacion: number;
  comentario?: string;
}): Promise<CalificacionApi> {
  return pedir(
    '/api/calificaciones',
    args.token,
    conJson('POST', {
      destinatarioId: args.destinatarioId,
      tareaId: args.tareaId ?? null,
      puntuacion: args.puntuacion,
      comentario: args.comentario,
    }),
    OPCIONES_TAREAS
  );
}

/** Calificaciones recibidas por un usuario (lectura pública). */
export function listarCalificaciones(
  usuarioId: string
): Promise<CalificacionApi[]> {
  return pedir(`/api/calificaciones/usuario/${usuarioId}`, null);
}

/**
 * Actualización parcial del perfil (US-004, Escenario 2): solo viajan los
 * campos presentes; lo ausente no se toca en el servidor.
 */
export function actualizarPerfil(args: {
  token: string;
  foto?: File;
  descripcion?: string;
  ubicacion?: string;
}): Promise<UsuarioPublico> {
  const forma = new FormData();
  if (args.foto) forma.append('foto', args.foto);
  if (args.descripcion !== undefined)
    forma.append('descripcion', args.descripcion);
  if (args.ubicacion !== undefined) forma.append('ubicacion', args.ubicacion);
  return pedir(
    '/api/usuarios/yo',
    args.token,
    {
      method: 'PATCH',
      body: forma,
    },
    { detectarSesionExpirada: true }
  );
}

/** Convierte una ruta pública del backend (`/uploads/...`) en URL absoluta. */
export function urlPublica(rutaRelativa: string): string {
  const base = apiUrl();
  if (!base) return rutaRelativa;
  return `${base}${rutaRelativa}`;
}

export type TareaTablero = {
  id: string;
  titulo: string;
  descripcion: string;
  categoria: string;
  estado: string;
  ubicacion: string;
  latitud: number | null;
  longitud: number | null;
  autorId: string;
  autorNombre: string;
  creadoEn: string;
};

/** Una página del tablero: `hayMas` indica si existe una página siguiente. */
export type PaginaTareasTablero = {
  tareas: TareaTablero[];
  pagina: number;
  limite: number;
  hayMas: boolean;
};

/** Tiempo máximo de espera del tablero antes de tratarlo como error. */
export const TIMEOUT_TABLERO_MS = 10_000;

/**
 * Tablero de solicitudes abiertas (US-008): requiere sesión (sin token el
 * backend responde 401). Pagina con `pagina`/`limite` y, opcionalmente,
 * filtra por cercanía (`lat`, `lng` y `radio` en km). Si el servidor no
 * responde en `TIMEOUT_TABLERO_MS` la petición se aborta (error de red).
 */
export function listarTareas(
  token: string,
  opciones?: {
    pagina?: number;
    limite?: number;
    lat?: number;
    lng?: number;
    radio?: number;
  }
): Promise<PaginaTareasTablero> {
  const params = new URLSearchParams();
  for (const [clave, valor] of Object.entries(opciones ?? {})) {
    if (valor != null) params.set(clave, String(valor));
  }
  const qs = params.toString();
  return pedir(
    `/api/tareas${qs ? `?${qs}` : ''}`,
    token,
    { signal: AbortSignal.timeout(TIMEOUT_TABLERO_MS) },
    OPCIONES_TAREAS
  );
}

/** Datos públicos del autor de una tarea (US-009). */
export type AutorTareaApi = {
  id: string;
  nombre: string;
  descripcion: string | null;
  ubicacion: string | null;
  fotoUrl: string | null;
};

/**
 * Detalle de una tarea (US-009). `esPropia` y `puedeOfertar` las decide el
 * servidor; las coordenadas son aproximadas salvo para el autor.
 */
export type DetalleTareaApi = TareaTablero & {
  autor: AutorTareaApi;
  esPropia: boolean;
  puedeOfertar: boolean;
  /** El visitante ya envió una oferta a esta tarea (US-011). */
  yaPostulado: boolean;
};

const tareaNoDisponible = () => new ErrorTareaNoDisponible();
const tareaNoAceptaOfertas = () => new ErrorTareaNoAceptaOfertas();

/**
 * Detalle de una tarea. Lanza `ErrorTareaNoDisponible` si no existe o ya no
 * está abierta, y `ErrorSesionExpirada` ante un 401.
 */
export function obtenerTarea(
  token: string,
  id: string
): Promise<DetalleTareaApi> {
  return pedir(
    `/api/tareas/${encodeURIComponent(id)}`,
    token,
    { signal: AbortSignal.timeout(TIMEOUT_TABLERO_MS) },
    {
      ...OPCIONES_TAREAS,
      traducirEstados: { 404: tareaNoDisponible, 410: tareaNoDisponible },
    }
  );
}

/** Oferta registrada por el afiliado (US-011). */
export type OfertaApi = {
  id: string;
  tareaId: string;
  afiliadoId: string;
  mensaje: string | null;
  estado: string;
  creadoEn: string;
};

/**
 * Envía la oferta del afiliado a una tarea (US-011) con un mensaje opcional.
 * Lanza `ErrorYaPostulado` (409), `ErrorTareaNoAceptaOfertas` (404/410) y
 * `ErrorSesionExpirada` (401); un fallo de red o un timeout llegan como
 * `Error` genérico (la pantalla muestra el aviso de conexión).
 */
export function enviarOferta(
  token: string,
  tareaId: string,
  mensaje?: string
): Promise<OfertaApi> {
  return pedir(
    `/api/tareas/${encodeURIComponent(tareaId)}/ofertas`,
    token,
    {
      ...conJson('POST', { mensaje: mensaje?.trim() || null }),
      signal: AbortSignal.timeout(TIMEOUT_TABLERO_MS),
    },
    {
      ...OPCIONES_TAREAS,
      traducirEstados: {
        404: tareaNoAceptaOfertas,
        409: () => new ErrorYaPostulado(),
        410: tareaNoAceptaOfertas,
      },
    }
  );
}

export type SlotApi = {
  diaSemana: number;
  franjaHoraria: string;
};

export type TareaPublicaApi = {
  id: string;
  titulo: string;
  descripcion: string;
  categoria: string;
  estado: string;
  ubicacion: string;
  latitud: number | null;
  longitud: number | null;
  autorId: string;
  autorNombre: string;
  creadoEn: string;
};

/**
 * Publica una solicitud de tarea (US-006, Escenario 1).
 * 401 del backend = sesión expirada → ErrorSesionExpirada para que el
 * formulario redirija al login con aviso (Escenario 7).
 */
export function crearTarea(args: {
  token: string;
  titulo: string;
  descripcion: string;
  categoria: string;
  ubicacion: string;
  latitud?: number | null;
  longitud?: number | null;
}): Promise<TareaPublicaApi> {
  return pedir(
    '/api/tareas',
    args.token,
    conJson('POST', {
      titulo: args.titulo,
      descripcion: args.descripcion,
      categoria: args.categoria,
      ubicacion: args.ubicacion,
      latitud: args.latitud ?? null,
      longitud: args.longitud ?? null,
    }),
    OPCIONES_TAREAS
  );
}

/**
 * Lee la matriz de disponibilidad (US-005, prefill y vista).
 * Lanza Error con el mensaje del backend si algo falla.
 */
export function obtenerDisponibilidad(token: string): Promise<SlotApi[]> {
  return pedir(
    '/api/usuarios/disponibilidad',
    token,
    {},
    { mensajeSinRed: true, detectarSesionExpirada: true }
  );
}

/**
 * Reemplaza la matriz completa (US-005, Esc 2-3): el arreglo viaja tal
 * cual, incluso vacío para limpiar todo.
 */
export function guardarDisponibilidad(args: {
  token: string;
  slots: Array<{ dia: number; franja: string }>;
}): Promise<SlotApi[]> {
  return pedir(
    '/api/usuarios/disponibilidad',
    args.token,
    conJson('PUT', { slots: args.slots }),
    { mensajeSinRed: true, detectarSesionExpirada: true }
  );
}
