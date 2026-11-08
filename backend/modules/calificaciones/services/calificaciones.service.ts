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
import { usuariosRepository } from '../../usuarios/repositories/usuarios.repository';
import { redondearPromedio } from '../redondeo';
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

/** Valoración de un servicio tal como se muestra en el perfil (US-017). */
export type Valoracion = {
  id: string;
  puntuacion: number;
  comentario: string | null;
  /** Cuándo se calificó. */
  fecha: Date;
  /** Cuándo se realizó (finalizó) el servicio. */
  fechaServicio: Date | null;
  cliente: { nombre: string };
};

/** Reputación pública de un afiliado (US-017). */
export type Reputacion = {
  /** Promedio con 1 decimal; null si aún no tiene valoraciones. */
  promedio: number | null;
  total: number;
  valoraciones: Valoracion[];
};

/** Cuántas valoraciones recientes se listan en el perfil. */
export const LIMITE_VALORACIONES = 50;

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

  /**
   * Reputación pública de un afiliado (US-017), calculada al consultarla:
   * así siempre refleja las últimas valoraciones (Esc 1). Solo cuentan las
   * de tareas asignadas y finalizadas (Esc 5). El promedio sale redondeado
   * a 1 decimal (Esc 4) y es null sin valoraciones (Esc 3: sin "0.0").
   */
  async obtenerReputacion(usuarioId: string): Promise<Reputacion> {
    if (!(await usuariosRepository.buscarPorId(usuarioId))) {
      throw new NotFoundError('Usuario no encontrado.');
    }
    const [resumen, filas] = await Promise.all([
      calificacionesRepository.reputacion(usuarioId),
      calificacionesRepository.listarVerificadas(
        usuarioId,
        LIMITE_VALORACIONES
      ),
    ]);
    return {
      promedio: redondearPromedio(resumen.promedio),
      total: resumen.total,
      valoraciones: filas.map((fila) => ({
        id: fila.id,
        puntuacion: fila.puntuacion,
        comentario: fila.comentario,
        fecha: fila.creado_en,
        fechaServicio: fila.finalizada_en,
        cliente: { nombre: fila.cliente_nombre },
      })),
    };
  },
};
