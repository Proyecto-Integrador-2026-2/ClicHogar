import { ValidationError } from '../../../shared/errors/app-error';
import type { Usuario } from '../entities/usuario.entity';
import {
  toUsuarioPublico,
  type UsuarioPublico,
} from '../mappers/usuario.mapper';
import type { UsuariosRepositorio } from '../ports';
import { usuariosRepository } from '../repositories/usuarios.repository';
import {
  MAX_FOTO_BYTES,
  almacenamientoLocal,
  detectarMimeFoto,
  type AlmacenamientoFotos,
} from '../storage/almacenamiento';
import { crearExigirUsuario } from './usuario-actual';

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

type Dependencias = Pick<
  UsuariosRepositorio,
  'buscarPorClerkId' | 'actualizarParcial'
>;

/** Construye el service con el repositorio recibido (inyección). */
export function crearPerfilService(usuarios: Dependencias) {
  const exigirUsuario = crearExigirUsuario(usuarios);

  return {
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
      const existente = await exigirUsuario(args.clerkId);

      const patch = normalizarPatch({
        descripcion: args.descripcion,
        ubicacion: args.ubicacion,
      });

      if (args.foto) {
        patch.fotoUrl = await guardarFoto(args.foto, args.almacenamiento);
      }

      const actualizado = await usuarios.actualizarParcial(existente.id, patch);
      return toUsuarioPublico(actualizado);
    },
  };
}

export const perfilService = crearPerfilService(usuariosRepository);

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
    throw new ValidationError('El archivo no es una imagen JPG o PNG válida.');
  }
  const guardada = await almacenamiento.guardar(foto.datos, mimeReal);
  return guardada.url;
}
