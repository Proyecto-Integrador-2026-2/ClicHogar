import { cors } from '@elysiajs/cors';
import { Elysia } from 'elysia';
import { env, isProduction } from './config/env';
import { archivosController } from './modules/usuarios/controllers/archivos.controller';
import { tareasController } from './modules/tareas/controllers/tareas.controller';
import { usuariosController } from './modules/usuarios/controllers/usuarios.controller';
import { registerErrorHandler } from './shared/errors/error-handler';

/** Frontend desplegado; se permite aunque CORS_ORIGIN no esté configurada. */
const FRONTEND_DESPLEGADO = 'https://clichogar.vercel.app';

/** Orígenes fijos permitidos (sin slash final, sin duplicados). */
export function origenesPermitidos(): string[] {
  const extra = env.CORS_ORIGIN.split(',')
    .map((o) => o.trim().replace(/\/+$/, ''))
    .filter(Boolean);
  return [...new Set([FRONTEND_DESPLEGADO, ...extra])];
}

/**
 * Construye la app Elysia sin arrancar el servidor (facilita testear con
 * `app.handle(request)` sin abrir un puerto real).
 */
export function buildApp() {
  const app = new Elysia();

  registerErrorHandler(app);

  // CORS: sin esto el navegador bloquea al frontend (origen distinto).
  // El frontend de Vercel siempre está permitido, más los orígenes extra de
  // CORS_ORIGIN (separados por coma). En desarrollo también cualquier localhost.
  app.use(
    cors({
      origin: [
        ...origenesPermitidos(),
        ...(isProduction ? [] : [/^http:\/\/localhost:\d+$/]),
      ],
    })
  );

  app
    .get('/health', () => ({ status: 'ok' }))
    .use(usuariosController)
    .use(tareasController);

  // Archivos públicos (fotos de perfil US-004). Sin auth: las URLs son
  // opacas (uuid) y solo sirven imágenes.
  app.use(archivosController);

  return app;
}
