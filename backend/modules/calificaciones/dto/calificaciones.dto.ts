import { t } from 'elysia';

export const LIMITE_COMENTARIO = 500;

/** Cuerpo de `POST /api/calificaciones`: puntuación entera de 1 a 5. */
export const CrearCalificacionDto = t.Object({
  destinatarioId: t.String({ format: 'uuid' }),
  tareaId: t.Optional(t.Nullable(t.String({ format: 'uuid' }))),
  puntuacion: t.Integer({ minimum: 1, maximum: 5 }),
  comentario: t.Optional(
    t.Nullable(t.String({ maxLength: LIMITE_COMENTARIO }))
  ),
});

/** Parámetro `:id` (uuid del usuario calificado). */
export const ParamsUsuarioDto = t.Object({
  id: t.String({ format: 'uuid' }),
});
