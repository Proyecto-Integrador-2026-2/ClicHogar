import type { AutorTarea, Tarea } from '../entities/tarea.entity';

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

/**
 * Tarea del propio usuario con el número de ofertas recibidas (US-012) y si
 * le falta calificar el servicio (US-016, Escenario 6).
 */
export type TareaPropia = TareaPublica & {
  totalOfertas: number;
  calificacionPendiente: boolean;
};

export function toTareaPropia(
  tarea: Tarea,
  autorNombre: string,
  totalOfertas: number,
  calificacionPendiente: boolean
): TareaPropia {
  return {
    ...toTareaPublica(tarea, autorNombre),
    totalOfertas,
    calificacionPendiente,
  };
}

/**
 * Detalle de una tarea (US-009): la tarea pública, los datos públicos de su
 * autor y las banderas que decide el servidor (`esPropia`, `puedeOfertar`)
 * para que el frontend no tenga que inferirlas.
 */
export type DetalleTarea = TareaPublica & {
  autor: AutorTarea;
  esPropia: boolean;
  puedeOfertar: boolean;
  /** El visitante ya envió una oferta a esta tarea (US-011). */
  yaPostulado: boolean;
  /** El visitante es el afiliado elegido para esta tarea (US-013). */
  esAsignado: boolean;
  /** El creador puede cerrarla: está asignada y es suya (US-014). */
  puedeFinalizar: boolean;
  /**
   * Contraparte de una tarea asignada (US-013, Esc 2): el afiliado para el
   * creador y el creador para el afiliado. null para cualquier otra persona.
   */
  contacto: { nombre: string; email: string } | null;
  /** Afiliado elegido, visible solo para el creador. */
  afiliadoAsignado: { id: string; nombre: string } | null;
};

/** Redondea a 2 decimales (~1 km): ubicación aproximada para terceros. */
function aproximar(valor: number | null): number | null {
  return valor === null ? null : Math.round(valor * 100) / 100;
}

export function toDetalleTarea(
  tarea: Tarea,
  autor: AutorTarea,
  banderas: Pick<
    DetalleTarea,
    | 'esPropia'
    | 'puedeOfertar'
    | 'yaPostulado'
    | 'esAsignado'
    | 'puedeFinalizar'
    | 'contacto'
    | 'afiliadoAsignado'
  >
): DetalleTarea {
  const publica = toTareaPublica(tarea, autor.nombre);
  return {
    ...publica,
    // Solo el autor ve el punto exacto; los demás, una zona aproximada.
    latitud: banderas.esPropia ? publica.latitud : aproximar(publica.latitud),
    longitud: banderas.esPropia
      ? publica.longitud
      : aproximar(publica.longitud),
    autor,
    ...banderas,
  };
}
