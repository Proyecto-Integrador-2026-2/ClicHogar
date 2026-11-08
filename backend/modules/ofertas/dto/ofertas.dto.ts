import { t } from 'elysia';

export const LIMITE_MENSAJE_OFERTA = 500;

/** Cuerpo de `POST /api/tareas/:id/ofertas`: el mensaje es opcional. */
export const EnviarOfertaDto = t.Object({
  mensaje: t.Optional(
    t.Nullable(t.String({ maxLength: LIMITE_MENSAJE_OFERTA }))
  ),
});

/** Parámetro `:id` (uuid de la tarea). */
export const ParamsTareaDto = t.Object({ id: t.String({ format: 'uuid' }) });
