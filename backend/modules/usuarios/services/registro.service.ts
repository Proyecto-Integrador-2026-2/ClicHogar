import { ConflictError } from '../../../shared/errors/app-error';
import type { SesionClerk } from '../../../shared/auth/clerk';
import { hashPassword } from '../../../shared/security/password';
import type { RegistrarUsuarioInput } from '../dto/registrar-usuario.dto';
import type { SincronizarUsuarioInput } from '../dto/sincronizar-usuario.dto';
import {
  toUsuarioPublico,
  type UsuarioPublico,
} from '../mappers/usuario.mapper';
import { usuariosRepository } from '../repositories/usuarios.repository';
import type { RolUsuario } from '../entities/usuario.entity';

// Código de PostgreSQL para violación de restricción UNIQUE.
const PG_UNIQUE_VIOLATION = '23505';

export const registroService = {
  /**
   * Flujo Clerk (US-001): idempotente. Si el clerkId ya existe devuelve el
   * usuario; si no, lo crea usando email/nombre del token verificado.
   * El rol se resuelve: body > metadata Clerk > 'cliente'.
   */
  async sincronizarDesdeClerk(
    sesion: SesionClerk,
    input: SincronizarUsuarioInput
  ): Promise<{ usuario: UsuarioPublico; creado: boolean }> {
    const existente = await usuariosRepository.buscarPorClerkId(sesion.clerkId);
    if (existente) {
      return { usuario: toUsuarioPublico(existente), creado: false };
    }

    const rol = normalizarRol(input.rol ?? sesion.rolClerk ?? 'cliente');
    const nombre = (input.nombre ?? sesion.nombre).trim().slice(0, 120);

    try {
      const usuario = await usuariosRepository.crear({
        clerkId: sesion.clerkId,
        nombre: nombre || 'Usuario',
        email: sesion.email,
        passwordHash: null,
        rol,
      });
      return { usuario: toUsuarioPublico(usuario), creado: true };
    } catch (error) {
      if (isUniqueViolation(error)) {
        // Carrera o email ya registrado por otro medio: si el email existe
        // con otro clerkId se reporta como conflicto para no fusionar cuentas.
        throw new ConflictError(
          'Ya existe una cuenta registrada con ese email.'
        );
      }
      throw error;
    }
  },

  /**
   * Flujo legacy con password (pre-Clerk).
   * @deprecated Usa `sincronizarDesdeClerk` (POST /api/usuarios/sync).
   * Se conserva solo por compatibilidad con clientes antiguos.
   */
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

/** Mapea 'Usuario'->'cliente', 'Afiliado'->'afiliado'; defecto 'cliente'. */
function normalizarRol(valor: string | undefined): RolUsuario {
  const v = (valor ?? '').trim().toLowerCase();
  if (v === 'afiliado') return 'afiliado';
  return 'cliente';
}
