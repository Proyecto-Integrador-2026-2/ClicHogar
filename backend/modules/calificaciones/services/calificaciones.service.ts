import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../../shared/errors/app-error';
import { ESTADO_FINALIZADA } from '../../tareas/categorias';
import type { TareaEncontrada } from '../../tareas/entities/tarea.entity';
import { tareasRepository } from '../../tareas/repositories/tareas.repository';
import type { Usuario } from '../../usuarios/entities/usuario.entity';
import {
  calificacionesRepository,
  type CalificacionFila,
} from '../repositories/calificaciones.repository';

export const MENSAJE_YA_CALIFICADA =
  'Ya has enviado tu valoración para esta tarea anteriormente.';
export const MENSAJE_SOLO_CREADOR_CALIFICA =
  'Solo el creador de la tarea puede calificar el servicio.';
export const MENSAJE_TAREA_NO_FINALIZADA =
  'Solo puedes calificar una tarea que ya está finalizada.';

export type DatosCalificacion = {
  tareaId: string;
  puntuacion: number;
  comentario?: string | null;
};

/** Lo que necesita el formulario de calificación de una tarea. */
export type FormularioCalificacion = {
  tareaId: string;
  titulo: string;
  afiliado: { id: string; nombre: string };
  yaCalificada: boolean;
};

/**
 * La tarea debe existir, ser del visitante y estar finalizada con un
 * afiliado asignado: solo así hay a quién calificar (US-016).
 */
async function tareaCalificable(
  autor: Pick<Usuario, 'id'>,
  tareaId: string
): Promise<
  TareaEncontrada & { asignado: NonNullable<TareaEncontrada['asignado']> }
> {
  const encontrada = await tareasRepository.buscarPorId(tareaId, autor.id);
  if (!encontrada) throw new NotFoundError('Tarea no encontrada.');
  if (encontrada.tarea.usuarioId !== autor.id) {
    throw new ForbiddenError(MENSAJE_SOLO_CREADOR_CALIFICA);
  }
  if (encontrada.tarea.estado !== ESTADO_FINALIZADA || !encontrada.asignado) {
    throw new ValidationError(MENSAJE_TAREA_NO_FINALIZADA);
  }
  return { ...encontrada, asignado: encontrada.asignado };
}

export const calificacionesService = {
  /**
   * Califica el servicio de una tarea finalizada (US-016): de 1 a 5, con
   * reseña opcional (en blanco = sin reseña). Solo el creador, una vez por
   * tarea, y siempre al afiliado asignado: el cliente no elige a quién.
   */
  async crear(
    autor: Pick<Usuario, 'id'>,
    datos: DatosCalificacion
  ): Promise<CalificacionFila> {
    await tareaCalificable(autor, datos.tareaId);
    const resultado = await calificacionesRepository.crearParaTarea({
      tareaId: datos.tareaId,
      autorId: autor.id,
      puntuacion: datos.puntuacion,
      comentario: datos.comentario?.trim() || null,
    });
    if (resultado.tipo === 'duplicada') {
      throw new ConflictError(MENSAJE_YA_CALIFICADA);
    }
    if (resultado.tipo === 'no-elegible') {
      throw new ValidationError(MENSAJE_TAREA_NO_FINALIZADA);
    }
    return resultado.calificacion;
  },

  /**
   * Datos del formulario de calificación (US-016): a quién se califica y si
   * ya se hizo (Esc 5: entonces el formulario se bloquea).
   */
  async formulario(
    autor: Pick<Usuario, 'id'>,
    tareaId: string
  ): Promise<FormularioCalificacion> {
    const { tarea, asignado } = await tareaCalificable(autor, tareaId);
    return {
      tareaId,
      titulo: tarea.titulo,
      afiliado: { id: asignado.id, nombre: asignado.nombre },
      yaCalificada: await calificacionesRepository.existe(tareaId, autor.id),
    };
  },

  listarPorUsuario(usuarioId: string): Promise<CalificacionFila[]> {
    return calificacionesRepository.listarPorDestinatario(usuarioId);
  },
};
