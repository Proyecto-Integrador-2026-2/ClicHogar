import { Elysia } from 'elysia';
import {
  LoginDto,
  OlvideContrasenaDto,
  RegistroDto,
  RestablecerContrasenaDto,
} from '../dto/auth.dto';
import { authService } from '../services/auth.service';
import { recuperacionService } from '../services/recuperacion.service';
import { tokenDesdeHeaders } from '../token';

/**
 * Autenticación propia: registro, login, sesión actual, logout y
 * recuperación de contraseña (`olvide-contrasena` / `restablecer-contrasena`). El token
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
  .post(
    '/olvide-contrasena',
    ({ body }) => recuperacionService.solicitar(body),
    {
      body: OlvideContrasenaDto,
    }
  )
  .post(
    '/restablecer-contrasena',
    ({ body }) => recuperacionService.restablecer(body),
    { body: RestablecerContrasenaDto }
  )
  .get('/me', ({ headers }) => authService.me(tokenDesdeHeaders(headers)))
  .post('/logout', async ({ headers }) => {
    await authService.logout(tokenDesdeHeaders(headers));
    return { ok: true };
  });
