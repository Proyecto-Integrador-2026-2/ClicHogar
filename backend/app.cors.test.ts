import { describe, expect, test } from 'bun:test';

process.env.DATABASE_URL ??= 'postgres://test';
process.env.CLERK_SECRET_KEY ??= 'sk_test';

const { buildApp } = await import('./app');

function preflight(origin: string) {
  return buildApp().handle(
    new Request('http://localhost/api/tareas', {
      method: 'OPTIONS',
      headers: {
        Origin: origin,
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'authorization',
      },
    })
  );
}

describe('CORS', () => {
  test('permite el frontend desplegado en Vercel', async () => {
    const res = await preflight('https://clichogar.vercel.app');
    expect(res.headers.get('access-control-allow-origin')).toBe(
      'https://clichogar.vercel.app'
    );
  });

  test('no permite orígenes ajenos', async () => {
    const res = await preflight('https://malicioso.example.com');
    expect(res.headers.get('access-control-allow-origin')).toBeNull();
  });
});
