import { Elysia } from 'elysia';
import { authService } from '../services/auth.service';

function tokenDesdeHeaders(headers: Record<string, string | undefined>): string {
  const auth = headers.authorization ?? headers.Authorization;
  if (!auth?.startsWith('Bearer ')) return '';
  return auth.slice('Bearer '.length).trim();
}

export const authController = new Elysia({ prefix: '/api/auth' })
  .post('/register', async ({ body, set }) => {
    const resultado = await authService.register(body as any);
    set.status = 201;
    return resultado;
  })
  .post('/login', async ({ body, set }) => {
    const resultado = await authService.login(body as any);
    set.status = 200;
    return resultado;
  })
  .get('/me', async ({ headers }) => {
    const token = tokenDesdeHeaders(headers as any);
    return authService.me(token);
  })
  .post('/logout', async ({ headers }) => {
    const token = tokenDesdeHeaders(headers as any);
    await authService.logout(token);
    return { ok: true };
  });