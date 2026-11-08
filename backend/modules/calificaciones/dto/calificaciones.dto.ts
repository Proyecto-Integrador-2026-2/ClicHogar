import { t } from 'elysia';

export const LIMITE_COMENTARIO = 500;

/**
 * Cuerpo de `POST /api/calificaciones` (US-016). El afiliado calificado NO
 * viaja en el body: sale de la tarea (su afiliado asignado). La reseña es
 * opcional.
 */
export const CrearCalificacionDto = t.Object({
  tareaId: t.String({ format: 'uuid' }),
  puntuacion: t.Integer({ minimum: 1, maximum: 5 }),
  comentario: t.Optional(
    t.Nullable(t.String({ maxLength: LIMITE_COMENTARIO }))
  ),
});

/** Parámetro `:id` (uuid del usuario o de la tarea). */
export const ParamsIdDto = t.Object({
  id: t.String({ format: 'uuid' }),
});
