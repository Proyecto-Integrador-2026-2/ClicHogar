import { NotFoundError } from '../../../shared/errors/app-error';
import type { Usuario } from '../entities/usuario.entity';
import type { UsuariosRepositorio } from '../ports';
import { usuariosRepository } from '../repositories/usuarios.repository';

/**
 * Construye `exigirUsuario` sobre el repositorio recibido: resuelve al
 * usuario autenticado por su id y lanza 404 si no existe. Centraliza la regla que repetían los services y el
 * controller de usuarios y tareas.
 */
export function crearExigirUsuario(
  usuarios: Pick<UsuariosRepositorio, 'buscarPorId'>
) {
  return async (usuarioId: string): Promise<Usuario> => {
    const usuario = await usuarios.buscarPorId(usuarioId);
    if (!usuario) {
      throw new NotFoundError('Usuario no encontrado.');
    }
    return usuario;
  };
}

export const exigirUsuario = crearExigirUsuario(usuariosRepository);
