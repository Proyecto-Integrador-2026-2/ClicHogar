/**
 * Reglas de validación del formulario de publicación (US-006).
 * Espejo del backend (DTO + `normalizarTarea`): título obligatorio,
 * descripción 20-1000, categoría del vocabulario y ubicación obligatoria.
 * Las coordenadas las pondrá el autocompletado (#111); hoy no se piden.
 */

export type ValoresTarea = {
  titulo: string;
  descripcion: string;
  categoria: string;
  ubicacion: string;
};

/** Claves con error visible. */
export type ClaveErrorTarea =
  'titulo' | 'descripcion' | 'categoria' | 'ubicacion';

/** Ids de ancla del formulario (prefijo ch- para no colisionar). */
export const IDS_TAREA = {
  titulo: 'ch-tarea-titulo',
  descripcion: 'ch-tarea-descripcion',
  categoria: 'ch-tarea-categoria',
  ubicacion: 'ch-tarea-ubicacion',
} as const;

/** Etiquetas legibles para el resumen de errores. */
export const ETIQUETAS_TAREA: Record<ClaveErrorTarea, string> = {
  titulo: 'Título',
  descripcion: 'Descripción',
  categoria: 'Categoría',
  ubicacion: 'Ubicación aproximada',
};

/** Vocabulario fijo (misma fuente que el backend, etiquetas con tilde). */
export const CATEGORIAS_TAREA = [
  'Limpieza',
  'Plomería',
  'Electricidad',
  'Jardinería',
  'Mudanzas',
  'Mascotas',
  'Soporte técnico',
  'Ayuda doméstica',
] as const;

/** Descripción: mínimo 20, máximo 1000 (Escenarios 4 y 5). */
export const MIN_DESCRIPCION = 20;
export const MAX_DESCRIPCION = 1000;

const OBLIGATORIO = 'Este campo es obligatorio';

/** Un validador por campo: devuelve el mensaje o undefined si pasa. */
const VALIDADORES: Record<
  ClaveErrorTarea,
  (v: ValoresTarea) => string | undefined
> = {
  titulo: (v) => {
    const limpio = v.titulo.trim();
    if (!limpio) return OBLIGATORIO;
    return limpio.length > 120
      ? 'El título no puede superar 120 caracteres.'
      : undefined;
  },
  descripcion: (v) => {
    const limpia = v.descripcion.trim();
    if (!limpia) return OBLIGATORIO;
    return limpia.length < MIN_DESCRIPCION
      ? 'Por favor, proporciona más detalles (mínimo 20 caracteres)...'
      : undefined;
  },
  categoria: (v) =>
    CATEGORIAS_TAREA.includes(v.categoria as (typeof CATEGORIAS_TAREA)[number])
      ? undefined
      : 'Selecciona una categoría válida.',
  ubicacion: (v) => (v.ubicacion.trim() ? undefined : OBLIGATORIO),
};

/** Valida un campo y devuelve el mensaje a mostrar (o undefined si pasa). */
export function validarCampoTarea(
  campo: ClaveErrorTarea,
  v: ValoresTarea
): string | undefined {
  return VALIDADORES[campo](v);
}

/** Campos evaluados en cada validación (orden de presentación). */
export const CAMPOS_TAREA: Array<ClaveErrorTarea> = [
  'titulo',
  'descripcion',
  'categoria',
  'ubicacion',
];
