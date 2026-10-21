/**
 * Autenticación con Clerk (US-001): verifica el session token (Bearer) y
 * extrae la identidad. El email/nombre/rol nunca se confían del body:
 * salen del token verificado.
 */
import { verifyToken } from '@clerk/backend';
import { env } from '../../config/env';
import { UnauthorizedError } from '../errors/app-error';
import { obtenerPerfilDesdeClerk } from './clerk-api';
import { getClaimString, getMetadataRol } from './clerk-claims';

export type SesionClerk = {
  clerkId: string;
  email: string;
  nombre: string;
  rolClerk: string | undefined;
};

/**
 * Extrae y verifica la sesión Clerk del header `Authorization`.
 * Centraliza el 401: ningún handler toca tokens sin verificar.
 * Vive en la capa compartida para reusarse entre módulos.
 */
export async function sesionDesdeHeaders(
  headers: Record<string, string | undefined>
): Promise<SesionClerk> {
  return verificarSesionClerk(headers['authorization']);
}

/**
 * Extrae el session token (Bearer) y lo verifica contra Clerk.
 * El email/nombre/rol nunca se confían del body: salen del token
 * verificado (o de la Backend API como respaldo).
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
