/**
 * Vocabulario fijo de categorías (US-006, Escenario de validación).
 * Una sola fuente para el DTO (Elysia), el servicio y el frontend.
 * ASCII en claves internas; las etiquetas con tilde viven en el frontend.
 */
export const CATEGORIAS = [
  'Limpieza',
  'Plomería',
  'Electricidad',
  'Jardinería',
  'Mudanzas',
  'Mascotas',
  'Soporte técnico',
  'Ayuda doméstica',
] as const;

export type Categoria = (typeof CATEGORIAS)[number];

/** Estado inicial de toda tarea recién publicada (#118). */
export const ESTADO_INICIAL_TAREA = 'abierta' as const;
