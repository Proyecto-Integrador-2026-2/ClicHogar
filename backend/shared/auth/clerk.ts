/**
 * Autenticación con Clerk (US-001): verifica el session token (Bearer) y
 * extrae la identidad. El email/nombre/rol nunca se confían del body:
 * salen del token verificado.
 */
import { verifyToken } from '@clerk/backend';
import { env } from '../../config/env';
import { UnauthorizedError } from '../errors/app-error';

export type SesionClerk = {
  clerkId: string;
  email: string;
  nombre: string;
  rolClerk: string | undefined;
};

/**
 * Extrae el session token (Bearer) y lo verifica contra Clerk.
 * El email/nombre/rol nunca se confía del body: sale del token verificado.
 */
export async function verificarSesionClerk(
  authorization: string | undefined
): Promise<SesionClerk> {
  if (!authorization || !authorization.startsWith('Bearer ')) {
    throw new UnauthorizedError('Falta el token de sesión.');
  }
  const token = authorization.slice('Bearer '.length).trim();
  if (!token) {
    throw new UnauthorizedError('Falta el token de sesión.');
  }

  let claims: Awaited<ReturnType<typeof verifyToken>>;
  try {
    claims = await verifyToken(token, {
      secretKey: env.CLERK_SECRET_KEY,
    });
  } catch {
    throw new UnauthorizedError('Sesión inválida o expirada.');
  }

  const clerkId = claims.sub;
  if (!clerkId) {
    throw new UnauthorizedError('El token no contiene identidad válida.');
  }

  // Los session tokens de Clerk (plantilla por defecto) solo traen `sub`:
  // email, nombre y metadata se completan desde la Backend API con la
  // secret key. Si algún día se usa una plantilla JWT con claims propios,
  // se prefieren esos (cero latencia extra).
  const delToken = {
    email: getClaimString(claims, ['email', 'email_address']),
    nombre:
      getClaimString(claims, ['name', 'full_name']) ??
      getClaimString(claims, ['first_name', 'firstName']),
    rolClerk:
      getClaimString(claims, ['rol', 'role']) ??
      getMetadataRol(claims, 'unsafe_metadata') ??
      getMetadataRol(claims, 'public_metadata'),
  };

  if (delToken.email && delToken.nombre) {
    return {
      clerkId,
      email: delToken.email.toLowerCase(),
      nombre: delToken.nombre,
      rolClerk: delToken.rolClerk,
    };
  }

  const perfil = await obtenerPerfilDesdeClerk(clerkId);
  return {
    clerkId,
    email: perfil.email,
    nombre: delToken.nombre ?? perfil.nombre,
    rolClerk: delToken.rolClerk ?? perfil.rolClerk,
  };
}

/**
 * Lee el usuario desde la Backend API de Clerk (autenticada con la secret
 * key): única fuente confiable de email/nombre/metadata con tokens
 * de plantilla por defecto.
 */
async function obtenerPerfilDesdeClerk(
  clerkId: string
): Promise<{ email: string; nombre: string; rolClerk: string | undefined }> {
  let respuesta: Response;
  try {
    respuesta = await fetch(`https://api.clerk.com/v1/users/${clerkId}`, {
      headers: { Authorization: `Bearer ${env.CLERK_SECRET_KEY}` },
    });
  } catch {
    throw new UnauthorizedError('No se pudo confirmar la identidad.');
  }
  if (respuesta.status === 404) {
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
  const meta = usuario.unsafe_metadata ?? {};
  const rol =
    typeof meta['rol'] === 'string' && meta['rol'].trim() !== ''
      ? meta['rol']
      : typeof meta['role'] === 'string' && meta['role'].trim() !== ''
        ? meta['role']
        : undefined;
  return {
    email: principal.email_address.toLowerCase(),
    nombre: nombre || principal.email_address.split('@')[0] || 'Usuario',
    rolClerk: rol,
  };
}

/** Lee la primera clave no vacía (los claims varían según plantilla). */
function getClaimString(
  claims: Record<string, unknown>,
  keys: string[]
): string | undefined {
  for (const key of keys) {
    const value = claims[key];
    if (typeof value === 'string' && value.trim() !== '') return value;
  }
  return undefined;
}

/** Lee `rol`/`role` dentro de una metadata de Clerk (unsafe/public). */
function getMetadataRol(
  claims: Record<string, unknown>,
  metaKey: string
): string | undefined {
  const meta = claims[metaKey];
  if (typeof meta !== 'object' || meta === null) return undefined;
  for (const k of ['rol', 'role']) {
    const v = (meta as Record<string, unknown>)[k];
    if (typeof v === 'string' && v.trim() !== '') return v;
  }
  return undefined;
}
