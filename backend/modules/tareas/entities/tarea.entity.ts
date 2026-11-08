import type { Categoria } from '../categorias';

/**
 * Solicitud de tarea (US-006) tal como la usa la app (camelCase).
 * `usuarioId` y `estado` los fija el servidor: jamás vienen del body.
 */
export type Tarea = {
  id: string;
  usuarioId: string;
  titulo: string;
  descripcion: string;
  categoria: Categoria;
  estado: string;
  ubicacion: string;
  latitud: number | null;
  longitud: number | null;
  creadoEn: Date;
  actualizadoEn: Date;
};

/** Datos públicos del autor que acompañan al detalle de una tarea. */
export type AutorTarea = {
  id: string;
  nombre: string;
  descripcion: string | null;
  ubicacion: string | null;
  fotoUrl: string | null;
};

/** Campos para insertar una tarea nueva (estado lo pone el servicio). */
export type NuevaTarea = {
  usuarioId: string;
  titulo: string;
  descripcion: string;
  categoria: Categoria;
  estado: string;
  ubicacion: string;
  latitud: number | null;
  longitud: number | null;
};
