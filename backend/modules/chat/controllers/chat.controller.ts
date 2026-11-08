import { Elysia } from 'elysia';
import { usuarioDesdeHeaders } from '../../auth/token';
import { EnviarMensajeDto, ParamsUsuarioDto } from '../dto/chat.dto';
import { chatService } from '../services/chat.service';

/**
 * Módulo `chat`: mensajería directa entre usuarios.
 * - POST /api/chat/mensajes: envía un mensaje (el remitente es la sesión).
 * - GET /api/chat/conversacion/:id: mensajes entre la sesión y `:id`.
 * Ambos exigen Bearer válido.
 */
export const chatController = new Elysia({ prefix: '/api/chat' })
  .post(
    '/mensajes',
    async ({ body, headers, set }) => {
      const usuario = await usuarioDesdeHeaders(headers);
      const mensaje = await chatService.enviar(
        usuario.id,
        body.destinatarioId,
        body.contenido
      );
      set.status = 201;
      return mensaje;
    },
    { body: EnviarMensajeDto }
  )
  .get(
    '/conversacion/:id',
    async ({ params, headers }) => {
      const usuario = await usuarioDesdeHeaders(headers);
      return chatService.conversacion(usuario.id, params.id);
    },
    { params: ParamsUsuarioDto }
  );
