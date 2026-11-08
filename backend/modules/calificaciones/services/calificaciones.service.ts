import {
  NotFoundError,
  ValidationError,
} from '../../../shared/errors/app-error';
import { usuariosRepository } from '../../usuarios/repositories/usuarios.repository';
import {
  calificacionesRepository,
  type CalificacionFila,
} from '../repositories/calificaciones.repository';

export type DatosCalificacion = {
  destinatarioId: string;
  tareaId?: string | null;
  puntuacion: number;
  comentario?: string | null;
};

export const calificacionesService = {
  /** Califica a otro usuario: existe, no es uno mismo; comentario vacío = sin comentario. */
  async crear(
    autorId: string,
    datos: DatosCalificacion
  ): Promise<CalificacionFila> {
    if (datos.destinatarioId === autorId) {
      throw new ValidationError('No puedes calificarte a ti mismo.');
    }
    if (!(await usuariosRepository.buscarPorId(datos.destinatarioId))) {
      throw new NotFoundError('Usuario no encontrado.');
    }
    return calificacionesRepository.crear({
      autorId,
      destinatarioId: datos.destinatarioId,
      tareaId: datos.tareaId ?? null,
      puntuacion: datos.puntuacion,
      comentario: datos.comentario?.trim() || null,
    });
  },

  listarPorUsuario(usuarioId: string): Promise<CalificacionFila[]> {
    return calificacionesRepository.listarPorDestinatario(usuarioId);
  },
};
