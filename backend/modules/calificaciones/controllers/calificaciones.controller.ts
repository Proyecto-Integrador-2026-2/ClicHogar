import { Elysia } from 'elysia';
import { usuarioDesdeHeaders } from '../../auth/token';
import {
  CrearCalificacionDto,
  ParamsUsuarioDto,
} from '../dto/calificaciones.dto';
import { calificacionesService } from '../services/calificaciones.service';

/**
 * Módulo `calificaciones`.
 * - POST /api/calificaciones: califica a otro usuario (autor = sesión).
 * - GET /api/calificaciones/usuario/:id: calificaciones recibidas (público).
 */
export const calificacionesController = new Elysia({
  prefix: '/api/calificaciones',
})
  .post(
    '/',
    async ({ body, headers, set }) => {
      const usuario = await usuarioDesdeHeaders(headers);
      const calificacion = await calificacionesService.crear(usuario.id, body);
      set.status = 201;
      return calificacion;
    },
    { body: CrearCalificacionDto }
  )
  .get(
    '/usuario/:id',
    ({ params }) => calificacionesService.listarPorUsuario(params.id),
    { params: ParamsUsuarioDto }
  );
