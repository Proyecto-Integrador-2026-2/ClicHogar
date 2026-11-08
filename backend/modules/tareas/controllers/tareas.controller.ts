import { Elysia, t } from 'elysia';
import { usuarioDesdeHeaders } from '../../auth/token';
import { CrearTareaDto } from '../dto/crear-tarea.dto';
import { tareasService } from '../services/tareas.service';

const ParamsTareaDto = t.Object({ id: t.String({ format: 'uuid' }) });
const AsignarDto = t.Object({ ofertaId: t.String({ format: 'uuid' }) });
const FinalizarDto = t.Object({ pagoConfirmado: t.Boolean() });

/**
 * Módulo `tareas` (US-006 y US-008).
 * - POST /api/tareas: publica una solicitud (estado 'abierta').
 * - GET /api/tareas: tablero paginado de solicitudes abiertas, recientes
 *   primero. Query opcional: `pagina`, `limite` y, juntos, `lat`, `lng`,
 *   `radio` (km). Responde `{ tareas, pagina, limite, hayMas }`.
 * - GET /api/tareas/mias: "Mis solicitudes" con el número de ofertas (US-012).
 * - GET /api/tareas/:id: detalle de una tarea (US-009): 404 si no existe,
 *   410 si ya no está abierta (salvo para su autor).
 * - POST /api/tareas/:id/asignar: el creador elige a un afiliado (US-013).
 *   403 si no es el creador, 404 si la oferta no es de la tarea y 409 si ya
 *   tiene un afiliado asignado.
 * - POST /api/tareas/:id/finalizar: el creador cierra la tarea confirmando
 *   el pago en efectivo (US-014). 403 si no es el creador, 409 si no está
 *   asignada.
 * Todos exigen Bearer válido (401 si falta o expiró).
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
  )
  .get('/mias', async ({ headers }) => {
    const usuario = await usuarioDesdeHeaders(headers);
    return tareasService.listarPropias(usuario.id);
  })
  .get(
    '/:id',
    async ({ headers, params }) => {
      const visitante = await usuarioDesdeHeaders(headers);
      return tareasService.obtenerDetalle(visitante, params.id);
    },
    { params: ParamsTareaDto }
  )
  .post(
    '/:id/asignar',
    async ({ headers, params, body }) => {
      const visitante = await usuarioDesdeHeaders(headers);
      return tareasService.asignar(visitante, params.id, body.ofertaId);
    },
    { params: ParamsTareaDto, body: AsignarDto }
  )
  .post(
    '/:id/finalizar',
    async ({ headers, params, body }) => {
      const visitante = await usuarioDesdeHeaders(headers);
      return tareasService.finalizar(visitante, params.id, body.pagoConfirmado);
    },
    { params: ParamsTareaDto, body: FinalizarDto }
  );
