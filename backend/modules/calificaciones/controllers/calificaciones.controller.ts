import { Elysia } from 'elysia';
import { authService } from '../../auth/services/auth.service';
import { sql } from '../../../db/client';

function tokenDesdeHeaders(headers: Record<string, string | undefined>): string {
  const auth = headers.authorization ?? headers.Authorization;
  if (!auth?.startsWith('Bearer ')) return '';
  return auth.slice('Bearer '.length).trim();
}

export const calificacionesController = new Elysia({ prefix: '/api/calificaciones' })
  .post('/', async ({ body, headers, set }) => {
    const usuario = await authService.resolverUsuario(tokenDesdeHeaders(headers as any));
    const b = body as any;
    const filas = await sql`
      INSERT INTO calificaciones (tarea_id, autor_id, destinatario_id, puntuacion, comentario)
      VALUES (${b.tareaId ?? null}, ${usuario.id}, ${b.destinatarioId}, ${b.puntuacion}, ${b.comentario ?? null})
      RETURNING id, tarea_id, autor_id, destinatario_id, puntuacion, comentario, creado_en
    `;
    set.status = 201;
    return filas[0];
  })
  .get('/usuario/:id', async ({ params }) => {
    return await sql`
      SELECT id, tarea_id, autor_id, destinatario_id, puntuacion, comentario, creado_en
      FROM calificaciones WHERE destinatario_id = ${params.id}
      ORDER BY creado_en DESC
    `;
  });