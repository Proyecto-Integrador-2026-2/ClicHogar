import type { Tarea } from '../entities/tarea.entity';

/**
 * Forma pública de una tarea: todos sus campos son visibles por diseño
 * (el marketplace muestra tareas ajenas), así que no se oculta nada;
 * el mapper existe para fijar el contrato ante cambios futuros.
 */
export type TareaPublica = {
  id: string;
  titulo: string;
  descripcion: string;
  categoria: Tarea['categoria'];
  estado: string;
  ubicacion: string;
  latitud: number | null;
  longitud: number | null;
  /** Id del autor (para consultar perfil público). */
  autorId: string;
  /** Nombre del autor (US-008: el tablero muestra quién publica). */
  autorNombre: string;
  creadoEn: Date;
};

export function toTareaPublica(
  tarea: Tarea,
  autorNombre: string
): TareaPublica {
  return {
    id: tarea.id,
    titulo: tarea.titulo,
    descripcion: tarea.descripcion,
    categoria: tarea.categoria,
    estado: tarea.estado,
    ubicacion: tarea.ubicacion,
    latitud: tarea.latitud,
    longitud: tarea.longitud,
    autorId: tarea.usuarioId,
    autorNombre,
    creadoEn: tarea.creadoEn,
  };
}
