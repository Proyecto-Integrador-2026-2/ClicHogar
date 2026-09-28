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
