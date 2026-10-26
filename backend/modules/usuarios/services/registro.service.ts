import { ConflictError } from '../../../shared/errors/app-error';
import type { SesionClerk } from '../../../shared/auth/clerk';
import type { SincronizarUsuarioInput } from '../dto/sincronizar-usuario.dto';
import {
  toUsuarioPublico,
  type UsuarioPublico,
} from '../mappers/usuario.mapper';
import type { UsuariosRepositorio } from '../ports';
import { usuariosRepository } from '../repositories/usuarios.repository';
import type { RolUsuario } from '../entities/usuario.entity';

// Código de PostgreSQL para violación de restricción UNIQUE.
const PG_UNIQUE_VIOLATION = '23505';

type Dependencias = Pick<UsuariosRepositorio, 'buscarPorClerkId' | 'crear'>;

/** Construye el service con el repositorio recibido (inyección). */
export function crearRegistroService(usuarios: Dependencias) {
  return {
    /**
     * Flujo Clerk (US-001): idempotente. Si el clerkId ya existe devuelve el
     * usuario; si no, lo crea usando email/nombre del token verificado.
     * El rol se resuelve: body > metadata Clerk > 'cliente'.
     */
    async sincronizarDesdeClerk(
      sesion: SesionClerk,
      input: SincronizarUsuarioInput
    ): Promise<{ usuario: UsuarioPublico; creado: boolean }> {
      const existente = await usuarios.buscarPorClerkId(sesion.clerkId);
      if (existente) {
        return { usuario: toUsuarioPublico(existente), creado: false };
      }

      const rol = normalizarRol(input.rol ?? sesion.rolClerk ?? 'cliente');
      const nombre = (input.nombre ?? sesion.nombre).trim().slice(0, 120);

      try {
        const usuario = await usuarios.crear({
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
  };
}

export const registroService = crearRegistroService(usuariosRepository);

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
