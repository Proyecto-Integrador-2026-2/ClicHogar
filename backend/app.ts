import { Elysia } from 'elysia';
import { usuariosController } from './modules/usuarios/controllers/usuarios.controller';
import { registerErrorHandler } from './shared/errors/error-handler';

/**
 * Construye la app Elysia sin arrancar el servidor (facilita testear con
 * `app.handle(request)` sin abrir un puerto real).
 */
export function buildApp() {
  const app = new Elysia();

  registerErrorHandler(app);

  app.get('/health', () => ({ status: 'ok' })).use(usuariosController);

  return app;
}
