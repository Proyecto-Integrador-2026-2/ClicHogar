import { Elysia } from 'elysia';
import { usuarioDesdeHeaders } from '../../auth/token';
import { CrearCalificacionDto, ParamsIdDto } from '../dto/calificaciones.dto';
import { calificacionesService } from '../services/calificaciones.service';

/**
 * Módulo `calificaciones` (US-016).
 * - POST /api/calificaciones: el creador califica de 1 a 5, con reseña
 *   opcional, al afiliado de una tarea finalizada. 400 si la tarea no está
 *   finalizada, 403 si no es el creador y 409 si ya la calificó.
 * - GET /api/calificaciones/tarea/:id: datos del formulario de calificación
 *   (afiliado a calificar y si ya se hizo), solo para el creador.
 * - GET /api/calificaciones/usuario/:id: reputación pública de un afiliado
 *   (US-017): promedio a 1 decimal (null sin valoraciones) y sus valoraciones
 *   verificadas, de la más reciente a la más antigua.
 */
export const calificacionesController = new Elysia({
  prefix: '/api/calificaciones',
})
  .post(
    '/',
    async ({ body, headers, set }) => {
      const usuario = await usuarioDesdeHeaders(headers);
      const calificacion = await calificacionesService.crear(usuario, body);
      set.status = 201;
      return calificacion;
    },
    { body: CrearCalificacionDto }
  )
  .get(
    '/tarea/:id',
    async ({ params, headers }) => {
      const usuario = await usuarioDesdeHeaders(headers);
      return calificacionesService.formulario(usuario, params.id);
    },
    { params: ParamsIdDto }
  )
  .get(
    '/usuario/:id',
    ({ params }) => calificacionesService.obtenerReputacion(params.id),
    { params: ParamsIdDto }
  );
