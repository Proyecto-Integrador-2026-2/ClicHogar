import { cors } from '@elysiajs/cors';
import { Elysia } from 'elysia';
import { env, isProduction } from './config/env';
import { archivosController } from './modules/usuarios/controllers/archivos.controller';
import { usuariosController } from './modules/usuarios/controllers/usuarios.controller';
import { registerErrorHandler } from './shared/errors/error-handler';

/**
 * Construye la app Elysia sin arrancar el servidor (facilita testear con
 * `app.handle(request)` sin abrir un puerto real).
 */
export function buildApp() {
  const app = new Elysia();

  registerErrorHandler(app);

  // CORS: sin esto el navegador bloquea al frontend (origen distinto).
  // Producción = allowlist exacta; desarrollo = cualquier localhost.
  app.use(
    cors({
      origin:
        isProduction && env.CORS_ORIGIN
          ? env.CORS_ORIGIN
          : /http:\/\/localhost:\d+$/,
    })
  );

  app.get('/health', () => ({ status: 'ok' })).use(usuariosController);

  // Archivos públicos (fotos de perfil US-004). Sin auth: las URLs son
  // opacas (uuid) y solo sirven imágenes.
  app.use(archivosController);

  return app;
}
