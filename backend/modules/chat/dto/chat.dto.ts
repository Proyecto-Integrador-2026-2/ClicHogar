import { t } from 'elysia';

export const LIMITE_MENSAJE = 2000;

/** Cuerpo de `POST /api/chat/mensajes`. */
export const EnviarMensajeDto = t.Object({
  destinatarioId: t.String({ format: 'uuid' }),
  contenido: t.String({ minLength: 1, maxLength: LIMITE_MENSAJE }),
});

/** Parámetro `:id` (uuid del otro participante). */
export const ParamsUsuarioDto = t.Object({
  id: t.String({ format: 'uuid' }),
});
