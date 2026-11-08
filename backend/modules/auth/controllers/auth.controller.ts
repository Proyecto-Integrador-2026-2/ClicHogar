import { Elysia } from 'elysia';
import { LoginDto, RegistroDto } from '../dto/auth.dto';
import { authService } from '../services/auth.service';
import { tokenDesdeHeaders } from '../token';

/**
 * Autenticación propia: registro, login, sesión actual y logout. El token
 * viaja como `Authorization: Bearer <token>`.
 */
export const authController = new Elysia({ prefix: '/api/auth' })
  .post(
    '/register',
    async ({ body, set }) => {
      const resultado = await authService.register(body);
      set.status = 201;
      return resultado;
    },
    { body: RegistroDto }
  )
  .post('/login', ({ body }) => authService.login(body), { body: LoginDto })
  .get('/me', ({ headers }) => authService.me(tokenDesdeHeaders(headers)))
  .post('/logout', async ({ headers }) => {
    await authService.logout(tokenDesdeHeaders(headers));
    return { ok: true };
  });
