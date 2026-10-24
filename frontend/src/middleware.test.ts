/**
 * Pruebas del middleware: `clerkMiddleware` se reemplaza por un passthrough
 * para ejercitar solo la lógica propia (redirect y Cache-Control).
 */
import { describe, expect, mock, test } from 'bun:test';

mock.module('@clerk/astro/server', () => ({
  clerkMiddleware: (handler: unknown) => handler,
}));

const { onRequest } = (await import('./middleware')) as unknown as {
  onRequest: (
    auth: () => { userId: string | null },
    context: { request: Request; redirect: (ruta: string) => unknown },
    next: () => Promise<Response>
  ) => unknown;
};

function ejecutar(ruta: string, userId: string | null) {
  const redirecciones: string[] = [];
  const resultado = onRequest(
    () => ({ userId }),
    {
      request: new Request(`http://localhost${ruta}`),
      redirect: (destino) => {
        redirecciones.push(destino);
        return 'redirigido';
      },
    },
    async () => new Response('ok')
  );
  return { resultado, redirecciones };
}

describe('middleware', () => {
  test('sin sesión en ruta protegida redirige a /login', () => {
    // Given: un usuario sin sesión que pide /dashboard
    // When: se ejecuta el middleware
    const { resultado, redirecciones } = ejecutar('/dashboard', null);
    // Then: redirige a /login
    expect(resultado).toBe('redirigido');
    expect(redirecciones).toEqual(['/login']);
  });

  test('con sesión en ruta protegida añade no-store', async () => {
    // Given: un usuario con sesión que pide /dashboard
    // When: se ejecuta el middleware
    const { resultado } = ejecutar('/dashboard', 'user_1');
    const respuesta = (await resultado) as Response;
    // Then: la respuesta sale con Cache-Control: no-store
    expect(respuesta.headers.get('Cache-Control')).toBe('no-store');
  });

  test('ruta pública pasa sin tocar la caché', async () => {
    // Given: un usuario sin sesión que pide /login
    // When: se ejecuta el middleware
    const { resultado, redirecciones } = ejecutar('/login', null);
    const respuesta = (await resultado) as Response;
    // Then: pasa sin redirigir y sin tocar la caché
    expect(redirecciones).toEqual([]);
    expect(respuesta.headers.get('Cache-Control')).toBeNull();
  });
});
