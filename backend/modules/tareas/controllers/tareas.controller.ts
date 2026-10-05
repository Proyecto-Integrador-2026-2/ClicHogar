import { Elysia } from 'elysia';
import { sesionDesdeHeaders } from '../../../shared/auth/clerk';
import { CrearTareaDto } from '../dto/crear-tarea.dto';
import { tareasService } from '../services/tareas.service';

/**
 * Módulo `tareas` (US-006).
 * - POST /api/tareas: publica una solicitud (estado 'abierta', autor de
 *   la sesión). Requiere Bearer válido: sin token o expirado responde
 *   401 para el Escenario 7 del frontend (#119).
 */
export const tareasController = new Elysia({ prefix: '/api/tareas' }).post(
  '/',
  async ({ body, headers, set }) => {
    const sesion = await sesionDesdeHeaders(headers);
    const tarea = await tareasService.crearTarea(sesion.clerkId, body);
    set.status = 201;
    return tarea;
  },
  { body: CrearTareaDto }
);
