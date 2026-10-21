/**
 * Cliente mínimo de la Backend API de Clerk: respaldo cuando el session
 * token solo trae `sub` y faltan email, nombre o rol.
 */
import { env } from '../../config/env';
import { UnauthorizedError } from '../errors/app-error';
import { getMetadataRol } from './clerk-claims';

export type PerfilClerk = {
  email: string;
  nombre: string;
  rolClerk: string | undefined;
};

/**
 * Lee el usuario desde la Backend API de Clerk (autenticada con la secret
 * key): única fuente confiable de email/nombre/metadata con tokens
 * de plantilla por defecto.
 */
export async function obtenerPerfilDesdeClerk(
  clerkId: string
): Promise<PerfilClerk> {
  let respuesta: Response;
  try {
    respuesta = await fetch(`https://api.clerk.com/v1/users/${clerkId}`, {
      headers: { Authorization: `Bearer ${env.CLERK_SECRET_KEY}` },
    });
  } catch {
    throw new UnauthorizedError('No se pudo confirmar la identidad.');
  }
  if (!respuesta.ok) {
    throw new UnauthorizedError('No se pudo confirmar la identidad.');
  }
  const usuario = (await respuesta.json()) as {
    email_addresses?: Array<{
      id: string;
      email_address: string;
    }>;
    primary_email_address_id?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    unsafe_metadata?: Record<string, unknown> | null;
  };

  const emails = usuario.email_addresses ?? [];
  const principal =
    emails.find((e) => e.id === usuario.primary_email_address_id) ?? emails[0];
  if (!principal) {
    throw new UnauthorizedError('El token no contiene identidad válida.');
  }
  const nombre = [usuario.first_name, usuario.last_name]
    .filter(Boolean)
    .join(' ')
    .trim();
  return {
    email: principal.email_address.toLowerCase(),
    nombre: nombre || principal.email_address.split('@')[0] || 'Usuario',
    rolClerk: getMetadataRol(usuario, 'unsafe_metadata'),
  };
}
