import type { Usuario } from '../usuarios/entities/usuario.entity';
import { authService } from './services/auth.service';

type Cabeceras = Record<string, string | undefined>;

/** Extrae el token de `Authorization: Bearer <token>` ('' si no viene). */
export function tokenDesdeHeaders(headers: Cabeceras): string {
  const auth = headers.authorization ?? headers.Authorization;
  if (!auth?.startsWith('Bearer ')) return '';
  return auth.slice('Bearer '.length).trim();
}

/** Usuario de la sesión del request; 401 si falta o expiró el token. */
export function usuarioDesdeHeaders(headers: Cabeceras): Promise<Usuario> {
  return authService.resolverUsuario(tokenDesdeHeaders(headers));
}
