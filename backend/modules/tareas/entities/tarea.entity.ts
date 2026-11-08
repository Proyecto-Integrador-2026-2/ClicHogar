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

/** Persona con la que se coordina una tarea asignada (US-013, contacto). */
export type UsuarioContacto = { id: string; nombre: string; email: string };

/** Tarea con los datos de su autor y del afiliado asignado (detalle). */
export type TareaEncontrada = {
  tarea: Tarea;
  autor: AutorTarea;
  /** Solo se revela a la contraparte de una tarea asignada. */
  autorEmail: string;
  yaPostulado: boolean;
  asignado: UsuarioContacto | null;
};

/** Resultado de intentar asignar la tarea de forma atómica (US-013). */
export type ResultadoAsignacion =
  | { tipo: 'asignada'; afiliadoId: string }
  | { tipo: 'no-abierta' }
  | { tipo: 'oferta-invalida' };

/** Resultado de intentar finalizar la tarea de forma atómica (US-014). */
export type ResultadoFinalizacion =
  | { tipo: 'finalizada'; afiliadoId: string; finalizadaEn: Date }
  | { tipo: 'no-asignada' };

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
