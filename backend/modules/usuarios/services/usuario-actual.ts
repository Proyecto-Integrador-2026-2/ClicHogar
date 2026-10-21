import { NotFoundError } from '../../../shared/errors/app-error';
import type { Usuario } from '../entities/usuario.entity';
import { usuariosRepository } from '../repositories/usuarios.repository';

/**
 * Resuelve al usuario autenticado por su clerkId. Lanza 404 si todavía no
 * sincronizó su perfil local. Centraliza la regla que repetían los
 * services y el controller de usuarios y tareas.
 */
export async function exigirUsuario(clerkId: string): Promise<Usuario> {
  const usuario = await usuariosRepository.buscarPorClerkId(clerkId);
  if (!usuario) {
    throw new NotFoundError(
      'Aún no tienes perfil local. Llama a POST /api/usuarios/sync primero.'
    );
  }
  return usuario;
}
