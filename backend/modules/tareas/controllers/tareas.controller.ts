import { Elysia, t } from 'elysia';
import { usuarioDesdeHeaders } from '../../auth/token';
import { CrearTareaDto } from '../dto/crear-tarea.dto';
import { tareasService } from '../services/tareas.service';

/**
 * Módulo `tareas` (US-006 y US-008).
 * - POST /api/tareas: publica una solicitud (estado 'abierta').
 * - GET /api/tareas: tablero paginado de solicitudes abiertas, recientes
 *   primero. Query opcional: `pagina`, `limite` y, juntos, `lat`, `lng`,
 *   `radio` (km). Responde `{ tareas, pagina, limite, hayMas }`.
 * Ambos exigen Bearer válido (401 si falta o expiró).
 */
export const tareasController = new Elysia({ prefix: '/api/tareas' })
  .post(
    '/',
    async ({ body, headers, set }) => {
      const usuario = await usuarioDesdeHeaders(headers);
      const tarea = await tareasService.crearTarea(usuario.id, body);
      set.status = 201;
      return tarea;
    },
    { body: CrearTareaDto }
  )
  .get(
    '/',
    async ({ headers, query }) => {
      await usuarioDesdeHeaders(headers);
      return tareasService.listarAbiertas(query);
    },
    {
      query: t.Object({
        pagina: t.Optional(t.Numeric()),
        limite: t.Optional(t.Numeric()),
        lat: t.Optional(t.Numeric()),
        lng: t.Optional(t.Numeric()),
        radio: t.Optional(t.Numeric()),
      }),
    }
  );
