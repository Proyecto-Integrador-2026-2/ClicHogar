/// <reference types="astro/client" />
/**
 * API del módulo `usuarios` (US-001): sincronización del perfil local en
 * Postgres a partir de la sesión de Clerk. La identidad siempre viene del
 * session token verificado en el backend, nunca del body.
 * La URL se configura con `PUBLIC_API_URL` (ver `frontend/.env.example`).
 */

const API_URL =
  import.meta.env.PUBLIC_API_URL ??
  (import.meta.env.DEV ? 'http://localhost:3000' : '');

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

/**
 * Crea (o recupera, es idempotente) el perfil local en Postgres a partir de
 * la sesión de Clerk. Debe llamarse con el session token recién obtenido.
 * Lanza Error con el mensaje del backend si algo falla.
 */
export async function sincronizarUsuarioConBackend(args: {
  token: string;
  nombre: string;
  rol: 'Usuario' | 'Afiliado' | string;
}): Promise<UsuarioPublico> {
  if (!API_URL) {
    throw new Error(
      'Falta PUBLIC_API_URL. Crea frontend/.env desde .env.example.'
    );
  }
  const respuesta = await fetch(`${API_URL}/api/usuarios/sync`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${args.token}`,
    },
    body: JSON.stringify({
      nombre: args.nombre,
      rol: normalizarRolParaBackend(args.rol),
    }),
  });

  if (!respuesta.ok) {
    const detalle = await respuesta.json().catch(() => null);
    const mensaje =
      (detalle as { message?: string } | null)?.message ??
      `El backend respondió ${respuesta.status}.`;
    throw new Error(mensaje);
  }
  return (await respuesta.json()) as UsuarioPublico;
}

/**
 * Lee el perfil local del usuario autenticado (US-002, redirección por rol).
 * Requiere el session token de Clerk; el backend resuelve el rol desde
 * Postgres. Lanza Error con el mensaje del backend si algo falla.
 */
export async function obtenerPerfil(token: string): Promise<UsuarioPublico> {
  if (!API_URL) {
    throw new Error(
      'Falta PUBLIC_API_URL. Crea frontend/.env desde .env.example.'
    );
  }
  const respuesta = await fetch(`${API_URL}/api/usuarios/yo`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!respuesta.ok) {
    const detalle = await respuesta.json().catch(() => null);
    const mensaje =
      (detalle as { message?: string } | null)?.message ??
      `El backend respondió ${respuesta.status}.`;
    throw new Error(mensaje);
  }
  return (await respuesta.json()) as UsuarioPublico;
}

/**
 * Actualización parcial del perfil (US-004, Escenario 2): solo viajan los
 * campos presentes; lo ausente no se toca en el servidor.
 */
export async function actualizarPerfil(args: {
  token: string;
  foto?: File;
  descripcion?: string;
  ubicacion?: string;
}): Promise<UsuarioPublico> {
  if (!API_URL) {
    throw new Error(
      'Falta PUBLIC_API_URL. Crea frontend/.env desde .env.example.'
    );
  }
  const forma = new FormData();
  if (args.foto) forma.append('foto', args.foto);
  if (args.descripcion !== undefined)
    forma.append('descripcion', args.descripcion);
  if (args.ubicacion !== undefined) forma.append('ubicacion', args.ubicacion);

  const respuesta = await fetch(`${API_URL}/api/usuarios/yo`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${args.token}` },
    body: forma,
  });

  if (!respuesta.ok) {
    const detalle = await respuesta.json().catch(() => null);
    const mensaje =
      (detalle as { message?: string } | null)?.message ??
      `El backend respondió ${respuesta.status}.`;
    throw new Error(mensaje);
  }
  return (await respuesta.json()) as UsuarioPublico;
}

/** Convierte una ruta pública del backend (`/uploads/...`) en URL absoluta. */
export function urlPublica(rutaRelativa: string): string {
  if (!API_URL) return rutaRelativa;
  return `${API_URL}${rutaRelativa}`;
}
