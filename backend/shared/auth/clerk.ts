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
  const email = getClaimString(claims, ['email', 'email_address']);
  const nombre =
    getClaimString(claims, ['name', 'full_name']) ??
    getClaimString(claims, ['first_name', 'firstName']) ??
    (email ? email.split('@')[0] : null) ??
    'Usuario';
  const rolClerk =
    getClaimString(claims, ['rol', 'role']) ??
    getMetadataRol(claims, 'unsafe_metadata') ??
    getMetadataRol(claims, 'public_metadata');

  if (!clerkId || !email) {
    throw new UnauthorizedError('El token no contiene identidad válida.');
  }

  return { clerkId, email: email.toLowerCase(), nombre, rolClerk };
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
