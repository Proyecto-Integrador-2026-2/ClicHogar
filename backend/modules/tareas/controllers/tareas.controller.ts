import { Elysia } from 'elysia';
import { authService } from '../../auth/services/auth.service';
import { CrearTareaDto } from '../dto/crear-tarea.dto';
import { tareasService } from '../services/tareas.service';

function tokenDesdeHeaders(headers: Record<string, string | undefined>): string {
  const auth = headers.authorization ?? headers.Authorization;
  if (!auth?.startsWith('Bearer ')) return '';
  return auth.slice('Bearer '.length).trim();
}

export const tareasController = new Elysia({ prefix: '/api/tareas' })
  .post(
    '/',
    async ({ body, headers, set }) => {
      const usuario = await authService.resolverUsuario(tokenDesdeHeaders(headers as any));
      const tarea = await tareasService.crearTarea(usuario.id, body);
      set.status = 201;
      return tarea;
    },
    { body: CrearTareaDto }
  )
  .get('/', async ({ headers, query }) => {
    await authService.resolverUsuario(tokenDesdeHeaders(headers as any));
    const lat = query.lat ? Number(query.lat) : undefined;
    const lng = query.lng ? Number(query.lng) : undefined;
    const radio = query.radio ? Number(query.radio) : undefined;
    return tareasService.listarAbiertas({ lat, lng, radio });
  });