import {
  NotFoundError,
  ValidationError,
} from '../../../shared/errors/app-error';
import type { Usuario } from '../entities/usuario.entity';
import {
  toUsuarioPublico,
  type UsuarioPublico,
} from '../mappers/usuario.mapper';
import { usuariosRepository } from '../repositories/usuarios.repository';
import {
  MAX_FOTO_BYTES,
  almacenamientoLocal,
  detectarMimeFoto,
  type AlmacenamientoFotos,
} from '../storage/almacenamiento';

export type FotoRecibida = {
  datos: Uint8Array;
  mimeDeclarado: string;
  tamano: number;
};

export type PatchPerfilNormalizado = Partial<
  Pick<Usuario, 'fotoUrl' | 'descripcion' | 'ubicacion'>
>;

/**
 * Normaliza el patch de perfil: solo los campos presentes entran
 * (ausente = no tocar, Escenario 2), recortados y acotados.
 * Pura y unit-testeable.
 */
export function normalizarPatch(input: {
  descripcion?: string;
  ubicacion?: string;
}): PatchPerfilNormalizado {
  const patch: PatchPerfilNormalizado = {};
  if (input.descripcion !== undefined) {
    patch.descripcion = input.descripcion.trim().slice(0, 500);
  }
  if (input.ubicacion !== undefined) {
    patch.ubicacion = input.ubicacion.trim().slice(0, 120);
  }
  return patch;
}

export const perfilService = {
  /**
   * Actualización parcial del perfil (US-004): resuelve al usuario por
   * clerkId (404 si aún no sincronizó), valida y guarda la foto, y
   * persiste solo los campos recibidos. Devuelve el perfil público.
   */
  async actualizarPerfil(args: {
    clerkId: string;
    descripcion?: string;
    ubicacion?: string;
    foto?: FotoRecibida;
    almacenamiento?: AlmacenamientoFotos;
  }): Promise<UsuarioPublico> {
    const existente = await usuariosRepository.buscarPorClerkId(args.clerkId);
    if (!existente) {
      throw new NotFoundError(
        'Aún no tienes perfil local. Llama a POST /api/usuarios/sync primero.'
      );
    }

    const patch = normalizarPatch({
      descripcion: args.descripcion,
      ubicacion: args.ubicacion,
    });

    if (args.foto) {
      patch.fotoUrl = await guardarFoto(args.foto, args.almacenamiento);
    }

    const actualizado = await usuariosRepository.actualizarParcial(
      existente.id,
      patch
    );
    return toUsuarioPublico(actualizado);
  },
};

/** Valida bytes reales y guarda; devuelve la URL pública. */
async function guardarFoto(
  foto: FotoRecibida,
  almacenamiento: AlmacenamientoFotos = almacenamientoLocal
): Promise<string> {
  if (foto.tamano > MAX_FOTO_BYTES || foto.datos.length > MAX_FOTO_BYTES) {
    throw new ValidationError('La foto debe ser JPG o PNG de máximo 5MB.');
  }
  const mimeReal = detectarMimeFoto(foto.datos);
  if (!mimeReal) {
    throw new ValidationError(
      'El archivo no es una imagen JPG o PNG válida.'
    );
  }
  const guardada = await almacenamiento.guardar(foto.datos, mimeReal);
  return guardada.url;
}
