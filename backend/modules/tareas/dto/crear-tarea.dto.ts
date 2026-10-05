import { t } from 'elysia';
import { CATEGORIAS } from '../categorias';

/**
 * Body de publicación de tarea (US-006, Esc 1 y 3-5).
 * Elysia valida forma y rangos ANTES del controller; el service
 * re-valida y normaliza (trim). `usuarioId`, `estado` y coordenadas
 * fuera de rango nunca entran por aquí como autoridad: el estado lo
 * fija el servidor y el autor sale del token.
 */
export const CrearTareaDto = t.Object({
  titulo: t.String({
    minLength: 1,
    maxLength: 120,
    error: 'El título es obligatorio (máximo 120 caracteres).',
  }),
  descripcion: t.String({
    minLength: 20,
    maxLength: 1000,
    error:
      'Por favor, proporciona más detalles (mínimo 20 caracteres, máximo 1000).',
  }),
  categoria: t.Union(
    CATEGORIAS.map((c) => t.Literal(c)),
    { error: 'La categoría no es válida.' }
  ),
  ubicacion: t.String({
    minLength: 1,
    maxLength: 200,
    error: 'La ubicación es obligatoria.',
  }),
  latitud: t.Optional(
    t.Number({
      minimum: -90,
      maximum: 90,
      error: 'La coordenada latitud no es válida.',
    })
  ),
  longitud: t.Optional(
    t.Number({
      minimum: -180,
      maximum: 180,
      error: 'La coordenada longitud no es válida.',
    })
  ),
});

export type CrearTareaInput = typeof CrearTareaDto.static;
