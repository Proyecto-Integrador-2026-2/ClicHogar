import { exigirUsuario } from '../../usuarios/services/usuario-actual';
import { ESTADO_INICIAL_TAREA } from '../categorias';
import { toTareaPublica, type TareaPublica } from '../mappers/tarea.mapper';
import { tareasRepository } from '../repositories/tareas.repository';
import {
  normalizarTarea,
  type DatosTareaCrudos,
} from '../validators/tarea.validator';

export const tareasService = {
  /**
   * Publica una tarea (US-006): resuelve al autor por clerkId (404 sin
   * perfil), normaliza, fija estado 'abierta' (#118) y persiste.
   */
  async crearTarea(
    clerkId: string,
    entrada: DatosTareaCrudos
  ): Promise<TareaPublica> {
    const autor = await exigirUsuario(clerkId);
    const datos = normalizarTarea(entrada);
    const tarea = await tareasRepository.crear({
      usuarioId: autor.id,
      ...datos,
      estado: ESTADO_INICIAL_TAREA,
    });
    return toTareaPublica(tarea, autor.nombre);
  },

  /**
   * Tablero de solicitudes abiertas (US-008): requiere sesión (el
   * controller ya la verificó); el rol no filtra porque el tablero es
   * el mismo para quien explore.
   */
  async listarAbiertas(): Promise<TareaPublica[]> {
    const filas = await tareasRepository.listarAbiertas();
    return filas.map(({ tarea, autorNombre }) =>
      toTareaPublica(tarea, autorNombre)
    );
  },
};
