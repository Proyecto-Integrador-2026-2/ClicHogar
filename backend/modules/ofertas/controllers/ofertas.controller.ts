import { Elysia } from 'elysia';
import { usuarioDesdeHeaders } from '../../auth/token';
import { EnviarOfertaDto, ParamsTareaDto } from '../dto/ofertas.dto';
import { ofertasService } from '../services/ofertas.service';

/**
 * Módulo `ofertas` (US-011 y US-012).
 * - GET /api/tareas/:id/ofertas: ofertas recibidas, solo para el creador de la
 *   tarea (403 para cualquier otra persona), con la reputación de cada afiliado.
 * - POST /api/tareas/:id/ofertas: el afiliado de la sesión se postula a la
 *   tarea (201). 403 si no es afiliado o es su propia tarea, 404 si no
 *   existe, 409 si ya se postuló y 410 si la tarea ya no acepta ofertas.
 */
export const ofertasController = new Elysia({ prefix: '/api/tareas' })
  .post(
    '/:id/ofertas',
    async ({ params, body, headers, set }) => {
      const afiliado = await usuarioDesdeHeaders(headers);
      const oferta = await ofertasService.enviar(
        afiliado,
        params.id,
        body.mensaje
      );
      set.status = 201;
      return oferta;
    },
    { params: ParamsTareaDto, body: EnviarOfertaDto }
  )
  .get(
    '/:id/ofertas',
    async ({ params, headers }) => {
      const visitante = await usuarioDesdeHeaders(headers);
      return ofertasService.listarRecibidas(visitante, params.id);
    },
    { params: ParamsTareaDto }
  );
