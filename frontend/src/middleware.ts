/**
 * Middleware global: adjunta la sesión Clerk (`Astro.locals.auth()`) y
 * protege rutas privadas (US-003, tarea #129).
 * - Sin sesión en ruta protegida → redirect a `/login`.
 * - Respuestas protegidas salen con `Cache-Control: no-store` para que el
 *   botón Atrás no muestre contenido privado cacheado.
 *
 * NOTA DE ARQUITECTURA: con `output: 'static'` esto rige en `astro dev`;
 * servido como estático puro el middleware no se ejecuta. Cuando los
 * paneles existan y se desplieguen con adapter (SSR), la guardia opera
 * en producción sin cambios.
 */
import { clerkMiddleware } from '@clerk/astro/server';
import { isProtectedRoute } from './lib/routes';

export const onRequest = clerkMiddleware((auth, context, next) => {
  const { userId } = auth();
  const ruta = new URL(context.request.url).pathname;

  if (!userId && isProtectedRoute(ruta)) {
    return context.redirect('/login');
  }

  return next().then((respuesta) => {
    if (isProtectedRoute(ruta)) {
      respuesta.headers.set('Cache-Control', 'no-store');
    }
    return respuesta;
  });
});
