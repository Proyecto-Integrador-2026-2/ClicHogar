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
 * Detalle de una tarea (US-009): la tarea pública, los datos públicos de su
 * autor y las banderas que decide el servidor (`esPropia`, `puedeOfertar`)
 * para que el frontend no tenga que inferirlas.
 */
export type DetalleTarea = TareaPublica & {
  autor: AutorTarea;
  esPropia: boolean;
  puedeOfertar: boolean;
};

/** Redondea a 2 decimales (~1 km): ubicación aproximada para terceros. */
function aproximar(valor: number | null): number | null {
  return valor === null ? null : Math.round(valor * 100) / 100;
}

export function toDetalleTarea(
  tarea: Tarea,
  autor: AutorTarea,
  banderas: { esPropia: boolean; puedeOfertar: boolean }
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
