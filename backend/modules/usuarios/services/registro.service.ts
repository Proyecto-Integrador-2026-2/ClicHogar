import { ConflictError } from '../../../shared/errors/app-error';
import { hashPassword } from '../../../shared/security/password';
import type { RegistrarUsuarioInput } from '../dto/registrar-usuario.dto';
import {
  toUsuarioPublico,
  type UsuarioPublico,
} from '../mappers/usuario.mapper';
import { usuariosRepository } from '../repositories/usuarios.repository';

// Código de PostgreSQL para violación de restricción UNIQUE.
const PG_UNIQUE_VIOLATION = '23505';

export const registroService = {
  async registrarUsuario(
    input: RegistrarUsuarioInput
  ): Promise<UsuarioPublico> {
    // El email se normaliza a minúsculas para que la unicidad y el login
    // no dependan de cómo el usuario escribió las mayúsculas.
    const email = input.email.trim().toLowerCase();
    const nombre = input.nombre.trim();

    // Verificación de Duplicados (HU1): chequeo explícito antes de insertar
    // para poder devolver un 409 claro en el caso normal.
    const existente = await usuariosRepository.buscarPorEmail(email);
    if (existente) {
      throw new ConflictError('Ya existe una cuenta registrada con ese email.');
    }

    // Seguridad de Credenciales (HU1): la contraseña nunca se guarda en
    // texto plano, solo su hash argon2id.
    const passwordHash = await hashPassword(input.password);

    try {
      const usuario = await usuariosRepository.crear({
        nombre,
        email,
        passwordHash,
        rol: input.rol ?? 'cliente',
      });
      return toUsuarioPublico(usuario);
    } catch (error) {
      // Defensa contra condición de carrera: dos registros concurrentes con
      // el mismo email pueden pasar el chequeo anterior a la vez; la
      // restricción UNIQUE de la base de datos es la garantía final.
      if (isUniqueViolation(error)) {
        throw new ConflictError(
          'Ya existe una cuenta registrada con ese email.'
        );
      }
      throw error;
    }
  },
};

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === PG_UNIQUE_VIOLATION
  );
}
