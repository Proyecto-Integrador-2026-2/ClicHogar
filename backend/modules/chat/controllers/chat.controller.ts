import { Elysia } from 'elysia';
import { authService } from '../../auth/services/auth.service';
import { sql } from '../../../db/client';

function tokenDesdeHeaders(headers: Record<string, string | undefined>): string {
  const auth = headers.authorization ?? headers.Authorization;
  if (!auth?.startsWith('Bearer ')) return '';
  return auth.slice('Bearer '.length).trim();
}

export const chatController = new Elysia({ prefix: '/api/chat' })
  .post('/mensajes', async ({ body, headers, set }) => {
    const usuario = await authService.resolverUsuario(tokenDesdeHeaders(headers as any));
    const b = body as any;
    const filas = await sql`
      INSERT INTO mensajes (remitente_id, destinatario_id, contenido)
      VALUES (${usuario.id}, ${b.destinatarioId}, ${b.contenido})
      RETURNING id, remitente_id, destinatario_id, contenido, creado_en
    `;
    set.status = 201;
    return filas[0];
  })
  .get('/conversacion/:id', async ({ params, headers }) => {
    const usuario = await authService.resolverUsuario(tokenDesdeHeaders(headers as any));
    return await sql`
      SELECT id, remitente_id, destinatario_id, contenido, creado_en
      FROM mensajes
      WHERE (remitente_id = ${usuario.id} AND destinatario_id = ${params.id})
         OR (remitente_id = ${params.id} AND destinatario_id = ${usuario.id})
      ORDER BY creado_en ASC
    `;
  });