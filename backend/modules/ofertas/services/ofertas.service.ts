import {
  ConflictError,
  ForbiddenError,
  GoneError,
  NotFoundError,
} from '../../../shared/errors/app-error';
import { ESTADO_INICIAL_TAREA } from '../../tareas/categorias';
import { tareasRepository } from '../../tareas/repositories/tareas.repository';
import type { Usuario } from '../../usuarios/entities/usuario.entity';
import type { Oferta } from '../entities/oferta.entity';
import { ofertasRepository } from '../repositories/ofertas.repository';

export const MENSAJE_YA_POSTULADO = 'Ya te has postulado a esta tarea.';
export const MENSAJE_NO_ACEPTA_OFERTAS =
  'Lo sentimos, esta tarea ya no acepta nuevas ofertas en este momento';

export const ofertasService = {
  /**
   * Envía la oferta de un afiliado a una tarea (US-011). Reglas: solo
   * afiliados (Esc 4), no en la propia tarea, una sola vez por tarea (Esc 3)
   * y solo mientras esté abierta (Esc 5). Las comprobaciones previas dan el
   * error correcto sin tocar la escritura; la inserción vuelve a verificarlo
   * de forma atómica para cubrir la carrera con una asignación.
   */
  async enviar(
    afiliado: Pick<Usuario, 'id' | 'rol'>,
    tareaId: string,
    mensaje?: string | null
  ): Promise<Oferta> {
    if (afiliado.rol !== 'afiliado') {
      throw new ForbiddenError('Solo los afiliados pueden enviar ofertas.');
    }
    const encontrada = await tareasRepository.buscarPorId(tareaId, afiliado.id);
    if (!encontrada) throw new NotFoundError('Tarea no encontrada.');
    if (encontrada.tarea.usuarioId === afiliado.id) {
      throw new ForbiddenError('No puedes ofertar en tu propia tarea.');
    }
    if (encontrada.yaPostulado) throw new ConflictError(MENSAJE_YA_POSTULADO);
    if (encontrada.tarea.estado !== ESTADO_INICIAL_TAREA) {
      throw new GoneError(MENSAJE_NO_ACEPTA_OFERTAS);
    }

    const resultado = await ofertasRepository.crear({
      tareaId,
      afiliadoId: afiliado.id,
      mensaje: mensaje?.trim() || null,
    });
    if (resultado.tipo === 'duplicada') {
      throw new ConflictError(MENSAJE_YA_POSTULADO);
    }
    if (resultado.tipo === 'no-abierta') {
      throw new GoneError(MENSAJE_NO_ACEPTA_OFERTAS);
    }
    return resultado.oferta;
  },
};
